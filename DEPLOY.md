# Deploying Beautilyze

- **Frontend:** Expo web export, served as static assets by a Cloudflare Worker (`mobile/wrangler.jsonc`).
- **API:** Flask + PyTorch + OpenCV in Docker on Fly.io (`backend/Dockerfile`, `backend/fly.toml`). SQLite lives on a Fly volume mounted at `/data`, so accounts survive restarts and redeploys.

Run all commands in PowerShell from the repository root unless noted.

## 1. Deploy the API to Fly.io

Install the Fly CLI and sign in (opens your browser; Fly asks for a card even on the free allowance):

```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

```powershell
fly auth login
```

Create the app and its volume. If `beautilyze-api` is taken, pick another name and replace it in `backend/fly.toml` and `mobile/.env.production`.

```powershell
cd backend; fly apps create beautilyze-api
```

```powershell
fly volumes create beautilyze_data --region fra --size 1 --app beautilyze-api --yes
```

```powershell
fly deploy
```

Check it (first request after idle takes ~20 s while the machine starts and loads the model):

```powershell
curl.exe https://beautilyze-api.fly.dev/health
```

## 2. Deploy the website to Cloudflare Workers

```powershell
cd mobile; npx wrangler login
```

```powershell
npm run deploy:cloudflare
```

`deploy:cloudflare` runs `npm run build:web` (which reads the API URL from `mobile/.env.production`) and then `wrangler deploy`. Wrangler prints the site URL, for example `https://beautilyze.<your-subdomain>.workers.dev`.

## 3. Allow the website to call the API (CORS)

Put the exact Workers URL from step 2 into `CORS_ORIGINS` (comma-separate several origins, no trailing slash):

```powershell
cd backend; fly secrets set CORS_ORIGINS=https://beautilyze.<your-subdomain>.workers.dev
```

Also update the `CORS_ORIGINS` line in `backend/fly.toml` so the next `fly deploy` keeps it. Setting the secret restarts the API.

## 4. Check the live site

Open the Workers URL and go through: onboarding → Profile → create an account → pick a skin goal → Analyze → choose a clear front-facing face photo → Analyze my skin → open the report → add a product to a routine → Routine tab.

## Local preview of the production setup

```powershell
cd mobile; npm run build:web; npm run preview:web
```

This serves the export through Wrangler's local Workers runtime at http://localhost:8787. To point it at a local API instead, build with `$env:EXPO_PUBLIC_API_URL="http://127.0.0.1:5000"; npm run build:web` and run the API with `$env:CORS_ORIGINS="http://localhost:8787"; python backend/app.py`.
