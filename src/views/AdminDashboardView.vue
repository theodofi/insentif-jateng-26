<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import portalApi from '../services/api.js';

const props = defineProps({
    workflow: { type: String, required: true },
    title: { type: String, required: true },
    period: { type: String, required: true }
});
const isBerjalan = computed(() => props.workflow.startsWith('berjalan'));
const months = computed(() => props.period === 'Januari-Juni'
    ? ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni']
    : ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']);
const ajuanDocuments = [
    { id: 'cover', label: 'Cover' },
    { id: 'biodata', label: 'Identitas Diri (Biodata)' },
    { id: 'permohonan', label: 'Surat Permohonan Kepada Kepala Kantor Wilayah Kementerian Agama Provinsi Jawa Tengah u.p. Pembimas Kristen (Tertanggal di awal tahun, hari kerja)' },
    { id: 'sk_pengangkatan', label: 'Fotokopi Sah SK Pengangkatan Sebagai Guru Bukan ASN Pendidikan Agama Kristen' },
    { id: 'npsn', label: 'Fotokopi Sah Sertifikat NPSN / Surat Keterangan NPSN dari Kepala Satuan Pendidikan' },
    { id: 'skpbm', label: 'Fotokopi Sah SKPBM (Surat Keputusan Pembagian Tugas Belajar Mengajar)' },
    { id: 'jadwal', label: 'Fotokopi Sah Jadwal Pembelajaran' },
    { id: 'ijazah', label: 'Fotokopi Sah Ijazah Pendidikan Terakhir (Minimal S1 linear dengan Pendidikan Agama Kristen dan Teologi)' },
    { id: 'pernyataan', label: 'Surat Pernyataan belum memiliki Sertifikat Pendidik dan Guru Bukan ASN' },
    { id: 'ktp', label: 'Fotokopi Kartu Tanda Penduduk (KTP)' },
    { id: 'kk', label: 'Fotokopi Kartu Keluarga (KK)' },
    { id: 'npwp', label: 'Fotokopi NPWP' },
    { id: 'rekening', label: 'Fotokopi Buku Rekening' }
];

const allData = ref([]);
const pdfList = ref([]);
const loading = ref(true);
const saving = ref(false);
const processing = ref(false);
const stopRequested = ref(false);
const errorMessage = ref('');
const processMessage = ref('');
const query = ref('');
const statusFilter = ref('');
const pdfQuery = ref('');
const page = ref(1);
const pdfPage = ref(1);
const pageSize = 10;
const sortKey = ref('no');
const sortAscending = ref(true);
const editing = ref(null);
const editStatus = ref('');
const checkedDocuments = ref([]);
const checkedMonths = ref({ skam: [], lapkin: [], hadir: [] });
const canLoad = ref(false);
let refreshTimer;
let mounted = false;
let activeWorkflow = '';

function stateOf(row) {
    const collection = String(row.keterangan || '').toLowerCase();
    const review = String(row.perbaikan || '').trim().toLowerCase();
    const submitted = collection.includes('sudah') || collection.includes('lengkap');
    const complete = review === 'lengkap';
    const pendingReview = review === '' || review === 'belum dicek';
    const specialNote = review.includes('catatan khusus:');
    const correction = submitted && !complete && !pendingReview && !specialNote && !review.includes('sudah print');
    const printed = String(row.statusPrint || '').toLowerCase() === 'sudah print';
    return { submitted, complete, pendingReview, specialNote, correction, printed };
}

const summary = computed(() => allData.value.reduce((result, row) => {
    const state = stateOf(row);
    if (state.submitted) result.submitted++;
    else result.pending++;
    if (state.correction || state.specialNote) result.correction++;
    if (state.submitted && state.pendingReview) result.review++;
    if (state.submitted && state.complete && !state.printed) result.ready++;
    return result;
}, { submitted: 0, pending: 0, correction: 0, review: 0, ready: 0 }));

const filteredData = computed(() => {
    const keyword = query.value.trim().toLocaleLowerCase('id');
    const data = allData.value.filter(row => {
        const matchesText = !keyword || [row.nama, row.kabkota, row.satminkal]
            .some(value => String(value || '').toLocaleLowerCase('id').includes(keyword));
        if (!matchesText) return false;
        const state = stateOf(row);
        switch (statusFilter.value) {
            case 'sudah': return state.submitted;
            case 'belum': return !state.submitted;
            case 'lengkap': return state.submitted && state.complete;
            case 'perbaikan': return state.correction;
            case 'catatan': return state.specialNote;
            case 'belum_dicek': return state.submitted && state.pendingReview;
            case 'siap_cetak': return state.submitted && state.complete && !state.printed;
            default: return true;
        }
    });
    return data.toSorted ? data.toSorted(compareRows) : [...data].sort(compareRows);
});

function compareRows(a, b) {
    const left = a[sortKey.value] ?? '';
    const right = b[sortKey.value] ?? '';
    const compared = sortKey.value === 'no'
        ? (Number(left) || 0) - (Number(right) || 0)
        : String(left).localeCompare(String(right), 'id', { numeric: true, sensitivity: 'base' });
    return sortAscending.value ? compared : -compared;
}

const pageCount = computed(() => Math.max(1, Math.ceil(filteredData.value.length / pageSize)));
const pageData = computed(() => filteredData.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const filteredPdfs = computed(() => {
    const keyword = pdfQuery.value.trim().toLocaleLowerCase('id');
    return pdfList.value.filter(item => !keyword || String(item.nama || '').toLocaleLowerCase('id').includes(keyword));
});
const pdfPageCount = computed(() => Math.max(1, Math.ceil(filteredPdfs.value.length / pageSize)));
const pdfPageData = computed(() => filteredPdfs.value.slice((pdfPage.value - 1) * pageSize, pdfPage.value * pageSize));

function errorText(error) {
    return portalApi.showApiError(error);
}

async function loadData(showSpinner = true) {
    if (showSpinner) loading.value = true;
    errorMessage.value = '';
    try {
        const [rows, pdfs] = await Promise.all([
            portalApi.adminCall('ambilDataAntreanAdmin', []),
            portalApi.adminCall('ambilDaftarPDF', [])
        ]);
        if (!Array.isArray(rows) || !Array.isArray(pdfs)) throw new Error('api_invalid_response');
        allData.value = rows;
        pdfList.value = pdfs;
        canLoad.value = true;
        if (page.value > pageCount.value) page.value = pageCount.value;
    } catch (error) {
        errorMessage.value = errorText(error);
        canLoad.value = false;
    } finally {
        loading.value = false;
    }
}

async function startWorkflow(workflow) {
    activeWorkflow = workflow;
    loading.value = true;
    errorMessage.value = '';
    canLoad.value = false;
    try {
        await portalApi.initializeAdmin(workflow);
    } catch (error) {
        loading.value = false;
        errorMessage.value = errorText(error);
    }
}

function onAdminReady(event) {
    if (!activeWorkflow || !event.detail?.email) return;
    canLoad.value = true;
    void loadData();
}

function sortBy(key) {
    if (sortKey.value === key) sortAscending.value = !sortAscending.value;
    else {
        sortKey.value = key;
        sortAscending.value = true;
    }
}

function statusBadge(value) {
    const status = String(value || '').toLowerCase();
    if (status.includes('belum')) return 'badge bg-danger-subtle text-danger-emphasis border border-danger-subtle';
    if (status.includes('sudah') || status.includes('lengkap')) return 'badge bg-success-subtle text-success-emphasis border border-success-subtle';
    return 'badge bg-light text-secondary border';
}

function reviewBadge(row) {
    const state = stateOf(row);
    if (state.specialNote) return 'badge bg-primary-subtle text-primary-emphasis border border-primary-subtle text-wrap';
    if (state.correction) return 'badge bg-warning-subtle text-dark border border-warning-subtle text-wrap';
    if (state.complete) return 'badge bg-success-subtle text-success-emphasis border border-success-subtle';
    if (state.printed) return 'badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
    return 'badge bg-light text-secondary border';
}

function safeDriveUrl(value) {
    const trimmed = String(value || '').trim();
    return /^https:\/\/(?:drive|docs)\.google\.com\//i.test(trimmed) ? trimmed : '';
}

function uploadLinks(row) {
    return [
        ['Dokumen SKAM', row.linkSKAM],
        ['Laporan Kinerja', row.linkLapkin],
        ['Daftar Hadir', row.linkPresensi],
        ['Berkas', row.linkBerkas]
    ].flatMap(([label, value]) => String(value || '').split(',').map(url => ({
        label, url: safeDriveUrl(url)
    })).filter(item => item.url));
}

function selectedList(value) {
    return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function editRow(row) {
    if (!Number(row.barisAsli)) {
        errorMessage.value = 'Belum ada data pengumpulan untuk guru ini. Status belum dapat disimpan.';
        return;
    }
    errorMessage.value = '';
    editing.value = row;
    editStatus.value = row.perbaikan === 'Belum dicek' ? '' : String(row.perbaikan || '');
    const savedDocuments = String(row.berkas || '');
    checkedDocuments.value = ajuanDocuments
        .filter(document => savedDocuments.includes(document.label))
        .map(document => document.label);
    checkedMonths.value = {
        skam: selectedList(row.skamBulan),
        lapkin: selectedList(row.lapkinBulan),
        hadir: selectedList(row.hadirBulan)
    };
}

function toggleDocument(label) {
    checkedDocuments.value = checkedDocuments.value.includes(label)
        ? checkedDocuments.value.filter(item => item !== label)
        : [...checkedDocuments.value, label];
}

function toggleMonth(type, month) {
    const current = checkedMonths.value[type];
    checkedMonths.value = {
        ...checkedMonths.value,
        [type]: current.includes(month) ? current.filter(item => item !== month) : [...current, month]
    };
}

function setChecklistStatus() {
    if (!isBerjalan.value) {
        editStatus.value = checkedDocuments.value.length === ajuanDocuments.length
            ? 'Lengkap'
            : `Perbaikan, melengkapi:\n${ajuanDocuments.filter(item => !checkedDocuments.value.includes(item.label)).map((item, index) => `${index + 1}. ${item.label}`).join('\n')}`;
        return;
    }
    const complete = ['skam', 'lapkin', 'hadir'].every(type => checkedMonths.value[type].length === months.value.length);
    editStatus.value = complete ? 'Lengkap' : 'Perbaikan';
}

async function saveVerification() {
    if (!editing.value || saving.value) return;
    saving.value = true;
    errorMessage.value = '';
    try {
        let response;
        if (isBerjalan.value) {
            response = await portalApi.adminCall('simpanStatusVerval', [
                Number(editing.value.barisAsli),
                editStatus.value.trim(),
                checkedMonths.value.skam.join(', '),
                checkedMonths.value.lapkin.join(', '),
                checkedMonths.value.hadir.join(', ')
            ]);
        } else {
            response = await portalApi.adminCall('simpanStatusVerval', [
                Number(editing.value.barisAsli),
                editStatus.value.trim(),
                checkedDocuments.value.join(', ')
            ]);
        }
        if (response !== 'Berhasil') throw new Error(`Status tidak tersimpan: ${String(response || 'respons kosong dari server')}`);
        editing.value = null;
        await loadData();
    } catch (error) {
        errorMessage.value = error.message.startsWith('Status tidak tersimpan:')
            ? error.message
            : errorText(error);
    } finally {
        saving.value = false;
    }
}

async function processAllPdfs() {
    if (processing.value) {
        stopRequested.value = true;
        processMessage.value = 'Menghentikan proses setelah berkas yang sedang dikerjakan selesai...';
        return;
    }
    processing.value = true;
    stopRequested.value = false;
    processMessage.value = 'Memeriksa antrean...';
    try {
        const init = await portalApi.adminCall('inisialisasiCetakBatch', []);
        if (init?.error) throw new Error(String(init.error));
        if (!Number.isInteger(init?.total) || !Array.isArray(init?.barisTarget)) throw new Error('api_invalid_response');
        if (init.total !== init.barisTarget.length ||
            !init.barisTarget.every(rowNumber => Number.isInteger(Number(rowNumber)) && Number(rowNumber) >= 2) ||
            (init.total > 0 && (typeof init.subfolderId !== 'string' || !init.subfolderId))) {
            throw new Error('api_invalid_response');
        }
        if (init.total === 0) {
            processMessage.value = 'Tidak ada data siap proses.';
            return;
        }
        let success = 0;
        const failures = [];
        for (const rowNumber of init.barisTarget) {
            if (stopRequested.value) break;
            processMessage.value = `Membuat PDF... ${success + failures.length}/${init.total} selesai.`;
            const result = await portalApi.adminCall('prosesSatuBarisPDFWeb', [rowNumber, init.subfolderId]);
            if (result?.success && result.fileInfo) {
                success++;
                pdfList.value.unshift(result.fileInfo);
                const matched = allData.value.find(row => Number(row.barisAsli) === Number(rowNumber));
                if (matched) matched.statusPrint = 'Sudah Print';
            } else {
                failures.push(String(result?.message || `Baris ${rowNumber} gagal diproses.`));
            }
        }
        processMessage.value = stopRequested.value
            ? `Proses dihentikan. ${success} PDF berhasil dibuat${failures.length ? `, ${failures.length} gagal: ${failures[0]}` : ''}.`
            : `Selesai. ${success} PDF berhasil dibuat${failures.length ? `, ${failures.length} gagal: ${failures[0]}` : ''}.`;
        await loadData(false);
    } catch (error) {
        processMessage.value = `Gagal membuat PDF: ${errorText(error)}`;
    } finally {
        processing.value = false;
        stopRequested.value = false;
    }
}

function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
    const headers = ['No', 'Nama Guru', 'Kab/Kota', 'Satminkal / Sekolah', 'Keterangan', 'Status Verval', 'Status Cetak'];
    const rows = filteredData.value.map(row => [
        row.no, row.nama, row.kabkota, row.satminkal, row.keterangan, row.perbaikan, row.statusPrint
    ]);
    const csv = `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${props.workflow}-rekap.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

watch([query, statusFilter], () => { page.value = 1; });
watch(pdfQuery, () => { pdfPage.value = 1; });
watch(() => props.workflow, workflow => {
    if (mounted && workflow !== activeWorkflow) void startWorkflow(workflow);
});
onMounted(() => {
    mounted = true;
    window.addEventListener('portal-admin-ready', onAdminReady);
    refreshTimer = window.setInterval(() => {
        if (canLoad.value && !loading.value && !saving.value && !processing.value) void loadData(false);
    }, 30000);
    void startWorkflow(props.workflow);
});
onUnmounted(() => {
    mounted = false;
    window.removeEventListener('portal-admin-ready', onAdminReady);
    window.clearInterval(refreshTimer);
    portalApi.disposeAdmin();
});
</script>

<template>
  <div class="admin-view">
  <section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-8">
    <div class="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="mb-1 text-xs font-bold uppercase tracking-wide text-blue-700">Administrasi {{ period }}</p>
        <h2 class="mb-1 text-2xl font-bold text-gray-900">{{ title }}</h2>
        <p class="mb-0 text-sm text-gray-600">Kelola status, verifikasi dokumen, dan pembuatan PDF.</p>
      </div>
      <RouterLink to="/" class="btn btn-outline-primary d-inline-flex align-items-center gap-2 rounded-pill px-4 py-2 fw-semibold align-self-start">
        <span aria-hidden="true">←</span>Kembali
      </RouterLink>
    </div>

    <div v-if="errorMessage" class="alert alert-danger mb-4" role="alert">{{ errorMessage }}</div>
    <div class="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div class="rounded-xl border border-green-200 bg-green-50 p-3"><p class="mb-1 text-xs font-bold uppercase text-green-800">Sudah mengumpulkan</p><p class="mb-0 text-2xl font-bold text-green-800">{{ summary.submitted }}</p></div>
      <div class="rounded-xl border border-red-200 bg-red-50 p-3"><p class="mb-1 text-xs font-bold uppercase text-red-800">Belum mengumpulkan</p><p class="mb-0 text-2xl font-bold text-red-800">{{ summary.pending }}</p></div>
      <div class="rounded-xl border border-yellow-200 bg-yellow-50 p-3"><p class="mb-1 text-xs font-bold uppercase text-yellow-900">Perbaikan / catatan</p><p class="mb-0 text-2xl font-bold text-yellow-900">{{ summary.correction }}</p></div>
      <div class="rounded-xl border border-blue-200 bg-blue-50 p-3"><p class="mb-1 text-xs font-bold uppercase text-blue-800">Belum diverifikasi</p><p class="mb-0 text-2xl font-bold text-blue-800">{{ summary.review }}</p></div>
      <div class="rounded-xl border border-purple-200 bg-purple-50 p-3"><p class="mb-1 text-xs font-bold uppercase text-purple-800">Siap cetak PDF</p><p class="mb-0 text-2xl font-bold text-purple-800">{{ summary.ready }}</p></div>
    </div>

    <section class="mb-7">
      <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 class="mb-1 text-lg font-bold text-gray-900">Antrean Pengumpulan</h3><p class="mb-0 text-xs text-gray-500">{{ filteredData.length }} data ditampilkan</p></div>
        <button class="btn btn-outline-success d-inline-flex align-items-center gap-2 align-self-start" type="button" @click="exportCsv"><i class="fa-solid fa-file-csv"></i>Ekspor CSV (Excel)</button>
      </div>
      <div class="filter-controls mb-3">
        <input v-model="query" class="form-control" type="search" placeholder="Cari nama, daerah, atau sekolah..." aria-label="Cari antrean">
        <select v-model="statusFilter" class="form-select" aria-label="Filter status antrean">
          <option value="">Semua status</option><option value="sudah">Sudah mengumpulkan</option>
          <option value="belum">Belum mengumpulkan</option><option value="lengkap">Lengkap</option>
          <option value="perbaikan">Perlu perbaikan</option><option value="catatan">Catatan khusus</option>
          <option value="belum_dicek">Belum diverifikasi</option><option value="siap_cetak">Siap cetak PDF</option>
        </select>
      </div>
      <div v-if="loading" class="py-8 text-center text-sm text-gray-600"><span class="spinner-border spinner-border-sm me-2" role="status"></span>Memuat data admin...</div>
      <div v-else class="space-y-3 md:hidden">
        <article v-for="row in pageData" :key="`card-${row.barisAsli}-${row.no}-${row.nama}`" class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="mb-2 flex items-start justify-between gap-2">
            <h4 class="mb-0 text-base font-semibold text-gray-900">{{ row.nama }}</h4>
            <span class="text-xs text-gray-500">#{{ row.no }}</span>
          </div>
          <dl class="mb-3 space-y-1 text-sm">
            <div class="flex gap-2"><dt class="w-20 shrink-0 text-gray-500">Kab/Kota</dt><dd class="mb-0 text-gray-800">{{ row.kabkota }}</dd></div>
            <div class="flex gap-2"><dt class="w-20 shrink-0 text-gray-500">Satminkal</dt><dd class="mb-0 text-gray-800">{{ row.satminkal }}</dd></div>
            <div class="flex gap-2"><dt class="w-20 shrink-0 text-gray-500">Cetak</dt><dd class="mb-0 text-gray-800">{{ row.statusPrint || '—' }}</dd></div>
          </dl>
          <div class="mb-3 flex flex-wrap gap-2">
            <span :class="statusBadge(row.keterangan)">{{ row.keterangan || 'Belum Mengumpulkan' }}</span>
            <span :class="[reviewBadge(row), 'text-start']">{{ row.perbaikan || 'Belum dicek' }}</span>
          </div>
          <button class="btn btn-sm btn-outline-primary w-100" :disabled="!Number(row.barisAsli)" @click="editRow(row)">Verval</button>
        </article>
        <p v-if="!pageData.length" class="rounded-xl border border-gray-200 py-5 text-center text-sm text-gray-500">Tidak ada data yang sesuai filter.</p>
      </div>
      <div v-if="!loading" class="table-responsive hidden overflow-hidden rounded-xl border border-gray-200 md:block">
        <table class="table table-hover mb-0 align-middle">
          <thead class="table-light"><tr>
            <th><button class="sort-button" @click="sortBy('no')">No <span>{{ sortKey === 'no' ? (sortAscending ? '▲' : '▼') : '↕' }}</span></button></th>
            <th><button class="sort-button" @click="sortBy('nama')">Nama Guru <span>{{ sortKey === 'nama' ? (sortAscending ? '▲' : '▼') : '↕' }}</span></button></th>
            <th><button class="sort-button" @click="sortBy('kabkota')">Kab/Kota <span>{{ sortKey === 'kabkota' ? (sortAscending ? '▲' : '▼') : '↕' }}</span></button></th>
            <th>Satminkal / Sekolah</th><th>Keterangan</th><th>Verval</th><th>Cetak</th><th>Aksi</th>
          </tr></thead>
          <tbody>
            <tr v-for="row in pageData" :key="`${row.barisAsli}-${row.no}-${row.nama}`">
              <td>{{ row.no }}</td><td class="min-w-48 fw-semibold">{{ row.nama }}</td><td>{{ row.kabkota }}</td>
              <td class="min-w-48">{{ row.satminkal }}</td>
              <td><span :class="statusBadge(row.keterangan)">{{ row.keterangan || 'Belum Mengumpulkan' }}</span></td>
              <td><span :class="[reviewBadge(row), 'text-start']">{{ row.perbaikan || 'Belum dicek' }}</span></td>
              <td>{{ row.statusPrint || '—' }}</td>
              <td><button class="btn btn-sm btn-outline-primary text-nowrap" :disabled="!Number(row.barisAsli)" @click="editRow(row)">Verval</button></td>
            </tr>
            <tr v-if="!pageData.length"><td colspan="8" class="py-5 text-center text-sm text-gray-500">Tidak ada data yang sesuai filter.</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="!loading && pageData.length" class="mt-3 flex items-center justify-between gap-3">
        <button class="btn btn-outline-secondary btn-sm" :disabled="page === 1" @click="page--">← Sebelumnya</button>
        <span class="text-sm text-gray-600">Halaman {{ page }} dari {{ pageCount }}</span>
        <button class="btn btn-outline-secondary btn-sm" :disabled="page === pageCount" @click="page++">Selanjutnya →</button>
      </div>
    </section>

    <section class="border-t border-gray-200 pt-6">
      <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 class="mb-1 text-lg font-bold text-gray-900">Riwayat PDF</h3><p class="mb-0 text-xs text-gray-500">{{ pdfList.length }} berkas tersimpan di Drive</p></div>
        <button class="btn d-inline-flex align-items-center gap-2" :class="processing ? 'btn-danger' : 'btn-success'" type="button" :disabled="loading" :aria-busy="processing" @click="processAllPdfs">
          <i class="fa-solid" :class="processing ? 'fa-stop' : 'fa-print'"></i>{{ processing ? 'Hentikan Proses' : 'Cetak PDF Lengkap' }}
        </button>
      </div>
      <p v-if="processMessage" class="mb-3 text-sm" :class="processMessage.startsWith('Gagal') ? 'text-red-700' : 'text-gray-600'" role="status" aria-live="polite">{{ processMessage }}</p>
      <div class="mb-3 flex flex-col gap-2 sm:flex-row">
        <input v-model="pdfQuery" type="search" class="form-control form-control-sm sm:max-w-sm" placeholder="Cari nama di riwayat PDF..." aria-label="Cari PDF">
      </div>
      <div v-if="pdfList.length" class="table-responsive overflow-hidden rounded-xl border border-gray-200">
        <table class="table table-hover mb-0 align-middle">
          <thead class="table-light"><tr><th>Nama Berkas</th><th>Waktu</th><th>Aksi</th></tr></thead>
          <tbody>
            <tr v-for="(pdf, index) in pdfPageData" :key="`${pdf.url}-${index}`">
              <td class="fw-semibold">{{ pdf.nama }}</td><td>{{ pdf.waktuFormat || '—' }}</td>
              <td><a v-if="safeDriveUrl(pdf.url)" class="btn btn-sm btn-outline-primary" :href="safeDriveUrl(pdf.url)" target="_blank" rel="noopener noreferrer">Buka PDF</a><span v-else class="text-sm text-gray-500">Tautan tidak tersedia</span></td>
            </tr>
            <tr v-if="!pdfPageData.length"><td colspan="3" class="py-4 text-center text-sm text-gray-500">PDF tidak ditemukan.</td></tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="!loading" class="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Belum ada riwayat PDF untuk periode ini.</p>
      <div v-if="pdfPageCount > 1" class="mt-3 flex items-center justify-between gap-3">
        <button class="btn btn-outline-secondary btn-sm" :disabled="pdfPage === 1" @click="pdfPage--">← Sebelumnya</button>
        <span class="text-sm text-gray-600">Halaman {{ pdfPage }} dari {{ pdfPageCount }}</span>
        <button class="btn btn-outline-secondary btn-sm" :disabled="pdfPage === pdfPageCount" @click="pdfPage++">Selanjutnya →</button>
      </div>
    </section>
  </section>

  <div v-if="editing" class="verification-overlay fixed inset-0 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="verval-title" @click.self="editing = null">
    <section class="verification-dialog w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl md:p-7">
      <div class="mb-5 flex items-start justify-between gap-3">
        <div><h3 id="verval-title" class="mb-1 text-xl font-bold text-gray-900">Verifikasi Berkas</h3><p class="mb-0 text-sm text-gray-600">{{ editing.nama }} · {{ editing.kabkota }}</p></div>
        <button class="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Tutup" @click="editing = null"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div v-if="uploadLinks(editing).length" class="mb-5">
        <h4 class="mb-2 text-sm font-bold text-gray-800">Berkas unggahan</h4>
        <div class="flex flex-wrap gap-2">
          <a v-for="(link, index) in uploadLinks(editing)" :key="`${link.url}-${index}`" :href="link.url" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-secondary">{{ link.label }} <i class="fa-solid fa-arrow-up-right-from-square ms-1"></i></a>
        </div>
      </div>

      <div v-if="!isBerjalan" class="mb-5">
        <div class="mb-2 flex items-center justify-between gap-2"><h4 class="mb-0 text-sm font-bold text-gray-800">Checklist Dokumen Ajuan</h4><button class="btn btn-sm btn-outline-primary" @click="setChecklistStatus">Buat status dari checklist</button></div>
        <div class="grid gap-2 sm:grid-cols-2">
          <label v-for="document in ajuanDocuments" :key="document.id" class="flex items-start gap-2 rounded-lg border border-gray-200 p-2 text-sm">
            <input class="form-check-input mt-1" type="checkbox" :checked="checkedDocuments.includes(document.label)" @change="toggleDocument(document.label)">
            <span>{{ document.label }}</span>
          </label>
        </div>
      </div>
      <div v-else class="mb-5 space-y-4">
        <div class="mb-2 flex items-center justify-between gap-2"><h4 class="mb-0 text-sm font-bold text-gray-800">Checklist Bulan Berjalan</h4><button class="btn btn-sm btn-outline-primary" @click="setChecklistStatus">Buat status dari checklist</button></div>
        <fieldset v-for="(group, key) in { skam: 'Surat Keterangan Aktif Mengajar', lapkin: 'Laporan Kinerja / Jurnal', hadir: 'Daftar Hadir / Presensi' }" :key="key" class="rounded-xl border border-gray-200 p-3">
          <legend class="float-none mb-2 w-auto px-1 text-sm font-semibold">{{ group }}</legend>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label v-for="month in months" :key="month" class="flex items-center gap-2 text-sm">
              <input class="form-check-input" type="checkbox" :checked="checkedMonths[key].includes(month)" @change="toggleMonth(key, month)">{{ month }}
            </label>
          </div>
        </fieldset>
      </div>

      <label for="verval-status" class="mb-2 block text-sm font-bold text-gray-800">Status Perbaikan / Catatan</label>
      <textarea id="verval-status" v-model="editStatus" rows="4" maxlength="2000" class="form-control mb-4" placeholder="Tulis Lengkap, Perbaikan, atau catatan khusus..."></textarea>
      <p v-if="errorMessage" class="alert alert-danger py-2 text-sm" role="alert">{{ errorMessage }}</p>
      <div class="flex flex-wrap justify-end gap-2">
        <button class="btn btn-outline-secondary" :disabled="saving" @click="editing = null">Batal</button>
        <button class="btn btn-primary" :disabled="saving" @click="saveVerification"><span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>Simpan Status</button>
      </div>
    </section>
  </div>
  </div>
</template>

<style scoped>
.verification-overlay { z-index: 80; background: rgba(15, 23, 42, .7); }
.verification-dialog { max-height: 92vh; }
.filter-controls { display: grid; grid-template-columns: minmax(0, 1fr); gap: .5rem; }
.sort-button { border: 0; background: transparent; color: inherit; font-weight: 700; padding: 0; white-space: nowrap; }
@media (min-width: 640px) {
    .filter-controls { grid-template-columns: minmax(0, 1fr) 14rem; }
}
.sort-button span { margin-left: .25rem; opacity: .65; }
</style>
