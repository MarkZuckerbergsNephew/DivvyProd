# CLAUDE.md — Divvy Masterplan

> This file is the single source of truth for the Divvy project. Read it fully before touching any code. Every phase, every decision, every constraint is documented here. When in doubt, refer back to this file.

---

## What Is Divvy?

Divvy is a real-time, collaborative bill-splitting web app. Its core promise: **zero friction**. No download, no account required for a quick split. You open a link, enter your name, and you're in.

There are two modes:
- **Quick Split** — one-time, ephemeral. Restaurant bill, trip expense. No account needed.
- **Running Tab** — ongoing, persistent. Roommates, recurring groups. Requires account for the host.

**Target users:** Small groups (2–10 people). Mobile-first. The app should feel like a polished consumer product — not a school project, not a fintech tool. Think Venmo meets Linear.

---

## Tech Stack

- **Frontend:** Next.js (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend:** Python FastAPI + Uvicorn (receipt OCR — secondary); Next.js API route `/api/ocr` (primary)
- **Database:** Supabase (PostgreSQL + Realtime)
- **Auth:** Supabase Auth (Google OAuth + email/password — implemented)
- **Payments:** Venmo deep links (primary), CashApp links (secondary, DB column already exists)
- **Deployment:** Vercel (frontend), separate Python server (backend)
- **Dev:** `npm run dev` for local testing

---

## Design System

> Do not deviate from this system. Every new component must use these tokens.

### Colors
- **Background:** `#f8fafc` (soft slate-50 — not pure white)
- **Text:** `#0f172a` (slate-900 — not pure black)
- **Brand accent:** `#0d9488` (teal-600) — used for primary CTAs, active states, progress
- **Success:** `#22C55E`
- **Error:** `#EF4444`
- **Warning:** `#F59E0B`
- **Neutral grays:** `#f1f5f9`, `#e2e8f0`, `#94a3b8`, `#64748b`, `#374151`
- **Card background:** `#FFFFFF` with `box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`

Implement these as CSS custom properties in `globals.css`:
```css
:root {
  --bg: #f8fafc;
  --bg-card: #FFFFFF;
  --text: #0f172a;
  --text-muted: #64748b;
  --text-hint: #94a3b8;
  --accent: #0d9488;
  --accent-light: #CCFBF1;
  --accent-dark: #0f766e;
  --success: #22C55E;
  --success-light: #F0FDF4;
  --error: #EF4444;
  --error-light: #FEF2F2;
  --warning: #F59E0B;
  --warning-light: #FFFBEB;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-elevated: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
}
```

### Typography
- **Font:** `Geist` (already installed via `next/font/google` in `app/layout.tsx` — do not change)
- **Display/headings:** Geist 600–700, tight letter-spacing (`-0.02em`)
- **Body:** Geist 400, `line-height: 1.6`
- **UI labels:** Geist 500
- **Scale:** 12 / 14 / 16 / 18 / 24 / 32 / 40px

### Spacing
Use multiples of 4px. Standard page padding: `16px` sides on mobile, `24px` on larger screens.

### Motion
- Transitions: `150ms ease-out` for hover states, `200ms ease-out` for state changes
- Spring animations for item claims (scale bounce)
- `canvas-confetti` for session completion (already installed)
- Framer Motion for page-level animations and floating background blobs (already installed)
- Respect `prefers-reduced-motion`

### Component Principles
- Cards: white background, `var(--radius-lg)`, `var(--shadow-card)`, `1px solid var(--border)`
- Buttons (primary): `var(--accent)` background, white text, `var(--radius-md)`, `font-weight: 600`
- Buttons (secondary): white background, `var(--border)` border, `var(--text)` text
- Inputs: white background, `var(--border)` border, `var(--radius-md)`, focus ring in `var(--accent)`
- All interactive elements: minimum 44px touch target on mobile
- Bottom sheet modals for mobile actions (not centered modals)

---

## Participant Identity & Avatars

Each participant gets a persistent color derived from their name hash. This color is used **everywhere** — avatar background, claim chips on items, settlement rows, online indicators.

```typescript
// lib/participantColor.ts
const PALETTE = [
  '#FF6B6B', '#FF8E53', '#FFC048', '#51CF66',
  '#339AF0', '#845EF7', '#F06595', '#20C997',
  '#74C0FC', '#FFD43B', '#A9E34B', '#63E6BE',
];

export function getParticipantColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
```

Create a `<ParticipantAvatar>` component that renders a circle with the color + initials. Size variants: `sm` (24px), `md` (32px), `lg` (40px).

---

## Toast Notification System

Create a global toast system. **All Supabase errors must surface as toasts — never silent `console.error`.** Success actions get brief success toasts.

```typescript
// components/ToastProvider.tsx
// Expose: useToast() hook with toast.success(), toast.error(), toast.info()
// Toasts: slide in from top, auto-dismiss after 3s (errors: 5s), max 3 visible
// Position: top-center on mobile, top-right on desktop
```

---

## Phase 1 — Critical Fixes (Do This First)

### 1.1 Venmo Username Flow

**Problem:** Clicking "Pay with Venmo" generates a broken link if host has no `venmo_username`.

**Solution:**

1. **On `/create/page.tsx`:** Add an optional field: *"Your Venmo username (optional — lets others pay you easily)"*. Store it when creating the participant row.

2. **On `/join/[id]/JoinClient.tsx`:** Same optional field for the host joining their own session. ✅ Done.

3. **Inside SessionClient.tsx — host settings:** Add a small "Edit" button near the host's name in the participant list. Tapping it opens a bottom sheet with editable `venmo_username` and `cashapp_username` fields. Host-only.

4. **Venmo button guard:** If `host.venmo_username` is null or empty, replace the Venmo button with a muted button that reads *"Host hasn't added Venmo yet"*. If the current user IS the host, that button instead reads *"Add your Venmo to enable payments"* and opens the edit sheet.

5. **CashApp:** The `cashapp_username` column already exists in DB and is collected on join. Wire it into `SettlementPanel` as a secondary button below Venmo.

**Files to modify:** `app/create/page.tsx`, `app/join/[id]/JoinClient.tsx`, `app/session/[id]/SessionClient.tsx`, `components/session/SettlementPanel.tsx`, `lib/paymentLinks.ts`

---

### 1.2 Edit & Delete Items

**Problem:** No way to fix typos or remove wrongly added items.

**Rules:**
- Host-only
- Only during `active` status (not during `reviewing` or `completed`)
- Deleting an item cascades to all its claims (already handled by DB foreign key)

**UI:**
- Each item row gets a `...` menu button (kebab) on the right, host-only, active-only
- Menu options: "Edit item" → inline edit of name + price, "Delete item" → confirmation bottom sheet
- Inline edit: tap to turn name/price into inputs, confirm with checkmark, cancel with X
- Real-time: edits/deletes propagate instantly to all participants

**Files to modify:** `components/session/ItemList.tsx`, `app/session/[id]/SessionClient.tsx`

---

### 1.3 QR Code for Session Joining

**Problem:** Sharing a 5-char code requires typing. QR code = instant camera scan.

**Implementation:**
- Install `qrcode.react`: `npm install qrcode.react`
- The QR code encodes the full join URL: `https://[domain]/join/[sessionId]`
- Display it on the session page inside a modal/sheet, triggered by a "Share" button in the header
- The share sheet contains: the QR code (large, scannable), the 5-char join code displayed big, a "Copy link" button, and a native share button (Web Share API with fallback)
- QR code is also shown immediately after creating a session, before anyone has joined

**Files to modify:** `app/session/[id]/SessionClient.tsx`, `components/session/SessionShell.tsx`
**New component:** `components/ShareSheet.tsx`

---

### 1.4 Edge Cases & Error Handling

- Joining a `completed` or `reviewing` session: show a friendly message explaining the session has ended, with a "Start your own split" CTA
- Session ID not found: proper 404 page with a "Go home" button
- Supabase errors: surface via toast system (see above), never silent
- All async operations: show loading spinners in the relevant UI element, not full-page loaders

---

## Phase 2 — UI/UX Overhaul

> This phase transforms the app from "functional" to "product people screenshot and share." Work through this systematically — design system first, then component by component.

> **Scope note:** The landing/home page already has a decent animated background with floating blobs — keep it. The overhaul should focus on: the **session page** (item list, participant avatars, settlement panel, stage indicator), the **create and join pages**, and the **nav**. The home page needs a content/copy refresh (better hero text, clearer CTA) but the animated background and card layout stay as-is.

### 2.1 Global Foundation

1. Apply design system CSS variables to `globals.css` (teal accent, Geist font already in place)
2. Install and configure the toast system
3. Create `ParticipantAvatar` component
4. Create `participantColor.ts` utility

### 2.2 Landing Page (`app/page.tsx`)

Content and copy refresh only — the animated background stays.

**Changes:**
- Sharpen the hero text: current tagline is fine but can be punchier
- Make the "Start a split" CTA visually primary using `var(--accent)` teal
- Add a subtle "How it works" 3-step strip below the card (Create → Share → Everyone pays)
- Minimal footer: GitHub link

**Do not rebuild** the animated background or card layout — it already looks good.

### 2.3 Create Page (`app/create/page.tsx`)

- Clean card layout, centered
- Split type selector: two large tap targets ("Restaurant" and "General") with icons, not a dropdown
- Optional Venmo username field (see Phase 1.1)
- "Create split" button — full width, teal, large

### 2.4 Join Page (`app/join/[id]/JoinClient.tsx`)

- Show the session title prominently at the top
- Name input — large, auto-focused
- Optional Venmo/CashApp username fields (collapsed by default, "Add payment info" expander)
- "Join" button — full width, teal, large

### 2.5 Session Page — The Core Redesign (`app/session/[id]/SessionClient.tsx`)

This is the most important page. The redesign must solve the "what do I do?" confusion.

**Guided step indicator (top of page):**
```
[1. Add items] → [2. Everyone claims] → [3. Settle up]
```
The current active step is highlighted in teal. Non-active steps are muted gray. This stays visible at all times.

**Item list redesign:**
- Each item is a card (white, rounded, soft shadow)
- Left edge: a thin colored stripe in the "dominant claimant's color" (or gray if unclaimed)
- Item name (16px, bold) + price (16px, teal) on one line
- Below: a row of participant avatar chips showing who has claimed it
- Unclaimed items: a pulsing "tap to claim" hint in the subtitle area
- Claimed items: fill with a soft tinted background of the dominant claimant's color at 10% opacity
- **Duplicate item names:** group them with a quantity badge (e.g., "Burger ×3") rather than 3 separate rows. Each grouped item still tracks claims individually — the grouping is visual only.
- Progress bar: thin teal bar at the top of the item list showing % claimed

**Participant list redesign:**
- Horizontal scrolling row of avatar circles (colored per participant)
- Green dot for online, checkmark badge for paid
- Tapping an avatar highlights all items claimed by that person

**Bill summary (collapsible):**
- Collapsed by default on mobile to give item list room
- Shows: subtotal / tax / tip / total in a clean table
- Tax and tip inputs are inside this panel (host-editable)

**Bottom action bar:**
- Sticky to bottom of screen
- Changes based on session state:
  - `active` (host): "Start review →" button when all items claimed, otherwise shows unclaimed count
  - `active` (participant): shows your current total
  - `reviewing`: shows settlement amount for current participant
  - `completed`: shows "All done!" with confetti trigger

**Settlement panel:**
- Full-screen bottom sheet (not inline)
- Each row: avatar + name, amount owed, Venmo button, CashApp button (if available), paid checkmark
- Host sees all rows; participants see only their own row prominently + others' paid status

### 2.6 Pay Page (`app/pay/[sessionId]/[participantId]/PayPageClient.tsx`)

- Large amount display (centered, big number)
- Session title and host name for context
- Venmo button (primary, large)
- CashApp button (secondary, if available)
- "Mark as paid" button
- Confirmation animation on mark paid

### 2.7 NavBar

- "Divvy" wordmark left (links home)
- Right: avatar if logged in (Phase 4), or "Sign in" ghost button
- No "New Split" button in the nav — that belongs on the landing page and dashboard

---

## Phase 3 — Running Tab (New Core Feature)

> Do not start Phase 3 until Phases 1 and 2 are complete and working.

### Overview

A Running Tab is an ongoing shared expense ledger. Unlike a Quick Split (one-time, closes when everyone pays), a Running Tab stays open indefinitely. Members continuously add expenses, and the group settles up periodically.

**Mental model for users:** Think of it like a shared credit card statement. Everyone can add charges. At any time, someone can "settle up" and it records a partial payment. The balance keeps running.

### Data Model Changes

**`sessions` table — add column:**
```sql
split_mode text not null default 'quick' check (split_mode in ('quick', 'running_tab'))
```

**`items` table �� add columns:**
```sql
added_by uuid references participants(id),
item_date date not null default current_date,
category text  -- 'food', 'utilities', 'transport', 'entertainment', 'other'
```

**`settlements` table — new table:**
```sql
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  from_participant_id uuid references participants(id) on delete cascade,
  to_participant_id uuid references participants(id) on delete cascade,
  amount numeric not null,
  settled_at timestamptz not null default now(),
  note text
);
```

The existing `payments` table tracks "paid the whole bill" for Quick Splits. The new `settlements` table tracks partial payments for Running Tabs. These are separate flows.

### Running Tab Features

**Creating a Running Tab:**
- On `/create`, add a third split type option: "Running Tab 🏠" with subtitle "For roommates, trips, and ongoing groups"
- Running Tabs require the host to be signed in (prompt to sign in if not)

**Running Tab session page (new route or conditional rendering):**
- No "start review" or "settlement" flow — those don't apply
- Items grouped by date (today, yesterday, this week, etc.)
- Each item shows: name, price, who added it, who claimed it, date
- Any member can add items at any time (not just the host)
- "Settle up" button: calculates current net balances across all members and records a settlement
- Balance display: shows each member's current net balance (positive = owed to them, negative = they owe)
- History tab: shows all past settlements

**Balance calculation:**
The balance algorithm for Running Tabs is more complex than Quick Split:
1. Sum all claims per participant (what they "spent")
2. Sum all settlements per participant pair (what's been paid)
3. Net balance = total_claimed - total_paid_out + total_received

**Settle up flow:**
1. Tap "Settle up"
2. App shows a simplified debt graph (who owes whom, minimized transactions)
3. Each payer taps their row, confirms amount, taps Venmo/CashApp
4. Mark as settled → INSERT into `settlements`

### Running Tab Navigation

- Running Tabs appear on the dashboard (requires auth)
- Shareable join link still works (no-account join for members)
- Host can archive a tab (status → 'archived') to freeze it

---

## Phase 4 — Authentication

> Do not start Phase 4 until Phase 3 design is finalized.

### Strategy

- **Supabase Auth** (already in stack — zero new infrastructure)
- **Providers:** Google OAuth (primary, one tap) + email/password (fallback)
- **Quick Splits:** Auth is completely optional. Never gate a Quick Split behind login.
- **Running Tabs:** Host must be signed in. Members can join without auth.
- **"Claim your session":** After a Quick Split completes, show a subtle prompt: *"Sign in to save this to your history"*

### Profile Fields (stored in Supabase `auth.users` metadata or a `profiles` table)

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  venmo_username text,
  cashapp_username text,
  created_at timestamptz default now()
);
```

When a logged-in user creates a Quick Split or Running Tab, auto-populate their Venmo/CashApp username from their profile.

### Security Hardening

Currently, host privileges are gated by `localStorage` — easily spoofed. After auth:
- All host-only mutations (edit item, delete item, start review, change status) must verify the requesting user's `auth.uid()` matches `sessions.host_user_id` (new column)
- Tighten RLS policies to enforce this at the database level
- Participants in Running Tabs are verified by auth UID when signed in

### Dashboard (`app/dashboard/page.tsx`)

Auth-gated. Shows:
- Active Running Tabs (primary section, large cards)
- Recent Quick Splits (secondary, smaller cards, last 10)
- "New Quick Split" and "New Running Tab" CTAs at the top

### Login Page (`app/login/page.tsx`)

Currently an empty stub. Build it:
- Google OAuth button (primary)
- Email/password form (secondary, collapsible "Or sign in with email")
- Minimal, centered layout — same design system
- Redirect to dashboard on success, or back to wherever they came from

---

## Phase 5 — Visual Polish

> Goal: make the app feel premium, not functional. Every surface should be screenshot-worthy.

- **Quick Split session page** — item cards, participant list, bottom action bar visual overhaul
- **Running Tab** — item cards, balance dashboard, tab navigation visual overhaul
- **Landing page** — hero copy refresh (punchier tagline, clearer value prop)
- **PDF export** — improve layout, typography, and Divvy branding in the generated PDF
- **Session completion screen** — polish the confetti moment, final summary layout, share prompt

---

## Phase 6 — Launch Prep

> Complete before going live. Every item is a hard blocker.

- [ ] Update `NEXT_PUBLIC_SITE_URL` to the Vercel production URL
- [ ] Add production Google OAuth redirect URI in Google Cloud Console
- [ ] Add production URL to Supabase redirect allowlist (Auth → URL Configuration)
- [ ] Set all environment variables in Vercel dashboard (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `GOOGLE_VISION_API_KEY`)
- [ ] Final QA pass on mobile (iOS Safari + Android Chrome) — test Quick Split and Running Tab end-to-end

---

## Phase 7 — Post-Launch (Do Not Build Now)

These are logged here for reference. Do not implement during initial development.

- Receipt OCR UI (Next.js API route `/api/ocr` is done — needs Google Vision credentials configured; frontend `ScanReceiptModal` already built)
- Push/SMS notifications
- Item categories UI (the DB column will exist from Phase 3)
- Recurring items for Running Tabs
- Expense analytics / charts
- Native PWA installability
- Multi-currency support
- Item quantity field

---

## File Structure Conventions

```
app/
  (auth)/           # Auth-gated routes (dashboard, profile) — wrap with auth check
  (public)/         # Public routes (home, create, join, session, pay)
  api/ocr/          # Next.js API route for receipt OCR (Google Vision)
components/
  ui/               # Primitive components (Button, Input, Card, Badge, Avatar, Toast)
  session/          # Session-specific components (existing, to be redesigned in Phase 2)
  ShareSheet.tsx    # New — QR code + join code + share link
  ToastProvider.tsx # New — global toast system
  AnimatedBackground.tsx  # Existing — floating blobs background (keep as-is)
lib/
  participantColor.ts  # New — name → color + initials
  supabase.ts          # Existing — Supabase client
  billMath.ts          # Existing — calculation logic (fix normalizeItemWeights bug first)
  paymentLinks.ts      # Existing — Venmo/CashApp link generation
  generateCode.ts      # Existing — join code generation
  parseReceiptText.ts  # Existing — OCR text parser
hooks/
  useSessionRealtime.ts  # Existing — real-time subscriptions
  useToast.ts            # New — toast hook
```

---

## Execution Order

Execute phases in order. Do not skip ahead. Within each phase, do components in dependency order (design system tokens before components that use them).

| Phase | What | Gate | Status |
|---|---|---|---|
| 1 | Critical fixes (Venmo, edit/delete, QR, error handling) | Ship-blocking bugs | ✅ Complete |
| 2 | Full UI/UX overhaul | Makes the app shareable | ✅ Complete |
| 3 | Running Tab feature | New core feature | ✅ Complete |
| 4 | Authentication | Required for Running Tab to scale | ✅ Complete |
| 5 | Visual Polish | Makes the app feel premium | 🟡 In progress |
| 6 | Launch Prep | Deploy to production | ⏳ Not started |

---

## Things to Never Do

- Never break the no-account Quick Split flow. It is the app's core value proposition.
- Never add a loading screen to the main session page — data should load progressively.
- Never use `console.error` for Supabase errors — always surface via toast.
- Never use centered modals on mobile — use bottom sheets.
- Never hardcode colors — always use CSS custom properties from the design system.
- Never put host-only UI (edit, delete, review button) in the DOM for non-host users — conditionally render it, don't just hide it with CSS.
- Never assume `host.venmo_username` exists — always null-check before building Venmo links.
- Never let the item list be a flat wall of identical boxes — items need visual differentiation (color, claimed state, avatar chips).

---

## Current Known Bugs / Dead Code

- `split_type` field (`"restaurant"` / `"general"`) is stored but has no behavioral difference beyond UI labeling.
- **`normalizeItemWeights` stores `100/n` as claim amounts** but `calculateTotals` in `lib/billMath.ts` treats `amount` as actual dollar values — this mismatch produces wrong totals for any item not priced at exactly $100. Known issue; investigate before any billing accuracy work.

**Cleaned up in prior phases:**
- ~~`lib/calculateSettlement.ts`~~ — deleted
- ~~`app/summary/[id]/page.tsx`~~ — deleted
- ~~`lib/paymentLinks.ts`~~ — deleted (logic inlined into `SessionClient.tsx`)

---

*Last updated: 2026-05-04. Maintained by the Divvy team. Update this file when significant architectural decisions are made.*
