import torch
import torch.nn as nn
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader, random_split
from sklearn.metrics import confusion_matrix, classification_report
import json

with open('class_names.json', 'r') as f:
    class_names = json.load(f)

valid_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

full_data = datasets.ImageFolder('02_01+shutterphoto', transform=valid_transform)

torch.manual_seed(42)
train_size = int(0.8 * len(full_data))
valid_size = len(full_data) - train_size
train_data, valid_data = random_split(full_data, [train_size, valid_size])

valid_loader = DataLoader(valid_data, batch_size=32, shuffle=False)

model = models.resnet18(weights=None)
model.fc = nn.Sequential(
    nn.Dropout(0.5),
    nn.Linear(model.fc.in_features, len(class_names))
)
model.load_state_dict(torch.load('skin_type_model.pth', map_location='cpu'))
model.eval()

all_preds = []
all_labels = []

with torch.no_grad():
    for images, labels in valid_loader:
        outputs = model(images)
        _, predicted = torch.max(outputs, 1)
        all_preds.extend(predicted.numpy())
        all_labels.extend(labels.numpy())

cm = confusion_matrix(all_labels, all_preds)
print("Confusion Matrix:")
print("Rows = actual class, Columns = predicted class")
print("Classes order:", class_names)
print(cm)

print("\nPer-Class Metrics:")
print(classification_report(all_labels, all_preds, target_names=class_names))