<script setup>
  import {
    computed,
    ref,
    watch
  } from 'vue';
  import portalApi from '../services/api.js';
  import { teacherUploadLinks } from '../config/teacherUploadLinks.js';
  const props = defineProps({
    workflow: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    period: {
      type: String,
      required: true
    },
    combined: {
      type: Boolean,
      default: false
    }
  });
  const singlePageData = ref([]);
  const combinedRows = ref([]);
  const totalCount = ref(0);
  const filteredCount = ref(0);
  const submittedCount = ref(0);
  const pendingCount = ref(0);
  const correctionCount = ref(0);
  const summaryByPeriod = ref([]);
  const overviewCards = [{
    key: 'submitted',
    label: 'Sudah Mengumpulkan',
    cardClass: 'border-green-200 bg-green-50',
    textClass: 'text-green-800'
  }, {
    key: 'pending',
    label: 'Belum Mengumpulkan',
    cardClass: 'border-red-200 bg-red-50',
    textClass: 'text-red-800'
  }, {
    key: 'correction',
    label: 'Perlu Perbaikan',
    cardClass: 'border-yellow-200 bg-yellow-50',
    textClass: 'text-yellow-900'
  }];
  const loading = ref(true);
  const errorMessage = ref('');
  const query = ref('');
  const statusFilter = ref('');
  const page = ref(1);
  const pageSize = 12;
  const combinedTeacherGroups = computed(() => {
    const teachers = new Map();
    combinedRows.value.forEach(row => {
      const key = normalizeName(row.nama) || `${row.workflow}:${row.no}`;
      if (!teachers.has(key)) teachers.set(key, []);
      teachers.get(key).push(row);
    });
    return [...teachers.values()];
  });
  const pageCount = computed(() => props.combined ?
    Math.max(1, Math.ceil(combinedTeacherGroups.value.length / pageSize)) :
    Math.max(1, Math.ceil(filteredCount.value / pageSize)));
  const pageData = computed(() => props.combined ?
    combinedTeacherGroups.value
      .slice((page.value - 1) * pageSize, page.value * pageSize)
      .flat() :
    singlePageData.value);
  const pageTeacherGroups = computed(() => props.combined ?
    combinedTeacherGroups.value.slice((page.value - 1) * pageSize, page.value * pageSize) :
    pageData.value.map(row => [row]));
  const dataWorkflows = computed(() => props.combined ? [{
    workflow: `${props.workflow.startsWith('berjalan') ? 'berjalan' : 'ajuan'}JanJun`,
    period: 'Januari-Juni'
  }, {
    workflow: `${props.workflow.startsWith('berjalan') ? 'berjalan' : 'ajuan'}JulDes`,
    period: 'Juli-Desember'
  }] : [{
    workflow: props.workflow,
    period: props.period
  }]);
  function normalizeName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function mergedFieldValue(rows, field) {
    const values = rows.map(row => String(row[field] || '').trim() || '—');
    if (new Set(values).size === 1) return values[0];
    return rows.map((row, index) => `${row.periode}: ${values[index]}`).join(' / ');
  }
  function uploadUrlFor(row) {
    return teacherUploadLinks[row.workflow] || '';
  }
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
  let loadSequence = 0;
  let searchTimer;
  async function loadData() {
    const sequence = ++loadSequence;
    document.body.dataset.portalWorkflow = props.workflow;
    loading.value = true;
    errorMessage.value = '';
    if (props.combined) {
      summaryByPeriod.value = dataWorkflows.value.map(source => ({
        ...source,
        available: false,
        summary: {}
      }));
    }
    try {
      const results = await Promise.all(dataWorkflows.value.map(async source => {
        try {
          const fetchPage = async pageNumber => {
            const result = await portalApi.publicCall('ambilDataSheetPengumpulanIndex2', [], {
              page: pageNumber,
              pageSize: props.combined ? 50 : pageSize,
              q: query.value.trim(),
              status: statusFilter.value,
              workflow: source.workflow
            });
            if (!result || !Array.isArray(result.dataList) ||
              !Number.isInteger(result.filteredCount) ||
              !Number.isInteger(result.totalCount) ||
              !Number.isInteger(result.submittedCount) ||
              !Number.isInteger(result.pendingCount) ||
              !Number.isInteger(result.correctionCount)) {
              throw new Error('api_invalid_response');
            }
            return result;
          };
          const result = await fetchPage(props.combined ? 1 : page.value);
          let dataList = result.dataList;
          if (props.combined) {
            const sourcePages = Math.ceil(result.filteredCount / 50);
            if (sourcePages > 1) {
              const remainingPages = await Promise.all(
                Array.from({ length: sourcePages - 1 }, (_, index) => fetchPage(index + 2))
              );
              if (remainingPages.some(pageResult =>
                pageResult.filteredCount !== result.filteredCount ||
                pageResult.totalCount !== result.totalCount
              )) {
                throw new Error('api_invalid_response');
              }
              dataList = dataList.concat(...remainingPages.map(pageResult => pageResult.dataList));
            }
            if (dataList.length !== result.filteredCount) throw new Error('api_invalid_response');
          }
          return { ...source, result, dataList };
        } catch (error) {
          return { ...source, error };
        }
      }));
      if (sequence !== loadSequence) return;
      const loaded = results.filter(source => !source.error);
      if (!loaded.length) throw results[0]?.error || new Error('api_invalid_response');

      totalCount.value = loaded.reduce((total, source) => total + source.result.totalCount, 0);
      filteredCount.value = loaded.reduce((total, source) => total + source.result.filteredCount, 0);
      submittedCount.value = loaded.reduce((total, source) => total + source.result.submittedCount, 0);
      pendingCount.value = loaded.reduce((total, source) => total + source.result.pendingCount, 0);
      correctionCount.value = loaded.reduce((total, source) => total + source.result.correctionCount, 0);
      summaryByPeriod.value = dataWorkflows.value.map(source => {
        const loadedSource = loaded.find(item => item.workflow === source.workflow);
        return {
          ...source,
          available: Boolean(loadedSource),
          summary: loadedSource ? {
            submitted: loadedSource.result.submittedCount,
            pending: loadedSource.result.pendingCount,
            correction: loadedSource.result.correctionCount
          } : {}
        };
      });

      const rows = loaded.flatMap(source => source.dataList.map((row, index) => ({
        ...row,
        workflow: source.workflow,
        periode: source.period,
        no: row.no || index + 1,
        keterangan: row.keterangan || 'Belum Mengumpulkan',
        perbaikan: row.perbaikan || 'Belum dicek'
      })));
      if (props.combined) {
        const teachers = new Map();
        rows.forEach(row => {
          const key = normalizeName(row.nama) || `${row.workflow}:${row.no}`;
          if (!teachers.has(key)) teachers.set(key, []);
          teachers.get(key).push(row);
        });
        combinedRows.value = [...teachers.values()].flatMap((teacherRows, index) =>
          teacherRows
            .sort((a, b) => a.workflow.localeCompare(b.workflow))
            .map(row => ({
              ...row,
              no: index + 1
            }))
        );
        singlePageData.value = [];
      } else {
        singlePageData.value = rows;
        combinedRows.value = [];
      }
      const failed = results.filter(source => source.error);
      if (failed.length) {
        errorMessage.value = failed.map(source =>
          `Data periode ${source.period} tidak dapat dimuat: ${portalApi.showApiError(source.error)}`
        ).join(' ');
      }
    } catch (error) {
      if (sequence === loadSequence) {
        singlePageData.value = [];
        combinedRows.value = [];
        totalCount.value = 0;
        filteredCount.value = 0;
        submittedCount.value = 0;
        pendingCount.value = 0;
        correctionCount.value = 0;
        if (props.combined) {
          summaryByPeriod.value = dataWorkflows.value.map(source => ({
            ...source,
            available: false,
            summary: {}
          }));
        }
        errorMessage.value = portalApi.showApiError(error);
      }
    } finally {
      if (sequence === loadSequence) loading.value = false;
    }
  }
  watch([query, statusFilter], () => {
    const pageWillReset = page.value !== 1;
    page.value = 1;
    clearTimeout(searchTimer);
    if (pageWillReset && !props.combined) return;
    searchTimer = setTimeout(loadData, 300);
  });
  watch(page, () => {
    if (!props.combined) void loadData();
  });
  watch(() => props.workflow, () => {
    clearTimeout(searchTimer);
    page.value = 1;
    loadData();
  }, {
    immediate: true
  });
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
    <div v-if="combined" class="mb-6 flex flex-col gap-4">
      <section v-for="periodSummary in summaryByPeriod" :key="periodSummary.workflow" class="rounded-xl border border-gray-200 bg-white p-4">
        <h3 class="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700">{{ periodSummary.period }}</h3>
        <div class="grid gap-3 sm:grid-cols-3">
          <div v-for="card in overviewCards" :key="card.key" class="rounded-xl border p-4" :class="card.cardClass">
            <p class="mb-1 text-xs font-bold uppercase tracking-wide" :class="card.textClass">{{ card.label }}</p>
            <p class="mb-0 text-3xl font-bold" :class="card.textClass">{{ periodSummary.available ? periodSummary.summary[card.key] : '—' }}</p>
          </div>
        </div>
      </section>
    </div>
    <div v-else class="mb-6 grid gap-3 sm:grid-cols-3">
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
        <input v-model="query" type="search" maxlength="100" class="form-control form-control-sm min-w-64" placeholder="Cari nama, daerah, atau sekolah..." aria-label="Cari data">
        <select v-model="statusFilter" class="form-select form-select-sm sm:w-52" aria-label="Filter status">
            <option value="">Semua status</option>
            <option value="sudah">Sudah mengumpulkan</option>
            <option value="belum">Belum mengumpulkan</option>
            <option value="perbaikan">Perlu perbaikan</option>
            <option value="catatan">Catatan khusus</option>
          </select>
      </div>
    </div>
    <p class="mb-3 text-xs text-gray-500">Menampilkan {{ pageData.length }} dari {{ filteredCount }} hasil ({{ totalCount }} total data)</p>
    <div v-if="errorMessage" class="alert mb-3" :class="pageData.length ? 'alert-warning' : 'alert-danger'" role="alert">{{ errorMessage }}</div>
    <div v-if="loading" class="rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-600">
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Memuat data dari server...
    </div>
    <div v-else-if="combined" class="space-y-3 lg:hidden">
      <article v-for="teacherRows in pageTeacherGroups" :key="`card-${teacherRows[0].nama}`" class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div class="mb-2 flex items-start justify-between gap-2">
          <h4 class="mb-0 text-base font-semibold text-gray-900">{{ teacherRows[0].nama }}</h4>
          <span class="text-xs text-gray-500">#{{ teacherRows[0].no }}</span>
        </div>
        <dl class="mb-3 space-y-1 text-sm">
          <div class="flex gap-2"><dt class="w-24 shrink-0 text-gray-500">Kab/Kota</dt>
            <dd class="mb-0 text-gray-800">{{ mergedFieldValue(teacherRows, 'kabkota') }}</dd>
          </div>
          <div class="flex gap-2"><dt class="w-24 shrink-0 text-gray-500">Satminkal</dt>
            <dd class="mb-0 text-gray-800">{{ mergedFieldValue(teacherRows, 'satminkal') }}</dd>
          </div>
        </dl>
        <div v-for="row in teacherRows" :key="`period-${row.workflow}-${row.no}`" class="border-t border-gray-100 py-3 last:pb-0">
          <p class="mb-2 text-sm font-semibold text-gray-700">{{ row.periode }}</p>
          <div class="flex flex-wrap gap-2">
            <span :class="collectionClass(row.keterangan)">{{ row.keterangan }}</span>
            <span :class="[statusClass(row.perbaikan), 'text-start']">{{ row.perbaikan }}</span>
          </div>
          <a
            v-if="uploadUrlFor(row)"
            :href="uploadUrlFor(row)"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-outline-primary btn-sm mt-3"
          >
            <i class="fa-solid fa-upload me-1"></i>Unggah Berkas
          </a>
        </div>
      </article>
      <p v-if="pageData.length === 0" class="rounded-xl border border-gray-200 py-5 text-center text-sm text-gray-500">Tidak ada data yang sesuai dengan pencarian.</p>
    </div>
    <div v-else class="space-y-3 lg:hidden">
      <article v-for="row in pageData" :key="`card-${row.workflow}-${row.no}-${row.nama}`" class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div class="mb-2 flex items-start justify-between gap-2">
          <h4 class="mb-0 text-base font-semibold text-gray-900">{{ row.nama }}</h4>
          <span class="text-xs text-gray-500">#{{ row.no }}</span>
        </div>
        <dl class="mb-3 space-y-1 text-sm">
          <div class="flex gap-2"><dt class="w-20 shrink-0 text-gray-500">Kab/Kota</dt>
            <dd class="mb-0 text-gray-800">{{ row.kabkota }}</dd>
          </div>
          <div class="flex gap-2"><dt class="w-20 shrink-0 text-gray-500">Satminkal</dt>
            <dd class="mb-0 text-gray-800">{{ row.satminkal }}</dd>
          </div>
        </dl>
        <div class="flex flex-wrap gap-2">
          <span :class="collectionClass(row.keterangan)">{{ row.keterangan }}</span>
          <span :class="[statusClass(row.perbaikan), 'text-start']">{{ row.perbaikan }}</span>
        </div>
        <a
          v-if="uploadUrlFor(row)"
          :href="uploadUrlFor(row)"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-outline-primary btn-sm mt-3"
        >
          <i class="fa-solid fa-upload me-1"></i>Unggah Berkas
        </a>
      </article>
      <p v-if="pageData.length === 0" class="rounded-xl border border-gray-200 py-5 text-center text-sm text-gray-500">Tidak ada data yang sesuai dengan pencarian.</p>
    </div>
    <div v-if="!loading" class="table-responsive hidden touch-pan-x overflow-x-auto overscroll-x-contain rounded-xl border border-gray-200 lg:block">
      <table class="table table-hover table-fixed public-monitor-table mb-0 align-middle">
        <colgroup v-if="combined">
          <col style="width: 4%">
          <col style="width: 17%">
          <col style="width: 12%">
          <col style="width: 15%">
          <col style="width: 10%">
          <col style="width: 14%">
          <col style="width: 17%">
          <col style="width: 11%">
        </colgroup>
        <colgroup v-else>
          <col style="width: 5%">
          <col style="width: 19%">
          <col style="width: 14%">
          <col style="width: 18%">
          <col style="width: 15%">
          <col style="width: 17%">
          <col style="width: 12%">
        </colgroup>
        <thead class="table-light">
          <tr>
            <th>No</th>
            <th>Nama Guru</th>
            <th>Kab/Kota</th>
            <th>Satminkal / Sekolah</th>
            <th v-if="combined">Periode</th>
            <th>Keterangan</th>
            <th>Verval</th>
            <th>Unggah Berkas</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="combined">
            <template v-for="teacherRows in pageTeacherGroups" :key="`${teacherRows[0].workflow}-${teacherRows[0].nama}`">
              <tr v-for="(row, rowIndex) in teacherRows" :key="`${row.workflow}-${row.no}-${row.nama}`">
                <template v-if="rowIndex === 0">
                  <td :rowspan="teacherRows.length" class="text-secondary">{{ teacherRows[0].no }}</td>
                  <td :rowspan="teacherRows.length" class="fw-semibold text-dark">{{ teacherRows[0].nama }}</td>
                  <td :rowspan="teacherRows.length">{{ mergedFieldValue(teacherRows, 'kabkota') }}</td>
                  <td :rowspan="teacherRows.length" class="min-w-48">{{ mergedFieldValue(teacherRows, 'satminkal') }}</td>
                </template>
                <td>{{ row.periode }}</td>
                <td><span :class="[collectionClass(row.keterangan), 'text-wrap']">{{ row.keterangan }}</span></td>
                <td><span :class="[statusClass(row.perbaikan), 'text-start', 'text-wrap']">{{ row.perbaikan }}</span></td>
                <td>
                  <a
                    v-if="uploadUrlFor(row)"
                    :href="uploadUrlFor(row)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-outline-primary btn-sm text-nowrap"
                  >
                    <i class="fa-solid fa-upload me-1"></i>Unggah
                  </a>
                  <span v-else class="text-secondary">—</span>
                </td>
              </tr>
            </template>
          </template>
          <template v-else>
            <tr v-for="row in pageData" :key="`${row.workflow}-${row.no}-${row.nama}`">
              <td class="text-secondary">{{ row.no }}</td>
              <td class="fw-semibold text-dark">{{ row.nama }}</td>
              <td>{{ row.kabkota }}</td>
              <td class="min-w-48">{{ row.satminkal }}</td>
              <td><span :class="[collectionClass(row.keterangan), 'text-wrap']">{{ row.keterangan }}</span></td>
              <td><span :class="[statusClass(row.perbaikan), 'text-start', 'text-wrap']">{{ row.perbaikan }}</span></td>
              <td>
                <a
                  v-if="uploadUrlFor(row)"
                  :href="uploadUrlFor(row)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-outline-primary btn-sm text-nowrap"
                >
                  <i class="fa-solid fa-upload me-1"></i>Unggah
                </a>
                <span v-else class="text-secondary">—</span>
              </td>
            </tr>
          </template>
          <tr v-if="pageData.length === 0">
            <td :colspan="combined ? 8 : 7" class="py-5 text-center text-sm text-gray-500">Tidak ada data yang sesuai dengan pencarian.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="!loading && pageData.length" class="mt-4 flex flex-wrap items-center justify-between gap-3">
      <button class="btn btn-outline-secondary btn-sm" :disabled="page === 1" @click="page--">← Sebelumnya</button>
      <span class="text-sm text-gray-600">Halaman {{ page }} dari {{ pageCount }}</span>
      <button class="btn btn-outline-secondary btn-sm" :disabled="page === pageCount" @click="page++">Selanjutnya →</button>
    </div>
  </section>
</template>

<style scoped>
  .public-monitor-table {
    width: 100%;
    table-layout: fixed;
  }
  .public-monitor-table th,
  .public-monitor-table td {
    overflow-wrap: anywhere;
  }
</style>
