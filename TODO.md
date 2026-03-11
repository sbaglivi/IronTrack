Improvements:

## Done
- [x] seed the app with a lot more exercises (8 → 52, across all major muscle groups with aliases)
- [x] normalize exercise names when saving — title-case, preserves uppercase tokens (BB, DB, KB, BW, EZ), alias support (e.g. RDL → Romanian Deadlift)
- [x] remove the `completed` field from sets — checkmark removed, `completed` dropped from
  SetEntry on FE + BE; old DB data unaffected (field silently ignored on read)
- [x] make workout execution UI more vertically compact — tighter padding, smaller headers,
  reduced spacing; fits ~2 exercises on screen at once

## In Progress (backend done, frontend remaining)
- [ ] fuzzy search when searching/creating exercises
  - Backend: GET /exercises?q= with fuzzy match on name + aliases ✓
  - Backend: searchExercises() added to frontend/services/db.ts ✓
  - Frontend: wire up exercise picker/creator to use searchExercises() as user types
- [ ] add screen that given an exercise shows when you've done it and how many reps/kgs you were using
  - Backend: GET /exercises/:id/history endpoint ✓
  - Frontend: build history screen + add navigation to it from exercise list
- [ ] add ability to track isometrics through seconds for hold
  - Behaviour: duration replaces reps (not additive) for isometric sets
  - Types: optional `duration` field on SetEntry (FE + BE) ✓
  - Data model: add optional `isIsometric: boolean` to InstanceExercise and TemplateExercise
    (stored in JSON, no DB migration needed)
  - Frontend: add isometric toggle per exercise in set editor; when on, show duration
    input (seconds) instead of reps input

## Not started
- [x] supersets
  - Link exercises together with an optional `supersetId: string` on InstanceExercise
    and TemplateExercise (stored in JSON, no DB migration needed)
  - Exercises sharing the same supersetId form a superset group
  - UI: visually group/link superset exercises when building or executing a workout
  - Flexible: user can still log a different number of sets per exercise within a superset
- [x] add ability to select multiple sets to edit at the same time
  - Long press a set to enter selection mode for that exercise
  - Tap other sets to toggle them in/out of selection
  - Editing weight or reps updates all selected sets
  - Header shows "N selected" + X to cancel; delete button hidden while selecting
  - Mass delete: not included (remove sets individually)
- [x] redesign the home page — removed entirely; `/` redirects to `/templates`
  - Templates is now the landing page with Start buttons on each
  - "Start Empty Workout" demoted to small text link in header
  - Draft resume banner pinned above bottom nav on mobile, static at bottom on desktop
  - Home nav item removed; logo links to /templates
