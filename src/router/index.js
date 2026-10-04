import { createRouter, createWebHistory } from 'vue-router';
import AdminDashboardView from '../views/AdminDashboardView.vue';
import HomeView from '../views/HomeView.vue';
import PublicMonitorView from '../views/PublicMonitorView.vue';

const router = createRouter({
    history: createWebHistory(),
    scrollBehavior: () => ({ top: 0 }),
    routes: [
        { path: '/', component: HomeView, meta: { title: 'Portal Utama Insentif' } },
        { path: '/pantau/ajuan-janjun.html', component: PublicMonitorView, meta: { title: 'Pantau Ajuan Januari-Juni' }, props: { workflow: 'ajuanJanJun', title: 'Pantau Berkas Ajuan Januari-Juni', period: 'Januari-Juni' } },
        { path: '/pantau/ajuan-juldes.html', component: PublicMonitorView, meta: { title: 'Pantau Ajuan Juli-Desember' }, props: { workflow: 'ajuanJulDes', title: 'Pantau Berkas Ajuan Juli-Desember', period: 'Juli-Desember' } },
        { path: '/pantau/berjalan-janjun.html', component: PublicMonitorView, meta: { title: 'Pantau Bulan Berjalan Januari-Juni' }, props: { workflow: 'berjalanJanJun', title: 'Pantau Berkas Bulan Berjalan Januari-Juni', period: 'Januari-Juni' } },
        { path: '/pantau/berjalan-juldes.html', component: PublicMonitorView, meta: { title: 'Pantau Bulan Berjalan Juli-Desember' }, props: { workflow: 'berjalanJulDes', title: 'Pantau Berkas Bulan Berjalan Juli-Desember', period: 'Juli-Desember' } },
        { path: '/admin/ajuan-janjun.html', component: AdminDashboardView, meta: { title: 'Admin Ajuan Januari-Juni' }, props: { workflow: 'ajuanJanJun', title: 'Panel Admin Ajuan Januari-Juni', period: 'Januari-Juni' } },
        { path: '/admin/ajuan-juldes.html', component: AdminDashboardView, meta: { title: 'Admin Ajuan Juli-Desember' }, props: { workflow: 'ajuanJulDes', title: 'Panel Admin Ajuan Juli-Desember', period: 'Juli-Desember' } },
        { path: '/admin/berjalan-janjun.html', component: AdminDashboardView, meta: { title: 'Admin Bulan Berjalan Januari-Juni' }, props: { workflow: 'berjalanJanJun', title: 'Panel Admin Bulan Berjalan Januari-Juni', period: 'Januari-Juni' } },
        { path: '/admin/berjalan-juldes.html', component: AdminDashboardView, meta: { title: 'Admin Bulan Berjalan Juli-Desember' }, props: { workflow: 'berjalanJulDes', title: 'Panel Admin Bulan Berjalan Juli-Desember', period: 'Juli-Desember' } },
        { path: '/:pathMatch(.*)*', redirect: '/' }
    ]
});

export default router;
