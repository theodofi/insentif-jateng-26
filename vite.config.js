import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const spaRouteFallback = {
    name: 'portal-spa-route-fallback',
    configureServer(server) {
        server.middlewares.use((request, _response, next) => {
            if (request.url && /^\/(?:admin|pantau)\/.*\.html(?:\?.*)?$/.test(request.url)) {
                request.url = '/';
            }
            next();
        });
    }
};

export default defineConfig({
    plugins: [vue(), spaRouteFallback],
    build: {
        outDir: 'dist',
        emptyOutDir: true
    }
});
