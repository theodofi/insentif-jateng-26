# Portal and Apps Script setup

The public monitor pages and admin panels are static Netlify pages. The Apps Script projects expose JSON APIs only; the Netlify function proxies browser requests to avoid cross-origin browser restrictions.

## Google OAuth

1. Create a Google OAuth 2.0 **Web application** client in Google Cloud.
2. Add the production Netlify URL (and any preview origins you use) to its authorized JavaScript origins.
3. Ensure `portal-config.js` and both Apps Script `Kode.gs` files use the same OAuth Web Client ID. Replace any `REPLACE_WITH_GOOGLE_OAUTH_WEB_CLIENT_ID` placeholder. The client ID is public configuration, not a client secret.

## Apps Script deployments

Use the source files `apps-script/Ajuan/AjuanJanJun-Kode.gs` and `apps-script/BulanBerjalan/BBJanJun-Kode.gs` for the corresponding Google Apps Script projects. Their local filenames do not need to match the Apps Script editor filename.

For **each** corresponding Apps Script project:

1. Copy the contents of its source file into that project's `Kode.gs`.
2. In **Project Settings**, enable **Show "appsscript.json" manifest file**. Add `https://www.googleapis.com/auth/script.external_request` to the existing `oauthScopes` array in that project's manifest. Preserve all existing scopes and other manifest settings.
3. Save the manifest, then select and run `authorizeGoogleAuth()` once as the project owner. Approve the requested permission. An HTTP 400 result is expected because the helper deliberately sends an invalid token to Google.
4. Deploy a new **Web app** version that executes as the project owner and is accessible to anyone. The public monitor API must be reachable without a Google login; every admin operation independently verifies the Google ID token and checks the existing admin email allowlist.

The deployment URLs are configured in `netlify/functions/portal-api.js`. Update those constants if a deployment URL changes. Do not remove the email allowlist checks.

## Netlify

Deploy the repository normally. Netlify detects the function in `netlify/functions/portal-api.js`; the `_headers` file applies CSP and browser security headers. The main portal links to the static public pages, and admin panels are available at `/admin/ajuan-janjun.html` and `/admin/bulan-berjalan.html`.

The home-page Google sign-in checks the ID token against both Apps Script projects. Only after both APIs accept the account does the portal show the Google profile and panel links. The admin panels revalidate that token against their own allowlist before loading or changing data.

The verified ID token is held in `sessionStorage` for the current browser tab so the user can open either panel without signing in again. It is removed when the user selects **Keluar** and is rejected by the backend after expiry.

After deployment, check both public monitors, sign in with an allowlisted account, open both admin panels from the profile menu, and verify that non-allowlisted Google accounts are rejected before testing admin reads, status saves, and PDF generation.
