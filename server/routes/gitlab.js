import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as gitlab from '../services/gitlab.js';

const router = express.Router();
router.use(requireAuth);

router.get('/status', (req, res) => {
  res.json({ configured: gitlab.gitlabConfigured() });
});

// Browse GitLab projects to link one to a Tara project (feature 3).
router.get('/projects', async (req, res, next) => {
  try {
    res.json(await gitlab.listProjects(req.query.search || ''));
  } catch (e) { next(e); }
});

// Live repo activity for a linked GitLab project id.
router.get('/projects/:id/activity', async (req, res, next) => {
  try {
    const [project, commits, pipelines, issues] = await Promise.all([
      gitlab.getProject(req.params.id),
      gitlab.getCommits(req.params.id).catch(() => []),
      gitlab.getPipelines(req.params.id).catch(() => []),
      gitlab.getIssues(req.params.id).catch(() => []),
    ]);
    res.json({ project, commits, pipelines, issues });
  } catch (e) { next(e); }
});

export default router;
