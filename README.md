# Oak & Line Interiors — Website, Admin & Material Match

A portfolio and enquiry website for Oak & Line Interiors, with an owner-friendly admin portal. It is not an online store: the site exists to build trust, show finished homes and bring in consultation requests.

## What's inside

| Area | Route | What it does |
|---|---|---|
| Home | `/` | Hero, services, studio/about, founders, featured work, final CTA |
| Work | `/work` | Editorial portfolio with category filters (managed in admin) |
| Project | `/work/:slug` | Story, facts (location, category, area, year), full gallery, lightbox |
| Contact | `/contact` | Validated consultation form → stored enquiry → city-routed WhatsApp message |
| Game | `/play` | "Material Match", an on-brand memory game using the studio's material palette |
| Admin | `/admin` | Login, dashboard, enquiries, projects + photos, categories, services, cities & routing, website content |
| SEO | `/sitemap.xml`, `/robots.txt` | Built from published projects |

## Architecture

```
frontend/          React + Vite + Tailwind (public site, admin, game) → static files (dist/public)
backend/           Express API, admin auth, image processing
netlify/functions/ serverless API deployed alongside the static site
supabase/          SQL setup for Supabase Postgres and the public image bucket
shared/            Zod schemas + WhatsApp message builder shared by both sides
```

- **Database:** Supabase Postgres; run `supabase/setup.sql` once in the Supabase SQL Editor. The private service-role key is used only by the Netlify Function.
- **Images:** each upload is validated (max 15 MB), auto-rotated, stripped of metadata and saved to Supabase Storage as WebP at 640/1280/2000 px. The admin browser uploads directly to a short-lived, per-file signed URL so large images never pass through the Netlify Function.
- **Enquiry routing:** city override WhatsApp → the city's assigned active manager → the head-office number in Website Content. Disabled cities disappear from the form instantly. "Other" lets visitors type a city, which goes to head office.
- **Security:** scrypt-hashed passwords, signed 8-hour session tokens kept in memory (not localStorage), every `/api/admin/*` route protected, rate-limited login and enquiry endpoints, a honeypot field, Zod validation on every write, and security headers. The frontend uses only the public Supabase anon key; the service-role key and admin password are never bundled.

## Local development

```bash
npm install
copy .env.example .env      # fill in Supabase URL, keys and admin credentials
npm run dev                 # http://localhost:5000  (admin: /admin)
```

The first API request creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. There is no production default password; set `AUTH_SECRET` too.

## Ownership

Everything is set up so the business owns it, not the developer:

1. Create the **GitHub repo, Netlify site and Supabase project under the client's own accounts** (or transfer them).
2. Private secrets live only in Netlify environment settings. The public anon key is intended to appear in the frontend bundle; the service-role key must never use a `VITE_` prefix.
3. All business content (headline, founders, phone, WhatsApp, cities, managers, services, projects) is edited in `/admin`. Code changes aren't needed to add a city or a manager.

### Replacing the founders / brand assets
Admin → Website Content → Founders: change names, roles, bios and focus areas, and upload new portraits. To swap the logo, edit `Logo` in `frontend/src/components/site/primitives.tsx` (SVG) and `frontend/public/favicon.svg`. Static images live in `frontend/public/images/` (regenerate sizes with `node script/static-images.mjs`).

## Deployment
Step-by-step setup (Supabase → GitHub → Netlify → domain) is in **[DEPLOYMENT.md](DEPLOYMENT.md)**. The included `netlify.toml` deploys the frontend and API function together.

## Pre-launch checklist
- [ ] Set real WhatsApp numbers (Website Content + each manager)
- [ ] Replace demo projects/photos with real work, and unpublish the demos
- [ ] Change the admin password and keep `AUTH_SECRET` private
- [ ] Run `supabase/setup.sql` and set Netlify environment variables from `.env.example`
- [ ] Set `PUBLIC_SITE_URL` and update `robots.txt` sitemap URL

## Running on Windows / your own computer
1. Install **Node.js 20 LTS or newer** from nodejs.org.
2. Unzip the project, open the folder in VS Code, and open a terminal there.
3. `npm install` (first time only), then `npm run dev`.
4. Open http://localhost:5000 (site) and http://localhost:5000/admin (admin).
Edits to files under `frontend/src` refresh the browser automatically; restart `npm run dev` after editing `backend/` files.
