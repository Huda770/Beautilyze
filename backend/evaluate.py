"""Report a confusion matrix and per-class metrics for the configured checkpoint on Dataset/test."""

from pathlib import Path

import torch
from sklearn.metrics import classification_report, confusion_matrix
from torch.utils.data import DataLoader
from torchvision import datasets

from model_config import CHECKPOINT_NAME, CLASS_NAMES, build_model, inference_transform

BASE_DIR = Path(__file__).resolve().parent
class_names = list(CLASS_NAMES)
labels = list(range(len(class_names)))

test_data = datasets.ImageFolder(BASE_DIR / 'Dataset' / 'test', transform=inference_transform())
assert tuple(test_data.classes) == CLASS_NAMES, \
    f"Expected test folders in this exact order: {CLASS_NAMES}; found {test_data.classes}"
test_loader = DataLoader(test_data, batch_size=32, shuffle=False)

model = build_model(len(class_names))
model.load_state_dict(torch.load(BASE_DIR / CHECKPOINT_NAME, map_location='cpu', weights_only=True))
model.eval()

all_preds = []
all_labels = []
with torch.no_grad():
    for images, batch_labels in test_loader:
        _, predicted = torch.max(model(images), 1)
        all_preds.extend(predicted.numpy())
        all_labels.extend(batch_labels.numpy())

cm = confusion_matrix(all_labels, all_preds, labels=labels)
print("Confusion Matrix:")
print("Rows = actual class, Columns = predicted class")
print("Classes order:", class_names)
print(cm)

print("\nPer-Class Metrics:")
print(classification_report(all_labels, all_preds, labels=labels, target_names=class_names, zero_division=0))
