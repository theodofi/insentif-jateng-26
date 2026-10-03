const APPS_SCRIPT_ENDPOINTS = Object.freeze({
    ajuan: 'https://script.google.com/macros/s/AKfycbxBgTghuwIQoBqpDNJzAVDXRVUHQIXIl323Gs9eaAYSEDVbdzkJfUzStKjct18K_3A0wA/exec',
    berjalan: 'https://script.google.com/macros/s/AKfycby9AImHXGYpzR5MYRVyugOvAbW1_l56JlTZtv6yG6dHLYeRcrS4riNxvxnrq9ZatW9s/exec'
});

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
    const endpoint = APPS_SCRIPT_ENDPOINTS[workflow];

    if (!endpoint) return jsonResponse(400, { ok: false, error: 'bad_request' });

    let url = endpoint;
    const options = { method: event.httpMethod, redirect: 'follow' };
    if (event.httpMethod === 'GET') {
        if (event.queryStringParameters?.action !== 'monitor') {
            return jsonResponse(400, { ok: false, error: 'bad_request' });
        }
        url += '?action=monitor';
    } else if (event.httpMethod === 'POST') {
        const parameters = postParameters;
        const action = parameters.get('action');
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
    } else {
        return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
    }

    try {
        const upstream = await fetch(url, options);
        const responseText = await upstream.text();
        if (responseText.length > 2_000_000) {
            return jsonResponse(502, { ok: false, error: 'upstream_response_too_large' });
        }
        const payload = JSON.parse(responseText);
        if (!payload || typeof payload.ok !== 'boolean') throw new Error('Invalid upstream response.');
        return jsonResponse(upstream.ok ? 200 : 502, payload);
    } catch (error) {
        console.error('Apps Script proxy request failed:', error.message);
        return jsonResponse(502, { ok: false, error: 'upstream_unavailable' });
    }
};
