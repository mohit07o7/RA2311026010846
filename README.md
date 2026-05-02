# Backend Evaluation — Campus Hiring

## Project Structure

```
├── logging_middleware/         # Reusable logging package
│   ├── logger.js               # Log() function — ships to test server
│   ├── auth.js                 # register() + authenticate()
│   └── config.js               # Env-based config loader
│
├── vehicle_maintenance_scheduler/
│   ├── server.js               # Express API server (port 3001)
│   ├── api.js                  # Fetches depots & vehicles from test server
│   ├── knapsack.js             # 0/1 Knapsack algorithm
│   ├── handlers/
│   │   └── schedulerHandler.js # Request handlers
│   ├── routes/
│   │   └── scheduler.js        # Express router
│   └── screenshots/            # Postman output screenshots
│
├── notification_app_be/
│   ├── server.js               # Express API server (port 3000)
│   ├── handlers/
│   │   └── notificationHandler.js
│   ├── services/
│   │   ├── notificationService.js  # Fetch + 1-min cache
│   │   └── priorityService.js      # Priority inbox + MinHeap
│   ├── routes/
│   │   └── notifications.js
│   ├── priority_demo.js        # Stage 6 standalone demo
│   └── screenshots/            # Postman + terminal output
│
├── notification_system_design.md   # Stages 1–6 design doc
├── .env.example                    # Environment variable template
└── package.json
```

---

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/RA2311026010846.git
cd RA2311026010846

# 2. Install dependencies
npm install

# 3. Configure credentials
cp .env.example .env
# Fill in your CLIENT_ID, CLIENT_SECRET, etc.
```

---

## Running the Servers

### Notification API (port 3000)

```bash
npm run dev
# or
node notification_app_be/server.js
```

### Vehicle Maintenance Scheduler (port 3001)

```bash
npm run scheduler
# or
node vehicle_maintenance_scheduler/server.js
```

### Stage 6 — Priority Inbox Demo

```bash
npm run priority
# or
node notification_app_be/priority_demo.js
```

---

## API Endpoints

### Notification App — `http://localhost:3000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/notifications` | List notifications (supports `?type=`, `?page=`, `?limit=`) |
| GET | `/api/notifications/priority?n=10` | Top-n priority inbox |
| GET | `/api/notifications/stats` | Counts by notification type |
| GET | `/api/notifications/:id` | Get a single notification |

### Vehicle Scheduler — `http://localhost:3001`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/depots` | List all depots with mechanic-hour budgets |
| GET | `/api/vehicles` | List all vehicle maintenance tasks |
| GET | `/api/schedule` | Optimal schedule for all depots |
| GET | `/api/schedule?depotId=2` | Optimal schedule for a single depot |

---

## Architecture

- **Logging Middleware** — singleton `Log()` function. Token injected at startup; all modules import from one place.
- **Vehicle Scheduler** — 0/1 Knapsack (DP, space-optimised). `O(n·W)` time where `n` = tasks, `W` = budget.
- **Notification Priority** — Score = `typeWeight + recency`. MinHeap maintains top-n in `O(log n)` per insert.
- **Caching** — Notification data cached in-memory for 60 seconds to avoid hammering the test server.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLIENT_EMAIL` | Registered email |
| `CLIENT_NAME` | Your name |
| `ROLL_NO` | Your roll number |
| `ACCESS_CODE` | Provided access code |
| `CLIENT_ID` | From registration response |
| `CLIENT_SECRET` | From registration response |
| `PORT` | Server port (default: 3000) |
