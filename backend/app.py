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
from contextlib import closing
from pathlib import Path
from recommend import build_routine
from accounts import create_auth_blueprint, initialize_accounts_database
from explanations import CONCERN_EXPLANATIONS, explanations_for
from profile_store import validate_age_group, validate_categories
from model_config import CLASS_NAMES, IMAGE_SIZE, NORMALIZE_MEAN, NORMALIZE_STD, CHECKPOINT_NAME
import cv2
import numpy as np

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / 'skincare.db'

# Create the local catalogue on first run without overwriting user data
def initialize_product_database():
    with sqlite3.connect(DATABASE_PATH) as connection:
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


def get_product_categories():
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        rows = connection.execute('SELECT DISTINCT category FROM products ORDER BY category').fetchall()
    return [row[0] for row in rows]


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

# Keep the output-neuron order explicit and shared with training/evaluation.
class_names = list(CLASS_NAMES)
with open(BASE_DIR / 'class_names.json', 'r') as f:
    configured_class_names = json.load(f)
if configured_class_names != class_names:
    raise RuntimeError(
        f'class_names.json must match model_config.CLASS_NAMES in order: {class_names}'
    )

# Rebuild the same model structure used in training
model = models.resnet18(weights=None)
model.fc = nn.Sequential(
    nn.Dropout(0.5),
    nn.Linear(model.fc.in_features, len(class_names))
)

# Load your trained weights
checkpoint = torch.load(BASE_DIR / CHECKPOINT_NAME, map_location='cpu')
if tuple(checkpoint['fc.1.weight'].shape) != (len(class_names), model.fc[1].in_features):
    raise RuntimeError(
        f'{CHECKPOINT_NAME} output layer does not match {len(class_names)} configured classes: '
        f"{tuple(checkpoint['fc.1.weight'].shape)}"
    )
if tuple(checkpoint['fc.1.bias'].shape) != (len(class_names),):
    raise RuntimeError(f'{CHECKPOINT_NAME} output bias does not match configured classes')
model.load_state_dict(checkpoint)
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
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=NORMALIZE_MEAN, std=NORMALIZE_STD)
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
        return jsonify({"error": "No face detected. Please upload another image with your face clearly visible."}), 400
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
        selected_categories = json_lib.loads(request.form.get('categories', '[]'))
        concerns = json_lib.loads(request.form.get('concerns', '[]'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid analysis options.'}), 400
    if not isinstance(concerns, list) or not concerns or any(not isinstance(item, str) for item in concerns):
        return jsonify({'error': 'Please select at least one supported skin goal.'}), 400
    concerns = list(dict.fromkeys(concerns))
    unsupported_concerns = [item for item in concerns if item not in CONCERN_EXPLANATIONS]
    if unsupported_concerns:
        return jsonify({'error': 'One or more selected skin goals are not supported.'}), 400
    if 'No Skin Concerns' in concerns and len(concerns) != 1:
        return jsonify({'error': '“No Skin Concerns” cannot be combined with another goal.'}), 400

    try:
        allergies = json_lib.loads(request.form.get('allergies', '[]'))
        sensitivities = json_lib.loads(request.form.get('sensitivities', '[]'))
        if not isinstance(allergies, list) or not all(isinstance(a, str) for a in allergies):
            raise ValueError()
        if not isinstance(sensitivities, list) or not all(isinstance(s, str) for s in sensitivities):
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid ingredient preferences format."}), 400

    try:
        selected_categories = validate_categories(selected_categories, get_product_categories())
        request_age_group = validate_age_group(request.form.get('age_group', '19-25'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    age_group = request_age_group
    preferred_categories = None
    strict_categories = selected_categories or None

    combined_avoid_list = allergies + sensitivities
    routine_concerns = ['General'] if concerns == ['No Skin Concerns'] else concerns
    routine = build_routine(
        predicted_skin_type,
        routine_concerns,
        age_group,
        selected_categories=strict_categories,
        allergies=combined_avoid_list,
        preferred_categories=preferred_categories,
    )

    response = {
        "routine": routine,
        "skin_type": predicted_skin_type,
        "confidence": confidence.item(),
        "result_reliable": not low_confidence,
        "explanations": explanations_for(predicted_skin_type, concerns),
        "preferred_categories": preferred_categories or [],
    }
    if low_confidence:
        response["note"] = "This result is uncertain. Try another clear, well-lit front-facing photo; the model's confidence is not medical certainty."
    if not routine:
        response["recommendation_note"] = "No matching products were found in the current catalogue for this result and these goals."

    return jsonify(response)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '5000')), debug=False)
