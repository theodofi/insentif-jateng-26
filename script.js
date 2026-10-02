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

    // Search teacher data through the Apps Script web app (the spreadsheet itself stays private).
    const searchForm = document.getElementById('teacher-search-form');
    const searchInput = document.getElementById('teacher-search-input');
    const kabKotaSelect = document.getElementById('teacher-search-kab-kota');
    const kabKotaLocation = kabKotaSelect.closest('.teacher-search-location');
    const searchStatus = document.getElementById('teacher-search-status');
    const resultsContainer = document.getElementById('teacher-search-results');
    const resultsBody = document.getElementById('teacher-search-results-body');
    const pagination = document.getElementById('teacher-search-pagination');
    const previousPageButton = document.getElementById('teacher-search-previous');
    const nextPageButton = document.getElementById('teacher-search-next');
    const pageStatus = document.getElementById('teacher-search-page-status');
    const captchaContainer = document.getElementById('teacher-search-captcha');
    const captchaImage = document.getElementById('teacher-search-captcha-image');
    const captchaControls = document.getElementById('teacher-search-captcha-controls');
    const captchaActions = document.getElementById('teacher-search-captcha-actions');
    const captchaAnswerInput = document.getElementById('teacher-search-captcha-answer');
    const captchaRefreshButton = document.getElementById('teacher-search-captcha-refresh');
    const submitButton = searchForm.querySelector('button[type="submit"]');
    // URL web app Apps Script (Deploy > Manage deployments), berakhiran /exec.
    const searchApiUrl = 'https://script.google.com/macros/s/AKfycbxq4ZIhzpZjOSiqNfNnT8kudjPdZCm4WBE33bjcAkP9JiqVDGLE7cCpQ_pjpSNJxNz0Xw/exec';
    const minQueryLength = 3;
    const maxQueryLength = 100;
    const pageSize = 5;
    let currentTeachers = [];
    let currentPage = 1;
    let captchaToken;

    function updateKabKotaControl() {
        const hasSelection = Boolean(kabKotaSelect.value);
        kabKotaLocation.classList.toggle('has-selection', hasSelection);

        const selectStyle = window.getComputedStyle(kabKotaSelect);
        const measureElement = document.createElement('span');
        measureElement.style.position = 'absolute';
        measureElement.style.visibility = 'hidden';
        measureElement.style.whiteSpace = 'nowrap';
        measureElement.style.font = selectStyle.font;
        measureElement.textContent = kabKotaSelect.selectedOptions[0].textContent;
        document.body.appendChild(measureElement);

        const textWidth = measureElement.getBoundingClientRect().width;
        measureElement.remove();
        const horizontalSpace = [
            selectStyle.paddingLeft,
            selectStyle.paddingRight,
            selectStyle.borderLeftWidth,
            selectStyle.borderRightWidth
        ].reduce((total, value) => total + parseFloat(value), 0);
        kabKotaLocation.style.setProperty('--kab-kota-min-width', `${Math.ceil(textWidth + horizontalSpace)}px`);
    }

    kabKotaSelect.addEventListener('change', updateKabKotaControl);
    updateKabKotaControl();

    function requestSearchApi(params) {
        if (!searchApiUrl) return Promise.reject(new Error('not_configured'));
        const url = new URL(searchApiUrl);
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 15000);
        return fetch(url, {
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal: controller.signal
        })
            .then((response) => {
                if (!response.ok) throw new Error('request_failed');
                return response.json();
            })
            .then((data) => {
                if (!data || data.ok !== true) throw new Error(data?.error || 'request_failed');
                return data;
            })
            .finally(() => window.clearTimeout(timeoutId));
    }

    async function loadCaptchaChallenge() {
        const data = await requestSearchApi({ action: 'captcha' });
        if (typeof data.token !== 'string' || !String(data.image).startsWith('data:image/svg+xml;base64,')) {
            throw new Error('request_failed');
        }
        captchaToken = data.token;
        captchaImage.src = data.image;
        captchaAnswerInput.value = '';
        captchaContainer.hidden = false;
        positionCaptchaSubmitButton();
        captchaAnswerInput.focus();
    }

    function hideCaptcha() {
        captchaToken = undefined;
        captchaContainer.hidden = true;
        captchaImage.removeAttribute('src');
        captchaAnswerInput.value = '';
        searchForm.appendChild(submitButton);
    }

    function showSearchError(message) {
        searchStatus.textContent = message;
        searchStatus.classList.add('is-error');
    }

    function describeApiError(error) {
        switch (error.message) {
            case 'not_configured':
                return 'Layanan pencarian belum dikonfigurasi.';
            case 'rate_limited':
                return 'Terlalu banyak permintaan. Coba lagi dalam beberapa saat.';
            case 'invalid_query':
                return `Masukkan minimal ${minQueryLength} huruf nama guru.`;
            default:
                return 'Data guru gagal dimuat. Periksa koneksi, lalu coba lagi.';
        }
    }
    function positionCaptchaSubmitButton() {
        if (captchaContainer.hidden) return;
        const destination = window.matchMedia('(max-width: 767px)').matches
            ? captchaActions
            : captchaControls;
        destination.appendChild(submitButton);
    }

    function renderTeacherResults(teachers) {
        currentTeachers = teachers;
        currentPage = 1;
        renderTeacherPage();
    }

    function renderTeacherPage() {
        resultsBody.replaceChildren();
        const startIndex = (currentPage - 1) * pageSize;
        const currentPageTeachers = currentTeachers.slice(startIndex, startIndex + pageSize);
        currentPageTeachers.forEach((teacher) => {
            const row = document.createElement('tr');
            [teacher.name, teacher.satminkal, teacher.kabKota].forEach((text) => {
                const cell = document.createElement('td');
                cell.textContent = text;
                row.appendChild(cell);
            });
            resultsBody.appendChild(row);
        });
        const pageCount = Math.ceil(currentTeachers.length / pageSize);
        resultsContainer.hidden = currentTeachers.length === 0;
        pagination.hidden = pageCount <= 1;
        pageStatus.textContent = `Halaman ${currentPage} dari ${pageCount}`;
        previousPageButton.disabled = currentPage === 1;
        nextPageButton.disabled = currentPage >= pageCount;
    }

    previousPageButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage -= 1;
            renderTeacherPage();
        }
    });

    nextPageButton.addEventListener('click', () => {
        const pageCount = Math.ceil(currentTeachers.length / pageSize);
        if (currentPage < pageCount) {
            currentPage += 1;
            renderTeacherPage();
        }
    });

    captchaRefreshButton.addEventListener('click', async () => {
        captchaRefreshButton.disabled = true;
        try {
            await loadCaptchaChallenge();
        } catch (error) {
            hideCaptcha();
            showSearchError(describeApiError(error));
        } finally {
            captchaRefreshButton.disabled = false;
        }
    });
    window.addEventListener('resize', positionCaptchaSubmitButton);

    searchForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submitButton.disabled) return;

        const searchTerm = searchInput.value.trim().replace(/\s+/g, ' ');
        if (searchTerm.length < minQueryLength) {
            showSearchError(`Masukkan minimal ${minQueryLength} huruf nama guru.`);
            return;
        }
        if (searchTerm.length > maxQueryLength) {
            showSearchError(`Nama pencarian maksimal ${maxQueryLength} karakter.`);
            return;
        }

        submitButton.disabled = true;
        searchStatus.classList.remove('is-error');

        try {
            if (captchaToken === undefined) {
                resultsContainer.hidden = true;
                currentTeachers = [];
                searchStatus.textContent = 'Memuat verifikasi...';
                await loadCaptchaChallenge();
                searchStatus.textContent = 'Jawab pertanyaan verifikasi untuk melanjutkan pencarian.';
                return;
            }

            const answer = captchaAnswerInput.value.trim();
            if (!answer) {
                showSearchError('Masukkan jawaban verifikasi.');
                return;
            }

            searchStatus.textContent = 'Mencari data guru...';
            resultsContainer.hidden = true;
            const data = await requestSearchApi({
                action: 'search',
                q: searchTerm,
                kab: kabKotaSelect.value,
                token: captchaToken,
                answer
            });
            hideCaptcha();
            const results = Array.isArray(data.results) ? data.results : [];
            renderTeacherResults(results);
            if (!results.length) {
                searchStatus.textContent = 'Data tidak ditemukan.';
            } else if (data.truncated) {
                searchStatus.textContent = `${data.total} data ditemukan, menampilkan ${results.length} pertama. Perjelas nama atau pilih Kab/Kota.`;
            } else {
                searchStatus.textContent = `${results.length} data ditemukan.`;
            }
        } catch (error) {
            if (error.message === 'captcha_failed') {
                showSearchError('Jawaban verifikasi salah atau kedaluwarsa. Silakan coba soal baru.');
                try {
                    await loadCaptchaChallenge();
                } catch {
                    hideCaptcha();
                }
            } else {
                hideCaptcha();
                showSearchError(describeApiError(error));
            }
        } finally {
            submitButton.disabled = false;
        }
    });
    // 2. Iframe Loading Management
    const iframe = document.getElementById('data-frame');
    const loader = document.getElementById('iframe-loader');

    // Ketika iframe selesai memuat data Google Sheets
    if (iframe && loader) iframe.onload = () => {
        // Sembunyikan loader
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
            // Tampilkan iframe dengan efek fade
            iframe.style.opacity = '1';
        }, 500); // Tunggu transisi opacity selesai
    };

    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;
        const toastLink = event.target.closest('[data-toast]');
        if (toastLink) showToast(toastLink.dataset.toast);
    });
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