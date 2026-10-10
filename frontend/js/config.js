// Where the backend API lives.
// - Local: the Express server also serves this frontend on port 5000, so the API is same-origin.
// - Production (static site on Render): PROD_API_BASE is the Render backend URL.
const PROD_API_BASE = 'https://food-rescue-tylx.onrender.com/api';

window.API_BASE = (() => {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  // Pages served by the backend itself (e.g. https://food-rescue-tylx.onrender.com) use same-origin /api.
  if (!local) return location.origin === new URL(PROD_API_BASE).origin ? '/api' : PROD_API_BASE;
  return location.port === '5000' ? '/api' : 'http://localhost:5000/api';
})();
