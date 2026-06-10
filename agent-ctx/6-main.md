# Task 6 - Update frontend page.tsx to support project management from config file

## Agent: main
## Date: 2026-03-05
## Status: Completed

### Summary
Updated `src/app/page.tsx` with 6 targeted changes to support project management from the `projects.config.json` config file.

### Changes Made

1. **TAG_OPTIONS** (line ~148): Added `Automation` tag with slate color scheme
2. **ICON_MAP** (line ~162): Added `monitor: Monitor` entry for Dashboard project icon
3. **handleSyncFromConfig** (line ~2063): New `React.useCallback` that POSTs to `/api/seed`, shows toast, refreshes projects
4. **Header Sync button** (line ~2391): Outline variant button with RefreshCw icon and "Sync" text (hidden on mobile)
5. **Environment type indicators** (line ~592-596): In SortableProjectCard, dev/prod env names are abbreviated with colored badges
6. **Open in Browser link** (line ~1393-1402): In DetailSheet Overview tab, running envs show "Open →" link

### Pre-existing Infrastructure
- `/api/seed` route already existed (GET status, POST to sync from config)
- `projects.config.json` already existed with 6 projects
- All changes were minimal, targeted edits using MultiEdit

### Lint
- `npx eslint src/` — 0 errors, 0 warnings
