# Phase Planning Template

Use this template when:
- Starting a new project (Phase 0)
- Completing a phase and planning the next one

## Phase Overview

| Field | Value |
|-------|-------|
| Phase | {{PHASE_NUM}} |
| Name | {{PHASE_NAME}} |
| Starts After | {{PREV_PHASE or "Project Start"}} |

## Phase Objective

What this phase accomplishes. Keep it focused and measurable.

**Example**: "Build medication CRUD with validation and error handling"

## Success Criteria

How do we know this phase is complete?

- [ ] Criterion 1 (e.g., "All CRUD endpoints tested and passing")
- [ ] Criterion 2
- [ ] Criterion 3

---

## Task Breakdown Process

### Step 1: List Features

List all features/components this phase delivers:

1. Feature A
2. Feature B
3. Feature C

### Step 2: Break Features into Tasks

For each feature, break it into tasks following **Task Size Guidelines**:
- **Target**: 15-45 minutes per task
- **Too small?** Combine related tasks
- **Too large?** Split into subtasks

| Feature | Tasks (15-45 min each) |
|----------|--------------------------|
| Feature A | Task A1: Setup X (20m) |
| | Task A2: Implement Y (30m) |
| Feature B | Task B1: (25m) |
| Feature C | Task C1: (40m) |

### Step 3: Define Dependencies

For each task, ask: "What must be completed before this can start?"

```
T1-001: Setup database schema
  └─> T1-002: Create CRUD service
       └─> T1-003: Build API endpoints
            ├─> T1-004: Medication list UI
            └─> T1-005: Medication detail UI
```

### Step 4: Prioritize

Mark tasks as:
- **P0** — Critical for phase completion
- **P1** — Important but can wait
- **P2** — Nice to have

---

## Task Size Guidelines

| Size | Time | Strategy |
|-------|-------|----------|
| Small | <15 min | Combine with related task |
| Ideal | 15-45 min | Perfect |
| Large | 45-90 min | Split into 2-3 tasks |
| Too Large | >90 min | Break down into sub-features |

**Signs a task is too large:**
- Multiple distinct features in one task
- Involves multiple files/systems
- Unclear what "done" means
- Acceptance criteria are vague

---

## Task Template

Copy this for each task in `tasks/phase-N/`:

```markdown
# PN-XXX: Task Title

## Metadata
| Field | Value |
|-------|-------|
| Phase | N |
| Status | pending |
| Priority | P0/P1/P2 |
| Estimate | X min |
| Dependencies | PN-XXX, ... |
| Completed At | (timestamp) |

## Objective
What this task accomplishes in 1-2 sentences.

## Acceptance Criteria
- [ ] Specific, testable criterion 1
- [ ] Specific, testable criterion 2
- [ ] Specific, testable criterion 3

## Context
Relevant docs, files, decisions, API specs.

## Execution Log
(Filled during execution)

## Artifacts
Files created/modified.

## Notes
Any observations or issues.
```

---

## After Planning

### Update Canonical Planning Files

1. **tasks/MANIFEST.json** — Add all new tasks (canonical)
2. **docs/ROADMAP.md** — Update phase status
3. **execution/LOG.md** — Log phase planning completion (short)
4. Run generators:
   - `node tools/manifest/validate.mjs`
   - `node tools/manifest/render.mjs` (regenerates tasks/INDEX.json + tasks/BOARD.md)

### Set Up Watchdog

Follow Watchdog Setup in CLAUDE.md to create the cron job for this phase.

### Start First Task

Either:
- Run `execute next` to start the highest priority ready task, OR
- Let watchdog handle it (will start automatically in ~15 min)

---

## Planning Session Template

Use this to spawn a sub-agent for phase planning:

```javascript
sessions_spawn({
  task: `You are planning Phase {{PHASE_NUM}} for SAL Platform.

## Phase Context
**Previous Phase**: {{PREV_PHASE or "None — starting project"}}
**Phase Objective**: {{PHASE_OBJECTIVE}}

## YOUR JOB

1. Read the phase definition and success criteria
2. Break down the phase into tasks (15-45 min each)
3. Define dependencies between tasks
4. Prioritize tasks (P0/P1/P2)
5. Create all task files in tasks/phase-{{PHASE_NUM}}/
6. Update tasks/MANIFEST.json (canonical)
7. Run \`node tools/manifest/validate.mjs\`
8. Run \`node tools/manifest/render.mjs\` (regenerates tasks/INDEX.json + tasks/BOARD.md)
8. Update docs/ROADMAP.md
9. Write completion marker

## Task Guidelines
- 15-45 minutes per task
- Specific acceptance criteria
- Clear dependencies
- Each task should complete one cohesive unit of work

## MANDATORY COMPLETION

After planning is complete, output:

===PHASE_PLAN_COMPLETE===
phase: {{PHASE_NUM}}
tasks_created: X
total_estimate: X hours
dependencies_defined: true
board_updated: true
index_updated: true
next_actions:
  - Set up watchdog for Phase {{PHASE_NUM}}
  - Start first task with "execute next"
===END_PHASE_PLAN===
`,
  label: "sal-platform-plan-phase-{{PHASE_NUM}}",
  runTimeoutSeconds: 1200
})
```

---

## Phase Review (After Completion)

Before starting the next phase, do a quick review:

### What Went Well
- Tasks completed smoothly?
- No major blockers?
- Estimates accurate?

### What to Improve
- Tasks too large/small?
- Dependencies unclear?
- Missing tasks discovered?

### Lessons Learned
- Document in execution/LOG.md
- Update task planning guidelines for next phase
