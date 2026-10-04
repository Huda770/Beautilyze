import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader



# Training transform - includes augmentation to prevent memorization
train_transform = transforms.Compose([
    # Random crop/zoom varies framing without touching color or brightness
    transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(10),
    # No ColorJitter: brightness/contrast are key cues for oily vs dry vs combination
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# Validation transform - no augmentation, just resize/normalize
valid_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# Use the dataset's own splits: all 600 train images for training,
# the 150-image official validation split for validation.
# The test split is kept out entirely so it stays unseen for the final comparison.
train_data = datasets.ImageFolder('Dataset/train', transform=train_transform)
valid_data = datasets.ImageFolder('Dataset/valid', transform=valid_transform)

# Both folders must have the same class folders, or labels would not line up
assert train_data.classes == valid_data.classes, \
    f"Class mismatch: train={train_data.classes}, valid={valid_data.classes}"

train_loader = DataLoader(train_data, batch_size=32, shuffle=True)
valid_loader = DataLoader(valid_data, batch_size=32, shuffle=False)

class_names = train_data.classes
num_classes = len(class_names)

print("Classes found:", class_names)
print("Number of training images:", len(train_data))
print("Number of validation images:", len(valid_data))

# Count training images per class (for class weights)
class_counts = torch.bincount(torch.tensor(train_data.targets), minlength=num_classes)
print("Training images per class:", dict(zip(class_names, class_counts.tolist())))

# Load pretrained ResNet
model = models.resnet18(weights='IMAGENET1K_V1')

# Freeze all layers first
for param in model.parameters():
    param.requires_grad = False

# Unfreeze only the last block (layer4) so it can adapt to skin features
for param in model.layer4.parameters():
    param.requires_grad = True

# Replace final layer with dropout + linear
model.fc = nn.Sequential(
    nn.Dropout(0.5),
    nn.Linear(model.fc.in_features, num_classes)
)





# Use GPU if available, otherwise CPU
device = torch.device("cuda" if torch.cuda.is_available() else 'cpu')
model = model.to(device)
print("Training on:", device)

# Class weights: rarer classes (e.g. oily) count more in the loss,
# so the model doesn't just lean towards the biggest class
class_weights = len(train_data) / (num_classes * class_counts.float())
print("Class weights:", dict(zip(class_names, [round(w, 3) for w in class_weights.tolist()])))

# Loss function and optimizer
criterion = nn.CrossEntropyLoss(weight=class_weights.to(device))
optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()),
                       lr=0.0005, weight_decay=1e-4)

# Learning rate schedule: divide the learning rate by 10 every 7 epochs
# so the model takes smaller, steadier steps later in training
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=7, gamma=0.1)

# Training loop
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

    # Evaluate on validation set after every epoch
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

    # Save the model only when validation accuracy improves
    if valid_accuracy > best_valid_accuracy:
        best_valid_accuracy = valid_accuracy
        torch.save(model.state_dict(), 'skin_type_model.pth')
        print("  New best model saved as skin_type_model.pth")

print(f"Best Validation Accuracy: {best_valid_accuracy:.2f}%")

# Per-class accuracy of the best saved model on the validation set
model.load_state_dict(torch.load('skin_type_model.pth', map_location=device))
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
