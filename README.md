# WedCrew — Setup, Testing & API Guide

A marketplace connecting wedding **production companies** with **freelance crew**
(cinematographers, photographers, drone pilots, editors).

Stack: **React 19 + Vite + Tailwind** (frontend) · **Node/Express + MongoDB (Mongoose) + Socket.IO** (backend).

This guide walks through the complete application end-to-end. Follow it top to
bottom and you will exercise every major feature manually.

---

## Table of contents

1. [Project setup](#1-project-setup)
2. [Environment variables](#2-environment-variables)
3. [Database setup](#3-database-setup)
4. [Start the backend](#4-start-the-backend)
5. [Start the frontend](#5-start-the-frontend)
6. [Test accounts](#6-test-accounts)
7. [Automated flow test](#7-automated-flow-test)
8. [Manual testing walkthrough](#8-manual-testing-walkthrough)
9. [Subscription rules reference](#9-subscription-rules-reference)
10. [Subscription test matrix](#10-subscription-test-matrix)
11. [API reference](#11-api-reference)
12. [Database models](#12-database-models)
13. [Socket.IO events](#13-socketio-events)
14. [Error codes](#14-error-codes)
15. [Error cases & troubleshooting](#15-error-cases--troubleshooting)
16. [Production testing checklist](#16-production-testing-checklist)

---

## 1. Project setup

**Requirements:** Node.js 18+ (tested on 24), a MongoDB database (Atlas or local), npm.

```bash
git clone <your-repo-url>
cd twb2

cd backend  && npm install
cd ../frontend && npm install
```

Repository layout:

```
twb2/
├── backend/
│   ├── server.js                 HTTP server + Socket.IO bootstrap
│   ├── seedAdmin.js              Idempotent admin seeder (npm run seed:admin)
│   └── src/
│       ├── app.js                Express app, route mounting
│       ├── socket.js             Socket.IO auth, send_message, notifications
│       ├── config/
│       │   ├── database.js       Mongoose connection
│       │   └── defaultPlans.js   FREE / PRO / PREMIUM definitions
│       ├── models/               Mongoose schemas
│       ├── controllers/          Route handlers
│       ├── routes/               Express routers
│       ├── middleware/           protect (JWT), admin (role guard)
│       ├── services/
│       │   └── subscriptionService.js   ← single authority for access control
│       └── scripts/              Seed / migration / test scripts
└── frontend/
    └── src/
        ├── pages/                Home, Login, dashboards, Messages, admin/*
        ├── components/           Navbar, Footer, cards, SubscriptionStatusCard
        ├── context/              AuthContext, SocketContext
        ├── hooks/useSubscription.js
        └── utils/api.js          axios instance + API_BASE_URL
```

---

## 2. Environment variables

### `backend/.env`

```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<dbname>
JWT_SECRET=<a long random string>
```

| Variable      | Required | Notes |
|---------------|----------|-------|
| `PORT`        | no       | Defaults to `5000`. |
| `MONGODB_URI` | **yes**  | Server exits on connection failure. |
| `JWT_SECRET`  | **yes**  | Used to sign and verify JWTs and Socket.IO handshakes. Changing it logs everyone out. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | for seeder | Read by `npm run seed:admin`. See [Test accounts](#6-test-accounts). |
| `ADMIN_FIRST_NAME` / `ADMIN_LAST_NAME` / `ADMIN_MOBILE` | no | Optional admin details for the seeder. |

### `frontend/.env`

```env
# Optional. When omitted the frontend targets http://<current-hostname>:5000,
# which is what makes LAN testing (phone on the same Wi-Fi) work automatically.
VITE_API_URL=http://localhost:5000
```

> `VITE_API_URL` is read by `src/utils/api.js` and re-exported as `API_BASE_URL`,
> which the Socket.IO client also uses — so REST and sockets always agree on the host.

---

## 3. Database setup

No manual schema creation is needed; Mongoose creates collections on first write.

### Seed the subscription plans (required once)

```bash
cd backend
npm run seed:plans
```

Creates **FREE**, **PRO** and **PREMIUM** if missing. Idempotent — safe to re-run.

```
  + FREE     created  price=0     features=[profile_visibility]
  + PRO      created  price=999   features=[chat, profile_visibility]
  + PREMIUM  created  price=4999  features=[chat, profile_visibility, featured_listing, priority_support]
```

You can also create them from the UI: **Admin → Subscriptions → Manage Plans →
"Create missing default plans"**.

### Optional: normalise legacy subscription data

If the database predates the "one effective subscription per user" rule, a user
may hold several overlapping subscription rows. This script reports and cleans that up.

```bash
npm run migrate:subscriptions            # dry run — reports only, writes nothing
npm run migrate:subscriptions -- --apply # writes the changes
```

It flips past-due `active` rows to `expired`, keeps the best subscription per
user and marks the rest `cancelled`. **Nothing is deleted** — only `status` and
`cancelled_at` change. Running it is optional: the backend already picks the
correct subscription when duplicates exist.

---

## 4. Start the backend

```bash
cd backend
npm run dev      # nodemon, auto-restarts on change
# or
npm start        # plain node
```

Expected output:

```
MongoDB Connected: <your-cluster-host>
Server running on port 5000
```

Verify:

```bash
curl http://localhost:5000/api/health
# {"status":"ok","time":"..."}
```

**If it fails:**

| Symptom | Cause | Fix |
|---|---|---|
| `MongoDB Connection Error` then exit | Bad `MONGODB_URI`, or your IP is not allow-listed in Atlas | Fix the URI / add your IP under Atlas → Network Access |
| `EADDRINUSE :5000` | Another server already owns the port | Stop it, or set a different `PORT` (and update `VITE_API_URL`) |
| Every request returns 401 | `JWT_SECRET` missing or changed | Set it and log in again |
| Admin login returns 401 although the seeder said "Admin created" | `ADMIN_PASSWORD` contains an unquoted `#`, so dotenv truncated it and the stored hash is of the shortened value | Quote it (`ADMIN_PASSWORD='pass#word'`) then run `npm run seed:admin -- --reset-password` |

---

## 5. Start the frontend

```bash
cd frontend
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

**If it fails:** a blank page with `Network/CORS Error` in the console almost
always means the backend is not running or `VITE_API_URL` points at the wrong host.

---

## 6. Test accounts

**No seeded credentials ship with this repository, and none should.** Create your own.

### Create an admin (`npm run seed:admin`)

Admin accounts cannot be created through the registration form (registration only
allows `company` and `freelancer`). Use the idempotent seeder instead.

**Step 1 — add the credentials to `backend/.env`:**

```env
# Required
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=ChooseAStrongPassword

# Optional
ADMIN_FIRST_NAME=Site
ADMIN_LAST_NAME=Administrator
ADMIN_MOBILE=9876543210
```

| Variable | Required | Default | Maps to |
|---|---|---|---|
| `ADMIN_EMAIL` | **yes** | — | `User.email` |
| `ADMIN_PASSWORD` | **yes** | — | `User.password` (bcrypt, 10 salt rounds) |
| `ADMIN_FIRST_NAME` | no | `Site` | joined into `User.name` |
| `ADMIN_LAST_NAME` | no | `Administrator` | joined into `User.name` |
| `ADMIN_MOBILE` | no | `0000000000` | `User.phone` |

> The `User` model stores one `name` field, so first and last name are joined
> into it (`"Site Administrator"`). The schema is not modified.
>
> `backend/.env` is git-ignored — credentials never reach the repository, and the
> seeder never prints the password.

> **⚠️ If your password contains `#`, wrap it in single quotes.**
> dotenv treats an unquoted `#` as the start of a comment, so
> `ADMIN_PASSWORD=secret#123` silently loads as `secret` — the seeder would then
> hash the wrong value and login would return **401 Invalid credentials**.
>
> ```env
> ADMIN_PASSWORD='secret#123'   # correct
> ADMIN_PASSWORD=secret#123     # WRONG - truncated to "secret"
> ```
>
> The seeder detects this exact case and aborts with an explanation instead of
> writing an unusable hash. The same applies to any `.env` value containing `#`.
> After quoting, re-run `npm run seed:admin -- --reset-password`.

**Step 2 — run it:**

```bash
cd backend
npm run seed:admin
```

First run:

```
Admin created: admin@yourdomain.com
  name : Site Administrator
  role : admin
```

Every run after that (safe to include in a deploy step):

```
Admin already exists: admin@yourdomain.com (no changes made)
```

Behaviour:

- **Idempotent** — if an admin with `ADMIN_EMAIL` already exists, nothing is
  written and the script exits `0`. The lookup is case-insensitive, so
  `Admin@x.com` will not slip a second account past the unique email index.
- Creates the admin only when the email is unused, hashing the password with the
  same `bcryptjs` `genSalt(10)` approach `authController.registerUser` uses — so
  the account logs in through the normal `/api/auth/login` route.
- **Refuses to hijack an existing account.** If the email belongs to a company or
  freelancer it aborts with exit code `1` and changes nothing.
- Warns (but continues) if `ADMIN_MOBILE` is already used by another account,
  since registration rejects duplicate phone numbers.
- Exits `1` with a clear message if `ADMIN_EMAIL` / `ADMIN_PASSWORD` are missing,
  the email is malformed, or the password is shorter than 8 characters.

**Password recovery.** To re-hash `ADMIN_PASSWORD` for an admin that already exists:

```bash
npm run seed:admin -- --reset-password
```

This is the only mode that writes to an existing account.

Then sign in at `/login` — the navbar's **Dashboard** link routes admins to `/admin/dashboard`.

### Create a company and a freelancer

Register through the UI at `/register`:

| Field | Company | Freelancer |
|---|---|---|
| Role  | Company | Freelancer |
| Name  | `Test Studio` | `Test Cinematographer` |
| Email | `company@test.local` | `freelancer@test.local` |
| Phone | any 10 digits, **must be unique** | a different 10 digits |
| Password | your choice | your choice |

> Registration rejects an email **or phone** that already exists with
> `"User with this email or phone already exists"`. Use distinct phone numbers.

**Suggested test set** (used throughout section 8):

| Role | Email | Purpose |
|---|---|---|
| Admin | `admin@yourdomain.com` | Manage plans and subscriptions |
| Company | `company@test.local` | Post requirements, review applications, book crew |
| Freelancer | `freelancer@test.local` | Apply to requirements, accept bookings |

---

## 7. Automated flow test

Before testing by hand, run the automated suite. It drives the **real HTTP and
Socket.IO API** of a running server through every flow in section 8, then deletes
everything it created.

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd backend
E2E_ADMIN_EMAIL=admin@yourdomain.com E2E_ADMIN_PASSWORD=YourAdminPassword npm run test:flow
```

What it does:

- Registers throwaway company/freelancer accounts (emails ending in `@e2e.local`).
- Exercises: plans, admin overview, requirement → application → notifications,
  shortlist/accept, conversation creation, chat locking, every subscription
  transition (assign / change plan / expire / extend / cancel / pause / reactivate),
  booking request accept and decline, notification read state, and authorization guards.
- Deletes every account it created plus their requirements, applications,
  bookings, conversations, messages, notifications and subscriptions.

Expected tail:

```
============================================================
RESULT: 75 passed, 0 failed
============================================================
```

It **never touches pre-existing data** — cleanup is scoped to `@e2e.local`
non-admin accounts. Non-zero exit code means at least one flow is broken.

Options: `API_URL=http://192.168.1.5:5000 npm run test:flow` to target another host.

---

## 8. Manual testing walkthrough

Each step lists **WHO → WHERE → WHAT they click → EXPECTED → IF IT FAILS**.

Use three browser profiles (or one normal + two incognito windows) so Admin,
Company and Freelancer stay logged in simultaneously.

### 8.1 Admin login

| | |
|---|---|
| **WHO** | Admin |
| **WHERE** | `http://localhost:5173/login` |
| **CLICK** | Enter admin email + password → **Sign In to Portal** |
| **EXPECTED** | Redirect to the site; the navbar shows **Dashboard**, which opens `/admin/dashboard` with the sidebar (Dashboard, Freelancers, Companies, Requirements, Subscriptions…). |
| **IF IT FAILS** | `Invalid credentials` → run `npm run seed:admin -- --reset-password` to re-hash `ADMIN_PASSWORD`. A non-admin account will not see the admin sidebar. |

### 8.2 Create the plans

| | |
|---|---|
| **WHO** | Admin |
| **WHERE** | Admin → **Subscriptions** |
| **CLICK** | **Manage Plans** → **Create missing default plans (FREE / PRO / PREMIUM)** |
| **EXPECTED** | Alert lists what was created/already present. The modal shows three plans with their feature chips. `PRO` and `PREMIUM` show a `chat` chip; `FREE` does not. |
| **IF IT FAILS** | Confirm the backend is running and you are logged in as admin (the endpoint is admin-only). |

### 8.3 Company registration

| | |
|---|---|
| **WHO** | Company |
| **WHERE** | `/register` |
| **CLICK** | Select role **Company**, fill the form → **Create Account** |
| **EXPECTED** | Account created, redirect to login. After signing in, **Dashboard** opens `/company/dashboard`. |
| **IF IT FAILS** | `User with this email or phone already exists` → use a different email **and** phone. |

### 8.4 Freelancer registration

Same as 8.3 but with role **Freelancer**. Dashboard opens `/freelancer/dashboard`.

### 8.5 Subscription status before any plan

| | |
|---|---|
| **WHO** | Company (and Freelancer) |
| **WHERE** | Dashboard → **Overview** tab |
| **EXPECTED** | The **Subscription** card reads `No Plan`, badge `NOT SUBSCRIBED`, `Chat: Locked`, plus a **View Plans** button. |
| **IF IT FAILS** | Open DevTools → Network → `GET /api/subscriptions/me` should return 200 with `has_subscription: false`. |

### 8.6 Admin assigns a subscription

| | |
|---|---|
| **WHO** | Admin |
| **WHERE** | Admin → **Subscriptions** |
| **CLICK** | Search the company by name/email → **Assign Plan** → choose **PREMIUM** → set Start Date (today) and Expiry Date (e.g. +1 year) → **Assign Subscription** |
| **EXPECTED** | The row updates to `PREMIUM`, status badge `ACTIVE`, Chat `ENABLED`, and the expiry column shows the date plus days remaining. |
| **IF IT FAILS** | `Expiry date must be after the start date` → fix the dates. `Plan not found` → run the plan seeder first. |

Repeat for the freelancer. **Both sides need an active chat plan before messaging works.**

| | |
|---|---|
| **WHO** | Company |
| **WHERE** | Company dashboard → Overview (reload the page) |
| **EXPECTED** | Card now reads `PREMIUM`, `ACTIVE`, `Expires: <date>`, `Chat: Enabled`. |

### 8.7 Company creates a requirement

| | |
|---|---|
| **WHO** | Company |
| **WHERE** | Company Dashboard → **Requirements** → **Post New Requirement** (`/company/requirements/new`) |
| **CLICK** | Fill Category, State, City, Quantity, Event dates, Number of days, Payment per freelancer, Description → **Publish** |
| **EXPECTED** | Requirement created and listed under Recent Postings. Published requirements appear on the public `/requirements` page. |
| **IF IT FAILS** | `Please provide all required fields` → State, City, Event date, End date, Category, Quantity, Payment and Number of days are all mandatory. Only companies may post. |

> A requirement saved as **draft** will not be visible to freelancers. Set the status to **published**.

### 8.8 Freelancer applies

| | |
|---|---|
| **WHO** | Freelancer |
| **WHERE** | `/requirements` |
| **CLICK** | Find the requirement → **Apply Now** → enter Rate, Availability, Message → **Send Application** |
| **EXPECTED** | Button changes to **Application Sent**. |
| **IF IT FAILS** | `Already applied to this requirement.` → duplicate protection working as designed (one application per requirement per freelancer). `Requirement is not active` → it is still a draft or closed. |

> Freelancers **without** an active subscription still see the listing, but the
> company name, venue, payment and full description are masked
> (`Location Hidden (Subscribe to view)`). This masking uses the same central
> subscription service as chat.

### 8.9 Application notification reaches the company

| | |
|---|---|
| **WHO** | Company |
| **WHERE** | Company Dashboard → **Notifications** |
| **EXPECTED** | A **New Application Received** entry (`<freelancer> applied for <category>.`). The sidebar Notifications badge shows an unread count. If the company had the app open, it arrives live via Socket.IO with no refresh. |
| **IF IT FAILS** | Check `GET /api/notifications` returns the record. If it exists but did not appear live, the socket is disconnected — see section 15. |

### 8.10 Company reviews and shortlists

| | |
|---|---|
| **WHO** | Company |
| **WHERE** | Company Dashboard → **Requirements** → expand the requirement (**View Proposals**) |
| **CLICK** | **Shortlist** |
| **EXPECTED** | Application badge turns `shortlisted` (blue). The freelancer receives an **Application Shortlisted** notification. |

### 8.11 Company accepts the application

| | |
|---|---|
| **WHO** | Company |
| **CLICK** | **Accept** |
| **EXPECTED** | Badge turns `accepted` (green). Freelancer receives **Application Accepted** — *"You can now chat with the company."* |
| **IF IT FAILS** | Only the owning company may change an application's status; others get 403. |

### 8.12 Open the conversation

| | |
|---|---|
| **WHO** | Freelancer (or Company) |
| **WHERE** | `/requirements` card → **Open Chat**, or Dashboard → **Message** on the accepted application |
| **EXPECTED** | Navigates to `/messages` with that conversation selected. Because both sides are subscribed, the message input is available. |
| **IF IT FAILS** | `Chat requires an accepted application or an accepted booking request.` → the application is not `accepted` yet. |

> **Duplicate protection:** clicking Open Chat repeatedly, from either side,
> always returns the *same* conversation. One conversation exists per
> company/freelancer pair.

### 8.13 Send messages (real-time)

| | |
|---|---|
| **WHO** | Company and Freelancer |
| **WHERE** | `/messages` |
| **CLICK** | Type a message → **Send** (or press Enter) |
| **EXPECTED** | The message appears instantly for both users without refreshing. The recipient gets a **New message from …** notification. The conversation list re-sorts with the newest last message on top. |
| **IF IT FAILS** | `An active subscription with chat enabled is required for both users…` → one side is not active; check Admin → Subscriptions. Nothing happening at all → socket disconnected (section 15). |

> Repeated messages in the same conversation do **not** spam the notification
> list — one unread "new message" notification per conversation until it is read.

### 8.14 Booking request flow

| | |
|---|---|
| **WHO** | Company |
| **WHERE** | `/freelancers` (Professionals) |
| **CLICK** | On a freelancer card → **Request Booking** |
| **EXPECTED** | `Booking request sent`. The freelancer receives a **New Booking Request** notification. |
| **IF IT FAILS** | `A pending booking request already exists for this freelancer.` → duplicate protection; resolve the pending one first. |

| | |
|---|---|
| **WHO** | Freelancer |
| **WHERE** | Freelancer Dashboard → **Booking Requests** |
| **EXPECTED** | The request is listed with the fixed message: *"Hi, we're interested in connecting with you for a booking. Please review our request and respond if you're available."* |

| | |
|---|---|
| **WHO** | Freelancer |
| **CLICK** | **Accept** |
| **EXPECTED** | Status becomes `accepted`. A conversation is created (or the existing one reused — never duplicated). Company receives **Booking Request Accepted**. |

| | |
|---|---|
| **WHO** | Freelancer |
| **CLICK** | **Decline** (on a different request) |
| **EXPECTED** | Status becomes `declined` and the company receives **Booking Request Declined**. |

### 8.15 Locked chat behaviour

| | |
|---|---|
| **WHO** | Admin |
| **WHERE** | Admin → **Subscriptions** |
| **CLICK** | On the **company** row → **Deactivate** (pause) or **Cancel**, and confirm |
| **EXPECTED** | Row badge becomes `PAUSED` / `CANCELLED`, Chat `DISABLED`. |

| | |
|---|---|
| **WHO** | Company |
| **WHERE** | `/messages` (reload the page) |
| **EXPECTED** | The conversation is still listed with a 🔒 on its preview. Opening it shows **Messages Locked** — *"Your subscription is not active…"* and a reassurance that previous messages are safe. The input is hidden. |
| **IF IT FAILS** | If messages are still readable, hard-refresh; the check runs server-side on every fetch, so a stale tab may still show cached data. |

| | |
|---|---|
| **WHO** | Freelancer (still active) |
| **WHERE** | `/messages` → same conversation |
| **EXPECTED** | Also locked, with the message *"Your plan is active — the other participant needs an active subscription…"*. Attempting to send returns the subscription error, **and the company receives a "New message from …  / An active subscription is required to view and reply" notification.** |

### 8.16 Subscription renewal restores everything

| | |
|---|---|
| **WHO** | Admin |
| **WHERE** | Admin → **Subscriptions** |
| **CLICK** | On the company row → **Activate** (or **Extend** → add 30 days) |
| **EXPECTED** | Badge back to `ACTIVE`, Chat `ENABLED`. |

| | |
|---|---|
| **WHO** | Company |
| **WHERE** | `/messages` (reload) |
| **EXPECTED** | The conversation opens normally and **every previous message is still there**. Nothing was deleted while locked. |

> Reactivating a subscription whose expiry is already in the past returns
> `Expiry date is in the past. Extend the subscription before activating it.`
> Use **Extend** — extending past today reactivates it automatically.

### 8.17 Changing plans changes feature access

| | |
|---|---|
| **WHO** | Admin |
| **CLICK** | Company row → **Change Plan** → select **FREE** → **Change Plan** |
| **EXPECTED** | Status stays `ACTIVE` (dates unchanged) but Chat becomes `DISABLED`, because the FREE plan does not include the `chat` feature. The company's chat locks on the next load. |
| **THEN** | Change it back to **PRO**/**PREMIUM** → chat unlocks again. |

### 8.18 Notifications: read state and unread count

| | |
|---|---|
| **WHO** | Any user |
| **WHERE** | Dashboard → **Notifications** |
| **CLICK** | Click a notification |
| **EXPECTED** | It is marked read (title dims), and the sidebar unread badge decreases. |

---

## 9. Subscription rules reference

All access decisions live in **`backend/src/services/subscriptionService.js`**.
Nothing else re-implements them, and **the frontend is never the authority** — it
only renders what the backend reports.

| Function | Purpose |
|---|---|
| `getEffectiveSubscription(userId)` | Resolves the one subscription that counts; lazily flips past-due `active` rows to `expired`. |
| `hasActiveSubscription(userId)` | Is there a usable subscription right now? |
| `hasFeature(userId, 'chat')` | Does the active plan grant this feature? |
| `getLimit(userId, 'applications')` | Numeric cap from the plan (`null` = unlimited). |
| `canChat(companyId, freelancerId)` | **Both** sides checked; used by REST *and* Socket.IO. |
| `getSubscriptionSummary(userId)` | Serialisable snapshot for dashboards and the admin table. |
| `evaluateSubscriptionStatus()` | Bulk sweep of past-due subscriptions. |

### Statuses

| Status | Meaning | Grants access? |
|---|---|---|
| `active` | Running and not past its expiry | **Yes** |
| `expired` | Expiry date has passed | No |
| `cancelled` | Revoked by admin | No |
| `paused` | Temporarily deactivated by admin | No |
| `none` | User has never had a subscription | No |

An `active` row whose `end_date` is in the past is treated as **expired**
everywhere, and is rewritten to `expired` the next time it is read.

### One effective subscription per user

Assigning a plan **supersedes** the user's previous non-terminal subscriptions
(they become `cancelled`), and cancelling/expiring applies to *all* of a user's
live subscriptions. This is what makes "Deactivate" reliably remove access even
if legacy duplicate rows exist.

### Chat rule

```
chat unlocked  ⟺  company.subscription.active
               AND freelancer.subscription.active
               AND 'chat' ∈ company.plan.features
               AND 'chat' ∈ freelancer.plan.features
```

Enforced in three places, all calling `canChat()`:
`GET /api/chat/conversations` (lock flag), `GET …/messages` (403), and the
Socket.IO `send_message` handler (rejected ack).

### Plans

| Plan | Price | `chat` | `applications` limit |
|---|---|---|---|
| FREE | ₹0 | ✗ | 5 |
| PRO | ₹999 | ✓ | 50 |
| PREMIUM | ₹4999 | ✓ | 9999 |

Prices, features and limits are editable via `PUT /api/admin/plans/:id`.

### Payment-ready design

No payment gateway is integrated. The `Subscription` model already carries
`source` (`ADMIN` | `PAYMENT` | `RAZORPAY` | `SYSTEM`), `payment_provider`,
`payment_id`, `transaction_id`, `cancelled_at`, and `started_at` / `expires_at`
aliases. Admin-created subscriptions store `source: 'ADMIN'`. A future gateway
writes `source: 'PAYMENT'` with the provider fields filled in — **`hasFeature()`
and every access check work unchanged, because they never look at `source`.**

---

## 10. Subscription test matrix

These are covered automatically by `npm run test:flow`; the table shows how to
reproduce each by hand.

| # | Setup | Action | Expected |
|---|---|---|---|
| 1 | Company ACTIVE, Freelancer ACTIVE, plan has chat | Open `/messages`, send | Messages send and arrive in real time |
| 2 | Company ACTIVE, Freelancer EXPIRED | Open the conversation | Locked, `SUBSCRIPTION_REQUIRED` |
| 3 | Company EXPIRED, Freelancer ACTIVE | Open the conversation | Locked; detail names the company as the blocker |
| 4 | Company inactive | Admin activates the company | Chat available after reload |
| 5 | Freelancer inactive | Admin activates the freelancer | Chat available after reload |
| 6 | Both ACTIVE | Admin expires either side | Chat locks |
| 7 | Company on PRO | Admin changes plan to FREE | Chat locks (FREE has no `chat`); back to PRO re-unlocks |
| 8 | Any ACTIVE | Admin cancels | Protected features unavailable |
| 9 | Subscription EXPIRED | Admin extends by 30 days | Status returns to ACTIVE, chat restored |
| 10 | Both ACTIVE with history | Reload `/messages` | Conversation and all messages present |
| 11 | Subscription expires | Inspect the `messages` collection | Messages still stored — never deleted |
| 12 | Subscription reactivated | Reopen the conversation | Full prior history readable again |

---

## 11. API reference

Base URL: `http://localhost:5000`. Authenticated routes require
`Authorization: Bearer <token>` from `POST /api/auth/login`.

### Auth

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| POST | `/api/auth/register` | No | — | Register a company or freelancer |
| POST | `/api/auth/login` | No | — | Log in, returns `{ token, user }` |
| GET  | `/api/auth/me` | Yes | Any | Current user profile |

### Subscriptions (user-facing)

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| GET | `/api/subscriptions/plans` | No | — | Active plan catalogue |
| GET | `/api/subscriptions/me` | Yes | Any | Own plan, status, expiry, chat access |
| GET | `/api/subscriptions/chat-access/:otherUserId` | Yes | Company/Freelancer | Whether chat with that user is unlocked, and why not |

### Subscriptions & plans (admin)

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| GET | `/api/admin/subscriptions/overview` | Yes | Admin | One row per user + effective subscription. Query: `search`, `role`, `status` |
| GET | `/api/admin/subscriptions` | Yes | Admin | Raw subscription rows |
| GET | `/api/admin/subscriptions/user/:userId` | Yes | Admin | Full history for one user |
| POST | `/api/admin/subscriptions` | Yes | Admin | Assign a plan (`user_id`, `planId`, `start_date`, `end_date`, `amount?`) |
| PUT | `/api/admin/subscriptions/:id/status` | Yes | Admin | `active` \| `paused` \| `cancelled` \| `expired` |
| PUT | `/api/admin/subscriptions/:id/extend` | Yes | Admin | `{ days }` or `{ end_date }`; reactivates if newly future-dated |
| PUT | `/api/admin/subscriptions/:id/plan` | Yes | Admin | Change plan (`planId`, `amount?`) |
| PUT | `/api/admin/subscriptions/:id/dates` | Yes | Admin | Correct `start_date` / `end_date` |
| GET | `/api/admin/plans` | Yes | Admin | List all plans |
| POST | `/api/admin/plans` | Yes | Admin | Create a plan |
| POST | `/api/admin/plans/seed-defaults` | Yes | Admin | Create FREE/PRO/PREMIUM if missing |
| PUT | `/api/admin/plans/:id` | Yes | Admin | Edit price, features, limits, active flag |

### Admin (users, requirements, stats)

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| GET | `/api/admin/dashboard/stats` | Yes | Admin | Counts and chart data |
| GET | `/api/admin/freelancers` | Yes | Admin | Paginated freelancers (`page`, `limit`) |
| GET | `/api/admin/companies` | Yes | Admin | Paginated companies |
| GET | `/api/admin/requirements` | Yes | Admin | All requirements + stats |
| PUT | `/api/admin/requirements/:id/status` | Yes | Admin | Change requirement status |
| DELETE | `/api/admin/requirements/:id` | Yes | Admin | Delete a requirement |

### Requirements

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| POST | `/api/requirements` | Yes | Company | Create a requirement |
| GET | `/api/requirements` | Optional | Any | Browse; details masked for unsubscribed freelancers |
| GET | `/api/requirements/me` | Yes | Company | Own requirements |
| GET | `/api/requirements/:id` | Optional | Any | Single requirement (masked if unsubscribed) |
| PUT | `/api/requirements/:id` | Yes | Company (owner) | Update |
| DELETE | `/api/requirements/:id` | Yes | Company (owner) | Delete |
| PATCH | `/api/requirements/:id/status` | Yes | Company (owner) | draft / published / closed |

### Applications

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| POST | `/api/applications` | Yes | Freelancer | Submit an application (notifies the company) |
| GET | `/api/applications/my` | Yes | Freelancer | Own applications |
| GET | `/api/applications/my/requirement/:requirementId` | Yes | Freelancer | Own application for one requirement |
| GET | `/api/applications/requirement/:requirementId` | Yes | Company (owner) | Applications received |
| PATCH | `/api/applications/:id/status` | Yes | Company (owner) | `shortlisted` \| `accepted` \| `rejected` (notifies the freelancer) |

### Booking requests

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| POST | `/api/booking-requests` | Yes | Company | Send a booking request (notifies the freelancer) |
| GET | `/api/booking-requests/freelancer` | Yes | Freelancer | Requests received |
| PUT | `/api/booking-requests/:id/status` | Yes | Freelancer | `accepted` \| `declined` (notifies the company; accept creates/reuses the conversation) |

### Chat

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| GET | `/api/chat/conversations` | Yes | Company/Freelancer | Conversations with `is_locked` / `lock_reason` |
| POST | `/api/chat/conversations` | Yes | Company/Freelancer | Create or return the existing conversation |
| GET | `/api/chat/conversations/:conversationId/messages` | Yes | Participant | Messages, or 403 `SUBSCRIPTION_REQUIRED` |

### Notifications

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| GET | `/api/notifications` | Yes | Any | Own notifications, newest first |
| GET | `/api/notifications/unread-count` | Yes | Any | Unread count |
| PATCH | `/api/notifications/:id/read` | Yes | Owner | Mark one read |
| PATCH | `/api/notifications/read-all` | Yes | Any | Mark all read |

### Other

| Method | Endpoint | Auth | Role | Purpose |
|---|---|---|---|---|
| GET | `/api/health` | No | — | Health check |
| GET | `/api/public/freelancers` | No | — | Public freelancer directory |
| GET | `/api/freelancer/profile` | Yes | Freelancer | Own profile + availability |
| POST | `/api/freelancer/profile` | Yes | Freelancer | Update profile + availability |
| GET | `/api/freelancer/dashboard/stats` | Yes | Freelancer | Dashboard counters |

---

## 12. Database models

### Relationships

```
User (company)                        User (freelancer)
   │                                       │
   ├── Requirement                          │
   │       │                                │
   │       └── Application ◄────────────────┤   freelancer applies
   │                │                       │
   │                ├─ accepted ──┐         │
   │                              ▼         │
   ├── BookingRequest ──accepted──► Conversation ──► Message
   │                                        │
   └────────────────────────────────────────┘

Any user ──► Subscription ──► Plan ──► features[] ──► feature access
Any user ──► Notification (recipient_id)
```

### Collections

| Model | Key fields | Notes |
|---|---|---|
| **User** | `role` (`admin`\|`company`\|`freelancer`), `name`, `email` (unique), `phone`, `password` (bcrypt), `city`, `state`, `profession` | Registration allows company/freelancer only |
| **Plan** | `name` (unique), `description`, `price`, `currency`, `billing_period`, `features[]`, `limits{}`, `isActive` (alias `is_active`), `sort_order` | `features` drives `hasFeature()`; `limits` drives `getLimit()` |
| **Subscription** | `user_id → User`, `planId → Plan`, `plan_name`, `amount`, `start_date` (alias `started_at`), `end_date` (alias `expires_at`), `status`, `payment_status`, `source`, `payment_provider`, `payment_id`, `transaction_id`, `cancelled_at`, `notes` | One effective subscription per user |
| **Requirement** | `company_id → User`, `category`, `city`, `state`, `event_date`, `end_date`, `quantity`, `payment_per_freelancer`, `number_of_days`, `status`, `applications_count` | Only `published` is visible to freelancers |
| **Application** | `requirement_id`, `freelancer_id`, `company_id`, `proposed_rate`, `availability`, `message`, `status` | Unique index on `(requirement_id, freelancer_id)` |
| **BookingRequest** | `company_id`, `freelancer_id`, `requirement_id?`, `message`, `status` | One *pending* request per company/freelancer pair |
| **Conversation** | `company_id`, `freelancer_id`, `requirement_id?`, `booking_id?`, `last_message`, `last_message_at` | One per company/freelancer pair |
| **Message** | `conversation_id`, `sender_id`, `receiver_id`, `message`, `message_type`, `read_at` | Never deleted when a subscription lapses |
| **Notification** | `recipient_id`, `recipient_role`, `type`, `title`, `message`, `application_id?`, `requirement_id?`, `conversation_id?`, `sender_id?`, `subscription_required`, `is_read` | Single notification system, DB + socket |
| **Availability** | `freelancer_id`, `date`, `status` | Freelancer calendar |

### Notification types

`new_application`, `application_shortlisted`, `application_accepted`,
`application_rejected`, `new_booking_request`, `booking_request_accepted`,
`booking_request_rejected`, `new_message`, `locked_message`.

---

## 13. Socket.IO events

Connection requires the JWT: `io(API_BASE_URL, { auth: { token } })`.
An invalid or missing token fails the handshake with `Authentication error`.

| Direction | Event | Payload | Notes |
|---|---|---|---|
| client → server | `join_conversation` | `conversationId` | Joins the room for live delivery |
| client → server | `send_message` | `{ conversationId, text, message }` + ack callback | Server verifies participation **and** `canChat()`; the receiver is derived from the conversation, not the client |
| server → client | `receive_message` | message document | Broadcast to the conversation room |
| server → client | `new_message_notification` | message document | Direct to the recipient's socket |
| server → client | `new_notification` | notification document | Any new notification, for live badges |
| server → client | `error` | string | Unexpected server-side failure |

`send_message` ack shapes:

```jsonc
// success
{ "success": true, "message": { /* saved message */ } }

// blocked
{ "success": false, "code": "SUBSCRIPTION_REQUIRED",
  "message": "An active subscription with chat enabled is required for both users to access chat.",
  "details": { "company_has_chat": false, "freelancer_has_chat": true,
               "self_has_chat": true, "reason": "The company does not have..." } }
```

---

## 14. Error codes

Subscription and flow errors use a predictable shape. Internal details
(stack traces, driver messages) are never returned to clients — they are logged
server-side only.

```json
{ "code": "SUBSCRIPTION_REQUIRED",
  "message": "An active subscription is required to access this feature." }
```

| Code | HTTP | Meaning |
|---|---|---|
| `SUBSCRIPTION_REQUIRED` | 403 | Chat/feature needs an active subscription (includes `details` for chat) |
| `FEATURE_NOT_IN_PLAN` | 403 | Subscription is active but the plan lacks the feature |
| `LIMIT_REACHED` | 403 | Plan limit exhausted |
| `CHAT_NOT_UNLOCKED` | 403 | No accepted application or booking between the two users |
| `FORBIDDEN` | 403 | Not a participant / not the owner / wrong role |
| `DUPLICATE_BOOKING_REQUEST` | 400 | A pending booking request already exists |
| `VALIDATION_ERROR` | 400 | Missing or invalid input |
| `EXPIRY_IN_PAST` | 400 | Cannot activate a subscription whose expiry has passed — extend it first |
| `USER_NOT_FOUND` / `PLAN_NOT_FOUND` / `SUBSCRIPTION_NOT_FOUND` / `CONVERSATION_NOT_FOUND` / `BOOKING_NOT_FOUND` | 404 | Referenced record missing |
| `SERVER_ERROR` | 500 | Unexpected failure (details logged server-side) |

---

## 15. Error cases & troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Admin login returns 401 right after seeding | `ADMIN_PASSWORD` contains an unquoted `#` — dotenv truncated it at the `#`, so the stored hash is of the shorter string | Quote the value in `.env` (`ADMIN_PASSWORD='pass#word'`), then `npm run seed:admin -- --reset-password` |
| `Not authorized, no token` | Missing/expired JWT | Log in again |
| `Not authorized as an admin` | Non-admin hitting `/api/admin/*` | Use an admin account |
| Chat locked although both look active | One plan lacks the `chat` feature (e.g. FREE), or the expiry has passed | Check the **Chat** column in Admin → Subscriptions |
| `Expiry date is in the past…` when activating | Subscription lapsed | Use **Extend** instead of **Activate** |
| Messages don't arrive live but appear after refresh | Socket disconnected | Check the browser console for a socket error; confirm `VITE_API_URL` matches the backend host and that the token is valid |
| Chat works locally but not from a phone on the LAN | `VITE_API_URL` hardcoded to `localhost` | Remove it (auto-detects the hostname) or set your LAN IP |
| `Already applied to this requirement.` | Duplicate application | Expected — one per requirement per freelancer |
| `A pending booking request already exists…` | Duplicate booking | Expected — resolve the pending one first |
| `Chat requires an accepted application or an accepted booking request.` | No accepted link between the two users | Accept an application or booking first |
| Freelancer sees `Location Hidden (Subscribe to view)` | No active subscription | Assign a plan in Admin → Subscriptions |
| Requirement not visible to freelancers | Status is `draft` or `closed` | Set it to `published` |
| Two subscription rows for one user | Legacy data | Run `npm run migrate:subscriptions -- --apply` |

---

## 16. Production testing checklist

**Backend**

- [ ] `npm start` boots and prints `MongoDB Connected` + `Server running on port …`
- [ ] `GET /api/health` returns 200
- [ ] `npm run seed:plans` shows FREE / PRO / PREMIUM present
- [ ] `npm run test:flow` reports `75 passed, 0 failed`
- [ ] `/api/admin/*` returns 403 for non-admin tokens
- [ ] Any request without a token returns 401

**Subscriptions**

- [ ] Assigning a plan supersedes the previous one (one effective subscription per user)
- [ ] Every status transition works: activate, pause, cancel, expire, extend, change plan
- [ ] The Chat column matches actual chat behaviour for each user
- [ ] A past-due `active` subscription is reported as `expired`

**Flows**

- [ ] Requirement → application → notification → shortlist → accept → chat
- [ ] Booking request → notification → accept/decline → notification
- [ ] Duplicate application, duplicate booking, duplicate conversation all blocked
- [ ] Notifications arrive live and the unread count is accurate

**Chat**

- [ ] Both active → messages send and arrive in real time
- [ ] Either side inactive → locked with a clear reason, existing messages preserved
- [ ] Reactivation restores the full history
- [ ] A non-participant cannot read or send in a conversation

**Frontend**

- [ ] `npm run build` completes with no errors
- [ ] Company, Freelancer and Admin dashboards all render
- [ ] Subscription card shows plan, status, expiry and chat access
- [ ] Layout holds on desktop, tablet and mobile

**Before going live**

- [ ] `JWT_SECRET` is a long random value, not the development one
- [ ] Restrict CORS in `backend/src/app.js` and the Socket.IO `origin` in `backend/src/socket.js` to your real frontend domain (both currently allow every origin)
- [ ] Remove any throwaway/test accounts
- [ ] Atlas Network Access allows only your server's IP
- [ ] `.env` files are not committed

---

## Command reference

| Command | Directory | Purpose |
|---|---|---|
| `npm run dev` | backend | Start with auto-reload |
| `npm start` | backend | Start the server |
| `npm run seed:plans` | backend | Create FREE / PRO / PREMIUM |
| `npm run seed:admin` | backend | Create the admin from `.env` (idempotent; `-- --reset-password` to re-hash) |
| `npm run migrate:subscriptions` | backend | Report legacy subscription duplicates (add `-- --apply` to write) |
| `npm run test:flow` | backend | Automated end-to-end flow suite |
| `npm run dev` | frontend | Vite dev server |
| `npm run build` | frontend | Production build |
| `npm run lint` | frontend | oxlint |
