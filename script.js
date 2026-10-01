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
    const searchStatus = document.getElementById('teacher-search-status');
    const resultsContainer = document.getElementById('teacher-search-results');
    const resultsBody = document.getElementById('teacher-search-results-body');
    const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/1dYEKUGur51SGQLqzUkJigaNfMCC_rdfUsd3BsapmM8k/export?format=csv&range=B7:E';
    let teacherRowsPromise;

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
                    kabKota: (row[2] || '').trim(),
                    satminkal: (row[3] || '').trim()
                })).filter((teacher) => teacher.name));
        }
        return teacherRowsPromise;
    }

    function renderTeacherResults(teachers) {
        resultsBody.replaceChildren();
        teachers.forEach((teacher) => {
            const row = document.createElement('tr');
            [teacher.name, teacher.satminkal, teacher.kabKota].forEach((text) => {
                const cell = document.createElement('td');
                cell.textContent = text;
                row.appendChild(cell);
            });
            resultsBody.appendChild(row);
        });
        resultsContainer.hidden = teachers.length === 0;
    }

    searchForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const searchTerm = searchInput.value.trim().toLocaleLowerCase('id-ID');
        if (!searchTerm) return;

        searchStatus.textContent = 'Memuat data guru...';
        searchStatus.classList.remove('is-error');
        resultsContainer.hidden = true;

        try {
            const teachers = await loadTeacherRows();
            const matches = teachers.filter((teacher) => teacher.name.toLocaleLowerCase('id-ID').includes(searchTerm));
            renderTeacherResults(matches);
            searchStatus.textContent = matches.length
                ? `${matches.length} data guru ditemukan.`
                : 'Nama guru tidak ditemukan.';
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