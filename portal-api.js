(() => {
    const monitorMethods = new Set(['ambilDataSheetPengumpulanIndex2']);
    const adminMethods = new Set([
        'ambilDataAntreanAdmin',
        'ambilDaftarPDF',
        'cekJumlahBaris',
        'inisialisasiCetakBatch',
        'prosesSatuBarisPDFWeb',
        'simpanStatusVerval'
    ]);
    const requestTimeout = 60000;
    const adminSessionKey = 'portal-admin-session';
    let adminCredential;
    let activeWorkflow;
    let authGate;
    let authMessage;
    let googleButton;
    let userBadge;
    let identityScriptPromise;

    async function request(workflow, parameters, method) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), requestTimeout);
        const target = new URL('/.netlify/functions/portal-api', window.location.origin);
        let url = target.toString();
        const options = {
            method,
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal: controller.signal
        };

        if (method === 'GET') {
            target.searchParams.set('workflow', workflow);
            Object.entries(parameters).forEach(([key, value]) => {
                target.searchParams.set(key, String(value));
            });
            url = target.toString();
        } else {
            parameters.workflow = workflow;
            options.headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
            options.body = new URLSearchParams(parameters);
        }

        try {
            const response = await fetch(method === 'GET' ? url : target.toString(), options);
            if (!response.ok) throw new Error('api_request_failed');
            const payload = await response.json();
            if (!payload || payload.ok !== true) {
                throw new Error(payload?.error || 'api_request_failed');
            }
            return payload;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('api_timeout');
            throw error;
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    function showApiError(error) {
        const messages = {
            api_not_configured: 'Konfigurasi API belum lengkap.',
            api_timeout: 'Server merespons terlalu lama. Silakan coba lagi.',
            forbidden: 'Akun Google ini tidak memiliki akses admin.',
            auth_not_configured: 'Client ID Google belum dikonfigurasi.',
            invalid_admin_token: 'Sesi Google tidak valid. Silakan masuk kembali.',
            identity_mismatch: 'Akun Google tidak diizinkan pada kedua panel admin.',
            session_storage_unavailable: 'Penyimpanan sesi browser tidak tersedia. Izinkan penyimpanan sesi lalu coba lagi.',
            bad_request: 'Permintaan tidak valid.'
        };
        return messages[error.message] || 'Gagal menghubungi server. Periksa koneksi lalu coba lagi.';
    }

    function getAdminSession() {
        let stored;
        try {
            stored = window.sessionStorage.getItem(adminSessionKey);
        } catch {
            throw new Error('session_storage_unavailable');
        }
        if (!stored) return null;
        try {
            const session = JSON.parse(stored);
            if (session && typeof session.credential === 'string' && typeof session.email === 'string') {
                return session;
            }
            clearAdminSession();
            return null;
        } catch {
            clearAdminSession();
            return null;
        }
    }

    function saveAdminSession(session) {
        const previous = getAdminSession();
        const savedSession = {
            credential: session.credential,
            email: session.email,
            picture: session.picture || (
                previous?.credential === session.credential ? previous.picture : ''
            )
        };
        try {
            window.sessionStorage.setItem(adminSessionKey, JSON.stringify(savedSession));
        } catch {
            throw new Error('session_storage_unavailable');
        }
        return savedSession;
    }

    function clearAdminSession() {
        try {
            window.sessionStorage.removeItem(adminSessionKey);
        } catch {
            throw new Error('session_storage_unavailable');
        }
    }

    async function authenticateAdmin(credential) {
        if (typeof credential !== 'string' || !credential || credential.length > 8192) {
            throw new Error('invalid_admin_token');
        }
        const results = await Promise.all(['ajuan', 'berjalan'].map(workflow =>
            request(workflow, { action: 'auth', credential }, 'POST')
        ));
        const emails = results.map(result => String(result.email || '').trim().toLowerCase());
        if (!emails[0] || emails[0] !== emails[1]) throw new Error('identity_mismatch');
        return { email: results[0].email };
    }

    function createAuthGate(workflow) {
        const overlay = document.createElement('div');
        overlay.id = 'portal-admin-auth-gate';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'portal-admin-auth-title');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:1rem;background:rgba(15,23,42,.72);';

        const card = document.createElement('div');
        card.style.cssText = 'width:min(100%,28rem);padding:2rem;border-radius:1rem;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.25);text-align:center;font-family:Inter,Arial,sans-serif;';
        card.innerHTML = '<h1 id="portal-admin-auth-title" style="margin:0 0 .5rem;font-size:1.35rem;color:#111827">Login Admin</h1>' +
            '<p style="margin:0 0 1.25rem;color:#4b5563;font-size:.95rem">Masuk dengan akun Google yang terdaftar sebagai admin.</p>' +
            '<div id="portal-admin-google-button" style="display:flex;justify-content:center;min-height:44px"></div>' +
            '<p id="portal-admin-auth-message" role="status" aria-live="polite" style="margin:1rem 0 0;color:#b91c1c;font-size:.875rem"></p>';
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        authGate = overlay;
        authMessage = card.querySelector('#portal-admin-auth-message');
        googleButton = card.querySelector('#portal-admin-google-button');
        activeWorkflow = workflow;
        return overlay;
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
            script.onerror = () => reject(new Error('identity_script_failed'));
            document.head.appendChild(script);
        });
        return identityScriptPromise;
    }

    function addAdminControls(email) {
        if (userBadge) userBadge.remove();
        const badge = document.createElement('div');
        badge.style.cssText = 'position:fixed;right:.75rem;top:.75rem;z-index:1000;display:flex;align-items:center;gap:.5rem;padding:.4rem .65rem;border:1px solid #d1d5db;border-radius:.5rem;background:#fff;color:#374151;font:12px Inter,Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.08)';
        const identity = document.createElement('span');
        identity.textContent = email;
        const logout = document.createElement('button');
        logout.type = 'button';
        logout.textContent = 'Keluar';
        logout.style.cssText = 'padding:.3rem .55rem;border:0;border-radius:.35rem;background:#e5e7eb;color:#111827;cursor:pointer';
        logout.addEventListener('click', () => {
            adminCredential = undefined;
            clearAdminSession();
            badge.remove();
            userBadge = null;
            window.google?.accounts?.id?.disableAutoSelect();
            openAuthGate();
        });
        badge.append(identity, logout);
        document.body.appendChild(badge);
        userBadge = badge;
    }

    async function acceptGoogleCredential(response) {
        if (!response?.credential || !authMessage) return;
        authMessage.textContent = 'Memverifikasi akun...';
        try {
            const result = await request(activeWorkflow, {
                action: 'auth',
                credential: response.credential
            }, 'POST');
            adminCredential = response.credential;
            saveAdminSession({ credential: response.credential, email: result.email });
            authMessage.textContent = '';
            authGate.hidden = true;
            authGate.style.display = 'none';
            addAdminControls(result.email);
            window.dispatchEvent(new CustomEvent('portal-admin-ready', { detail: { email: result.email } }));
        } catch (error) {
            adminCredential = undefined;
            authMessage.textContent = showApiError(error);
        }
    }

    async function openAuthGate() {
        if (!authGate) createAuthGate(activeWorkflow);
        authGate.hidden = false;
        authGate.style.display = 'flex';
        authMessage.textContent = '';
        googleButton.replaceChildren();

        const clientId = window.PORTAL_CONFIG?.googleOAuthClientId;
        if (!clientId || clientId.startsWith('REPLACE_')) {
            authMessage.textContent = 'Atur Google OAuth Web Client ID di portal-config.js terlebih dahulu.';
            return;
        }

        try {
            await loadGoogleIdentity();
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: acceptGoogleCredential,
                auto_select: false,
                cancel_on_tap_outside: false
            });
            window.google.accounts.id.renderButton(googleButton, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                width: 260
            });
        } catch {
            authMessage.textContent = 'Google Sign-In gagal dimuat. Periksa koneksi dan konfigurasi OAuth.';
        }
    }

    async function initializeAdmin(workflow) {
        if (!['ajuan', 'berjalan'].includes(workflow)) throw new Error('bad_request');
        activeWorkflow = workflow;
        const session = getAdminSession();
        let sessionError;
        if (session) {
            try {
                const result = await request(workflow, {
                    action: 'auth',
                    credential: session.credential
                }, 'POST');
                adminCredential = session.credential;
                saveAdminSession({ credential: session.credential, email: result.email });
                addAdminControls(result.email);
                window.dispatchEvent(new CustomEvent('portal-admin-ready', { detail: { email: result.email } }));
                return;
            } catch (error) {
                adminCredential = undefined;
                if (error.message === 'forbidden') clearAdminSession();
                else sessionError = error;
            }
        }
        createAuthGate(workflow);
        await openAuthGate();
        if (sessionError) authMessage.textContent = showApiError(sessionError);
    }

    async function publicCall(functionName, args) {
        if (!monitorMethods.has(functionName) || args.length !== 0) throw new Error('bad_request');
        const result = await request(document.body.dataset.portalWorkflow, {
            action: 'monitor'
        }, 'GET');
        return result.data;
    }

    async function adminCall(functionName, args) {
        if (!adminCredential) throw new Error('invalid_admin_token');
        if (!adminMethods.has(functionName)) throw new Error('bad_request');
        return request(activeWorkflow, {
            action: 'admin',
            method: functionName,
            args: JSON.stringify(args),
            credential: adminCredential
        }, 'POST').then((result) => result.data).catch(error => {
            if (error.message === 'forbidden') {
                adminCredential = undefined;
                clearAdminSession();
                void openAuthGate();
            }
            throw error;
        });
    }

    window.portalApi = Object.freeze({
        initializeAdmin,
        authenticateAdmin,
        getAdminSession,
        saveAdminSession,
        clearAdminSession,
        publicCall,
        adminCall,
        showApiError
    });
})();
