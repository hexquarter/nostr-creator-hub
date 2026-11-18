/**
 * Extra files GitHub Pages needs, written after the static build:
 *
 *   - `.nojekyll` so Jekyll doesn't strip the `assets/` folder.
 *   - `404.html`, which Pages serves (with a 404 status) for any URL that has
 *     no prerendered HTML file. It's a standalone page, so it works without the
 *     client bundle.
 *
 * Only runs for the GitHub Pages build (`GITHUB_PAGES=true`).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

if (process.env.GITHUB_PAGES !== "true") process.exit(0);

const outDir = process.argv[2] ?? "dist/client";
const base = process.env.BASE_PATH ?? "/";
const home = base.endsWith("/") ? base : `${base}/`;

const notFound = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Page not found — Crays</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        background: #fafafa;
        color: #18181b;
        font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .card { max-width: 26rem; text-align: center; }
      h1 { margin: 0; font-size: 3.5rem; font-weight: 700; letter-spacing: -0.03em; }
      h2 { margin: 0.75rem 0 0; font-size: 1.125rem; font-weight: 600; }
      p { margin: 0.5rem 0 1.75rem; color: #52525b; }
      a {
        display: inline-block;
        padding: 0.6rem 1.1rem;
        border-radius: 0.5rem;
        background: #18181b;
        color: #fff;
        font-weight: 500;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>404</h1>
      <h2>Page not found</h2>
      <p>The page you're looking for doesn't exist or has been moved.</p>
      <a href="${home}">Back to Crays</a>
    </div>
  </body>
</html>
`;

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, ".nojekyll"), "");
await writeFile(join(outDir, "404.html"), notFound);

console.log(`[gh-pages] wrote .nojekyll and 404.html to ${outDir} (base ${base})`);
