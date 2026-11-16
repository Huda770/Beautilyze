"""Shared model labels and preprocessing used by training, evaluation and inference."""

import torch.nn as nn
from torchvision import models, transforms

CLASS_NAMES = ("combination", "dry", "oily")
IMAGE_SIZE = 224
NORMALIZE_MEAN = (0.485, 0.456, 0.406)
NORMALIZE_STD = (0.229, 0.224, 0.225)
CHECKPOINT_NAME = "skin_type_model.pth"


def build_model(num_classes=len(CLASS_NAMES), weights=None):
    """ResNet18 with the dropout + linear head every checkpoint is saved with."""
    model = models.resnet18(weights=weights)
    model.fc = nn.Sequential(
        nn.Dropout(0.5),
        nn.Linear(model.fc.in_features, num_classes),
    )
    return model


def inference_transform():
    return transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=NORMALIZE_MEAN, std=NORMALIZE_STD),
    ])
