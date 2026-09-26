// Numbered schema upgrades. Append new entries; never edit an applied migration.
// Keep each statement compatible with the selected database driver.
export const migrations = [
  {
    version: 1,
    name: 'index_project_relationships',
    sqlite: [
      'CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_members_project ON members(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_quality_project ON quality_items(project_id)',
    ],
    // MySQL already indexes these foreign keys.
    mysql: [],
  },
  {
    version: 2,
    name: 'local_user_roles',
    sqlite: [
      "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer'",
      "UPDATE users SET role = 'admin' WHERE is_admin = 1",
    ],
    mysql: [
      "ALTER TABLE users ADD COLUMN role VARCHAR(30) NOT NULL DEFAULT 'viewer'",
      "UPDATE users SET role = 'admin' WHERE is_admin = 1",
    ],
  },
];
