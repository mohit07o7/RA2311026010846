# notification_system_design.md

---

## Stage 1

### REST API Design — Campus Notification Platform

#### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List all notifications (paginated, filterable) |
| POST | `/api/notifications` | Create a new notification |
| GET | `/api/notifications/:id` | Get a single notification by ID |
| PATCH | `/api/notifications/:id/read` | Mark one notification as read |
| PATCH | `/api/notifications/read-all` | Mark all notifications as read |
| GET | `/api/notifications/priority?n=10` | Get top-n priority notifications |
| GET | `/api/notifications/stats` | Count breakdown by type |
| DELETE | `/api/notifications/:id` | Delete a notification (admin) |

---

#### Headers (all protected routes)

```
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
```

---

#### GET `/api/notifications`

Query params: `?type=Placement|Result|Event`, `?page=1`, `?limit=20`, `?isRead=false`

**Response 200**
```json
{
  "page": 1,
  "limit": 20,
  "total": 5000000,
  "notifications": [
    {
      "ID": "d146095a-0d86-4a34-9e69-3900a14576bc",
      "Type": "Result",
      "Message": "mid-sem results published",
      "Timestamp": "2026-04-22T17:51:30Z",
      "isRead": false
    }
  ]
}
```

---

#### POST `/api/notifications`

**Request Body**
```json
{
  "type": "Placement",
  "message": "Infosys hiring — apply before Friday",
  "studentIds": [1042, 1043, 1044]
}
```

**Response 201**
```json
{
  "success": true,
  "notificationId": "b283218f-ea5a-4b7c-93a9-1f2f240d64b0",
  "deliveredTo": 3
}
```

---

#### PATCH `/api/notifications/:id/read`

No request body needed.

**Response 200**
```json
{
  "success": true,
  "ID": "b283218f-ea5a-4b7c-93a9-1f2f240d64b0",
  "isRead": true
}
```

**Response 404**
```json
{ "error": "Notification not found" }
```

---

#### PATCH `/api/notifications/read-all`

**Response 200**
```json
{ "success": true, "updated": 42 }
```

---

#### GET `/api/notifications/priority?n=10`

**Response 200**
```json
{
  "count": 10,
  "notifications": [
    {
      "ID": "b283218f-ea5a-4b7c-93a9-1f2f240d64b0",
      "Type": "Placement",
      "Message": "CSX Corporation hiring",
      "Timestamp": "2026-04-22T17:51:18Z",
      "isRead": false
    }
  ]
}
```

---

#### GET `/api/notifications/stats`

**Response 200**
```json
{
  "total": 5000000,
  "byType": {
    "Placement": 500000,
    "Result": 2000000,
    "Event": 2500000
  }
}
```

---

### Real-Time Notification Mechanism

**Choice: Server-Sent Events (SSE)**

Endpoint: `GET /api/notifications/stream`

SSE is chosen over WebSockets because:
- Notifications are **unidirectional** (server → client only) — SSE is designed exactly for this.
- SSE works over plain HTTP/1.1 — no extra protocol or infrastructure needed.
- Browsers auto-reconnect when the connection drops.
- Lighter resource usage than WebSockets for one-way data flow.

**SSE Event Format**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: notification
data: {"ID":"b283218f","Type":"Placement","Message":"Infosys hiring","Timestamp":"2026-04-22T18:00:00Z"}

event: notification
data: {"ID":"d146095a","Type":"Result","Message":"mid-sem published","Timestamp":"2026-04-22T18:01:00Z"}
```

**At Scale (50,000 students)**  
SSE connections are load-balanced across multiple server instances. A **Redis Pub/Sub** channel acts as the message broker — when HR publishes a notification, all server instances receive it and push it to their connected clients simultaneously.

```
HR clicks "Notify All"
        │
        ▼
   API Server → Redis PUBLISH "notifications" channel
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
      Server 1      Server 2      Server 3
    (10k SSE)     (20k SSE)     (20k SSE)
```

---

## Stage 2

### Persistent Storage — PostgreSQL

**Why PostgreSQL?**

| Factor | Reason |
|--------|--------|
| ACID compliance | `isRead` updates must be atomic — concurrent updates must not corrupt state |
| ENUM type support | `notification_type` enum maps directly to a PostgreSQL ENUM |
| Partial indexes | Index only unread rows — keeps index small and fast |
| Read replicas | Scale reads horizontally without application changes |
| Maturity | Battle-tested at millions of rows; managed options (RDS, Supabase, Neon) available |

---

### Schema

```sql
CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

CREATE TABLE students (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per unique notification content
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       notification_type NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction table: one row per student-notification pair
-- Stores per-student read state without duplicating notification data
CREATE TABLE student_notifications (
  student_id      INT  NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  delivered_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, notification_id)
);
```

---

### Problems as Data Grows

| Problem | Description |
|---------|-------------|
| **Slow unread queries** | Full table scan across 5M rows with no index |
| **Fan-out write bottleneck** | Inserting 50,000 rows one at a time is too slow |
| **Hot rows** | Same notification read by thousands of students simultaneously |
| **Connection exhaustion** | 50,000 students opening DB connections directly |
| **Table bloat** | Old notifications never purged; table grows indefinitely |

**Solutions**

- **Composite partial index** — index only the rows and columns actually queried.
- **Bulk inserts** — `INSERT INTO ... VALUES (...), (...), (...)` in batches of 1,000.
- **Message queue** — BullMQ / RabbitMQ handles fan-out asynchronously.
- **Connection pooling** — PgBouncer pools 20–50 real DB connections for thousands of app clients.
- **Read replicas** — all SELECT queries go to replica; writes go to primary only.
- **Archival** — move notifications older than 90 days to a cold table or object storage.

---

### SQL Queries

```sql
-- GET /api/notifications (unread, paginated)
SELECT n.id, n.type, n.message, n.created_at, sn.is_read
FROM notifications n
JOIN student_notifications sn ON sn.notification_id = n.id
WHERE sn.student_id = 1042
  AND sn.is_read = FALSE
ORDER BY n.created_at DESC
LIMIT 20 OFFSET 0;

-- PATCH /api/notifications/:id/read
UPDATE student_notifications
SET is_read = TRUE
WHERE student_id = 1042
  AND notification_id = 'b283218f-ea5a-4b7c-93a9-1f2f240d64b0';

-- PATCH /api/notifications/read-all
UPDATE student_notifications
SET is_read = TRUE
WHERE student_id = 1042 AND is_read = FALSE;

-- GET /api/notifications/stats
SELECT n.type, COUNT(*) AS total
FROM notifications n
JOIN student_notifications sn ON sn.notification_id = n.id
WHERE sn.student_id = 1042
GROUP BY n.type;
```

---

## Stage 3

### Query Analysis

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

**Is this query accurate?**

The intent is correct but there are two problems:
1. `SELECT *` fetches every column — wasteful when the UI only needs a few fields.
2. Without an index on `(studentID, isRead, createdAt)`, PostgreSQL does a full sequential scan over all 5 million rows.

**Why is it slow?**

No index exists on the filter or sort columns. The database reads every row in the table, evaluates the WHERE clause in memory, then sorts the result — O(n) disk I/O per query regardless of how many rows match.

**Fix — composite partial index**

```sql
-- Only index rows where is_read = FALSE (the hot path)
-- This keeps the index small and automatically shrinks as notifications are read
CREATE INDEX idx_student_notifications_unread
ON student_notifications (student_id, delivered_at DESC)
WHERE is_read = FALSE;
```

**Rewritten query**

```sql
SELECT n.id, n.type, n.message, n.created_at
FROM notifications n
JOIN student_notifications sn ON sn.notification_id = n.id
WHERE sn.student_id = 1042
  AND sn.is_read = FALSE
ORDER BY n.created_at DESC
LIMIT 20;
```

**Likely cost after index**

The index scan fetches only unread rows for student 1042 (typically tens to hundreds of rows, not 5M). Expected query time drops from **seconds → single-digit milliseconds**.

---

### Should every column be indexed?

**No. This is harmful advice.**

| Consequence | Reason |
|-------------|--------|
| Slower writes | Every INSERT/UPDATE/DELETE must update all indexes — fan-out broadcast of 50,000 rows becomes 5× slower |
| Wasted RAM | PostgreSQL loads indexes into `shared_buffers` — useless indexes evict useful data |
| Planner confusion | Too many indexes can cause the query planner to pick a suboptimal plan |

**Rule of thumb:** Index only columns that appear in `WHERE`, `JOIN ON`, or `ORDER BY` in frequent queries. Use `EXPLAIN ANALYZE` to verify the planner uses the index.

---

### Placement Notifications — Last 7 Days

```sql
SELECT s.id AS student_id, s.name, s.email, n.message, n.created_at
FROM students s
JOIN student_notifications sn ON sn.student_id = s.id
JOIN notifications n ON n.id = sn.notification_id
WHERE n.type = 'Placement'
  AND n.created_at >= NOW() - INTERVAL '7 days'
ORDER BY n.created_at DESC;
```

---

## Stage 4

### Caching to Relieve DB Load

Notifications are fetched on every page load for 50,000 students. The DB cannot sustain this. Below are four complementary strategies with tradeoffs.

---

#### Strategy 1 — Redis Application Cache

Cache the notification list per student with a TTL.

```
Request → App → Redis HIT  → return cached list (< 1ms)
              → Redis MISS → query DB → cache in Redis (TTL 60s) → return
```

When a student marks a notification as read, delete their cache key to force a fresh fetch.

| Pro | Con |
|-----|-----|
| Near-zero DB reads for active users | Stale data for up to TTL seconds |
| O(1) Redis lookup | Extra infra (Redis cluster) |
| TTL auto-evicts old data | Cache invalidation on mark-read adds complexity |

---

#### Strategy 2 — HTTP Cache Headers

Set `Cache-Control: private, max-age=30` on the notification list response.

| Pro | Con |
|-----|-----|
| Zero server cost for repeat loads within 30s | Not suitable for real-time accuracy |
| No extra infrastructure | Browser-only; ignored by mobile apps |

---

#### Strategy 3 — Read Replica + Connection Pooling

Route all SELECT queries to a PostgreSQL read replica. Use PgBouncer to pool connections.

| Pro | Con |
|-----|-----|
| Scales read throughput horizontally | Replication lag (usually < 100ms) |
| No stale data (eventual consistency only) | Additional infrastructure cost |

---

#### Strategy 4 — Pagination + Lazy Loading

Load 20 notifications per page and fetch more as the user scrolls, instead of loading all at once.

| Pro | Con |
|-----|-----|
| Each query is tiny — fast and cheap | Requires frontend changes |
| Reduces payload size dramatically | UX must handle load-more state |

---

**Recommended combination for production:**  
Redis cache (60s TTL) + pagination (20 per page) + read replica for heavy aggregation queries.

---

## Stage 5

### Shortcomings of the Proposed Implementation

```python
function notify_all(student_ids: array, message: string):
  for student_id in student_ids:
    send_email(student_id, message)   # calls Email API
    save_to_db(student_id, message)   # DB insert
    push_to_app(student_id, message)  # real-time push
```

| # | Problem | Impact |
|---|---------|--------|
| 1 | **Sequential loop** | 50,000 iterations run one-by-one — estimated time > 10 minutes |
| 2 | **No error recovery** | If `send_email` fails for student #200, students 201–50,000 are silently skipped |
| 3 | **Tight coupling** | A slow email API blocks the DB write and push for every student |
| 4 | **No retry logic** | Transient failures (network blip, rate limit) cause permanent misses |
| 5 | **50,000 individual DB inserts** | Should be a single bulk INSERT |
| 6 | **No atomicity** | Partial state possible: email sent, DB write failed |

---

### Logs show `send_email` failed for 200 students midway

Without a queue and idempotency, those 200 students are permanently skipped. To recover:
- Each student+notification pair needs a unique **job ID** — re-running the job won't double-send.
- Failed jobs go to a **Dead-Letter Queue (DLQ)** for inspection and manual retry.

---

### Should DB save and email happen atomically?

**No.** The email API is external and cannot participate in a DB transaction. Forcing them together causes:
- Long-held transactions blocking other writes.
- DB rollback if the email API is slow but ultimately succeeds.

The correct pattern is **save to DB first (source of truth), then enqueue email/push as a side effect**. If the email fails, retry from the queue without touching the DB record.

---

### Redesigned Implementation

```python
function notify_all(student_ids: array, message: string):
  # Step 1: Bulk-insert all records atomically (single DB round trip)
  notification_ids = bulk_save_to_db(student_ids, message)

  # Step 2: Enqueue one async job per student — returns instantly
  for i, student_id in enumerate(student_ids):
    enqueue_job(queue="notifications", payload={
      "student_id":      student_id,
      "notification_id": notification_ids[i],
      "message":         message
    })

  log("info", "handler", f"enqueued {len(student_ids)} notification jobs")


# Worker process (20 workers run concurrently via Kafka / RabbitMQ / BullMQ)
function process_notification_job(job):
  try:
    send_email(job.student_id, job.message)   # retried independently
    push_to_app(job.student_id, job.message)  # SSE push
    mark_delivered(job.notification_id)       # update DB record
  except EmailError as e:
    log("error", "service", f"email failed for {job.student_id}: {e}")
    raise  # queue retries with exponential back-off → DLQ after max retries
  except PushError as e:
    log("warn", "service", f"push failed (non-critical) for {job.student_id}: {e}")
    # push failure is non-critical — do not block email or DB update
```

**Key improvements**

| Improvement | Benefit |
|-------------|---------|
| `bulk_save_to_db` | Single INSERT, O(1) DB round trips |
| Queue workers (parallel) | Total time ≈ max single job time, not sum |
| Per-job failure isolation | One failure doesn't skip the rest |
| Exponential back-off + DLQ | Transient errors are retried; permanent failures are inspectable |
| DB record exists before email | Consistent state guaranteed — no orphan emails |

---

## Stage 6

### Priority Inbox — Design & Implementation

**Scoring Formula**

```
finalScore = typeWeight + recencyScore

typeWeight:
  Placement = 3
  Result    = 2
  Event     = 1

recencyScore = 1 / (1 + minutes_since_timestamp)
  → decays smoothly from ~1.0 (just now) toward 0 (old)
```

Examples:
- Placement from 2 minutes ago → `3 + 1/(1+2)` = **3.33**
- Result from 2 minutes ago → `2 + 1/(1+2)` = **2.33**
- Event from 2 minutes ago → `1 + 1/(1+2)` = **1.33**
- Placement from 5 hours ago → `3 + 1/(1+300)` ≈ **3.003**
- Event from 1 minute ago → `1 + 1/(1+1)` = **1.5** (beats old Placement? No — 1.5 < 3.003)

This ensures **type always dominates** while **recency breaks ties** within the same type.

---

### Batch Approach — `getTopN(notifications, n)`

Sort all notifications by score descending, take the first n.

```
Time:  O(n log n)
Space: O(n)
```

Suitable when the full list is already in memory (our case — API returns max ~20 items).

---

### Streaming Approach — `TopNHeap` (MinHeap of size n)

When new notifications arrive continuously (e.g., from SSE stream), maintain top-n without re-sorting the entire list.

```
Insert a new notification:
  if heap.size < n          → push (O(log n))
  else if score > heap.min  → pop min, push new (O(log n))
  else                      → discard (O(1))
```

- **Insert cost: O(log n)** — constant regardless of total notification count.
- **Memory: O(n)** — only the top-n items are ever stored.

This is implemented in `notification_app_be/services/priorityService.js` as the `TopNHeap` class.

---

### API Endpoint

```
GET /api/notifications/priority?n=10
```

**Response**
```json
{
  "count": 10,
  "notifications": [
    { "ID": "...", "Type": "Placement", "Message": "Booking Holdings hiring", "Timestamp": "..." },
    { "ID": "...", "Type": "Placement", "Message": "Microsoft hiring",        "Timestamp": "..." },
    { "ID": "...", "Type": "Result",    "Message": "mid-sem results",         "Timestamp": "..." }
  ]
}
```

Placements always appear first. Within the same type, most recent appears first.

---

### Code Location

- **Scoring + batch sort:** `notification_app_be/services/priorityService.js` → `getTopN()`
- **MinHeap streaming:** `notification_app_be/services/priorityService.js` → `TopNHeap`
- **REST endpoint:** `notification_app_be/handlers/notificationHandler.js` → `priority()`
- **Standalone demo:** `notification_app_be/priority_demo.js` (run with `npm run priority`)

Output screenshots are in `notification_app_be/screenshots/`.
