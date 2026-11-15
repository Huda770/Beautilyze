# Beautilyze

Beautilyze keeps its mobile app and Python API in one repository:

- `mobile/` — Expo and React Native app
- `backend/` — Flask API, skin type model, recommendation data, and SQLite database

## Run the backend

From `backend/`, start the API with `python app.py`. It listens on port `5000` and exposes `/health`, `/predict`, and `/profile/<user_id>`. The backend uses local OpenCV face checks and the bundled PyTorch model; it does not require an external AI API key.

Required backend assets include `skin_type_model.pth`, `class_names.json`, `RecLogic.csv`, and `skincare.db`.

## Run the mobile app

From `mobile/`, run `npm install` and `npm start`. The app uses the Expo development host to reach the backend by default. If needed, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the development computer's reachable address. Keep the phone and computer on the same Wi-Fi network.

The app has Home, Analyze, Routine, and Profile tabs. Create an account or sign in from Profile. The Flask API stores accounts and age preferences in `backend/skincare.db`; passwords are saved as Werkzeug password hashes, and bearer-session tokens are stored as SHA-256 hashes with a 30-day expiry. Sign-out revokes the current session. On iOS and Android, the app stores the session token with Expo SecureStore. On web, sign-in lasts until the page is refreshed. Analysis results remain in app memory for the current session and are not saved to an account. The skin model is an image classifier, not a generative AI/chat model.

For a public deployment, serve the API over HTTPS and restrict CORS to the app's expected origins. The local Expo development setup uses HTTP on a trusted Wi-Fi network and is intended for development, not production. Password reset and email verification are not implemented.
The app has Home, Analyze, Routine, and Profile tabs. Create an account or sign in from Profile. The Flask API stores accounts and age preferences in `backend/skincare.db`; passwords are saved as Werkzeug password hashes, and bearer-session tokens are stored as SHA-256 hashes with a 30-day expiry. Sign-out revokes the current session. On iOS and Android, the app stores the session token with Expo SecureStore. Analysis results and allergy exclusions remain in app memory for the current session. The skin model is an image classifier, not a generative AI/chat model.

## Allergies and sensitivities

Add ingredient names in the combined "Allergies and sensitivities" field in Profile. The list is sent to `/predict` and applied before product ranking. The API accepts the legacy separate `sensitivities` field for compatibility. Matching ignores case, punctuation, and spacing and checks complete ingredient phrases; alternate names must be entered separately. Changing the list hides a previous result, including a result from a request that was still in progress.

The catalogue contains selected ingredients rather than verified complete ingredient labels. Filtering cannot guarantee that a product is allergen-free; users should review the product label.

## Skin type model labels and verification

The model output order is `combination`, `dry`, `oily`, as defined in `backend/model_config.py` and `backend/class_names.json`. The backend checks that the configured checkpoint has a matching three-output head at startup.

From `backend/`, verify the checkpoint with:

```bash
python verify_model.py
```

Training expects separate `Dataset/train` and `Dataset/valid` folders, each with the same three class folders: `combination`, `dry`, and `oily`. Run `python train.py` from `backend/`; it saves a candidate as `skin_type_model_3class.pth` and does not overwrite the configured checkpoint. Keep any `Dataset/test` images separate from training and model selection. Run `python evaluate.py` only after pointing `CHECKPOINT_NAME` in `model_config.py` to the candidate you intend to evaluate.

The repository does not currently include the image dataset. The configured checkpoint has three outputs, but its training labels and held-out accuracy are not independently documented here.

## Recommendations and user guidance

Skin goals are selected by the user and guide product recommendations; they are not detected from the photo. Recommendations use `RecLogic.csv` and the SQLite product catalogue, including skin suitability, ingredient matching, selected categories, and allergy/sensitivity exclusions. Photo-based skin type estimates are informational and are not medical diagnoses.
