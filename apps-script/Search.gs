// =======================================================================
// SEARCH API (web app) — tambahkan sebagai file baru di project Apps Script
// yang sama. Memakai SPREADSHEET_ID yang sudah ada di file kode utama.
//
// Deploy: Deploy > Manage deployments > Edit > New version
//   Execute as : Me
//   Who has access : Anyone
// Setelah itu spreadsheet boleh diatur ke "Restricted" (private).
// =======================================================================

const SEARCH_SHEET_NAME = 'Data Gabungan';
const SEARCH_FIRST_ROW = 2;
const SEARCH_MAX_QUERY_LENGTH = 100;
const SEARCH_MAX_RESULTS = 30;
const CAPTCHA_TTL_SECONDS = 120;
const CAPTCHA_MIN_SOLVE_MS = 1000; // jawaban yang masuk lebih cepat dianggap bot
// Pembatasan global (Apps Script anonim tidak punya identitas klien).
const RATE_LIMIT_CAPTCHA_PER_MINUTE = 60;
const RATE_LIMIT_SEARCH_PER_MINUTE = 60;
const RATE_LIMIT_FAILED_CAPTCHA_PER_MINUTE = 30; // mencegah tebak-tebakan jawaban


function doGet(e) {
  const params = (e && e.parameter) || {};
  try {
    if (params.action === 'captcha') {
      if (bumpCounter_('captcha') > RATE_LIMIT_CAPTCHA_PER_MINUTE) return jsonResponse_({ ok: false, error: 'rate_limited' });
      return jsonResponse_(createCaptcha_());
    }
    if (params.action === 'search') {
      if (readCounter_('fail') >= RATE_LIMIT_FAILED_CAPTCHA_PER_MINUTE ||
          bumpCounter_('search') > RATE_LIMIT_SEARCH_PER_MINUTE) {
        return jsonResponse_({ ok: false, error: 'rate_limited' });
      }
      return jsonResponse_(searchTeachers_(params));
    }
    return jsonResponse_({ ok: false, error: 'bad_request' });
  } catch (error) {
    Logger.log('doGet error: ' + error);
    return jsonResponse_({ ok: false, error: 'server_error' });
  }
}


function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}


function counterKey_(name) {
  return 'rate_' + name + '_' + Math.floor(Date.now() / 60000);
}


function bumpCounter_(name) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    const key = counterKey_(name);
    const count = Number(cache.get(key) || 0) + 1;
    cache.put(key, String(count), 120);
    return count;
  } finally {
    lock.releaseLock();
  }
}


function readCounter_(name) {
  return Number(CacheService.getScriptCache().get(counterKey_(name)) || 0);
}


// CAPTCHA matematika: jawaban hanya disimpan di server, klien hanya menerima gambar.
function createCaptcha_() {
  const first = Math.floor(Math.random() * 9) + 1;
  const second = Math.floor(Math.random() * 9) + 1;
  const subtract = Math.random() < 0.4 && first >= second;
  const answer = subtract ? first - second : first + second;
  const expression = first + (subtract ? ' - ' : ' + ') + second + ' = ?';

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(
    'captcha_' + token,
    JSON.stringify({ a: String(answer), t: Date.now() }),
    CAPTCHA_TTL_SECONDS
  );

  const svg = buildCaptchaSvg_(expression);
  return {
    ok: true,
    token: token,
    image: 'data:image/svg+xml;base64,' + Utilities.base64Encode(svg, Utilities.Charset.UTF_8)
  };
}


function buildCaptchaSvg_(text) {
  const width = 280;
  const height = 80;
  const parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">',
    '<rect width="100%" height="100%" fill="#eff6ff"/>'];

  for (let i = 0; i < 6; i++) {
    parts.push('<line x1="' + rand_(0, width) + '" y1="' + rand_(0, height) + '" x2="' + rand_(0, width) + '" y2="' + rand_(0, height) +
      '" stroke="#93c5fd" stroke-width="1.5" opacity="0.7"/>');
  }
  for (let i = 0; i < 30; i++) {
    parts.push('<circle cx="' + rand_(0, width) + '" cy="' + rand_(0, height) + '" r="' + (1 + Math.random() * 2).toFixed(1) + '" fill="#bfdbfe"/>');
  }

  const step = 26;
  const startX = (width - (text.length - 1) * step) / 2;
  for (let i = 0; i < text.length; i++) {
    if (text.charAt(i) === ' ') continue;
    const x = startX + i * step;
    const y = height / 2 + rand_(-6, 6);
    const rotation = rand_(-14, 14);
    parts.push('<text x="' + x + '" y="' + y + '" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#1e3a8a" ' +
      'text-anchor="middle" dominant-baseline="middle" transform="rotate(' + rotation + ' ' + x + ' ' + y + ')">' +
      text.charAt(i) + '</text>');
  }

  parts.push('</svg>');
  return parts.join('');
}


function rand_(min, max) {
  return Math.round(min + Math.random() * (max - min));
}


// Token CAPTCHA sekali pakai: dihapus dari cache apa pun hasil jawabannya.
// Mengembalikan jawaban yang terverifikasi, atau null jika gagal.
function consumeCaptcha_(token, answer) {
  if (!/^[0-9a-f-]{36}$/.test(token || '')) return null;
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    const key = 'captcha_' + token;
    const stored = cache.get(key);
    if (stored === null) return null;
    cache.remove(key);

    const entry = JSON.parse(stored);
    if (Date.now() - entry.t < CAPTCHA_MIN_SOLVE_MS) return null;
    const given = String(answer || '').trim();
    return given === entry.a ? given : null;
  } finally {
    lock.releaseLock();
  }
}


function normalizeText_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}


function searchTeachers_(params) {
  const query = normalizeText_(params.q);
  const kabKota = normalizeText_(params.kab);

  if ((!query && !kabKota) || query.length > SEARCH_MAX_QUERY_LENGTH || kabKota.length > 50) {
    return { ok: false, error: 'invalid_query' };
  }
  if (consumeCaptcha_(params.token, params.answer) === null) {
    bumpCounter_('fail');
    return { ok: false, error: 'captcha_failed' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SEARCH_SHEET_NAME);
  if (!sheet) return { ok: false, error: 'server_error' };

  const lastRow = sheet.getLastRow();
  const results = [];
  let total = 0;

  if (lastRow >= SEARCH_FIRST_ROW) {
    const rows = sheet.getRange(SEARCH_FIRST_ROW, 1, lastRow - SEARCH_FIRST_ROW + 1, 3).getValues();
    for (let i = 0; i < rows.length; i++) {
      const name = String(rows[i][0] || '').trim();
      if (!name || normalizeText_(name).indexOf(query) === -1) continue;
      if (kabKota && normalizeText_(rows[i][2]) !== kabKota) continue;

      total++;
      if (results.length < SEARCH_MAX_RESULTS) {
        results.push({
          name: name,
          satminkal: String(rows[i][1] || '').trim(),
          kabKota: String(rows[i][2] || '').trim()
        });
      }
    }
  }

  return { ok: true, total: total, results: results, truncated: total > results.length };
}
