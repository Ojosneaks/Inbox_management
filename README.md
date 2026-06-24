# Inbox Focus — Chrome Extension

> Budget your attention. See what matters the moment you open Gmail.

A Chrome extension that organizes and prioritizes Gmail so you see what actually
matters first — instead of losing your focus to low-priority noise every morning.

The guiding idea: **like YNAB, but for your attention instead of your money.**
You decide what deserves your focus before the inbox spends it for you.

---

## The problem it solves

You wake up, open Gmail, and immediately get caught on low-priority emails before
reaching the one thing that actually mattered. Attention decay. This extension
surfaces signal first and pushes noise down.

Target users: entrepreneurs/CEOs drowning in noise, college students tracking
hundreds of job applications, and anyone buried under newsletters and signups.

---

## How it works (architecture)

| File | Role |
|------|------|
| `manifest.json` | The extension's ID card. Tells Chrome the name, permissions, and which files to load. |
| `background.js` | Service worker. Handles Google login (OAuth) and all Gmail API calls. Runs behind the scenes. |
| `content.js` | Runs *inside* Gmail. Injects the priority tab bar and renders the email list. This is what the user sees. |
| `styles.css` | All the styling for the injected UI. |
| `popup.html` / `popup.js` | The small settings panel that opens from the toolbar icon. Manage tagged senders. |
| `icons/` | Toolbar + store icons (add icon16.png, icon48.png, icon128.png). |

**Flow:** content.js asks background.js for emails → background.js logs in and
calls the Gmail API in two steps (list of IDs, then details for each) → emails
come back → content.js sorts them into categories and renders them in Gmail.

---

## Setup steps

1. Create a project at https://console.cloud.google.com
2. Enable the **Gmail API**.
3. Configure the **OAuth consent screen** (External).
4. Load the extension once at `chrome://extensions` (Developer Mode → Load Unpacked)
   to get your **Extension ID**.
5. Create an **OAuth Client ID** of type *Chrome Extension*, paste in the Extension ID.
6. Paste your Client ID into `manifest.json` (replace `YOUR_CLIENT_ID_HERE`).
7. Reload the extension and open Gmail.

> Note: the public key / permanent ID only matters when publishing to the Web Store.
> While building locally, just update the ID in Google Cloud Console if it changes.

---

## Build order (checklist)

### Phase 1 — Foundation
- [x] Folder structure + manifest.json
- [x] Gmail API credentials (OAuth)
- [x] Login flow (`authenticate`)
- [x] Fetch emails (IDs → details)

### Phase 2 — Core logic
- [x] Categorize emails into buckets (Priority / Work / Financial / Local / Low)
- [ ] Time filtering (last visit, 24h, week, month)
- [ ] High-priority sender tagging (basic version wired; refine UX)

### Phase 3 — UI
- [x] Inject custom tab bar
- [x] Render emails per category
- [ ] Reposition tabs to sit exactly where Gmail's default tabs were

### Phase 4 — AI
- [ ] Natural-language onboarding ("tell me what matters" → auto categories)
- [ ] AI chat panel (find / group emails by topic)
- [ ] AI-powered search results grouped by topic

### Phase 5 — Polish
- [ ] Settings panel (popup) refinements
- [ ] Dark-mode / theme toggle inside the extension
- [ ] Package for Chrome Web Store

---

## Feature ideas parked for later

**Follow-up reminders ("Waiting on")**
Watch chains you started. If no reply in N hours, or a deadline is detected in
the thread, surface it before it's too late. Turns your sent folder into an
active watchlist.

**Boss battle mode**
A 3rd priority weight above "high." One critical email takes over the screen:
inbox dims, a bold banner drops in with a running timer, and two actions —
"Address it now" / "Snooze 30 min." Removes the choice that fractures focus.
Triggered manually, by urgent language, or by an overdue follow-up.

**Email weight + scoring graph**
Score every email (sender tag, urgent keywords, recency, chain, reply-to-you,
unread) into a number. Show a colored score badge per email, and later a heat-map
graph of the whole inbox's weight distribution. Score thresholds map to weights:
>=80 boss battle, >=50 high, >=25 normal.

Example data shape to aim for:
```js
{
  id: "…",
  from: "CoStar Recruiting",
  subject: "Interview confirmation needed",
  weight: 3,            // 1 normal, 2 high, 3 boss battle
  score: 92,
  bossBattleActivated: true,
  bossBattleStartTime: 0,
  snoozedUntil: null
}
```

---

## Launch plan
Build core → use it yourself for a few days → record a short demo →
post on LinkedIn ("what I built with Claude") → submit to Chrome Web Store →
get the campus using it.
