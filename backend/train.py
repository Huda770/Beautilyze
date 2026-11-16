"""Fine-tune ResNet18 on Dataset/train, select on Dataset/valid, and save skin_type_model_3class.pth."""

from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

from model_config import CLASS_NAMES, IMAGE_SIZE, NORMALIZE_MEAN, NORMALIZE_STD, build_model, inference_transform

BASE_DIR = Path(__file__).resolve().parent
CANDIDATE_PATH = BASE_DIR / 'skin_type_model_3class.pth'

train_transform = transforms.Compose([
    transforms.RandomResizedCrop(IMAGE_SIZE, scale=(0.8, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(10),
    transforms.ToTensor(),
    transforms.Normalize(mean=NORMALIZE_MEAN, std=NORMALIZE_STD)
])

valid_transform = inference_transform()

train_data = datasets.ImageFolder(BASE_DIR / 'Dataset' / 'train', transform=train_transform)
valid_data = datasets.ImageFolder(BASE_DIR / 'Dataset' / 'valid', transform=valid_transform)

assert train_data.classes == valid_data.classes, \
    f"Class mismatch: train={train_data.classes}, valid={valid_data.classes}"
assert tuple(train_data.classes) == CLASS_NAMES, \
    f"Expected class folders in this exact order: {CLASS_NAMES}; found {train_data.classes}"

train_loader = DataLoader(train_data, batch_size=32, shuffle=True)
valid_loader = DataLoader(valid_data, batch_size=32, shuffle=False)

class_names = list(CLASS_NAMES)
num_classes = len(class_names)

print("Classes found:", class_names)
print("Number of training images:", len(train_data))
print("Number of validation images:", len(valid_data))

class_counts = torch.bincount(torch.tensor(train_data.targets), minlength=num_classes)
print("Training images per class:", dict(zip(class_names, class_counts.tolist())))

model = build_model(num_classes, weights='IMAGENET1K_V1')

for param in model.parameters():
    param.requires_grad = False

for param in model.layer4.parameters():
    param.requires_grad = True

for param in model.fc.parameters():
    param.requires_grad = True

device = torch.device("cuda" if torch.cuda.is_available() else 'cpu')
model = model.to(device)
print("Training on:", device)

class_weights = len(train_data) / (num_classes * class_counts.float())
print("Class weights:", dict(zip(class_names, [round(w, 3) for w in class_weights.tolist()])))

criterion = nn.CrossEntropyLoss(weight=class_weights.to(device))
optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()),
                       lr=0.0005, weight_decay=1e-4)

scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=7, gamma=0.1)

num_epochs = 20
best_valid_accuracy = 0.0

for epoch in range(num_epochs):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in train_loader:
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item()
        _, predicted = torch.max(outputs, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()

    train_accuracy = 100 * correct / total
    current_lr = optimizer.param_groups[0]['lr']
    scheduler.step()

    model.eval()
    valid_correct = 0
    valid_total = 0

    with torch.no_grad():
        for images, labels in valid_loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            _, predicted = torch.max(outputs, 1)
            valid_total += labels.size(0)
            valid_correct += (predicted == labels).sum().item()

    valid_accuracy = 100 * valid_correct / valid_total
    print(f"Epoch {epoch+1}/{num_epochs} - LR: {current_lr:.6f} - Loss: {running_loss:.4f} - "
          f"Train Accuracy: {train_accuracy:.2f}% - Validation Accuracy: {valid_accuracy:.2f}%")

    if valid_accuracy > best_valid_accuracy:
        best_valid_accuracy = valid_accuracy
        torch.save(model.state_dict(), CANDIDATE_PATH)
        print("  New best model saved as skin_type_model_3class.pth")

print(f"Best Validation Accuracy: {best_valid_accuracy:.2f}%")

model.load_state_dict(torch.load(CANDIDATE_PATH, map_location=device, weights_only=True))
model.eval()
class_correct = torch.zeros(num_classes)
class_total = torch.zeros(num_classes)

with torch.no_grad():
    for images, labels in valid_loader:
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        _, predicted = torch.max(outputs, 1)
        for label, pred in zip(labels, predicted):
            class_total[label] += 1
            class_correct[label] += (label == pred).item()

print("Per-class validation accuracy (best model):")
for i, name in enumerate(class_names):
    accuracy = 100 * class_correct[i] / class_total[i]
    print(f"  {name}: {accuracy:.2f}% ({int(class_correct[i])}/{int(class_total[i])})")
