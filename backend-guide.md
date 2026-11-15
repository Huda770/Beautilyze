# Beautilyze backend: file-by-file code guide

This guide follows the actual files in `backend/`. “Runtime” means used while the API is running. “Development” means used to inspect, train, or verify the model. The backend’s main runtime path is: `app.py` receives a mobile request, calls helpers in `accounts.py`, `recommend.py`, `explanations.py`, and `model_config.py`, and reads `skincare.db`, `RecLogic.csv`, and `skin_type_model.pth`.

## Runtime map

```text
Mobile Analyze screen
  └─ POST /predict ─ app.py
       ├─ parse and validate fields
       ├─ OpenCV face check
       ├─ model_config.py + skin_type_model.pth + class_names.json
       │    └─ classify: combination / dry / oily
       ├─ recommend.py + RecLogic.csv + skincare.db
       │    └─ choose one top-scoring product per category
       └─ explanations.py ─ response JSON ─ mobile report

Profile sign-in ─ app.py auth blueprint ─ accounts.py ─ skincare.db
```

## `app.py` — API server and request coordinator

`app.py` is the backend’s entry point. Run it from the backend folder with `python app.py`; Flask listens on port 5000 by default. It creates the Flask application, configures cross-origin access, limits uploads to 20 MB, and sets the database location to `backend/skincare.db`. At startup it ensures the product table exists and fills it from `products.py` only when the table is empty. It also creates the account/session tables through `accounts.py` and registers the authentication routes.

The model is loaded once when the server starts, rather than once per photo. Startup compares `class_names.json` with `CLASS_NAMES` from `model_config.py`, builds the matching ResNet18 architecture, loads `skin_type_model.pth`, checks the output layer dimensions, and switches to evaluation mode. OpenCV face and eye detector files are initialized too. A broken model/class mapping or missing detector causes startup to fail early.

The `/health` route reports whether the service is up. `/predict` accepts multipart form data, expecting an image plus JSON-encoded goals, allergies, categories, and an age group. It decodes the image, validates those fields, checks for a face, classifies skin type, and calls `recommend.build_routine`. Then it combines routine products, confidence/reliability, and explanations from `explanations.py` into JSON. Errors return useful HTTP codes before recommendation. `app.py` coordinates work; image architecture lives in `model_config.py`, recommendation rules in `recommend.py`, and account routes in `accounts.py`.

## `accounts.py` — registration, sign-in, and sessions

`accounts.py` owns the authentication blueprint and schema for `users` and `auth_sessions`. `initialize_accounts_database(database)` creates those tables and an index when needed. `users` stores a unique case-insensitive email, a password hash, age group, and creation timestamp. Passwords are hashed with Werkzeug; the original password is never stored. The session table stores a SHA-256 digest of a random bearer token, its user ID, creation time, and expiry. The raw token is returned to the app but is not written into SQLite.

`create_auth_blueprint(database)` builds routes that `app.py` registers. Registration validates email and password, hashes the password, inserts the account, and issues a session. Login fetches the account, verifies the submitted password, and creates a session. A dummy hash is checked for unknown emails to reduce timing differences. A per-process `LoginThrottle` limits repeated failed attempts; because it is in memory, a server restart resets those counters. Protected `/auth/me` routes use the bearer token, hash it, look up a live session, attach the user to Flask request context, then return or update the account’s age group. Logout deletes that token’s session row. Foreign keys make deleting a user cascade to their sessions.

The mobile app calls these endpoints from its Profile screen. `app.py` passes the same SQLite path into this module, so account data and product data share `skincare.db` but occupy separate tables. Session expiration is 30 days; expired rows are removed as they are encountered and while issuing new sessions. This file does not save skin goals, allergies, or analysis reports; current app persistence for those lives on the device.

## `recommend.py` — ingredient-aware routine selection

`recommend.py` turns skin type and preferences into product suggestions. At import time it reads `RecLogic.csv` with pandas. `AGE_GROUP_TO_DATASET` translates the labels used in the mobile app and API to age labels present in the CSV. `CNN_TO_CSV_SKIN_TYPE` maps model labels to CSV labels, while `CNN_TO_PRODUCT_SKIN_TYPE` maps model labels to product catalogue labels. These mappings are essential because the model, dataset, and product list use slightly different naming schemes.

`get_ideal_ingredients` filters CSV rows by skin type, selected concerns, and mapped age group, then collects ingredient names from matching rows. For a general routine, `build_routine` skips concern-specific ingredients. `get_products` reads every catalogue row from SQLite and splits comma-separated skin types and ingredients into lists. `score_products` first excludes products that conflict with allergies (or whose ingredient list is empty when exclusions exist), then excludes products not suitable for the mapped skin type. It scores each remaining product by the count of ingredient overlaps with the ideal ingredient set and sorts highest first. Stable sorting means ties keep original catalogue order.

Finally, `build_routine` walks that ranked list and keeps only the first product encountered for each category, so its output is at most one cleanser, one serum, etc. Optional selected categories can restrict results; preferred categories can reorder the output. `app.py` currently passes no preferred order and accepts category selections from the request. This module is the bridge between the model result, RecLogic ingredient guidance, and the SQLite product catalogue; it does not run the image classifier.

## `products.py` — seed product catalogue and schema

`products.py` contains the catalogue seed data as Python dictionaries. Each product has a name, one category, a list of compatible skin-type labels, and a list of ingredient labels. The code defines `PRODUCTS_TABLE_SQL`, which creates the SQLite `products` table with an integer ID, name, category, comma-separated skin types, and comma-separated ingredients. `insert_catalogue(connection)` converts each list into comma-separated text and inserts all seed products in one batch.

`app.py` imports the schema and insertion function. On startup it creates the table, but it only inserts seed records if the table is empty, preserving existing catalogue rows. By contrast, `setup_db.py` explicitly deletes and rebuilds product rows from this source. `recommend.py` reads the persisted table and uses the skin type and ingredients to filter and rank products. This means editing `products.py` alone does not update an already populated database; the seed script or a deliberate database migration is needed to apply catalogue changes. Running `setup_db.py` replaces catalogue contents and should be treated carefully if the database has local edits.

The product data is deliberately separate from `RecLogic.csv`: this module describes products the app can suggest, while the CSV describes ideal ingredient guidance by age, skin type, and concern. Their ingredient text is matched by recommendation code. Since fields are serialized as comma-separated strings rather than normalized child tables, commas inside a product ingredient label would be interpreted as separators. The database is the runtime source; this Python file is the seed source.

## `model_config.py` — shared model definition and image preparation

`model_config.py` is the single source for classifier labels, image size, normalization values, checkpoint filename, and network structure. `CLASS_NAMES` is ordered as combination, dry, oily; the numeric output index from the neural network must always map to this exact order. `IMAGE_SIZE` is 224 pixels. The mean and standard deviation constants are the standard channel normalization values used by torchvision preprocessing. `CHECKPOINT_NAME` points to `skin_type_model.pth`.

`build_model()` creates a torchvision ResNet18 and replaces its final fully connected layer with dropout followed by a linear layer sized to the number of skin classes. Training, evaluation, verification, and API inference all call this helper. That shared definition prevents the code from accidentally evaluating a different architecture from the one that was trained. `inference_transform()` resizes an input image to 224×224, converts pixels to a tensor, and normalizes it. The API applies this transform before calling the loaded model; evaluation and verification use the same transform so inputs have compatible shape and scale.

This file does not store learned weights and does not perform prediction by itself. The learned parameters are in `skin_type_model.pth`; `app.py` loads those weights into the architecture created here. `class_names.json` separately records the same ordered labels, and startup checks that it matches. If labels are reordered, the output interpretation would silently become wrong, so the related files and training folder names must remain aligned.

## `explanations.py` — user-facing descriptions

`explanations.py` provides plain-language text associated with model outputs and allowed skin goals. `SKIN_TYPE_EXPLANATIONS` maps combination, dry, and oily labels to cautious descriptions. `CONCERN_EXPLANATIONS` maps selectable goals—such as acne, dark spots, redness, and wrinkles—to explanatory text that avoids claiming a diagnosis. `explanations_for(skin_type, concerns)` returns a dictionary with one skin-type explanation and only the descriptions for concerns the user selected.

The API route in `app.py` calls this function after classification and recommendation. Its result is included in the `/predict` JSON response, then stored with the analysis and displayed on the mobile report. This is descriptive copy, not model output: it does not inspect the uploaded image, determine whether a concern is actually present, or change product scores. The model supplies a skin-type label; the user supplies concern choices; this module supplies the associated wording.

The dictionaries also act as the supported concern list in `app.py` validation. If a submitted concern is not a key in `CONCERN_EXPLANATIONS`, the API rejects the request. Therefore, adding or renaming a goal affects both validation and the copy returned in the report, and the mobile profile options should be kept in sync. The wording intentionally uses “may” because image-based classification and chosen goals are guidance rather than a clinical assessment.

## `setup_db.py` — rebuild product rows

`setup_db.py` is a maintenance script for rebuilding the product catalogue stored in `backend/skincare.db`. It resolves its own folder, imports the table schema and seed insertion function from `products.py`, opens the SQLite database, ensures the product table exists, deletes every current row from `products`, then inserts the catalogue seed again. It does not intentionally drop or rewrite the `users` or `auth_sessions` tables, so account records remain in the same database file.

This differs from normal server startup: `app.py` fills the product table only when it is empty, while this script forcibly refreshes it from source. Use it after deliberately changing the seed catalogue when you want the database to match `products.py`. Any manual changes made directly to product rows will be lost. The table is shared with accounts in the same file, so deleting the database file itself is not equivalent to running this script and could remove account data too.

The flow is `products.py` seed definitions → `setup_db.py` inserts rows → `skincare.db` stores them → `recommend.py` reads them during analyses. The script prints a success message when finished. It has no command-line flags, backup step, or selective update behavior, so operators should back up the database if they have valuable catalogue edits. It is not run automatically by `/predict`.

## `train.py` — fine-tune the skin classifier

`train.py` is the development script for producing a candidate skin-type model. It expects image folders under `Dataset/train` and `Dataset/valid`, with folder names in the exact order configured by `CLASS_NAMES`. It creates augmented training transforms (random crop, horizontal flip, and slight rotation) and a plain resize/normalize transform for validation. It asserts that train and validation class folders align before training, preventing labels from mapping to different outputs.

The script builds an ImageNet-pretrained ResNet18 through `model_config.py`, freezes most parameters, and unfreezes the final ResNet block plus the new classification head. It chooses CUDA when available, otherwise CPU. Class weights are calculated from training counts so smaller classes have more influence on the loss. Adam optimizes trainable parameters; a step scheduler lowers the learning rate over 20 epochs. Each epoch trains, reports loss and accuracy, then evaluates on validation data. Whenever validation accuracy improves, the state dictionary is written to `skin_type_model_3class.pth`.

That output is a candidate filename; the API loads `skin_type_model.pth`. Replacing the production checkpoint should therefore be a deliberate separate action, followed by `verify_model.py` and `evaluate.py`. The training script does not use the held-out test set, preserving it for final evaluation. Its dependencies are pinned in `requirements.txt`, and its architecture, label order, and transforms come from `model_config.py`.

## `evaluate.py` — test-set performance report

`evaluate.py` measures the configured checkpoint on `Dataset/test`, a held-out folder tree separate from training and validation. It uses torchvision `ImageFolder` and the shared inference transform, then asserts that detected folder names exactly match `CLASS_NAMES`. This matters because the label index assigned by folder ordering must line up with the network output index. It loads the configured checkpoint into the shared architecture and switches the model to evaluation mode.

Under `torch.no_grad()`, each batch is passed through the network and the highest output index is taken as its predicted class. Actual and predicted labels are accumulated, then scikit-learn builds a confusion matrix and a per-class classification report. The matrix rows are actual labels and columns are predicted labels, with class ordering printed explicitly. The classification report includes metrics such as precision, recall, and F1 for each class; `zero_division=0` keeps absent-class metrics from causing warnings or crashes.

This script reports offline test-set behavior; the live API adds softmax confidence and face validation, while this evaluator focuses on class predictions and aggregate metrics. It does not retrain or alter the checkpoint. Its dependencies include PyTorch, torchvision, and scikit-learn. Run it after selecting a model candidate to estimate generalization, while remembering that metrics depend on the test dataset quality and representativeness. It connects `model_config.py`, `skin_type_model.pth`, and the `Dataset/test` image folders.

## `check_data.py` — visual sample of training images

`check_data.py` creates a quick 3-by-3 image grid from the training dataset so a person can inspect examples and labels visually. It reads `Dataset/train` through torchvision `ImageFolder`, resizing each sample to the configured `IMAGE_SIZE`. It selects nine samples spread across the dataset by taking a step through the collection, displays each image with its folder-derived class label, hides axis marks, and writes `sample_check.png` to the current working directory.

This is a data-quality helper, not part of the running API and not a model test. It can reveal obvious issues such as mislabeled folders, irrelevant photos, unreadable images, or inconsistent framing, but nine examples cannot establish that the full dataset is clean. The folder names also influence label order, so the displayed class names should be checked against `CLASS_NAMES` in `model_config.py` and `class_names.json`.

The script uses matplotlib and torchvision, both listed in `requirements.txt`. `train.py` consumes the same `Dataset/train` directory, so this visual check is useful before training. If the expected folder tree is missing, it fails when `ImageFolder` tries to load it. The output image is a generated inspection artifact and is not loaded by `app.py`, `evaluate.py`, or `recommend.py`. Its relationship to runtime is indirect: it helps a developer validate the data that shapes the trained checkpoint.

## `save_classes.py` — synchronize class labels

`save_classes.py` reads the class folders under `Dataset/train` with `ImageFolder`, compares the resulting sorted folder labels against `CLASS_NAMES` from `model_config.py`, and writes them as JSON to `class_names.json` only when the order agrees. If the order differs, it exits with a clear message instead of writing a mapping that could make predictions display the wrong label.

`app.py` reads this JSON at startup and independently verifies it matches the configured class names. `verify_model.py` performs the same kind of consistency check before a deployment checkpoint is accepted. This script is therefore a small synchronization and guard tool linking the dataset’s folder names, model output neurons, and runtime label mapping.

It does not train the model or inspect model accuracy. It also does not make arbitrary folder names valid: the folder labels must already match `CLASS_NAMES`. The saved file is tiny, but semantically important because a model returns numeric indices, not words. For example, output index zero only means “combination” because every relevant file and model was built using the same agreed ordering. If classes are intentionally changed, update the config and retrain, then run this utility and verify the checkpoint. Running it against mismatched folders stops safely without overwriting the existing JSON.

## `verify_model.py` — checkpoint compatibility check

`verify_model.py` checks whether the model file, architecture, and class labels fit together before use. It loads `class_names.json`, compares it to `CLASS_NAMES`, loads the checkpoint with safe `weights_only=True`, builds the model via `model_config.py`, and applies the state dictionary strictly. Strict loading catches missing or unexpected parameter names. It then checks the final layer weight and bias dimensions against the number of classes and model feature size.

As a final smoke check, it sends a dummy tensor shaped like one normalized image through the model and confirms the output is one row with exactly one score per configured class. If any invariant fails, it exits with a message describing the mismatch; otherwise it prints the checkpoint path, output layer shapes, class order, and a success line.

This is not a quality benchmark: a checkpoint can pass all shape checks and still make poor predictions. `evaluate.py` measures prediction quality using the held-out test set. The API performs similar compatibility checks during startup, meaning a bad checkpoint should prevent the server from serving misleading results. The utility connects `skin_type_model.pth`, `model_config.py`, and `class_names.json`, and is especially useful after training or replacing a model file.

## `class_names.json` — readable output label order

`class_names.json` stores the ordered list of labels corresponding to the classifier’s output units: combination, dry, then oily. It contains no learned information and no user data. Its purpose is to make the output mapping explicit outside the binary checkpoint and to let startup tools detect label drift.

`app.py` loads the JSON during server initialization and compares it exactly with `CLASS_NAMES` in `model_config.py`; mismatch stops startup. `verify_model.py` repeats the check as a standalone validation. `save_classes.py` regenerates the file only if the training folder names match the configured order. `train.py` also checks train and validation folder labels before it fits weights. Together these checks reduce the risk that an output score is interpreted as the wrong skin type.

This tiny file participates in a wider contract: training folders determine numeric targets, model output positions learn those targets, `CLASS_NAMES` names those positions, and this JSON confirms the runtime interpretation. A class-order change requires retraining or a carefully compatible model update; editing this JSON alone does not change the model. The file is runtime-relevant even though it contains only a few words, because the API uses it as a startup safety check.

## `RecLogic.csv` — concern and age ingredient guidance

`RecLogic.csv` is a data table, not executable Python. Its columns include age group, skin type and subtype, sensitivity, concern, internal type, ingredient names and concentrations, effects, and a treatment profile. `recommend.py` loads it with pandas when imported. For a request, the recommender maps the model’s skin label and app age label to the dataset’s spelling, filters rows to the requested skin type, selected goals, and age group, then splits the `Ingredients` field on plus signs to build a set of ideal ingredients.

Those ingredient names are compared with product ingredients from SQLite. Products with more overlapping ingredients receive higher scores, subject to skin-type suitability and allergy exclusions. This CSV therefore informs what ingredient concepts should influence ranking; it does not directly provide the product names shown to users. The actual named products come from `products.py` and `skincare.db`.

The data may have multiple rows for one concern because subtypes, concentrations, and treatment profiles can vary. The code combines matching ingredient names into a set, so repeated ingredients do not increase their importance by appearing repeatedly in CSV rows. If no rows match, the ideal ingredient set is empty and skin suitability still determines which products can be returned. `No Skin Concerns` is converted to a general mode by `app.py`, which causes `recommend.py` to skip goal-specific CSV ingredient filtering.

## `skincare.db` — runtime SQLite data store

`skincare.db` is the backend’s SQLite database. It holds at least three logical tables: `products`, `users`, and `auth_sessions`. The products table contains the runtime catalogue seeded from `products.py`; the user table stores account email, password hash, age group, and creation timestamp; the sessions table stores hashed bearer tokens, user links, creation time, and expiry. Account and product data share one file but are isolated by table.

`app.py` sets its path relative to its own directory, so this is `backend/skincare.db`. During startup it creates the product schema and seeds only if there are no products; it also asks `accounts.py` to initialize account tables. `recommend.py` queries `products` for every recommendation build. `accounts.py` reads and updates `users` and inserts, checks, expires, or deletes `auth_sessions` during sign-in and sign-out. `setup_db.py` can replace product rows while leaving account tables in place.

The database does not store the latest mobile analysis, goals, or allergies: those are saved on the device by the mobile app. It is also not the same as `RecLogic.csv`, which contains ingredient guidance, or the `.pth` model checkpoint. Back up this file before maintenance. Deleting it would remove local accounts and sessions as well as product rows; startup can recreate an empty database and seed products, but cannot recreate users or sessions.

## `skin_type_model.pth` — trained model weights

`skin_type_model.pth` is a binary PyTorch checkpoint containing learned parameter tensors for Beautilyze’s skin-type classifier. It is not readable as a regular text file and does not contain the full Python architecture. That architecture is reconstructed by `build_model()` in `model_config.py`; the checkpoint fills its layers with trained values. `app.py` loads it once at startup, verifies the final classification head dimensions, and switches to evaluation mode. `class_names.json` and `CLASS_NAMES` determine the word associated with each output index.

At inference, the input image is transformed to 224×224 and normalized. The model produces three raw class scores (logits), `classify_skin()` applies softmax to get probabilities, and the highest-probability output selects combination, dry, or oily. The API includes the selected class and confidence in its response. Confidence is a model probability and not certainty or a medical assessment.

The current file is the production checkpoint expected by the API and verification/evaluation scripts. `train.py` writes a candidate to `skin_type_model_3class.pth`, so its output does not automatically replace this production file. Before replacing weights, check compatibility with `verify_model.py` and measure performance with `evaluate.py`. The training dataset itself is not embedded here; the checkpoint contains learned model parameters only.

## `requirements.txt` — Python environment manifest

`requirements.txt` pins Python package versions for the backend environment. The core runtime dependencies include Flask and Flask-CORS for HTTP routes, Pillow for image decoding, NumPy and OpenCV for image conversion and face detection, PyTorch and torchvision for model inference, pandas for reading recommendation CSV data, and Werkzeug for password hashing. Other packages support training, plotting, dataset tooling, model evaluation, and transitive dependency needs.

Pinning versions aims to make installations more repeatable across machines, though Python version and operating system compatibility still matter. The backend server imports several of these packages immediately, so missing a runtime dependency can prevent `app.py` from starting. Development utilities add requirements beyond the runtime: for example, `train.py` uses torchvision training transforms and PyTorch optimizers, `evaluate.py` uses scikit-learn, and `check_data.py` uses matplotlib.

This file does not install packages by itself; a developer uses pip to install it into a virtual environment. It is connected to almost every executable backend script through imports. The package set should be changed deliberately and validated in the target Python version, especially for large native packages such as PyTorch and OpenCV. It contains dependency names and version constraints, not app settings, user information, database schema, or model contents.

## End-to-end connections

1. Mobile sends multipart form data to `/predict` in `app.py`.
2. `app.py` checks fields and calls its OpenCV face-validation helpers.
3. `model_config.py` prepares the image and defines the network; `skin_type_model.pth` supplies learned weights; `class_names.json` confirms label order.
4. `explanations.py` supplies display text for the predicted class and selected goals.
5. `recommend.py` filters `RecLogic.csv`, reads `products` from `skincare.db`, and returns ranked routine items.
6. `app.py` packages the JSON response; the mobile app saves and displays it locally.
7. Sign-in flows through the separate auth blueprint from `accounts.py`, using `users` and `auth_sessions` in the same database.
8. Training and inspection tools (`train.py`, `check_data.py`, `save_classes.py`, `verify_model.py`, and `evaluate.py`) support model development but are not called for each API request.
