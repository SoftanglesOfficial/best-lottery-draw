# Release Checklist — Best-12

**Product:** Best12 Desktop (`best12-desktop`)  
**Primary platform:** Windows x64 (Squirrel)  
**Updated:** 2026-07-24

---

## 1. Versioning

1. Bump `version` in `package.json` (semver: patch for hotfix, minor for features, major for breaking schema/IPC).
2. Note the version in `Electron-App-Vault/Changelog/` and `docs/PRODUCTION_READINESS.md`.
3. Tag after a successful make: `vX.Y.Z` (optional for private LAN deploys).

---

## 2. Pre-release validation (required)

On a clean tree (or CI green):

```bash
npm ci
npm run lint
npm test
npm run typecheck   # warn-only until withSession typing cleaned
npm run test:e2e
# Quit any running best-12.exe, then:
Remove-Item -Recurse -Force out\best-12-win32-x64 -ErrorAction SilentlyContinue
npm run package
npm run make
```

Pass criteria:

- All verify scripts exit 0
- Playwright e2e exit 0 (or known flaky cases documented)
- `out/make/squirrel.windows/x64/` contains Setup.exe / nupkg
- No accidental secrets in the commit (`config.json` is user-local, not in repo)

---

## 3. Build & artifacts

| Command | Output |
|---------|--------|
| `npm run package` | `out/best-12-win32-x64/best-12.exe` |
| `npm run make` / `npm run build` | Squirrel installer under `out/make/squirrel.windows/x64/` |

**Windows EPERM:** If package fails deleting `out/`, quit the running app and Explorer handles, delete `out/best-12-win32-x64`, retry.

---

## 4. Deployment (LAN)

### Server PC

1. Install PostgreSQL 16; create DB (e.g. `best12_prod`).
2. Open firewall: **5432/TCP**, **41234/UDP**.
3. Install Best-12 → Settings → connect to local Postgres → **Setup Tables & Admin**.
4. Login `admin` / `admin123` → **forced password change** (required).
5. Sign in → Settings → LAN Mode → **Server** → Start Broadcasting (manager+).
6. Take a first backup (Settings → Backup) before production traffic.

### Client PC

1. Install same Best-12 build.
2. Settings (pre-login OK) → **Auto-Discover Server** → Save & Connect.
3. Login with company-scoped credentials (not the seed password).

---

## 5. Backup & migration

- **Backup:** Settings → Backup & Restore (company-scoped JSON). Prefer nightly auto-backup (23:00 pref).
- **Before upgrade:** Backup each company; copy Postgres dump (`pg_dump`) on the server.
- **Schema:** App applies `MIGRATION_SQL` on connect/setup — run one server first, then clients.
- **Rollback:** Reinstall previous Squirrel build; restore Postgres dump + latest company backup if data migrated badly.

---

## 6. Environment requirements

| Component | Requirement |
|-----------|-------------|
| OS | Windows 10/11 x64 |
| DB | PostgreSQL 16 on LAN |
| Network | Trusted LAN; firewall rules above |
| Code signing | Optional for private LAN; required before public update feed |

---

## 7. Operational readiness

### Logging / crashes

- Main process: Electron default + console in dev (`npm start`).
- Renderer: `ErrorBoundary` catches React tree failures.
- On crash: collect `out/` install path, Postgres logs, and user-described repro; restore from backup if data integrity suspect.

### Troubleshooting

| Symptom | Check |
|---------|--------|
| Cannot login | DB connected? Seed password forces change UI |
| Session lost after restart | `safeStorage` available? Re-login |
| Client cannot discover | Server broadcasting? UDP 41234 open? |
| Package EPERM | Quit `best-12.exe`, clear `out/` |
| Cross-company access denied | Expected — company assert on schemes/txns |

### Recovery

1. Stop clients.
2. Restore Postgres from `pg_dump`.
3. Optionally restore company backup via Settings (manager+).
4. Restart server app; confirm broadcast; reconnect clients.

---

## 8. Security model (LAN) — operator note

- **Public (no session):** DB connect/status/test/setup, prefs-get, LAN status + discover, auth login/logout/restore.
- **Authenticated (manager+):** LAN set-mode / start/stop broadcast.
- **Discovery is unsigned** — treat LAN as trusted; do not expose UDP 41234 to the internet.
- Default admin password cannot remain: login with `admin123` forces change; change rejects reuse of `admin123`.
