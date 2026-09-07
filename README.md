# Tara — Project Management

A personal and small-team project tracker built with plain HTML/CSS/JavaScript, Express and SQLite. Features include projects, timeline tasks, named assignees, team roles, documents, quality checks, task-derived progress and administrator-managed accounts.

## Quick start

Use **Node.js 22.x** (required for built-in `node:sqlite`). From the repository root:

```sh
npm ci
npm start
```

Open http://localhost:4000. Local defaults are `admin` / `admin123`; change the password in Account. Copy `server/.env.example` to `server/.env` to configure secrets, initial credentials, storage or optional integrations. Configuration works whether you start from the root or from `server/`.

Local data lives in `data.db` and `uploads/`. MySQL is no longer required or supported; existing MySQL data is not migrated by this update.

## Vercel trial

The root configuration deploys an Express app with a **separate demo workspace in each browser**. Set `JWT_SECRET` and `ADMIN_PASSWORD` in Vercel before deploying. Use the repository root and Node.js 22.x. See [deployment instructions](docs/DEPLOYMENT.md).

The first admin login is verified by the server, then demo projects, accounts and files are saved in IndexedDB in your browser. Refreshing preserves them; clearing site data removes them. Different browsers do not share data. All accounts within a workspace can access every project. Use sample data only; reliable shared work needs persistent server storage and project permissions. The app displays this limitation before and after login. Demo uploads are limited to 3 MB. GitLab and Claude are disabled in the browser demo.

## Using Tara

Read the [complete personal and small-team guide](docs/USER_GUIDE.md) for initial setup, access, task assignment, priorities, progress reviews, collaboration practices and a sample task table. Role descriptions are separate from login accounts; they do not enforce project access.

## Development

```sh
npm run dev
npm run build
npm test
```

The build validates JavaScript syntax; the frontend is served directly from `public/`. Tests cover cold-start initialization, login, admin permissions, CRUD, progress, uploads and limits, disabled integrations, error handling, deployment configuration, browser persistence and isolation.

- `app.js`: Vercel entry point
- `server/app.js`: Express app shared by local and hosted entry points
- `server/index.js`: local listener
- `server/config.js`: environment and storage configuration
- `server/db.js`, `server/schema.sqlite.sql`: SQLite persistence and initialization
- `public/`: browser frontend
- `tests/`: API and configuration tests
- `docs/`: usage and deployment guides

GitLab requires `GITLAB_URL` and `GITLAB_TOKEN`. Local Claude requires `CLAUDE_ENABLED=true` and an installed, authenticated CLI; its availability and network needs depend on your Claude configuration.
