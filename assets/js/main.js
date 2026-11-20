/* =========================================================
   Ajay Sri Ramm — interaction & motion layer
   GSAP + ScrollTrigger + SplitText + Lenis, WebGL stage lazy-loaded.
   ========================================================= */

const root = document.documentElement;
window.__booted = true;
clearTimeout(window.__bootTimer);

const { gsap, ScrollTrigger, SplitText, ScrambleTextPlugin, Lenis } = window;

if (!gsap || !ScrollTrigger) {
  // Vendor scripts failed: show the static page rather than a stuck loader.
  root.classList.remove('js');
  root.classList.add('no-boot');
  throw new Error('GSAP unavailable');
}
gsap.registerPlugin(ScrollTrigger, ...(SplitText ? [SplitText] : []), ...(ScrambleTextPlugin ? [ScrambleTextPlugin] : []));

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let lenis = null;
let scene = null;

/* ---------------------------------------------------------
   Capability tier — decides how much 3D the device gets
   --------------------------------------------------------- */
function detectTier() {
  if (reduce) return 'none';
  let gl = null;
  try { gl = document.createElement('canvas').getContext('webgl2'); } catch (e) { gl = null; }
  if (!gl) return 'none';
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (mem <= 2 || cores <= 2) return 'none';
  const small = window.matchMedia('(max-width: 1023px)').matches || window.matchMedia('(pointer: coarse)').matches;
  return small ? 'mobile' : 'high';
}

/* ---------------------------------------------------------
   Smooth scroll
   --------------------------------------------------------- */
function setupScroll() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  if (reduce || !Lenis) return;
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

function scrollToTarget(target) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}

function setupAnchors() {
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const el = $(id);
      if (!el) return;
      e.preventDefault();
      if (root.classList.contains('menu-open')) closeMenu(() => scrollToTarget(el));
      else scrollToTarget(el);
    });
  });
}

/* ---------------------------------------------------------
   Loader
   --------------------------------------------------------- */
const loaderState = { v: 0 };
function loaderIn() {
  const countEl = $('#loaderCount');
  const bar = $('.loader__bar i');
  const render = () => {
    const v = Math.round(loaderState.v);
    countEl.textContent = String(v).padStart(3, '0');
    bar.style.transform = `scaleX(${loaderState.v / 100})`;
  };
  gsap.from('.loader__word', { yPercent: 110, duration: 1.2, stagger: 0.1, ease: 'expo.out' });
  gsap.from('.loader__top span, .loader__bottom', { opacity: 0, duration: 1, delay: 0.3 });
  // Optimistic progress to 82%, then completes once real assets are ready.
  gsap.to(loaderState, { v: 82, duration: 2.0, ease: 'power2.out', onUpdate: render });
  return () => new Promise((resolve) => {
    gsap.to(loaderState, { v: 100, duration: 0.6, ease: 'power2.inOut', overwrite: true, onUpdate: render, onComplete: resolve });
  });
}

function loaderOut() {
  const tl = gsap.timeline();
  tl.to('.loader__name .loader__word', { yPercent: -110, duration: 0.8, stagger: 0.06, ease: 'power3.in' })
    .to('.loader__top, .loader__bottom', { opacity: 0, duration: 0.4 }, '<')
    .to('.loader__panels span', { yPercent: -100, duration: 1.15, stagger: 0.07, ease: 'expo.inOut' }, '-=0.15')
    .add(() => $('#stage').classList.add('is-ready'), '<')
    .add(heroIntro(), '-=0.85')
    .set('#loader', { display: 'none' }, '-=1.2');
  return tl;
}

/* ---------------------------------------------------------
   Hero intro & exit
   --------------------------------------------------------- */
let heroChars = [];
function prepareHero() {
  $$('[data-hero-split]').forEach((el) => {
    const text = el.textContent;
    el.setAttribute('aria-hidden', 'true');
    el.textContent = '';
    for (const ch of text) {
      const s = document.createElement('span');
      s.className = 'char';
      s.textContent = ch;
      el.appendChild(s);
      heroChars.push(s);
    }
  });
  if (reduce) return;
  gsap.set(heroChars, { yPercent: 115, rotate: 10, opacity: 0 });
  gsap.set('[data-intro-fade]', { opacity: 0, y: 16 });
  gsap.set('[data-intro-scramble]', { opacity: 0 });
}

let heroLeadSplit = null;
function heroIntro() {
  const tl = gsap.timeline();
  if (reduce) return tl;
  tl.add(() => scene?.playIntro(), 0)
    .to(heroChars, { yPercent: 0, rotate: 0, opacity: 1, duration: 1.5, stagger: 0.05, ease: 'expo.out' }, 0)
    .to('[data-intro-scramble]', { opacity: 1, duration: 0.01 }, 0.3)
    .to('[data-intro-scramble]', {
      duration: 1.4,
      scrambleText: { text: $('[data-intro-scramble]').textContent, chars: '01<>/{}#$%&ABCDEFX', revealDelay: 0.2, speed: 0.5 },
    }, 0.3)
    .to('[data-intro-fade]', { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'power3.out' }, 0.6);

  const lead = $('[data-intro-lines]');
  if (SplitText && lead) {
    heroLeadSplit = SplitText.create(lead, { type: 'lines', mask: 'lines', linesClass: 'line' });
    tl.from(heroLeadSplit.lines, { yPercent: 105, duration: 1.2, stagger: 0.1, ease: 'expo.out' }, 0.55);
  }
  return tl;
}

function heroScroll() {
  if (reduce) return;
  const lines = $$('.hero__line');
  const tl = gsap.timeline({
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.8 },
  });
  tl.to(lines[0], { xPercent: -14, ease: 'none' }, 0)
    .to(lines[1], { xPercent: 10, ease: 'none' }, 0)
    .to('.hero__content', { yPercent: -18, opacity: 0, scale: 0.94, ease: 'power1.in' }, 0)
    .to('.hero__meta', { y: -60, opacity: 0, ease: 'none' }, 0)
    .to('.hero__badge-ring', { rotation: 300, ease: 'none' }, 0);
}

/* ---------------------------------------------------------
   Typography animations
   --------------------------------------------------------- */
function textAnimations() {
  // Section index labels: scramble decode
  $$('[data-scramble-in]').forEach((el) => {
    const text = el.textContent;
    if (reduce || !ScrambleTextPlugin) return;
    el.textContent = '';
    ScrollTrigger.create({
      trigger: el, start: 'top 90%',
      onEnter: () => gsap.to(el, { duration: 1.2, scrambleText: { text, chars: 'upperCase', speed: 0.6, revealDelay: 0.1 } }),
      onLeaveBack: () => gsap.to(el, { duration: 0.5, scrambleText: { text: ' ', chars: 'upperCase' } }),
    });
  });

  // Rules draw in
  $$('[data-rule]').forEach((el) => {
    if (reduce) return;
    gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' } });
  });

  // Headings: masked line + word rise with a slight rotation
  if (SplitText && !reduce) {
    $$('[data-split-heading]').forEach((el) => {
      SplitText.create(el, {
        type: 'lines,words', mask: 'lines', linesClass: 'line', wordsClass: 'word', autoSplit: true,
        onSplit(self) {
          return gsap.from(self.words, {
            yPercent: 120, rotate: 6, transformOrigin: '0% 100%', duration: 1.3, stagger: 0.06, ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 82%', toggleActions: 'play none none reverse' },
          });
        },
      });
    });

    // Paragraph: word-by-word illumination scrubbed to scroll
    $$('[data-word-fill]').forEach((el) => {
      SplitText.create(el, {
        type: 'words', wordsClass: 'word', autoSplit: true,
        onSplit(self) {
          return gsap.to(self.words, {
            opacity: 1, stagger: 0.1, ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 50%', scrub: true },
          });
        },
      });
    });
  }

  // Nav links scramble on hover
  if (ScrambleTextPlugin && finePointer) {
    $$('[data-scramble]').forEach((el) => {
      const text = el.textContent;
      el.addEventListener('mouseenter', () => gsap.to(el, { duration: 0.6, scrambleText: { text, chars: 'upperCase', speed: 0.8 }, overwrite: true }));
    });
  }
}

/* ---------------------------------------------------------
   Generic reveals, counters, progress, nav
   --------------------------------------------------------- */
function reveals() {
  if (reduce) return;
  const items = $$('[data-reveal]');
  gsap.set(items, { opacity: 0, y: 70, rotateX: -14, transformPerspective: 900, transformOrigin: '50% 100%' });
  ScrollTrigger.batch(items, {
    start: 'top 90%',
    onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, rotateX: 0, duration: 1.3, stagger: 0.1, ease: 'expo.out', overwrite: true }),
    onLeaveBack: (b) => gsap.to(b, { opacity: 0, y: 70, rotateX: -14, duration: 0.6, stagger: 0.05, ease: 'power2.in', overwrite: true }),
  });
}

function counters() {
  $$('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    if (reduce) { el.textContent = end.toFixed(dec); return; }
    const o = { v: 0 };
    el.textContent = (0).toFixed(dec);
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = o.v.toFixed(dec); } }),
    });
  });
}

function progressAndNav() {
  gsap.to('.scroll-progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  const nav = $('#nav');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      nav.classList.toggle('is-scrolled', y > 40);
      if (!root.classList.contains('menu-open')) nav.classList.toggle('is-hidden', self.direction === 1 && y > 400);
    },
  });

  const links = $$('.nav__links a');
  links.forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 50%', end: 'bottom 50%',
      onToggle: (self) => a.classList.toggle('is-active', self.isActive),
    });
  });
}

/* ---------------------------------------------------------
   Mobile menu
   --------------------------------------------------------- */
let menuTl = null;
function setupMenu() {
  const burger = $('#burger');
  const menu = $('#menu');
  burger.addEventListener('click', () => (root.classList.contains('menu-open') ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('menu-open')) closeMenu(); });

  function openMenu() {
    const r = burger.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
    root.classList.add('menu-open');
    $('#nav').classList.remove('is-hidden');
    menu.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    lenis?.stop();
    menuTl?.kill();
    menuTl = gsap.timeline()
      .fromTo('.menu__bg', { clipPath: `circle(0px at ${cx}px ${cy}px)` }, { clipPath: `circle(${radius}px at ${cx}px ${cy}px)`, duration: reduce ? 0.01 : 0.9, ease: 'expo.inOut' })
      .fromTo('.menu__list a span, .menu__list a em', { yPercent: 120 }, { yPercent: 0, duration: 1, stagger: 0.045, ease: 'expo.out' }, '-=0.45')
      .fromTo('.menu__label, .menu__foot', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 }, '-=0.8');
  }
}
function closeMenu(after) {
  const burger = $('#burger');
  const menu = $('#menu');
  menuTl?.kill();
  const r = burger.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  gsap.timeline({
    onComplete: () => {
      root.classList.remove('menu-open');
      menu.setAttribute('aria-hidden', 'true');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open menu');
      lenis?.start();
      if (typeof after === 'function') after();
    },
  })
    .to('.menu__list a span, .menu__list a em', { yPercent: -120, duration: 0.45, stagger: 0.02, ease: 'power3.in' })
    .to('.menu__label, .menu__foot', { opacity: 0, duration: 0.3 }, '<')
    .to('.menu__bg', { clipPath: `circle(0px at ${cx}px ${cy}px)`, duration: reduce ? 0.01 : 0.7, ease: 'expo.inOut' }, '-=0.15');
}

/* ---------------------------------------------------------
   Cursor, magnetic, tilt, spotlight
   --------------------------------------------------------- */
function setupCursor() {
  const cursor = $('.cursor');
  const label = $('.cursor__label');
  const dotX = gsap.quickTo('.cursor__dot', 'x', { duration: 0.08, ease: 'power3' });
  const dotY = gsap.quickTo('.cursor__dot', 'y', { duration: 0.08, ease: 'power3' });
  const ringX = gsap.quickTo('.cursor__ring', 'x', { duration: 0.5, ease: 'power3' });
  const ringY = gsap.quickTo('.cursor__ring', 'y', { duration: 0.5, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { dotX(e.clientX); dotY(e.clientY); ringX(e.clientX); ringY(e.clientY); }, { passive: true });
  window.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
  window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));

  document.addEventListener('pointerover', (e) => {
    const lab = e.target.closest('[data-cursor]');
    const link = e.target.closest('a, button, .sphere__tag');
    if (lab) { label.textContent = lab.dataset.cursor; cursor.classList.add('is-label'); cursor.classList.remove('is-hover'); }
    else if (link) { cursor.classList.add('is-hover'); cursor.classList.remove('is-label'); }
    else { cursor.classList.remove('is-hover', 'is-label'); }
  });
  document.documentElement.addEventListener('pointerleave', () => gsap.to(cursor, { opacity: 0, duration: 0.3 }));
  document.documentElement.addEventListener('pointerenter', () => gsap.to(cursor, { opacity: 1, duration: 0.3 }));
}

function setupMagnetic() {
  if (!finePointer || reduce) return;
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
    const strength = el.classList.contains('cta') ? 0.45 : 0.3;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)', overwrite: true });
    });
  });
}

function setupTilt() {
  if (!finePointer || reduce) return;
  $$('[data-tilt]').forEach((el) => {
    gsap.set(el, { transformPerspective: 1000 });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      rx(-py * 9); ry(px * 11);
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });

  $$('[data-spotlight]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/* ---------------------------------------------------------
   Skills sphere — CSS 3D, pointer/drag driven
   --------------------------------------------------------- */
function setupSphere() {
  const host = $('#sphere');
  if (!host) return;
  const skills = [
    'Java', 'TypeScript', 'Python', 'JavaScript', 'SQL', 'HTML', 'CSS', 'React', 'Angular', 'Node.js', 'Express',
    'GraphQL', 'Flask', 'PostgreSQL', 'MongoDB', 'Firebase', 'Supabase', 'SQLite', 'Docker', 'Git', 'GitHub',
    'Selenium', 'TestNG', 'scikit-learn', 'REST APIs', 'JWT Auth', 'Bootstrap', 'AWS', 'VS Code', 'Jupyter',
  ];
  const accent = new Set(['Java', 'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'GraphQL', 'Angular', 'Docker']);
  const n = skills.length;
  const pts = skills.map((name, i) => {
    const el = document.createElement('span');
    el.className = 'sphere__tag' + (accent.has(name) ? ' is-accent' : '');
    el.textContent = name;
    host.appendChild(el);
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    return { el, x: Math.cos(phi) * r, y, z: Math.sin(phi) * r };
  });

  let R = host.clientWidth * 0.4;
  const ro = new ResizeObserver(() => { R = host.clientWidth * 0.4; });
  ro.observe(host);

  let vx = 0.0035, vy = 0.0025; // angular velocity (rad/frame)
  let tx = vx, ty = vy;
  let dragging = false, lastX = 0, lastY = 0, hovering = false;

  host.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; host.setPointerCapture?.(e.pointerId); });
  host.addEventListener('pointerup', () => { dragging = false; });
  host.addEventListener('pointercancel', () => { dragging = false; });
  host.addEventListener('pointerenter', () => { hovering = true; });
  host.addEventListener('pointerleave', () => { hovering = false; tx = 0.0035; ty = 0.0025; });
  host.addEventListener('pointermove', (e) => {
    if (dragging) {
      ty = (e.clientX - lastX) * 0.004;
      tx = -(e.clientY - lastY) * 0.004;
      lastX = e.clientX; lastY = e.clientY;
    } else if (hovering && finePointer) {
      const r = host.getBoundingClientRect();
      ty = ((e.clientX - r.left) / r.width - 0.5) * 0.04;
      tx = -((e.clientY - r.top) / r.height - 0.5) * 0.04;
    }
  });

  const draw = () => {
    for (const p of pts) {
      const s = 1.6 / (2.2 - p.z);
      const o = 0.18 + 0.82 * ((p.z + 1) / 2);
      p.el.style.transform = `translate(-50%, -50%) translate3d(${(p.x * R).toFixed(1)}px, ${(p.y * R).toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      p.el.style.opacity = o.toFixed(3);
      p.el.style.zIndex = String(Math.round(p.z * 100) + 100);
    }
  };

  const tick = () => {
    vx += (tx - vx) * 0.06; vy += (ty - vy) * 0.06;
    if (!dragging && !hovering) { tx += (0.0035 - tx) * 0.02; ty += (0.0025 - ty) * 0.02; }
    const cx = Math.cos(vx), sx = Math.sin(vx), cy = Math.cos(vy), sy = Math.sin(vy);
    for (const p of pts) {
      // rotate around Y then X
      let x = p.x * cy + p.z * sy;
      let z = -p.x * sy + p.z * cy;
      let y = p.y * cx - z * sx;
      z = p.y * sx + z * cx;
      const len = Math.hypot(x, y, z) || 1;
      p.x = x / len; p.y = y / len; p.z = z / len;
    }
    draw();
  };

  draw();
  if (reduce) return;
  let active = false;
  ScrollTrigger.create({
    trigger: host, start: 'top bottom', end: 'bottom top',
    onToggle: (self) => {
      if (self.isActive && !active) { active = true; gsap.ticker.add(tick); }
      else if (!self.isActive && active) { active = false; gsap.ticker.remove(tick); }
    },
  });
  gsap.from(pts.map((p) => p.el), {
    scale: 0, opacity: 0, duration: 1.2, ease: 'back.out(1.6)', stagger: { each: 0.025, from: 'random' },
    scrollTrigger: { trigger: host, start: 'top 80%', toggleActions: 'play none none reverse' },
    onComplete: draw, onReverseComplete: draw,
  });
}

/* ---------------------------------------------------------
   Velocity-reactive marquees
   --------------------------------------------------------- */
const marqueeTweens = [];
function setupMarquees() {
  $$('[data-marquee] .marquee__row').forEach((row) => {
    row.innerHTML += row.innerHTML; // duplicate for a seamless loop
    if (reduce) return;
    const dir = parseFloat(row.dataset.dir || '1');
    const tween = gsap.fromTo(row, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: 38, ease: 'none', repeat: -1 });
    marqueeTweens.push(tween);
    // pause when offscreen
    ScrollTrigger.create({ trigger: row, start: 'top bottom', end: 'bottom top', onToggle: (s) => tween.paused(!s.isActive) });
  });
  $$('.marquee').forEach((m) => {
    if (reduce) return;
    gsap.fromTo(m, { rotate: -5 }, { rotate: 2, ease: 'none', scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

/* ---------------------------------------------------------
   Work — horizontal 3D gallery (desktop) / stacked cards (touch)
   --------------------------------------------------------- */
function setupWork() {
  const track = $('#workTrack');
  const cards = $$('.project', track);
  const bar = $('#workBar');
  const current = $('#workCurrent');

  // Hover depth on the visual + spotlight (all pointer devices with hover)
  if (finePointer && !reduce) {
    cards.forEach((card) => {
      const inner = $('.project__inner', card);
      const pv = $('.pv', card);
      const rx = gsap.quickTo(pv, 'rotationX', { duration: 0.8, ease: 'power3' });
      const ry = gsap.quickTo(pv, 'rotationY', { duration: 0.8, ease: 'power3' });
      card.addEventListener('pointermove', (e) => {
        const r = inner.getBoundingClientRect();
        inner.style.setProperty('--mx', `${e.clientX - r.left}px`);
        inner.style.setProperty('--my', `${e.clientY - r.top}px`);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 14);
        ry(((e.clientX - r.left) / r.width - 0.5) * 18);
      });
      card.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  if (reduce) return;
  const mm = gsap.matchMedia();

  mm.add('(min-width: 1024px)', () => {
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const scrollTween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.work__pin', start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate(self) {
          const idx = Math.min(cards.length, Math.floor(self.progress * cards.length * 0.999) + 1);
          current.textContent = String(idx).padStart(2, '0');
          bar.style.transform = `scaleX(${(self.progress * (cards.length - 1) + 1) / cards.length})`;
        },
      },
    });

    cards.forEach((card) => {
      const inner = $('.project__inner', card);
      const win = $('.pv__window', card);
      const chip = $('.pv__chip', card);
      gsap.timeline({
        scrollTrigger: { trigger: card, containerAnimation: scrollTween, start: 'left right', end: 'right left', scrub: true },
      })
        .fromTo(inner, { rotationY: -32, scale: 0.84, opacity: 0.35, transformPerspective: 1600, transformOrigin: '0% 50%' },
          { rotationY: 0, scale: 1, opacity: 1, ease: 'power2.out', duration: 1 })
        .to(inner, { rotationY: 22, scale: 0.9, opacity: 0.5, transformOrigin: '100% 50%', ease: 'power2.in', duration: 1 })
        .fromTo(win, { xPercent: 16 }, { xPercent: -16, ease: 'none', duration: 2 }, 0)
        .fromTo(chip, { xPercent: 60, yPercent: 30 }, { xPercent: -60, yPercent: -30, ease: 'none', duration: 2 }, 0);

      // Animated mock internals the first time each card arrives
      const bits = $$('.pv__grid i, .pv__list i, .pv__cal i, .pv__bars i, .pv__table i, .pv__nodes i', card);
      gsap.from(bits, {
        scale: 0, opacity: 0, transformOrigin: '50% 100%', duration: 0.9, stagger: 0.04, ease: 'back.out(1.7)',
        scrollTrigger: { trigger: card, containerAnimation: scrollTween, start: 'left 85%', toggleActions: 'play none none reverse' },
      });
    });

    return () => gsap.set(track, { clearProps: 'transform' });
  });

  mm.add('(max-width: 1023px)', () => {
    cards.forEach((card, i) => {
      const inner = $('.project__inner', card);
      const next = cards[i + 1];
      if (next) {
        gsap.to(inner, {
          scale: 0.9, '--shade': 0.78, rotationX: 8, transformPerspective: 1200, ease: 'none',
          scrollTrigger: { trigger: next, start: 'top 70%', end: 'top 15%', scrub: true },
        });
      }
      gsap.from($('.pv__window', card), {
        rotationX: 35, yPercent: 20, opacity: 0, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: card, start: 'top 85%', toggleActions: 'play none none reverse' },
      });
      gsap.from($$('.pv__grid i, .pv__list i, .pv__cal i, .pv__bars i, .pv__table i, .pv__nodes i', card), {
        scale: 0, opacity: 0, duration: 0.8, stagger: 0.03, ease: 'back.out(1.7)',
        scrollTrigger: { trigger: card, start: 'top 75%', toggleActions: 'play none none reverse' },
      });
    });
  });
}

/* ---------------------------------------------------------
   Journey timeline
   --------------------------------------------------------- */
function setupTimeline() {
  const tlEl = $('#timeline');
  if (!tlEl) return;
  const items = $$('.t-item', tlEl);
  if (reduce) { items.forEach((i) => i.classList.add('is-active')); gsap.set('.timeline__fill', { scaleY: 1 }); return; }

  const st = { trigger: tlEl, start: 'top 70%', end: 'bottom 65%', scrub: 0.6 };
  gsap.to('.timeline__fill', { scaleY: 1, ease: 'none', scrollTrigger: st });
  gsap.fromTo('.timeline__head', { top: '0%' }, { top: '100%', ease: 'none', scrollTrigger: { ...st } });

  const mobile = window.matchMedia('(max-width: 1023px)').matches;
  items.forEach((item) => {
    const card = $('.t-item__card', item);
    const left = item.dataset.side === 'left';
    gsap.from(card, {
      x: mobile ? 40 : left ? -90 : 90, rotationY: mobile ? 0 : left ? 14 : -14, opacity: 0, transformPerspective: 1200,
      duration: 1.4, ease: 'expo.out',
      scrollTrigger: { trigger: item, start: 'top 80%', toggleActions: 'play none none reverse' },
    });
    gsap.from($$('li, .tags span', card), {
      y: 20, opacity: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out', delay: 0.25,
      scrollTrigger: { trigger: item, start: 'top 75%', toggleActions: 'play none none reverse' },
    });
    ScrollTrigger.create({ trigger: item, start: 'top 65%', onEnter: () => item.classList.add('is-active'), onLeaveBack: () => item.classList.remove('is-active') });
  });
}

/* ---------------------------------------------------------
   Certifications — row reveals + floating preview
   --------------------------------------------------------- */
function setupCerts() {
  const list = $('#certs');
  if (!list) return;
  const rows = $$('.cert', list);
  if (!reduce) {
    gsap.set(rows, { opacity: 0, y: 50 });
    ScrollTrigger.batch(rows, {
      start: 'top 92%',
      onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out', overwrite: true }),
      onLeaveBack: (b) => gsap.to(b, { opacity: 0, y: 50, duration: 0.5, stagger: 0.04, overwrite: true }),
    });
  }
  if (!finePointer || reduce) return;

  const preview = $('#certPreview');
  const inner = $('.cert-preview__inner', preview);
  const issuer = $('#certPreviewIssuer');
  const xTo = gsap.quickTo(preview, 'x', { duration: 0.6, ease: 'power3' });
  const yTo = gsap.quickTo(preview, 'y', { duration: 0.6, ease: 'power3' });
  const rTo = gsap.quickTo(preview, 'rotation', { duration: 0.8, ease: 'power3' });
  let lastX = 0;
  list.addEventListener('pointermove', (e) => {
    xTo(e.clientX + 170); yTo(e.clientY);
    rTo(gsap.utils.clamp(-14, 14, (e.clientX - lastX) * 0.6));
    lastX = e.clientX;
  });
  rows.forEach((row) => {
    row.addEventListener('pointerenter', () => {
      issuer.textContent = row.dataset.issuer;
      inner.style.setProperty('--hue', row.dataset.hue);
      gsap.to(preview, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.6)', overwrite: 'auto' });
    });
  });
  list.addEventListener('pointerleave', () => gsap.to(preview, { scale: 0, opacity: 0, duration: 0.4, ease: 'power3.in', overwrite: 'auto' }));
}

/* ---------------------------------------------------------
   Contact
   --------------------------------------------------------- */
function setupContact() {
  const btn = $('#copyEmail');
  const toast = $('#toast');
  const show = (msg) => {
    toast.textContent = msg;
    toast.classList.add('is-show');
    clearTimeout(show.t);
    show.t = setTimeout(() => toast.classList.remove('is-show'), 2200);
  };
  btn?.addEventListener('click', async () => {
    const email = 'ajaysriramm90@gmail.com';
    try { await navigator.clipboard.writeText(email); show('Email copied ✓'); }
    catch (e) { window.location.href = `mailto:${email}`; }
  });

  if (reduce) return;
  gsap.from('.cta', {
    scale: 0, rotate: -120, duration: 1.6, ease: 'expo.out',
    scrollTrigger: { trigger: '.contact__row', start: 'top 85%', toggleActions: 'play none none reverse' },
  });
  gsap.from('.contact__details > *', {
    y: 40, opacity: 0, duration: 1.1, stagger: 0.12, ease: 'expo.out',
    scrollTrigger: { trigger: '.contact__row', start: 'top 85%', toggleActions: 'play none none reverse' },
  });
  gsap.fromTo('.big-marquee', { yPercent: 40, opacity: 0 }, {
    yPercent: 0, opacity: 1, ease: 'none',
    scrollTrigger: { trigger: '.big-marquee', start: 'top bottom', end: 'top 60%', scrub: true },
  });
}

/* ---------------------------------------------------------
   Process chapter — liquid-fill numbers, parallax words, progress rail
   --------------------------------------------------------- */
function setupProcess() {
  const steps = $$('.step');
  if (!steps.length) return;
  const railLabels = $$('[data-rail]');
  const railFill = $('.process__rail-line b');

  if (reduce) {
    gsap.set('.step__no', { backgroundPosition: '0% 100%' });
    return;
  }

  steps.forEach((step, i) => {
    gsap.to($('.step__no', step), {
      backgroundPosition: '0% 100%', ease: 'none',
      scrollTrigger: { trigger: step, start: 'top 75%', end: 'center 55%', scrub: true },
    });
    gsap.fromTo($('.step__bg', step), { xPercent: 12 }, {
      xPercent: -38, ease: 'none',
      scrollTrigger: { trigger: step, start: 'top bottom', end: 'bottom top', scrub: true },
    });
    gsap.from($$('.step__list li', step), {
      y: 24, opacity: 0, scale: 0.9, duration: 0.9, stagger: 0.07, ease: 'back.out(1.8)',
      scrollTrigger: { trigger: step, start: 'top 45%', toggleActions: 'play none none reverse' },
    });
    ScrollTrigger.create({
      trigger: step, start: 'top center', end: 'bottom center',
      onToggle: (self) => railLabels[i]?.classList.toggle('is-active', self.isActive),
    });
  });

  if (railFill) {
    gsap.to(railFill, {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: '.process__steps', start: 'top center', end: 'bottom center', scrub: true },
    });
  }
}

/* ---------------------------------------------------------
   Circuit dividers — traces draw, nodes light up, a packet travels
   --------------------------------------------------------- */
function setupDividers() {
  if (reduce) return;
  $$('[data-divider]').forEach((d) => {
    const traces = $$('.divider__trace', d);
    const main = $('.divider__trace--main', d);
    const nodes = $$('.divider__node', d);
    const packet = $('.divider__packet', d);
    const len = main.getTotalLength();
    traces.forEach((p) => p.setAttribute('pathLength', '1'));
    const travel = { t: 0 };
    const tl = gsap.timeline({
      scrollTrigger: { trigger: d, start: 'top 92%', end: 'bottom 30%', scrub: 0.6 },
    });
    tl.to(traces, { strokeDashoffset: 0, ease: 'none', duration: 1, stagger: 0.12 }, 0)
      .to(nodes, { scale: 1, ease: 'back.out(3)', duration: 0.18, stagger: 0.09 }, 0.1)
      .fromTo(packet, { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0)
      .to(travel, {
        t: 1, duration: 1, ease: 'none',
        onUpdate() {
          const pt = main.getPointAtLength(travel.t * len);
          packet.style.left = `${(pt.x / 1440) * 100}%`;
          packet.style.top = `${(pt.y / 200) * 100}%`;
        },
      }, 0)
      .to(packet, { opacity: 0, duration: 0.1 }, 0.95);
  });
}

/* ---------------------------------------------------------
   Footer signature — gradient fill sweeps across the name
   --------------------------------------------------------- */
function setupSignature() {
  if (reduce) return;
  gsap.fromTo('.signature__fill', { clipPath: 'inset(0 100% 0 0)' }, {
    clipPath: 'inset(0 0% 0 0)', ease: 'none',
    scrollTrigger: { trigger: '.signature', start: 'top 95%', end: 'bottom 70%', scrub: true },
  });
  gsap.fromTo('.signature', { yPercent: 30, letterSpacing: '0.02em' }, {
    yPercent: 0, letterSpacing: '-0.06em', ease: 'none',
    scrollTrigger: { trigger: '.signature', start: 'top bottom', end: 'bottom 75%', scrub: true },
  });
}

/* ---------------------------------------------------------
   Clock
   --------------------------------------------------------- */
function setupClock() {
  const els = $$('[data-clock]');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tick = () => { const t = `IST ${fmt.format(new Date())}`; els.forEach((e) => { e.textContent = t; }); };
  tick();
  setInterval(tick, 1000);
}

/* ---------------------------------------------------------
   Scroll velocity → scene + marquees; pointer → scene
   --------------------------------------------------------- */
function setupVelocityBridge() {
  let lastY = window.scrollY;
  // Big titles lean into the scroll direction, then settle.
  const skewEls = (reduce || !finePointer) ? [] : $$('[data-skew]');
  const skewSet = skewEls.map((el) => gsap.quickSetter(el, 'skewY', 'deg'));
  let skew = 0;
  gsap.ticker.add(() => {
    const y = window.scrollY;
    const v = lenis ? lenis.velocity : y - lastY;
    lastY = y;
    scene?.setVelocity(v);
    if (skewSet.length) {
      skew += (gsap.utils.clamp(-4, 4, -v * 0.12) - skew) * 0.12;
      const val = Math.abs(skew) > 0.01 ? skew : 0;
      skewSet.forEach((set) => set(val));
    }
    if (marqueeTweens.length) {
      const boost = 1 + Math.min(Math.abs(v) * 0.08, 5);
      const sign = v < -0.5 ? -1 : 1;
      marqueeTweens.forEach((t) => {
        const target = boost * sign;
        t.timeScale(t.timeScale() + (target - t.timeScale()) * 0.1);
      });
    }
  });
  window.addEventListener('pointermove', (e) => {
    scene?.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });
  // Gentle device tilt on phones stands in for the mouse.
  if (!finePointer && !reduce) {
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      scene?.setPointer(gsap.utils.clamp(-1, 1, e.gamma / 30), gsap.utils.clamp(-1, 1, (e.beta - 45) / 30));
    }, { passive: true });
  }
}

/* ---------------------------------------------------------
   Boot
   --------------------------------------------------------- */
async function boot() {
  setupScroll();
  const tier = detectTier();
  if (tier === 'none') root.classList.add('no-webgl');
  if (finePointer && !reduce) { root.classList.add('has-cursor'); setupCursor(); }

  const finishLoader = reduce ? () => Promise.resolve() : loaderIn();
  const minTime = wait(reduce ? 0 : 1900);

  // Heavy 3D is lazy-loaded so the page itself is interactive first.
  const scenePromise = tier === 'none'
    ? Promise.resolve(null)
    : import('./scene.js')
      .then((m) => m.createScene($('#stage'), { tier }))
      .catch((err) => { console.warn('3D disabled:', err); root.classList.add('no-webgl'); return null; });

  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, wait(3000)]) : Promise.resolve();
  await fontsReady;

  prepareHero();
  setupAnchors();
  setupMenu();
  setupClock();
  setupMarquees();
  setupSphere();
  setupWork();
  setupTimeline();
  setupCerts();
  setupContact();
  setupProcess();
  setupDividers();
  setupSignature();
  textAnimations();
  reveals();
  counters();
  heroScroll();
  progressAndNav();
  setupMagnetic();
  setupTilt();
  setupVelocityBridge();

  scene = await scenePromise;
  ScrollTrigger.addEventListener('refresh', () => scene?.refresh());
  await minTime;
  ScrollTrigger.refresh();
  await finishLoader();

  if (reduce) {
    $('#loader').style.display = 'none';
    $('#stage').classList.add('is-ready');
    scene?.playIntro();
  } else {
    loaderOut().eventCallback('onComplete', () => { lenis?.start(); ScrollTrigger.refresh(); });
    // let visitors scroll as soon as the curtain lifts
    gsap.delayedCall(1.2, () => lenis?.start());
  }
}

boot().catch((err) => {
  console.error(err);
  root.classList.remove('js');
  root.classList.add('no-boot');
  lenis?.start();
});
