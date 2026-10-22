# Beautilyze Mobile App

This folder contains the Expo / React Native app only. The Python API, AI model,
and recommendation data live separately in the sibling `../backend/` folder.
The older web app is in `../frontend/`.

## How the mobile code is organised

### Screens — `src/app/`

- `_layout.tsx` sets up the app's shared state, theme, splash screen, and tabs.
- `index.tsx` is the Home screen and links to analysis and the latest result.
- `analyze.tsx` chooses a photo, collects preferences, and sends them to `/predict`.
- `routine.tsx` displays the skin result and recommended products.
- `profile.tsx` stores the age preference and checks `/health`.

### Shared app code — `src/`

- `state/app-state.tsx` keeps the age range and latest result while the app is open.
- `constants/api.ts` finds the backend address for the phone or uses the optional
  `EXPO_PUBLIC_API_URL` setting.
- `constants/theme.ts` defines the shared web theme colors, fonts, and spacing.
- `components/beautilyze-ui.tsx` holds reusable colors, styles, buttons, cards, and text.
- `components/app-tabs.tsx` is the phone tab bar; `app-tabs.web.tsx` is the web version.
- `components/animated-icon.tsx` and `animated-icon.web.tsx` show platform-specific
  splash and logo animations. The paired CSS file styles the web logo.
- `components/themed-text.tsx` and `themed-view.tsx` apply the shared theme to text and views.
- `components/external-link.tsx` opens links in a browser suited to the platform.
- `components/ui/collapsible.tsx` is a reusable open-and-close section.
- `components/hint-row.tsx` and `components/web-badge.tsx` are small web helper components.
- `hooks/use-theme.ts` and `hooks/use-color-scheme*.ts` read the current light or dark theme.
- `global.css` defines font names for the web app.

### Expo settings and assets

- `app.json` sets the app name, icons, splash screen, and Expo plugins.
- `package.json` lists the app's commands and JavaScript packages.
- `tsconfig.json` sets TypeScript rules and import shortcuts.
- `assets/` contains images and icons used by the app.
- `scripts/reset-project.js` is the optional Expo starter reset script.

JSON files such as `app.json` cannot contain comments, so their purpose is described here.

## Run it

Start the backend from `../backend/` with `python app.py`, then start the mobile app
from this folder with `npm start -- --lan`. Scan the Expo Go QR code while the phone
and computer are on the same Wi-Fi network. See the main project `README.md` for details.
