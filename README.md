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

The app has Home, Analyze, Routine, and Profile tabs. Create an account or sign in from Profile. The Flask API stores accounts and age preferences in `backend/skincare.db`; passwords are saved as Werkzeug password hashes, and bearer-session tokens are stored as SHA-256 hashes with a 30-day expiry. Sign-out revokes the current session. On iOS and Android, the app stores the session token with Expo SecureStore. On web, sign-in lasts until the page is refreshed. Analysis results remain in app memory for the current session and are not saved to an account. The skin model is an image classifier, not a generative AI/chat model.

For a public deployment, serve the API over HTTPS and restrict CORS to the app's expected origins. The local Expo development setup uses HTTP on a trusted Wi-Fi network and is intended for development, not production. Password reset and email verification are not implemented.
