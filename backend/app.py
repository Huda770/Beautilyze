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

import requests
import base64

ROBOFLOW_API_KEY = os.environ.get('ROBOFLOW_API_KEY', '')
ROBOFLOW_MODEL_ID = "face-detection-bj0ij/1"

def contains_face(pil_image):
    if not ROBOFLOW_API_KEY:
        gray = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2GRAY)
        detector = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        return len(detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))) > 0
    buffered = io.BytesIO()
    pil_image.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')

    response = requests.post(
        f"https://detect.roboflow.com/{ROBOFLOW_MODEL_ID}",
        params={"api_key": ROBOFLOW_API_KEY},
        data=img_str,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )

    response.raise_for_status()
    result = response.json()
    predictions = result.get("predictions", [])
    print(f"Roboflow detected {len(predictions)} face(s)")
    return len(predictions) > 0









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
        'face_detection': 'roboflow' if ROBOFLOW_API_KEY else 'local-opencv',
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
    except requests.RequestException:
        app.logger.exception('Face detection service request failed')
        return jsonify({'error': 'Face detection service is unavailable. Please try again shortly.'}), 502
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


    if not concerns:
        return jsonify({"error": "Please select at least one skin concern."}), 400

    routine_concerns = ['General'] if concerns == ['No Skin Concerns'] else concerns
    routine = build_routine(predicted_skin_type, routine_concerns, age_group, selected_categories)

    if not routine:
        return jsonify({"error": "No suitable products found for your profile. Try different concerns."}), 200

    response = {"routine": routine, "skin_type": predicted_skin_type, "confidence": confidence.item()}
    if low_confidence:
        response["note"] = "Analysis confidence was low — for best results, use a clear, well-lit front-facing photo."

    return jsonify(response)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '5000')), debug=False)
