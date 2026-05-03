# Demo polish (v2): Aesthetics + mobile-first + usefulness + co-founder role

## Core principles

**1. Aesthetics are non-negotiable.**  
A great idea that doesn't look good won't feel easy to use or share. Every screen should feel intentional: clear hierarchy, consistent spacing, a cohesive visual language. The goal is "this looks like a real product" and "I'd show this to someone" — not "functional prototype."

**2. Design for the real user: phone at the restaurant.**  
Primary scenario: someone at a table pulls out their phone to start or join a split. So:

- **Mobile-first:** Layout, typography, and touch targets are tuned for phone viewports (e.g. 375px–430px width). Desktop/laptop can still work but is secondary.
- **Thumb-friendly:** Primary actions (Add item, Join, Settle, Finish) live where thumbs reach — e.g. bottom sticky bar, large tap targets (min ~44px), no critical actions hidden at top corners.
- **One-handed use:** Core flow (add item, claim, pay) should be doable with one hand; avoid tiny links or multi-step flows that require precision.
- **Touch, not hover:** No hover-only affordances; feedback is tap/click. Buttons and cards should have clear pressed/active states.
- **Fast and legible:** Readable font sizes, enough contrast, minimal scrolling to do the next thing. Join code and key totals should be visible without hunting.
- **Safe areas:** Respect notch/home indicator and avoid placing primary CTAs in the very bottom 20–30px on notched devices.

So when making UI decisions, the default question is: *"Does this work when I'm holding my phone at a restaurant?"*

**3. Useful and worth coming back to.**  
UI/UX polish serves a higher bar: **Is this faster than splitting manually? Is it worth opening the webapp?** If the answer isn't yes, people won't adopt it or return. So:

- **Faster than manual:** The full loop (create → join → add items → claim → see totals → settle) should feel quicker than passing a phone around or doing math in Notes. That means: minimal steps, one-tap actions where possible (e.g. claim remaining), instant feedback, and no dead ends. We constantly ask: "What can we remove or shorten?"
- **Worth going online:** The value should be obvious: one code to join, real-time totals, clear "you owe X / they owe you Y," and a satisfying finish. No "I could have done this in 30 seconds with Venmo and a calculator." We optimize for clarity (who owes what, what's left to claim) and for the moment people think "that was easier."
- **Reasons to return:** Even before accounts/history, the experience should make people want to use Divvy again next time (same group, next dinner). That comes from speed, clarity, and a finish that feels like a win — not friction or confusion.

**4. Co-founder mindset (how we work together).**  
You have final say; I have a real stake in the product. So:

- **I propose and implement** what I believe is best for Divvy — layout, copy, flow, and technical choices. I don't wait for permission on every detail when the direction is clear.
- **I flag tradeoffs and disagree** when I think something hurts usability, speed, or long-term clarity. I'll say "I'd do X instead because…" and offer alternatives.
- **You steer with feedback:** "I don't like this," "more like that," "we should prioritize Y." I treat that as the primary input to adjust course.
- **North star:** What's best for Divvy as a product people actually use and come back to. Aesthetics, mobile-first, and usefulness all serve that.

---

## Design system (mobile-aesthetic focus)

- Add **shadcn/ui** and **framer-motion** selectively for high-impact surfaces (landing, create, join, session header, modals).
- Apply the handoff's rules with a **mobile lens**: max-width 480px (or full-bleed with padded content), generous padding (e.g. px-4–5), card style (rounded-2xl, shadow-sm, border), typography that's readable on small screens (titles text-2xl–3xl, body not too small).
- Ensure every added or updated component looks **finished**: consistent radii, spacing, and one clear primary action per block.

---

## Priority order (same list, mobile + aesthetic emphasis)

| Priority | Improvement | Aesthetic / mobile note |
|----------|-------------|-------------------------|
| **1** | **Visual polish pass** | One cohesive look: cards, spacing, typography. **Mobile:** Centered content, touch-friendly inputs and buttons, no cramped text. Feels like a shipped app, not a prototype. |
| **2** | **Join code banner** | **Mobile:** Big, scannable code at top (or sticky pill). Copy button large and thumb-friendly. This is the "share with the table" moment. |
| **3** | **Stage header** | Clear steps (Add items → Claim → Settle → Complete). **Mobile:** Compact strip or pills; readable at a glance without zooming. |
| **4** | **Faster claiming** | One-tap "claim remaining." **Mobile:** Large tap target on each item/row; immediate feedback (e.g. brief animation or state change). |
| **5** | **Sticky action bar** | Single bottom bar: Add item, Invite, primary action. **Mobile:** Thumb zone; safe-area padding; tall enough tap targets (~48px); no overlap with system gesture areas. |
| **6** | **Completion moment** | Confetti + summary + "Start new split." **Mobile:** Modal fits small viewport; CTA is one clear button; feels like a win. |

---

## Implementation lens

- **Every new or changed UI:** Would this look good in a screenshot? Would it work with a thumb on a 6" screen?
- **Testing:** Check key flows in a narrow viewport (Chrome DevTools device mode or real device); confirm join code, add item, and settle are easy without pinching or hunting.
- **Copy and hierarchy:** Short labels; one main action per section so the "next step" is obvious even when someone is distracted at a table.
- **Usefulness check:** Does this step make the flow faster or clearer? If not, simplify or remove.
