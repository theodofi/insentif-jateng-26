const SPREADSHEET_ID = '1wuFeRcj9MGV8deKL0zyzw94pYnIFA8evv_-VzEyHlsk'; 
const TEMPLATE_ID = '1Hjk1R5oY59Cxi1JlY3cNAX4FoXUQdewLCvmB7lWHye0';
const FOLDER_ID = '1hMgGw_Bxz7XYC5DHVlVN9YzX7kw_Y0VY';
const FOLERD_LAMPIRAN_ID = '1TE0V1Bz6anTZ9N6DNS6XQ_t0kfUuhXuSnbH4SEMsusety30nFqUxn7nDgUFWwvjjFOjR6zMN'; 

const STATUS_PRINT = 'Sudah Print';
const SHEET_1 = 'Form Responses 1';
const SHEET_2 = 'Status Pengumpulan';

const BULAN_SMT1 = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni"
];

const EMAIL_ADMIN = [
  "theo.hasiholan@gmail.com", 
  "pendidikankristenjateng@gmail.com",
  "asasetiabekti@gmail.com"
];

// ==========================================
// MENU & UI TRIGGER
// ==========================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Kelola')
    .addItem('🖨️ Cetak PDF', 'klikDariSpreadsheet')
    .addItem('🧹 Bersihkan Duplikat & File Baru', 'jalankanPembersihanManual')
    .addItem('🗑️ Bersihkan File Sisa (Baris Sudah Dihapus)', 'jalankanPembersihanOrphaned')
    .addSeparator() // Garis pemisah opsional agar menu lebih rapi
    .addItem('🔓 Buka Akses Folder Lampiran (Fix Iframe 403)', 'jalankanBukaAksesFolder')
    .addToUi();
}

const alertUi = (msg) => SpreadsheetApp.getUi().alert(msg);
function jalankanPembersihanManual() { alertUi(cleanupDuplicateSubmissions()); }
function jalankanPembersihanOrphaned() { alertUi(cleanupOrphanedFiles()); }
function klikDariSpreadsheet() { alertUi(prosesCetakPDF()); }

// ==========================================
// HELPER & UTILITIES (FUNGSI PEMBANTU)
// ==========================================
function getSheet(name) { return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name); }

function getColIdx(headers, name) { 
  let exact = headers.findIndex(h => h.toString().trim().toLowerCase() === name.toLowerCase());
  if (exact > -1) return exact;
  return headers.findIndex(h => h.toString().toLowerCase().includes(name.toLowerCase())); 
}

function getVal(row, idx) { return idx > -1 ? (row[idx] || '').toString().trim() : ''; }

function buatPDFDariTemplate(nama, satminkal, kabkota, skam, dhadir, lapkin, catatan, subfolder) {
  const template = DriveApp.getFileById(TEMPLATE_ID);
  const newFile = template.makeCopy(`Temp Doc - ${nama}`, subfolder);
  const doc = DocumentApp.openById(newFile.getId());
  const body = doc.getBody();

  body.replaceText('{{NAMA}}', nama);
  body.replaceText('{{SATMINKAL}}', satminkal);
  body.replaceText('{{KAB_KOTA}}', kabkota);
  body.replaceText('{{CAT}}', catatan);
  body.replaceText('{{TANGGAL}}', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy"));

  BULAN_SMT1.forEach((b, j) => {
    const no = j + 1;
    const cek = (berkas) => (berkas||'').includes(b);
    body.replaceText(`{{S${no}_A}}`, cek(skam) ? '✔' : '');
    body.replaceText(`{{S${no}_T}}`, cek(skam) ? '' : '✔');
    body.replaceText(`{{P${no}_A}}`, cek(dhadir) ? '✔' : '');
    body.replaceText(`{{P${no}_T}}`, cek(dhadir) ? '' : '✔');
    body.replaceText(`{{L${no}_A}}`, cek(lapkin) ? '✔' : '');
    body.replaceText(`{{L${no}_T}}`, cek(lapkin) ? '' : '✔');
    
  });

  doc.saveAndClose();
  const pdf = subfolder.createFile(newFile.getAs(MimeType.PDF)).setName(`Daftar-Periksa-BB_${nama}_${kabkota}.pdf`);
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
  const h = data[0];
  const idx = { 
    n: getColIdx(h, 'Nama'),
    s: getColIdx(h, 'Satminkal / Sekolah Induk'),
    k: getColIdx(h, 'Kab/Kota Satminkal'), 
    sk: getColIdx(h, 'Surat Keterangan Aktif Mengajar (SKAM) 2026'),
    l: getColIdx(h, 'Laporan Kinerja/Jurnal Mengajar 2026'),  
    d: getColIdx(h, 'Daftar Hadir/Presensi sebagai Guru 2026'), 
    sp: getColIdx(h, 'Status Print'), 
    sC: getColIdx(h, 'Catatan')
  };

  let subfolder = null, count = 0;
  for (let i = 1; i < data.length; i++) {
    if (getVal(data[i], idx.sp).toLowerCase() === STATUS_PRINT.toLowerCase() || getVal(data[i], idx.sC).toLowerCase() !== 'lengkap') continue;
    // if (getVal(data[i], idx.sp).toLowerCase() === STATUS_PRINT.toLowerCase()) continue;
    
    const nama = getVal(data[i], idx.n);
    if (!nama) continue;
    if (!subfolder) subfolder = createSubfolder(FOLDER_ID);

    buatPDFDariTemplate(
      nama, 
      getVal(data[i], idx.s), 
      getVal(data[i], idx.k), 
      getVal(data[i], idx.sk), 
      getVal(data[i], idx.d), 
      getVal(data[i], idx.l), 
      getVal(data[i], idx.sC), 
      subfolder
    );
    sheet.getRange(i + 1, idx.sp + 1).setValue(STATUS_PRINT);
    count++;
  }
  return count > 0 ? `Proses selesai berhasil membuat ${count} berkas PDF baru` : 'Tidak ada data Lengkap baru untuk diproses';
}

function inisialisasiCetakBatch() {
  const sheet = getSheet(SHEET_1);
  if (!sheet) return { error: 'Sheet tidak ditemukan' };
  const data = sheet.getDataRange().getValues();
  
  const barisTarget = data.map((row, i) => {
    if (i === 0) return null;
    const statusPrint = getVal(row, getColIdx(data[0], 'Status Print')).toLowerCase();
    const catatan = getVal(row, getColIdx(data[0], 'Catatan')).toLowerCase();
    const isSiapCetak = statusPrint !== STATUS_PRINT.toLowerCase() && (catatan === 'lengkap');
    return isSiapCetak ? i + 1 : null;
  }).filter(Boolean);

  return barisTarget.length === 0 ? { total: 0, barisTarget: [] } : 
    { total: barisTarget.length, barisTarget, subfolderId: createSubfolder(FOLDER_ID).getId() };
}

function prosesSatuBarisPDFWeb(rowNumber, subfolderId) {
  const sheet = getSheet(SHEET_1);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const gV = (name) => getVal(row, getColIdx(headers, name));

  if (!gV('Nama')) return { success: false, message: 'Nama kosong' };
  
  const pdf = buatPDFDariTemplate(
    gV('Nama'), 
    gV('Satminkal / Sekolah Induk'), 
    gV('Kab/Kota Satminkal'), 
    gV('Surat Keterangan Aktif Mengajar (SKAM) 2026'), 
    gV('Daftar Hadir/Presensi sebagai Guru 2026'), 
    gV('Laporan Kinerja/Jurnal Mengajar 2026'), 
    gV('Catatan'), 
    DriveApp.getFolderById(subfolderId)
  );
  
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
  try {
    return apiResponse_({ ok: true, data: ambilDataSheetPengumpulanIndex2() });
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
      if (args.length !== 5 || !Number.isInteger(Number(args[0])) || Number(args[0]) < 2) throw new Error('Invalid arguments.');
      return simpanStatusVerval(
        Number(args[0]),
        String(args[1] || ''),
        String(args[2] || ''),
        String(args[3] || ''),
        String(args[4] || '')
      );
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
    n: getColIdx(h, 'nama'), 
    cat: getColIdx(h, 'catatan'), 
    sp: getColIdx(h, 'status print'), 
    s: getColIdx(h, 'upload skam'), 
    l: getColIdx(h, 'upload laporan kinerja'), 
    d: getColIdx(h, 'upload daftar hadir'),
    skamBln: getColIdx(h, 'Surat Keterangan Aktif Mengajar'),
    lapkinBln: getColIdx(h, 'Laporan Kinerja/Jurnal'),
    hadirBln: getColIdx(h, 'Daftar Hadir/Presensi')
  };

  return data.slice(1).reduce((map, row, j) => {
    const nama = getVal(row, idx.n).toLowerCase();
    if (nama) {
      map[nama] = { 
        barisAsli: j + 2, 
        catatan: getVal(row, idx.cat) || 'Belum dicek', 
        statusPrint: getVal(row, idx.sp), 
        linkSKAM: getVal(row, idx.s), 
        linkLapkin: getVal(row, idx.l), 
        linkPresensi: getVal(row, idx.d),
        skamBulan: getVal(row, idx.skamBln),
        lapkinBulan: getVal(row, idx.lapkinBln),
        hadirBulan: getVal(row, idx.hadirBln),
        sudahKumpul: true 
      };
    }
    return map;
  }, {});
}

function ambilDataAntreanAdmin() {
  const sheet2 = getSheet(SHEET_2);
  if (!sheet2) return [];
  const data2 = sheet2.getDataRange().getValues();
  const h2 = data2[0];
  const mapRes = getMapResponses();

  return data2.slice(1).reduce((acc, row) => {
    const nama = getVal(row, getColIdx(h2, 'nama'));
    if (nama) {
      const res = mapRes[
        nama.toLowerCase()] || { barisAsli: 0, 
        catatan: 'Belum dicek', 
        statusPrint: '', 
        linkSKAM: '', 
        linkLapkin: '', 
        linkPresensi: '', 
        skamBulan:'', 
        lapkinBulan:'', 
        hadirBulan:'' };
      acc.push({
        no: acc.length + 1, 
        barisAsli: res.barisAsli, 
        nama, kabkota: getVal(row, getColIdx(h2, 'kab/kota')) || '-', 
        satminkal: getVal(row, getColIdx(h2, 'satminkal')) || '-',
        keterangan: getVal(row, getColIdx(h2, 'status')) || (res.barisAsli > 0 ? 'Sudah Mengumpulkan' : 'Belum Mengumpulkan'),
        perbaikan: res.catatan, 
        statusPrint: res.statusPrint, 
        linkSKAM: res.linkSKAM, 
        linkLapkin: res.linkLapkin, 
        linkPresensi: res.linkPresensi,
        skamBulan: res.skamBulan, 
        lapkinBulan: res.lapkinBulan, 
        hadirBulan: res.hadirBulan
      });
    }
    return acc;
  }, []);
}

function simpanStatusVerval(baris, catatan, skamBulan, lapkinBulan, hadirBulan) {
  try {
    const sheet = getSheet(SHEET_1);
    const h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Perbaikan: Fungsi ini sekarang menangani penghapusan jika data kosong ("")
    const setColVal = (name, val) => {
      const i = getColIdx(h, name);
      if (i > -1) {
        if (val === "") {
          sheet.getRange(baris, i + 1).clearContent();
        } else {
          sheet.getRange(baris, i + 1).setValue(val);
        }
      }
    };

    setColVal('Catatan', catatan);
    setColVal('Surat Keterangan Aktif Mengajar', skamBulan);
    setColVal('Laporan Kinerja/Jurnal', lapkinBulan);
    setColVal('Daftar Hadir/Presensi', hadirBulan);

    return "Berhasil";
  } catch (e) { return "Error: " + e.message; }
}

function ambilDataSheetPengumpulanIndex2() {
  const sheet2 = getSheet(SHEET_2);
  if (!sheet2) return { dataList: [], totalPerbaikan: 0, totalLengkap: 0, totalBelumDicek: 0 };
  
  const h2 = sheet2.getRange(1, 1, 1, sheet2.getLastColumn()).getValues()[0];
  const mapRes = getMapResponses();
  const res = { dataList: [], totalPerbaikan: 0, totalLengkap: 0, totalBelumDicek: 0 };
  
  sheet2.getDataRange().getValues().slice(1).forEach((row) => {
    const nama = getVal(row, getColIdx(h2, 'nama'));
    if (nama) {
      const nKey = nama.toLowerCase();
      const ket = getVal(row, getColIdx(h2, 'status'));
      const sudahKumpul = mapRes[nKey]?.sudahKumpul || ket.toLowerCase().includes('sudah') || ket.toLowerCase().includes('lengkap');
      const perbaikan = mapRes[nKey]?.catatan || 'Belum dicek';
      
      if (sudahKumpul) {
        if (perbaikan.toLowerCase().includes('lengkap')) res.totalLengkap++;
        else if (perbaikan.toLowerCase() === '' || perbaikan.toLowerCase() === 'belum dicek') res.totalBelumDicek++;
        else res.totalPerbaikan++;
      }

      res.dataList.push({
        no: res.dataList.length + 1, nama, kabkota: getVal(row, getColIdx(h2, 'kab/kota')) || '-', satminkal: getVal(row, getColIdx(h2, 'satminkal')) || '-',
        keterangan: ket || (sudahKumpul ? 'Sudah Mengumpulkan' : 'Belum Mengumpulkan'), perbaikan
      });
    }
  });
  return res;
}

function bukaAksesFolderLampiranKhususAdmin() {
  try {
    const folderLampiran = DriveApp.getFolderById(FOLERD_LAMPIRAN_ID);   
    EMAIL_ADMIN.forEach(email => {
      folderLampiran.addViewer(email);
    });
    return "✅ Akses berhasil diperbarui! Pratinjau PDF kini hanya bisa dibuka oleh email Admin yang terdaftar.";
  } catch(e) {
    return "❌ Error: " + e.message;
  }
}

function jalankanBukaAksesFolder() {
  alertUi(bukaAksesFolderLampiranKhususAdmin());
}

// ==========================================
// PEMBERSIHAN DUPLIKAT & OPTIMASI DRIVE
// ==========================================
function onFormSubmit(e) { cleanupDuplicateSubmissions(); }

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
    const idx = { n: getColIdx(h, 'nama'), s: getColIdx(h, 'upload skam'), l: getColIdx(h, 'upload laporan kinerja'), p: getColIdx(h, 'upload daftar hadir') };
    if (idx.n === -1 || data.length <= 2) return "Tidak ada data untuk dibersihkan";
    
    let seenNames = new Set(), rowsToDelete = [], delFiles = 0;
    
    for (let i = data.length - 1; i >= 1; i--) {
      const name = getVal(data[i], idx.n).toLowerCase();
      if (!name) continue;
      
      if (seenNames.has(name)) {
        rowsToDelete.push(i + 1);
        [idx.s, idx.l, idx.p].filter(x => x > -1).flatMap(x => extractFileIds(data[i][x])).forEach(id => {
          try { DriveApp.getFileById(id).setTrashed(true); delFiles++; } catch (e) {}
        });
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
    
    sheet.getDataRange().getValues().slice(1).forEach(row => {
      ['upload skam', 'upload laporan kinerja', 'upload daftar hadir'].map(col => getColIdx(h, col))
        .filter(x => x > -1).flatMap(x => extractFileIds(row[x])).forEach(id => refIds.add(id));
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
    
    scan(DriveApp.getFolderById(FOLERD_LAMPIRAN_ID));
    return `Berhasil membersihkan ${delCount} file sisa di dalam folder lampiran.`;
  } catch (e) { return "Error: " + e.message; }
}