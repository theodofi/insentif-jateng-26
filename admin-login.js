(() => {
    const account = document.getElementById('admin-account');
    const loginButton = document.getElementById('admin-login-button');
    const profileMenu = document.getElementById('admin-profile-menu');
    const profileEmail = document.getElementById('admin-profile-email');
    const logoutButton = document.getElementById('admin-logout-button');
    let loginView;
    let googleButton;
    let loginMessage;
    let identityScriptPromise;
    let googleIdentityInitialized = false;

    const buttonClasses = 'inline-flex items-center gap-2 text-sm font-semibold text-blue-700 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

    function readCredentialClaims(credential) {
        try {
            const payload = credential.split('.')[1];
            let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
            base64 += '='.repeat((4 - base64.length % 4) % 4);
            return JSON.parse(atob(base64));
        } catch {
            return {};
        }
    }

    function safeProfilePicture(value) {
        try {
            const url = new URL(value);
            if (url.protocol === 'https:' &&
                (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))) {
                return url.href;
            }
        } catch {
            return '';
        }
        return '';
    }

    function renderAccount() {
        let session = window.portalApi.getAdminSession();
        const claims = session ? readCredentialClaims(session.credential) : {};
        profileMenu.hidden = true;
        loginButton.setAttribute('aria-expanded', 'false');
        if (session && (!Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= Math.floor(Date.now() / 1000))) {
            window.portalApi.clearAdminSession();
            session = null;
        }

        loginButton.replaceChildren();
        loginButton.className = buttonClasses;
        loginButton.removeAttribute('aria-label');
        if (!session) {
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-lock';
            icon.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.textContent = 'Login Admin';
            loginButton.append(icon, label);
            profileMenu.hidden = true;
            loginButton.setAttribute('aria-haspopup', 'dialog');
            loginButton.setAttribute('aria-expanded', 'false');
            return;
        }

        const picture = safeProfilePicture(session.picture || claims.picture);
        if (picture) {
            const image = document.createElement('img');
            image.src = picture;
            image.alt = '';
            image.referrerPolicy = 'no-referrer';
            image.className = 'h-8 w-8 rounded-full border border-blue-200 object-cover';
            loginButton.appendChild(image);
        } else {
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-circle-user text-2xl';
            icon.setAttribute('aria-hidden', 'true');
            loginButton.appendChild(icon);
        }
        const label = document.createElement('span');
        label.className = 'max-w-40 truncate';
        label.textContent = session.email;
        loginButton.append(label);
        profileEmail.textContent = session.email;
        loginButton.setAttribute('aria-haspopup', 'menu');
        loginButton.setAttribute('aria-label', `Profil admin ${session.email}`);
    }

    function closeLoginView() {
        if (!loginView) return;
        loginView.hidden = true;
        loginView.style.display = 'none';
        loginButton.setAttribute('aria-expanded', 'false');
        loginButton.focus();
    }

    function createLoginView() {
        const overlay = document.createElement('div');
        overlay.id = 'admin-login-view';
        overlay.hidden = true;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'admin-login-title');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:1rem;background:rgba(15,23,42,.72);';

        const card = document.createElement('div');
        card.style.cssText = 'width:min(100%,28rem);padding:2rem;border-radius:1rem;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.25);text-align:center;font-family:Inter,Arial,sans-serif;';
        card.innerHTML = '<h1 id="admin-login-title" style="margin:0 0 .5rem;font-size:1.35rem;color:#111827">Login Admin</h1>' +
            '<p style="margin:0 0 1.25rem;color:#4b5563;font-size:.95rem">Masuk dengan salah satu akun Google admin terdaftar.</p>' +
            '<div id="admin-google-button" style="display:flex;justify-content:center;min-height:44px"></div>' +
            '<p id="admin-login-message" role="status" aria-live="polite" style="margin:1rem 0;color:#b91c1c;font-size:.875rem"></p>';
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Kembali ke portal';
        cancelButton.className = 'rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50';
        cancelButton.addEventListener('click', closeLoginView);
        card.appendChild(cancelButton);
        overlay.appendChild(card);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeLoginView();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !overlay.hidden) closeLoginView();
        });
        document.body.appendChild(overlay);
        loginView = overlay;
        googleButton = card.querySelector('#admin-google-button');
        loginMessage = card.querySelector('#admin-login-message');
    }

    function loadGoogleIdentity() {
        if (window.google?.accounts?.id) return Promise.resolve();
        if (identityScriptPromise) return identityScriptPromise;

        identityScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = () => {
                identityScriptPromise = null;
                reject(new Error('identity_script_failed'));
            };
            document.head.appendChild(script);
        });
        return identityScriptPromise;
    }

    async function acceptGoogleCredential(response) {
        if (!response?.credential || !loginMessage) return;
        loginMessage.textContent = 'Memverifikasi akun pada kedua panel...';
        try {
            const result = await window.portalApi.authenticateAdmin(response.credential);
            const claims = readCredentialClaims(response.credential);
            window.portalApi.saveAdminSession({
                credential: response.credential,
                email: result.email,
                picture: safeProfilePicture(claims.picture)
            });
            closeLoginView();
            renderAccount();
            const workflow = document.body.dataset.portalWorkflow;
            if (workflow) await window.portalApi.initializeAdmin(workflow);
        } catch (error) {
            loginMessage.textContent = window.portalApi.showApiError(error);
        }
    }

    async function openLoginView() {
        if (!loginView) createLoginView();
        loginView.hidden = false;
        loginView.style.display = 'flex';
        loginButton.setAttribute('aria-haspopup', 'dialog');
        loginButton.setAttribute('aria-expanded', 'true');
        loginMessage.textContent = '';
        googleButton.replaceChildren();

        const clientId = window.PORTAL_CONFIG?.googleOAuthClientId;
        if (!clientId || clientId.startsWith('REPLACE_')) {
            loginMessage.textContent = 'Atur Google OAuth Web Client ID di portal-config.js terlebih dahulu.';
            return;
        }

        try {
            await loadGoogleIdentity();
            if (!googleIdentityInitialized) {
                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: acceptGoogleCredential,
                    auto_select: false,
                    cancel_on_tap_outside: false
                });
                googleIdentityInitialized = true;
            }
            window.google.accounts.id.renderButton(googleButton, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                width: 260
            });
        } catch {
            loginMessage.textContent = 'Google Sign-In gagal dimuat. Periksa koneksi dan konfigurasi OAuth.';
        }
    }

    loginButton.addEventListener('click', () => {
        const session = window.portalApi.getAdminSession();
        if (!session) {
            void openLoginView();
            return;
        }
        const claims = readCredentialClaims(session.credential);
        if (!Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= Math.floor(Date.now() / 1000)) {
            window.portalApi.clearAdminSession();
            renderAccount();
            void openLoginView();
            return;
        }
        profileMenu.hidden = !profileMenu.hidden;
        loginButton.setAttribute('aria-expanded', String(!profileMenu.hidden));
    });

    logoutButton.addEventListener('click', () => {
        window.portalApi.clearAdminSession();
        window.google?.accounts?.id?.disableAutoSelect();
        if (document.body.dataset.portalWorkflow) {
            window.location.assign('../index.html');
            return;
        }
        renderAccount();
    });

    document.addEventListener('click', event => {
        if (!account.contains(event.target)) {
            profileMenu.hidden = true;
            loginButton.setAttribute('aria-expanded', 'false');
        }
    });

    window.addEventListener('pageshow', renderAccount);
    window.addEventListener('portal-admin-ready', renderAccount);
    renderAccount();
})();
