const SPREADSHEET_ID = '1sA9jUZVSDbnaT9XKnsRwn6ST-mBOOW9jAju0B9UXDFA'; 
const TEMPLATE_ID = '1OAt-KFZSJEba8KlPH0KmtHEAiccQPIEVWMBQLJDWybk';
const FOLDER_ID = '1i0cWXWApEauDcrOfV_r5s-XwTM6QQCPT';
const FOLDER_LAMPIRAN_ID = '177wVXU9rysjosEndel-eubR8rNPh7IIOAmHvTvD4c1dc5nBa3sJAK9vSfob4BLuRky5EpT3F'; 

const STATUS_PRINT = 'Sudah Print';
const PUBLIC_MONITOR_CACHE_KEY = 'public_monitor_snapshot_v1';
const PUBLIC_MONITOR_CACHE_TTL_SECONDS = 30;
const SHEET_1 = 'Form Responses 1';
const SHEET_2 = 'Status Pengumpulan';



const EMAIL_ADMIN = [
  "theo.hasiholan@gmail.com", 
  "pendidikankristenjateng@gmail.com",
  "asasetiabekti@gmail.com"
];

const daftarBerkas = [
  { id: "cover", labelPendek: "Cover", labelPanjang: "Cover" },
  { id: "biodata", labelPendek: "Biodata", labelPanjang: "Identitas Diri (Biodata)" },
  { id: "permohonan", labelPendek: "Surat Permohonan", labelPanjang: "Surat Permohonan Kepada Kepala Kantor Wilayah Kementerian Agama Provinsi Jawa Tengah u.p. Pembimas Kristen (Tertanggal di awal tahun, hari kerja)" },
  { id: "sk_pengangkatan", labelPendek: "Fotokopi Sah SK Pengangkatan", labelPanjang: "Fotokopi Sah SK Pengangkatan Sebagai Guru Bukan ASN Pendidikan Agama Kristen" },
  { id: "npsn", labelPendek: "NPSN", labelPanjang: "Fotokopi Sah Sertifikat NPSN / Surat Keterangan NPSN dari Kepala Satuan Pendidikan" },
  { id: "skpbm", labelPendek: "SKPBM", labelPanjang: "Fotokopi Sah SKPBM (Surat Keputusan Pembagian Tugas Belajar Mengajar)" },
  { id: "jadwal", labelPendek: "Jadwal Pembelajaran", labelPanjang: "Fotokopi Sah Jadwal Pembelajaran" },
  { id: "ijazah", labelPendek: "Ijazah Pendidikan", labelPanjang: "Fotokopi Sah Ijazah Pendidikan Terakhir (Minimal S1 linear dengan Pendidikan Agama Kristen dan Teologi)" },
  { id: "pernyataan", labelPendek: "Surat Pernyataan", labelPanjang: "Surat Pernyataan belum memiliki Sertifikat Pendidik dan Guru Bukan ASN" },
  { id: "ktp", labelPendek: "KTP", labelPanjang: "Fotokopi Kartu Tanda Penduduk (KTP)" },
  { id: "kk", labelPendek: "KK", labelPanjang: "Fotokopi Kartu Keluarga (KK)" },
  { id: "npwp", labelPendek: "NPWP", labelPanjang: "Fotokopi NPWP" },
  { id: "rekening", labelPendek: "Fotokopi Buku Rekening", labelPanjang: "Fotokopi Buku Rekening" }
];

// ==========================================
// MENU & UI TRIGGER
// ==========================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Kelola')
    .addItem('🖨️ Cetak PDF', 'klikDariSpreadsheet')
    .addItem('🧹 Bersihkan Duplikat & File Baru', 'jalankanPembersihanManual')
    .addItem('🗑️ Bersihkan File Sisa (Baris Sudah Dihapus)', 'jalankanPembersihanOrphaned')
    .addToUi();
}

const alertUi = (msg) => SpreadsheetApp.getUi().alert(msg);
function jalankanPembersihanManual() { alertUi(cleanupDuplicateSubmissions()); }
function jalankanPembersihanOrphaned() { alertUi(cleanupOrphanedFiles()); }
function klikDariSpreadsheet() { alertUi(prosesCetakPDF()); }

// ==========================================
// HELPER & UTILITIES
// ==========================================
function getSheet(name) { return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name); }

function getColIdx(headers, name) { return headers.findIndex(h => h.toString().toLowerCase().includes(name.toLowerCase())); }
function getVal(row, idx) { return idx > -1 ? (row[idx] || '').toString().trim() : ''; }

function buatPDFDariTemplate(nama, satminkal, kabkota, berkas, tanggal, catatan, subfolder) {
  const template = DriveApp.getFileById(TEMPLATE_ID);
  const newFile = template.makeCopy(`Temp Doc - ${nama}`, subfolder);
  const doc = DocumentApp.openById(newFile.getId());
  const body = doc.getBody();

  body.replaceText('{{NAMA}}', nama);
  body.replaceText('{{SATMINKAL}}', satminkal);
  body.replaceText('{{KAB_KOTA}}', kabkota);
  body.replaceText('{{TANGGAL}}', tanggal);
  body.replaceText('{{CAT}}', catatan);

  daftarBerkas.forEach((b, j) => {
    const no = j + 1;
    const cek = berkas.includes(b);
    body.replaceText(`{{A_${no}}}`, cek ? '✔' : '');
    body.replaceText(`{{T_${no}}}`, cek ? '' : '✔');
  });

  doc.saveAndClose();
  const pdf = subfolder.createFile(newFile.getAs(MimeType.PDF)).setName(`Daftar_Periksa_${nama}_${kabkota}.pdf`);
  newFile.setTrashed(true);
  return pdf;
}

function createSubfolder(prefixFolderId) {
  const time = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy_HH.mm");
  return DriveApp.getFolderById(prefixFolderId).createFolder(`Proses Berkas Baru - ${time}`);
}

function cekJumlahBaris() { return getSheet(SHEET_1).getLastRow(); }

// ==========================================
// CETAK PDF & BATCH
// ==========================================
function prosesCetakPDF() {
  const sheet = getSheet(SHEET_1);
  if (!sheet) return 'Error: Sheet Form Responses 1 tidak ditemukan.';
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = { 
    n: getColIdx(headers, 'Nama'), 
    s: getColIdx(headers, 'Satminkal / Sekolah Induk'), 
    k: getColIdx(headers, 'Kab/Kota Satminkal/Sekolah'), 
    b: getColIdx(headers, 'Berkas yang sudah dilengkapi'), 
    stPrint: getColIdx(headers, 'Status Print'), 
    cat: getColIdx(headers, 'Catatan'), 
    ts: getColIdx(headers, 'Timestamp')
  };

  let subfolder = null, count = 0;
  for (let i = 1; i < data.length; i++) {
    if (getVal(data[i], idx.stPrint).toLowerCase() === STATUS_PRINT.toLowerCase() || getVal(data[i], idx.cat).toLowerCase() !== 'lengkap') continue;
    
    const nama = getVal(data[i], idx.n);
    if (!nama) continue;
    if (!subfolder) subfolder = createSubfolder(FOLDER_ID);

    let tsRaw = data[i][idx.ts];
    let tgl = (tsRaw instanceof Date) ? Utilities.formatDate(tsRaw, Session.getScriptTimeZone(), "dd/MM/yyyy") : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

    buatPDFDariTemplate(nama, getVal(data[i], idx.s), getVal(data[i], idx.k), getVal(data[i], idx.b), tgl, cat, subfolder);
    sheet.getRange(i + 1, idx.stPrint + 1).setValue(STATUS_PRINT);
    count++;
  }
  return count > 0 ? `Proses selesai berhasil membuat ${count} berkas PDF baru` : 'Tidak ada data Lengkap baru untuk diproses';
}

function inisialisasiCetakBatch() {
  const sheet = getSheet(SHEET_1);
  if (!sheet) return { error: 'Sheet tidak ditemukan' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const barisTarget = data.map((row, i) => i > 0 && 
      getVal(row, getColIdx(headers, 'Status Print')).toLowerCase() !== STATUS_PRINT.toLowerCase() && 
      getVal(row, getColIdx(headers, 'Catatan')).toLowerCase() === 'lengkap' ? i + 1 : null).filter(Boolean);

  return barisTarget.length === 0 ? { total: 0, barisTarget: [] } : 
    { total: barisTarget.length, barisTarget, subfolderId: createSubfolder(FOLDER_ID).getId() };
}

function prosesSatuBarisPDFWeb(rowNumber, subfolderId) {
  const sheet = getSheet(SHEET_1);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const gV = (name) => getVal(row, getColIdx(headers, name));

  if (!gV('Nama')) return { success: false, message: 'Nama kosong' };
  
  let tsRaw = row[getColIdx(headers, 'Timestamp')];
  let tgl = (tsRaw instanceof Date) ? Utilities.formatDate(tsRaw, Session.getScriptTimeZone(), "dd/MM/yyyy") : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

  const pdf = buatPDFDariTemplate(gV('Nama'), gV('Satminkal / Sekolah Induk'), gV('Kab/Kota Satminkal/Sekolah'), gV('Berkas yang sudah dilengkapi'), tgl, gV('Catatan'), DriveApp.getFolderById(subfolderId));
  
  const idxPrint = getColIdx(headers, 'Status Print');
  if (idxPrint > -1) sheet.getRange(rowNumber, idxPrint + 1).setValue(STATUS_PRINT);

  return { success: true, fileInfo: { 
    nama: pdf.getName(), url: pdf.getUrl(), waktuMentah: pdf.getDateCreated().getTime(), 
    waktuFormat: Utilities.formatDate(pdf.getDateCreated(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") 
  }};
}

// ==========================================
// PUBLIC AND ADMIN API (UI is hosted by Netlify)
// ==========================================
const GOOGLE_OAUTH_CLIENT_ID = '933605353737-828jhnli7ro1f8off5258kgvqtbf5ldt.apps.googleusercontent.com';
const ADMIN_TOKEN_CACHE_PREFIX = 'verified_admin_';

function apiResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (!e || !e.parameter || e.parameter.action !== 'monitor') {
    return apiResponse_({ ok: false, error: 'bad_request' });
  }
  const params = e.parameter;
  if ((params.page && !/^[1-9]\d*$/.test(params.page)) ||
      (params.pageSize && !/^(?:[1-9]|[1-4]\d|50)$/.test(params.pageSize)) ||
      (params.q && params.q.length > 100) ||
      (params.status && !['sudah', 'belum', 'perbaikan', 'catatan'].includes(params.status))) {
    return apiResponse_({ ok: false, error: 'bad_request' });
  }
  try {
    return apiResponse_({ ok: true, data: ambilDataSheetPengumpulanIndex2(params) });
  } catch (error) {
    Logger.log('Public monitor API error: ' + error);
    return apiResponse_({ ok: false, error: 'server_error' });
  }
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  try {
    let email;
    try {
      email = verifyAdminCredential_(params.credential);
    } catch (error) {
      Logger.log('Google ID token verification failed: ' + error);
      return apiResponse_({ ok: false, error: 'auth_verification_failed' });
    }
    if (!email) return apiResponse_({ ok: false, error: 'forbidden' });
    if (params.action === 'auth') return apiResponse_({ ok: true, email: email });
    if (params.action !== 'admin') return apiResponse_({ ok: false, error: 'bad_request' });

    const args = JSON.parse(params.args || '[]');
    if (!Array.isArray(args)) return apiResponse_({ ok: false, error: 'bad_request' });
    const result = executeAdminApi_(params.method, args);
    if (typeof result === 'string' && /^(Error|Gagal):/.test(result)) {
      return apiResponse_({ ok: false, error: 'operation_failed' });
    }
    return apiResponse_({ ok: true, data: result });
  } catch (error) {
    Logger.log('Admin API error: ' + error);
    return apiResponse_({ ok: false, error: 'server_error' });
  }
}

function authorizeGoogleAuth() {
  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=invalid',
    { muteHttpExceptions: true }
  );
  const status = response.getResponseCode();
  Logger.log('Google tokeninfo permission check returned HTTP ' + status);
  return status;
}

function verifyAdminCredential_(credential) {
  if (GOOGLE_OAUTH_CLIENT_ID.indexOf('REPLACE_') === 0 ||
      typeof credential !== 'string' || credential.length > 8192) return null;

  const tokenHash = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, credential)
  ).replace(/=+$/, '');
  const cache = CacheService.getScriptCache();
  const cachedEmail = cache.get(ADMIN_TOKEN_CACHE_PREFIX + tokenHash);
  if (cachedEmail && EMAIL_ADMIN.some(email => email.toLowerCase() === cachedEmail)) return cachedEmail;

  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) return null;

  const claims = JSON.parse(response.getContentText());
  const email = String(claims.email || '').trim().toLowerCase();
  const expiresAt = Number(claims.exp || 0);
  if (claims.aud !== GOOGLE_OAUTH_CLIENT_ID ||
      String(claims.email_verified) !== 'true' ||
      expiresAt <= Math.floor(Date.now() / 1000) ||
      !EMAIL_ADMIN.some(allowed => allowed.toLowerCase() === email)) return null;

  cache.put(ADMIN_TOKEN_CACHE_PREFIX + tokenHash, email, Math.min(1800, expiresAt - Math.floor(Date.now() / 1000)));
  return email;
}

function executeAdminApi_(method, args) {
  switch (method) {
    case 'ambilDataAntreanAdmin':
      if (args.length !== 0) throw new Error('Invalid arguments.');
      return ambilDataAntreanAdmin();
    case 'ambilDaftarPDF':
      if (args.length !== 0) throw new Error('Invalid arguments.');
      return ambilDaftarPDF();
    case 'cekJumlahBaris':
      if (args.length !== 0) throw new Error('Invalid arguments.');
      return cekJumlahBaris();
    case 'inisialisasiCetakBatch':
      if (args.length !== 0) throw new Error('Invalid arguments.');
      return inisialisasiCetakBatch();
    case 'simpanStatusVerval':
      if (args.length !== 3 || !Number.isInteger(Number(args[0])) || Number(args[0]) < 2) throw new Error('Invalid arguments.');
      return simpanStatusVerval(Number(args[0]), String(args[1] || ''), String(args[2] || ''));
    case 'prosesSatuBarisPDFWeb':
      if (args.length !== 2 ||
          !Number.isInteger(Number(args[0])) || Number(args[0]) < 2 ||
          typeof args[1] !== 'string' || !/^[A-Za-z0-9_-]{15,}$/.test(args[1])) throw new Error('Invalid arguments.');
      return prosesSatuBarisPDFWeb(Number(args[0]), args[1]);
    default:
      throw new Error('Unknown admin API operation.');
  }
}

// ==========================================
// PROSES PDF DI WEB
// ==========================================

function ambilDaftarPDF() {
  const fileList = [];
  const scan = (folder) => {
    const files = folder.getFilesByType(MimeType.PDF);
    while (files.hasNext()) {
      const f = files.next();
      fileList.push({ nama: f.getName(), url: f.getUrl(), waktuMentah: f.getDateCreated().getTime(), 
                      waktuFormat: Utilities.formatDate(f.getDateCreated(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") });
    }
    const sub = folder.getFolders();
    while (sub.hasNext()) scan(sub.next());
  };
  scan(DriveApp.getFolderById(FOLDER_ID));
  return fileList.sort((a, b) => b.waktuMentah - a.waktuMentah);
}

// ==========================================
// VERVAL & PENGUMPULAN DATA
// ==========================================
function getMapResponses() {
  const sheet = getSheet(SHEET_1);
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  
  const idx = { 
    n: getColIdx(h, 'Nama'), 
    k: getColIdx(h, 'Kab/Kota Satminkal/Sekolah'),
    sm: getColIdx(h, 'Satminkal / Sekolah Induk'),
    b: getColIdx(h, 'Berkas yang sudah dilengkapi'),
    cat: getColIdx(h, 'Status Perbaikan') > -1 ? getColIdx(h, 'Status Perbaikan') : getColIdx(h, 'Catatan'),
    stPrint: getColIdx(h, 'Status Print'), 
    fileDoc: getColIdx(h, 'Upload Dokumen')
  };

  return data.slice(1).reduce((map, row, j) => {
    const nama = getVal(row, idx.n);
    if (nama) {
      const namaKey = nama.toLowerCase();
      map[namaKey] = { 
        barisAsli: j + 2, 
        nama: nama,
        kabkota: getVal(row, idx.k),
        satminkal: getVal(row, idx.sm),
        berkas: getVal(row, idx.b),
        catatan: getVal(row, idx.cat) || 'Belum dicek', 
        statusPrint: getVal(row, idx.stPrint), 
        linkBerkas: getVal(row, idx.fileDoc), 
        sudahKumpul: true 
      };
    }
    return map;
  }, {});
}

function ambilDataAntreanAdmin() {
  const mapRes = getMapResponses();
  const sheet2 = getSheet(SHEET_2);
  
  // Jika Sheet 2 (Status Pengumpulan) kosong/belum diisi data master,
  // maka otomatis langsung ambil & tampilkan data dari Sheet 1 (Form Responses).
  if (!sheet2 || sheet2.getLastRow() <= 1) {
    return Object.values(mapRes).map((res, index) => ({
      no: index + 1,
      barisAsli: res.barisAsli,
      nama: res.nama,
      kabkota: res.kabkota || '-',
      satminkal: res.satminkal || '-',
      berkas: res.berkas || '', // <--- PASTIKAN INI ADA
      keterangan: 'Sudah Mengumpulkan',
      perbaikan: res.catatan, 
      statusPrint: res.statusPrint,
      linkBerkas: res.linkBerkas
    }));
  }

  // Jika Sheet 2 sudah ada data master
  const data2 = sheet2.getDataRange().getValues();
  const h2 = data2[0];

  return data2.slice(1).reduce((acc, row) => {
    const nama = getVal(row, getColIdx(h2, 'nama'));
    if (nama) {
      const res = mapRes[nama.toLowerCase()] || { 
        barisAsli: 0, 
        catatan: 'Belum dicek', 
        statusPrint: '', 
        linkBerkas: '',
        berkas: '' 
      };
      acc.push({
        no: acc.length + 1, 
        barisAsli: res.barisAsli, 
        nama, 
        kabkota: getVal(row, getColIdx(h2, 'kab/kota')) || res.kabkota || '-', 
        satminkal: getVal(row, getColIdx(h2, 'satminkal')) || res.satminkal || '-',
        berkas: res.berkas || '', // <--- DAN INI ADA
        keterangan: getVal(row, getColIdx(h2, 'status')) || (res.barisAsli > 0 ? 'Sudah Mengumpulkan' : 'Belum Mengumpulkan'),
        perbaikan: res.catatan,
        statusPrint: res.statusPrint,
        linkBerkas: res.linkBerkas
      });
    }
    return acc;
  }, []);
}

function simpanStatusVerval(baris, statusBaru, berkasBaru) {
  try {
    const sheet = getSheet(SHEET_1);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Cari indeks kolom
    const idxCatatan = getColIdx(headers, 'Status Perbaikan') > -1 ? getColIdx(headers, 'Status Perbaikan') : getColIdx(headers, 'Catatan');
    const idxBerkas = getColIdx(headers, 'Berkas yang sudah dilengkapi');
    
    if (idxCatatan > -1) {
      // 1. Simpan Status Perbaikan/Catatan
      sheet.getRange(baris, idxCatatan + 1).setValue(statusBaru);
      
      // 2. Simpan Update Checklist Berkas (jika kolomnya ada)
      if (idxBerkas > -1 && berkasBaru !== undefined) {
        sheet.getRange(baris, idxBerkas + 1).setValue(berkasBaru);
      }
      clearPublicMonitorCache_();
      return "Berhasil";
    }
    return "Gagal: Kolom 'Status Perbaikan' atau 'Catatan' tidak ditemukan.";
  } catch (e) { return "Error: " + e.message; }
}

function ambilDataSheetPengumpulanIndex2(options) {
  const snapshot = getPublicMonitorSnapshot_();
  const settings = options || {};
  const requestedPage = Number(settings.page);
  const requestedPageSize = Number(settings.pageSize);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0
    ? Math.min(requestedPageSize, 50)
    : 12;
  const query = String(settings.q || '').trim().toLowerCase();
  const status = String(settings.status || '');
  const dataList = snapshot.dataList;
  const filtered = dataList.filter((row) => {
    const textMatches = !query || [row.nama, row.kabkota, row.satminkal]
      .some((value) => String(value || '').toLowerCase().includes(query));
    if (!textMatches) return false;
    const submitted = isPublicMonitorSubmitted_(row);
    if (status === 'sudah') return submitted;
    if (status === 'belum') return !submitted;
    if (status === 'perbaikan') return isPublicMonitorCorrection_(row);
    if (status === 'catatan') return String(row.perbaikan || '').toLowerCase().includes('catatan khusus:');
    return true;
  });
  const correctionCount = dataList.filter((row) => {
    const correction = String(row.perbaikan || '').trim().toLowerCase();
    return correction.length > 0 && correction !== 'belum dicek' &&
      !/\blengkap\b/.test(correction) && !correction.includes('sudah print');
  }).length;
  const submittedCount = dataList.filter(isPublicMonitorSubmitted_).length;
  return {
    dataList: filtered.slice((page - 1) * pageSize, page * pageSize),
    totalCount: dataList.length,
    filteredCount: filtered.length,
    page,
    pageSize,
    submittedCount,
    pendingCount: dataList.length - submittedCount,
    correctionCount,
    totalPerbaikan: snapshot.totalPerbaikan,
    totalLengkap: snapshot.totalLengkap,
    totalBelumDicek: snapshot.totalBelumDicek
  };
}

function getPublicMonitorSnapshot_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(PUBLIC_MONITOR_CACHE_KEY);
  if (cached) {
    try {
      const snapshot = JSON.parse(cached);
      if (snapshot && Array.isArray(snapshot.dataList)) return snapshot;
    } catch (error) {
      cache.remove(PUBLIC_MONITOR_CACHE_KEY);
    }
  }

  const sheet2 = getSheet(SHEET_2);
  if (!sheet2) return { dataList: [], totalPerbaikan: 0, totalLengkap: 0, totalBelumDicek: 0 };
  const h2 = sheet2.getRange(1, 1, 1, sheet2.getLastColumn()).getValues()[0];
  const indexes = {
    nama: getColIdx(h2, 'nama'),
    status: getColIdx(h2, 'status'),
    kabkota: getColIdx(h2, 'kab/kota'),
    satminkal: getColIdx(h2, 'satminkal')
  };
  const mapRes = getMapResponses();
  const snapshot = { dataList: [], totalPerbaikan: 0, totalLengkap: 0, totalBelumDicek: 0 };
  sheet2.getDataRange().getValues().slice(1).forEach((row) => {
    const nama = getVal(row, indexes.nama);
    if (!nama) return;
    const nKey = nama.toLowerCase();
    const ket = getVal(row, indexes.status);
    const sudahKumpul = mapRes[nKey]?.sudahKumpul || ket.toLowerCase().includes('sudah') || ket.toLowerCase().includes('lengkap');
    const perbaikan = mapRes[nKey]?.catatan || 'Belum dicek';
    if (sudahKumpul) {
      if (perbaikan.toLowerCase().includes('lengkap')) snapshot.totalLengkap++;
      else if (perbaikan.toLowerCase() === '' || perbaikan.toLowerCase() === 'belum dicek') snapshot.totalBelumDicek++;
      else snapshot.totalPerbaikan++;
    }
    snapshot.dataList.push({
      no: snapshot.dataList.length + 1,
      nama,
      kabkota: getVal(row, indexes.kabkota) || '-',
      satminkal: getVal(row, indexes.satminkal) || '-',
      keterangan: ket || (sudahKumpul ? 'Sudah Mengumpulkan' : 'Belum Mengumpulkan'),
      perbaikan
    });
  });
  const serialized = JSON.stringify(snapshot);
  if (Utilities.newBlob(serialized).getBytes().length <= 90000) {
    cache.put(PUBLIC_MONITOR_CACHE_KEY, serialized, PUBLIC_MONITOR_CACHE_TTL_SECONDS);
  }
  return snapshot;
}

function isPublicMonitorSubmitted_(row) {
  const status = String(row.keterangan || '').toLowerCase();
  return status.includes('sudah') || status.includes('lengkap');
}

function isPublicMonitorCorrection_(row) {
  const correction = String(row.perbaikan || '').trim().toLowerCase();
  return correction.length > 0 && correction !== 'belum dicek' &&
    !/\blengkap\b/.test(correction) && !correction.includes('sudah print') &&
    !correction.includes('catatan khusus:');
}

function clearPublicMonitorCache_() {
  CacheService.getScriptCache().remove(PUBLIC_MONITOR_CACHE_KEY);
}

// ==========================================
// PEMBERSIHAN DUPLIKAT & DRIVE
// ==========================================
function onFormSubmit(e) {
  cleanupDuplicateSubmissions();
  clearPublicMonitorCache_();
}

function extractFileIds(urlString) {
  return !urlString ? [] : urlString.toString().split(',').map(url => {
    const match = url.trim().match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }).filter(Boolean);
}

function cleanupDuplicateSubmissions() {
  try {
    const sheet = getSheet(SHEET_1);
    if (!sheet) return "Sheet tidak ditemukan";
    const data = sheet.getDataRange().getValues();
    const h = data[0];
    const idxN = getColIdx(h, 'Nama');
    const idxFile = getColIdx(h, 'Upload Dokumen');
    
    if (idxN === -1 || data.length <= 2) return "Tidak ada data untuk dibersihkan";
    
    let seenNames = new Set(), rowsToDelete = [], delFiles = 0;
    for (let i = data.length - 1; i >= 1; i--) {
      const name = getVal(data[i], idxN).toLowerCase();
      if (!name) continue;
      if (seenNames.has(name)) {
        rowsToDelete.push(i + 1);
        if (idxFile > -1) {
          extractFileIds(data[i][idxFile]).forEach(id => {
            try { DriveApp.getFileById(id).setTrashed(true); delFiles++; } catch (e) {}
          });
        }
      } else seenNames.add(name);
    }
    rowsToDelete.forEach(r => sheet.deleteRow(r));
    return `Berhasil membersihkan ${rowsToDelete.length} baris duplikat dan menghapus ${delFiles} file sisa.`;
  } catch (e) { return "Error: " + e.message; }
}

function cleanupOrphanedFiles() {
  try {
    const sheet = getSheet(SHEET_1);
    if (!sheet) return "Sheet tidak ditemukan";
    const h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const refIds = new Set();
    const idxFile = getColIdx(h, 'Upload Dokumen');
    
    sheet.getDataRange().getValues().slice(1).forEach(row => {
      if (idxFile > -1) extractFileIds(row[idxFile]).forEach(id => refIds.add(id));
    });

    let delCount = 0;
    const scan = (folder) => {
      const files = folder.getFiles();
      while (files.hasNext()) {
        const f = files.next();
        if (!refIds.has(f.getId())) {
          try { f.setTrashed(true); delCount++; } catch (e) {}
        }
      }
      const sub = folder.getFolders();
      while (sub.hasNext()) scan(sub.next());
    };
    scan(DriveApp.getFolderById(FOLDER_LAMPIRAN_ID));
    return `Berhasil membersihkan ${delCount} file sisa di dalam folder lampiran.`;
  } catch (e) { return "Error: " + e.message; }
}
