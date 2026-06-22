# Tara — Software Project Management

A self-hosted project management web app for running **locally inside the company**.
Plain HTML/CSS/JS frontend (Tailwind) · Node.js + Express backend · MySQL database ·
optional local **GitLab** integration · optional automation through the local **Claude** CLI.

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

- **Node.js 18+**
- **MySQL 8+** running locally (or reachable on the LAN)
- *(optional)* **Claude CLI** installed and logged in, on PATH — for the AI features
- *(optional)* A **GitLab** personal access token (`api` scope) — for the GitLab tab

## Setup

```bash
cd server
npm install
cp .env.example .env          # then edit .env (DB password, GitLab token, etc.)
npm run init-db               # creates the DB, tables, and a default admin user
npm start                     # starts on http://localhost:4000
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
