from torchvision import datasets
import json

full_data = datasets.ImageFolder('02_01+shutterphoto')
with open('class_names.json', 'w') as f:
    json.dump(full_data.classes, f)

print("Saved class names:", full_data.classes)