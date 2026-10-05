const APPS_SCRIPT_ENDPOINTS = Object.freeze({
    ajuanJanJun: 'https://script.google.com/macros/s/AKfycbxBgTghuwIQoBqpDNJzAVDXRVUHQIXIl323Gs9eaAYSEDVbdzkJfUzStKjct18K_3A0wA/exec',
    ajuanJulDes: 'https://script.google.com/macros/s/AKfycbzCP3KmQOYMorQcYDkPo9diVoHaRzUgfhw_Jz5pAhba-MOnm3p9Ut39zn1sb1YLXRzFag/exec',
    berjalanJanJun: 'https://script.google.com/macros/s/AKfycby9AImHXGYpzR5MYRVyugOvAbW1_l56JlTZtv6yG6dHLYeRcrS4riNxvxnrq9ZatW9s/exec',
    berjalanJulDes: 'https://script.google.com/macros/s/AKfycbxIog3m0lBVkVr2-Z_h5EYXvHE5-8aPu_JODf8C66CKgx97ddDrE4fBhkQ9ay0mveSS/exec'
});
const TEACHER_SEARCH_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxq4ZIhzpZjOSiqNfNnT8kudjPdZCm4WBE33bjcAkP9JiqVDGLE7cCpQ_pjpSNJxNz0Xw/exec';

const ADMIN_METHODS = new Set([
    'ambilDataAntreanAdmin',
    'ambilDaftarPDF',
    'cekJumlahBaris',
    'inisialisasiCetakBatch',
    'prosesSatuBarisPDFWeb',
    'simpanStatusVerval'
]);

function jsonResponse(statusCode, payload) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
        },
        body: JSON.stringify(payload)
    };
}

exports.handler = async function (event) {
    if (!['GET', 'POST'].includes(event.httpMethod)) {
        return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
    }
    const rawBody = event.httpMethod === 'POST'
        ? event.isBase64Encoded
            ? Buffer.from(event.body || '', 'base64').toString('utf8')
            : event.body || ''
        : '';
    if (rawBody.length > 32768) return jsonResponse(413, { ok: false, error: 'request_too_large' });
    const postParameters = event.httpMethod === 'POST' ? new URLSearchParams(rawBody) : null;
    const workflow = event.httpMethod === 'GET'
        ? event.queryStringParameters?.workflow
        : event.httpMethod === 'POST'
            ? postParameters.get('workflow')
            : null;
    const endpoint = workflow === 'teacherSearch'
        ? TEACHER_SEARCH_ENDPOINT
        : APPS_SCRIPT_ENDPOINTS[workflow];

    if (!endpoint) return jsonResponse(400, { ok: false, error: 'bad_request' });
    if (endpoint.startsWith('REPLACE_')) {
        return jsonResponse(503, { ok: false, error: 'api_not_configured' });
    }

    let url = endpoint;
    const options = { method: event.httpMethod, redirect: 'follow' };
    if (event.httpMethod === 'GET') {
        if (workflow === 'teacherSearch') {
            const parameters = event.queryStringParameters || {};
            const action = parameters.action;
            const device = parameters.device || '';
            if (!['captcha', 'search'].includes(action) ||
                !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(device)) {
                return jsonResponse(400, { ok: false, error: 'bad_request' });
            }
            const allowedParameters = action === 'captcha'
                ? { action, device }
                : {
                    action,
                    device,
                    q: parameters.q || '',
                    kab: parameters.kab || '',
                    token: parameters.token || '',
                    answer: parameters.answer || ''
                };
            const query = new URLSearchParams(allowedParameters);
            if (action === 'search' &&
                ((!query.get('q').trim() && !query.get('kab').trim()) ||
                    query.get('q').length > 100 ||
                    query.get('kab').length > 50 ||
                    !query.get('token') ||
                    !query.get('answer'))) {
                return jsonResponse(400, { ok: false, error: 'bad_request' });
            }
            url += `?${query.toString()}`;
        } else {
            if (event.queryStringParameters?.action !== 'monitor') {
                return jsonResponse(400, { ok: false, error: 'bad_request' });
            }
            url += '?action=monitor';
        }
    } else if (event.httpMethod === 'POST') {
        const parameters = postParameters;
        const action = parameters.get('action');
        if (workflow === 'teacherSearch') {
            const credential = parameters.get('credential');
            if (!['admin-search', 'admin-summary'].includes(action) ||
                !credential ||
                credential.length > 8192) {
                return jsonResponse(400, { ok: false, error: 'bad_request' });
            }
            if (action === 'admin-search') {
                const query = parameters.get('q') || '';
                const region = parameters.get('kab') || '';
                if (query.length > 100 ||
                    region.length > 50 ||
                    (!query.trim() && !region.trim())) {
                    return jsonResponse(400, { ok: false, error: 'bad_request' });
                }
            }
            options.headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
            options.body = rawBody;
        } else {
        if (action === 'admin' && !ADMIN_METHODS.has(parameters.get('method'))) {
            return jsonResponse(400, { ok: false, error: 'bad_request' });
        }
        if (!['auth', 'admin'].includes(action) ||
            !parameters.get('credential') ||
            parameters.get('credential').length > 8192) {
            return jsonResponse(400, { ok: false, error: 'bad_request' });
        }
        options.headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
        options.body = rawBody;
        }
    } else {
        return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    let phase = 'Apps Script request';
    try {
        let upstream = await fetch(url, {
            ...options,
            redirect: 'manual',
            signal: controller.signal
        });
        if ([301, 302, 303, 307, 308].includes(upstream.status)) {
            const location = upstream.headers.get('location');
            if (!location) throw new Error('Apps Script redirect has no location.');
            const redirectUrl = new URL(location, url);
            if (redirectUrl.protocol !== 'https:' ||
                redirectUrl.hostname !== 'script.googleusercontent.com') {
                throw new Error('Apps Script returned an untrusted redirect.');
            }
            phase = 'Apps Script response redirect';
            const redirectMethod = [301, 302, 303].includes(upstream.status)
                ? 'GET'
                : event.httpMethod;
            upstream = await fetch(redirectUrl, {
                method: redirectMethod,
                redirect: 'manual',
                signal: controller.signal
            });
        }
        phase = 'Apps Script response body';
        const responseText = await upstream.text();
        if (responseText.length > 2_000_000) {
            return jsonResponse(502, { ok: false, error: 'upstream_response_too_large' });
        }
        const contentType = upstream.headers.get('content-type') || '';
        if (contentType.includes('text/html') || /^\s*<!doctype html/i.test(responseText)) {
            const errorText = responseText
                .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&quot;/g, '"')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 240);
            console.error(`Apps Script returned an HTML error for workflow ${workflow}: ${errorText}`);
            return jsonResponse(502, { ok: false, error: 'apps_script_runtime_error' });
        }
        const payload = JSON.parse(responseText);
        if (!payload || typeof payload.ok !== 'boolean') throw new Error('Invalid upstream response.');
        return jsonResponse(upstream.ok ? 200 : 502, payload);
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`Apps Script request timed out for workflow ${workflow} during ${phase}.`);
            return jsonResponse(504, { ok: false, error: 'upstream_timeout' });
        }
        console.error('Apps Script proxy request failed:', error.message);
        return jsonResponse(502, { ok: false, error: 'upstream_unavailable' });
    } finally {
        clearTimeout(timeoutId);
    }
};
