import io
import json
import json as json_lib
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
from PIL import Image, UnidentifiedImageError
from flask import Flask, jsonify, request
from flask_cors import CORS
from torchvision import models, transforms

from recommend import build_routine

app = Flask(__name__)
CORS(app)

# Load the cascade once at startup and fail clearly if the local detector is
# unavailable. OpenCV ships this XML file with its Python package.
cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
if not cascade_path.is_file():
    raise RuntimeError(f"OpenCV face cascade file is missing: {cascade_path}")
face_cascade = cv2.CascadeClassifier(str(cascade_path))
if face_cascade.empty():
    raise RuntimeError(f"OpenCV could not load the face cascade: {cascade_path}")

# Load the trained classifier assets from the backend directory.
backend_dir = Path(__file__).resolve().parent
with (backend_dir / "class_names.json").open("r", encoding="utf-8") as f:
    class_names = json.load(f)

model = models.resnet18(weights=None)
model.fc = nn.Sequential(
    nn.Dropout(0.5),
    nn.Linear(model.fc.in_features, len(class_names)),
)
model.load_state_dict(torch.load(backend_dir / "skin_type_model.pth", map_location="cpu"))
model.eval()

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def contains_face(pil_image):
    """Run local Haar cascade detection against a decoded RGB PIL image."""
    rgb_image = np.asarray(pil_image.convert("RGB"))
    if rgb_image.size == 0 or rgb_image.ndim != 3 or rgb_image.shape[2] != 3:
        raise ValueError("Image could not be converted to an RGB image.")
    gray_image = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2GRAY)
    faces = face_cascade.detectMultiScale(
        gray_image, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
    )
    return len(faces) > 0


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files or request.files["image"].filename == "":
        return jsonify({"error": "No image uploaded. Please select a photo."}), 400

    try:
        img = Image.open(io.BytesIO(request.files["image"].read())).convert("RGB")
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError):
        return jsonify({"error": "Invalid image file. Please upload a valid photo (jpg/png)."}), 400

    try:
        has_face = contains_face(img)
    except (cv2.error, ValueError) as exc:
        app.logger.exception("OpenCV could not process the uploaded image")
        return jsonify({"error": f"Image processing failed: {exc}"}), 422

    if not has_face:
        return jsonify({
            "error": "No face detected. Please upload a clear, front-facing face photo."
        }), 400

    tensor = transform(img).unsqueeze(0)
    with torch.no_grad():
        output = model(tensor)
        probabilities = torch.softmax(output, dim=1)
        confidence, predicted_idx = torch.max(probabilities, 1)

    predicted_skin_type = class_names[predicted_idx.item()]
    low_confidence = confidence.item() < 0.5

    try:
        concerns = json_lib.loads(request.form.get("concerns", "[]"))
        selected_categories = json_lib.loads(request.form.get("categories", "[]"))
    except (json_lib.JSONDecodeError, TypeError):
        return jsonify({"error": "Invalid concerns or categories format."}), 400
    if not isinstance(concerns, list) or not isinstance(selected_categories, list):
        return jsonify({"error": "Concerns and categories must be lists."}), 400
    age_group = request.form.get("age_group", "14-18")

    if not concerns:
        return jsonify({"error": "Please select at least one skin concern."}), 400

    routine = build_routine(predicted_skin_type, concerns, age_group, selected_categories)
    if not routine:
        return jsonify({"error": "No suitable products found for your profile. Try different concerns."}), 200

    response = {
        "routine": {category: product["name"] for category, product in routine.items()},
        "skin_type": predicted_skin_type,
    }
    if low_confidence:
        response["note"] = "Analysis confidence was low — for best results, use a clear, well-lit front-facing photo."
    return jsonify(response)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
