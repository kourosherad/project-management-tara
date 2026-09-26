# Tara ALM gap analysis (2026-09-26)

## Current system

Tara is an Express 4 API and a single page interface written in plain HTML, CSS, and JavaScript. SQLite (`node:sqlite`) is the default store; MySQL 8 is optional. The same route SQL is used for both. Login uses bcrypt password hashes and a seven-day JWT in an HTTP-only cookie; a bearer token is also accepted. The only authorization distinction is `is_admin` for user creation and listing. There are no project-level permissions.

The implemented records are users, projects, documents, project members, timeline tasks, and quality checklist items. A project can link to one GitLab project. GitLab activity is read live (commits, pipelines, issues), but is neither imported nor linked to Tara tasks. Optional Claude CLI actions create tasks or checklist items and return advice. Progress is computed from completed tasks. The frontend has dashboard, overview, timeline, team, documents, quality, GitLab, and AI views. There is no background job, event queue, notification service, reporting beyond dashboard counts, migration framework, automated test suite, or deployment manifest. The README describes a local manual deployment.

## Gaps and risk order

| Priority | Finding | Evidence / impact | Incremental response |
| --- | --- | --- | --- |
| Critical | Project data has no access boundary | All project, task, member, document, quality, GitLab, and AI routes require login only. Any user can edit or delete any project and download its documents. | Add account-linked project membership, project roles, and a shared project access check; apply it to every route, including indirect record IDs. |
| Critical | Unsafe bootstrap and session defaults | An empty database seeds a known `admin/admin123` account; JWT signing falls back to a known string. Login has no rate limit, cookies lack `secure`, and cookie-authenticated writes have no CSRF defense. | Require initial administrator credentials and a strong session secret outside development; add login throttling, secure cookie configuration, and CSRF/origin protection. Provide an upgrade path for existing installations. |
| High | No durable ALM traceability | Tasks have a title, phase, dates, team string, and status only. There are no requirements, typed work items, relations, test cases/results, changes, releases, deployments, or audit evidence. GitLab data is only displayed. | Introduce one typed work-item core with parent and relation records, then add lifecycle records and external references in small migrations. Keep current tasks usable during transition. |
| High | Schema changes cannot upgrade existing installations | `CREATE TABLE IF NOT EXISTS` runs at startup but does not add columns or indexes to existing tables. SQLite and MySQL schemas are maintained separately. | Add numbered, idempotent migrations and schema version tracking for both drivers before extending tables. Verify upgrades against a copy of existing data. |
| High | Missing integrity checks | Most status fields are unrestricted text; project progress is unconstrained; dates can be reversed; project members are free text; external project IDs and work identifiers lack uniqueness; few lookup indexes exist. | Validate at the API boundary and add database constraints/indexes where both drivers support them. Use explicit foreign keys for account-linked responsibilities. |
| High | Destructive operations leave inconsistent evidence | Project deletion cascades through records; document deletion removes the file before database deletion; document upload can leave an orphan file if metadata insertion fails. No audit log or retention policy exists. | Add audit events and soft delete/retention for governed records; make file operations recoverable. |
| High | Service integration is tightly coupled to requests | GitLab calls run directly in HTTP requests, use one global personal token, have no timeout/pagination/sync state, and do not persist source IDs. AI writes generated rows one at a time without transaction or review. | Define integration credentials and sync boundaries; persist external references with source IDs and timestamps; add bounded jobs and human review for generated plans. |
| Medium | SQL and business rules live in routes | Progress calculation is exported from the projects router and imported by tasks; routes directly execute SQL. There is no shared transaction abstraction. | Extract only cross-route policies and transactional operations as new features require them. Avoid a wholesale rewrite. |
| Medium | Frontend is one large module | `public/js/app.js` contains all views, form handling, and navigation. Inline handlers and a full project JSON object embedded in an HTML attribute complicate safe extension. | Split new ALM screens into focused modules and pass IDs through events; preserve existing pages during migration. |
| Medium | Operational controls are absent | No tests, backups/restore procedure, structured logging, health dependency check, deployment config, or environment-specific configuration validation. Tailwind is fetched from a CDN. | Add smoke and migration tests, backup/restore guidance, structured request logs, and a pinned local frontend asset for isolated networks. |

## Domain model direction

Preserve `projects`, `users`, existing `tasks`, `documents`, and `quality_items` initially. Add optional organization/portfolio/program parents and project metadata through migrations. Link project people to `users` while retaining free-text stakeholders for external parties. Model WBS, work package, epic, feature, story, task, subtask, and bug as **typed work items** with an optional parent, rather than separate duplicate tables. Keep phase as a project planning dimension; allow work items to reference one phase. Enforce same-project parentage and prevent hierarchy cycles in the service layer. Use a separate relation table for non-hierarchical links such as implements, blocks, verifies, and fixes.

Requirements should have stable project-scoped identifiers and version/history records. Tests, executions, change requests, releases, deployments, and evidence need their own lifecycle records because their approval and retention rules differ from work items. Connect them through typed, auditable relations. Store GitLab commit/MR/pipeline references with provider IDs and URLs rather than treating live GitLab lists as the traceability source. Maintain a traceability query that can traverse these links in both directions.

The hierarchy must be optional: a small Kanban project can use project → task, while a governed project can use program → project → phase → WBS → work package → epic → story → task. Do not turn every level into a mandatory field.

## Delivery sequence

1. Establish migration/versioning and upgrade tests for both databases; preserve existing rows.
2. Secure bootstrap, sessions, and project-scoped authorization before adding sensitive evidence.
3. Extend project definition (stable code, owner, manager, technical lead, account-linked team and stakeholders) and expose it in the existing UI.
4. Introduce typed work items and relations, then migrate current tasks without changing their visible behavior.
5. Add requirements and bidirectional traceability; add test cases/results and change controls.
6. Add release/deployment/evidence records and GitLab/ITSM synchronization with provenance, retry, and review.
7. Add scheduling, reports, audit views, notifications, and operational deployment controls.

Each stage should ship with a data upgrade path, API authorization checks, and focused tests. Existing task and project screens remain available until their replacements cover the same behavior.
