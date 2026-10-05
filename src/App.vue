<script setup>
  import {
    computed,
    nextTick,
    onMounted,
    onUnmounted,
    ref,
    watch
  } from 'vue';
  import {
    useRoute,
    useRouter
  } from 'vue-router';
  import logoUrl from './assets/kemenag-logo.png';
  import portalApi from './services/api.js';
  const adminLinks = [{
      to: '/',
      label: 'Beranda',
      icon: 'fa-solid fa-home'
    },
    {
      to: '/admin/ajuan-janjun.html',
      label: 'Panel Ajuan Januari-Juni',
      icon: 'fa-solid fa-file-circle-check'
    },
    {
      to: '/admin/ajuan-juldes.html',
      label: 'Panel Ajuan Juli-Desember',
      icon: 'fa-solid fa-file-circle-check'
    },
    {
      to: '/admin/berjalan-janjun.html',
      label: 'Panel Bulan Berjalan Januari-Juni',
      icon: 'fa-solid fa-calendar-check'
    },
    {
      to: '/admin/berjalan-juldes.html',
      label: 'Panel Bulan Berjalan Juli-Desember',
      icon: 'fa-solid fa-calendar-check'
    }
  ];
  const route = useRoute();
  const router = useRouter();
  const session = ref(null);
  const loginOpen = ref(false);
  const loginBusy = ref(false);
  const loginError = ref('');
  const menuOpen = ref(false);
  const profileOpen = ref(false);
  const toastMessage = ref('');
  const profileImageFailed = ref(false);
  let toastTimer;
  const pageTitle = computed(() => route.meta.title || 'Portal Insentif');
  const sessionInitial = computed(() =>
    session.value?.name?.charAt(0).toUpperCase() ||
    session.value?.email?.charAt(0).toUpperCase() ||
    'A'
  );
  watch(() => session.value?.picture, () => {
    profileImageFailed.value = false;
  });
  function refreshSession() {
    try {
      session.value = portalApi.getAdminSession();
      return true;
    } catch (error) {
      session.value = null;
      showToast(portalApi.showApiError(error));
      return false;
    }
  }
  function showToast(message) {
    toastMessage.value = message;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastMessage.value = '';
    }, 3000);
  }
  function closeMenus() {
    menuOpen.value = false;
    profileOpen.value = false;
  }
  function handleReady(event) {
    if (event.detail?.email) {
      if (!refreshSession()) {
        loginError.value = portalApi.showApiError(new Error('session_storage_unavailable'));
        return;
      }
      loginOpen.value = false;
      loginBusy.value = false;
      loginError.value = '';
      showToast(`Berhasil masuk sebagai ${session.value?.name || event.detail.email}`);
    }
  }
  function handlePortalToast(event) {
    if (typeof event.detail === 'string') showToast(event.detail);
  }
  function handleSessionChanged(event) {
    const hadSession = Boolean(session.value);
    if (!refreshSession()) return;
    if (hadSession && !session.value && event.detail?.reason === 'idle') {
      closeMenus();
      if (route.path.startsWith('/admin/')) void router.push('/');
      showToast('Sesi admin berakhir setelah 1 jam tidak aktif. Silakan masuk kembali.');
    }
  }
  async function openLogin() {
    closeMenus();
    loginOpen.value = true;
    loginError.value = '';
    try {
      await nextTick();
      const button = document.getElementById('vue-google-signin');
      if (!button) throw new Error('bad_request');
      await portalApi.renderGoogleButton(button, async response => {
        if (!response?.credential || loginBusy.value) return;
        loginBusy.value = true;
        loginError.value = 'Memverifikasi akun...';
        try {
          const result = await portalApi.authenticateAdmin(response.credential);
          const saved = portalApi.saveAdminSession({
            credential: response.credential,
            email: result.email
          });
          session.value = saved;
          window.dispatchEvent(new CustomEvent('portal-session-changed'));
          loginOpen.value = false;
          showToast(`Berhasil masuk sebagai ${saved.name || result.email}`);
        } catch (error) {
          loginError.value = portalApi.showApiError(error);
        } finally {
          loginBusy.value = false;
        }
      });
    } catch (error) {
      loginError.value = portalApi.showApiError(error);
    }
  }
  function logout() {
    try {
      portalApi.clearAdminSession();
    } catch (error) {
      showToast(portalApi.showApiError(error));
      return;
    }
    session.value = null;
    window.dispatchEvent(new CustomEvent('portal-session-changed'));
    closeMenus();
    if (route.path.startsWith('/admin/')) void router.push('/');
    showToast('Anda telah keluar.');
  }
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      if (loginOpen.value) loginOpen.value = false;
      closeMenus();
    }
  }
  watch(() => route.fullPath, () => {
    closeMenus();
    document.title = `${pageTitle.value} | Bimkris Jateng`;
  });
  onMounted(() => {
    refreshSession();
    window.addEventListener('portal-admin-ready', handleReady);
    window.addEventListener('portal-toast', handlePortalToast);
    window.addEventListener('portal-session-changed', handleSessionChanged);
    window.addEventListener('keydown', handleKeydown);
  });
  onUnmounted(() => {
    window.removeEventListener('portal-admin-ready', handleReady);
    window.removeEventListener('portal-toast', handlePortalToast);
    window.removeEventListener('portal-session-changed', handleSessionChanged);
    window.removeEventListener('keydown', handleKeydown);
    window.clearTimeout(toastTimer);
  });
</script>

<template>
  <div class="portal-app flex min-h-screen flex-col">
    <header class="portal-header sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm" :class="{ 'portal-home-header': route.path === '/' }">
      <div class="portal-header-inner mx-auto flex w-full max-w-6xl items-center justify-between gap-3" :class="route.path === '/' ? 'portal-home-header-inner' : 'px-4 py-3 md:px-6'">
        <RouterLink to="/" class="flex min-w-0 items-center gap-3 text-inherit no-underline">
          <img :src="logoUrl" alt="Logo Kementerian Agama" class="portal-brand-logo shrink-0 rounded-full border border-gray-200 bg-gray-50 object-contain p-1">
          <div class="min-w-0">
            <p class="portal-kicker mb-0 font-bold uppercase tracking-wider text-blue-700">Bimas Kristen Kanwil Kemenag Prov. Jateng 2026</p>
            <h1 class="portal-page-heading mb-0 truncate font-bold leading-tight text-gray-900">{{ pageTitle }}</h1>
          </div>
        </RouterLink>
        <button class="portal-menu-toggle inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-700 md:hidden" type="button" aria-label="Buka menu admin" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            <i class="fa-solid" :class="menuOpen ? 'fa-xmark' : 'fa-bars'" aria-hidden="true"></i>
          </button>
        <div class="hidden items-center gap-3 md:flex">
          <button v-if="!session" type="button" class="btn btn-outline-primary d-inline-flex align-items-center gap-2 rounded-pill px-3 py-2 fw-semibold" @click="openLogin">
              <i class="fa-solid fa-lock" aria-hidden="true"></i> {{ route.path === '/' ? 'Login' : 'Login Admin' }}
            </button>
          <div v-else class="relative">
            <button type="button" class="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800" aria-haspopup="menu" :aria-expanded="profileOpen" :aria-label="`Profil admin ${session.name || session.email}`" @click="profileOpen = !profileOpen">
                <img v-if="session.picture && !profileImageFailed" :src="session.picture" :alt="`${session.name || session.email} profile photo`" referrerpolicy="no-referrer" class="h-8 w-8 rounded-full border border-blue-200 object-cover" @error="profileImageFailed = true">
                <span v-else class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-700 text-xs text-white">{{ sessionInitial }}</span>
                <span class="min-w-0 text-left">
                  <span v-if="session.name" class="portal-account-name block truncate">{{ session.name }}</span>
                  <span class="portal-account-email block truncate text-xs">{{ session.email }}</span>
                </span>
                <i class="fa-solid fa-chevron-down text-xs"></i>
              </button>
            <div v-if="profileOpen" class="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-xl" role="menu">
              <div class="flex items-center gap-3 px-3 py-2">
                <img v-if="session.picture && !profileImageFailed" :src="session.picture" :alt="`${session.name || session.email} profile photo`" referrerpolicy="no-referrer" class="h-10 w-10 rounded-full border border-blue-200 object-cover" @error="profileImageFailed = true">
                <span v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-700 font-semibold text-white">{{ sessionInitial }}</span>
                <div class="min-w-0">
                  <p v-if="session.name" class="truncate text-sm font-semibold text-gray-800">{{ session.name }}</p>
                  <p class="truncate text-xs font-medium text-gray-500">{{ session.email }}</p>
                </div>
              </div>
              <RouterLink v-for="link in adminLinks" :key="link.to" :to="link.to" class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-blue-50" role="menuitem">
                <i :class="link.icon" class="w-4 text-center text-blue-700"></i>{{ link.label }}
              </RouterLink>
              <button class="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50" role="menuitem" @click="logout">Keluar</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="menuOpen" class="portal-menu-backdrop fixed inset-0 z-40 md:hidden" aria-hidden="true" @click="menuOpen = false"></div>
      <aside v-if="menuOpen" class="portal-mobile-drawer fixed inset-y-0 right-0 flex flex-col bg-white p-5 shadow-2xl md:hidden" aria-label="Menu admin">
        <div class="mb-5 flex items-center justify-between border-b border-gray-200 pb-4">
          <span class="font-semibold text-gray-900">Menu Admin</span>
          <button class="rounded-lg p-2 text-gray-600 hover:bg-gray-100" aria-label="Tutup menu admin" @click="menuOpen = false"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div v-if="session" class="mb-4 flex items-center gap-3 rounded-xl bg-blue-50 p-3">
          <img v-if="session.picture && !profileImageFailed" :src="session.picture" :alt="`${session.name || session.email} profile photo`" referrerpolicy="no-referrer" class="h-10 w-10 shrink-0 rounded-full border border-blue-200 object-cover" @error="profileImageFailed = true">
          <span v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-700 font-semibold text-white">{{ sessionInitial }}</span>
          <span class="min-w-0">
            <span v-if="session.name" class="block truncate text-sm font-semibold text-gray-800">{{ session.name }}</span>
            <span class="block truncate text-xs text-gray-600">{{ session.email }}</span>
          </span>
        </div>
        <button v-if="!session" type="button" class="mb-3 w-full rounded-lg bg-blue-700 px-4 py-3 text-left font-semibold text-white" @click="openLogin">
            <i class="fa-solid fa-lock mr-2"></i>Login Admin
          </button>
        <nav v-if="session" class="flex flex-col gap-1">
          <RouterLink v-for="link in adminLinks" :key="link.to" :to="link.to" class="rounded-lg px-3 py-3 text-sm text-gray-700 hover:bg-blue-50">
            <i :class="link.icon" class="mr-3 w-4 text-center text-blue-700"></i>{{ link.label }}
          </RouterLink>
          <button class="mt-2 rounded-lg px-3 py-3 text-left text-sm text-red-700 hover:bg-red-50" @click="logout">Keluar</button>
        </nav>
      </aside>
    </header>
    <main class="portal-main mx-auto w-full max-w-6xl flex-grow px-4 py-6 md:px-6 md:py-8" :class="{ 'portal-home-main': route.path === '/' }">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in" appear>
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <footer class="mt-auto border-t border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
      <p class="mb-1">&copy; 2026 Bimbingan Masyarakat Kristen</p>
      <p class="mb-1">Kantor Wilayah Kementerian Agama Provinsi Jawa Tengah</p>
      <p class="mb-0 text-xs">Dikembangkan oleh <a href="https://github.com/theodofi" target="_blank" rel="noopener noreferrer">@theodofi</a></p>
    </footer>
    <Transition name="fade">
      <div v-if="toastMessage" class="portal-toast fixed bottom-5 right-5 rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-lg" role="status">{{ toastMessage }}</div>
    </Transition>
    <div v-if="loginOpen" class="portal-login-overlay fixed inset-0 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="login-title" @click.self="loginOpen = false">
      <section class="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl md:p-8">
        <div class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700"><i class="fa-solid fa-shield-halved"></i></div>
        <h2 id="login-title" class="mb-2 text-xl font-bold text-gray-900">Login Admin</h2>
        <p class="mb-5 text-sm text-gray-600">Masuk dengan akun Google yang terdaftar sebagai admin.</p>
        <div id="vue-google-signin" class="flex min-h-11 justify-center"></div>
        <p v-if="loginError" class="mt-4 text-sm text-red-700" role="status" aria-live="polite">{{ loginError }}</p>
        <button class="mt-5 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100" :disabled="loginBusy" @click="loginOpen = false">Batal</button>
      </section>
    </div>
  </div>
</template>

<style>
  .portal-app {
    min-height: 100vh;
    background: #f8fafc;
    color: #1f2937;
    font-family: Inter, Arial, sans-serif;
  }
  .portal-header {
    position: sticky;
  }
  .portal-kicker {
    font-size: .625rem;
  }
  .portal-brand-logo {
    width: 3.5rem;
    height: 3.5rem;
  }
  .portal-page-heading {
    font-size: 1.5rem;
  }
  .portal-home-header {
    padding: 1.2rem 1.5rem;
  }
  .portal-home-header-inner {
    max-width: 76.875rem;
    padding: 0;
  }
  .portal-home-header .portal-kicker {
    font-size: .8125rem;
    margin-bottom: .25rem;
  }
  .portal-home-header .portal-page-heading {
    font-size: 1.625rem;
  }
  .portal-main.portal-home-main {
    max-width: 76.125rem;
    margin: 1rem auto;
    padding: 1rem;
  }
  .portal-account-email {
    max-width: 12rem;
  }
  .portal-account-name {
    max-width: 12rem;
  }
  .portal-menu-backdrop {
    z-index: 40;
    background: rgba(15, 23, 42, .4);
  }
  .portal-mobile-drawer {
    z-index: 50;
    width: min(21rem, 88vw);
    animation: drawer-in .2s ease-out;
  }
  .portal-login-overlay {
    z-index: 90;
    background: rgba(15, 23, 42, .7);
  }
  .portal-toast {
    z-index: 100;
  }
  .min-w-48 {
    min-width: 12rem;
  }
  .min-w-64 {
    min-width: 16rem;
  }
  .teacher-search-controls {
    grid-template-columns: minmax(0, 1fr);
  }
  @media (min-width: 768px) {
    .teacher-search-controls {
      grid-template-columns: minmax(0, 1fr) 17rem auto;
    }
    .portal-main.portal-home-main {
      padding: 1.5rem;
    }
    .portal-home-header .portal-header-inner {
      padding: 0;
    }
  }
  @media (max-width: 767px) {
    .portal-home-header {
      padding: .75rem 1rem;
    }
    .portal-home-header .portal-kicker {
      font-size: .55rem;
    }
    .portal-home-header .portal-page-heading {
      font-size: 1.15rem;
    }
    .portal-home-header .portal-brand-logo {
      width: 3rem;
      height: 3rem;
    }
    .portal-home-header-inner {
      max-width: 100%;
    }
  }
  .page-enter-active,
  .page-leave-active,
  .page-appear-active {
    transition: opacity .16s ease, transform .16s ease;
  }
  .page-enter-from,
  .page-appear-from {
    opacity: 0;
    transform: translateY(8px);
  }
  .page-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity .15s ease;
  }
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
  @keyframes drawer-in {
    from {
      transform: translateX(1rem);
      opacity: .5;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
