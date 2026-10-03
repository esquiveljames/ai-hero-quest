# ⚔️ The AI Hero's Quest

**An AI-powered exhibit for the AUF College of Computer Studies Honor Society.**
Visitors make five one-tap choices; an AI Oracle reads the pattern and reveals their Hero, Honor Society virtue, prophecy, and personal quest.

Walk up → Tap → Choose → Watch the Oracle → Receive your Hero → *"WOW!"*

---

## 1. What's in the box

```
ai-hero-quest/
├── index.html            All six screens and pop-up windows
├── css/style.css         All visual design (colors at the top)
├── config/               ← EDIT THESE, not the code
│   ├── settings.js       AI endpoint, timeouts, audio, idle timers
│   ├── society.js        Honor Society facts (from the Constitution)
│   ├── archetypes.js     The six Heroes and their offline texts
│   └── questions.js      The five quest scenes
├── js/
│   ├── app.js            Screen flow, reveal choreography, idle reset
│   ├── ai.js             Calls the Worker; falls back automatically
│   ├── fallback.js       Offline Oracle (no internet needed)
│   ├── audio.js          Procedural music, sound effects, Oracle voice
│   ├── visuals.js        Particles, Honor Sigil, Oracle artwork
│   ├── camera.js         Hero selfie frame (nothing saved)
│   ├── print.js          Print / Save as PDF "Hero Charter" (A4)
│   ├── wall.js           "Heroes discovered today" counter
│   └── demo.js           Hidden staff Demo Mode
└── server/
    ├── worker.js         Cloudflare Worker: holds the API key, calls Claude
    └── wrangler.toml     Worker config (optional CLI method)
```

There is no build step and no framework. Every file is plain HTML, CSS, or JavaScript with beginner-friendly comments.

---

## 2. Try it right now (offline mode)

1. Double-click `index.html` to open it in Chrome or Edge.
2. Tap **Begin your quest**.

With no AI endpoint configured, the app uses the offline Oracle, so the full experience works immediately. The camera needs HTTPS or localhost, so for camera testing run a local server instead:

```bash
cd ai-hero-quest
python -m http.server 8000
# then open http://localhost:8000
```

---

## 3. Go live with real AI (about 20 minutes)

### Step 1: Get an Anthropic API key
1. Create an account at **console.anthropic.com** and add a small credit balance.
2. In the Console's limits or billing settings, set a **monthly spend limit** (₱500 is far more than an exhibit needs).
3. Create an API key. **Never put this key in any website file.**

### Step 2: Publish the website on GitHub Pages
1. Create a GitHub repository (e.g. `ai-hero-quest`) and upload everything **except** the `server/` folder.
2. In the repository, open **Settings → Pages**, choose **Deploy from a branch → main → / (root)**, and save.
3. Your site will be at `https://YOUR-USERNAME.github.io/ai-hero-quest/`.

### Step 3: Create the Cloudflare Worker (the secure middleman)
1. Sign up free at **dash.cloudflare.com** → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it `ai-hero-quest-oracle`, click **Deploy**, then **Edit code**.
3. Delete the sample code, paste in the whole of `server/worker.js`, and click **Deploy**.
4. Go to the Worker's **Settings → Variables and Secrets** and add:

| Type | Name | Value |
|---|---|---|
| Secret | `ANTHROPIC_API_KEY` | your key from Step 1 |
| Text | `ALLOWED_ORIGINS` | `https://YOUR-USERNAME.github.io` |
| Text | `RATE_PER_MINUTE` | `20` |

`ALLOWED_ORIGINS` is the domain only, with no `/ai-hero-quest` path and no trailing slash. Add `,http://localhost:8000` if you also test locally.

5. Copy the Worker's address (e.g. `https://ai-hero-quest-oracle.yourname.workers.dev`).

### Step 4: Connect the two
In `config/settings.js`, set:

```js
endpoint: "https://ai-hero-quest-oracle.yourname.workers.dev",
```

Commit the change. Open the site, press **Ctrl + Shift + D**, and click **Ping worker**, then **Test AI hero**. You should see `AI` (not `FALLBACK`) and a latency in milliseconds.

---

## 4. How the AI works

**One call per visitor.** When the fifth choice is tapped, the browser sends only the five choice codes:

```json
{ "choices": ["q1_teach", "q2_ask", "q3_study", "q4_serve", "q5_tome"] }
```

The Worker translates the codes into scenario text, adds the system prompt, and calls **Claude Haiku 4.5** with a *forced tool* (`reveal_hero`) whose JSON schema restricts the hero to the six archetypes and the virtues to the approved list. That guarantees valid structured JSON:

```json
{
  "hero": "The Sage",
  "primaryVirtue": "Scholarship",
  "secondaryVirtue": "Service",
  "traits": ["Curiosity", "Generosity", "Patience"],
  "description": "You turned a teammate's struggle into a lesson, and gave your free day to others...",
  "prophecy": "A lantern lit by your learning will guide a traveler you have not yet met.",
  "quest": "This week, explain one hard concept to a classmate who is stuck on it."
}
```

The AI interprets the **combination** of choices, including tensions between them. The point weights in `questions.js` are used **only** by the offline fallback.

**Ask the Oracle** is optional and only runs when a visitor taps a question (maximum 3 per visitor). The Worker grounds organization answers in `SOCIETY_FACTS`, taken from the Constitution. If a fact isn't there, the Oracle sends the visitor to the booth officers instead of inventing anything.

**Security.** The API key exists only as a Cloudflare secret. The Worker accepts requests only from your site, only known choice codes, and only small bodies, so it cannot be used as a free chatbot.

---

## 5. When things go wrong (and they will, at a booth)

The AI is the enhancement, not the single point of failure.

| Problem | What the visitor sees |
|---|---|
| No internet, Worker down, AI error, quota reached | Offline Oracle result, same visuals and voice, with the line *"The Oracle is resting, but the ancient realm still remembers your path."* |
| AI slower than 8 seconds | Same as above (`timeoutMs` in settings) |
| Audio blocked or muted | Everything works silently |
| Voice not available | Text still appears; voice is skipped |
| Camera missing or denied | The frame shows without a photo; the app continues |
| Google Fonts or QR library offline | Georgia font is used; QR code is skipped |

The offline Oracle personalizes its reading using two of the visitor's actual choices ("You left the forbidden scroll unopened, and you...").

---

## 6. Cost and monitoring

Each completed quest uses roughly 1,200 input tokens and 250 output tokens. At Claude Haiku 4.5 rates, that is about **₱0.15 per visitor** (verify current pricing on anthropic.com). Five hundred visitors cost well under ₱100.

Guardrails:
- One main call per visitor; output capped at 500 tokens (Oracle answers at 220).
- Ask the Oracle limited to 3 questions per visitor.
- Worker rate limit (20 requests per minute per device) and origin lock.
- **The monthly spend limit in the Anthropic Console is your hard ceiling.** Check **Usage** after the first hour of day one.

---

## 7. Privacy (what to tell visitors and the Dean)

- No names, emails, accounts, or sign-ups.
- The only data sent to the AI is the five choice codes (and an Ask the Oracle question, if the visitor asks one). Nothing identifies the visitor.
- Photos are **never** uploaded or saved. The framed image is shown for 20 seconds so the visitor can photograph the screen with their own phone, then the canvas is wiped and the camera is switched off.
- The hero counter stores only counts per hero type, in the booth computer's browser.

---

## 8. Audio (all original, no licensing needed)

All music and sound effects are generated live by `js/audio.js` using the Web Audio API. No audio files are used, so there are no copyright or licensing issues and nothing can fail to load.

- **Music:** an original theme in D Dorian (pad, harp arpeggio, heartbeat drum) that changes mood per screen. It is calm on the portal, flowing during the quest, urgent during analysis, triumphant (resolving to D major) at the reveal, then calm again.
- **Effects:** portal activation, UI click, choice select, scene whoosh, Oracle hum, reveal boom and bell fanfare, virtue chime, trait chimes, scroll unroll, secret motif, camera shutter.
- **Voice:** the browser's Text-to-Speech, slowed and slightly lowered. **Microsoft Edge on Windows** has the most natural voices. If the voice sounds robotic on your booth laptop, switch it off with 🎙️.
- The music automatically dips while the Oracle speaks.

---

## 9. Exhibit Mode

| Behavior | Default |
|---|---|
| Idle during the quest | Reset after 30 s |
| Idle on the hero result | Reset after 60 s |
| Idle on the opening screen | Shows the Honor Society screen for 20 s (attract loop), then returns |
| Restart button | Always visible, top-right |
| Keyboard | **Enter** = begin, **1–6** = choose, **Esc** = close windows |
| Protections | No right-click menu, Back button trapped, confirm before closing the tab |

Each visitor gets a new session id, so a late AI reply from a previous visitor can never appear for the next one.

**Run full-screen as a kiosk (Windows):**

```
msedge --kiosk https://YOUR-USERNAME.github.io/ai-hero-quest/ --edge-kiosk-type=fullscreen
```

Press **Alt + F4** to exit kiosk mode.

---

## 10. Staff Demo Mode

Open with **Ctrl + Shift + D**, or tap the crest (top-left) **5 times quickly** on a touchscreen.

- Show any of the six heroes instantly
- Ping the Worker / test a live AI hero (shows AI vs. FALLBACK and latency)
- Force fallback mode on/off
- Test sounds, music, and voice
- Test the camera
- Show the Honor Society screen
- Reset today's hero count
- Return to Exhibit Mode

---

## 11. Secret quest (Easter egg)

On the opening screen, tap the Honor Sigil's three lights in order: **📖 book → 🔥 flame → ⭐ star** (wisdom, then service, then excellence). Visitors who find it are told to say *"the three lights"* to an officer. Prepare a small reward (a sticker or a printed Hero card), or edit the hint in `config/society.js`.

---

## 12. Customizing

| To change… | Edit |
|---|---|
| Society name, purpose, membership, activities, contact link (QR code) | `config/society.js` **and** `SOCIETY_FACTS` in `server/worker.js` |
| Quest scenes and choices | `config/questions.js` **and** `CHOICES` in `server/worker.js` |
| Hero names | `config/archetypes.js` **and** `HEROES` in `server/worker.js` |
| AI model, token limits | top of `server/worker.js` |
| Timers, volumes, voice | `config/settings.js` |
| Colors and fonts | top of `css/style.css` |

The duplicated lists are intentional: the server must not trust the browser for facts or choices.

**Before the event, confirm with the officers:**
1. The six booth values in `society.js` were derived from Article II (the Constitution names no formal values list).
2. Whether academic support sessions are open to non-scholar students (this shapes the "Not a scholar yet?" call-to-action).
3. A Facebook page or form link for `contact.url`, which turns on the QR code.

---

## 13. Pre-event test checklist

- [ ] Normal flow: Begin → Oracle → 5 scenes → analysis → reveal → New quest
- [ ] Demo Mode → Force fallback ON → full run shows the offline note
- [ ] Unplug Wi-Fi → full run still works
- [ ] Mute all three toggles → full run still works
- [ ] Camera: allow → photo frame; deny → app continues
- [ ] Walk away mid-quest → resets after 30 s
- [ ] Two visitors in a row → second sees no trace of the first
- [ ] Touchscreen taps, mouse clicks, and keyboard 1–6 all work
- [ ] Phone browser: layout scrolls and buttons are tappable
- [ ] Print / Save PDF → Print to printer → preview shows one A4 page with the hero image
- [ ] Print / Save PDF → Save as PDF → a .pdf downloads and opens as one A4 page
- [ ] Demo Mode → "Test print / PDF" works

---

## 14. Print / Save as PDF (the Hero Charter)

After the reveal, tap **🖨️ Print / Save PDF**. A window shows a preview of the visitor's one-page A4 **Hero Charter** with two choices:

- **🖨️ Print to printer** opens the browser's print dialog. The page is set to A4 portrait with no margins, and only the charter prints.
- **📄 Save as PDF** downloads `hero-charter-the-guardian.pdf` (named after the hero), made inside the browser with jsPDF. Nothing is uploaded. If jsPDF can't load (offline), the print dialog opens instead; choose **Save as PDF** as the printer.

The charter includes an original illustration of the hero as an armored warrior in their own colors, with a signature item (Guardian: shield, Vanguard: banner, Sage: crystal staff and tome, Paragon: glowing blade, Oathkeeper: great key, Hearthbuilder: lantern). It also includes the hero name, virtues, the Oracle's reading, prophecy, traits, quest, the Honor Society's closing message, and the date.

The art is drawn as vector shapes, not a background image, so it prints even when **Background graphics** is switched off in the print dialog. The visitor's selfie is never included, keeping the "no photos saved" promise.

**Booth tips:**
- To print instantly without the dialog, start Chrome with `--kiosk --kiosk-printing` (prints to the default printer).
- A PDF saved at the booth lands in the booth laptop's Downloads folder. It's most useful when visitors open the site on their own phones; consider putting the site URL's QR code on your signage.

## 15. About VR

VR is intentionally not included. A ₱200–₱500 phone headset offers inconsistent browser support, gaze-only input, discomfort and hygiene problems, and slow visitor turnover, and it would pull attention from the AI reveal. Spend that budget on a Bluetooth speaker, warm lighting, or printed Hero cards with your QR code.

---

*All artwork, symbols (the Honor Sigil), music, and sound are original and generated in code. This project is fantasy-adventure inspired and uses no Nintendo characters, logos, artwork, music, or sound effects.*
