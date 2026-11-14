# Beautilyze Mobile App

This folder contains the Expo / React Native app only. The Python API, AI model,
and recommendation data live separately in the sibling `../backend/` folder.

## How the mobile code is organised

### Screens — `src/app/`

- `_layout.tsx` sets up the app's shared state, fonts, theme, splash screen, onboarding, and the root stack.
- `(tabs)/_layout.tsx` shows the four tabs.
- `(tabs)/index.tsx` is the Home screen and links to analysis and the latest result.
- `(tabs)/analyze.tsx` chooses a photo and sends it with the age range, skin goals, and ingredient exclusions to `/predict`.
- `(tabs)/routine.tsx` lists the Morning, Night, and Weekly routines.
- `(tabs)/profile.tsx` provides account registration, sign-in, sign-out, age range, skin goals, and allergy/sensitivity controls.
- `report.tsx` explains the skin type estimate and selected goals, shows recommended products, and adds them to routines.
- `routine-detail.tsx` shows and removes the products in one routine.

### Shared app code — `src/`

- `state/app-state.tsx` restores the signed-in account and keeps the latest analysis, preferences, and routines while the app is open.
- `state/onboarding-storage.ts` remembers on the device that the welcome slides were finished.
- `constants/profile-options.ts` lists the age ranges and skin goals supported by the backend.
- `constants/products.ts` and `constants/routines.ts` hold product display helpers and the routine definitions.
- `components/onboarding/` holds the welcome slides and their illustration.
- `constants/api.ts` finds the backend address for the phone or uses the optional
  `EXPO_PUBLIC_API_URL` setting.
- `constants/theme.ts` defines the shared web theme colors, fonts, and spacing.
- `components/beautilyze-ui.tsx` holds reusable colors, styles, buttons, cards, and text.
- `components/app-tabs.tsx` is the phone tab bar; `app-tabs.web.tsx` is the web version.
- `components/animated-icon.tsx` and `animated-icon.web.tsx` show platform-specific
  splash and logo animations. The paired CSS file styles the web logo.
- `components/themed-text.tsx` and `themed-view.tsx` apply the shared theme to text and views.
- `components/external-link.tsx` opens links in a browser suited to the platform.
- `hooks/use-theme.ts` and `hooks/use-color-scheme*.ts` read the current light or dark theme.
- `global.css` defines font names for the web app.

### Expo settings and assets

- `app.json` sets the app name, icons, splash screen, and Expo plugins.
- `package.json` lists the app's commands and JavaScript packages.
- `tsconfig.json` sets TypeScript rules and import shortcuts.
- `eslint.config.js` applies Expo's lint rules for `npm run lint`.
- `assets/` contains images and icons used by the app.
- `scripts/reset-project.js` is the optional Expo starter reset script.

JSON files such as `app.json` cannot contain comments, so their purpose is described here.

## Run it

Start the backend from `../backend/` with `python app.py`, then start the mobile app
from this folder with `npm start -- --lan`. The API address follows Expo's current LAN
host, so it updates when the laptop's Wi-Fi address changes. Scan the Expo Go QR code
while the phone and computer are on the same Wi-Fi network. See the main project
`README.md` for details.

The backend reuses `../backend/skincare.db` and creates account/session tables when it
starts. Existing product rows are preserved. Account sign-in works across app launches;
the latest analysis and ingredient exclusions remain in app memory for the current session.
