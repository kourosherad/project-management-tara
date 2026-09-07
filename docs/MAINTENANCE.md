# Maintenance handoff — September 7, 2026

Live demo: https://tara-demo.vercel.app (redirects to `/index.html`).

The repository was cloned to `C:/Projects/Tara`; the maintenance changes are on branch `maintenance/vercel-demo`. Vercel project `tara-demo` was published through the authenticated CLI; Vercel could not connect the GitHub repository, so pushes do not automatically deploy it. Future deployments can use `npx vercel --prod` from this linked directory. Connect GitHub through the project's settings when repository access is available.

Administrator credentials are in the ignored local `demo-credentials.txt` file. The signing secret and initial password are also configured as Vercel Production secrets. Do not upload the credential file or commit it. Preview secrets must be configured separately before using a preview environment.

## Completed changes

- Removed MySQL code, dependency, schema and configuration; retained local SQLite.
- Added root npm workspace, lockfile, Node.js 22 requirement and Vercel Express entry point.
- Updated Express to version 5 for rejected async route handling.
- Added explicit deployment secrets, secure hosted cookies and disabled local Claude on Vercel.
- Added browser demo persistence for tasks, projects, accounts and files. Refreshing retains data without depending on a particular function instance. Different browsers remain isolated.
- Added visible demo limitations, smaller demo uploads and clearer assignee wording.
- Wrote the five-part usage guide and deployment instructions.

## Verification

- `npm run build` passed.
- `npm test`: 12 tests passed, covering the server and browser demo.
- npm install audit reported zero vulnerabilities for the app dependency tree.
- Live home page, frontend script and health endpoint returned successful responses.
- Live browser: signed in, created `Personal — Tara trial`, added three tasks with owners and deadlines, verified progress at 33%, refreshed and confirmed all tasks persisted.
- The sample project is in the Codex browser's demo workspace. Another browser starts with an empty workspace.

## Next shared-use milestone

Add persistent server data and file storage, project-level permissions, and backups before using Tara as a shared system with friends or colleagues. The current hosted version is an independent interface trial per browser. The existing local server version supports a common database but grants every signed-in user access to all projects.
