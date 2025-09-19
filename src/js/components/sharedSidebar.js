const PATH_TO_NAV = {
  '/app': 'invoices',
  '/invoices': 'invoices',
  '/customers': 'customers',
  '/vessels': 'vessels'
};

function resolveActiveNav(explicitKey) {
  if (explicitKey) {
    return explicitKey;
  }
  const currentPath = window.location.pathname.replace(/\/$/, '');
  return PATH_TO_NAV[currentPath] || 'invoices';
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('marine_invoice_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to parse stored user:', error);
    return null;
  }
}

function normalizeName(user) {
  return user?.name || user?.email || 'User';
}

export function configureSidebar(activeKey, options = {}) {
  const { manageAuth = true } = options;
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) {
    return;
  }

  const navItems = sidebar.querySelectorAll('.sidebar__nav-item');
  const resolvedKey = resolveActiveNav(activeKey);

  navItems.forEach((item) => {
    item.classList.remove('sidebar__nav-item--active');
    if (!item.classList.contains('sidebar__nav-item--inactive')) {
      item.classList.add('sidebar__nav-item--inactive');
    }
  });

  const activeItem = sidebar.querySelector(`.sidebar__nav-item[data-nav="${resolvedKey}"]`);
  if (activeItem) {
    activeItem.classList.add('sidebar__nav-item--active');
    activeItem.classList.remove('sidebar__nav-item--inactive');
  }

  if (!manageAuth) {
    return;
  }

  const userSection = sidebar.querySelector('#user-section');
  const authSection = sidebar.querySelector('#auth-section');
  const userNameEl = sidebar.querySelector('#user-name');
  const userEmailEl = sidebar.querySelector('#user-email');
  const logoutBtn = sidebar.querySelector('#logout-btn');
  const signInBtn = sidebar.querySelector('#sign-in-btn');

  const storedUser = getStoredUser();

  if (storedUser) {
    if (userSection) {
      userSection.style.display = 'flex';
    }
    if (authSection) {
      authSection.style.display = 'none';
    }
    if (userNameEl) {
      userNameEl.textContent = normalizeName(storedUser);
    }
    if (userEmailEl) {
      userEmailEl.textContent = storedUser.email || '';
    }
  } else {
    if (userSection) {
      userSection.style.display = 'none';
    }
    if (authSection) {
      authSection.style.display = 'flex';
    }
  }

  if (signInBtn) {
    signInBtn.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  if (logoutBtn) {
    logoutBtn.style.display = storedUser ? 'inline' : 'none';
  }
}
