<script setup>
  import {
    computed,
    ref
  } from 'vue';
  const searchApiUrl = 'https://script.google.com/macros/s/AKfycbxq4ZIhzpZjOSiqNfNnT8kudjPdZCm4WBE33bjcAkP9JiqVDGLE7cCpQ_pjpSNJxNz0Xw/exec';
  const deviceIdStorageKey = 'teacher-search-device-id-v1';
  const regions = [
    ['KAB. BANJARNEGARA', 'Kab Banjarnegara'],
    ['KAB. BANYUMAS', 'Kab Banyumas'],
    ['KAB. BATANG', 'Kab Batang'],
    ['KAB. BLORA', 'Kab Blora'],
    ['KAB. BOYOLALI', 'Kab Boyolali'],
    ['KAB. BREBES', 'Kab Brebes'],
    ['KAB. CILACAP', 'Kab Cilacap'],
    ['KAB. DEMAK', 'Kab Demak'],
    ['KAB. GROBOGAN', 'Kab Grobogan'],
    ['KAB. JEPARA', 'Kab Jepara'],
    ['KAB. KARANGANYAR', 'Kab Karanganyar'],
    ['KAB. KEBUMEN', 'Kab Kebumen'],
    ['KAB. KENDAL', 'Kab Kendal'],
    ['KAB. KLATEN', 'Kab Klaten'],
    ['KAB. KUDUS', 'Kab Kudus'],
    ['KAB. MAGELANG', 'Kab Magelang'],
    ['KAB. PATI', 'Kab Pati'],
    ['KAB. PEKALONGAN', 'Kab Pekalongan'],
    ['KAB. PEMALANG', 'Kab Pemalang'],
    ['KAB. PURBALINGGA', 'Kab Purbalingga'],
    ['KAB. PURWOREJO', 'Kab Purworejo'],
    ['KAB. REMBANG', 'Kab Rembang'],
    ['KAB. SEMARANG', 'Kab Semarang'],
    ['KAB. SRAGEN', 'Kab Sragen'],
    ['KAB. SUKOHARJO', 'Kab Sukoharjo'],
    ['KAB. TEGAL', 'Kab Tegal'],
    ['KAB. TEMANGGUNG', 'Kab Temanggung'],
    ['KAB. WONOGIRI', 'Kab Wonogiri'],
    ['KAB. WONOSOBO', 'Kab Wonosobo'],
    ['KOTA MAGELANG', 'Kota Magelang'],
    ['KOTA PEKALONGAN', 'Kota Pekalongan'],
    ['KOTA SALATIGA', 'Kota Salatiga'],
    ['KOTA SEMARANG', 'Kota Semarang'],
    ['KOTA SURAKARTA', 'Kota Surakarta'],
    ['KOTA TEGAL', 'Kota Tegal']
  ];
  const teacherPeriods = [{
      label: 'PERIODE 1',
      title: 'Januari - Juni 2026',
      cards: [{
          title: 'Berkas Ajuan',
          description: 'Berkas Ajuan Januari-Juni',
          icon: 'fa-file-arrow-up',
          color: 'blue',
          uploadUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSdxJNOyeah3yMU0wXV9Hhb5X5KGJkQ4uNqMJfxSt5zn7Q4QHQ/viewform',
          uploadToast: 'Membuka Form Upload Ajuan Sem 1...',
          monitorUrl: '/pantau/ajuan-janjun.html',
          monitorToast: 'Membuka Pantauan Ajuan Sem 1...'
        },
        {
          title: 'Bulan Berjalan',
          description: 'Berkas Bulan Berjalan Januari-Juni',
          icon: 'fa-calendar-check',
          color: 'green',
          uploadUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfXcEB1EOV1b8n8w8H-tpRYZjsBjGT48hycdQP3Lu5CPwb-5A/viewform',
          uploadToast: 'Membuka Form Upload Berjalan Sem 1...',
          monitorUrl: '/pantau/berjalan-janjun.html',
          monitorToast: 'Membuka Pantauan Berjalan Sem 1...'
        }
      ]
    },
    {
      label: 'PERIODE 2',
      title: 'Juli - Desember 2026',
      subdued: true,
      cards: [{
          title: 'Berkas Ajuan',
          description: 'Berkas Ajuan Juli-Desember',
          icon: 'fa-file-arrow-up',
          color: 'blue',
          subdued: true,
          uploadUrl: 'https://docs.google.com/forms/d/e/1FAIpQLScGJ-o1e89Y-haRRrSWIxBT4rXvQvbXXDw0kMwJBYASBIUCJQ/viewform?usp=publish-editor',
          uploadToast: 'Membuka Form Upload Ajuan Sem 2...',
          monitorUrl: '/pantau/ajuan-juldes.html',
          monitorToast: 'Membuka Pantauan Ajuan Sem 2...'
        },
        {
          title: 'Bulan Berjalan',
          description: 'Berkas Bulan Berjalan Juli-Desember 2026',
          icon: 'fa-calendar-check',
          color: 'green',
          subdued: true,
          uploadUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSe6m3kVWFc-Ue8bGXwg4E4hfk8EUSMhluyBd6XcFu7KS31dRQ/viewform?usp=publish-editor',
          uploadToast: 'Membuka Form Upload Berjalan Sem 2...',
          monitorUrl: '/pantau/berjalan-juldes.html',
          monitorToast: 'Membuka Pantauan Berjalan Sem 2...'
        }
      ]
    }
  ];
  const spkkCards = [{
      title: 'Berkas Ajuan',
      description: 'Berkas Ajuan Tenaga Kependidikan SPKK Januari-Juni dan Juli-Desember',
      icon: 'fa-file-arrow-up',
      color: 'blue',
      uploadUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfxrBymaLpMdPsPrdy7yNxjoVDY0k43xRIb6A3-IQ2k87mPHA/viewform',
      uploadToast: 'Membuka Form Upload Ajuan Sem 1...'
    },
    {
      title: 'Bulan Berjalan',
      description: 'Berkas Bulan Berjalan Tenaga Kependidikan SPKK Januari-Juni dan Juli-Desember',
      icon: 'fa-calendar-check',
      color: 'green',
      uploadUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfZL71tAamCB2F2s-Wdj1QWZpyMO-GvVSjvgTW34JJrPnTixQ/viewform',
      uploadToast: 'Membuka Form Upload Berjalan Sem 1...'
    }
  ];
  const generalLinks = [{
      href: 'https://docs.google.com/forms/d/e/1FAIpQLSe2fBkoKafX7YyElnvhXQBgu_YlREWowjRsQkqHchUw3kJl8A/viewform?usp=dialog',
      icon: 'fa-paper-plane',
      label: 'Update Usulan / Usulan Baru',
      toast: 'Membuka Update Usulan...'
    },
    {
      href: 'https://drive.google.com/drive/folders/1N67p-TTXrkqtl0TERoctiJh1nxo2kyGe?usp=sharing',
      icon: 'fa-book',
      label: 'Regulasi',
      toast: 'Membuka Regulasi...'
    },
    {
      href: 'https://drive.google.com/drive/folders/1J_nsPqy-HKuSrYjh5U7MAG4WMUkVm40H?usp=drive_link',
      icon: 'fa-file',
      label: 'Format',
      toast: 'Membuka Format...'
    },
    {
      href: 'https://drive.google.com/file/d/1gKj-lD36JnEKbkjEPOtKlad000XEeZW8',
      icon: 'fa-print',
      label: 'Materi PPT Sosialisasi',
      toast: 'Membuka Materi PPT Sosialisasi...'
    }
  ];
  const query = ref('');
  const region = ref('');
  const captchaToken = ref('');
  const captchaImage = ref('');
  const captchaAnswer = ref('');
  const remaining = ref(null);
  const status = ref('');
  const isError = ref(false);
  const loading = ref(false);
  const teachers = ref([]);
  const currentPage = ref(1);
  const pageSize = 5;
  const pageCount = computed(() => Math.ceil(teachers.value.length / pageSize));
  const pageTeachers = computed(() => teachers.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize));
  function showToast(message) {
    window.dispatchEvent(new CustomEvent('portal-toast', {
      detail: message
    }));
  }
  function createDeviceId() {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  function getDeviceId() {
    let id;
    try {
      id = window.localStorage.getItem(deviceIdStorageKey);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '')) {
        id = createDeviceId();
        window.localStorage.setItem(deviceIdStorageKey, id);
      }
    } catch {
      throw new Error('device_storage_unavailable');
    }
    return id;
  }
  async function requestSearchApi(params) {
    const url = new URL(searchApiUrl);
    Object.entries({ ...params,
      device: getDeviceId()
    }).forEach(([key, value]) => url.searchParams.set(key, value));
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: controller.signal
      });
      if (!response.ok) throw new Error('request_failed');
      const data = await response.json();
      if (!data || data.ok !== true) throw new Error(data?.error || 'request_failed');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('search_timeout');
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
  function describeError(error) {
    if (error.message === 'search_timeout') return 'Layanan pencarian merespons terlalu lama. Silakan coba lagi.';
    switch (error.message) {
      case 'not_configured':
        return 'Layanan pencarian belum dikonfigurasi.';
      case 'rate_limited':
        return 'Terlalu banyak permintaan. Coba lagi dalam beberapa saat.';
      case 'daily_limit':
        return 'Kuota pencarian hari ini sudah habis (maksimal 3 kali per hari). Coba lagi besok.';
      case 'device_storage_unavailable':
        return 'Pencarian memerlukan penyimpanan browser. Aktifkan penyimpanan situs lalu coba lagi.';
      case 'invalid_query':
        return 'Masukkan nama guru atau pilih Kab/Kota.';
      case 'captcha_failed':
        return 'Jawaban verifikasi salah atau kedaluwarsa. Silakan coba soal baru.';
      case 'not_found':
        return 'Data tidak ditemukan.';
      default:
        return 'Data guru gagal dimuat. Periksa koneksi, lalu coba lagi.';
    }
  }
  async function loadCaptcha() {
    const data = await requestSearchApi({
      action: 'captcha'
    });
    if (typeof data.token !== 'string' || !Number.isInteger(data.remaining) ||
      !String(data.image).startsWith('data:image/svg+xml;base64,')) {
      throw new Error('request_failed');
    }
    captchaToken.value = data.token;
    captchaImage.value = data.image;
    captchaAnswer.value = '';
    remaining.value = data.remaining;
  }
  async function submitSearch() {
    if (loading.value) return;
    const normalizedQuery = query.value.trim().replace(/\s+/g, ' ');
    isError.value = false;
    if (!normalizedQuery && !region.value) {
      isError.value = true;
      status.value = 'Masukkan nama guru atau pilih Kab/Kota.';
      return;
    }
    if (normalizedQuery.length > 100) {
      isError.value = true;
      status.value = 'Nama pencarian maksimal 100 karakter.';
      return;
    }
    loading.value = true;
    try {
      if (!captchaToken.value) {
        teachers.value = [];
        status.value = 'Memuat verifikasi...';
        await loadCaptcha();
        status.value = `Jawab soal verifikasi untuk melanjutkan pencarian. Sisa hari ini: ${remaining.value}.`;
        return;
      }
      if (!captchaAnswer.value.trim()) {
        isError.value = true;
        status.value = 'Masukkan jawaban verifikasi.';
        return;
      }
      status.value = 'Mencari data guru...';
      const data = await requestSearchApi({
        action: 'search',
        q: normalizedQuery,
        kab: region.value,
        token: captchaToken.value,
        answer: captchaAnswer.value.trim()
      });
      captchaToken.value = '';
      captchaImage.value = '';
      captchaAnswer.value = '';
      teachers.value = Array.isArray(data.results) ? data.results.map(row => ({
        name: String(row.name || ''),
        satminkal: String(row.satminkal || ''),
        kabKota: String(row.kabKota || '')
      })) : [];
      currentPage.value = 1;
      remaining.value = data.remaining;
      if (!teachers.value.length) status.value = `Data tidak ditemukan. Sisa pencarian hari ini: ${data.remaining}.`;
      else if (data.truncated) status.value = `${data.total} data ditemukan, menampilkan ${teachers.value.length} pertama. Perjelas nama atau pilih Kab/Kota. Sisa pencarian hari ini: ${data.remaining}.`;
      else status.value = `${teachers.value.length} data ditemukan. Sisa pencarian hari ini: ${data.remaining}.`;
    } catch (error) {
      isError.value = true;
      status.value = describeError(error);
      if (error.message === 'captcha_failed') {
        try {
          await loadCaptcha();
        } catch (captchaError) {
          captchaToken.value = '';
          captchaImage.value = '';
          status.value = `${describeError(error)} ${describeError(captchaError)}`;
        }
      } else {
        captchaToken.value = '';
        captchaImage.value = '';
      }
    } finally {
      loading.value = false;
    }
  }
  async function refreshCaptcha() {
    loading.value = true;
    try {
      await loadCaptcha();
      status.value = `Jawab soal verifikasi. Sisa hari ini: ${remaining.value}.`;
      isError.value = false;
    } catch (error) {
      isError.value = true;
      status.value = describeError(error);
      captchaToken.value = '';
      captchaImage.value = '';
    } finally {
      loading.value = false;
    }
  }
</script>

<template>
  <div class="home-page">
    <section class="home-general-section card-modern bg-white p-6 md:p-8 rounded-xl border border-gray-200 fade-in-up delay-1 mb-8">
      <div class="home-general-heading text-center mb-8">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-3">
          <i class="fa-solid fa-house text-blue-600"></i>
        </div>
        <h2 class="mb-0 text-2xl font-bold text-gray-800">Menu Umum</h2>
        <p class="mb-0 text-sm text-gray-500 mt-1 max-w-xl mx-auto">
          Menu untuk akses Update Usulan, Format, Regulasi, dan Daftar Penerima Insentif.
        </p>
      </div>
      <div class="home-general-links flex flex-col sm:flex-row gap-3 justify-center">
        <a v-for="link in generalLinks" :key="link.label" :href="link.href" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center border align-middle text-sm rounded-md py-2 px-4 shadow-sm flex-1" @click="showToast(link.toast)">
          <i class="fa-solid mr-2" :class="link.icon"></i>{{ link.label }}
        </a>
      </div>
    </section>
    <section class="home-search-section card-modern bg-white p-6 md:p-8 rounded-xl border border-gray-200 fade-in-up delay-2 mb-8" aria-labelledby="teacher-search-heading">
      <div class="home-search-heading text-center mb-6">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-3">
          <i class="fa-solid fa-magnifying-glass"></i>
        </div>
        <h2 id="teacher-search-heading" class="mb-0 text-2xl font-bold text-gray-800">Cari Data Penerima Insentif</h2>
        <p class="mb-0 text-sm text-gray-500 mt-1">Cari berdasarkan nama guru atau tenaga kependidikan penerima Insentif di lingkungan Bimas Kristen Kanwil Kemenag Prov. Jateng</p>
      </div>
      <form id="teacher-search-form" class="teacher-search-form" role="search" @submit.prevent="submitSearch">
        <label class="sr-only" for="teacher-name">Nama guru</label>
        <input id="teacher-name" v-model="query" class="teacher-search-input" name="teacher-name" type="search" placeholder="Ketik nama..." autocomplete="off" maxlength="100">
        <label class="sr-only" for="teacher-region">Kabupaten/Kota</label>
        <div class="teacher-search-location" :class="{ 'has-selection': region }">
          <i class="fa-solid fa-city teacher-search-location-icon" aria-hidden="true"></i>
          <select id="teacher-region" v-model="region" class="teacher-search-select">
              <option value="">Kab/Kota</option>
              <option v-for="[value, label] in regions" :key="value" :value="value">{{ label }}</option>
            </select>
        </div>
        <button v-if="!captchaToken" class="btn-primary teacher-search-button" type="submit" :disabled="loading">
            <i v-if="loading" class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true"></i>
            <i v-else class="fa-solid fa-magnifying-glass mr-2" aria-hidden="true"></i>
            <span>{{ loading ? 'Memproses...' : 'Cari' }}</span>
          </button>
      </form>
      <div v-if="captchaToken" class="teacher-search-captcha" role="group" aria-labelledby="teacher-search-captcha-question">
        <div class="teacher-search-captcha-content">
          <p id="teacher-search-captcha-question" class="teacher-search-captcha-question">Hitung soal matematika pada gambar:</p>
          <img :src="captchaImage" class="teacher-search-captcha-image" width="280" height="80" alt="Soal matematika verifikasi dalam bentuk gambar">
          <div class="teacher-search-captcha-controls">
            <label for="teacher-search-captcha-answer" class="teacher-search-captcha-answer-label">Jawaban</label>
            <input id="teacher-search-captcha-answer" v-model="captchaAnswer" class="teacher-search-captcha-input" type="number" inputmode="numeric" min="0" max="18" step="1" autocomplete="off" @keydown.enter.prevent="submitSearch">
            <button class="teacher-search-captcha-refresh" type="button" :disabled="loading" @click="refreshCaptcha">Ganti soal</button>
          </div>
          <p class="teacher-search-captcha-help">Jawab pertanyaan ini lalu pilih “Cari”.</p>
        </div>
        <div class="teacher-search-captcha-actions">
          <button class="btn-primary teacher-search-button" type="button" :disabled="loading" @click="submitSearch">
              <i v-if="loading" class="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true"></i>
              <i v-else class="fa-solid fa-magnifying-glass mr-2" aria-hidden="true"></i>
              Cari
            </button>
        </div>
      </div>
      <p class="teacher-search-status" :class="{ 'is-error': isError }" role="status" aria-live="polite">{{ status }}</p>
      <div v-if="teachers.length" class="teacher-results">
        <div class="teacher-results-scroll">
          <table class="teacher-results-table">
            <thead>
              <tr>
                <th scope="col">Nama</th>
                <th scope="col">Satminkal</th>
                <th scope="col">Kab/Kota</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(teacher, index) in pageTeachers" :key="`${teacher.name}-${index}`">
                <td class="fw-semibold">{{ teacher.name }}</td>
                <td>{{ teacher.satminkal }}</td>
                <td>{{ teacher.kabKota }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <nav v-if="pageCount > 1" class="teacher-pagination" aria-label="Navigasi halaman hasil pencarian">
          <button class="teacher-pagination-button" type="button" aria-label="Halaman sebelumnya" :disabled="currentPage === 1" @click="currentPage--"><i class="fa-solid fa-angle-left"></i></button>
          <span class="teacher-pagination-status">Halaman {{ currentPage }} dari {{ pageCount }}</span>
          <button class="teacher-pagination-button" type="button" aria-label="Halaman berikutnya" :disabled="currentPage === pageCount" @click="currentPage++"><i class="fa-solid fa-angle-right"></i></button>
        </nav>
      </div>
    </section>
    <section class="home-teacher-section card-modern bg-white p-6 md:p-8 rounded-xl border border-gray-200 fade-in-up delay-2 mb-8">
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-3">
          <i class="fa-solid fa-folder-open text-xl"></i>
        </div>
        <h2 class="mb-0 text-2xl font-bold text-gray-800">Layanan Pemberkasan Guru 2026</h2>
        <p class="mb-0 text-sm text-gray-500 mt-2 max-w-2xl mx-auto">
          Pilih periode semester yang sesuai. Pastikan Anda mengunggah pada kategori yang tepat (Berkas Ajuan Awal atau Laporan Bulan Berjalan).
        </p>
      </div>
      <div v-for="period in teacherPeriods" :key="period.label" class="home-service-period">
        <div class="home-service-period-heading flex items-center gap-3 mb-5 border-b border-gray-100 pb-3">
          <span class="text-white text-xs font-bold px-3 py-1.5 rounded-md tracking-wide shadow-sm" :class="period.subdued ? 'bg-gray-600' : 'bg-blue-600'">{{ period.label }}</span>
          <h3 class="mb-0 text-lg font-bold text-gray-700">{{ period.title }}</h3>
        </div>
        <div class="home-service-grid grid grid-cols-1 md:grid-cols-2 gap-5" :class="period.subdued && 'opacity-90 hover:opacity-100 transition-opacity'">
          <article v-for="card in period.cards" :key="card.title" class="home-service-card bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div class="absolute top-0 left-0 w-1.5 h-full transition-colors" :class="card.color === 'green' ? (card.subdued ? 'bg-green-400 group-hover:bg-green-500' : 'bg-green-500 group-hover:bg-green-600') : (card.subdued ? 'bg-blue-400 group-hover:bg-blue-500' : 'bg-blue-500 group-hover:bg-blue-600')"></div>
            <div class="home-service-card-heading flex items-start gap-4 mb-5 pl-2">
              <div class="p-2.5 rounded-lg" :class="card.subdued ? 'bg-gray-50' : card.color === 'green' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'">
                <i class="fa-solid text-xl" :class="[card.icon, card.subdued && (card.color === 'green' ? 'text-green-500' : 'text-blue-500')]"></i>
              </div>
              <div>
                <h4 class="mb-0 font-bold text-gray-800 text-lg">{{ card.title }}</h4>
                <p class="mb-0 text-xs text-gray-500 mt-0.5">{{ card.description }}</p>
              </div>
            </div>
            <div class="flex gap-3 pl-2">
              <a :href="card.uploadUrl" target="_blank" rel="noopener noreferrer" class="text-xs py-2 flex-1" :class="card.color === 'green' ? 'btn-secondary' : 'btn-primary'" @click="showToast(card.uploadToast)">
                <i class="fa-solid fa-upload mr-1.5"></i>Unggah
              </a>
              <RouterLink :to="card.monitorUrl" class="btn-outline home-monitor-button border-blue-200 text-blue-700 hover:bg-blue-50 text-xs py-2 flex-1 flex items-center justify-center" @click="showToast(card.monitorToast)">
                <i class="fa-solid fa-magnifying-glass mr-1.5"></i>Pantau
              </RouterLink>
            </div>
          </article>
        </div>
      </div>
    </section>
    <section class="home-berkas-section card-modern bg-white p-6 md:p-8 rounded-xl border border-gray-200 fade-in-up delay-2 mb-8">
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-3">
          <i class="fa-solid fa-folder-open text-xl"></i>
        </div>
        <h2 class="mb-0 text-2xl font-bold text-gray-800">Layanan Pemberkasan Tenaga Kependidikan SPKK 2026</h2>
        <p class="mb-0 text-sm text-gray-500 mt-2 max-w-2xl mx-auto">
          Pastikan Anda mengunggah pada kategori yang tepat (Berkas Ajuan Awal atau Laporan Bulan Berjalan).
        </p>
      </div>
      <div class="home-service-grid grid grid-cols-1 md:grid-cols-2 gap-5">
        <article v-for="card in spkkCards" :key="card.title" class="home-service-card bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div class="absolute top-0 left-0 w-1.5 h-full transition-colors" :class="card.color === 'green' ? 'bg-green-500 group-hover:bg-green-600' : 'bg-blue-500 group-hover:bg-blue-600'"></div>
          <div class="home-service-card-heading flex items-start gap-4 mb-5 pl-2">
            <div class="p-2.5 rounded-lg" :class="card.color === 'green' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'">
              <i class="fa-solid text-xl" :class="card.icon"></i>
            </div>
            <div>
              <h3 class="mb-0 font-bold text-gray-800 text-lg">{{ card.title }}</h3>
              <p class="mb-0 text-xs text-gray-500 mt-0.5">{{ card.description }}</p>
            </div>
          </div>
          <div class="flex gap-3 pl-2">
            <a :href="card.uploadUrl" target="_blank" rel="noopener noreferrer" class="text-xs py-2 flex-1" :class="card.color === 'green' ? 'btn-secondary' : 'btn-primary'" @click="showToast(card.uploadToast)">
              <i class="fa-solid fa-upload mr-1.5"></i>Unggah
            </a>
            <span aria-disabled="true" title="Tautan belum tersedia" class="btn-outline text-xs py-2 flex-1 flex items-center justify-center opacity-60 cursor-not-allowed" :class="card.color === 'green' ? 'border-emerald-200 text-emerald-700' : 'border-blue-200 text-blue-700'">
                <i class="fa-solid fa-magnifying-glass mr-1.5"></i>Pantau
              </span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
  .home-general-links a {
    border-color: #e5e7eb;
    color: #1f2937;
    background: #fff;
  }
  .home-general-links a:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
  }
  .home-general-heading {
    margin-bottom: 2.6875rem !important;
  }
  .home-search-section .teacher-search-form {
    max-width: 60rem;
  }
  .home-page .home-general-section,
  .home-page .home-search-section,
  .home-page .home-berkas-section,
  .home-page .home-teacher-section {
    margin-bottom: 2.1875rem !important;
  }
  .home-search-heading {
    margin-bottom: 1.625rem !important;
  }
  .home-page .home-search-section {
    padding-bottom: 2.75rem !important;
  }
  .home-service-period+.home-service-period {
    margin-top: 2.5rem;
  }
  .home-service-period-heading {
    margin-bottom: 1.25rem !important;
  }
  .home-monitor-button {
    text-decoration: none;
  }
  .home-service-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
    min-height: 9.8125rem;
    padding: 1.25rem !important;
  }
  .home-service-grid {
    grid-auto-rows: 1fr;
  }
  .home-service-card-heading {
    margin-bottom: 1.25rem !important;
  }
  @media (min-width: 768px) {
    .home-service-card {
      min-height: 9.8125rem;
    }
  }
  @media (max-width: 767px) {
    .home-page .home-search-section {
      padding-bottom: 2rem !important;
    }
  }
</style>
