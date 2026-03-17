import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'tasks', 'MANIFEST.json');
const activePath = path.join(root, 'execution', 'ACTIVE.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fail(msg) {
  console.error('MANIFEST_VALIDATE_FAIL:', msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log('MANIFEST_VALIDATE_OK:', msg);
}

if (!fs.existsSync(manifestPath)) fail(`Missing ${manifestPath}`);
if (!fs.existsSync(activePath)) fail(`Missing ${activePath}`);
if (process.exitCode) process.exit(process.exitCode);

const manifest = readJson(manifestPath);
const active = readJson(activePath);
const tasks = manifest.tasks ?? [];
const claims = active.claims ?? [];

const byId = new Map(tasks.map(t => [t.id, t]));

// Duplicate claims
const claimedIds = claims.map(c => c.taskId);
const dup = claimedIds.filter((id, i) => claimedIds.indexOf(id) !== i);
if (dup.length) fail(`Duplicate claims: ${Array.from(new Set(dup)).join(', ')}`);

// Claim references valid tasks
for (const c of claims) {
  if (!byId.has(c.taskId)) fail(`Claim references missing task: ${c.taskId}`);
}

// Completed tasks should not be claimed
for (const c of claims) {
  const t = byId.get(c.taskId);
  if (t?.status === 'completed') fail(`Task ${t.id} is completed but still claimed`);
}

// in_progress tasks should be claimed (soft rule)
for (const t of tasks) {
  if (t.status === 'in_progress') {
    const has = claims.some(c => c.taskId === t.id);
    if (!has) fail(`Task ${t.id} is in_progress but not claimed in ACTIVE.json`);
  }
}

if (!process.exitCode) ok('manifest + active state looks consistent');
