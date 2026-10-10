// Where the backend API lives.
// - Local: the Express server also serves this frontend on port 5000, so the API is same-origin.
// - Production (Vercel): set PROD_API_BASE to the Render backend URL.
const PROD_API_BASE = 'https://foodrescue-api.onrender.com/api';

window.API_BASE = (() => {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!local) return PROD_API_BASE;
  return location.port === '5000' ? '/api' : 'http://localhost:5000/api';
})();
