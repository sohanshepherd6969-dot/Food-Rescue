# FoodRescue: Surplus Food Redistribution & Demand Coordination Platform

FoodRescue connects **donors** (hostels, restaurants, caterers) who have surplus food with
**distributors** (NGOs, volunteer groups) who collect and redistribute it in Bangalore.
A **Super Admin** moderates users, listings and reports.

**Stack:** HTML, CSS, JavaScript, Bootstrap 5 (frontend) · Node.js + Express (backend) ·
MongoDB Atlas (database) · Cloudinary (food photos). No PHP.

## Features

| Role | What they can do |
|---|---|
| Donor | Register/login, post food with a photo, edit/cancel own listings, see who claimed it, mark pickups collected, see ratings received |
| Distributor | Register/login, browse food, filter by area/price/food type/kitchen type, sort by rating/free-first/price, claim food, track active and completed pickups, rate the donor after a pickup |
| Super Admin | Dashboard with statistics, suspend/activate users, remove listings, review reports, view all pickup activity |

Business rules enforced **on the server**:
- Price per plate can only be **Free, ₹5 or ₹10**.
- A listing can be claimed by **only one distributor**: the claim is a single atomic database update, so two simultaneous claims can't both succeed.
- Pickup status only moves **Available → Claimed → Completed** (or Claimed → Cancelled, which puts the food back on the marketplace).
- Donors can edit only **their own** listings, and only while still available.
- Public sign-up can create only donors and distributors; the admin comes from environment variables.

Out of scope for V1 (per brief): GPS, maps, coordinates, distance sorting, payments.

## Project structure

```
foodrescue/
├── frontend/                 Static site (deployed to Vercel)
│   ├── index.html            Landing page
│   ├── login.html, signup.html, profile.html, ratings.html
│   ├── donor/                dashboard, add-listing, listings, listing, pickups
│   ├── distributor/          dashboard, marketplace, food, pickups
│   ├── admin/                dashboard, users, listings, pickups, reports
│   ├── css/style.css         Theme on top of Bootstrap 5
│   └── js/                   config.js (API URL), app.js (helpers), layout.js, cards.js, pickups.js
└── backend/                  Express API (deployed to Render)
    ├── server.js             App entry
    ├── seed.js               Demo data
    └── src/
        ├── models/           User, FoodListing, PickupClaim, Review, Report
        ├── routes/           auth, listings, claims, reviews, reports, admin, stats
        ├── middleware/       auth (JWT + role check), upload (multer)
        └── utils/            cloudinary, ratings, ensureAdmin, ...
```

## Run locally

Requirements: Node.js 18+, a MongoDB Atlas cluster, a Cloudinary account.

```bash
cd backend
npm install
cp .env.example .env      # then fill in the values (see below)
npm run seed              # creates the admin + demo donors, distributors and listings
npm start                 # http://localhost:5000
```

Open **http://localhost:5000**. The backend also serves the frontend locally, so there's nothing else to start.

### Environment variables (`backend/.env`)

| Variable | What it is |
|---|---|
| `MONGODB_URI` | Atlas connection string, with the database name `foodrescue` |
| `JWT_SECRET` | Long random string used to sign login tokens (`openssl rand -hex 32`) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | From Cloudinary → Settings → API Keys |
| `CLIENT_ORIGIN` | Deployed frontend URL(s), comma-separated (for CORS) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The Super Admin account, created on first start/seed |
| `DEMO_PASSWORD` | Optional; password for seeded demo users (default `Demo@1234`) |
| `PORT` | Optional; default 5000 |

Secrets live only in `.env` (git-ignored) and in the hosting dashboards. Nothing secret is in the frontend.

## Demo data

`npm run seed` creates 4 donors and 3 distributors (emails `<name>@foodrescue.demo`, password `Demo@1234`)
and 17 listings across Koramangala, Indiranagar, Jayanagar and Whitefield, with some completed pickups and ratings.

| Role | Email |
|---|---|
| Donor | `aditi@foodrescue.demo`, `spice@`, `green@`, `tech@` |
| Distributor | `rahul@foodrescue.demo`, `priya@`, `hope@` |
| Super Admin | value of `ADMIN_EMAIL` / `ADMIN_PASSWORD` |

Pickup deadlines are set relative to the time you seed (a few hours to 3 days ahead), so **re-run the seed
before a demo**. Re-seeding only replaces the `@foodrescue.demo` accounts and their data; real sign-ups are kept.

## Deployment

### Backend → Render
1. New **Web Service** from the GitHub repo. **Root directory:** `backend`.
2. Build command: `npm install` · Start command: `npm start`.
3. Add every variable from the table above under **Environment**. Set `CLIENT_ORIGIN` to the Vercel URL.
4. In MongoDB Atlas → **Network Access**, allow `0.0.0.0/0` (Render has no fixed IP).
5. Check `https://<your-service>.onrender.com/api/health` returns `{"ok":true,"db":true}`.

The free Render plan sleeps after inactivity; the first request can take ~30-50 seconds.

### Frontend → Render Static Site (or Vercel / Netlify)
1. In `frontend/js/config.js`, set `PROD_API_BASE` to `https://<your-service>.onrender.com/api`.
2. Render → New → **Static Site** from the same repo. **Root directory:** `frontend`, build command empty, publish directory `.` (Vercel/Netlify work the same way).
3. Deploy, then put the static site URL into the backend's `CLIENT_ORIGIN` and save (the backend restarts).

## API summary

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET/PUT | `/api/auth/me` | logged in |
| GET | `/api/listings?area=&price=&foodType=&kitchenType=&q=&sort=` | logged in |
| GET | `/api/listings/mine` | donor |
| GET | `/api/listings/:id` | logged in |
| POST/PUT | `/api/listings`, `/api/listings/:id` (multipart, field `image`) | donor (own) |
| POST | `/api/listings/:id/cancel` | donor (own) |
| POST | `/api/claims` `{ listingId }` | distributor |
| GET | `/api/claims/mine`, `/api/claims/donor` | distributor / donor |
| POST | `/api/claims/:id/complete`, `/api/claims/:id/cancel` | either side of the pickup |
| POST | `/api/reviews` `{ claimId, rating, comment }` | distributor (rates the donor) |
| GET | `/api/reviews/mine` | logged in |
| POST | `/api/reports` | donor / distributor |
| GET/PATCH/POST | `/api/admin/*` (stats, users, listings, reports, claims) | admin only |
| GET | `/api/stats/public` | public (landing page numbers) |
