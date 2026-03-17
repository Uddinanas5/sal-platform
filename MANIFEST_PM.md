# Manifest.pm v2 Protocol

This repo uses **Manifest.pm v2**.

Canonical state:
- `tasks/MANIFEST.json`

Generated views (do not edit by hand):
- `tasks/INDEX.json`
- `tasks/BOARD.md`

Claims:
- `execution/ACTIVE.json`

Boot routine:
```bash
git pull
node tools/manifest/validate.mjs
node tools/manifest/render.mjs
```

Read:
- `CLAUDE.md`

Model selection (cost control):
- Use `opus` for phase planning and high-risk tasks.
- Use `codex` for most implementation/debugging.
- Use `sonnet` for well-specified mechanical tasks.
- Optional helper: `node tools/manifest/pick-model.mjs <TASK_ID>`
- Optional per-task override: add `modelHint: "sonnet"|"codex"|"opus"` in `tasks/MANIFEST.json`.

Autopilot (continuous handoff) + watchdog (safety net):
- **Start-first, schedule-second:** when you start execution, kick off the first ready task immediately (via an executor sub-agent), then schedule the watchdog.
- **Notify-on-complete (default):** each executor MUST send a DM notification on task completion (task id + chosen model + 1-line summary + commit hash).
- **Immediate continuation (primary):** after completing a task, the executor should **handoff** by spawning the next executor(s) itself (sequential by default; parallel only when clearly safe; max 3).
- **Dispatch lock (required for reliability):** before spawning, the dispatcher must acquire `__DISPATCH_LOCK__` in `execution/ACTIVE.json` (short-lived + expiring) to prevent duplicate picks.
- **Watchdog is fallback:** every 15 min it recovers stale claims and restarts work if idle.
- **Singleton + cleanup rules (critical):**
  - Keep **at most one enabled watchdog** per project.
  - Record the watchdog scheduler job id in `execution/AUTOPILOT.json`.
  - When `pendingTasks==0` and no active claims, the watchdog must **REMOVE itself immediately** (delete the cron job).
- If you run the watchdog in an **isolated** agent session, the cron payload must be:
  - `kind: "agentTurn"`
  - `message: "..."`
  (Not `text`, and not `systemEvent`.)
