"""Save a 3x3 grid of labelled training images to sample_check.png for a quick visual check."""

from pathlib import Path

import matplotlib.pyplot as plt
from torchvision import datasets, transforms

from model_config import IMAGE_SIZE

BASE_DIR = Path(__file__).resolve().parent

train_data = datasets.ImageFolder(BASE_DIR / 'Dataset' / 'train', transform=transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)))

step = max(1, len(train_data) // 9)
fig, axes = plt.subplots(3, 3, figsize=(8, 8))
for i, ax in enumerate(axes.flat):
    img, label = train_data[min(i * step, len(train_data) - 1)]
    ax.imshow(img)
    ax.set_title(train_data.classes[label])
    ax.axis('off')
plt.tight_layout()
plt.savefig('sample_check.png')
print("Saved sample_check.png")
