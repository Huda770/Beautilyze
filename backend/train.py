import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader



# Training transform - includes augmentation to prevent memorization
train_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(10),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# Validation transform - no augmentation, just resize/normalize
valid_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

from torch.utils.data import random_split

full_data = datasets.ImageFolder('02_01+shutterphoto', transform=train_transform)

# Split: 80% train, 20% validation
torch.manual_seed(42)
train_size = int(0.8 * len(full_data))
valid_size = len(full_data) - train_size
train_data, valid_data = random_split(full_data, [train_size, valid_size])

# Validation set should use valid_transform (no augmentation), so override its transform
valid_data.dataset.transform = valid_transform

train_loader = DataLoader(train_data, batch_size=32, shuffle=True)
valid_loader = DataLoader(valid_data, batch_size=32, shuffle=False)

print("Classes found:", full_data.classes)
print("Number of training images:", len(train_data))
print("Number of validation images:", len(valid_data))

# Load pretrained ResNet
model = models.resnet18(weights='IMAGENET1K_V1')

# Freeze all layers first
for param in model.parameters():
    param.requires_grad = False

# Unfreeze only the last block (layer4) so it can adapt to skin features
for param in model.layer4.parameters():
    param.requires_grad = True

# Replace final layer with dropout + linear
num_classes = len(full_data.classes)
model.fc = nn.Sequential(
    nn.Dropout(0.5),
    nn.Linear(model.fc.in_features, num_classes)
)





# Use GPU if available, otherwise CPU
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = model.to(device)
print("Training on:", device)

# Loss function and optimizer
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), 
                       lr=0.0005, weight_decay=1e-4)
# Training loop
num_epochs = 10

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
    print(f"Epoch {epoch+1}/{num_epochs} - Loss: {running_loss:.4f} - Train Accuracy: {train_accuracy:.2f}%")

# Save the trained model
torch.save(model.state_dict(), 'skin_type_model.pth')

print("Model saved as skin_type_model.pth")

# Evaluate on validation set
model.eval()
correct = 0
total = 0

with torch.no_grad():
    for images, labels in valid_loader:
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        _, predicted = torch.max(outputs, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()

valid_accuracy = 100 * correct / total
print(f"Validation Accuracy: {valid_accuracy:.2f}%")
