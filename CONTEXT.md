# Kintsugi — Project Context

## Concept
A scroll-driven cinematic web experience narrating the philosophy of kintsugi (金継ぎ) — the Japanese art of repairing broken pottery with gold — as a metaphor for resilience and Wabi-Sabi.

**Origin:** Born from a real conversation about engineering students and mental health. The bowl is the metaphor. The break is real. The gold is the choice to stay.

**Dual purpose:** Personal storytelling showcase + companion to a resilience-themed initiative.

---

## The Story Arc

| Act | Visual | Text |
|-----|--------|------|
| I | Whole bowl, suspended. Just presence. | *(silence)* |
| Fall | First scroll triggers the fall — auto-plays, not scrubbed | *(silence)* |
| White | Screen fades to white after shatter | "Something broke." |
| III | Silence/transition — pieces scattered | "Not loudly. The way things break sometimes — without anyone noticing, not even you." |
| IV | Repair — pieces reassemble, gold glows | "In Japan, when a bowl breaks, they do not throw it away. They mend the cracks with gold. 金継ぎ — kintsugi." |
| V | Return | "The bowl is not pretending to be unbroken. It is showing you exactly where it broke, and exactly how it chose to stay." |
| VI | Wabi-sabi closing | 侘び寂び — full philosophy text, 金継ぎ closing |

---

## Tech Stack

```
Vite (build tool)
├── GSAP + ScrollTrigger   scroll-driven animations
├── Lenis                  smooth scroll
└── Vanilla JS/CSS         no framework overhead
```

**No Three.js** — replaced with frame-by-frame video scrubbing on a 2D canvas (Apple-style scroll-driven video).

---

## Frame Playback System

- Videos extracted to JPEG frames via ffmpeg
- 529 frames total across 3 segments
- Canvas draws frames based on scroll position
- Hold markers duplicate frames to create slow-motion / pause effects
- First video (fall) plays as a **triggered animation** on first scroll (not scrubbed)
- Silence + repair scrub with scroll position

### Segments

| Key | Source | Frames | Role |
|-----|--------|--------|------|
| `fall` | `01-fall.mp4` (4s, 24fps) | 96 | Bowl falls and shatters — triggered on first scroll |
| `silence` | `02-silence.mp4` (8s, 24fps) | 192 | Scattered pieces — **removed, replaced by extended fall frames** |
| `repair` | `03-repair.mp4` (10s, 24fps) | 241 | Pieces reassemble with gold glow |

### Hold markers (frame duplication for slow-motion)
- Fall: frame 0 held 100 extra frames (suspended bowl), frame 95 held 50 frames (shattered state)
- Repair: frame 120 held 80 frames (gold glow moment), frame 240 held 100 frames (final restored bowl)

---

## File Structure

```
kintsugi/
├── index.html              Main HTML — all 6 acts
├── src/
│   ├── main.js             Frame loader, scroll triggers, fall animation
│   └── style.css           Design tokens, layout, animations
├── public/
│   └── frames/
│       ├── fall/           0001–0096.jpg
│       ├── silence/        0001–0192.jpg (may be removed)
│       └── repair/         0001–0241.jpg
├── videos/                 Source MP4s (gitignored)
├── .claude/                Claude Code config (gitignored)
├── package.json            Vite + GSAP + Lenis + Three.js (Three.js unused now)
└── CONTEXT.md              This file
```

---

## Design System

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#F5F0E8` | Washi paper background |
| `--gold` | `#C9A44A` | Kintsugi gold, buttons, accents |
| `--text` | `#2A2218` | Primary text |
| `--text-soft` | `#5A5048` | Body copy |
| `--text-mute` | `#8C7C6E` | Quiet/whisper lines |
| `--accent` | `#8C7355` | Earth tone |
| `font-body` | Cormorant Garamond 300/400 | Literary serif |
| `font-japanese` | Shippori Mincho 400/500 | Japanese characters |

---

## Key Interactions

### Loading
- Progress bar fills as 529 frames load
- 金継ぎ kanji shown centered during load
- After load: title card slides down from top

### Title Card
- Slides down after loading completes
- Shows: 金継ぎ (large, Shippori Mincho)
- Dismissed on first downward scroll

### First Scroll → Fall
- Wheel/touchstart intercepted
- Fall plays at variable FPS: 10fps (hanging) → 18fps (falling) → 22fps (impact)
- Lenis locked during animation, re-armed 600ms after load
- After fall: white overlay fades in, "Something broke." appears
- Scroll re-enabled, user continues naturally

### Scene Break
- Fixed white overlay (`#scene-break`, z-index 4)
- "Something broke." text centered, fades in after white fills screen
- As user scrolls into silence section: text fades first, then overlay, revealing video scrub

### Scroll-driven Scrub
- `bindSegmentToTrigger(segKey, selector)` maps scroll progress → frame index
- Uses virtual sequence (with holds) for slow-motion effects
- `scrub: 0.8` for smoothness

---

## Known Issues / To-Do

- [ ] Silence video being removed — fall end + repair start extended with duplicate frames instead
- [ ] Video transitions between segments feel abrupt — need frame-level blending or crossfade
- [ ] Mobile: scroll trigger behavior on iOS needs testing
- [ ] Vercel deployment: connect repo via dashboard (Vite auto-detected)
- [ ] Watermarks: blur applied during frame extraction. Check KingAI logo on repair frames.

---

## Deployment

- **Repo:** github.com/Habeeb00/kintsugi
- **Platform:** Vercel
- **Build:** `npm run build` → `dist/`
- **Framework preset:** Vite (auto-detected)

---

## Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| Day 1 | Vanilla JS over React | Storytelling page, no state complexity, better perf |
| Day 1 | Three.js LatheGeometry pot | Placeholder before real footage |
| Day 2 | Replaced Three.js with frame scrubbing | Real ceramic footage is more powerful than 3D |
| Day 2 | Fall as triggered animation, not scrubbed | "One scroll = the fall" is more cinematic |
| Day 2 | White scene break between fall and silence | "Something broke." needs space — not text over video |
| Day 2 | Removing silence video | Too many videos, flow felt broken — extend fall/repair instead |
