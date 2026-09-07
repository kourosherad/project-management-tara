# Tara: personal and small-team setup guide

This guide describes this repository's Tara app. Start with one personal project, then use sample projects to try working with friends or colleagues.

## 1. Initial Setup

### Tool configuration

1. Open your deployment and sign in with the administrator credentials provided separately. For local development, install Node.js 22, run `npm ci` and `npm start` from the repository root, then visit `http://localhost:4000`. Local defaults are `admin` / `admin123` unless configured otherwise.
2. Open **Account** using the gear icon to change your password. In the Vercel demo, the initial administrator sign-in is checked by the server, then your workspace, additional accounts and password changes are saved in this browser. Clearing site data starts a fresh demo using the original deployment credentials.
3. Select **+ New Project**, enter a clear name, select a type, set start/due dates, and write the intended outcome and completion criteria in the description.
4. GitLab and Claude integrations are disabled in the browser demo. The app's core project, timeline, team, document and quality tools work without either integration.
5. Add a short project brief under **Documents**, then create the first tasks in **Timeline**.

### Workspace organization

Tara currently has one shared project list, without separate workspaces or folders. Use name prefixes such as `Personal — Website`, `Friends — Weekend app`, and `Work — Internal prototype` to organize it. Keep one project per outcome, rather than one project per task. Prefixes organize information; they do not restrict access.

Use the project description for scope, success criteria, working agreements and links. Record people in **Team & Roles**, execution work in **Timeline**, acceptance checks in **Quality**, and supporting files in **Documents**. Use project status deliberately: **planning**, **active**, **on hold**, **completed**, or **cancelled**.

### Permission and access settings

- Keep your own account as administrator. Use **Account → Users → + Add user** to create individual accounts for trusted collaborators, leaving **Admin** unchecked unless they need to manage accounts.
- All authenticated accounts in a workspace can currently view, edit and delete every project and its tasks, documents, members and quality items. There are no private projects, project invitations, read-only roles or enforced project membership permissions. Demo accounts created in one browser are available only in that browser; they do not invite friends on other devices.
- A **Team & Roles** entry is a description of a person's role, not a login account or an access grant. Adding someone there does not invite or notify them.
- The Vercel demo uses IndexedDB browser storage, so refreshing retains your tasks and files without depending on a particular server instance. Each browser/profile has a separate workspace. Clearing site data, browser eviction, or ending a private-browsing session can remove it. Use invented sample content. Demo login is a workflow simulation, not protection against someone with access to your browser or its developer tools. Reliable shared work requires persistent server storage and project access controls in a later update.

## 2. Task Assignment Best Practices

### Create clear, actionable tasks

1. Open a project and choose **Timeline → + Task**.
2. Start the title with a verb and a concrete output: `[P1] Verify sign-in and document the result`.
3. Choose a phase: **planning**, **execution**, **testing**, or **delivery**.
4. Enter a start date and an end date. The end date is the task's deadline.
5. Put one accountable person in **Assignee / team**. This is a text field, so use names consistently; it is not linked to login accounts and sends no assignment notification.
6. Set the initial status to **todo**, then save. Use **in progress**, **blocked**, and **done** as work changes.

Aim for tasks that take half a day to two days. Split larger work into independently verifiable results. Tara does not currently have task descriptions, checklists, dependencies or dedicated priority fields. Put longer acceptance criteria and dependency notes in a project brief under **Documents**, using the exact task title as the reference. Add verifiable release checks under **Quality**.

Example: `[P1] Verify sign-in on desktop and mobile`. Assignee: `Kourosh`; phase: `testing`; end: `2026-09-10`. Acceptance check in Quality: valid credentials open the dashboard, invalid credentials show an error, and logout returns to sign-in. Verification method: manual browser test plus automated API tests.

### Assignment criteria and workload balancing

Assign work according to skill, availability, context and interest. Agree ownership before entering someone's name. List reviewers or helpers in **Team & Roles → Responsibility**, while retaining one task owner. For solo use, assign work to yourself.

At the weekly review, compare active tasks and overlapping dates for each name in the Timeline table. Limit each person to one or two tasks in progress. Plan about 70–80% of available time, leaving room for review and unexpected work. Tara has no capacity calculation or workload chart, so confirm availability directly and rebalance manually. For a handoff, agree the new owner, edit the task, and notify both people in your group chat.

### Priorities and deadlines

Use a title prefix as a lightweight priority convention:

- **[P0]**: work stopping the agreed test or release; address immediately.
- **[P1]**: needed for the current weekly goal.
- **[P2]**: valuable work after the current goal.
- **[P3]**: optional improvement or future idea.

Priority expresses importance; the deadline expresses a commitment. Reserve hard deadlines for real events. Sequence prerequisites first and allow review time before the project due date. If a deadline slips, agree a revised date and record the reason in the shared weekly report; Tara does not maintain a visible task-change audit trail. Do not mark incomplete work done to improve the progress bar.

## 3. Progress Tracking Methods

### Status update cadence

- **Personal daily check, 5 minutes:** choose the next task, update its status and end date if needed, and resolve or record blockers.
- **After a meaningful change:** the owner updates the task. Mark it done only after the acceptance check passes.
- **Small-team weekly review, 15–20 minutes:** review finished work, blockers, upcoming deadlines, capacity and the next deliverable. Upload a dated report for decisions that need a record.
- **Before delivery:** review all release tasks, confirm Quality checks and attach the final deliverable or report before setting the project to completed.

### Visual progress indicators

The dashboard shows total, active and completed projects, average project progress, and per-project progress bars. Project progress is the rounded percentage of tasks marked **done** out of all tasks; all tasks have equal weight, blocked tasks remain incomplete, and a project with no tasks shows 0%. The dashboard average weights projects equally. Project status is set separately; completing every task does not automatically set the project status to completed.

Use the Timeline table's phases, dates and colored status badges to review work. Overview also summarizes project progress, people and quality results. Tara currently has no Kanban board, Gantt chart, burndown chart, automatic overdue reminder or workload dashboard. Use the existing table during the trial and record whether a board would improve your workflow before building one.

### Milestones and deliverables

Represent milestones as explicit tasks such as `[P1] Milestone: test release accepted`, usually in the delivery phase, with the agreed deadline. This is a naming convention, not a special milestone object. It counts as one task in progress calculations.

For each milestone, record the deliverable, reviewer and acceptance criteria in the project brief. Put verification criteria in **Quality**, with a method and notes. Attach evidence in **Documents**. During review, check every prerequisite manually because Tara does not enforce task dependencies. Keep milestone tasks few so they do not inflate progress.

## 4. Team Collaboration & Communication

### Channels within the tool

Use the project description for stable context, **Team & Roles** for ownership and responsibilities, **Timeline** for current commitments, **Quality** notes for verification results, and **Documents** for briefs and decisions. Tara has no built-in chat, task comments, mentions, activity feed, email invitations or push notifications.

Choose one external conversation channel per group, such as your existing group chat. Include the exact Tara project and task title in messages. After discussion, update Tara's task or the project's decision document so the current state is easy to find.

### Updates and notifications

Agree to send a direct message when a task is assigned or handed over, a blocker needs help, a deadline changes, or a deliverable needs review. Routine progress can wait for the daily/weekly check. A useful update is: `Project / task — completed since last update — next action — blocker — help needed by date`.

The Vercel demo does not synchronize across browsers: friends can independently test it, then share feedback through your group chat. In the local server version, refresh or reopen a project before reviewing someone else's changes. Avoid simultaneous edits, including multiple demo tabs; the app has no conflict-resolution interface, and the last saved edit can overwrite earlier changes.

### Files and documentation

Upload files under **Documents** using **Specification**, **Design**, **Contract**, **Report**, or **General**. Use names such as `tara-test-brief-v1-2026-09-08.pdf` and `weekly-review-2026-09-11.md`. Put the owner, last-updated date and approval state inside each document. Keep one clear current version and identify superseded copies explicitly; Tara has no document version history.

The Vercel demo accepts files up to **3 MB**, stored in this browser; local server mode accepts **50 MB**, stored on the server's disk. Use the signed-in Documents view to download files. Keep original files outside the demo because browser storage is disposable. For larger files, record a link in the project brief and manage access in the service that holds the file. Before real use, add persistent database/file storage, backups and project-level permissions.

## 5. Sample Task Structure

Example project: **Personal — Tara test release**, with a one-week trial. Replace the sample collaborators and dates with your actual availability. Enter each assignee in **Assignee / team** and each deadline in the task's **End date**.

| Task | Assignee | Deadline |
|---|---|---|
| [P1] Define the trial scope and acceptance checks | Kourosh | 2026-09-08 |
| [P1] Create a sample project and five actionable tasks | Kourosh | 2026-09-09 |
| [P1] Verify sign-in, task editing and progress updates | Friend — replace with name | 2026-09-10 |
| [P1] Test document upload and download with sample files | Colleague — replace with name | 2026-09-10 |
| [P2] Record confusing screens and proposed improvements | Friend — replace with name | 2026-09-11 |
| [P1] Review findings and prioritize the next update | Kourosh | 2026-09-12 |
| [P1] Milestone: accept the trial and save the review externally | Kourosh | 2026-09-13 |

Create tasks manually in Timeline; this table is a demonstration, not an automatic import. Treat the last task as complete when the trial report exists outside the temporary demo and the next maintenance priorities are agreed.
