import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from model_config import CLASS_NAMES, IMAGE_SIZE, NORMALIZE_MEAN, NORMALIZE_STD, CHECKPOINT_NAME

# Load class names

class_names = list(CLASS_NAMES)

# Rebuild the same model structure used in training
model = models.resnet18(weights=None)
model.fc = nn.Sequential(
    nn.Dropout(0.5),
    nn.Linear(model.fc.in_features, len(class_names))
)

# Load trained weights
model.load_state_dict(torch.load(CHECKPOINT_NAME, map_location='cpu'))
model.eval()

transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=NORMALIZE_MEAN, std=NORMALIZE_STD)
])

# CHANGE THIS to the path of the image you want to test
image_path = "Test.jpeg"

img = Image.open(image_path).convert('RGB')
tensor = transform(img).unsqueeze(0)

with torch.no_grad():
    output = model(tensor)
    probabilities = torch.softmax(output, dim=1)
    confidence, predicted_idx = torch.max(probabilities, 1)

predicted_skin_type = class_names[predicted_idx.item()]

print(f"Predicted skin type: {predicted_skin_type}")
print(f"Confidence: {confidence.item() * 100:.2f}%")
print("\nAll class probabilities:")
for i, class_name in enumerate(class_names):
    print(f"  {class_name}: {probabilities[0][i].item() * 100:.2f}%")
