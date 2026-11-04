# BulSU POS and Inventory

## Run locally

1. Copy `.env.example` to `.env` and enter the Firebase web app configuration you intend to use.
2. Install dependencies with `npm ci`.
3. Start the app with `npm run dev`.

The current app connects to the Realtime Database project named `bulsu-pos`. Its PIN screens do not authenticate Firebase database requests, and its database rules do not enforce authentication. Anyone who can access a public deployment may be able to change live data. The site is for testing only until Firebase Authentication and restrictive Realtime Database rules are implemented.

## Deploy to GitHub Pages

The included `.github/workflows/deploy.yml` builds and deploys the app when code is pushed to `main` or `master`, or when the workflow is run manually.

1. Push this folder to a GitHub repository named `bulsu-pos-inventory`. The Vite base path is configured for that repository name.
2. In the repository, open **Settings → Secrets and variables → Actions → Variables** and add these variables. For the existing Firebase project, copy the values from your local `.env` file:
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

Firebase web configuration is included in the downloaded browser app, so it is not a password. The workflow uses GitHub repository variables for the build. Database security must come from Firebase Authentication and Realtime Database rules; the current PIN login does not provide that protection.

The app is served at `https://<your-github-account>.github.io/bulsu-pos-inventory/`. If you rename the repository, update the `base` path in `vite.config.js`. The workflow also publishes a `404.html` fallback so refreshing an app route works on GitHub Pages.

## Common commands

- `npm run dev` — local development server
- `npm run build` — production build
- `npm run preview` — preview the production build locally
- `npm run lint` — lint source files
