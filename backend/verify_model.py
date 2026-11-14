"""Verify the configured ResNet18 checkpoint shape and class mapping."""

import json
from pathlib import Path

import torch

from model_config import CHECKPOINT_NAME, CLASS_NAMES, IMAGE_SIZE, build_model


BASE_DIR = Path(__file__).resolve().parent
checkpoint_path = BASE_DIR / CHECKPOINT_NAME
class_names_path = BASE_DIR / "class_names.json"

# The saved class mapping must match the configured output order.
configured_names = json.loads(class_names_path.read_text(encoding="utf-8"))
if configured_names != list(CLASS_NAMES):
    raise SystemExit(
        f"Class mapping mismatch: config={list(CLASS_NAMES)}, file={configured_names}"
    )

# Strict loading plus explicit head and output shape checks.
state = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
model = build_model(len(CLASS_NAMES))
model.load_state_dict(state, strict=True)
model.eval()

weight_shape = tuple(state["fc.1.weight"].shape)
bias_shape = tuple(state["fc.1.bias"].shape)
expected_weight_shape = (len(CLASS_NAMES), model.fc[1].in_features)
expected_bias_shape = (len(CLASS_NAMES),)
if weight_shape != expected_weight_shape or bias_shape != expected_bias_shape:
    raise SystemExit(
        f"Unexpected output head: weight={weight_shape}, bias={bias_shape}"
    )

with torch.no_grad():
    logits = model(torch.zeros(1, 3, IMAGE_SIZE, IMAGE_SIZE))
if tuple(logits.shape) != (1, len(CLASS_NAMES)):
    raise SystemExit(f"Unexpected model output shape: {tuple(logits.shape)}")

print(f"Checkpoint: {checkpoint_path}")
print(f"Output layer: weight={weight_shape}, bias={bias_shape}")
print(f"Output classes in order: {', '.join(CLASS_NAMES)}")
print("Strict checkpoint loading and output-shape verification passed.")
