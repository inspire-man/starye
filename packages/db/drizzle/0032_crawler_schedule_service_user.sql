-- Scheduled GitHub Actions runs use a stable service principal as the task owner.
INSERT OR IGNORE INTO `user` (
  `id`,
  `name`,
  `email`,
  `email_verified`,
  `role`,
  `is_adult`,
  `is_r18_verified`,
  `created_at`,
  `updated_at`
) VALUES (
  'github-actions-schedule',
  'GitHub Actions',
  'github-actions@starye.invalid',
  1,
  'user',
  0,
  0,
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

