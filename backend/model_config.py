"""Shared model labels and preprocessing used by training, evaluation and inference."""

CLASS_NAMES = ("combination", "dry", "oily")
IMAGE_SIZE = 224
NORMALIZE_MEAN = (0.485, 0.456, 0.406)
NORMALIZE_STD = (0.229, 0.224, 0.225)
CHECKPOINT_NAME = "skin_type_model.pth"
