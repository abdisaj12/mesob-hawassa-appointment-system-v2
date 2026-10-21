# MESOB Hawassa — Government Service Appointment Booking

> **Book government service appointments online. No queues, no waiting rooms — just show up at your time.**

MESOB Hawassa Online Appointement Booking is a full-stack web application that allows citizens of Hawassa, Ethiopia to book appointments at government service offices online. Staff manage queues from an admin dashboard, and citizens can rate services and chat with support — all in English and Amharic.

---

## Features

### For Citizens
- Browse participating institutions and their services
- Book appointments in a guided 4-step wizard (institution → service → date/window → confirm)
- Choose AM or PM queue windows; queue number assigned automatically
- Look up any appointment by reference code without logging in
- View appointment history and cancel pending bookings
- Rate completed services (1–5 stars + comment) via auto-popup after being served
- Live chat support with issue type selection, in English or Amharic
- Dark mode and language toggle (EN / አማርኛ) on every page

### For Staff / Agents
- Dashboard scoped to their assigned institution
- View and filter appointments by date, window, service, and status
- Mark citizens as Served, No-show, or Cancelled; revert actions
- View feedback ratings submitted for their institution

### For Admins
- Full access across all institutions
- Manage institutions, services, users, and roles
- Assign agents to institutions
- View all citizen feedback with rating distribution and filters
- Manage support chats — reply in real time, resolve or close tickets

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TanStack Start (SSR), TanStack Router |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend | Supabase (PostgreSQL, Row Level Security, Realtime) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Deployment | Cloudflare Workers + Vercel |
| Runtime | Bun |
| Language | TypeScript |

---

## Project Structure

```
src/
├── components/
│   ├── AdminShell.tsx          # Admin sidebar layout
│   ├── BrandHeader.tsx         # Public nav (logo, dark mode, language, history link)
│   ├── FeedbackPopup.tsx       # Auto-popup for unrated served appointments
│   ├── FeedbackWidget.tsx      # Inline star rating widget (used in HistoryPage)
│   └── SupportChatWidget.tsx   # Floating citizen chat bubble
├── context/
│   ├── AuthContext.tsx         # Session, user, role management
│   ├── LanguageContext.tsx     # EN / Amharic toggle, persisted to localStorage
│   └── ThemeContext.tsx        # Dark / light mode, persisted to localStorage
├── lib/
│   └── i18n.ts                 # Translation dictionary
├── pages/
│   ├── HomePage.tsx            # Hero, features, institutions grid
│   ├── LoginPage.tsx           # Sign in / Sign up (email + Google)
│   ├── HistoryPage.tsx         # Citizen appointment history + feedback
│   ├── LookupPage.tsx          # Public reference lookup (no login needed)
│   ├── BookingWizard.tsx       # 4-step booking flow
│   └── admin/
│       ├── Dashboard.tsx
│       ├── Appointments.tsx
│       ├── Institutions.tsx
│       ├── Services.tsx
│       ├── Users.tsx
│       ├── Feedback.tsx        # Ratings overview with distribution bar
│       └── Support.tsx         # Real-time support chat panel
├── routes/                     # TanStack Router file-based routes
│   ├── __root.tsx
│   ├── index.tsx
│   ├── book.tsx                # Auth-guarded (redirects to login if not signed in)
│   ├── login.tsx
│   ├── history.tsx
│   ├── lookup.tsx
│   ├── admin.tsx
│   ├── admin.index.tsx
│   ├── admin.dashboard.tsx
│   ├── admin.appointments.tsx
│   ├── admin.institutions.tsx
│   ├── admin.services.tsx
│   ├── admin.users.tsx
│   ├── admin.feedback.tsx
│   └── admin.support.tsx
└── integrations/
    └── supabase/
        └── client.ts
supabase/
└── migrations/
    ├── 20260612100000_full_fix_bundle.sql     # Appointment booking + reference fix
    ├── 20260613000000_feedback_and_chat.sql   # Feedback + support chat tables
    └── fix_users_page.sql                     # Email column + get_all_users function
wrangler.jsonc                                 # Cloudflare Workers config
```

---

## Database Schema (key tables)

| Table | Description |
|---|---|
| `institutions` | Government offices (AAID, EEU, LDAB, etc.) |
| `services` | Services offered per institution |
| `appointments` | Citizen bookings with reference codes |
| `profiles` | Citizen/staff profiles linked to auth.users |
| `user_roles` | Role assignments: `citizen`, `agent`, `admin` |
| `feedback` | One rating (1–5 stars) per served appointment |
| `support_chats` | Support ticket sessions with status |
| `support_messages` | Individual messages inside a chat session |

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) installed
- A [Supabase](https://supabase.com) project
- A [Cloudflare](https://cloudflare.com) account (for deployment)

### 1. Clone and install

```bash
git clone https://github.com/your-username/ethi-queue-buddy.git
cd ethi-queue-buddy
bun install
```

### 2. Set environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### 3. Set up the database

Run the migration files in order in your Supabase SQL editor:

1. `supabase/migrations/20260612100000_full_fix_bundle.sql`
2. `supabase/migrations/20260613000000_feedback_and_chat.sql`
3. `supabase/migrations/fix_users_page.sql`

Or use the complete setup file if starting fresh:

```
supabase/migrations/complete_setup.sql
```

### 4. Run locally

```bash
bun run dev
```

App will be available at `http://localhost:3000`.

### 5. Create your first admin

After signing up, run this in the Supabase SQL editor:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'your@email.com'),
  'admin'
);
```

---

## Deployment (Cloudflare Workers)

```bash
bun run build
npx wrangler deploy
```

Set these environment variables in your Cloudflare Workers dashboard:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

## Deployment (Vercel)

This repo now supports a second deployment target on Vercel without removing the Cloudflare setup.

1. Create a Vercel project from this repository.
2. Set the environment variables below in Vercel:

```env
NITRO_PRESET=vercel
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. Keep the build command as `bun run build`.
4. Make sure your Supabase auth redirect URLs include the Vercel domain.
5. If you use Google OAuth, add the Vercel domain to the allowed redirect origins in Google Cloud Console.

The repo includes [vercel.json](vercel.json) for Bun support, and the Nitro preset is selected from `NITRO_PRESET` in [vite.config.ts](vite.config.ts).

---

## User Roles

| Role | Access |
|---|---|
| `citizen` | Book appointments, view history, chat support, rate services |
| `agent` | View and manage appointments for their assigned institution, see feedback |
| `admin` | Full access — all institutions, users, feedback, support chats |

To promote a user to agent and assign them to an institution, go to **Admin → Users → Edit**.

---

## Google OAuth Setup

1. Go to Supabase Dashboard → Authentication → Providers → Google
2. Add your Google Cloud OAuth client ID and secret
3. Add your site URL to the allowed redirect URIs in Google Cloud Console

---

## Participating Institutions

| Code | Institution |
|---|---|
| AAID | Hawassa City Administration ID Office |
| AAFDA | Agricultural & Food Development Authority |
| AAHB | Hawassa Housing Bureau |
| EEU | Ethiopian Electric Utility |
| LDAB | Land Development & Administration Bureau |
| INVEST | Investment Office |
| LRIA | Labour Relations & Immigration Authority |
| PDB | Planning & Development Bureau |
| HDC | Hawassa Development Corporation |
| TMA | Transport & Mobility Authority |

---

## License

This project was built for the Hawassa MESOB. All rights reserved.
