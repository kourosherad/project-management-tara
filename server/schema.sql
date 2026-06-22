-- Tara Project Management - MySQL schema
-- Run automatically by `npm run init-db`, or manually:  mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS tara_pm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tara_pm;

-- ---------- Users (login accounts) ----------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(80)  NOT NULL UNIQUE,
  full_name     VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_admin      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Projects ----------
CREATE TABLE IF NOT EXISTS projects (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  -- kind of software project: web / mobile / desktop / api / data / other
  project_type  VARCHAR(60)  NOT NULL DEFAULT 'web',
  status        VARCHAR(40)  NOT NULL DEFAULT 'planning', -- planning|active|on_hold|completed|cancelled
  progress      INT          NOT NULL DEFAULT 0,          -- 0..100 (auto-derived from tasks)
  start_date    DATE         NULL,
  due_date      DATE         NULL,
  -- GitLab linkage (numeric project id from your local GitLab)
  gitlab_project_id INT      NULL,
  owner_id      INT          NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_proj_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------- Documents attached to a project ----------
CREATE TABLE IF NOT EXISTS documents (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  project_id   INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name  VARCHAR(255) NOT NULL,  -- filename on disk in /uploads
  mime_type    VARCHAR(120),
  size_bytes   BIGINT,
  category     VARCHAR(60) DEFAULT 'general', -- spec|design|contract|report|general
  uploaded_by  INT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_user    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------- Team members & roles per project (feature 5) ----------
CREATE TABLE IF NOT EXISTS members (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  project_id   INT NOT NULL,
  name         VARCHAR(160) NOT NULL,
  role         VARCHAR(120) NOT NULL,        -- e.g. Project Manager, Backend Dev, QA
  responsibility TEXT,                       -- clear responsibilities
  reports_to   VARCHAR(160),                 -- reporting line
  contact      VARCHAR(160),                 -- email / phone / chat handle
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mem_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ---------- Tasks / timeline phases (features 4 & 7) ----------
CREATE TABLE IF NOT EXISTS tasks (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  project_id   INT NOT NULL,
  title        VARCHAR(220) NOT NULL,
  phase        VARCHAR(60) NOT NULL DEFAULT 'planning', -- planning|execution|testing|delivery
  start_date   DATE NULL,
  end_date     DATE NULL,
  responsible_team VARCHAR(160),
  status       VARCHAR(40) NOT NULL DEFAULT 'todo',      -- todo|in_progress|done|blocked
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ---------- Quality management checklist (feature 6) ----------
CREATE TABLE IF NOT EXISTS quality_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  project_id   INT NOT NULL,
  standard     VARCHAR(220) NOT NULL,     -- the quality standard / criterion
  method       VARCHAR(220),              -- how it is verified (review, test, audit)
  status       VARCHAR(40) NOT NULL DEFAULT 'pending', -- pending|passed|failed|na
  notes        TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_q_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
