/* Builds the dashboard sidebar (desktop) and the top bar + slide-out menu (mobile).
   Each role gets its own navigation. Pages call: renderLayout('dashboard') */
const NAV = {
  donor: [
    ['dashboard', 'Dashboard', 'house-door', '/donor/dashboard.html'],
    ['listings', 'My Listings', 'card-list', '/donor/listings.html'],
    ['pickups', 'Pickup Requests', 'truck', '/donor/pickups.html'],
    ['ratings', 'My Ratings', 'star', '/ratings.html'],
    ['profile', 'Profile', 'person', '/profile.html'],
  ],
  distributor: [
    ['dashboard', 'Dashboard', 'house-door', '/distributor/dashboard.html'],
    ['browse', 'Browse Food', 'search', '/distributor/marketplace.html'],
    ['pickups', 'My Pickups', 'truck', '/distributor/pickups.html'],
    ['profile', 'Profile', 'person', '/profile.html'],
  ],
  admin: [
    ['dashboard', 'Dashboard', 'speedometer2', '/admin/dashboard.html'],
    ['users', 'Manage Users', 'people', '/admin/users.html'],
    ['listings', 'Manage Listings', 'card-list', '/admin/listings.html'],
    ['pickups', 'Pickup Activity', 'truck', '/admin/pickups.html'],
    ['reports', 'Reports', 'flag', '/admin/reports.html'],
  ],
};
const ROLE_LABEL = { donor: 'Donor Account', distributor: 'Distributor Account', admin: 'Super Admin' };

function renderLayout(active) {
  const user = Auth.user;
  const links = NAV[user.role] || [];
  const navHtml = `<nav class="nav flex-column side-nav gap-1">
      ${links.map(([key, label, icon, href]) => `<a class="nav-link ${key === active ? 'active' : ''}" href="${href}"><i class="bi bi-${icon}"></i>${label}</a>`).join('')}
      <a class="nav-link" href="#" onclick="logout();return false;"><i class="bi bi-box-arrow-left"></i>Logout</a>
    </nav>`;
  const chip = `<div class="user-chip"><div class="avatar">${esc(initials(user.name))}</div>
      <div class="lh-sm overflow-hidden"><div class="fw-semibold text-truncate">${esc(user.organizationName || user.name)}</div>
      <div class="small text-muted">${ROLE_LABEL[user.role]}</div></div></div>`;
  const brand = `<a class="brand" href="${HOME[user.role]}"><img src="/img/logo.svg" width="26" height="26" alt="">FoodRescue</a>`;

  document.getElementById('sidebar').innerHTML = `<div class="mb-2">${brand}</div>${chip}${navHtml}`;

  const top = document.createElement('div');
  top.className = 'mobile-topbar';
  top.innerHTML = `${brand}<button class="btn btn-light" data-bs-toggle="offcanvas" data-bs-target="#mobileNav" aria-label="Menu"><i class="bi bi-list fs-4"></i></button>`;
  document.querySelector('.app-layout').prepend(top);

  const off = document.createElement('div');
  off.className = 'offcanvas offcanvas-start';
  off.id = 'mobileNav';
  off.style.background = 'var(--fr-surface)';
  off.innerHTML = `<div class="offcanvas-header">${brand}<button class="btn-close" data-bs-dismiss="offcanvas"></button></div>
    <div class="offcanvas-body pt-0">${chip}${navHtml}</div>`;
  document.body.appendChild(off);
}
