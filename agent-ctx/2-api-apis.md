# Task 2 - api-apis Agent Work Record

## Task
Create seed API, sync API, and update notifications API

## Files Created/Modified

1. **`src/app/api/seed/route.ts`** (NEW)
   - GET: Returns seed status (project count, environment count, project list)
   - POST: Reads `projects.config.json`, deletes all environments then projects (FK-safe), creates all 6 projects with nested environments
   - Uses `fs.readFileSync` and `path.join(process.cwd(), 'projects.config.json')`
   - Tags stored as `JSON.stringify()`, envVars as `JSON.stringify()`

2. **`src/app/api/projects/sync/route.ts`** (NEW)
   - POST: Accepts `{ "content": "..." }` with project-manager.sh file content
   - Parses PROJECT_NAMES, PROJECT_PATHS, PROJECT_PORTS bash arrays via regex
   - Upserts by `path` (unique field): updates if exists, creates with 2 environments if new
   - Special cases: dashboard prod=4000, pdb-tracker prod=4003, others dev+1000
   - Helper functions for display name, icon, tags, description inference

3. **`src/app/api/notifications/route.ts`** (MODIFIED)
   - Replaced hardcoded mock notifications with dynamic DB-based generation
   - GET: Fetches all projects with environments, generates 8-12 notifications based on actual data
   - Running envs → success/info, Stopped envs → warning/error, plus system notifications
   - POST: Mark as read using in-memory Map (supports single ID or markAll)

## Lint
- Zero errors in all three files (verified with `npx eslint` on each file)
- Pre-existing errors in `skills/` directory are unrelated

## Dependencies
- Uses existing `db` from `@/lib/db` (Prisma Client)
- No new dependencies installed
- Database schema unchanged
