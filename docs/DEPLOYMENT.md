# Vercel temporary demo

The server uses SQLite only. MySQL support and its schema are removed; no existing database is migrated or deleted. Local SQLite remains persistent on your computer. On Vercel, the frontend stores demo workspaces in browser IndexedDB to avoid inconsistent data across temporary function instances.

## Deploy

1. Install Node.js 22 and run `npm ci`, `npm run build`, and `npm test` from the repository root.
2. Import the repository in Vercel, or run `npx vercel link`. Use the repository root, Express framework, Node.js 22.x, install command `npm ci`, build command `npm run build`, and no output-directory override.
3. Add `JWT_SECRET` (random, at least 32 characters) and `ADMIN_PASSWORD` (unique, at least 12 characters) to the intended Preview/Production environment. Optionally set `ADMIN_USERNAME`; the default is `admin`. Do not commit secrets.
4. `vercel.json` enables `TARA_DEMO=true`. Do not configure `SQLITE_FILE` or `UPLOAD_DIR` on Vercel: their demo defaults use the writable OS temporary directory.
5. Run `npx vercel` for a preview, or `npx vercel --prod` to update the project's stable URL. Explicitly set these secrets for each environment you deploy to.
6. Verify `/api/health` returns `ok: true`, `demo: true`, and `storage: "temporary"` (the server's storage mode). Open the home page, which redirects to the CDN-served `/index.html`. Sign in, create a sample task, change it to done, refresh, and try an upload under 3 MB. The browser demo routes workspace operations to IndexedDB instead of the server API.

The Express app is exported from root `app.js`; `server/index.js` starts a port listener only for local use. Requests await a shared initialization promise before touching the database. Node's built-in SQLite avoids native npm database binaries. The SQL schema is bundled through a literal file URL. Static assets remain in `public/`.

## Demo limitations

- Each browser/profile has its own IndexedDB workspace. Refreshing retains its data. Site-data clearing, browser storage eviction and private-browsing cleanup can delete it. There is no synchronization, backup or shared workspace between devices.
- The first sign-in validates the initial administrator against the server. Subsequent demo logins, account creation and password changes use browser-stored accounts with salted PBKDF2 hashes. The active demo session is scoped to the tab. Clearing site data resets this bootstrap. Browser-local login is a workflow simulation, not a security boundary against someone who can inspect or alter browser storage.
- The server's direct API still uses temporary SQLite and uploads per function instance; it is not suitable for shared data or API clients. The browser demo does not use those CRUD endpoints. Initial admin credentials come from the deployment environment when each server instance initializes.
- All signed-in accounts within a workspace can edit every project. There are no private projects or read-only collaborators. Demo accounts cannot sign in on another device. Use sample data only.
- Cookies are HTTP-only, SameSite=Lax, and Secure on Vercel. Missing deployment secrets fail startup instead of exposing default credentials.
- GitLab and Claude are disabled in the browser demo. Claude CLI is always disabled on Vercel. Locally it requires explicit `CLAUDE_ENABLED=true` and an installed CLI. GitLab remains optional in the local server version.
- Browser demo files are stored as Blobs in IndexedDB, capped at 3 MB each. Direct demo API uploads have the same cap, below Vercel's function request/response payload limit. Local mode allows 50 MB. Large shared files need external object storage later.
- This update does not add durable collaboration, automatic notifications, scheduled backups or ongoing automated maintenance.

## Maintain and roll back

Keep changes on a maintenance branch. Run `npm ci`, `npm run build`, and `npm test` before publishing. Test previews with sample data before replacing the stable deployment. Use Vercel's deployment history to promote a previously verified version if a release fails; rolling back code does not recover temporary data.

The next shared-use update should add persistent hosted storage, durable file uploads, project-level authorization, and backups. Then consider task comments, notifications, priority/assignee fields and a board based on trial feedback.

References: [Vercel Express deployment](https://vercel.com/docs/frameworks/backend/express), [function limits](https://vercel.com/docs/functions/limitations), [Vercel deployment CLI](https://vercel.com/docs/cli/deploy).
