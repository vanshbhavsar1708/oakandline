// Runs after `vite build` on Netlify. Writes dist/public/_redirects (API proxy + SPA fallback)
// and an absolute robots.txt sitemap line, using the client's Netlify environment variables.
//   API_ORIGIN  (required) e.g. https://oakline-api.onrender.com  — the client-owned Node host
//   URL         (set automatically by Netlify) the site's primary URL
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("dist/public");
const api = (process.env.API_ORIGIN || "").trim().replace(/\/+$/, "");
if (!/^https:\/\/[^/\s]+$/.test(api)) {
  console.error("\n[netlify] API_ORIGIN must be set to the API host origin, e.g. https://oakline-api.onrender.com\n");
  process.exit(1);
}
fs.writeFileSync(
  path.join(out, "_redirects"),
  [
    "# Generated at build time by script/netlify-redirects.mjs — do not edit in dist.",
    `/api/*       ${api}/api/:splat       200`,
    `/uploads/*   ${api}/uploads/:splat   200`,
    `/sitemap.xml ${api}/sitemap.xml      200`,
    "/admin       /index.html             200",
    "/*           /index.html             200",
    "",
  ].join("\n"),
);

const site = (process.env.URL || "").replace(/\/+$/, "");
const robots = path.join(out, "robots.txt");
if (site && fs.existsSync(robots)) {
  fs.writeFileSync(robots, fs.readFileSync(robots, "utf8").replace(/^Sitemap:.*$/m, `Sitemap: ${site}/sitemap.xml`));
}
console.log(`[netlify] API proxied to ${api}${site ? ` · site ${site}` : ""}`);
