/* Shared helpers used by every page: API calls, login state, formatting, toasts. */

/* ---------- Login state ---------- */
// "Remember me" keeps the session in localStorage; otherwise sessionStorage (cleared when the browser closes).
const Auth = {
  get token() { return localStorage.getItem('fr_token') || sessionStorage.getItem('fr_token'); },
  get user() {
    try { return JSON.parse(localStorage.getItem('fr_user') || sessionStorage.getItem('fr_user')); } catch { return null; }
  },
  save(token, user, remember = true) {
    this.clear();
    const store = remember ? localStorage : sessionStorage;
    store.setItem('fr_token', token);
    store.setItem('fr_user', JSON.stringify(user));
  },
  updateUser(user) {
    const store = localStorage.getItem('fr_token') ? localStorage : sessionStorage;
    store.setItem('fr_user', JSON.stringify(user));
  },
  clear() {
    for (const s of [localStorage, sessionStorage]) { s.removeItem('fr_token'); s.removeItem('fr_user'); }
  },
};

// requireRole() throws 'redirect' to stop the page script while the browser navigates away; don't log it as an error.
window.addEventListener('error', (e) => { if (e.message?.includes('redirect')) e.preventDefault(); });

const HOME = { donor: '/donor/dashboard.html', distributor: '/distributor/dashboard.html', admin: '/admin/dashboard.html' };

function logout() {
  Auth.clear();
  location.href = '/login.html';
}

// Call at the top of a protected page. Redirects if not logged in or wrong role.
function requireRole(...roles) {
  const user = Auth.user;
  if (!Auth.token || !user) {
    location.replace('/login.html?next=' + encodeURIComponent(location.pathname + location.search));
    throw new Error('redirect');
  }
  if (roles.length && !roles.includes(user.role)) {
    location.replace(HOME[user.role] || '/');
    throw new Error('redirect');
  }
  return user;
}

/* ---------- API ---------- */
// api('/listings', { method: 'POST', body: {...} })  or  { form: FormData } for file uploads.
async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (Auth.token) headers.Authorization = 'Bearer ' + Auth.token;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(window.API_BASE + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new Error('Cannot reach the server. It may be starting up (free hosting can take ~30s). Try again.');
  }
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && Auth.token) {
    Auth.clear();
    location.replace('/login.html?expired=1&next=' + encodeURIComponent(location.pathname + location.search));
    throw new Error(data.message || 'Session expired');
  }
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

/* ---------- Formatting ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const qs = (name) => new URLSearchParams(location.search).get(name);
const fmtPrice = (p) => (Number(p) === 0 ? 'Free' : `₹${p}/plate`);
const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
const initials = (name) => String(name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function fmtDate(d, withTime = true) {
  const date = new Date(d);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  let day;
  if (date.toDateString() === today.toDateString()) day = 'Today';
  else if (date.toDateString() === tomorrow.toDateString()) day = 'Tomorrow';
  else day = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  return withTime ? `${day}, ${time}` : day;
}

const isExpired = (l) => l.status === 'available' && new Date(l.pickupDeadline) <= new Date();

function statusBadge(status, listing) {
  const s = listing && isExpired(listing) ? 'expired' : status;
  const label = { available: 'Available', claimed: 'Claimed', completed: 'Completed', cancelled: 'Cancelled', removed: 'Removed', expired: 'Expired', open: 'Open', reviewed: 'Reviewed', resolved: 'Resolved', dismissed: 'Dismissed', active: 'Active', suspended: 'Suspended' }[s] || s;
  return `<span class="badge badge-soft status-${s}">${label}</span>`;
}
// Pickup (claim) status, worded for pickups.
function claimBadge(status) {
  const map = { claimed: ['Pending Pickup', 'claimed'], completed: ['Collected', 'completed'], cancelled: ['Cancelled', 'cancelled'] };
  const [label, cls] = map[status] || [status, status];
  return `<span class="badge badge-soft status-${cls}">${label}</span>`;
}

function typeBadges(l) {
  const food = { 'Pure Veg': 'badge-veg', 'Non-Veg': 'badge-nonveg', Mixed: 'badge-mixed' }[l.foodType];
  const kitchen = { Vegetarian: 'badge-veg', 'Non-Vegetarian': 'badge-nonveg', Mixed: 'badge-mixed' }[l.kitchenType];
  return `<span class="badge badge-soft ${food}">${esc(l.foodType)}</span>
          <span class="badge badge-soft ${kitchen}">${esc(l.kitchenType)} Kitchen</span>`;
}

function starsHtml(avg, count) {
  if (!avg) return '<span class="food-meta">No ratings yet</span>';
  const full = Math.round(avg);
  return `<span class="stars">${'★'.repeat(full)}<span class="off">${'★'.repeat(5 - full)}</span></span>
          <span class="food-meta">${avg.toFixed(1)}${count ? ` (${count})` : ''}</span>`;
}

const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#e5f1e3"/></svg>');
const imgTag = (url, cls, alt = '') => `<img src="${esc(url || PLACEHOLDER_IMG)}" class="${cls}" alt="${esc(alt)}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">`;

/* ---------- UI feedback ---------- */
function toast(message, type = 'success') {
  let box = document.querySelector('.toast-container');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toast-container position-fixed top-0 end-0 p-3';
    document.body.appendChild(box);
  }
  const icon = { success: 'check-circle-fill', danger: 'exclamation-triangle-fill', info: 'info-circle-fill' }[type] || 'info-circle-fill';
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${type === 'info' ? 'dark' : type} border-0`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `<div class="d-flex"><div class="toast-body"><i class="bi bi-${icon} me-2"></i>${esc(message)}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  box.appendChild(el);
  const t = new bootstrap.Toast(el, { delay: 3500 });
  el.addEventListener('hidden.bs.toast', () => el.remove());
  t.show();
}

// Disables a button and shows a spinner while `fn` runs.
async function withBusy(btn, fn) {
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Please wait';
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = html; }
}

// Promise-based confirm dialog using a Bootstrap modal.
function confirmDialog(title, message, okLabel = 'Confirm', okClass = 'btn-primary') {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal fade';
    el.innerHTML = `<div class="modal-dialog modal-dialog-centered"><div class="modal-content" style="border-radius:16px">
      <div class="modal-header border-0"><h5 class="modal-title">${esc(title)}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body pt-0">${message}</div>
      <div class="modal-footer border-0"><button class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
      <button class="btn ${okClass}" data-ok>${esc(okLabel)}</button></div></div></div>`;
    document.body.appendChild(el);
    const modal = new bootstrap.Modal(el);
    let ok = false;
    el.querySelector('[data-ok]').onclick = () => { ok = true; modal.hide(); };
    el.addEventListener('hidden.bs.modal', () => { el.remove(); resolve(ok); });
    modal.show();
  });
}

// Star-rating dialog. Resolves { rating, comment } or null.
function ratingDialog(title) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal fade';
    el.innerHTML = `<div class="modal-dialog modal-dialog-centered"><div class="modal-content" style="border-radius:16px">
      <div class="modal-header border-0"><h5 class="modal-title">${esc(title)}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body pt-0 text-center">
        <div class="star-input mb-3">${[1, 2, 3, 4, 5].map((n) => `<span data-n="${n}">★</span>`).join('')}</div>
        <textarea class="form-control" rows="2" maxlength="500" placeholder="Optional comment"></textarea></div>
      <div class="modal-footer border-0"><button class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
      <button class="btn btn-primary" data-ok disabled>Submit Rating</button></div></div></div>`;
    document.body.appendChild(el);
    const modal = new bootstrap.Modal(el);
    let rating = 0, result = null;
    const stars = el.querySelectorAll('.star-input span');
    stars.forEach((s) => s.onclick = () => {
      rating = Number(s.dataset.n);
      stars.forEach((x) => x.classList.toggle('on', Number(x.dataset.n) <= rating));
      el.querySelector('[data-ok]').disabled = false;
    });
    el.querySelector('[data-ok]').onclick = () => { result = { rating, comment: el.querySelector('textarea').value }; modal.hide(); };
    el.addEventListener('hidden.bs.modal', () => { el.remove(); resolve(result); });
    modal.show();
  });
}

const emptyState = (icon, text, action = '') => `<div class="empty-state"><i class="bi bi-${icon}"></i><p class="mb-2">${text}</p>${action}</div>`;
const loadingState = () => '<div class="text-center py-5"><div class="spinner-border text-success"></div></div>';
