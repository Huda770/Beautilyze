import torch
import torch.nn as nn
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader, random_split
from sklearn.metrics import confusion_matrix, classification_report
from model_config import CLASS_NAMES, IMAGE_SIZE, NORMALIZE_MEAN, NORMALIZE_STD, CHECKPOINT_NAME

class_names = list(CLASS_NAMES)

valid_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=NORMALIZE_MEAN, std=NORMALIZE_STD)
])

test_data = datasets.ImageFolder('Dataset/test', transform=valid_transform)
assert tuple(test_data.classes) == CLASS_NAMES, \
    f"Expected test folders in this exact order: {CLASS_NAMES}; found {test_data.classes}"
test_loader = DataLoader(test_data, batch_size=32, shuffle=False)

model = models.resnet18(weights=None)
model.fc = nn.Sequential(
    nn.Dropout(0.5),
    nn.Linear(model.fc.in_features, len(class_names))
)
model.load_state_dict(torch.load(CHECKPOINT_NAME, map_location='cpu'))
model.eval()

all_preds = []
all_labels = []

with torch.no_grad():
    for images, labels in test_loader:
        outputs = model(images)
        _, predicted = torch.max(outputs, 1)
        all_preds.extend(predicted.numpy())
        all_labels.extend(labels.numpy())

cm = confusion_matrix(all_labels, all_preds, labels=list(range(len(class_names))))
print("Confusion Matrix:")
print("Rows = actual class, Columns = predicted class")
print("Classes order:", class_names)
print(cm)

print("\nPer-Class Metrics:")
print(classification_report(all_labels, all_preds, labels=list(range(len(class_names))), target_names=class_names, zero_division=0))
