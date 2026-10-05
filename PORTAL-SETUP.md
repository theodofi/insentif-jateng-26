# Portal and Apps Script setup

The frontend is a Vue 3 single-page app built with Vite. Vue Router preserves the existing home, Pantau, and admin URLs. Apps Script remains the backend and exposes JSON APIs only; the Netlify function proxies browser requests to avoid cross-origin browser restrictions. Do not call admin Apps Script deployments directly from Vue or move their authorization checks into the client.

The active frontend is the Vue single-page app: `index.html` boots `src/main.js`; `src/router/` defines the routes; `src/views/` contains page views; `src/assets/` stores Vue assets; `src/services/api.js` connects Vue to the existing portal API; and `src/styles/` contains the Vue styles. The existing home, monitor, and admin URLs are handled by Vue Router; the old standalone HTML pages have been removed. Apps Script sources remain the backend source.

## Google OAuth

1. Create a Google OAuth 2.0 **Web application** client in Google Cloud.
2. Add the production Netlify URL (and any preview origins you use) to its authorized JavaScript origins.
3. Ensure `portal-config.js` and all Apps Script `Kode.gs` sources use the same OAuth Web Client ID. Replace any `REPLACE_WITH_GOOGLE_OAUTH_WEB_CLIENT_ID` placeholder. The client ID is public configuration, not a client secret.

## Apps Script deployments

Use the source files `apps-script/Ajuan/AjuanJanJun-Kode.gs` and `apps-script/BulanBerjalan/BBJanJun-Kode.gs` for the existing Google Apps Script projects. Use `apps-script/Ajuan/AjuanJulDes-Kode.gs` for a separate Juli-Desember Ajuan project. Their local filenames do not need to match the Apps Script editor filename.

For **each** corresponding Apps Script project:

1. Copy the contents of its source file into that project's `Kode.gs`.
2. In **Project Settings**, enable **Show "appsscript.json" manifest file**. Add `https://www.googleapis.com/auth/script.external_request` to the existing `oauthScopes` array in that project's manifest. Preserve all existing scopes and other manifest settings.
3. Save the manifest, then select and run `authorizeGoogleAuth()` once as the project owner. Approve the requested permission. An HTTP 400 result is expected because the helper deliberately sends an invalid token to Google.
4. Deploy a new **Web app** version that executes as the project owner and is accessible to anyone. The public monitor API must be reachable without a Google login; every admin operation independently verifies the Google ID token and checks the existing admin email allowlist.

The deployment URLs are configured in `netlify/functions/portal-api.js`. Update those constants if a deployment URL changes. Do not remove the email allowlist checks.

### Ajuan Juli-Desember 2026

The Juli-Desember public monitor and admin panel use the separate workflow `ajuanJulDes`; they must not be pointed at the Januari-Juni Ajuan spreadsheet.

1. Create a separate Apps Script project for the Juli-Desember Ajuan spreadsheet and copy in `apps-script/Ajuan/AjuanJulDes-Kode.gs`.
2. In the source, replace the four `REPLACE_WITH_JULI_DESEMBER_...` values with the period's spreadsheet ID, PDF template ID, PDF output folder ID, and upload folder ID. Confirm `SHEET_1` and `SHEET_2` match the tab names in that spreadsheet. Keep the shared OAuth client ID and review the `EMAIL_ADMIN` allowlist.
3. Follow the manifest-scope authorization and web-app deployment steps above for this project.
4. Paste its deployed `/exec` URL into `APPS_SCRIPT_ENDPOINTS.ajuanJulDes` in `netlify/functions/portal-api.js`, replacing `REPLACE_WITH_JULI_DESEMBER_APPS_SCRIPT_WEB_APP_URL`, then deploy the Netlify site.

### Bulan Berjalan Juli-Desember 2026

The Juli-Desember public monitor and admin panel use the separate workflow `berjalanJulDes`; they must not be pointed at the Januari-Juni Bulan Berjalan spreadsheet.

1. Create a separate Apps Script project for the Juli-Desember Bulan Berjalan spreadsheet and copy in `apps-script/BulanBerjalan/BBJulDes-Kode.gs`.
2. In the source, replace the four `REPLACE_WITH_JULI_DESEMBER_...` values with the period's spreadsheet ID, PDF template ID, PDF output folder ID, and upload folder ID. Confirm `SHEET_1` and `SHEET_2` match the tab names in that spreadsheet. Keep the shared OAuth client ID and review the `EMAIL_ADMIN` allowlist.
3. Follow the manifest-scope authorization and web-app deployment steps above for this project.
4. Paste its deployed `/exec` URL into `APPS_SCRIPT_ENDPOINTS.berjalanJulDes` in `netlify/functions/portal-api.js`, replacing `REPLACE_WITH_JULI_DESEMBER_BULAN_BERJALAN_APPS_SCRIPT_WEB_APP_URL`, then deploy the Netlify site.

## Netlify

Install the frontend dependencies with `npm ci`, use `npm run dev` for the Vue development server, and use `npm run build` to produce `dist/`. Vite's development middleware and `public/_redirects` route the existing `/admin/*.html` and `/pantau/*.html` URLs to the Vue SPA, so separate static HTML pages are not needed. Netlify uses `netlify.toml` to publish `dist/` and deploy `netlify/functions/portal-api.js`; the redirects are limited to those app routes so Vite and other assets are not rewritten to HTML. `public/_headers` applies the browser security headers to the deployed SPA.

For local testing through the Netlify function proxy, run the project with Netlify CLI (`netlify dev`) instead of calling Apps Script directly. A plain `npm run dev` serves the SPA but does not run Netlify Functions. Add `http://localhost:8888` to the Google OAuth authorized JavaScript origins if testing sign-in locally.
The proxy stops waiting for an Apps Script response after 25 seconds and returns an `upstream_timeout` error; if this repeats, check the corresponding Apps Script project's **Executions** and verify its external-request authorization.

The public views remain available at `/pantau/ajuan-janjun.html`, `/pantau/ajuan-juldes.html`, `/pantau/berjalan-janjun.html`, and `/pantau/berjalan-juldes.html`. Admin panels remain at `/admin/ajuan-janjun.html`, `/admin/ajuan-juldes.html`, `/admin/berjalan-janjun.html`, and `/admin/berjalan-juldes.html`.

The home-page Google sign-in checks the ID token against the Bulan Berjalan Januari-Juni Apps Script project before showing the Google profile and panel links. Each admin panel, including Ajuan Januari-Juni and Ajuan Juli-Desember, independently revalidates that token against its own Apps Script allowlist before loading or changing data.

The verified Google ID token is held in `localStorage` so the user can switch among admin panels, including in separate tabs, without signing in again. Existing sessions in `sessionStorage` are migrated automatically. The session expires after one hour without user activity in the portal, as well as when the Google ID token expires. Selecting **Keluar** removes the token immediately.

After configuring both Juli-Desember endpoints and deploying, check all public monitors, sign in with an allowlisted account, open each admin panel from the profile menu, and verify that non-allowlisted Google accounts are rejected before testing admin reads, status saves, and PDF generation.

### Home-page teacher search

The public teacher search keeps its CAPTCHA and three-search daily limit. Public CAPTCHA/search requests use the same-origin Netlify proxy rather than calling Apps Script directly from the browser. Admin searches bypass that daily quota and CAPTCHA only after the teacher-search Apps Script verifies the Google ID token and its email against `SEARCH_ADMIN_EMAILS` in `apps-script/Data Insentif/Search.gs`. Admin requests are sent through the Netlify function so the ID token is carried in a POST body rather than a URL.

When an admin is signed in on the home page, an admin-only summary shows the number of non-empty teacher records and distinct Kab/Kota values from the same `Data Gabungan` search rows. The summary request uses the same server-side Google ID token verification as admin search.

After updating `Search.gs`, deploy a new version of the teacher-search Apps Script web app. Its Apps Script project must allow external requests: add `https://www.googleapis.com/auth/script.external_request` to `oauthScopes`, run `authorizeSearchGoogleAuth()` once, approve the scope as the owner, and deploy the new version. Confirm the search deployment URL in `TEACHER_SEARCH_ENDPOINT` in `netlify/functions/portal-api.js`. Deploy Netlify after updating either endpoint or frontend code. The Apps Script also keeps its global per-minute abuse rate limit for admin searches.

If the search proxy reports `apps_script_runtime_error`, inspect that Apps Script deployment's **Executions** and confirm the deployed project files match the current `Search.gs`. The Netlify proxy expects JSON; an HTML runtime error page (for example, `ReferenceError: window is not defined`) indicates the Apps Script code/deployment must be corrected and redeployed.
