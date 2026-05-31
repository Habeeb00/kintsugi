import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

// ── Force scroll to top before anything else ────────
document.documentElement.scrollTop = 0;
document.body.scrollTop = 0;

// ── Lenis smooth scroll ─────────────────────────────
const lenis = new Lenis({
  duration: 1.6,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  syncTouch: true,
});

// Reset lenis internal position to 0 immediately
lenis.scrollTo(0, { immediate: true });

(function raf(time) { lenis.raf(time); requestAnimationFrame(raf); })();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.lagSmoothing(0);

// ── Frame sequence config ───────────────────────────
// Each segment maps a scroll region → a range of frames.
// `holdAt` lets us pause on a specific frame for an extra N "virtual frames"
// of scroll, which is how we slow the moment of impact, the gold glow, etc.
const SEGMENTS = [
  {
    key:    'fall',
    count:  96,
    holds:  [
      { frame: 0,  hold: 100 },  // long contemplative beat on the suspended bowl
      { frame: 95, hold: 50 },   // hold on the final scattered state
    ],
  },
  {
    key:    'silence',
    count:  192,
    holds:  [
      { frame: 0,   hold: 30 },  // breathe in before motion
      { frame: 191, hold: 80 },  // long stillness at the end
    ],
  },
  {
    key:    'repair',
    count:  241,
    holds:  [
      { frame: 120, hold: 80 },  // dwell on the gold-glow mid-reassembly
      { frame: 240, hold: 100 }, // hold the restored bowl
    ],
  },
];

// Expand holds into a flat frame-index sequence
function expandSequence(seg) {
  const seq = [];
  for (let i = 0; i < seg.count; i++) {
    seq.push(i);
    const h = seg.holds?.find(h => h.frame === i);
    if (h) for (let j = 0; j < h.hold; j++) seq.push(i);
  }
  return seq;
}

SEGMENTS.forEach(s => { s.sequence = expandSequence(s); s.virtualLen = s.sequence.length; });

// ── Image preloader ─────────────────────────────────
const images = {};   // images[segKey] = [HTMLImageElement, ...] indexed by raw frame number
let totalImages = 0;
let loadedImages = 0;

SEGMENTS.forEach(s => { totalImages += s.count; images[s.key] = new Array(s.count); });

const loadingBar  = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');

function pad4(n) { return String(n).padStart(4, '0'); }

function loadImage(segKey, idx) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      images[segKey][idx] = img;
      loadedImages++;
      const pct = loadedImages / totalImages;
      if (loadingBar)  loadingBar.style.transform = `scaleX(${pct})`;
      if (loadingText) loadingText.textContent = `${Math.round(pct * 100)}%`;
      resolve();
    };
    img.onerror = reject;
    img.src = `/frames/${segKey}/${pad4(idx + 1)}.jpg`;
  });
}

async function preloadAll() {
  // Load first frames of each segment first so something appears fast
  await Promise.all(SEGMENTS.map(s => loadImage(s.key, 0)));
  drawFrame(SEGMENTS[0].key, 0);

  // Then load remaining frames, segment by segment
  for (const seg of SEGMENTS) {
    const batch = [];
    for (let i = 1; i < seg.count; i++) batch.push(loadImage(seg.key, i));
    await Promise.all(batch);
  }
}

// ── Canvas renderer ─────────────────────────────────
const canvas = document.getElementById('frame-canvas');
const ctx    = canvas.getContext('2d');

function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width  = '100vw';
  canvas.style.height = '100vh';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeCanvas();
window.addEventListener('resize', () => { sizeCanvas(); render(); });

let current = { seg: 'fall', frame: 0 };

function drawFrame(segKey, frameIdx) {
  const img = images[segKey]?.[frameIdx];
  if (!img) return;

  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const ir = img.naturalWidth / img.naturalHeight;
  const sr = cw / ch;

  // cover-fit (fills viewport, crops sides/top if needed)
  let dw, dh, dx, dy;
  if (sr > ir) {
    dw = cw;
    dh = cw / ir;
    dx = 0;
    dy = (ch - dh) / 2;
  } else {
    dh = ch;
    dw = ch * ir;
    dx = (cw - dw) / 2;
    dy = 0;
  }

  ctx.fillStyle = '#F5F0E8';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);

  current.seg   = segKey;
  current.frame = frameIdx;
}

function render() {
  drawFrame(current.seg, current.frame);
}

// ── Scroll → frame mapping ──────────────────────────
// Each segment is bound to a section in the DOM by data-frames attr.
// As that section scrolls through the viewport, we map progress → frame.
function bindSegmentToTrigger(segKey, triggerSelector) {
  const seg = SEGMENTS.find(s => s.key === segKey);
  if (!seg) return;

  ScrollTrigger.create({
    trigger: triggerSelector,
    start:   'top bottom',
    end:     'bottom top',
    scrub:   0.8,
    onUpdate(self) {
      const idx = Math.min(
        seg.virtualLen - 1,
        Math.floor(self.progress * seg.virtualLen)
      );
      const frame = seg.sequence[idx];
      if (frame !== current.frame || segKey !== current.seg) {
        drawFrame(segKey, frame);
      }
    },
  });
}

// ── Fall: auto-play on first scroll (not scrubbed) ──
let fallPlayed = false;
let fallReady  = false;   // armed inside preloadAll().then(), not on a blind timeout

function playFall() {
  return new Promise(resolve => {
    const total = SEGMENTS.find(s => s.key === 'fall').count;
    let frameIdx = 0;
    let last = 0;

    // Variable speed — slow start, faster as it falls
    function fps(i) {
      if (i < 20) return 10;   // hanging, suspended
      if (i < 60) return 18;   // falling
      return 22;               // impact
    }

    function step(ts) {
      if (ts - last >= 1000 / fps(frameIdx)) {
        last = ts;
        drawFrame('fall', frameIdx);
        frameIdx++;
        if (frameIdx >= total) { resolve(); return; }
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

function onFirstScroll(e) {
  // Only a real downward scroll — ignore upward or non-scroll events
  const down = e.type === 'wheel' ? e.deltaY > 0
             : e.type === 'touchstart';
  if (!down || !fallReady || fallPlayed) return;

  fallPlayed = true;
  window.removeEventListener('wheel',      onFirstScroll);
  window.removeEventListener('touchstart', onFirstScroll);
  e.preventDefault();
  lenis.stop();
  titleCard?.classList.add('is-out');
  cue?.classList.add('hidden');

  playFall().then(() => {
    setTimeout(() => {
      lenis.start();
      const silenceEl = document.querySelector('[data-frames="silence"]');
      if (silenceEl) lenis.scrollTo(silenceEl, { duration: 0.01, force: true });
    }, 500);
  });
}

// ── Wire scroll triggers AFTER first frame loads ────
preloadAll().then(() => {
  // Fall is triggered, not scrubbed — only bind silence + repair
  bindSegmentToTrigger('silence', '[data-frames="silence"]');
  bindSegmentToTrigger('repair',  '[data-frames="repair"]');

  // Dismiss loading, then reveal title card
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.transition = 'opacity 1.4s ease';
    loading.style.opacity = '0';
    setTimeout(() => {
      loading.style.display = 'none';
      showTitleCard();
    }, 1500);
  }

  window.scrollTo(0, 0);
  lenis.scrollTo(0, { immediate: true });
  ScrollTrigger.refresh();

  // Draw suspended bowl AFTER refresh so it overrides any trigger state
  requestAnimationFrame(() => drawFrame('fall', 0));

  // Arm first-scroll 600ms after load — filters out any automated events
  setTimeout(() => {
    fallReady = true;
    window.addEventListener('wheel',      onFirstScroll, { passive: false });
    window.addEventListener('touchstart', onFirstScroll, { passive: false });
  }, 600);
});

// ── Line reveals via IntersectionObserver ───────────
const io = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('is-visible');
  }),
  { threshold: 0.35 }
);
document.querySelectorAll('.line').forEach(l => io.observe(l));

// ── Title card — slides in on enter, out on first scroll ──
const titleCard = document.getElementById('title-card');
const cue = document.querySelector('.scroll-cue');
let scrolled = false;

function showTitleCard() {
  if (!titleCard) return;
  // small delay so it feels like a reveal, not a flash
  setTimeout(() => titleCard.classList.add('is-in'), 120);
}

// title card + cue are dismissed inside onFirstScroll
