import io
import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path

import cv2
import numpy as np
import torch
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image

from accounts import create_auth_blueprint, initialize_accounts_database
from explanations import CONCERN_EXPLANATIONS, explanations_for
from model_config import CHECKPOINT_NAME, CLASS_NAMES, build_model, inference_transform
from products import PRODUCTS_TABLE_SQL, insert_catalogue
from recommend import AGE_GROUP_TO_DATASET, build_routine


# Flask app, paths and request limits.
app = Flask(__name__)
# Browsers may call the API only from CORS_ORIGINS (comma-separated); unset allows any origin for local development.
allowed_origins = [origin.strip() for origin in os.environ.get('CORS_ORIGINS', '').split(',') if origin.strip()]
CORS(app, origins=allowed_origins or '*')
# Reject oversized uploads before they are read into memory (Flask answers 413).
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / 'skincare.db'
LOW_CONFIDENCE_THRESHOLD = 0.5
DEFAULT_AGE_GROUP = '19-25'


# SQLite catalogue and account tables, created on first run without overwriting user data.
def initialize_product_database():
    with closing(sqlite3.connect(DATABASE_PATH)) as connection, connection:
        connection.execute(PRODUCTS_TABLE_SQL)
        if connection.execute('SELECT COUNT(*) FROM products').fetchone()[0] == 0:
            insert_catalogue(connection)


def get_product_categories():
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        rows = connection.execute('SELECT DISTINCT category FROM products ORDER BY category').fetchall()
    return [row[0] for row in rows]


initialize_product_database()
initialize_accounts_database(DATABASE_PATH)
app.register_blueprint(create_auth_blueprint(DATABASE_PATH))


# Skin type classifier, loaded once and checked against the configured class order.
class_names = list(CLASS_NAMES)
with open(BASE_DIR / 'class_names.json', 'r', encoding='utf-8') as f:
    if json.load(f) != class_names:
        raise RuntimeError(f'class_names.json must match model_config.CLASS_NAMES in order: {class_names}')

model = build_model(len(class_names))
checkpoint = torch.load(BASE_DIR / CHECKPOINT_NAME, map_location='cpu', weights_only=True)
if tuple(checkpoint['fc.1.weight'].shape) != (len(class_names), model.fc[1].in_features):
    raise RuntimeError(
        f'{CHECKPOINT_NAME} output layer does not match {len(class_names)} configured classes: '
        f"{tuple(checkpoint['fc.1.weight'].shape)}"
    )
if tuple(checkpoint['fc.1.bias'].shape) != (len(class_names),):
    raise RuntimeError(f'{CHECKPOINT_NAME} output bias does not match configured classes')
model.load_state_dict(checkpoint)
model.eval()

transform = inference_transform()


# Local face validation: requiring multiple independent OpenCV signals reduces
# false positives from textures and objects in arbitrary photos.
CASCADE_DIR = Path(cv2.data.haarcascades)


def load_cascade(filename):
    cascade = cv2.CascadeClassifier(str(CASCADE_DIR / filename))
    if cascade.empty():
        raise RuntimeError(f'OpenCV could not load its required cascade: {CASCADE_DIR / filename}')
    return cascade


FACE_CASCADE = load_cascade('haarcascade_frontalface_default.xml')
ALT_FACE_CASCADE = load_cascade('haarcascade_frontalface_alt2.xml')
EYE_CASCADE = load_cascade('haarcascade_eye_tree_eyeglasses.xml')


def box_overlap(first, second):
    """Intersection over union of two (x, y, width, height) boxes."""
    left, top = max(first[0], second[0]), max(first[1], second[1])
    right = min(first[0] + first[2], second[0] + second[2])
    bottom = min(first[1] + first[3], second[1] + second[3])
    intersection = max(0, right - left) * max(0, bottom - top)
    union = first[2] * first[3] + second[2] * second[3] - intersection
    return intersection / union if union else 0


def has_eye_pair(gray, x, y, width, height):
    """True when two detected eyes sit side by side in the upper part of a face box."""
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


def contains_face(pil_image):
    """Accept only a face box supported by a second face and eye detector."""
    rgb = np.asarray(pil_image.convert('RGB'))
    if rgb.size == 0 or rgb.ndim != 3 or rgb.shape[2] != 3:
        raise ValueError('Image could not be converted to RGB.')
    gray = cv2.equalizeHist(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY))
    min_size = max(80, min(gray.shape[:2]) // 8)
    options = dict(scaleFactor=1.1, minNeighbors=7, minSize=(min_size, min_size))
    alt_boxes = [tuple(map(int, box)) for box in ALT_FACE_CASCADE.detectMultiScale(gray, **options)]

    for x, y, width, height in FACE_CASCADE.detectMultiScale(gray, **options):
        face_box = (x, y, width, height)
        if any(box_overlap(face_box, other) >= 0.35 for other in alt_boxes) and has_eye_pair(gray, x, y, width, height):
            return True
    return False


# Parsing and validation of /predict form fields.
class OptionsError(ValueError):
    """A client-facing validation message for /predict options."""


def json_form_field(name, error_message):
    try:
        return json.loads(request.form.get(name, '[]'))
    except (TypeError, ValueError):
        raise OptionsError(error_message) from None


def is_string_list(value):
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def parse_concerns():
    concerns = json_form_field('concerns', 'Invalid analysis options.')
    if not is_string_list(concerns) or not concerns:
        raise OptionsError('Please select at least one supported skin goal.')
    concerns = list(dict.fromkeys(concerns))
    if any(item not in CONCERN_EXPLANATIONS for item in concerns):
        raise OptionsError('One or more selected skin goals are not supported.')
    if 'No Skin Concerns' in concerns and len(concerns) != 1:
        raise OptionsError('“No Skin Concerns” cannot be combined with another goal.')
    return concerns


def parse_avoid_list():
    """Allergies plus the legacy separate sensitivities field, combined."""
    combined = []
    for name in ('allergies', 'sensitivities'):
        items = json_form_field(name, 'Invalid ingredient preferences format.')
        if not is_string_list(items):
            raise OptionsError('Invalid ingredient preferences format.')
        combined += items
    return combined


def validate_categories(categories, supported_categories):
    if categories is None:
        return []
    if not isinstance(categories, list):
        raise OptionsError('Preferred product categories must be a list.')
    if len(categories) > len(supported_categories):
        raise OptionsError('Too many product categories were selected.')
    if any(not isinstance(category, str) for category in categories):
        raise OptionsError('Each product category must be text.')
    if any(category not in supported_categories for category in categories):
        raise OptionsError('One or more product categories are not available.')
    return list(dict.fromkeys(categories))


def validate_age_group(age_group):
    # Every label the recommender can map (current, earlier and dataset labels) is accepted.
    if age_group not in AGE_GROUP_TO_DATASET:
        raise OptionsError('Choose one of the available age groups.')
    return age_group


def parse_predict_options():
    # Parse in the original order so the first reported error is unchanged.
    categories = json_form_field('categories', 'Invalid analysis options.')
    concerns = parse_concerns()
    avoid = parse_avoid_list()
    categories = validate_categories(categories, get_product_categories())
    age_group = validate_age_group(request.form.get('age_group', DEFAULT_AGE_GROUP))
    return {'categories': categories, 'concerns': concerns, 'avoid': avoid, 'age_group': age_group}


def classify_skin(image):
    with torch.no_grad():
        probabilities = torch.softmax(model(transform(image).unsqueeze(0)), dim=1)
        confidence, predicted_idx = torch.max(probabilities, 1)
    return class_names[predicted_idx.item()], confidence.item()


# HTTP routes.
@app.errorhandler(413)
def upload_too_large(_error):
    return jsonify({'error': 'This photo is too large. Please choose an image under 20 MB.'}), 413


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': True,
        'face_detection': 'opencv-haar-consensus-eye',
    })


@app.route('/predict', methods=['POST'])
def predict():
    upload = request.files.get('image')
    if upload is None or upload.filename == '':
        return jsonify({"error": "No image uploaded. Please select a photo."}), 400

    try:
        img = Image.open(io.BytesIO(upload.read())).convert('RGB')
    except Exception:
        return jsonify({"error": "Invalid image file. Please upload a valid photo (jpg/png)."}), 400

    # Validate the cheap form fields before running face detection and the model.
    try:
        options = parse_predict_options()
    except OptionsError as exc:
        return jsonify({'error': str(exc)}), 400

    try:
        face_detected = contains_face(img)
    except (cv2.error, ValueError):
        app.logger.exception('Local OpenCV face detection failed')
        return jsonify({'error': 'Image processing failed. Please try another photo.'}), 422
    if not face_detected:
        return jsonify({"error": "No face detected. Please upload another image with your face clearly visible."}), 400

    skin_type, confidence = classify_skin(img)
    low_confidence = confidence < LOW_CONFIDENCE_THRESHOLD
    concerns = options['concerns']
    routine = build_routine(
        skin_type,
        ['General'] if concerns == ['No Skin Concerns'] else concerns,
        options['age_group'],
        selected_categories=options['categories'] or None,
        allergies=options['avoid'],
        preferred_categories=None,
    )

    response = {
        "routine": routine,
        "skin_type": skin_type,
        "confidence": confidence,
        "result_reliable": not low_confidence,
        "explanations": explanations_for(skin_type, concerns),
        "preferred_categories": [],
    }
    if low_confidence:
        response["note"] = "This result is uncertain. Try another clear, well-lit front-facing photo; the model's confidence is not medical certainty."
    if not routine:
        response["recommendation_note"] = "No matching products were found in the current catalogue for this result and these goals."
    return jsonify(response)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '5000')), debug=False)
