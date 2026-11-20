# Ajay Sri Ramm — Portfolio

A cinematic, scroll-directed 3D portfolio. It's a static site (no build step), built with Three.js, GSAP (ScrollTrigger, SplitText, ScrambleText) and Lenis. All of these are vendored under `assets/vendor/`.

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

ES modules and the import map need a server, so opening `index.html` straight from disk won't work.

## Deploy to Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, then pick this repository.
2. Framework preset: **None**. Build command: *(leave empty)*. Build output directory: `/`.
3. Deploy. `_headers` sets caching and security headers, and `404.html` is the not-found page.

Or deploy from the CLI: `npx wrangler pages deploy . --project-name=ajay-portfolio`

## Structure

```
index.html            all sections and content
assets/css/style.css  design tokens, layout, responsive and reduced-motion rules
assets/js/main.js     loader, smooth scroll, text, scroll and interaction animations
assets/js/scene.js    WebGL scene (lazy-loaded): core, rings, particles, grid, bloom
assets/vendor/        three 0.170.0, gsap 3.13.0, lenis 1.3.4
```

## Scroll graphics at a glance

- **Morphing particle sculpture.** About 6,000 points (2,500 on phones) rebuild themselves into a new shape for each section: a spiral galaxy, a DNA helix, a lattice cube, a torus knot, a wire globe, atomic orbits, a wave terrain, a vortex, a starburst and an accretion halo. All shapes are stored in one float texture and the GPU blends between them.
- **Process chapter.** Three full-screen steps (Architect, Engineer, Ship). Each has a liquid-fill number, a giant outlined word sliding behind it and a sticky progress rail.
- **Circuit dividers.** SVG traces draw themselves as you scroll, nodes light up and a glowing packet travels along the line.
- **Cinematic camera.** The field of view widens and the camera banks with scroll speed, and an RGB-split lens effect strengthens as you scroll faster (desktop).
- **Kinetic type.** Big titles lean into the scroll direction, the hero has a rotating seal, and the footer signature fills with a gradient on scroll.

## Performance & accessibility

- A device tier decides the 3D experience. Desktop gets bloom and a high-detail mesh. Phones and tablets get a lighter scene, native touch scrolling and stacked project cards. Weak devices or no WebGL2 get an animated CSS fallback.
- If the frame rate stays low, the scene turns bloom off and lowers its resolution automatically.
- Rendering pauses when the tab is hidden. The skills sphere and marquees stop animating while they're offscreen.
- With `prefers-reduced-motion`, smooth scrolling, WebGL and the scroll-driven motion are all off, and the content is shown straight away.
