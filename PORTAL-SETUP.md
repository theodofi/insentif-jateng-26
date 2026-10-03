# Portal and Apps Script setup

The public monitor pages and admin panels are static Netlify pages. The Apps Script projects expose JSON APIs only; the Netlify function proxies browser requests to avoid cross-origin browser restrictions.

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

Deploy the repository normally. Netlify detects the function in `netlify/functions/portal-api.js`; the `_headers` file applies CSP and browser security headers. The main portal links to the static public pages, and admin panels are available at `/admin/ajuan-janjun.html`, `/admin/ajuan-juldes.html`, `/admin/berjalan-janjun.html`, and `/admin/berjalan-juldes.html`.

The home-page Google sign-in checks the ID token against the existing Ajuan Januari-Juni and Bulan Berjalan Apps Script projects. Only after both APIs accept the account does the portal show the Google profile and panel links. Each admin panel, including Ajuan Juli-Desember, revalidates that token against its own Apps Script allowlist before loading or changing data.

The verified ID token is held in `sessionStorage` for the current browser tab so the user can open any admin panel without signing in again. It is removed when the user selects **Keluar** and is rejected by the backend after expiry.

After configuring both Juli-Desember endpoints and deploying, check all public monitors, sign in with an allowlisted account, open each admin panel from the profile menu, and verify that non-allowlisted Google accounts are rejected before testing admin reads, status saves, and PDF generation.
