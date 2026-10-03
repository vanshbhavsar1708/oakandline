// Generates responsive WebP derivatives for static brand imagery (hero, services, owners).
import sharp from "sharp";
import fs from "node:fs";
const files = ["hero","svc-kitchen","svc-wardrobe","svc-living","svc-bedroom","svc-fullhome","owner-aarav","owner-riya","studio"];
for (const f of files) {
  const src = `assets-src/${f}.png`;
  if (!fs.existsSync(src)) { console.log("missing", f); continue; }
  for (const w of [640,1280,2000]) {
    await sharp(src).resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(`frontend/public/images/${f}-${w}.webp`);
  }
}
await sharp("assets-src/hero.png").resize(1200, 630, { fit: "cover" }).jpeg({ quality: 80 }).toFile("frontend/public/images/og.jpg");
console.log("done");
