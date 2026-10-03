# Deploying Oak & Line on client-owned accounts

```
Visitor ──► Netlify (website files)  ──/api, /uploads, /sitemap.xml──►  Render (Node API + SQLite + photos on a disk)
            oakandline.in                                              oakline-api.onrender.com
```

Every account below must be created **with the business's email** (e.g. `studio@oakandline.in`), not a developer's. A developer can be invited as a team member and removed later.

| Account | Purpose | Cost (approx.) |
|---|---|---|
| GitHub | Holds the code; Netlify and Render deploy from it | Free |
| Render | API, database, uploaded photos | Starter instance + 5 GB disk ≈ US$8/month |
| Netlify | Public website + admin screens | Free tier is enough |
| Domain registrar | `oakandline.in` | Yearly |

Alternatives to Render: Railway or Fly.io (use the included `Dockerfile` and attach a volume at `/data`), or any VPS with Docker.

---

## Project layout

The repository root contains the Netlify and Render configuration, with frontend and backend source separated into `frontend/` and `backend/`. Keep the root `package.json`, lockfile, `shared/`, and `script/` when uploading the project; both hosting providers build from the repository root.

## 1. GitHub (≈5 min)
1. Create a GitHub account with the business email → New repository → `oak-line-website` → **Private**.
2. Upload the project (or `git remote add origin … && git push -u origin main`).
   `data/`, `.env` and `node_modules/` are already excluded by `.gitignore`.

## 2. Render — API, database and photos (≈10 min)
1. Sign up at render.com with the business email and connect the GitHub account.
2. **New → Blueprint →** choose the repo. Render reads `render.yaml` and proposes the service `oakline-api` with a 5 GB disk at `/var/data`.
3. Fill in the prompted values:
   - `ADMIN_EMAIL`: the owner's login email
   - `ADMIN_PASSWORD`: a strong password (used only on first boot; change it later in the admin)
   - `PUBLIC_SITE_URL`: `https://www.oakandline.in` (or the Netlify URL for staging)
   - `AUTH_SECRET` is generated automatically.
4. Click **Apply**. When the deploy finishes, open `https://<your-service>.onrender.com/api/health`. It should show `{"ok":true}`.
5. Copy that origin (e.g. `https://oakline-api.onrender.com`). You need it for Netlify.

> The Render service can also serve the full website on its own at its onrender.com address, which is handy as a backup or staging check.

## 3. Netlify — the website (≈5 min)
1. Sign up at netlify.com with the business email → **Add new site → Import from Git →** choose the repo.
2. Build settings are read from `netlify.toml` (command `npm run build:netlify`, publish `dist/public`).
3. **Site configuration → Environment variables → Add**: `API_ORIGIN` = the Render origin from step 2.5.
4. Deploy. The build fails with a clear message if `API_ORIGIN` is missing.
5. Test the Netlify URL: home page → Work → a project → Contact (send a test enquiry) → `/admin` login.

## 4. Domain (≈15 min + DNS time)
1. Netlify → **Domain management → Add domain** → `oakandline.in` and `www.oakandline.in`. Follow Netlify's DNS instructions at the registrar. HTTPS is issued automatically.
2. Update `PUBLIC_SITE_URL` on Render to the final domain, then redeploy Render.

## 5. First-day checklist (in /admin)
- [ ] Website Content: real WhatsApp number (with country code, e.g. 9198…), phone, email, studio address, Instagram
- [ ] Cities & Routing → Managers: add each city manager's name and WhatsApp number; assign cities
- [ ] Projects: add real projects and photos; unpublish or delete the demo projects
      (or set `SEED_DEMO_PROJECTS=false` on Render *before the first deploy* to start empty)
- [ ] Website Content → Founders: confirm names, roles and portraits
- [ ] Send a test enquiry from a phone and check it opens WhatsApp to the right person

## Backups
The whole business database is two things on the Render disk: `/var/data/oakline.db` and `/var/data/uploads/`.
- Render keeps daily disk snapshots (Disk → Snapshots); you can restore from there.
- For an extra copy: Render Shell → `cd /var/data && tar czf backup-$(date +%F).tgz oakline.db uploads`, then download it.

## Handover / changing developers
- Developers are added as **members** on GitHub, Render and Netlify, never as owners. Remove them when the work ends.
- To lock out every logged-in admin session, change `AUTH_SECRET` on Render and redeploy.
- Admin passwords are stored only as scrypt hashes; nobody can read them, including developers.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Site loads but projects/enquiries fail | `API_ORIGIN` on Netlify is wrong or Render is asleep/failed. Open `<API_ORIGIN>/api/health` |
| Netlify build: "API_ORIGIN must be set" | Add the variable (step 3.3) and redeploy |
| Render boot error "AUTH_SECRET / ADMIN_PASSWORD must be set" | Add the missing variable in Render → Environment |
| Photos disappear after a redeploy | The disk isn't attached. `DATABASE_PATH`/`UPLOAD_DIR` must point inside `/var/data` |
| Large photo batches fail | Upload fewer at a time; each photo must be under 15 MB |
