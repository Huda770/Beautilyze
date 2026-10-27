# Beautilyze

The project keeps the mobile app and Python API separate while storing both in one repository:

- `mobile/` — Expo / React Native app
- `backend/` — Flask API, skin type model, and recommendation data
- `frontend/` — older standalone web interface

## Run the backend

1. From `backend/`, install `requirements.txt` in a Python environment if needed.
2. Start the API with `python app.py`. It listens on all network interfaces on port `5000` and exposes `/health` and `/predict`. Open port 5000 to devices on your trusted local network.

The backend uses local OpenCV Haar cascade face detection and the bundled PyTorch skin type model. It makes no face detection API calls and requires no API key. Backend dependencies are listed in `backend/requirements.txt`, including `opencv-python-headless` for OpenCV without GUI features. Required backend assets are `skin_type_model.pth`, `class_names.json`, `RecLogic.csv`, and the existing `skincare.db` product database.

## Run the mobile app

1. In `mobile/`, run `npm install`, then `npm start` and scan the Expo Go QR code. The app uses Expo's development computer address to reach port 5000 by default. If automatic address detection does not match your network, copy `mobile/.env.example` to `mobile/.env` and set `EXPO_PUBLIC_API_URL` to the computer's reachable address.
2. Keep the phone and development computer on the same Wi-Fi network, and leave the backend running. Permit Python through the computer firewall for private networks if prompted.

The app has Home, Analyze, Routine, and Profile tabs. Analysis results and profile preferences are held in app memory for the current session; user accounts and cross-session history are not implemented. The skin model is an image classifier, not a generative AI/chat model.

## Allergies and sensitivities

Add individual ingredient names in the combined "Allergies and sensitivities" field in Profile before analysis. This single exclusion list is sent to the API and applied before product ranking. The API also accepts the legacy separate sensitivities field for compatibility. Matching ignores case, punctuation and spacing and matches complete ingredient phrases; alternate names must be entered separately. Updating preferences hides results made with a different exclusion list, including in-flight results. If all products are excluded, the analysis returns an empty routine without replacing excluded products. Preferences last for the current app session.

The product catalogue currently contains selected ingredients rather than verified complete INCI labels. This feature filters recorded ingredients and cannot establish that a product is allergen-free. Complete, maintained ingredient labels and a reviewed ingredient alias catalogue are required for broader coverage.
