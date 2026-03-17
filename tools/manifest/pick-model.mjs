#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'tasks', 'MANIFEST.json');

function usage(code = 0) {
  console.log('Usage: node tools/manifest/pick-model.mjs <TASK_ID>');
  process.exit(code);
}

const taskId = process.argv[2];
if (!taskId) usage(1);
if (!fs.existsSync(manifestPath)) {
  console.error(`Missing ${manifestPath}`);
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const tasks = manifest.tasks ?? [];
const task = tasks.find(t => t.id === taskId);
if (!task) {
  console.error(`Unknown task: ${taskId}`);
  process.exit(3);
}

const hint = task.modelHint;
if (hint && ['sonnet', 'codex', 'opus'].includes(hint)) {
  process.stdout.write(hint);
  process.exit(0);
}

const title = (task.title ?? '').toLowerCase();
const domain = (task.domain ?? '').toLowerCase();
const risk = (task.risk ?? '').toLowerCase();
const touches = (task.touches ?? []).map(String);
const estimateMin = Number(task.estimateMin ?? 0);

// 1) Phase planning tasks (best-effort detection)
if (domain.includes('planning') || title.includes('plan phase') || title.startsWith('plan ')) {
  process.stdout.write('opus');
  process.exit(0);
}

// 2) High-risk / sensitive areas
const touchesSensitive = touches.some(p =>
  p.startsWith('prisma/') || p.includes('/migrations') || p.includes('schema.prisma')
);
const domainSensitive = ['security', 'auth', 'payments', 'finance', 'database'].some(k => domain.includes(k));

if (risk === 'high' || touchesSensitive || domainSensitive) {
  process.stdout.write('opus');
  process.exit(0);
}

// 3) Cheap mechanical tasks
if (
  (risk === 'low' || !risk) &&
  estimateMin > 0 &&
  estimateMin <= 45 &&
  (domain.includes('frontend') || domain.includes('ui') || domain.includes('docs') || domain.includes('polish') || domain.includes('refactor'))
) {
  process.stdout.write('sonnet');
  process.exit(0);
}

// 4) Default
process.stdout.write('codex');
