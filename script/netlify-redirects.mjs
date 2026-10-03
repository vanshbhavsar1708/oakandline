// Runs after `vite build` on Netlify. Routes the API to its serverless function and writes the sitemap URL.
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("dist/public");
fs.writeFileSync(
  path.join(out, "_redirects"),
  [
    "# Generated at build time by script/netlify-redirects.mjs — do not edit in dist.",
    "/api/*       /.netlify/functions/api/api/:splat       200",
    "/sitemap.xml /.netlify/functions/api/sitemap.xml      200",
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
console.log(`[netlify] API handled by the Netlify Function${site ? ` · site ${site}` : ""}`);
