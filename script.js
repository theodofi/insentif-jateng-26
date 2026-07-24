// script.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Live Time Update
    const timeDisplay = document.getElementById('live-time');
    
    function updateTime() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        };
        // Menggunakan format waktu Indonesia (id-ID)
        timeDisplay.textContent = now.toLocaleDateString('id-ID', options);
    }
    
    // Update setiap 1 detik
    setInterval(updateTime, 1000);
    updateTime();

    // 2. Iframe Loading Management
    const iframe = document.getElementById('data-frame');
    const loader = document.getElementById('iframe-loader');

    // Ketika iframe selesai memuat data Google Sheets
    iframe.onload = () => {
        // Sembunyikan loader
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
            // Tampilkan iframe dengan efek fade
            iframe.style.opacity = '1';
        }, 500); // Tunggu transisi opacity selesai
    };
});

// 3. Sistem Notifikasi Interaktif (Toast)
let toastTimeout;
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    toastMessage.textContent = message;
    toast.classList.add('toast-show');

    // Hapus timer lama jika ada (mencegah bentrok jika diklik cepat)
    clearTimeout(toastTimeout);

    // Sembunyikan setelah 3 detik
    toastTimeout = setTimeout(() => {
        toast.classList.remove('toast-show');
    }, 3000);
}