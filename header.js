(() => {
    const mount = document.getElementById('shared-header');
    if (!mount) return;

    const header = document.createElement('header');
    header.className = 'bg-white border-bottom shadow-sm w-100 sticky-top';

    const inner = document.createElement('div');
    inner.className = 'header-inner d-flex flex-column flex-md-row align-items-center justify-content-between gap-4 py-4 px-4 mx-auto';

    const branding = document.createElement('div');
    branding.className = 'd-flex align-items-center gap-3 text-start w-100 w-md-auto';
    const logo = document.createElement('img');
    logo.src = 'https://lh3.googleusercontent.com/d/1B_S0bYzahMWBUXKWPcOOKOm1ryvuvBz1';
    logo.alt = 'Logo';
    logo.className = 'logo-img rounded-circle border p-1 bg-light shadow-sm flex-shrink-0';

    const titleGroup = document.createElement('div');
    const eyebrow = document.createElement('h1');
    eyebrow.className = 'text-uppercase fw-bold text-primary mb-1';
    eyebrow.style.cssText = 'font-size:10px;letter-spacing:.5px';
    eyebrow.textContent = document.body.dataset.headerEyebrow || '';
    const title = document.createElement('h2');
    title.className = 'fw-bold text-dark mb-0 fs-3';
    title.textContent = document.body.dataset.headerTitle || '';
    titleGroup.append(eyebrow, title);
    branding.append(logo, titleGroup);

    const account = document.createElement('div');
    account.className = 'relative z-50';
    if (document.body.dataset.headerAccount === 'empty') {
        account.setAttribute('aria-hidden', 'true');
    } else {
        account.id = 'admin-account';

        const loginButton = document.createElement('button');
        loginButton.id = 'admin-login-button';
        loginButton.type = 'button';
        loginButton.setAttribute('aria-haspopup', 'dialog');
        loginButton.setAttribute('aria-expanded', 'false');
        loginButton.className = 'inline-flex items-center gap-2 text-sm font-semibold text-blue-700 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
        const loginIcon = document.createElement('i');
        loginIcon.className = 'fa-solid fa-lock';
        loginIcon.setAttribute('aria-hidden', 'true');
        const loginLabel = document.createElement('span');
        loginLabel.textContent = 'Login Admin';
        loginButton.append(loginIcon, loginLabel);

        const menu = document.createElement('div');
        menu.id = 'admin-profile-menu';
        menu.setAttribute('role', 'menu');
        menu.hidden = true;
        menu.className = 'absolute right-0 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-lg';

        const email = document.createElement('p');
        email.id = 'admin-profile-email';
        email.className = 'truncate px-3 py-2 text-xs font-semibold text-gray-500';

        const ajuanLink = document.createElement('a');
        ajuanLink.href = 'ajuan.html';
        ajuanLink.setAttribute('role', 'menuitem');
        ajuanLink.className = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700';
        const ajuanIcon = document.createElement('i');
        ajuanIcon.className = 'fa-solid fa-file-circle-check w-4 text-center';
        ajuanIcon.setAttribute('aria-hidden', 'true');
        const ajuanLabel = document.createElement('span');
        ajuanLabel.textContent = 'Panel Ajuan';
        ajuanLink.append(ajuanIcon, ajuanLabel);

        const berjalanLink = document.createElement('a');
        berjalanLink.href = 'bulan-berjalan.html';
        berjalanLink.setAttribute('role', 'menuitem');
        berjalanLink.className = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700';
        const berjalanIcon = document.createElement('i');
        berjalanIcon.className = 'fa-solid fa-calendar-check w-4 text-center';
        berjalanIcon.setAttribute('aria-hidden', 'true');
        const berjalanLabel = document.createElement('span');
        berjalanLabel.textContent = 'Panel Bulan Berjalan';
        berjalanLink.append(berjalanIcon, berjalanLabel);

        const logout = document.createElement('button');
        logout.id = 'admin-logout-button';
        logout.type = 'button';
        logout.setAttribute('role', 'menuitem');
        logout.className = 'mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50';
        logout.textContent = 'Keluar';

        menu.append(email, ajuanLink, berjalanLink, logout);
        account.append(loginButton, menu);
    }
    inner.append(branding, account);
    header.append(inner);
    mount.replaceWith(header);
})();
