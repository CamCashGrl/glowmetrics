# ✦ GlowMetrics — Setup Guide

## Project Structure

```
glowmetrics/
├── app/
│   ├── page.js                  ← Root (redirects to /landing or /dashboard)
│   ├── layout.js / globals.css  ← Global styles + fonts
│   ├── landing/page.js          ← Public marketing page
│   ├── login/page.js            ← Login + signup + admin access
│   ├── dashboard/page.js        ← User dashboard (auth protected)
│   ├── admin/page.js            ← Admin panel (your private view)
│   └── api/
│       ├── auth/admin/          ← Admin login endpoint
│       ├── upload/              ← CSV import endpoint
│       └── admin-stats/         ← Admin stats endpoint
├── lib/
│   ├── supabase.js              ← Supabase client
│   ├── analytics.js             ← All data aggregation logic
│   └── theme.js                 ← Design tokens
├── supabase/
│   └── setup.sql                ← Run once in Supabase SQL editor
└── .env.local                   ← Your config (fill in admin credentials)
```

---

## Step 1 — Update .env.local

Open `.env.local` and set your admin email and password:

```
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=YourStrongPasswordHere!
ADMIN_SECRET=some_random_long_string_here
```

The Supabase keys are already filled in.

---

## Step 2 — Run the database SQL (one time only)

1. Go to: https://supabase.com/dashboard/project/zxkxgafltsozxghmguvp/sql/new
2. Copy and paste the entire contents of `supabase/setup.sql`
3. Click **Run**

This creates your tables and enables Row Level Security.

---

## Step 3 — Install & run

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll land on the GlowMetrics marketing page.

---

## Step 4 — Enable email confirmations (optional)

By default Supabase requires email confirmation. To disable it for testing:
- Supabase Dashboard → Authentication → Providers → Email
- Toggle off "Confirm email"

---

## What's tracked per user

| Metric | Description |
|--------|-------------|
| Lifetime USD | Total earnings all time |
| Total tokens | All platforms combined |
| Avg tip | Per transaction |
| Avg per active day | Daily earning rate |
| Unique tippers | Lifetime fan count |
| Best day / best month | Peak earning periods |
| Biggest single tip | Largest transaction |
| Whale count | Tippers $50+ lifetime |
| Shark count | Tippers $20–$49 |
| Dormant count | Inactive 60+ days |
| Platform split | Chaturbate / BongaCams / MyFreeCams |
| Tip type breakdown | Tip / Private / Spy Show / Sale |
| Peak hours | By token volume, all 24 hours |
| Daily earnings table | Last 30 days with avg |
| Monthly earnings | Bar + line chart |
| Cumulative curve | All-time running total |
| Tipper CRM | Notes, follow-up flags, sort by USD/tokens/tips/inactive |

---

## Deploying to Vercel (free)

1. Push to GitHub
2. Go to vercel.com → Import your repo
3. Add all `.env.local` variables under Environment Variables
4. Deploy — get a free `*.vercel.app` URL instantly

---

## Admin access

On the login page, click **"Admin access →"** at the bottom.
Your admin panel is at `/admin`.

The admin view shows:
- Total user count
- New signups in last 30 days
- Total tip rows across all users
- Platform breakdown (aggregate, no personal data)
- Recent activity chart

Individual user data is inaccessible — enforced at database level.
