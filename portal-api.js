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
    let identityScriptPromise;
    let identityInitialized = false;
    let googleCredentialHandler;

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
            let payload;
            try {
                payload = await response.json();
            } catch {
                throw new Error('api_invalid_response');
            }
            if (!response.ok) throw new Error(payload?.error || 'api_request_failed');
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
            auth_verification_failed: 'Apps Script tidak dapat menghubungi layanan verifikasi Google. Jalankan authorizeGoogleAuth() pada kedua project, izinkan akses eksternal, lalu deploy ulang.',
            server_error: 'Apps Script mengalami kesalahan. Periksa riwayat Executions pada project Google Apps Script.',
            upstream_timeout: 'Apps Script merespons terlalu lama. Coba lagi; jika berulang, periksa riwayat Executions pada project Apps Script terkait.',
            upstream_unavailable: 'Netlify tidak dapat menghubungi Apps Script. Periksa URL deployment dan pastikan versi API terbaru sudah dipublikasikan.',
            api_invalid_response: 'Server mengirim respons yang tidak valid. Periksa deployment fungsi Netlify dan Apps Script.',
            api_request_failed: 'Permintaan API gagal. Periksa deployment Netlify dan Apps Script.',
            auth_not_configured: 'Client ID Google belum dikonfigurasi.',
            invalid_admin_token: 'Sesi Google tidak valid. Silakan masuk kembali.',
            session_storage_unavailable: 'Penyimpanan browser tidak tersedia. Izinkan penyimpanan situs lalu coba lagi.',
            bad_request: 'Permintaan tidak valid.'
        };
        return messages[error.message] || 'Gagal menghubungi server. Periksa koneksi lalu coba lagi.';
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

    function readGoogleProfile(credential) {
        try {
            const encodedPayload = credential.split('.')[1];
            if (!encodedPayload) return { name: '', picture: '' };
            let base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
            base64 += '='.repeat((4 - base64.length % 4) % 4);
            const bytes = Uint8Array.from(window.atob(base64), character => character.charCodeAt(0));
            const claims = JSON.parse(new TextDecoder().decode(bytes));
            return {
                name: typeof claims.name === 'string' ? claims.name.trim() : '',
                picture: safeProfilePicture(claims.picture)
            };
        } catch {
            return { name: '', picture: '' };
        }
    }

    function getAdminSession() {
        let stored;
        try {
            stored = window.localStorage.getItem(adminSessionKey);
            if (!stored) {
                stored = window.sessionStorage.getItem(adminSessionKey);
                if (stored) {
                    window.localStorage.setItem(adminSessionKey, stored);
                    window.sessionStorage.removeItem(adminSessionKey);
                }
            }
        } catch {
            throw new Error('session_storage_unavailable');
        }
        if (!stored) return null;
        try {
            const session = JSON.parse(stored);
            if (session && typeof session.credential === 'string' && typeof session.email === 'string') {
                const profile = readGoogleProfile(session.credential);
                return {
                    ...session,
                    name: typeof session.name === 'string' && session.name.trim() ?
                        session.name.trim() : profile.name,
                    picture: safeProfilePicture(session.picture) || profile.picture
                };
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
        const profile = readGoogleProfile(session.credential);
        const sameCredential = previous?.credential === session.credential;
        const savedSession = {
            credential: session.credential,
            email: session.email,
            name: profile.name || (
                typeof session.name === 'string' ? session.name.trim() : ''
            ) || (sameCredential ? previous.name || '' : ''),
            picture: safeProfilePicture(session.picture) ||
                (sameCredential ? safeProfilePicture(previous.picture) : '') ||
                profile.picture
        };
        try {
            window.localStorage.setItem(adminSessionKey, JSON.stringify(savedSession));
            window.sessionStorage.removeItem(adminSessionKey);
        } catch {
            throw new Error('session_storage_unavailable');
        }
        return savedSession;
    }

    function clearAdminSession() {
        adminCredential = undefined;
        try {
            window.localStorage.removeItem(adminSessionKey);
            window.sessionStorage.removeItem(adminSessionKey);
        } catch {
            throw new Error('session_storage_unavailable');
        }
    }

    async function authenticateAdmin(credential) {
        if (typeof credential !== 'string' || !credential || credential.length > 8192) {
            throw new Error('invalid_admin_token');
        }
        const result = await request('berjalanJanJun', { action: 'auth', credential }, 'POST');
        const email = String(result.email || '').trim();
        if (!email) throw new Error('api_invalid_response');
        return { email };
    }

    function createAuthGate(workflow) {
        if (authGate?.isConnected) {
            activeWorkflow = workflow;
            return authGate;
        }
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

        try {
            await renderGoogleButton(googleButton, acceptGoogleCredential);
        } catch {
            authMessage.textContent = showApiError(new Error(
                window.PORTAL_CONFIG?.googleOAuthClientId?.startsWith('REPLACE_') ||
                !window.PORTAL_CONFIG?.googleOAuthClientId
                    ? 'auth_not_configured'
                    : 'identity_script_failed'
            ));
        }
    }

    async function initializeAdmin(workflow) {
        if (!['ajuanJanJun', 'ajuanJulDes', 'berjalanJanJun', 'berjalanJulDes'].includes(workflow)) throw new Error('bad_request');
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

    function disposeAdmin() {
        adminCredential = undefined;
        activeWorkflow = undefined;
        authGate?.remove();
        authGate = undefined;
        authMessage = undefined;
        googleButton = undefined;
        googleCredentialHandler = undefined;
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

    async function renderGoogleButton(container, credentialHandler) {
        if (!(container instanceof HTMLElement) || typeof credentialHandler !== 'function') {
            throw new Error('bad_request');
        }
        const clientId = window.PORTAL_CONFIG?.googleOAuthClientId;
        if (!clientId || clientId.startsWith('REPLACE_')) throw new Error('auth_not_configured');
        await loadGoogleIdentity();
        googleCredentialHandler = credentialHandler;
        if (!identityInitialized) {
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: response => {
                    if (googleCredentialHandler) void googleCredentialHandler(response);
                },
                auto_select: false,
                cancel_on_tap_outside: false
            });
            identityInitialized = true;
        }
        container.replaceChildren();
        window.google.accounts.id.renderButton(container, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            width: 260
        });
    }

    window.portalApi = Object.freeze({
        initializeAdmin,
        authenticateAdmin,
        renderGoogleButton,
        getAdminSession,
        saveAdminSession,
        clearAdminSession,
        disposeAdmin,
        publicCall,
        adminCall,
        showApiError
    });
})();
