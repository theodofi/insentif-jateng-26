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
const SEARCH_ROWS_CACHE_KEY = 'teacher_search_rows_v1';
const SEARCH_ROWS_CACHE_TTL_SECONDS = 300;
const SEARCH_ROWS_CACHE_MAX_BYTES = 90000;
// Limit applies to a browser profile's stored random ID, not hardware identity.
const SEARCHES_PER_DEVICE_PER_DAY = 3;
const SEARCH_DAILY_QUOTA_PREFIX = 'search_limit_';
const SEARCH_DAILY_CLEANUP_KEY = 'search_limit_cleanup_date';
const SEARCH_ADMIN_EMAILS = [
  'theo.hasiholan@gmail.com',
  'pendidikankristenjateng@gmail.com',
  'asasetiabekti@gmail.com'
];
const SEARCH_GOOGLE_OAUTH_CLIENT_ID = '933605353737-828jhnli7ro1f8off5258kgvqtbf5ldt.apps.googleusercontent.com';
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
      if (!isValidDeviceId_(params.device)) return jsonResponse_({ ok: false, error: 'invalid_device' });
      const remaining = getDailySearchesRemaining_(params.device);
      if (remaining === 0) return jsonResponse_({ ok: false, error: 'daily_limit' });
      const challenge = createCaptcha_(params.device);
      challenge.remaining = remaining;
      return jsonResponse_(challenge);
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

function doPost(e) {
  const params = (e && e.parameter) || {};
  if (!['admin-search', 'admin-summary'].includes(params.action)) {
    return jsonResponse_({ ok: false, error: 'bad_request' });
  }

  let authorized;
  try {
    authorized = isSearchAdmin_(params.credential);
  } catch (error) {
    Logger.log('Admin teacher search authentication failed: ' + error);
    return jsonResponse_({ ok: false, error: 'auth_verification_failed' });
  }
  if (!authorized) return jsonResponse_({ ok: false, error: 'forbidden' });

  try {
    if (bumpCounter_('search') > RATE_LIMIT_SEARCH_PER_MINUTE) {
      return jsonResponse_({ ok: false, error: 'rate_limited' });
    }
    if (params.action === 'admin-summary') {
      return jsonResponse_(getTeacherSummary_());
    }
    return jsonResponse_(searchTeachers_(params, true));
  } catch (error) {
    Logger.log('Admin teacher search error: ' + error);
    return jsonResponse_({ ok: false, error: 'server_error' });
  }
}

function isSearchAdmin_(credential) {
  if (typeof credential !== 'string' || !credential || credential.length > 8192) return false;
  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential),
    { muteHttpExceptions: true }
  );
  if (response.getResponseCode() !== 200) return false;

  const claims = JSON.parse(response.getContentText());
  const email = String(claims.email || '').trim().toLowerCase();
  return claims.aud === SEARCH_GOOGLE_OAUTH_CLIENT_ID &&
    String(claims.email_verified) === 'true' &&
    Number(claims.exp || 0) > Math.floor(Date.now() / 1000) &&
    SEARCH_ADMIN_EMAILS.some(admin => admin.toLowerCase() === email);
}

function authorizeSearchGoogleAuth() {
  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=invalid',
    { muteHttpExceptions: true }
  );
  const status = response.getResponseCode();
  Logger.log('Google tokeninfo permission check returned HTTP ' + status);
  return status;
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


function isValidDeviceId_(deviceId) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId || '');
}


function searchQuotaDate_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd');
}


function searchQuotaKey_(deviceId, date) {
  return SEARCH_DAILY_QUOTA_PREFIX + date + '_' + hashDeviceId_(deviceId);
}


function hashDeviceId_(deviceId) {
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    deviceId,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(hash).replace(/=+$/, '');
}


function getDailySearchesRemaining_(deviceId) {
  const date = searchQuotaDate_();
  const used = Number(PropertiesService.getScriptProperties().getProperty(searchQuotaKey_(deviceId, date)) || 0);
  return Math.max(0, SEARCHES_PER_DEVICE_PER_DAY - used);
}


function consumeDailySearch_(deviceId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const today = searchQuotaDate_();
    if (properties.getProperty(SEARCH_DAILY_CLEANUP_KEY) !== today) {
      const allProperties = properties.getProperties();
      Object.keys(allProperties).forEach(function (key) {
        if (key.indexOf(SEARCH_DAILY_QUOTA_PREFIX) === 0 && key.indexOf(SEARCH_DAILY_QUOTA_PREFIX + today + '_') !== 0) {
          properties.deleteProperty(key);
        }
      });
      properties.setProperty(SEARCH_DAILY_CLEANUP_KEY, today);
    }

    const key = searchQuotaKey_(deviceId, today);
    const used = Number(properties.getProperty(key) || 0);
    if (used >= SEARCHES_PER_DEVICE_PER_DAY) return null;

    const remaining = SEARCHES_PER_DEVICE_PER_DAY - used - 1;
    properties.setProperty(key, String(used + 1));
    return remaining;
  } finally {
    lock.releaseLock();
  }
}


// CAPTCHA matematika: jawaban hanya disimpan di server, klien hanya menerima gambar.
function createCaptcha_(deviceId) {
  const first = Math.floor(Math.random() * 9) + 1;
  const second = Math.floor(Math.random() * 9) + 1;
  const subtract = Math.random() < 0.4 && first >= second;
  const answer = subtract ? first - second : first + second;
  const expression = first + (subtract ? ' - ' : ' + ') + second + ' = ?';

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(
    'captcha_' + token,
    JSON.stringify({ a: String(answer), t: Date.now(), d: hashDeviceId_(deviceId) }),
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
function consumeCaptcha_(token, answer, deviceId) {
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
    if (entry.d !== hashDeviceId_(deviceId)) return null;
    const given = String(answer || '').trim();
    return given === entry.a ? given : null;
  } finally {
    lock.releaseLock();
  }
}


function normalizeText_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getTeacherSummary_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SEARCH_SHEET_NAME);
  if (!sheet) throw new Error('Teacher search sheet not found.');

  const teachers = getSearchRows_(sheet).filter(row => row[0]);
  const regions = new Set(
    teachers.map(row => normalizeText_(row[2]).replace(/[^a-z0-9]/g, '')).filter(Boolean)
  );
  return {
    ok: true,
    teacherCount: teachers.length,
    kabKotaCount: regions.size
  };
}


function getSearchRows_(sheet) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(SEARCH_ROWS_CACHE_KEY);
  if (cached !== null) {
    try {
      const rows = JSON.parse(cached);
      if (Array.isArray(rows)) return rows;
      Logger.log('Search row cache had an invalid format; reloading the spreadsheet.');
    } catch (error) {
      Logger.log('Search row cache could not be parsed; reloading the spreadsheet: ' + error);
    }
    cache.remove(SEARCH_ROWS_CACHE_KEY);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < SEARCH_FIRST_ROW) return [];

  const rows = sheet
    .getRange(SEARCH_FIRST_ROW, 1, lastRow - SEARCH_FIRST_ROW + 1, 3)
    .getValues()
    .map(function (row) {
      return [
        String(row[0] || '').trim(),
        String(row[1] || '').trim(),
        String(row[2] || '').trim()
      ];
    });
  const serialized = JSON.stringify(rows);
  if (Utilities.newBlob(serialized).getBytes().length <= SEARCH_ROWS_CACHE_MAX_BYTES) {
    try {
      cache.put(SEARCH_ROWS_CACHE_KEY, serialized, SEARCH_ROWS_CACHE_TTL_SECONDS);
    } catch (error) {
      Logger.log('Could not cache search rows; continuing with the spreadsheet data: ' + error);
    }
  }
  return rows;
}


function searchTeachers_(params, isAdmin) {
  const query = normalizeText_(params.q);
  const kabKota = normalizeText_(params.kab);

  if (!isAdmin && !isValidDeviceId_(params.device)) {
    return { ok: false, error: 'invalid_device' };
  }
  if ((!query && !kabKota) || query.length > SEARCH_MAX_QUERY_LENGTH || kabKota.length > 50) {
    return { ok: false, error: 'invalid_query' };
  }
  if (!isAdmin && consumeCaptcha_(params.token, params.answer, params.device) === null) {
    bumpCounter_('fail');
    return { ok: false, error: 'captcha_failed' };
  }

  let remaining = null;
  if (!isAdmin) {
    remaining = consumeDailySearch_(params.device);
    if (remaining === null) return { ok: false, error: 'daily_limit' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SEARCH_SHEET_NAME);
  if (!sheet) return { ok: false, error: 'server_error' };

  const rows = getSearchRows_(sheet);
  const results = [];
  let total = 0;

  for (let i = 0; i < rows.length; i++) {
    const name = rows[i][0];
    if (!name || normalizeText_(name).indexOf(query) === -1) continue;
    if (kabKota && normalizeText_(rows[i][2]) !== kabKota) continue;

    total++;
    if (results.length < SEARCH_MAX_RESULTS) {
      results.push({
        name: name,
        satminkal: rows[i][1],
        kabKota: rows[i][2]
      });
    }
  }

  return {
    ok: true,
    total: total,
    results: results,
    truncated: total > results.length,
    remaining: remaining
  };
}
