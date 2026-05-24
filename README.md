# Allo Inventory Reservation System

A Next.js application implementing race-condition-free inventory reservation for a multi-warehouse e-commerce platform.

**Live demo:** https://allo-inventory-nine.vercel.app

---

## What it does

When a customer proceeds to checkout, the system temporarily holds the requested units for 10 minutes. If payment succeeds, the reservation is confirmed and stock is permanently decremented. If payment fails or the timer runs out, the hold is released and units become available again to other shoppers.

---

## Running Locally

### Prerequisites
- Node.js 18+
- A free [Neon](https://neon.tech) Postgres database

### 1. Clone and install

```bash
git clone https://github.com/KshitijPriyankar/allo-inventory
cd allo-inventory
npm install
```

### 2. Set up environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://..."   # from Neon dashboard
CRON_SECRET="allo-secret-123"     # any random string
```

### 3. Push schema and seed database

```bash
npx prisma db push
npx prisma db seed
```

### 4. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000

The USB-C Hub at Delhi Hub has only 1 unit — useful for testing the 409 (not enough stock) response.

---

## How the Concurrency Guard Works

The core problem: two users simultaneously trying to reserve the last unit of a product.

**The broken approach (TOCTOU race condition):**


Between steps 1 and 3, another request can do the same thing — both see stock available, both succeed, one unit gets double-booked.

**The solution: a single atomic SQL UPDATE**

```sql
UPDATE "Stock"
SET reserved = reserved + <quantity>
WHERE "productId"   = <id>
  AND "warehouseId" = <id>
  AND ("totalUnits" - reserved) >= <quantity>
```

PostgreSQL executes this with row-level locking. If two concurrent requests race for the last unit:

- Both reach the UPDATE at nearly the same time
- PostgreSQL serialises them internally at the row level
- First request: WHERE clause passes → reserved increments → rowsAffected = 1 ✅
- Second request: WHERE clause fails (no stock left) → rowsAffected = 0 → 409 ❌

This is wrapped in a Prisma `$transaction` so the Reservation record creation rolls back automatically if the UPDATE fails.

---

## How Expiry Works in Production

Two complementary mechanisms:

### 1. Vercel Cron Job (daily sweep)
`vercel.json` schedules `/api/cron/expire` to run once daily. It finds all PENDING reservations past their `expiresAt`, marks them RELEASED, and decrements the `reserved` count in Stock.

Note: Vercel Hobby plan limits cron to once per day. The lazy cleanup below handles real-time expiry in between.

### 2. Lazy cleanup on read (real-time)
When a new reservation is attempted, the POST handler first checks for any expired PENDING reservations for that product and warehouse, and releases them within the same transaction — before attempting the stock update. This means even if the cron hasn't run yet, a user won't be blocked by a ghost reservation that expired 30 seconds ago.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products with available stock per warehouse |
| GET | `/api/warehouses` | List warehouses |
| POST | `/api/reservations` | Reserve units — returns 409 if not enough stock |
| GET | `/api/reservations/:id` | Get a single reservation |
| POST | `/api/reservations/:id/confirm` | Confirm reservation — returns 410 if expired |
| POST | `/api/reservations/:id/release` | Release reservation early |
| GET | `/api/cron/expire` | Internal cron endpoint — releases expired reservations |

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Next.js 15 (App Router) | Framework |
| TypeScript | Language |
| Prisma 5 | ORM |
| PostgreSQL on Neon | Database |
| Zod | Request validation |
| Tailwind CSS | Styling |
| Vercel | Hosting + Cron Jobs |

---

## Trade-offs and What I'd Do Differently

**Redis distributed lock**
I considered adding a Redis lock (Upstash) around the reservation creation as an extra concurrency layer. The atomic SQL UPDATE is correct without it — PostgreSQL's row-level locking handles the race condition at the database level. Redis would reduce DB contention under extreme load by serialising requests before they hit the database, but adds operational complexity. Left it out to keep the solution focused and correct.

**Authentication**
No auth is implemented. In production, reservations would be tied to user accounts. The confirm and release endpoints would verify the requesting user owns that reservation.

**Quantity in UI**
The schema and API support any quantity, but the UI always reserves 1 unit. Easy to extend with a quantity picker.

**Live stock updates**
The product listing page fetches stock once on load. In production I would add polling or Server-Sent Events to push stock updates to all connected clients in real time.

**Idempotency**
Not implemented (bonus task). Would use a Redis key `idempotency:<key>` with a 24h TTL to store and replay responses for duplicate requests with the same `Idempotency-Key` header.

**Cron frequency**
Vercel Hobby plan only allows daily cron jobs. In production on a paid plan, I would run it every minute (`* * * * *`). The lazy cleanup on read compensates for this limitation.