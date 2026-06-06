# Best-12 Installation Guide

## Server PC Setup (One PC only)

1. Install PostgreSQL 16 for Windows
2. Create database: `best12_dev`
3. Run `Best-12-Setup.exe`
4. Open app → Settings → Database → enter localhost config → Save & Connect
5. Click **Setup Tables & Admin**
6. Settings → Database → LAN Mode → select **This PC is the Server**
7. Click **Start Broadcasting**

## Client PC Setup (All other PCs)

1. Run `Best-12-Setup.exe`
2. Open app → Settings → Database
3. Click **Auto-Discover Server**
   - If found: IP fills automatically → Save & Connect
   - If not found: enter server IP manually
4. Login with `admin` / `admin123`

## Default Login

- Username: `admin`
- Password: `admin123`

Change password immediately after first login (Settings → User Profile).

## Firewall Setup (on Server PC)

Allow inbound connections on:

- Port **5432** (PostgreSQL)
- Port **41234 UDP** (auto-discovery broadcast)

## Development

```bash
npm start
```

## Production Build

```bash
npm run build:icons   # optional — generate icon assets
npm run build
```

The installer will be in: `out/make/squirrel.windows/x64/`
