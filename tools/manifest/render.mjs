import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'tasks', 'MANIFEST.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function isoNow() {
  return new Date().toISOString();
}

function deriveSummary(tasks) {
  const summary = {
    total: tasks.length,
    pending: 0,
    claimed: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
    blocked: 0,
  };
  for (const t of tasks) {
    const s = t.status;
    if (s === 'pending') summary.pending++;
    else if (s === 'claimed') summary.claimed++;
    else if (s === 'in_progress') summary.inProgress++;
    else if (s === 'completed') summary.completed++;
    else if (s === 'failed') summary.failed++;
    else if (s === 'blocked') summary.blocked++;
  }
  return summary;
}

function derivePhases(phases, tasks) {
  const byPhase = new Map();
  for (const p of phases) {
    byPhase.set(p.id, { name: p.name, total: 0, completed: 0, status: p.status ?? 'not_started' });
  }
  for (const t of tasks) {
    const p = byPhase.get(t.phase);
    if (!p) continue;
    p.total++;
    if (t.status === 'completed') p.completed++;
  }
  for (const p of byPhase.values()) {
    if (p.total === 0) continue;
    if (p.completed === 0) p.status = 'not_started';
    else if (p.completed === p.total) p.status = 'completed';
    else p.status = 'in_progress';
  }
  return Object.fromEntries(
    Array.from(byPhase.entries()).map(([id, v]) => [id, v])
  );
}

function renderBoard(projectName, phases, tasks) {
  const byPhase = new Map(phases.map(p => [p.id, p]));
  const order = phases.map(p => p.id);

  const groups = new Map();
  for (const pid of order) groups.set(pid, []);
  for (const t of tasks) {
    if (!groups.has(t.phase)) groups.set(t.phase, []);
    groups.get(t.phase).push(t);
  }

  const lines = [];
  lines.push(`# ${projectName} — Task Board`);
  lines.push('');
  lines.push(`Last Rendered: ${isoNow()}`);
  lines.push('');
  for (const pid of groups.keys()) {
    const p = byPhase.get(pid) ?? { id: pid, name: pid };
    lines.push(`## ${p.name} (${pid})`);
    const ts = groups.get(pid) ?? [];
    if (!ts.length) {
      lines.push('- (no tasks)');
      lines.push('');
      continue;
    }
    for (const t of ts) {
      const mark = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🚧' : t.status === 'blocked' ? '⛔' : t.status === 'failed' ? '❌' : '🟦';
      lines.push(`- ${mark} ${t.id}: ${t.title} (${t.status}, ${t.priority ?? 'P?'}${t.estimateMin ? `, ${t.estimateMin}m` : ''})`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('This file is GENERATED from tasks/MANIFEST.json. Do not edit by hand.');
  lines.push('');
  return lines.join('\n');
}

const manifest = readJson(manifestPath);
const project = manifest.project ?? 'Project';
const phases = manifest.phases ?? [];
const tasks = manifest.tasks ?? [];

// Write INDEX.json (legacy/compatible, generated)
const index = {
  project,
  updated: isoNow(),
  summary: deriveSummary(tasks),
  phases: derivePhases(phases, tasks),
  tasks,
  generatedFrom: 'tasks/MANIFEST.json'
};
writeFile(path.join(root, 'tasks', 'INDEX.json'), JSON.stringify(index, null, 2) + '\n');

// Write BOARD.md (generated)
writeFile(path.join(root, 'tasks', 'BOARD.md'), renderBoard(project, phases, tasks) + '\n');

console.log('Rendered tasks/INDEX.json and tasks/BOARD.md from tasks/MANIFEST.json');
