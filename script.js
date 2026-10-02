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

    // Search the public teacher list from the linked spreadsheet.
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
    const captchaQuestion = document.getElementById('teacher-search-captcha-question');
    const captchaImage = document.getElementById('teacher-search-captcha-image');
    const captchaAccessibleText = document.getElementById('teacher-search-captcha-accessible-text');
    const captchaControls = document.getElementById('teacher-search-captcha-controls');
    const captchaActions = document.getElementById('teacher-search-captcha-actions');
    const captchaAnswerInput = document.getElementById('teacher-search-captcha-answer');
    const captchaRefreshButton = document.getElementById('teacher-search-captcha-refresh');
    const submitLabel = document.getElementById('teacher-search-submit-label');
    const submitButton = searchForm.querySelector('button[type="submit"]');
    const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/1dYEKUGur51SGQLqzUkJigaNfMCC_rdfUsd3BsapmM8k/gviz/tq?tqx=out:csv&sheet=Data%20Gabungan&range=A2:C';
    const retryCooldown = 30 * 1000;
    const pageSize = 5;
    let teacherRowsPromise;
    let retryAfter = 0;
    let currentTeachers = [];
    let currentPage = 1;
    let captchaAnswer;

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

    function parseCsv(csv) {
        const rows = [];
        let row = [];
        let value = '';
        let insideQuotes = false;

        for (let index = 0; index < csv.length; index += 1) {
            const character = csv[index];
            if (character === '"') {
                if (insideQuotes && csv[index + 1] === '"') {
                    value += '"';
                    index += 1;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (character === ',' && !insideQuotes) {
                row.push(value);
                value = '';
            } else if ((character === '\n' || character === '\r') && !insideQuotes) {
                if (character === '\r' && csv[index + 1] === '\n') index += 1;
                row.push(value);
                if (row.some((cell) => cell.trim())) rows.push(row);
                row = [];
                value = '';
            } else {
                value += character;
            }
        }

        row.push(value);
        if (row.some((cell) => cell.trim())) rows.push(row);
        return rows;
    }

    function loadTeacherRows() {
        if (!teacherRowsPromise) {
            if (Date.now() < retryAfter) {
                return Promise.reject(new Error('Spreadsheet retry cooldown is active.'));
            } else {
                const controller = new AbortController();
                const timeoutId = window.setTimeout(() => controller.abort(), 15000);
                teacherRowsPromise = fetch(spreadsheetUrl, { cache: 'no-store', signal: controller.signal })
                    .then((response) => {
                        if (!response.ok) throw new Error('Spreadsheet tidak dapat dimuat.');
                        return response.text();
                    })
                    .then((csv) => parseCsv(csv).map((row) => ({
                        name: (row[0] || '').trim(),
                        satminkal: (row[1] || '').trim(),
                        kabKota: (row[2] || '').trim()
                    })).filter((teacher) => teacher.name))
                    .finally(() => window.clearTimeout(timeoutId))
                    .catch((error) => {
                        retryAfter = Date.now() + retryCooldown;
                        throw error;
                    });
            }
        }
        return teacherRowsPromise;
    }

    function createCaptchaChallenge() {
        const firstNumber = Math.floor(Math.random() * 9) + 1;
        const secondNumber = Math.floor(Math.random() * 9) + 1;
        const context = captchaImage.getContext('2d');
        if (!context) {
            captchaContainer.hidden = true;
            captchaAnswer = undefined;
            submitLabel.textContent = 'Cari';
            searchStatus.textContent = 'Peramban tidak mendukung verifikasi CAPTCHA.';
            searchStatus.classList.add('is-error');
            return false;
        }

        captchaAnswer = firstNumber + secondNumber;
        const expression = `${firstNumber} + ${secondNumber} = ?`;
        context.clearRect(0, 0, captchaImage.width, captchaImage.height);
        context.fillStyle = '#eff6ff';
        context.fillRect(0, 0, captchaImage.width, captchaImage.height);
        for (let index = 0; index < 24; index += 1) {
            context.beginPath();
            context.fillStyle = index % 2 ? '#bfdbfe' : '#dbeafe';
            context.arc(Math.random() * captchaImage.width, Math.random() * captchaImage.height, 1 + Math.random() * 2, 0, Math.PI * 2);
            context.fill();
        }
        context.save();
        context.translate(captchaImage.width / 2, captchaImage.height / 2);
        context.rotate((Math.random() - 0.5) * 0.04);
        context.fillStyle = '#1e3a8a';
        context.font = '700 34px Inter, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(expression, 0, 0);
        context.restore();
        captchaAccessibleText.textContent = `Soal matematika: ${firstNumber} tambah ${secondNumber}.`;
        captchaAnswerInput.value = '';
        captchaContainer.hidden = false;
        submitLabel.textContent = 'Cari';
        positionCaptchaSubmitButton();
        captchaAnswerInput.focus();
        return true;
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

    captchaRefreshButton.addEventListener('click', createCaptchaChallenge);
    window.addEventListener('resize', positionCaptchaSubmitButton);

    searchForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const rawSearchTerm = searchInput.value.trim().replace(/\s+/g, ' ');
        const searchTerm = rawSearchTerm.toLocaleLowerCase('id-ID');
        const selectedKabKota = kabKotaSelect.value.toLocaleLowerCase('id-ID');

        if (searchInput.value.length > 100) {
            searchStatus.textContent = 'Nama pencarian maksimal 100 karakter.';
            searchStatus.classList.add('is-error');
            return;
        }
        if (!searchTerm && !selectedKabKota) {
            searchStatus.textContent = 'Masukkan nama guru atau pilih Kab/Kota.';
            searchStatus.classList.add('is-error');
            return;
        }

        if (captchaAnswer === undefined) {
            resultsBody.replaceChildren();
            resultsContainer.hidden = true;
            pagination.hidden = true;
            currentTeachers = [];
            if (!createCaptchaChallenge()) return;
            searchStatus.textContent = 'Jawab pertanyaan verifikasi untuk melanjutkan pencarian.';
            searchStatus.classList.remove('is-error');
            return;
        }

        if (!captchaAnswerInput.value || Number(captchaAnswerInput.value) !== captchaAnswer) {
            searchStatus.textContent = 'Jawaban verifikasi salah. Silakan coba soal baru.';
            searchStatus.classList.add('is-error');
            createCaptchaChallenge();
            return;
        }

        captchaAnswer = undefined;
        captchaContainer.hidden = true;
        captchaAnswerInput.value = '';
        submitLabel.textContent = 'Cari';
        searchForm.appendChild(submitButton);
        searchStatus.textContent = 'Memuat data guru...';
        searchStatus.classList.remove('is-error');
        resultsContainer.hidden = true;
        submitButton.disabled = true;

        try {
            const teachers = await loadTeacherRows();
            const matches = teachers.filter((teacher) => {
                const matchesName = !searchTerm || teacher.name.toLocaleLowerCase('id-ID').includes(searchTerm);
                const matchesKabKota = !selectedKabKota || teacher.kabKota.toLocaleLowerCase('id-ID') === selectedKabKota;
                return matchesName && matchesKabKota;
            });
            renderTeacherResults(matches);
            searchStatus.textContent = matches.length
                ? `${matches.length} data ditemukan.`
                : 'Data tidak ditemukan.';
        } catch {
            teacherRowsPromise = null;
            searchStatus.textContent = 'Data guru gagal dimuat. Periksa koneksi atau akses spreadsheet, lalu coba lagi.';
            searchStatus.classList.add('is-error');
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