(() => {
    const account = document.getElementById('admin-account');
    const loginButton = document.getElementById('admin-login-button');
    const profileMenu = document.getElementById('admin-profile-menu');
    const profileEmail = document.getElementById('admin-profile-email');
    const mobileProfile = document.getElementById('admin-mobile-profile');
    const mobileProfileAvatar = document.getElementById('admin-mobile-profile-avatar');
    const mobileProfileEmail = document.getElementById('admin-mobile-profile-email');
    const logoutButton = document.getElementById('admin-logout-button');
    const mobileMenuToggle = document.getElementById('mobile-admin-menu-toggle');
    const mobileSidebar = document.getElementById('mobile-admin-sidebar');
    const mobileSidebarClose = document.getElementById('mobile-admin-menu-close');
    const mobileMenuBackdrop = document.getElementById('mobile-admin-menu-backdrop');
    const dashboardActions = document.querySelector('.admin-dashboard-actions');
    const mobileViewport = window.matchMedia('(max-width: 767px)');
    const dashboardActionsPlaceholder = dashboardActions
        ? document.createComment('admin-dashboard-actions-slot')
        : null;
    let loginView;
    let googleButton;
    let loginMessage;
    let identityScriptPromise;
    let googleIdentityInitialized = false;
    const LOGIN_LIMIT_KEY = 'admin-login-limit';
    const MAX_LOGIN_FAILURES = 3;
    const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

    const buttonClasses = 'inline-flex flex-shrink-0 items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm';

    if (dashboardActionsPlaceholder) {
        dashboardActions.parentNode.insertBefore(dashboardActionsPlaceholder, dashboardActions);
    }

    function placeDashboardActions() {
        if (!dashboardActions || !mobileSidebar || !dashboardActionsPlaceholder) return;
        if (mobileViewport.matches) {
            if (dashboardActions.parentNode !== mobileSidebar) mobileSidebar.appendChild(dashboardActions);
        } else if (dashboardActions.parentNode !== dashboardActionsPlaceholder.parentNode) {
            dashboardActionsPlaceholder.parentNode.insertBefore(dashboardActions, dashboardActionsPlaceholder);
        }
    }

    function setMobileSidebarOpen(open, restoreFocus = true) {
        if (!mobileSidebar || !mobileMenuToggle || !mobileMenuBackdrop) return;
        const isOpen = open && mobileViewport.matches;
        mobileSidebar.classList.toggle('is-open', isOpen);
        mobileSidebar.setAttribute('aria-hidden', String(mobileViewport.matches && !isOpen));
        mobileMenuToggle.setAttribute('aria-expanded', String(isOpen));
        mobileMenuBackdrop.hidden = !isOpen;
        document.body.classList.toggle('mobile-admin-menu-open', isOpen);
        if (isOpen) mobileSidebarClose.focus();
        else if (restoreFocus && mobileViewport.matches) mobileMenuToggle.focus();
    }

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
        mobileProfile.hidden = true;
        account.classList.remove('is-authenticated');
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
            label.textContent = 'Login';
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
            image.className = 'h-7 w-7 rounded-full border border-blue-200 object-cover sm:h-8 sm:w-8';
            loginButton.appendChild(image);
        } else {
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-circle-user text-xl sm:text-2xl';
            icon.setAttribute('aria-hidden', 'true');
            loginButton.appendChild(icon);
        }
        const label = document.createElement('span');
        label.className = 'max-w-40 truncate';
        label.textContent = session.email;
        loginButton.append(label);
        profileEmail.textContent = session.email;
        account.classList.add('is-authenticated');
        mobileProfile.hidden = false;
        mobileProfileEmail.textContent = session.email;
        mobileProfileAvatar.replaceChildren();
        if (picture) {
            const mobileImage = document.createElement('img');
            mobileImage.src = picture;
            mobileImage.alt = '';
            mobileImage.referrerPolicy = 'no-referrer';
            mobileProfileAvatar.appendChild(mobileImage);
        } else {
            const mobileIcon = document.createElement('i');
            mobileIcon.className = 'fa-solid fa-circle-user';
            mobileIcon.setAttribute('aria-hidden', 'true');
            mobileProfileAvatar.appendChild(mobileIcon);
        }
        profileMenu.hidden = !mobileViewport.matches;
        loginButton.setAttribute('aria-haspopup', 'menu');
        loginButton.setAttribute('aria-label', `Profil admin ${session.email}`);
    }

    function closeLoginView() {
        if (!loginView) return;
        loginView.hidden = true;
        loginView.style.display = 'none';
        loginButton.setAttribute('aria-expanded', 'false');
        if (mobileViewport.matches && mobileMenuToggle) mobileMenuToggle.focus();
        else loginButton.focus();
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

    function readLoginLimit() {
        try {
            const data = JSON.parse(localStorage.getItem(LOGIN_LIMIT_KEY));
            return {
                failures: Number(data?.failures) || 0,
                lockedUntil: Number(data?.lockedUntil) || 0
            };
        } catch {
            return { failures: 0, lockedUntil: 0 };
        }
    }

    function writeLoginLimit(state) {
        try {
            localStorage.setItem(LOGIN_LIMIT_KEY, JSON.stringify(state));
        } catch {
            // Storage unavailable; limit cannot be persisted.
        }
    }

    function lockoutRemainingMinutes() {
        const state = readLoginLimit();
        if (state.lockedUntil > Date.now()) return Math.ceil((state.lockedUntil - Date.now()) / 60000);
        if (state.lockedUntil) writeLoginLimit({ failures: 0, lockedUntil: 0 });
        return 0;
    }

    function lockoutMessage(minutes) {
        return `Terlalu banyak percobaan login gagal. Coba lagi dalam ${minutes} menit.`;
    }

    function recordLoginFailure() {
        const state = readLoginLimit();
        state.failures += 1;
        if (state.failures >= MAX_LOGIN_FAILURES) {
            state.failures = 0;
            state.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
        }
        writeLoginLimit(state);
        return state;
    }

    async function acceptGoogleCredential(response) {
        if (!response?.credential || !loginMessage) return;
        const lockedMinutes = lockoutRemainingMinutes();
        if (lockedMinutes) {
            loginMessage.textContent = lockoutMessage(lockedMinutes);
            return;
        }
        loginMessage.textContent = 'Memverifikasi akun pada kedua panel...';
        try {
            const result = await window.portalApi.authenticateAdmin(response.credential);
            const claims = readCredentialClaims(response.credential);
            window.portalApi.saveAdminSession({
                credential: response.credential,
                email: result.email,
                picture: safeProfilePicture(claims.picture)
            });
            writeLoginLimit({ failures: 0, lockedUntil: 0 });
            closeLoginView();
            renderAccount();
            const workflow = document.body.dataset.portalWorkflow;
            if (workflow) await window.portalApi.initializeAdmin(workflow);
        } catch (error) {
            const state = recordLoginFailure();
            const remaining = lockoutRemainingMinutes();
            if (remaining) {
                loginMessage.textContent = lockoutMessage(remaining);
                googleButton?.replaceChildren();
            } else {
                const left = MAX_LOGIN_FAILURES - state.failures;
                loginMessage.textContent = `${window.portalApi.showApiError(error)} Sisa percobaan: ${left}.`;
            }
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

        const lockedMinutes = lockoutRemainingMinutes();
        if (lockedMinutes) {
            loginMessage.textContent = lockoutMessage(lockedMinutes);
            return;
        }

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
            setMobileSidebarOpen(false, false);
            void openLoginView();
            return;
        }
        const claims = readCredentialClaims(session.credential);
        if (!Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= Math.floor(Date.now() / 1000)) {
            window.portalApi.clearAdminSession();
            renderAccount();
            setMobileSidebarOpen(false, false);
            void openLoginView();
            return;
        }
        if (mobileViewport.matches) {
            profileMenu.hidden = false;
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
        if (!mobileViewport.matches && !account.contains(event.target)) {
            profileMenu.hidden = true;
            loginButton.setAttribute('aria-expanded', 'false');
        }
    });

    if (mobileMenuToggle && mobileSidebar && mobileSidebarClose && mobileMenuBackdrop) {
        placeDashboardActions();
        setMobileSidebarOpen(false, false);
        mobileMenuToggle.addEventListener('click', () => {
            setMobileSidebarOpen(!mobileSidebar.classList.contains('is-open'));
        });
        mobileSidebarClose.addEventListener('click', () => setMobileSidebarOpen(false));
        mobileMenuBackdrop.addEventListener('click', () => setMobileSidebarOpen(false));
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && mobileSidebar.classList.contains('is-open')) {
                setMobileSidebarOpen(false);
            }
        });
        window.addEventListener('resize', () => {
            placeDashboardActions();
            setMobileSidebarOpen(false, false);
            renderAccount();
        });
    }

    window.addEventListener('pageshow', renderAccount);
    window.addEventListener('portal-admin-ready', renderAccount);
    renderAccount();
})();
