# BulSU POS and Inventory

## Run locally

1. Copy `.env.example` to `.env` and enter the Firebase web app configuration for a **dedicated demo project**.
2. Install dependencies with `npm ci`.
3. Start the app with `npm run dev`.

Do not use the production `bulsu-pos` Firebase project for a public demo. The PIN screens are client-side and do not authenticate Firebase database requests. Until Firebase Authentication and restrictive Realtime Database rules are in place, anyone who can reach a public demo database may be able to change its data. Use disposable test data only.

## Deploy to GitHub Pages

The included `.github/workflows/deploy.yml` builds and deploys the app when code is pushed to `main` or `master`, or when the workflow is run manually. It blocks deployment if the Firebase project ID is `bulsu-pos`.

1. Push this folder to a GitHub repository named `bulsu-pos-inventory`. The Vite base path is configured for that repository name.
2. In the repository, open **Settings → Secrets and variables → Actions → Variables** and add these variables from the dedicated demo Firebase web app:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET` (if provided)
   - `VITE_FIREBASE_MEASUREMENT_ID` (optional)
3. In **Settings → Pages**, set the source to **GitHub Actions**.
4. Push to `main`/`master` or run **Actions → Deploy to GitHub Pages → Run workflow**. GitHub will show the published URL in the Pages settings and deployment job.

Firebase web configuration is included in the downloaded browser app, so it is not a password. Database security must come from Firebase Authentication and Realtime Database rules. The workflow uses GitHub repository variables for convenience and requires a non-production Firebase project.

The app is served at `https://<your-github-account>.github.io/bulsu-pos-inventory/`. If you rename the repository, update the `base` path in `vite.config.js`. The workflow also publishes a `404.html` fallback so refreshing an app route works on GitHub Pages.

## Common commands

- `npm run dev` — local development server
- `npm run build` — production build
- `npm run preview` — preview the production build locally
- `npm run lint` — lint source files
