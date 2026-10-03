(() => {
    const mount = document.getElementById('shared-header');
    if (!mount) return;

    const header = document.createElement('header');
    header.className = 'bg-white border-bottom shadow-sm w-100 sticky-top';

    const inner = document.createElement('div');
    inner.className = 'header-inner portal-header-inner py-4 px-4 mx-auto';

    const branding = document.createElement('div');
    branding.className = 'portal-header-branding text-start';
    const logo = document.createElement('img');
    logo.src = 'https://lh3.googleusercontent.com/d/1B_S0bYzahMWBUXKWPcOOKOm1ryvuvBz1';
    logo.alt = 'Logo';
    logo.className = 'logo-img portal-header-logo rounded-circle border p-1 bg-light shadow-sm flex-shrink-0';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'portal-header-title-group';
    const eyebrow = document.createElement('h1');
    eyebrow.className = 'portal-header-eyebrow text-uppercase fw-bold text-primary mb-1';
    eyebrow.textContent = document.body.dataset.headerEyebrow || '';
    const title = document.createElement('h2');
    title.className = 'portal-header-title fw-bold text-dark mb-0';
    title.textContent = document.body.dataset.headerTitle || '';
    titleGroup.append(eyebrow, title);
    branding.append(logo, titleGroup);

    const account = document.createElement('div');
    account.className = 'portal-header-account';
    if (document.body.dataset.headerAccount === 'empty') {
        account.setAttribute('aria-hidden', 'true');
        account.classList.add('portal-header-account-empty');
    } else {
        account.id = 'admin-account';
        account.classList.add('relative', 'z-50');

        const menuToggle = document.createElement('button');
        menuToggle.id = 'mobile-admin-menu-toggle';
        menuToggle.type = 'button';
        menuToggle.setAttribute('aria-controls', 'mobile-admin-sidebar');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Buka menu admin');
        menuToggle.className = 'inline-flex flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500';
        const menuToggleIcon = document.createElement('i');
        menuToggleIcon.className = 'fa-solid fa-bars text-xl';
        menuToggleIcon.setAttribute('aria-hidden', 'true');
        menuToggle.appendChild(menuToggleIcon);

        const backdrop = document.createElement('div');
        backdrop.id = 'mobile-admin-menu-backdrop';
        backdrop.hidden = true;
        backdrop.setAttribute('aria-hidden', 'true');

        const sidebar = document.createElement('aside');
        sidebar.id = 'mobile-admin-sidebar';
        sidebar.setAttribute('aria-label', 'Menu admin');
        sidebar.setAttribute('aria-hidden', 'true');

        const sidebarHeader = document.createElement('div');
        sidebarHeader.id = 'mobile-admin-sidebar-header';
        const sidebarTitle = document.createElement('span');
        sidebarTitle.className = 'font-semibold text-gray-900';
        sidebarTitle.textContent = 'Menu Admin';
        const sidebarClose = document.createElement('button');
        sidebarClose.id = 'mobile-admin-menu-close';
        sidebarClose.type = 'button';
        sidebarClose.setAttribute('aria-label', 'Tutup menu admin');
        sidebarClose.className = 'inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
        const sidebarCloseIcon = document.createElement('i');
        sidebarCloseIcon.className = 'fa-solid fa-xmark text-xl';
        sidebarCloseIcon.setAttribute('aria-hidden', 'true');
        sidebarClose.appendChild(sidebarCloseIcon);
        sidebarHeader.append(sidebarTitle, sidebarClose);

        const mobileProfile = document.createElement('div');
        mobileProfile.id = 'admin-mobile-profile';
        mobileProfile.hidden = true;
        const mobileProfileAvatar = document.createElement('span');
        mobileProfileAvatar.id = 'admin-mobile-profile-avatar';
        mobileProfileAvatar.setAttribute('aria-hidden', 'true');
        const mobileProfileEmail = document.createElement('span');
        mobileProfileEmail.id = 'admin-mobile-profile-email';
        mobileProfile.append(mobileProfileAvatar, mobileProfileEmail);

        const loginButton = document.createElement('button');
        loginButton.id = 'admin-login-button';
        loginButton.type = 'button';
        loginButton.setAttribute('aria-haspopup', 'menu');
        loginButton.setAttribute('aria-expanded', 'false');
        loginButton.className = 'inline-flex flex-shrink-0 items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm';
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
        ajuanLink.href = document.body.dataset.headerAjuanHref || 'ajuan-janjun.html';
        ajuanLink.setAttribute('role', 'menuitem');
        ajuanLink.className = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700';
        const ajuanIcon = document.createElement('i');
        ajuanIcon.className = 'fa-solid fa-file-circle-check w-4 text-center';
        ajuanIcon.setAttribute('aria-hidden', 'true');
        const ajuanLabel = document.createElement('span');
        ajuanLabel.textContent = document.body.dataset.headerAjuanLabel || 'Panel Ajuan';
        ajuanLink.append(ajuanIcon, ajuanLabel);

        const berjalanLink = document.createElement('a');
        berjalanLink.href = document.body.dataset.headerBerjalanHref || 'berjalan-janjun.html';
        berjalanLink.setAttribute('role', 'menuitem');
        berjalanLink.className = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700';
        const berjalanIcon = document.createElement('i');
        berjalanIcon.className = 'fa-solid fa-calendar-check w-4 text-center';
        berjalanIcon.setAttribute('aria-hidden', 'true');
        const berjalanLabel = document.createElement('span');
        berjalanLabel.textContent = document.body.dataset.headerBerjalanLabel || 'Panel Bulan Berjalan';
        berjalanLink.append(berjalanIcon, berjalanLabel);

        const logout = document.createElement('button');
        logout.id = 'admin-logout-button';
        logout.type = 'button';
        logout.setAttribute('role', 'menuitem');
        logout.className = 'mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50';
        logout.textContent = 'Keluar';

        menu.append(email, ajuanLink, berjalanLink, logout);
        account.append(mobileProfile, loginButton, menu);
        sidebar.append(sidebarHeader, account);
        inner.append(branding, menuToggle, backdrop, sidebar);
    }
    if (document.body.dataset.headerAccount === 'empty') inner.append(branding, account);
    header.append(inner);
    mount.replaceWith(header);
})();
