/**
 * THE ALLOCATION — Newsletter Script
 * script.js
 *
 * Handles all interactive and animated behaviour:
 *
 *  1. Bar chart animation       — fills bars left-to-right on scroll entry
 *  2. Donut chart animation     — draws SVG ring segments sequentially on scroll entry
 *  3. IntersectionObserver      — triggers animations when charts enter the viewport
 *  4. Scroll-to-top button      — appears after scrolling 400px, smooth-scrolls back up
 *  5. Read-time estimator       — calculates and injects estimated read time on load
 *  6. Timeline entrance         — fades each timeline item in as the user scrolls past it
 *  7. Testimonial card hover    — subtle lift effect managed in JS for older browsers
 */

'use strict';

/* ─────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────── */

/** SVG circumference for donut chart — 2 * π * r where r = 46 */
const DONUT_CIRCUMFERENCE = 289;

/** Donut segment definitions: percentage share and cumulative start offset */
const DONUT_SEGMENTS = [
  { id: 'seg1', pct: 38, startOffset: 0  },
  { id: 'seg2', pct: 24, startOffset: 38 },
  { id: 'seg3', pct: 18, startOffset: 62 },
  { id: 'seg4', pct: 20, startOffset: 80 },
];

/** Average reading speed in words per minute */
const WORDS_PER_MINUTE = 220;


/* ─────────────────────────────────────────────
   1. BAR CHART ANIMATION
   ───────────────────────────────────────────── */

/**
 * animateBars
 * Iterates over every .bar-fill element, reads its [data-width] attribute,
 * and sets the inline width so the CSS transition fires.
 * The CSS transition on .bar-fill handles the eased animation itself.
 */
function animateBars() {
  const bars = document.querySelectorAll('.bar-fill');

  bars.forEach((bar, index) => {
    const targetWidth = bar.getAttribute('data-width');
    if (!targetWidth) return;

    // Stagger each bar slightly so they fill one after another
    const delay = index * 80; // ms

    setTimeout(() => {
      bar.style.width = targetWidth + '%';
    }, delay);
  });
}


/* ─────────────────────────────────────────────
   2. DONUT CHART ANIMATION
   ───────────────────────────────────────────── */

/**
 * animateDonut
 * For each segment in DONUT_SEGMENTS, computes the SVG stroke-dasharray
 * and stroke-dashoffset values needed to draw a partial arc, then applies
 * them with a sequential delay so segments appear one by one.
 *
 * SVG technique:
 *   stroke-dasharray  = "filledLength gapLength"
 *   stroke-dashoffset = negative cumulative length of preceding segments
 *   (circle is rotated -90deg in CSS so 12 o'clock = start)
 */
function animateDonut() {
  DONUT_SEGMENTS.forEach((seg, index) => {
    const el = document.getElementById(seg.id);
    if (!el) return;

    const filledLength = Math.round((seg.pct / 100) * DONUT_CIRCUMFERENCE);
    const gapLength    = DONUT_CIRCUMFERENCE - filledLength;
    const dashOffset   = -Math.round((seg.startOffset / 100) * DONUT_CIRCUMFERENCE);

    const delay = 200 + index * 120; // stagger each segment by 120ms

    setTimeout(() => {
      el.style.transition = 'stroke-dasharray 1.2s cubic-bezier(0.25, 0.8, 0.25, 1)';
      el.setAttribute('stroke-dasharray', `${filledLength} ${gapLength}`);
      el.setAttribute('stroke-dashoffset', dashOffset);
    }, delay);
  });
}


/* ─────────────────────────────────────────────
   3. INTERSECTION OBSERVER — CHART TRIGGER
   ───────────────────────────────────────────── */

/**
 * initChartObserver
 * Watches the first .chart-wrap element. When it enters the viewport,
 * fires animateBars() and animateDonut() once, then disconnects.
 * Falls back to immediate animation if IntersectionObserver is unavailable
 * or no trigger element is found.
 */
function initChartObserver() {
  const trigger = document.querySelector('.chart-wrap');

  if (!trigger || typeof IntersectionObserver === 'undefined') {
    // Fallback: animate immediately
    animateBars();
    animateDonut();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateBars();
          animateDonut();
          observer.disconnect(); // Only trigger once
        }
      });
    },
    { threshold: 0.1 }
  );

  observer.observe(trigger);
}


/* ─────────────────────────────────────────────
   4. SCROLL-TO-TOP BUTTON
   ───────────────────────────────────────────── */

/**
 * initScrollToTop
 * Creates a small floating button that appears after the user scrolls
 * 400px down the page. Clicking it smooth-scrolls back to the top.
 * The button is injected dynamically so the HTML stays clean.
 */
function initScrollToTop() {
  // Create the button element
  const btn = document.createElement('button');
  btn.id = 'scroll-top-btn';
  btn.setAttribute('aria-label', 'Scroll to top');
  btn.innerHTML = '&#8593;'; // Up arrow
  btn.style.cssText = `
    position: fixed;
    bottom: 32px;
    right: 32px;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #1a2f4a;
    color: white;
    border: none;
    font-size: 18px;
    cursor: pointer;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 12px rgba(0,0,0,0.2);
  `;

  document.body.appendChild(btn);

  // Show / hide on scroll
  window.addEventListener('scroll', () => {
    const shouldShow = window.scrollY > 400;
    btn.style.opacity = shouldShow ? '1' : '0';
    btn.style.transform = shouldShow ? 'translateY(0)' : 'translateY(10px)';
    btn.style.pointerEvents = shouldShow ? 'auto' : 'none';
  }, { passive: true });

  // Smooth scroll on click
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}


/* ─────────────────────────────────────────────
   5. READ-TIME ESTIMATOR
   ───────────────────────────────────────────── */

/**
 * updateReadTime
 * Counts the words in .page-wrapper, calculates estimated minutes,
 * and updates any element with [data-readtime] to reflect the real count.
 * The byline uses a static string but this keeps it accurate after edits.
 */
function updateReadTime() {
  const wrapper = document.querySelector('.page-wrapper');
  if (!wrapper) return;

  const text      = wrapper.innerText || wrapper.textContent || '';
  const wordCount = text.trim().split(/\s+/).length;
  const minutes   = Math.ceil(wordCount / WORDS_PER_MINUTE);

  // Update any element that carries a data-readtime attribute
  document.querySelectorAll('[data-readtime]').forEach((el) => {
    el.textContent = `Est. read time: ${minutes} min`;
  });
}


/* ─────────────────────────────────────────────
   6. TIMELINE ENTRANCE ANIMATION
   ───────────────────────────────────────────── */

/**
 * initTimelineAnimation
 * Observes each .tl-item and fades + slides it in when it enters
 * the viewport. Uses a separate observer from the chart trigger.
 */
function initTimelineAnimation() {
  const items = document.querySelectorAll('.tl-item');
  if (!items.length || typeof IntersectionObserver === 'undefined') return;

  // Set initial hidden state via inline style
  items.forEach((item) => {
    item.style.opacity = '0';
    item.style.transform = 'translateX(-12px)';
    item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateX(0)';
          observer.unobserve(entry.target); // Animate each item only once
        }
      });
    },
    { threshold: 0.15 }
  );

  items.forEach((item) => observer.observe(item));
}


/* ─────────────────────────────────────────────
   7. TESTIMONIAL CARD HOVER (JS FALLBACK)
   ───────────────────────────────────────────── */

/**
 * initTestimonialHover
 * Adds a subtle translateY lift on hover to each testimonial card.
 * CSS :hover handles this in modern browsers; this is a JS fallback
 * for environments that strip :hover styles (some email clients / webviews).
 */
function initTestimonialHover() {
  const cards = document.querySelectorAll('.t-card');

  cards.forEach((card) => {
    card.style.transition = 'transform 0.22s ease, box-shadow 0.22s ease';

    card.addEventListener('mouseenter', () => {
      card.style.transform  = 'translateY(-3px)';
      card.style.boxShadow  = '0 6px 20px rgba(0, 0, 0, 0.08)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform  = 'translateY(0)';
      card.style.boxShadow  = 'none';
    });
  });
}


/* ─────────────────────────────────────────────
   INIT — Run everything on DOMContentLoaded
   ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initChartObserver();       // 1 + 2 + 3 — charts animate on scroll
  initScrollToTop();         // 4 — floating back-to-top button
  updateReadTime();          // 5 — accurate word-count read time
  initTimelineAnimation();   // 6 — timeline items slide in on scroll
  initTestimonialHover();    // 7 — card hover lift effect
});