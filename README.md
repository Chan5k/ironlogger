# IronLog — Gym workout tracker (iPhone-friendly web app)

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

   Safe to run again; only **new** exercise names are inserted.

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

   Open `http://localhost:5173`. Vite proxies `/api` to the Express server.

## Production build

```bash
npm run build --prefix client
npm start --prefix server
```

Serve the `client/dist` static files with Express, nginx, or a CDN, and set `CLIENT_URL` to your real front-end origin for CORS.

## Features

| Feature | Notes |
|--------|--------|
| Sign up / login | JWT stored in `localStorage`; Bearer token on API calls |
| Dashboard | Totals, weekly/monthly counts, estimated volume, recent workouts |
| Workouts | Create, edit, delete; per-workout **notes**; sets (weight, reps, done); mark **complete** (progress charts use completed sessions) |
| Exercise library | Categories; built-in seed list; **custom** exercises (edit/delete own) |
| Plans / templates | Build plans from the library; **Start workout** pre-fills sets |
| Progress | Line charts: max weight, total reps, volume per session |
| Reminders | Saved on your profile; **browser notifications** when the tab/app is open (interval check). On iPhone, add to **Home Screen** for a better PWA-like experience; full background push needs extra setup |
| Activity | Manual **steps**, **active calories**, **exercise minutes** per day + small chart |

## HealthKit / Apple Health

Safari and other browsers **cannot** access HealthKit. This project includes:

- An **Activity** screen for manual entry (you can copy values from the Health app).  
- A short note on wrapping the app in a **native iOS shell** if you later want real HealthKit sync.

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
- `GET/POST/PATCH/DELETE /api/exercises`  
- `GET/POST/PUT/DELETE /api/templates`, `POST /api/workouts/from-template/:templateId`  
- `GET/POST/PUT/DELETE /api/workouts`, `GET /api/workouts/summary`, `GET /api/workouts/progress/:exerciseId`  
- `GET /api/activity`, `PUT /api/activity/:dayKey` (`dayKey` = `YYYY-MM-DD`)  

All authenticated routes expect: `Authorization: Bearer <token>`.
