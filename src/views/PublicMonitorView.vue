<script setup>
import { computed, ref, watch } from 'vue';
import portalApi from '../services/api.js';

const props = defineProps({
    workflow: { type: String, required: true },
    title: { type: String, required: true },
    period: { type: String, required: true }
});
const allData = ref([]);
const loading = ref(true);
const errorMessage = ref('');
const query = ref('');
const statusFilter = ref('');
const page = ref(1);
const pageSize = 12;

function isSubmitted(row) {
    const status = String(row.keterangan || '').toLowerCase();
    return status.includes('sudah') || status.includes('lengkap');
}

function isCorrection(row) {
    const correction = String(row.perbaikan || '').trim().toLowerCase();
    return correction.length > 0 && correction !== 'belum dicek' &&
        !/\blengkap\b/.test(correction) && !correction.includes('sudah print') &&
        !correction.includes('catatan khusus:');
}

const submittedCount = computed(() => allData.value.filter(isSubmitted).length);
const pendingCount = computed(() => allData.value.length - submittedCount.value);
const correctionCount = computed(() => allData.value.filter(row => {
    const status = String(row.perbaikan || '').trim().toLowerCase();
    return status.length > 0 && status !== 'belum dicek' && !/\blengkap\b/.test(status) && !status.includes('sudah print');
}).length);
const filteredData = computed(() => {
    const keyword = query.value.trim().toLocaleLowerCase('id');
    return allData.value.filter(row => {
        const textMatches = !keyword || [row.nama, row.kabkota, row.satminkal]
            .some(value => String(value || '').toLocaleLowerCase('id').includes(keyword));
        if (!textMatches) return false;
        if (statusFilter.value === 'sudah') return isSubmitted(row);
        if (statusFilter.value === 'belum') return !isSubmitted(row);
        if (statusFilter.value === 'perbaikan') return isCorrection(row);
        if (statusFilter.value === 'catatan') return String(row.perbaikan || '').toLowerCase().includes('catatan khusus:');
        return true;
    });
});
const pageCount = computed(() => Math.max(1, Math.ceil(filteredData.value.length / pageSize)));
const pageData = computed(() => filteredData.value.slice((page.value - 1) * pageSize, page.value * pageSize));

function statusClass(value) {
    const status = String(value || '').toLowerCase();
    if (status.includes('belum dicek')) return 'badge bg-light text-secondary border';
    if (status.includes('catatan khusus')) return 'badge bg-primary-subtle text-primary-emphasis border border-primary-subtle text-wrap';
    if (status.includes('perbaikan')) return 'badge bg-warning-subtle text-dark border border-warning-subtle text-wrap';
    if (status.includes('lengkap')) return 'badge bg-success-subtle text-success-emphasis border border-success-subtle';
    if (status.includes('sudah print')) return 'badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
    return 'badge bg-light text-dark border text-wrap';
}

function collectionClass(value) {
    const status = String(value || '').toLowerCase();
    if (!status || status.includes('belum')) return 'badge bg-danger-subtle text-danger-emphasis border border-danger-subtle';
    if (status.includes('sudah') || status.includes('lengkap')) return 'badge bg-success-subtle text-success-emphasis border border-success-subtle';
    return 'badge bg-light text-secondary border';
}

async function loadData() {
    document.body.dataset.portalWorkflow = props.workflow;
    loading.value = true;
    errorMessage.value = '';
    try {
        const result = await portalApi.publicCall('ambilDataSheetPengumpulanIndex2', []);
        if (!result || !Array.isArray(result.dataList)) throw new Error('api_invalid_response');
        allData.value = result.dataList.map((row, index) => ({
            ...row,
            no: row.no || index + 1,
            keterangan: row.keterangan || 'Belum Mengumpulkan',
            perbaikan: row.perbaikan || 'Belum dicek'
        }));
    } catch (error) {
        errorMessage.value = portalApi.showApiError(error);
    } finally {
        loading.value = false;
    }
}

watch([query, statusFilter], () => { page.value = 1; });
watch(() => props.workflow, loadData, { immediate: true });
</script>

<template>
  <section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-8">
    <div class="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="mb-1 text-xs font-bold uppercase tracking-wide text-blue-700">{{ period }}</p>
        <h2 class="mb-1 text-2xl font-bold text-gray-900">{{ title }}</h2>
        <p class="mb-0 text-sm text-gray-600">Status pengumpulan dan verifikasi berkas.</p>
      </div>
      <RouterLink to="/" class="btn btn-outline-primary d-inline-flex align-items-center gap-2 rounded-pill px-4 py-2 fw-semibold align-self-start">
        <span aria-hidden="true">←</span>Kembali
      </RouterLink>
    </div>

    <div class="mb-6 grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl border border-green-200 bg-green-50 p-4">
        <p class="mb-1 text-xs font-bold uppercase tracking-wide text-green-800">Sudah Mengumpulkan</p>
        <p class="mb-0 text-3xl font-bold text-green-800">{{ submittedCount }}</p>
      </div>
      <div class="rounded-xl border border-red-200 bg-red-50 p-4">
        <p class="mb-1 text-xs font-bold uppercase tracking-wide text-red-800">Belum Mengumpulkan</p>
        <p class="mb-0 text-3xl font-bold text-red-800">{{ pendingCount }}</p>
      </div>
      <div class="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
        <p class="mb-1 text-xs font-bold uppercase tracking-wide text-yellow-900">Perlu Perbaikan</p>
        <p class="mb-0 text-3xl font-bold text-yellow-900">{{ correctionCount }}</p>
      </div>
    </div>

    <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h3 class="mb-0 text-lg font-bold text-gray-900">Tabel Rekapitulasi</h3>
      <div class="flex flex-col gap-2 sm:flex-row">
        <input v-model="query" type="search" class="form-control form-control-sm min-w-64" placeholder="Cari nama, daerah, atau sekolah..." aria-label="Cari data">
        <select v-model="statusFilter" class="form-select form-select-sm sm:w-52" aria-label="Filter status">
          <option value="">Semua status</option>
          <option value="sudah">Sudah mengumpulkan</option>
          <option value="belum">Belum mengumpulkan</option>
          <option value="perbaikan">Perlu perbaikan</option>
          <option value="catatan">Catatan khusus</option>
        </select>
      </div>
    </div>
    <p class="mb-3 text-xs text-gray-500">Menampilkan {{ filteredData.length }} dari {{ allData.length }} data</p>

    <div v-if="loading" class="rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-600">
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Memuat data dari server...
    </div>
    <div v-else-if="errorMessage" class="alert alert-danger" role="alert">{{ errorMessage }}</div>
    <div v-else class="space-y-3 md:hidden">
      <article v-for="row in pageData" :key="`card-${row.no}-${row.nama}`" class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div class="mb-2 flex items-start justify-between gap-2">
          <h4 class="mb-0 text-base font-semibold text-gray-900">{{ row.nama }}</h4>
          <span class="text-xs text-gray-500">#{{ row.no }}</span>
        </div>
        <dl class="mb-3 space-y-1 text-sm">
          <div class="flex gap-2"><dt class="w-20 shrink-0 text-gray-500">Kab/Kota</dt><dd class="mb-0 text-gray-800">{{ row.kabkota }}</dd></div>
          <div class="flex gap-2"><dt class="w-20 shrink-0 text-gray-500">Satminkal</dt><dd class="mb-0 text-gray-800">{{ row.satminkal }}</dd></div>
        </dl>
        <div class="flex flex-wrap gap-2">
          <span :class="collectionClass(row.keterangan)">{{ row.keterangan }}</span>
          <span :class="[statusClass(row.perbaikan), 'text-start']">{{ row.perbaikan }}</span>
        </div>
      </article>
      <p v-if="pageData.length === 0" class="rounded-xl border border-gray-200 py-5 text-center text-sm text-gray-500">Tidak ada data yang sesuai dengan pencarian.</p>
    </div>
    <div v-if="!loading && !errorMessage" class="table-responsive hidden overflow-hidden rounded-xl border border-gray-200 md:block">
      <table class="table table-hover mb-0 align-middle">
        <thead class="table-light"><tr><th>No</th><th>Nama Guru</th><th>Kab/Kota</th><th>Satminkal / Sekolah</th><th>Keterangan</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="row in pageData" :key="`${row.no}-${row.nama}`">
            <td class="text-secondary">{{ row.no }}</td>
            <td class="fw-semibold text-dark">{{ row.nama }}</td>
            <td>{{ row.kabkota }}</td>
            <td class="min-w-48">{{ row.satminkal }}</td>
            <td><span :class="collectionClass(row.keterangan)">{{ row.keterangan }}</span></td>
            <td><span :class="[statusClass(row.perbaikan), 'text-start']">{{ row.perbaikan }}</span></td>
          </tr>
          <tr v-if="pageData.length === 0"><td colspan="6" class="py-5 text-center text-sm text-gray-500">Tidak ada data yang sesuai dengan pencarian.</td></tr>
        </tbody>
      </table>
    </div>
    <div v-if="!loading && !errorMessage && pageData.length" class="mt-4 flex flex-wrap items-center justify-between gap-3">
      <button class="btn btn-outline-secondary btn-sm" :disabled="page === 1" @click="page--">← Sebelumnya</button>
      <span class="text-sm text-gray-600">Halaman {{ page }} dari {{ pageCount }}</span>
      <button class="btn btn-outline-secondary btn-sm" :disabled="page === pageCount" @click="page++">Selanjutnya →</button>
    </div>
  </section>
</template>
