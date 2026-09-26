# Tara — Software Project Management

A self-hosted project management web app for running **locally inside the company**.
Plain HTML/CSS/JS frontend (Tailwind) · Node.js + Express backend · **SQLite by default
(zero setup), MySQL optional** · optional local **GitLab** integration · optional
automation through the local **Claude** CLI.

## Features

| # | Feature | Where |
|---|---------|-------|
| 1 | Define different kinds of software projects (web/mobile/desktop/api/data) | Dashboard → New Project |
| 2 | Attach documents to a project (spec/design/contract/report) | Project → Documents |
| 3 | Integrate with the local GitLab (repo, commits, pipelines, issues) | Project → GitLab |
| 4 | Status + progress bar per project (auto-derived from tasks) | Dashboard & Overview |
| 5 | Assign roles, responsibilities & reporting lines | Project → Team & Roles |
| 6 | Quality management plan / checklist (AI-assisted) | Project → Quality |
| 7 | AI-generated phased timeline (planning→execution→testing→delivery) | Project → Timeline → ✨ |
| 8 | AI resource requirement analysis (human/material/technology) | Project → AI Assistant |

Plus: username/password login, role-based admin, free-form "Ask Claude about this project".

## Local user roles

The local admin can add users and change their roles from **Account → Users**. Role
changes take effect on the next request, including for users who are already signed in.

| Role | Permissions |
|---|---|
| Admin | All actions, including user roles and project deletion |
| Manager | Create/edit projects; manage team, tasks, documents, quality, and AI actions |
| Contributor | Manage tasks, documents, and quality items |
| Viewer | Read projects and download documents |

Roles currently apply across all projects. Project-specific access and custom permission
sets are not yet implemented. At least one admin account must remain.

## Project layout

```
project-management-tara/
├── server/            Express API + MySQL + Claude/GitLab services
│   ├── routes/        auth, projects, documents, members, tasks, quality, gitlab, ai
│   ├── services/      claude.js (local CLI), gitlab.js (REST v4)
│   ├── middleware/    auth.js (JWT cookie sessions)
│   ├── schema.sql     database schema
│   └── scripts/init-db.js
├── public/            Frontend (index.html, js/, css/)
└── uploads/           Attached documents (git-ignored)
```

## Prerequisites

- **Node.js 20+** (uses the built-in `node:sqlite` module — no native build step)
- *(optional)* **MySQL 8+** — only if you switch `DB_DRIVER=mysql`
- *(optional)* **Claude CLI** installed and logged in, on PATH — for the AI features
- *(optional)* A **GitLab** personal access token (`api` scope) — for the GitLab tab

## Setup (default: zero-config SQLite)

```bash
cd server
npm install
npm start                     # starts on http://localhost:4000
```

That's it. On first start the app creates a local `data.db` file (SQLite) and seeds the
admin user automatically — no database server to install. To reset everything, stop the
server and delete `data.db`.

Schema upgrades run automatically on startup. Applied versions are recorded in
`schema_migrations`; new upgrades belong in `server/migrations.js`. Back up `data.db`
before upgrading an existing installation. MySQL users should run `npm run init-db`
after updating the application; the same migration runner is used there.

### Optional: use MySQL instead

```bash
cd server
cp .env.example .env          # set DB_DRIVER=mysql and the DB_* credentials
npm run init-db               # creates the schema + admin user in MySQL
npm start
```

Open **http://localhost:4000** and sign in with:

```
username: admin
password: admin123      # change it from the ⚙ Account menu after first login
```

### Configuration (`server/.env`)

| Key | Purpose |
|-----|---------|
| `PORT` | Server port (default 4000) |
| `JWT_SECRET` | Secret for signing login sessions — set a long random value |
| `DB_*` | MySQL host/port/user/password/name |
| `GITLAB_URL` | Base URL of your in-company GitLab, e.g. `http://172.30.207.51` |
| `GITLAB_TOKEN` | Personal access token with `api` scope (leave blank to disable GitLab) |
| `CLAUDE_CLI` | Command to run Claude (default `claude`; on Windows may be a full `.cmd` path) |
| `CLAUDE_MODEL` | Optional model override |

The **GitLab** and **Claude AI** tabs/buttons appear automatically only when those are
configured and reachable — the app works fully without them.

## How the integrations work

- **GitLab**: the backend calls the GitLab REST API v4 with your token. Link a Tara
  project to a GitLab project by its numeric ID (use the *Browse* picker). The GitLab
  tab then shows live repo info, recent commits, CI pipelines, and open issues.
- **Claude**: the backend spawns the local `claude -p "<prompt>"` CLI. No API key and no
  internet needed — it reuses your existing CLI login. Used to generate timelines,
  quality checklists, resource plans, and answer project questions.

## Notes

- Progress bars are computed automatically from task completion (`done / total`).
- Documents are stored on disk under `uploads/` with metadata in MySQL.
- This app is intended for a **trusted internal LAN**. If you expose it more widely,
  put it behind HTTPS and a reverse proxy, and rotate `JWT_SECRET`.
