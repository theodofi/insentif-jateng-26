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

    const textEncoder = new TextEncoder();

    function base64ToBytes(value) {
        const binary = window.atob(value);
        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }

    async function hmacSha256(keyBytes, messageBytes) {
        const key = await window.crypto.subtle.importKey(
            'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        return new Uint8Array(await window.crypto.subtle.sign('HMAC', key, messageBytes));
    }

    function concatBytes(...parts) {
        const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
        let offset = 0;
        parts.forEach((part) => {
            result.set(part, offset);
            offset += part.length;
        });
        return result;
    }

    // Mirrors encryptPayload_ in apps-script/Search.gs: the key comes from the one-time token and CAPTCHA answer.
    async function decryptSearchResponse(data, token, answer) {
        if (!window.crypto?.subtle) throw new Error('request_failed');
        if (![data.n, data.c, data.t].every((part) => typeof part === 'string')) throw new Error('request_failed');

        const material = new Uint8Array(await window.crypto.subtle.digest('SHA-256', textEncoder.encode(`${token}:${answer}`)));
        const encKey = await hmacSha256(material, textEncoder.encode('enc'));
        const macKey = await hmacSha256(material, textEncoder.encode('mac'));
        const nonce = base64ToBytes(data.n);
        const cipher = base64ToBytes(data.c);
        const tag = base64ToBytes(data.t);

        const expectedTag = await hmacSha256(macKey, concatBytes(nonce, cipher));
        const tagMatches = tag.length === expectedTag.length && tag.every((byte, index) => byte === expectedTag[index]);
        if (!tagMatches) throw new Error('request_failed');

        const plain = new Uint8Array(cipher.length);
        for (let offset = 0, counter = 0; offset < cipher.length; offset += 32, counter += 1) {
            const counterBytes = new Uint8Array([(counter >>> 24) & 255, (counter >>> 16) & 255, (counter >>> 8) & 255, counter & 255]);
            const block = await hmacSha256(encKey, concatBytes(nonce, counterBytes));
            for (let index = 0; index < 32 && offset + index < cipher.length; index += 1) {
                plain[offset + index] = cipher[offset + index] ^ block[index];
            }
        }
        return JSON.parse(new TextDecoder().decode(plain));
    }

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
                return 'Masukkan nama guru atau pilih Kab/Kota.';
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
        if (!searchTerm && !kabKotaSelect.value) {
            showSearchError('Masukkan nama guru atau pilih Kab/Kota.');
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
            const searchToken = captchaToken;
            const searchResponse = await requestSearchApi({
                action: 'search',
                q: searchTerm,
                kab: kabKotaSelect.value,
                token: searchToken,
                answer
            });
            const data = await decryptSearchResponse(searchResponse, searchToken, answer);
            hideCaptcha();
            const results = Array.isArray(data.results) ? data.results.map((row) => ({
                name: String(row.name || ''),
                satminkal: String(row.satminkal || ''),
                kabKota: String(row.kabKota || '')
            })) : [];
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