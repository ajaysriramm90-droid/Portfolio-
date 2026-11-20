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

## Performance & accessibility

- A device tier decides the 3D experience. Desktop gets bloom and a high-detail mesh. Phones and tablets get a lighter scene, native touch scrolling and stacked project cards. Weak devices or no WebGL2 get an animated CSS fallback.
- If the frame rate stays low, the scene turns bloom off and lowers its resolution automatically.
- Rendering pauses when the tab is hidden. The skills sphere and marquees stop animating while they're offscreen.
- With `prefers-reduced-motion`, smooth scrolling, WebGL and the scroll-driven motion are all off, and the content is shown straight away.
