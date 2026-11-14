"""Classify one image with the configured checkpoint: python test_model.py [image_path]."""

import sys
from pathlib import Path

import torch
from PIL import Image

from model_config import CHECKPOINT_NAME, CLASS_NAMES, build_model, inference_transform

BASE_DIR = Path(__file__).resolve().parent


# Load the checkpoint and print class probabilities for one image.
def main(image_path):
    model = build_model(len(CLASS_NAMES))
    model.load_state_dict(torch.load(BASE_DIR / CHECKPOINT_NAME, map_location='cpu', weights_only=True))
    model.eval()

    tensor = inference_transform()(Image.open(image_path).convert('RGB')).unsqueeze(0)
    with torch.no_grad():
        probabilities = torch.softmax(model(tensor), dim=1)
        confidence, predicted_idx = torch.max(probabilities, 1)

    print(f"Predicted skin type: {CLASS_NAMES[predicted_idx.item()]}")
    print(f"Confidence: {confidence.item() * 100:.2f}%")
    print("\nAll class probabilities:")
    for i, class_name in enumerate(CLASS_NAMES):
        print(f"  {class_name}: {probabilities[0][i].item() * 100:.2f}%")


# Guarded so unittest discovery can import this file without running it.
if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else "Test.jpeg")
