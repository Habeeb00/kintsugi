import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

// ── Lenis smooth scroll ─────────────────────────────
const lenis = new Lenis({
  duration: 1.6,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
});

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

// ── Wire scroll triggers AFTER first frame loads ────
preloadAll().then(() => {
  // Bind each frame-segment to its scroll region
  bindSegmentToTrigger('fall',    '[data-frames="fall"]');
  bindSegmentToTrigger('silence', '[data-frames="silence"]');
  bindSegmentToTrigger('repair',  '[data-frames="repair"]');

  // Dismiss the loading screen
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.transition = 'opacity 1.4s ease';
    loading.style.opacity = '0';
    setTimeout(() => { loading.style.display = 'none'; }, 1500);
  }

  // First frame
  drawFrame('fall', 0);

  // Force scroll to top
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  ScrollTrigger.refresh();
});

// ── Line reveals via IntersectionObserver ───────────
const io = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('is-visible');
  }),
  { threshold: 0.35 }
);
document.querySelectorAll('.line').forEach(l => io.observe(l));

// ── Subtle scroll cue fades on first scroll ─────────
const cue = document.querySelector('.scroll-cue');
let scrolled = false;
lenis.on('scroll', ({ scroll }) => {
  if (!scrolled && scroll > 40) {
    scrolled = true;
    cue?.classList.add('hidden');
  }
});
