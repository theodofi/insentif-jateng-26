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
    const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/1dYEKUGur51SGQLqzUkJigaNfMCC_rdfUsd3BsapmM8k/gviz/tq?tqx=out:csv&sheet=Data%20Gabungan&range=A2:C';
    const pageSize = 10;
    let teacherRowsPromise;
    let currentTeachers = [];
    let currentPage = 1;

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
            teacherRowsPromise = fetch(spreadsheetUrl)
                .then((response) => {
                    if (!response.ok) throw new Error('Spreadsheet tidak dapat dimuat.');
                    return response.text();
                })
                .then((csv) => parseCsv(csv).map((row) => ({
                    name: (row[0] || '').trim(),
                    satminkal: (row[1] || '').trim(),
                    kabKota: (row[2] || '').trim()
                })).filter((teacher) => teacher.name));
        }
        return teacherRowsPromise;
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

    searchForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const searchTerm = searchInput.value.trim().toLocaleLowerCase('id-ID');
        const selectedKabKota = kabKotaSelect.value.toLocaleLowerCase('id-ID');
        if (!searchTerm && !selectedKabKota) {
            searchStatus.textContent = 'Masukkan nama guru atau pilih Kab/Kota.';
            searchStatus.classList.remove('is-error');
            resultsContainer.hidden = true;
            return;
        }

        searchStatus.textContent = 'Memuat data guru...';
        searchStatus.classList.remove('is-error');
        resultsContainer.hidden = true;

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
        } catch (error) {
            teacherRowsPromise = null;
            searchStatus.textContent = 'Data guru gagal dimuat. Periksa koneksi atau akses spreadsheet, lalu coba lagi.';
            searchStatus.classList.add('is-error');
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