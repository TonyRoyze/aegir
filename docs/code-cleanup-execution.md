# Cleanup execution: C03–C20

Implemented locally on 2026-10-02. See the [task tracker](../CODE_CLEANUP_PLAN.md#9-progress-tracker) for each task's status. Existing PDF and meet configuration migration work was preserved; the initial tree was already heavily modified. Changes are uncommitted.

## What changed

- Removed unused conflict-map exports, old domain interfaces, unused declarations/comments, three unreferenced assets and redundant `@types/bcryptjs`. Kept active constants, PDF fonts/licenses and dependencies.
- Replaced stale README PDF/setup instructions with the browser renderer, pnpm commands and current references.
- Converted `debug.fixUser` from a public mutation into an internal recovery mutation. Preserved operational recovery instead of assuming there are no external tooling users.
- Reused typed super-admin session validation and explicit password-free user projections. Session format, expiry and role schema remain unchanged.
- Bounded `internal.cleanup.clearAll` to batches of 100 with scheduled continuation. This destructive utility was not invoked. Backend queries that may have external callers remain.
- Shared desktop/mobile registration schema and event rules. Removed the obsolete age field, corrected numeric seed input, renamed `MobileRegistrationForm`, and used RHF `formKey` independently of persisted registration IDs.
- Made lane assignment generic with nullable slots. Timing and PDF generation use one program/group builder; public heats reuse relay grouping with their existing first-member seed policy. Team IDs remain stable and meet-scoped. One empty event produces one blank heat instead of duplicate empty groups.
- Reused the memoized rest optimizer suggestion for Auto-sort. Shared time formatting while preserving the public view's compact seconds format; extracted dashboard ranking cards and preferred-meet selection; removed undefined scrollbar classes and repaired the flex typo.
- Reworked authentication to use a session external store, including cross-tab storage events. Redirects wait for session initialization/query resolution; public routes use explicit boundaries. Convex client state replaces render-time ref reads and closes connections on unmount.
- The temporary configuration preview route disappeared from the working tree during implementation. Final route inspection/build found no preview routes, so auth/layout exemptions were removed. The embedded PDF preview remains active.
- Added `typecheck`/`test:domain` scripts, enabled unused declarations checks and excluded generated Convex files from ESLint.

Several cleanup tasks were already satisfied by the newer meet migration: direct required-meet dashboard queries, shared public/admin leaderboard aggregation, and shared create/edit configuration fields with independent edit override state. These were verified instead of rewritten. Sidebar leaderboard semantics remain distinct.

## Registration behavior fix

A clean registration form now receives subsequent subscription updates. Local edits remain visible while an autosave is pending. One debounce timer and serialized saves prevent overlapping local snapshots. Meet switching is blocked while there are unsaved edits or a write in flight; unloaded meet rows are not editable. Effect cleanup cancels pending timers, and generation checks prevent responses from another form generation from replacing the current form.

The current client supplies an `expectedSnapshot` to `registrations.sync`. The mutation compares it with the current editable server rows in the same transaction before making changes. If another editor changed the rows, the whole write is rejected. The local draft remains and the interface offers explicit recovery; discarding a draft requires confirmation. Successful writes return the canonical saved rows and update the baseline before the next local save.

This is a compatibility fix to full-snapshot synchronization, not the complete [realtime design](../REALTIME_SYNC_PLAN.md). Older clients omitting `expectedSnapshot` retain legacy replacement behavior. Concurrent edits are rejected rather than automatically merged, and pending edits are canceled on unmount; durable drafts, incremental authenticated row mutations, field-level reconciliation and shared event-order persistence remain separate work. Publish backend support before the client using its new argument/return value. Test the two-user scenario before release.

## Conditional decisions retained

| Item | Result |
| --- | --- |
| `meets.updateEvents`, `meets.getHeatAssignments` | No UI callers found; getHeatAssignments is exercised by configuration tests. External clients/scripts unverified. Retained. |
| Persisted heat authority | Generate Heats remains a real caller. Current implementation already awaits writes. Button, APIs, table and documents retained until derived/persisted authority is decided. |
| Legacy registration fields/indexes and `user` role | Deployed data and operational consumers unverified. No schema narrowing or index removal. |
| `results.by_meet_student` | Now used by registration deletion protection; retained. |
| Public debug mutation release | Source/bindings changed; an already deployed public endpoint requires a backend release. |
| Access control/cascade deletion/public-token lookup | Separate behavioral changes; not expanded into this cleanup. |

## Verification

| Check | Result |
| --- | --- |
| `pnpm typecheck`, including enabled unused flags | Passed |
| `pnpm lint` | Passed, no errors or warnings |
| `pnpm test:domain` | 7 passed: balanced lanes, grouping, relay identity/seed policy, registration rules, time formats, meet selection, snapshot comparisons |
| `pnpm test:pdf` | 4 passed: pagination/filtering, empty sheet, font shaping/errors, event order/lanes |
| `pnpm test:config` | 10 passed, including stale-save rejection, missing-meet totals, expiry/role enforcement and password redaction |
| `pnpm exec convex codegen --typecheck disable` | Passed; generated bindings refreshed through the CLI |
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm build` | Passed |
| `git diff --check` | Passed |
| Browser at `localhost:3001` | Login rendered; anonymous `/register` redirected to login; invalid saved session cleared; anonymous invalid public token showed Invalid link |

The first codegen attempt used `--typecheck enable` and returned nonzero because the existing project has no `convex/tsconfig.json`. Bindings had been generated; rerunning with Convex's typecheck disabled succeeded, and the root TypeScript check covers backend source. Component codegen uploads analysis inputs to the configured deployment but is a read-only CLI operation; no deployment release or data migration was performed.

Build/test tooling emitted existing Node deprecation and stale browser mapping data notices. They did not fail checks; dependency upgrades are outside this cleanup.

No credentials were available for authenticated browser registration, timing, meet-editing or two-session testing. PDF Node tests do not establish browser Indic visual quality. Missing Convex URL rendering was inspected in source, not tested in a separately configured browser build. No production data was deleted or maintenance/recovery mutation executed.

## Release and remaining checks

1. Review the cleanup diff separately from the pre-existing PDF/configuration changes. Do not use blanket resets in this dirty tree.
2. Release backend changes through the normal workflow before the updated registration client. Verify public clients can no longer invoke `debug.fixUser` and trusted recovery remains accessible internally.
3. With two authenticated development sessions, test remote name/event/team/seed edits, a stale add/delete save, typing during an in-flight save, explicit conflict recovery, meet switching, and unmount before debounce. Confirm no stale snapshot deletes another user's rows.
4. Check login/reload/logout/expiry, authenticated public access, both registration layouts, timing/result edits, meet override editing and PDF downloads.
5. Resolve persisted heat authority and deployed API/schema compatibility before further retirement. Implement shared event-order persistence from the realtime plan separately.
