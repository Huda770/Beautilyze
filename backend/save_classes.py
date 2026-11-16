"""Write class_names.json from the training folders, refusing an order that differs from model_config."""

import json
from pathlib import Path

from torchvision import datasets

from model_config import CLASS_NAMES

BASE_DIR = Path(__file__).resolve().parent

classes = datasets.ImageFolder(BASE_DIR / 'Dataset' / 'train').classes
if tuple(classes) != CLASS_NAMES:
    raise SystemExit(f"Training folders {classes} do not match model_config.CLASS_NAMES {list(CLASS_NAMES)}")
(BASE_DIR / 'class_names.json').write_text(json.dumps(classes), encoding='utf-8')

print("Saved class names:", classes)
