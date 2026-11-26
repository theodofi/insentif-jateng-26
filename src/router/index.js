import { createRouter, createWebHistory } from 'vue-router';
import CombinedDashboardView from '../views/CombinedDashboardView.vue';
import HomeView from '../views/HomeView.vue';

const router = createRouter({
    history: createWebHistory(),
    scrollBehavior: () => ({ top: 0 }),
    routes: [
        { path: '/', component: HomeView, meta: { title: 'Portal Utama Insentif' } },
        { path: '/pantau/ajuan.html', component: CombinedDashboardView, meta: { title: 'Pantau Berkas Ajuan' }, props: { mode: 'public', category: 'ajuan' } },
        { path: '/pantau/ajuan-janjun.html', redirect: '/pantau/ajuan.html' },
        { path: '/pantau/ajuan-juldes.html', redirect: '/pantau/ajuan.html' },
        { path: '/pantau/berjalan.html', component: CombinedDashboardView, meta: { title: 'Pantau Berkas Bulan Berjalan' }, props: { mode: 'public', category: 'berjalan' } },
        { path: '/pantau/berjalan-janjun.html', redirect: '/pantau/berjalan.html' },
        { path: '/pantau/berjalan-juldes.html', redirect: '/pantau/berjalan.html' },
        { path: '/admin/ajuan.html', component: CombinedDashboardView, meta: { title: 'Panel Admin Ajuan' }, props: { mode: 'admin', category: 'ajuan' } },
        { path: '/admin/ajuan-janjun.html', redirect: '/admin/ajuan.html' },
        { path: '/admin/ajuan-juldes.html', redirect: '/admin/ajuan.html' },
        { path: '/admin/berjalan.html', component: CombinedDashboardView, meta: { title: 'Panel Admin Bulan Berjalan' }, props: { mode: 'admin', category: 'berjalan' } },
        { path: '/admin/berjalan-janjun.html', redirect: '/admin/berjalan.html' },
        { path: '/admin/berjalan-juldes.html', redirect: '/admin/berjalan.html' },
        { path: '/:pathMatch(.*)*', redirect: '/' }
    ]
});

export default router;
