# IronLog — Gym workout tracker for mobile and desktop apps

Full-stack app for logging exercises, sets, reps, and weight; viewing progress charts; managing custom workout plans; and optional daily reminders. Built for **mobile Safari** (responsive layout, safe areas, 16px inputs to avoid iOS zoom).

## Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router, Recharts, Axios  
- **Backend:** Node.js, Express, JWT auth, Mongoose  
- **Database:** MongoDB  

## Prerequisites

- Node.js 18+  
- MongoDB running locally, or a connection string (MongoDB Atlas)  

## Setup

1. **Clone or copy this project** and enter the folder:

   ```bash
   cd webapp1
   ```

2. **Server environment**

   ```bash
   cp server/.env.example server/.env
   ```

   Edit `server/.env`:

   - `MONGODB_URI` — e.g. `mongodb://127.0.0.1:27017/gym-tracker`  
   - `JWT_SECRET` — long random string  
   - `CLIENT_URL` — `http://localhost:5173` for local dev  

3. **Install dependencies**

   ```bash
   npm run install:all
   ```

4. **Seed the global exercise library** (~940 exercises: strength, cardio, core, etc., aligned with common apps like Hevy — see `server/data/README.md`):

   ```bash
   npm run seed
   ```

   Safe to run again; only **new** exercise names are inserted. The same command also applies **demo video URLs** (HTTPS YouTube links) to a curated set of major lifts listed in `server/data/exercise-demo-videos.json`.

   To refresh only those videos after editing the JSON: `npm run seed:demos`.

   **Data source:** names come from the public-domain [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (mapped into IronLog categories) plus extra Hevy-style titles. This is not an official Hevy export; their site does not publish a full static list.

5. **Run the API** (terminal 1):

   ```bash
   npm run dev:server
   ```

   API defaults to `http://localhost:5000`.

6. **Run the client** (terminal 2):

   ```bash
   npm run dev:client
   ```

   Open `http://localhost:5173`. Vite proxies `/api` to the Express server. In dev mode the client
   **always** uses that proxy (it ignores `VITE_API_URL`), so a `.env.local` aimed at production will
   not break registration locally.

## Mobile navigation

On **narrow screens** (`md` breakpoint and below), the horizontal nav is replaced by a **hamburger menu** that opens a **left drawer** with the same links (larger tap targets), your **display name**, and **Sign out**. Desktop keeps the original top bar + wrapped nav row.

## Mobile E2E (Playwright)

Simulates a **phone-sized** user (Chromium, Pixel 7 profile): landing → login/register, and optionally the **drawer** after login.

```bash
cd client
npx playwright install chromium   # once
npm run test:e2e                  # starts Vite if not already on :5173
```

With API running and credentials:

```bash
E2E_EMAIL='you@example.com' E2E_PASSWORD='yourpassword' npm run test:e2e
```

Skip auto-starting Vite: `PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e` (run `npm run dev` yourself first).

## Production build

```bash
npm run build --prefix client
npm start --prefix server
```

Serve the `client/dist` static files with Express, nginx, or a CDN, and set `CLIENT_URL` to your real front-end origin for CORS.

## GitHub Pages (static client + API elsewhere)

The SPA is built with Vite `base` and React Router `basename` set from **`VITE_BASE_PATH`** so assets and routes work under `https://YOUR_USER.github.io/REPO_NAME/`.

1. **API server `CLIENT_URL`** — Add your Pages origin (no path is enough for CORS if you use the default; if CORS rejects, include the full origin GitHub shows, e.g. `https://YOUR_USER.github.io`, or add both `https://YOUR_USER.github.io` and `https://YOUR_USER.github.io/REPO_NAME` as comma-separated origins depending on how the browser sends `Origin`).
2. **GitHub Actions** — Workflow **Deploy client to GitHub Pages** (`.github/workflows/deploy-github-pages.yml`):
   - **Settings → Pages → Source: GitHub Actions.**
   - **Secrets:** `VITE_API_URL` = API origin only, e.g. `https://my-api.onrender.com` (the client will call `…/api/...`).
   - Optional: `VITE_VAPID_PUBLIC_KEY` (same value as server `VAPID_PUBLIC_KEY`).
   - Optional **repository variable** `VITE_BASE_PATH` to override the default (`/REPO/` for normal repos, `/` for `*.github.io` user sites).
3. **SPA deep links** — The workflow copies `index.html` to **`404.html`** and adds **`.nojekyll`** so client-side routes work on refresh.
4. **Manual build:** `VITE_BASE_PATH=/your-repo/ VITE_API_URL=https://your-api.com npm run build:gh-pages --prefix client` then upload `client/dist` to the `gh-pages` branch or Pages artifact.

## Features

| Feature | Notes |
|--------|--------|
| Sign up / login | JWT stored in `localStorage`; Bearer token on API calls |
| Dashboard | Totals, weekly/monthly counts, estimated volume, **streak** + **training days (last 7)** (by profile timezone), **this week volume by muscle category**, recent workouts |
| Workouts | Create, edit, delete; per-workout **notes**; sets (weight, reps, done); mark **complete** (progress charts use completed sessions) |
| Exercise library | Categories; built-in seed list; **custom** exercises (edit/delete own); optional **demo video** (HTTPS YouTube/Vimeo embed). **Seed** attaches demos to ~27 staple lifts (bench, squat, deadlift, row, pulldown, hip thrust, etc.). Admins can still edit **built-in** demo URLs |
| Share workouts & plans | **Share link** from a workout or plan (list or edit screen). Public preview at **`/share/:token`**; signed-in users can **save a copy** (import). API: `GET /api/public/share/:token` (no auth), `POST /api/share/...` (auth) |
| Plans / templates | Build plans from the library; **Start workout** pre-fills sets |
| Progress | Line charts: max weight, total reps, volume per session; **estimated 1RM** (Epley + Brzycki from best completed set, with caveats) |
| Reminders | Saved on your profile; **browser notifications** when the tab/app is open (interval check). Optional **Web Push** when the app is closed (`VAPID` + `CRON_SECRET` + `POST /api/cron/push-reminders` every minute from a scheduler) |
| Activity | Manual **steps**, **active calories**, **exercise minutes** per day + small chart |
| Rest timer | While a session is **in progress**, ticking **Done** starts a countdown (60–180s presets, custom default in local storage); optional **tone** and **vibration** at zero (where the OS allows) |
| PR hints | **Weight PR** badge when a **completed** non–warm-up set beats your prior max on that exercise (completed history; current workout excluded from baseline) |
| Warm-up sets | **Set type** warm-up (existing) plus **+ Warm-up set** shortcut; warm-ups excluded from volume/progress (unchanged) |
| Offline queue | Failed **workout** saves (create/update/delete/complete) can be **queued** and replayed when online; header **Sync** banner inside the app |
| Public profile | Optional `/u/:slug`: stats + **follower count**; **wall** (kudos once per visitor, comments with daily limit); **follow** / **Following** feed shows **high-level** activity only (session counts, no workout titles). **Friend invite** link `/add/:slug` (copy in **Settings**) sends visitors through login/register, **follows** that profile, and **follows back** so both people show in each other’s Following feed. Re-open the link once if you paired before this behavior existed. **Following** includes **Remove** (unfollow) with confirmation. Enable in **Settings** |
| Statistics | **Volume by category** (same muscle buckets as dashboard week view); longer windows than dashboard |

## HealthKit / Apple Health

Safari and other browsers **cannot** access HealthKit. This project includes an **Activity** screen for manual entry (you can copy values from the Health app).

## Project layout

```
webapp1/
├── README.md
├── package.json
├── server/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── seed.js
│       ├── middleware/
│       ├── models/
│       └── routes/
└── client/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/
        ├── context/
        ├── pages/
        └── ...
```

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET/PATCH /api/auth/me`  
- `GET/POST/PATCH/DELETE /api/exercises` (optional `videoUrl` on create; PATCH: owners edit custom exercises; **admins** may set `videoUrl` on built-in exercises only)  
- `GET /api/public/share/:token` — public snapshot for shared workout or plan (no auth)  
- `POST /api/share/workouts/:id`, `POST /api/share/templates/:id` — create share token; `POST /api/share/import-workout`, `POST /api/share/import-template` — save a copy; `DELETE /api/share/:token` — revoke (owner)  
- `GET/POST/PUT/DELETE /api/templates`, `POST /api/workouts/from-template/:templateId`  
- `GET/POST/PUT/DELETE /api/workouts`, `GET /api/workouts/summary` (includes `streak`), `GET /api/workouts/stats/muscles?days=`, `GET /api/workouts/progress/:exerciseId` (includes `estimatedOneRM`), `POST /api/workouts/pr-baselines`  
- `POST /api/auth/push-subscribe`, `DELETE /api/auth/push-unsubscribe` (body: `{ endpoint }`)  
- `POST /api/cron/push-reminders` — `Authorization: Bearer <CRON_SECRET>`; sends Web Push to users whose reminder time matches (requires `VAPID_*`)  
- `GET /api/social/profile/:slug/status` (optional auth), `POST/DELETE /api/social/follow/:slug`, `GET /api/social/feed`, `POST /api/social/wall/:slug`, `DELETE /api/social/wall/:slug/:entryId`  
- `GET /api/activity`, `PUT /api/activity/:dayKey` (`dayKey` = `YYYY-MM-DD`)  
- `GET /api/public/profile/:slug`, `GET /api/public/profile/:slug/wall` (optional auth on wall for `canDelete` flags)  

All authenticated routes expect: `Authorization: Bearer <token>`.
