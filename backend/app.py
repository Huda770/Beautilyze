import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import io
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import json as json_lib
import os
import sqlite3
from pathlib import Path
from recommend import build_routine
from accounts import create_auth_blueprint, initialize_accounts_database
import cv2
import numpy as np

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent

# Create the local catalogue on first run without overwriting user data
def initialize_product_database():
    database = BASE_DIR / 'skincare.db'
    with sqlite3.connect(database) as connection:
        connection.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                skin_types TEXT NOT NULL,
                ingredients TEXT NOT NULL
            )
        ''')
        count = connection.execute('SELECT COUNT(*) FROM products').fetchone()[0]
        if count == 0:
            from products import products
            connection.executemany(
                'INSERT INTO products (name, category, skin_types, ingredients) VALUES (?, ?, ?, ?)',
                [(p['name'], p['category'], ','.join(p['skin_types']), ','.join(p['ingredients'])) for p in products],
            )


initialize_product_database()
initialize_accounts_database(BASE_DIR / 'skincare.db')
app.register_blueprint(create_auth_blueprint(BASE_DIR / 'skincare.db'))

# Load all local validation cascades once. Requiring multiple independent
# signals reduces false positives from textures and objects in arbitrary photos.
CASCADE_DIR = Path(cv2.data.haarcascades)
FACE_CASCADE = cv2.CascadeClassifier(str(CASCADE_DIR / 'haarcascade_frontalface_default.xml'))
ALT_FACE_CASCADE = cv2.CascadeClassifier(str(CASCADE_DIR / 'haarcascade_frontalface_alt2.xml'))
EYE_CASCADE = cv2.CascadeClassifier(str(CASCADE_DIR / 'haarcascade_eye_tree_eyeglasses.xml'))
for cascade, filename in (
    (FACE_CASCADE, 'haarcascade_frontalface_default.xml'),
    (ALT_FACE_CASCADE, 'haarcascade_frontalface_alt2.xml'),
    (EYE_CASCADE, 'haarcascade_eye_tree_eyeglasses.xml'),
):
    if cascade.empty():
        raise RuntimeError(f'OpenCV could not load its required cascade: {CASCADE_DIR / filename}')

# Load class names
with open('class_names.json', 'r') as f:
    class_names = json.load(f)

# Rebuild the same model structure used in training
model = models.resnet18(weights=None)
model.fc = nn.Sequential(
    nn.Dropout(0.5),
    nn.Linear(model.fc.in_features, len(class_names))
)

# Load your trained weights
model.load_state_dict(torch.load('skin_type_model.pth', map_location='cpu'))
model.eval()

def contains_face(pil_image):
    """Accept only a face box supported by a second face and eye detector."""
    rgb = np.asarray(pil_image.convert('RGB'))
    if rgb.size == 0 or rgb.ndim != 3 or rgb.shape[2] != 3:
        raise ValueError('Image could not be converted to RGB.')
    gray = cv2.equalizeHist(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY))
    min_size = max(80, min(gray.shape[:2]) // 8)
    options = dict(scaleFactor=1.1, minNeighbors=7, minSize=(min_size, min_size))
    face_boxes = FACE_CASCADE.detectMultiScale(gray, **options)
    alt_boxes = ALT_FACE_CASCADE.detectMultiScale(gray, **options)

    def overlap(first, second):
        left, top = max(first[0], second[0]), max(first[1], second[1])
        right = min(first[0] + first[2], second[0] + second[2])
        bottom = min(first[1] + first[3], second[1] + second[3])
        intersection = max(0, right - left) * max(0, bottom - top)
        union = first[2] * first[3] + second[2] * second[3] - intersection
        return intersection / union if union else 0

    for x, y, width, height in face_boxes:
        face_box = (x, y, width, height)
        if not any(overlap(face_box, tuple(map(int, other))) >= 0.35 for other in alt_boxes):
            continue
        upper_face = gray[y:y + int(height * 0.68), x:x + width]
        eyes = EYE_CASCADE.detectMultiScale(
            upper_face,
            scaleFactor=1.1,
            minNeighbors=6,
            minSize=(max(12, width // 10), max(12, height // 10)),
        )
        centers = [(ex + ew / 2, ey + eh / 2) for ex, ey, ew, eh in eyes]
        for index, first in enumerate(centers):
            for second in centers[index + 1:]:
                distance_x = abs(first[0] - second[0])
                distance_y = abs(first[1] - second[1])
                if width * 0.22 <= distance_x <= width * 0.7 and distance_y <= height * 0.16:
                    return True
    return False









transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': True,
        'face_detection': 'opencv-haar-consensus-eye',
    })

@app.route('/predict', methods=['POST'])
def predict():
    # Check if an image was actually uploaded
    if 'image' not in request.files or request.files['image'].filename == '':
        return jsonify({"error": "No image uploaded. Please select a photo."}), 400

    file = request.files['image']

    try:
        img = Image.open(io.BytesIO(file.read())).convert('RGB')
    except Exception:
        return jsonify({"error": "Invalid image file. Please upload a valid photo (jpg/png)."}), 400

    print("3. Starting face detection...")
    try:
        face_detected = contains_face(img)
    except (cv2.error, ValueError) as exc:
        app.logger.exception('Local OpenCV face detection failed')
        return jsonify({'error': f'Image processing failed: {exc}'}), 422
    if not face_detected:
        return jsonify({"error": "No face detected. Please upload a clear photo of a face."}), 400
    print("4. Face detection done")

    tensor = transform(img).unsqueeze(0)

    with torch.no_grad():
        output = model(tensor)
        probabilities = torch.softmax(output, dim=1)
        confidence, predicted_idx = torch.max(probabilities, 1)

    predicted_skin_type = class_names[predicted_idx.item()]

    # Warn if model isn't very confident
    low_confidence = confidence.item() < 0.5

    try:
        concerns = json_lib.loads(request.form.get('concerns', '[]'))
        selected_categories = json_lib.loads(request.form.get('categories', '[]'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid analysis options.'}), 400
    age_group = request.form.get('age_group', '14-18')
    try:
        allergies = json_lib.loads(request.form.get('allergies', '[]'))
        sensitivities = json_lib.loads(request.form.get('sensitivities', '[]'))
        if not isinstance(allergies, list) or not all(isinstance(a, str) for a in allergies):
            raise ValueError()
        if not isinstance(sensitivities, list) or not all(isinstance(s, str) for s in sensitivities):
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid ingredient preferences format."}), 400

    if not concerns:
        return jsonify({"error": "Please select at least one skin concern."}), 400

    combined_avoid_list = allergies + sensitivities
    routine_concerns = ['General'] if concerns == ['No Skin Concerns'] else concerns
    routine = build_routine(
        predicted_skin_type,
        routine_concerns,
        age_group,
        selected_categories,
        allergies=combined_avoid_list)

    response = {"routine": routine, "skin_type": predicted_skin_type, "confidence": confidence.item()}
    if low_confidence:
        response["note"] = "Analysis confidence was low — for best results, use a clear, well-lit front-facing photo."

    return jsonify(response)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '5000')), debug=False)
