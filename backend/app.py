import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import io
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import json as json_lib
from recommend import build_routine
import cv2
import numpy as np

app = Flask(__name__)
CORS(app)

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
model.load_state_dict(torch.load('skin_type_model_newdataset.pth', map_location='cpu'))
model.eval()

import requests
import base64

ROBOFLOW_API_KEY = "vczWdv2z1aHZw9C5Nh0I"
ROBOFLOW_MODEL_ID = "face-detection-bj0ij/1"

def contains_face(pil_image):
    buffered = io.BytesIO()
    pil_image.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')

    response = requests.post(
        f"https://detect.roboflow.com/{ROBOFLOW_MODEL_ID}",
        params={"api_key": ROBOFLOW_API_KEY},
        data=img_str,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    result = response.json()
    predictions = result.get("predictions", [])
    print(f"Roboflow detected {len(predictions)} face(s)")
    return len(predictions) > 0
    
    
    
    
   




transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

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
    if not contains_face(img):
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

    concerns = json_lib.loads(request.form.get('concerns', '[]'))
    age_group = request.form.get('age_group', '14-18')
    selected_categories = json_lib.loads(request.form.get('categories', '[]'))


    if not concerns:
        return jsonify({"error": "Please select at least one skin concern."}), 400

    routine = build_routine(predicted_skin_type, concerns, age_group, selected_categories)

    if not routine:
        return jsonify({"error": "No suitable products found for your profile. Try different concerns."}), 200

    clean_routine = {
        category: product["name"] for category, product in routine.items()
    }

    response = {"routine": clean_routine, "skin_type" : predicted_skin_type}
    if low_confidence:
        response["note"] = "Analysis confidence was low — for best results, use a clear, well-lit front-facing photo."

    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True, port=5000)

