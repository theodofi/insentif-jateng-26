# Portal and Apps Script setup

The public monitor pages and admin panels are static Netlify pages. The Apps Script projects expose JSON APIs only; the Netlify function proxies browser requests to avoid cross-origin browser restrictions.

## Google OAuth

1. Create a Google OAuth 2.0 **Web application** client in Google Cloud.
2. Add the production Netlify URL (and any preview origins you use) to its authorized JavaScript origins.
3. Replace `REPLACE_WITH_GOOGLE_OAUTH_WEB_CLIENT_ID` in `portal-config.js` and in both Apps Script `Kode.gs` files with the same client ID. The client ID is public configuration, not a client secret.

## Apps Script deployments

For each project in `apps-script/Ajuan/JanuariJuni/` and `apps-script/BulanBerjalan/JanuariJuni/`:

1. Update `Kode.gs` in the corresponding Apps Script project.
2. Deploy a new **Web app** version that executes as the project owner and is accessible to anyone. The public monitor API must be reachable without a Google login; every admin operation independently verifies the Google ID token and checks the existing admin email allowlist.
3. Authorize the project’s Spreadsheet, Drive, Docs, and external-request permissions when prompted.

The deployment URLs are configured in `netlify/functions/portal-api.js`. Update those constants if a deployment URL changes. Do not remove the email allowlist checks.

## Netlify

Deploy the repository normally. Netlify detects the function in `netlify/functions/portal-api.js`; the `_headers` file applies CSP and browser security headers. The main portal links to the static public pages, and admin panels are available at `/admin/ajuan.html` and `/admin/bulan-berjalan.html`.

After deployment, check both public monitors, sign in with an allowlisted account on both admin panels, and verify that non-allowlisted Google accounts are rejected before testing admin reads, status saves, and PDF generation.
