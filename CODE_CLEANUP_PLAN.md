# Aegir code cleanup plan

**Execution:** [docs/code-cleanup-execution.md](./docs/code-cleanup-execution.md) records implemented changes, verification, conditional decisions, and remaining release/manual checks.

**Follow-up:** [REALTIME_SYNC_PLAN.md](./REALTIME_SYNC_PLAN.md) provides the detailed shared event-order and registration-sync design. Its current-source findings and functional requirements take precedence over related cleanup suggestions here, especially C13, C16, C19, and C20. The registration meet selector already resets `hasLoaded`; pending timers and ignored subsequent remote updates still need correction.

Audited on **2026-10-02** against the current working tree, including the uncommitted browser PDF rewrite. This is an implementation reference for a model such as Luna. **No application code was changed as part of this audit.**

## 1. Objective and boundaries

Remove demonstrably unused code, eliminate unnecessary duplication, and simplify maintenance while preserving working features and stored data. Execute one numbered task at a time; this document is not a request for a wholesale rewrite.

Findings have three different meanings:

| Label | Meaning | Execution rule |
| --- | --- | --- |
| Confirmed locally unused | No consumer found in application imports, dynamic imports, tests, or configuration examined | Recheck references before removal; proceed if still unused |
| Duplication / simplification | Code runs, but repeats logic or maintains unnecessary intermediate state | Refactor with behavior-specific checks |
| Conditional | Repository references cannot establish whether external callers, deployed data, or intended features need it | Record the unresolved dependency; leave it intact until resolved |

Do not treat a file as useless because it is large, old, uses `any`, or has no import. Next.js route files and Convex functions are entry points. Internal Convex functions may be called through generated references or operational tools. Public assets can have external consumers.

### Existing work to preserve

The initial working tree already contained changes to PDF generation, registration, configuration, and dependencies. These included deletion of:

- `app/api/meet-program-pdf/route.tsx` and `app/api/registration-sheet-pdf/route.tsx`.
- `app/preview/meet-program/page.tsx` and `app/preview/registration-sheet/page.tsx`.
- `components/export-pdf-button.tsx` and both files in `components/print/`.
- `lib/printer.service.ts`, `scripts/postinstall.mjs`, and `public/chromium-pack.tar`.

Their replacements include `lib/pdf/`, `components/meet-program-pdf-preview.tsx`, `public/fonts/`, and `tests/pdf-generation.test.ts`.

These removals are **already in progress**, not additional savings from this plan. Do not restore them, duplicate their replacements, or revert the surrounding edits. A temporary `/preview/pdf-label-check` route appeared and disappeared during the audit; always inspect the actual working tree rather than assuming this document is an immutable snapshot.

Before each task, run `git status --short` and inspect the diff of the files you intend to edit. Do not stage or commit someone else's unrelated changes.

## 2. Audit coverage and baseline

The review covered all application areas: App Router entry points, providers and navigation, registration on desktop/mobile, meet management, event ordering/rest optimization, timing, public meet views, gallery, user management, Convex functions/schema, shared utilities/types, PDF generation/tests/assets, UI import relationships, and root configuration/documentation. Dependencies were checked against actual imports, including dynamic imports and side-effect imports.

Generated Convex files and `.agents/skills/` are tooling inputs, not handwritten application code to prune. Dependencies, caches, binary assets, and generated build output were examined by usage/configuration rather than treated as source to rewrite.

### Commands actually executed

| Check | Result at audit time |
| --- | --- |
| `pnpm exec tsc --noEmit --incremental false` | Passed |
| `pnpm test:pdf` | Passed: 4 tests |
| `pnpm exec eslint app components convex lib types tests -f json` | 39 errors, 14 warnings |
| `pnpm exec tsc --noEmit --incremental false --noUnusedLocals --noUnusedParameters` | Failed with 9 unused-declaration diagnostics |
| Source import graph and `api.<module>.<function>` reference searches | Used to corroborate deletion candidates |

The lint command above included `convex/_generated`, accounting for four warnings about generated disable directives. Do not edit those generated files to silence the warnings.

Production build, authenticated browser flows, deployed Convex callers/logs, and production data were **not verified**. Passing type checks and PDF tests does not establish that backend mutations or login flows work correctly. No Convex deployment or data mutation was performed during this audit.

## 3. Recommended order

| Batch | Tasks | Purpose | Risk |
| --- | --- | --- | --- |
| A | C01–C05 | Remove proven local dead code and update stale docs | Low |
| B | C06–C09 | Address backend leftovers and impossible branches | Low to medium; external-call checks required |
| C | C10–C13 | Establish accurate types and share repeated domain logic | Medium |
| D | C14–C17 | Simplify repeated UI/provider logic | Medium |
| E | C18–C20 | Resolve feature/data decisions and strengthen verification | Medium to high; some work remains conditional |

**Fastest useful first batch:** C01, C02, C03, C04, C05. These remove approximately **1,623 lines across four unused modules**, plus an unused conflict helper/types and small declarations. Three locally unreferenced assets total **2,865,935 bytes (~2.73 MiB)**. Those counts exclude the existing PDF migration. Source reduction and installed dependency reduction are expected; browser bundle savings are not established because unreachable modules may already be excluded from bundles.

## 4. Task cards

### C01 — Remove the unused conflict graph and its exclusive dependencies

**Classification:** Confirmed locally unused. **Priority:** High. **Files:** `components/ConflictGraph.tsx`, `package.json`, `pnpm-lock.yaml`.

Evidence:

- `ConflictGraph` has no import or render site in the current application.
- The file contains 1,147 lines, including D3 rendering, a second ordering optimizer, and graph-only grouping/state.
- `d3` is imported only by this file. `@types/d3` exists to type that dependency.
- The active ordering screen uses `optimizeEventOrderForRest` and `summarizeEventRest` from `lib/event-rest-utils.ts`.

Steps:

1. Search application/tests/configuration again for `ConflictGraph`, imports of `d3`, and dynamic import paths. Exclude generated output, dependencies, lockfiles, and this plan from consumer counts.
2. Delete `components/ConflictGraph.tsx` if it still has no consumers.
3. Run `pnpm remove d3` and `pnpm remove -D @types/d3`. Let pnpm update its lockfile; do not hand-prune lockfile entries.
4. Preserve the rest optimizer and the visible conflict summaries on `/event_order`.

Acceptance: type checking passes; event drag/reorder, reset, rest summaries, and auto-sort remain available. There are no imports of the deleted component or D3. If graph UI has been reintroduced since the audit, defer this task rather than deleting an active feature.

### C02 — Remove three unused UI modules

**Classification:** Confirmed locally unused. **Priority:** High.

| File | Lines at audit | Reason |
| --- | ---: | --- |
| `components/ui/form.tsx` | 167 | No imports; registration directly uses React Hook Form |
| `components/ui/input-group.tsx` | 170 | No imports |
| `components/ui/sheet.tsx` | 139 | No imports; mobile navigation/public filters use Drawer |

Steps: recheck imports, then delete only these files. Check `components.json` and any newly added component for changed usage.

Keep their shared dependencies: `@radix-ui/react-label` supports `label.tsx`, `@radix-ui/react-slot` supports `button.tsx`, `@radix-ui/react-dialog` supports `dialog.tsx`, and React Hook Form supports both registration views. Keep `textarea.tsx`, which the gallery uses.

Acceptance: type checking passes; registration, gallery dialogs, meet dialogs, and mobile drawers still render. Do not trim every unused export from retained UI wrappers; that creates small, brittle changes with little benefit.

### C03 — Remove unused helper exports and stale domain declarations

**Classification:** Confirmed locally unused exports. **Priority:** High.

Files:

- `lib/event-rest-utils.ts`: `buildConflictMap` and its `EventRestConflictMap` interface have no consumers. Remove both, retaining `summarizeEventRest`, `optimizeEventOrderForRest`, and their required private helpers/types.
- `types/index.ts`: only `FACULTIES` and `SWIM_EVENTS` are imported by current source. The exported `Faculty`, `Gender`, `Student`, `SwimEvent`, and `Registration` types are unused outside this module.

The old `Student`/`Registration` interfaces also misrepresent current data: student registration numbers are absent, gender/faculty are required despite optional backend fields, and `registeredAt` is a `Date` despite serialized strings returned by Convex.

Steps: remove the unused type declarations and leave the constants. Do not replace them with another speculative type system. C10 will introduce only types used by actual consumers. Search import specifiers, not generic prose such as the word “Student.”

Acceptance: no import failures; constants retain all values and their readonly inference; ordering behavior is unchanged. Keep `clearProgramEventOrder`: the reset button calls it.

### C04 — Remove small unused declarations and obsolete comments

**Classification:** Confirmed unused declarations / stale commentary. **Priority:** High.

| File / anchor | Action |
| --- | --- |
| `app/gallery/page.tsx`, `Id` import | Remove unused import |
| `app/users/page.tsx`, `draftUsers.map((draft, idx)` | Remove unused `idx` parameter |
| `components/FacultyLeaderboard.tsx`, `LeaderboardEntry` | Remove unused interface |
| `components/MobileRegistrationForm.tsx`, `registrationNumber = useWatch(...)` | Remove unused watcher and variable; keep the actual registration-number input |
| `app/event_order/page.tsx`, default `React` import | Remove default import; retain named hooks |
| `components/RegistrationForm.tsx`, default `React` import | Remove default import |
| `convex/auth.ts`, unused `const token = ...` in `login` | Remove unused token expression and contradictory exploratory comments; preserve the actual `finalToken` session flow |
| `convex/albums.ts`, `update` | Remove unused `coverImage` variable and commented-out fetch implementation |
| `app/meets/page.tsx`, commented `setSelectedEvents` | Remove stale commented experiment |
| Public meet page, commented Facebook button | Remove inactive commented JSX if still present |

Important exception: `const { password: _, ...userWithoutPassword } = user` and the equivalent `listUsers` mapping intentionally exclude password hashes. **Do not remove the destructuring and return full user documents.** Use an explicit public-user projection if needed to resolve lint, preserving the current safe return fields.

Removing the unused token expression changes how many random/time calls execute, but its value is never used. Do not change the actual session token format, expiry, or storage key in this task.

Acceptance: the strict unused-declaration type check passes after C01/C04, assuming no newer diagnostics. Normal type checking passes. Authentication responses still exclude passwords. Avoid a repository-wide automatic lint fix.

### C05 — Remove unreferenced assets and repair stale documentation

**Classification:** Assets confirmed locally unreferenced; external URLs conditional. Documentation confirmed stale. **Priority:** High.

| Asset | Size in bytes | Local usage |
| --- | ---: | --- |
| `public/chart.png` | 1,406,607 | None found |
| `public/podium.png` | 1,459,200 | None found |
| `public/vercel.svg` | 128 | None found |

Recheck exact paths, CSS URLs, metadata, and known externally shared asset URLs. Delete assets with no required consumer. Preserve all referenced public view PNGs, both logos, `app/icon.png`, the PDF fonts, and `public/fonts/OFL.txt`. License and attribution files are required documentation, not dead code.

Update `README.md`:

1. Replace the obsolete Puppeteer/headless-browser PDF explanation with the current browser `pdf-lib` implementation and link to `public/fonts/README.md` for script support.
2. Correct the framework version: `package.json` currently specifies Next.js `16.0.7`, whereas README says Next.js 15.
3. Remove or replace links to nonexistent `BLUEPRINT_PDF_GENERATION.md` and `PDF_INSTRUCTIONS.md`.
4. Use pnpm installation/run examples consistently with the existing lockfile. Explain that Next.js and Convex development processes serve different roles and normally run in separate terminals.
5. Remove `NEXT_PUBLIC_APP_URL` from setup examples if no consumer has been added; current public links use `window.location.origin`.
6. Document `pnpm test:pdf` and the type-check command.

Acceptance: local documentation links resolve, PDF instructions describe the code actually present, and retained assets load. Do not claim a measured bundle or load-time improvement from asset deletion.

### C06 — Retire the public password-reset debug endpoint

**Classification:** No local caller; externally callable function. **Priority:** Highest backend cleanup.

**File:** `convex/debug.ts`, exported `fixUser`.

Evidence: a public mutation accepts `username` and `newPassword` and updates the stored password hash without checking a session or role. No repository caller exists. This is a concrete exposed capability in the source, not merely a style issue.

Steps:

1. Read `convex/_generated/ai/guidelines.md` before touching Convex code.
2. Determine whether any operational password-recovery process calls `debug:fixUser`. Repository searches alone cannot answer this.
3. If obsolete, remove `convex/debug.ts`. If still required, replace it with an explicitly authorized administrative/internal recovery path in a separate change; do not retain an unguarded public mutation just for convenience.
4. Regenerate Convex API files through the project's normal codegen workflow when backend changes are validated. Do not edit `_generated/api.d.ts` by hand.
5. Release the backend removal through the normal deployment process. Local deletion does not remove an already deployed endpoint.

Acceptance: the obsolete public function is absent from generated/deployed API after release, login/user creation continue to work, and no required recovery workflow has been silently removed. Do not call the endpoint to test it against real users.

### C07 — Review unused Convex API functions and maintenance code

**Classification:** Conditional. **Priority:** Medium.

| Symbol | Local evidence | Recommendation |
| --- | --- | --- |
| `meets.updateEvents` | No caller; current meet editing uses `updateMeet` | Remove if no external client/script uses this API |
| `meets.getHeatAssignments` | No caller; screens calculate heats from registrations | Resolve C18 before removal |
| `cleanup.clearAll` | No scheduler/import/caller found; internal mutation deletes registrations | Remove if a one-off development utility; retain only if a documented maintenance process requires it |

Do not execute `clearAll` during cleanup. If it is retained, document its purpose and separately fix its unbounded deletion strategy; it currently reads the entire registration table in one transaction.

Keep `albums.internalCreate` and `albums.internalUpdate`: public actions call them through `internal.albums.*`. They are not unused just because the UI does not call them directly.

Acceptance: each removal has a recorded caller check; remaining public signatures are unchanged; backend codegen/type checks pass. No stored documents are deleted.

### C08 — Simplify the required-meet dashboard query

**Classification:** Impossible branch / faulty missing-data guard. **Priority:** High.

**File:** `convex/dashboard.ts`, `getStats`.

Evidence: its validator requires `meetId`, yet the handler maintains an `else` branch for no ID, builds a one-element `meets` array, and checks `if (!meets)`. An empty array is truthy, so a missing/deleted meet can lead to `meets[0]._id` access.

Steps:

1. Fetch the requested meet directly with `ctx.db.get(args.meetId)`.
2. Return the existing empty-stats object when the meet is missing.
3. Use `meet._id` or `args.meetId` for subsequent queries; remove the array wrapper and unreachable fallback query.
4. Remove contradictory exploratory index comments; preserve the existing result index prefix lookup and returned field names.

Acceptance: valid meet stats are identical; a missing meet returns zero counts and empty arrays; no whole-table meet fallback remains. Add a meaningful Convex test for the missing-meet case when the test infrastructure in C20 is available.

### C09 — Remove unnecessary public-dashboard bookkeeping

**Classification:** Confirmed unnecessary intermediate map. **Priority:** Medium.

**File:** `convex/dashboard.ts`, `getPublicLeaderboard`.

The `studentMap` keyed by Convex ID is populated but never read in this query. `studentsByExternalId` drives the actual result aggregation. Remove only the unused map and its writes.

Keep `studentMap` in `getStats` for now: its size supplies `totalParticipants`, including students recovered from results. Do not accidentally change the participant-count definition while sharing code.

Acceptance: public faculty/student leaderboard responses are unchanged for normal swimmers, relay-only results, and results whose student no longer has a registration.

### C10 — Create shared types that reflect real boundaries

**Classification:** Duplication / unsafe type workarounds. **Priority:** High before shared domain refactors.

Files: `components/RegistrationForm.tsx`, `components/MobileRegistrationForm.tsx`, `components/HeatTables.tsx`, `components/FacultyLeaderboard.tsx`, `lib/swimming-utils.ts`, PDF model files, and their consumers.

Steps:

1. Move the registration Zod schema and its inferred form type into a neutral module such as `lib/registration-form-schema.ts`. Both desktop and mobile components should import the same type. The mobile copy currently omits `seed` and other fields present in the desktop schema.
2. Type `fields` using React Hook Form's field-array types rather than `any[]`; preserve form array indexes and React keys. The form's row `id` and React Hook Form's generated field ID have different purposes; inspect that boundary before renaming either.
3. Derive persisted records from `Doc<"table">` and query return types where useful. Use `Id<"meets">` at backend boundaries. Do not force a persisted document, a form draft, and a relay team into one all-purpose interface.
4. Make `assignToHeats` generic over a minimal participant shape that supplies optional `seed` and `name`, returning `Array<Array<T | null>>`. Preserve caller-specific identity/display fields through the generic.
5. Replace timing/leaderboard `any` with actual query/participant types. Include synthetic relay identities, optional student lookup results, and zero-point results.
6. Add optional `seed` to the meet-program student contract if that contract continues to represent seeded participants; runtime input currently carries it but its declared interface omits it.
7. Rename `MobileRegistrationFrom` to `MobileRegistrationForm` with its one import/render site.

Acceptance: all current consumers type-check without `as any` replacements. Form reset, seed values, optional gender/faculty, serialized registration dates, relay IDs, and lane assignment retain behavior. Keep PDF-specific contracts when they describe a distinct document input; do not merge small files solely to reduce file count.

### C11 — Share event-to-participant and relay grouping logic

**Classification:** Active duplicated domain logic. **Priority:** High.

Evidence:

- `components/HeatTables.tsx` independently constructs event maps, faculty relay teams, gender groups, numbered events, and seeded heats.
- `lib/meet-program-pdf.ts`, `buildMeetProgramEvents`, performs almost the same construction.
- The public meet page constructs faculty relay teams and heats a third time.

Steps:

1. Finish C10 so participant identities and seed fields survive extraction.
2. Extract pure grouping helpers into a neutral domain module such as `lib/meet-participants.ts`. Keep PDF drawing in `lib/pdf/` and editable timing cells in `HeatTables`.
3. Share the timing/PDF event builder first. Preserve women-before-men order, event numbering, six explicit lane slots, relay result identity equal to the faculty key, and seed-descending/name-tiebreak ordering.
4. Integrate the public view only after explicitly preserving its differences: it matches a selected prefixed or legacy unprefixed event, filters to selected gender, includes participants with missing gender, and uses `nameInUse` for display. It currently carries the first relay member's seed, unlike the other builders.
5. Keep `assignToHeats` as the single lane-balancing implementation. Do not import PDF layout/browser code into Convex.

Acceptance fixtures: 0, 1, 6, 7, and 13 participants; equal seeds; absent seed/gender/faculty; both genders; multiple registrations from one relay faculty; prefixed/unprefixed events; custom event order. Compare outputs before/after. Synthetic relay IDs must still match saved result records.

Do not silently “fix” grouping differences during extraction. The current builder may omit unknown-gender swimmers when known-gender groups exist; record that behavior and address it separately if the intended rule differs.

### C12 — Share duplicated leaderboard computation carefully

**Classification:** Active duplicated aggregation. **Priority:** Medium.

Files: `convex/dashboard.ts` (`getStats`, `getPublicLeaderboard`), `components/FacultyLeaderboard.tsx`.

The two dashboard queries repeat student hydration by registrations and result external IDs, relay attribution, faculty totals, student totals, sorting, and top-10 selection. The timing sidebar separately computes faculty totals.

Steps:

1. Extract backend student hydration into a typed helper accepting `QueryCtx`, registrations, and results. Preserve fallback lookup for result students without current registrations.
2. Extract pure aggregation from database access. Parameterize outputs where needed rather than returning an enormous generic structure.
3. Remove duplicated loops from the two backend queries while preserving their response shapes and `getStats` gender breakdowns/counts.
4. Compare the sidebar's semantics before sharing the pure aggregator. It currently includes a `No Faculty` group/zero scores where backend queries skip some entries, and applies `USCS` → `UCSC` display normalization during aggregation. Keep raw identity separate from presentation to avoid accidentally combining or splitting faculty buckets.

Acceptance: test individual and relay points, zero/negative points, fractional tie points, unknown/missing students, students without registrations, gender prefixes, and top-10 ordering. Totals and identities are unchanged unless an explicit behavior change is separately agreed.

### C13 — Reuse the expensive event-order suggestion

**Classification:** Redundant computation. **Priority:** Medium. **File:** `app/event_order/page.tsx`.

`hasAutoSortImprovement` calls `optimizeEventOrderForRest` in a memo, then clicking auto-sort recomputes the same suggestion for the same inputs.

Steps: memoize the suggested order itself; derive the improvement boolean from it; apply that memoized order in the click handler. Keep the same optimizer and scoring rule. Remove `async` from handlers that contain no asynchronous work, if still applicable.

Acceptance: no-change cases still disable auto-sort; clicking applies the displayed inputs' suggestion; manual reordering and reset update the suggestion; saved order retains the same per-meet localStorage format.

Optional later performance work: `scoreOrder` repeatedly builds/sorts shared-name arrays just to count them. A precomputed pair-count matrix could remove repeated work, but keep this separate and verify exact ordering/tie behavior. Do not rewrite the optimizer merely because the unused graph had another one.

### C14 — Consolidate registration limits without changing the rules

**Classification:** Duplicated business rules with an unresolved inconsistency. **Priority:** Medium.

Files: desktop/mobile registration components and `lib/pdf/registration-sheet.ts`.

Evidence:

- Both registration views exempt the last three event columns with `availableEvents.slice(-3)` when counting the three-event limit.
- Both repeat per-event capacity logic: relay 4, other events 2.
- PDF certification text says relays **and IM** are exempt. Positional exemption and semantic exemption are different policies, especially for customized meets.

Steps:

1. Extract shared capacity/limit helpers, initially preserving the current rules exactly.
2. Use those helpers in both views so warnings/counts cannot drift.
3. Record the intended individual-event exemption rule as a product decision. Only then switch to semantic event classification and update the certification wording if necessary.

Acceptance: both views show identical warnings for the same data and faculty/gender filter; event toggling remains possible as currently implemented. Test custom ordering and a meet with fewer than three events. Do not assume the last three columns are always relays.

### C15 — Extract the duplicated meet event/points editor

**Classification:** Large duplicated UI plus an existing cross-state bug. **Priority:** Medium.

**File:** `app/meets/page.tsx` (900 lines at audit).

The create form and edit dialog repeat event rows, men/women checkboxes, override popovers, and global points inputs. The edit dialog's override UI currently reads `newEventPointSystems`/`newPointSystem` in places and calls `setNewEventPointSystems`, even though saving the edit uses `editEventPointSystems`.

Steps:

1. Fix edit controls to consistently use edit state in a small independent change.
2. Extract a controlled `MeetEventConfig` component receiving selected events, global points, override points, change callbacks, and an ID prefix.
3. Reuse it for create/edit; keep submission, loading, token generation, and delete handlers in the page.
4. Derive the local meet type from `Doc<"meets">` instead of a weaker handwritten interface if it fits the actual query contract.

Acceptance: edit an existing override, save, reopen, and confirm persistence. Editing must not change the create form's state. Creating must not change edit state. Checkbox IDs remain unique. Both genders, archive/reactivate, public links, and delete confirmation retain behavior.

Do not merge different defaults as a cleanup shortcut: meet creation defaults to `[7,5,4,3,2,1]`, while result scoring fallback is `[9,7,6,5,4,3,2,1]`. Legacy meets may intentionally depend on the fallback.

### C16 — Simplify repeated dashboard presentation and selection helpers

**Classification:** Active repeated UI/utilities. **Priority:** Medium.

Files: `app/page.tsx`, public meet page, `app/timing/page.tsx`, `app/event_order/page.tsx`, `components/RegistrationForm.tsx`.

Steps:

1. Share the duplicated `formatTime` formatter between dashboard/public standings; preserve `null`, `undefined`, and zero display as `-`. Timing's editable `getParts` may share numeric decomposition but still needs empty input strings.
2. Extract a small faculty ranking card for the dashboard's similar overall/men/women blocks. Pass title/description/entries; retain distinct styling and the existing public view design.
3. Compute male/female total scores once per render rather than running `reduce` inside each leaderboard row's `map`.
4. Extract a pure preferred-meet selection helper if useful. The home page already handles a deleted/invalid selection via `effectiveSelectedMeetId`; registration/timing/event-order use repeated initial-selection effects. Do not remove those effects until their consumers handle meet changes and form loading correctly.
5. Remove meaningless class names after confirmation: `custom-scrollbar` has no local definition; `flew flw-col` on the dashboard appears to be a typo, so repair the intended layout instead of calling it dead logic.

Acceptance: scores/progress widths and time strings remain identical; explicit meet selection is respected; a deleted selection recovers gracefully; public standings keep their current appearance. Avoid extracting every two-line JSX fragment.

### C17 — Simplify authentication/provider state and obsolete preview handling

**Classification:** Duplicate redirect logic / retained migration scaffolding. **Priority:** Medium.

Files: `components/AuthProvider.tsx`, `components/ConvexClientProvider.tsx`, `components/LayoutContent.tsx`.

Steps:

1. Resolve preview-route lifecycle after the PDF rewrite. If no `/preview/**` route remains, remove `isPreviewRoute`/`isPreviewPage` exceptions from auth/layout. If a development fixture remains, preserve only its deliberate access behavior. The embedded PDF preview component itself is still active and must stay.
2. Consolidate the two unauthenticated redirect effects around the initialized/loading state. The earlier effect currently redirects before saved-token initialization finishes.
3. Define a stable logout callback before effects that use it, then include correct dependencies. Do not suppress the existing `react-hooks/immutability`/dependency diagnostics.
4. Share public-route classification only if it prevents actual drift; use explicit path boundaries when adjusting it.
5. Replace render-time reads of `convexRef.current` with a stable client/state arrangement that satisfies React rules; preserve the missing-URL error and loading behavior. Clean up the client connection on unmount where appropriate.

Acceptance: login, reload with valid saved token, invalid/expired token, logout, anonymous public link, authenticated public link, and missing Convex URL all work. Avoid redirect loops or connection recreation on every render.

This application currently uses custom stored session tokens. Do not switch to JWT auth or `ConvexProviderWithAuth` just to reduce code: that would require coordinated backend/client auth changes. The current auth provider role type excludes the schema's `user` role; inspect existing users before narrowing schema roles or claiming that role is obsolete.

### C18 — Decide the future of persisted heat assignments

**Classification:** Conditional feature retirement. **Priority:** High decision, later implementation.

Files: `app/event_order/page.tsx`, `convex/meets.ts`, `convex/schema.ts`.

Evidence:

- “Generate Heats” actively calls `generateHeatAssignments`, which deletes/recreates `heatAssignments` records.
- No current UI calls `getHeatAssignments`.
- Timing, public heats, and PDFs derive their displayed assignments independently from registrations.
- Backend generation fills sequential six-person chunks; shared `assignToHeats` balances participants across heats. They can produce different allocations for the same input.
- Backend writes use `ctx.db.insert` inside a `forEach` without awaiting the promises.

Choose one direction explicitly:

**A. Derived heats are authoritative (recommended if persisted assignments have no operational consumer):**

1. Remove the Generate Heats button and its mutation hook.
2. Remove `generateHeatAssignments`, `getHeatAssignments`, and their now-unused local lane constants from `convex/meets.ts` after external-caller checks.
3. Leave the table/data intact initially. Inspect existing deployments and decide archival/removal separately.
4. If retiring the table, follow a documented Convex schema/data migration. Do not drop the schema definition while documents still exist.

**B. Persisted heats are a required feature:**

1. Keep the button/API/table and make generation use the agreed domain algorithm.
2. Await all inserts correctly and bound/batch operations as required.
3. Wire timing/public/PDF consumers to the persisted assignments intentionally, including regeneration/seed changes and relay representation.
4. Test consistent assignments across all views.

Until this decision is resolved, keep the feature path. It is inefficient and disconnected from display, but the button is a real caller, so blanket dead-code deletion would be wrong.

### C19 — Review schema compatibility, unused indexes, and auth duplication separately

**Classification:** Conditional data/API changes. **Priority:** Later.

| Candidate | Evidence | Safe next step |
| --- | --- | --- |
| Optional `registrations.meetId` and no-meet `get`/`sync` branches | All current UI callers pass a meet ID; schema comments label compatibility | Inspect legacy documents and external callers; migrate missing meet IDs before requiring the field |
| `registrations.by_externalId` | No query uses this registration-table index; sync builds an in-memory map from a meet query | Recheck operational queries before removing only this index |
| `registrations.by_studentId` | No current query uses it | Defer if ownership/orphan/cascade maintenance will need it |
| `results.by_meet_student` | No current query uses it | Compare with future result lookup needs before removal |
| `heatAssignments` table/index | Written by live button; no display reader | Resolve C18 first |
| Auth role `user` | Schema allows it; client and create-user UI focus on admin roles | Inspect existing data and intended access rules before any schema change |

Keep `students.by_externalId`: auth-independent student hydration and registration upserts use it. Do not remove an index by its name alone; distinguish indexes on different tables.

The duplicate super-admin session checks in `auth.listUsers`/`createUser` could become a typed `requireSuperAdmin` helper. Preserve expiry/role validation and response redaction. Do not add a universal auth helper to every query as an unreviewed cleanup: many business mutations currently lack server authorization, while public meet reads are deliberate. Record a separate access-control task with explicit admin/public boundaries.

Other behavior changes to track separately:

- `results.saveResult` uses an indexed query followed by `.filter(...).first()`; an appropriate composite lookup is a correctness/performance change, not dead-code removal.
- `meets.getMeetByPublicToken` scans all meets; a token index is a separate indexed-lookup improvement.
- `deleteMeet` only deletes the meet document even though confirmation text promises all associated registrations/data are deleted. Do not delete orphan students/results as incidental cleanup; decide ownership/cascade policy first.
- Unbounded `.collect()` calls need deliberate pagination/aggregation design. Replacing them with arbitrary `.take(n)` can silently truncate stats, PDFs, or full-form sync and is not a safe cleanup.

For actual schema/data migration, read `.agents/skills/convex-migration-helper/SKILL.md` and the generated Convex guidelines. Do not perform production migrations as part of a local dead-code batch.

### C20 — Establish proportionate verification and resolve adjacent bugs

**Classification:** Verification infrastructure / follow-up fixes. **Priority:** Throughout.

1. Add a `typecheck` script for the existing non-emitting TypeScript command. Enable unused-declaration flags only after C01/C04 clear their baseline failures.
2. Ignore `convex/_generated/**` in ESLint rather than modifying generated declarations.
3. Resolve lint errors in changed handwritten files; do not disable hooks/type rules project-wide. Existing unescaped JSX punctuation is a small mechanical fix; replacing every `any` belongs to C10.
4. Keep the PDF tests and add only meaningful tests for shared domain behavior being changed. For backend refactors, use the Convex testing setup required by `convex/_generated/ai/guidelines.md`; current PDF tests cannot exercise Convex handlers.
5. Fix registration synchronization in a separate behavior-focused change before aggressive form refactoring:
   - `hasLoaded` is a single boolean, so changing meets can retain the previous meet's form data.
   - The “debounced” watcher creates a timeout per change; it returns a cleanup from the watcher callback instead of explicitly managing one pending timeout. Verify actual cancellation and effect teardown rather than assuming that callback return is used.
   - Payload includes `student.age`, but the mutation validator does not accept age and the schema does not persist it. Remove this field consistently if it is obsolete, or explicitly design support; do not hide it with `any`.
   - `sync` deletes all registrations omitted from the incoming meet snapshot. Test switching/unmounting before autosave fires and concurrent edits; don't remove seemingly redundant loading guards until these behaviors are covered.
6. Review `DraftUser.password: ""` in `app/users/page.tsx`; an editable password should normally be typed as `string`. This is a type correctness fix rather than removable code.

Acceptance: no new lint/type failures, changed domain code has representative behavior tests, and form autosave never writes one meet's rows into another. Do not claim browser Indic shaping is proven by the Node tests: the PDF tests cover generation/layout and model behavior, while `document`/canvas-specific rendering still needs a real browser check.

## 5. Dependencies to keep and small dependency cleanup

| Dependency / configuration | Reason to keep |
| --- | --- |
| `regenerator-runtime` | Explicit side-effect import in `lib/pdf/layout.ts` for Indic font shaping |
| `@pdf-lib/fontkit`, `pdf-lib` | Current PDF engine |
| `tsx` | Executes `test:pdf` |
| `@base-ui-components/react` | Mobile combobox and its scroll area |
| `radix-ui` | Tabs and progress wrappers |
| Individual `@radix-ui/*` packages | Other active wrappers use them; mixing packages is not proof of redundancy |
| `vaul` | Sidebar/public drawers |
| `@dnd-kit/*` | Event-order drag and keyboard interactions |
| `bcryptjs` | Login and user creation remain active after deleting debug code |
| `tw-animate-css`, Tailwind/PostCSS | CSS imports/build pipeline use them |
| `pnpm-workspace.yaml` | Contains dependency build policy; a single app can still need this configuration |
| `.agents/skills/`, `skills-lock.json`, `AGENTS.md`, `CLAUDE.md` | Agent/tooling configuration; not application runtime bloat |

**Additional low-risk candidate:** `@types/bcryptjs`. The installed `bcryptjs` package declares `types: "umd/index.d.ts"` and ships its own declarations. Remove the redundant dev dependency with `pnpm remove -D @types/bcryptjs`, then run TypeScript to confirm resolution. Keep `@types/node`, React types, and TypeScript itself.

Do not replace pnpm with another package manager, upgrade Next.js/React, migrate Radix/Base UI, or remove the empty `next.config.ts` solely to make the repository look smaller. Those changes have different purposes.

## 6. CSS and assets: conservative follow-up

- `.paper-break-avoid` in `app/globals.css` has no application reference; remove the selector after a fresh source search.
- Keep `@media print` and active `print:*` classes initially: registration and editable timing UI still include browser-print styles even though PDF downloads use another renderer.
- Keep theme variables and dark styles unless you trace the CSS variable chain and supported styling modes. Absence of a literal TSX reference does not prove a theme token is dead.
- Large referenced logos/PNG icons are optimization candidates, not removal candidates. Both SVG logos include large embedded image data and are fetched/rasterized by the PDF generator. Asset resizing/conversion should be a separate visual-quality check.
- Keep object URL revocation, font cache retry cleanup, grapheme segmentation, missing-glyph errors, and PDF pagination guards. They are purposeful behavior in the new PDF path.
- Files such as `.next/`, `node_modules/`, and ignored `*.tsbuildinfo` are generated local caches; deleting them is not a source cleanup accomplishment.

## 7. Validation and rollback protocol

### Before starting each task

```bash
git status --short
git diff -- path/to/target-file
pnpm exec tsc --noEmit --incremental false
```

For reference checks, limit searches to source/configuration and exclude this plan from matches. Example:

```bash
rg -n 'ConflictGraph|from ["\x27]d3|import\(["\x27]d3' app components lib convex types tests
rg -n 'api\.meets\.(getHeatAssignments|updateEvents)|internal\.cleanup' app components lib convex tests
rg -n 'chart\.png|podium\.png|vercel\.svg' app components lib convex tests README.md
```

If the target changed since the audit, re-evaluate the task rather than applying stale line numbers. Anchors in the task cards are more reliable than audit-time line positions.

### After a low-risk deletion batch

```bash
pnpm exec tsc --noEmit --incremental false
pnpm exec tsc --noEmit --incremental false --noUnusedLocals --noUnusedParameters
pnpm test:pdf
git diff --check
```

Run ESLint on edited handwritten files and compare with the baseline. Run `pnpm lint` as the wider gate after relevant existing failures are resolved. A failing check should be reported with the exact cause; do not claim a clean suite because the same failure existed before.

For dependency changes, let pnpm regenerate the lockfile and confirm `pnpm install --frozen-lockfile` succeeds once the dependency batch is complete. Inspect the package/lockfile diff for unrelated upgrades or restoration of retired Puppeteer packages.

Run `pnpm build` after a coherent batch to verify Next.js routing/production compilation. Report any environment or remote-font-fetch blocker separately from source failures. Backend edits also need codegen and validation against the intended development deployment; do not deploy production merely to run a cleanup check.

### Manual checks appropriate to behavioral refactors

| Area | Required scenario |
| --- | --- |
| Login/provider | Valid credentials, reload, expiry, logout, missing URL |
| Registration | Desktop/mobile, faculty/gender filters, seed editing, meet switch, autosave/unmount, delete row |
| Meets | Create/edit both genders, edit points override, archive/reactivate, public token/link |
| Event ordering | Pointer/keyboard reorder, auto-sort, reset, per-meet persistence, PDF preview/download |
| Timing | Individual/relay result save, equal times/tied points, six lane slots, same swimmer in multiple events |
| Public meet | Anonymous access, invalid token, view/gender/event filters, relay/individual heats |
| PDFs | Empty/large meets, long names, Latin/Sinhala/Tamil, unsupported glyph error, repeated headings, complete rows |
| Gallery | Create/edit album, manual cover URL, fetched cover, delete, date selection |
| Users/navigation | Super-admin access, account creation, mobile drawer and collapsed sidebar |

Use a development deployment and representative fixtures. Do not execute destructive maintenance functions or use real-data deletes as a test.

Rollback should reverse only the cleanup task's patch/commit. Never use `git reset --hard`, `git clean -fd`, or blanket file restoration in this already-dirty working tree. Source rollback does not restore deleted database documents; that is why data removal is separated from source cleanup.

## 8. Copyable prompt for Luna

```text
Read AGENTS.md and CODE_CLEANUP_PLAN.md. Implement only task <TASK_ID>.

Before editing, inspect git status and the existing diff of each target file.
Preserve the current PDF rewrite and all unrelated user changes.
Recheck the task's evidence against current source. Next.js routes and Convex
functions are entry points; no local import alone does not prove they are dead.
Read convex/_generated/ai/guidelines.md before modifying Convex code.

Follow the task's listed scope and acceptance criteria. Do not introduce
unrelated refactors, dependency upgrades, authentication migrations, database
deletions, production deployments, or generated-file edits by hand.
For conditional steps, record unresolved caller/data/feature dependencies and
continue any independent authorized work; do not invent their answers.

Run the checks appropriate to this task. Report files changed, behavior
preserved, exact check results, and remaining blockers. Update the task's
progress entry only when its acceptance criteria actually pass.
Stop after this task; do not automatically implement the next task.
```

For the first run, replace `<TASK_ID>` with `C01`. Subsequent runs should use one ID at a time. For C18, include the chosen authoritative heat strategy. For C14, include the confirmed event-limit policy before making a behavior change.

## 9. Progress tracker

The audit above is historical. The tracker below records the C03–C20 implementation on 2026-10-02; “Local complete” means source and automated checks passed, with authenticated browser/release checks still listed in the execution report.

| Task | Status | Verification / decision notes |
| --- | --- | --- |
| C01 Unused graph/D3 | Complete | Deleted the unused `ConflictGraph` component and removed `d3` / `@types/d3`; source search found no remaining references; `pnpm exec tsc --noEmit --incremental false` and `git diff --check` passed. Existing event ordering/rest UI was left intact. |
| C02 Unused UI files | Complete | Removed `components/ui/form.tsx`, `input-group.tsx`, and `sheet.tsx`; source/config search found no consumers or registry references; `pnpm exec tsc --noEmit --incremental false` and `git diff --check` passed. Existing registration, gallery, meet, and drawer implementations remain in place. |
| C03 Unused helpers/types | Local complete | Removed unused conflict-map helper/interface and stale types; constants and rest optimizer retained. |
| C04 Small declarations/comments | Local complete | Removed unused imports/types/variables and obsolete auth/album comments. Explicit user projection continues to redact passwords. |
| C05 Assets/README | Local complete | Deleted three locally unreferenced assets; README now describes browser pdf-lib, Next.js 16.0.7, pnpm and current test/docs links. External asset consumers cannot be verified locally. |
| C06 Debug password-reset API | Local complete; release pending | Converted fixUser to internalMutation to retain trusted recovery while removing public access. Generated bindings refreshed; production backend release remains necessary. |
| C07 Unused backend APIs/maintenance | Reviewed; conditional APIs retained | No UI updateEvents/getHeatAssignments callers; getHeatAssignments has a configuration-test caller; external callers unknown. clearAll retained as documented internal maintenance, now deletes/schedules batches of 100. Never executed. |
| C08 Dashboard required-meet query | Verified existing implementation | Current getStats directly fetches required meet and returns zero/empty totals if absent; regression test added. |
| C09 Public-dashboard unused map | Verified existing implementation | Current public dashboard has no unused student map; shares active leaders aggregation. |
| C10 Accurate shared types | Local complete | Neutral shared registration schema, generic nullable heat assignments, generated query-derived result/meet/auth types; renamed MobileRegistrationForm; formKey separates RHF keys from domain IDs; seed input coerces numbers. |
| C11 Shared participant/grouping logic | Local complete | Timing consumes PDF program builder; relayTeams shared with public view. Preserved public first-member seed/gender filter, stable team identities, women-first and mixed grouping. Empty events now render one blank heat. |
| C12 Shared leaderboard aggregation | Verified existing implementation | Public/admin dashboard already share leaders(). Sidebar preserves its zero-point and No Team fallback policy; no forced behavior merge. |
| C13 Reuse optimizer suggestion | Local complete | Memoized suggestion used both for improvement state and Auto-sort; persistence path unchanged. |
| C14 Shared registration limits | Local complete | Desktop/mobile share semantic relay/IM exemption and four-relay/two-individual capacities, preserving the current migrated policy. |
| C15 Shared meet editor | Verified existing implementation | Create/edit already use MeetConfigurationFields. Edit uses editEventPointSystems and setEditEventPointSystems; narrowed Meet to actual query return type. |
| C16 Dashboard/utilities | Local complete | Shared time formatter preserves compact public display; extracted ranking card computes totals once; shared preferred meet helper; repaired flex typo and removed undefined scrollbar classes. |
| C17 Providers/preview exceptions | Local complete; browser scope limited | Session external store consolidates redirect flow and supports storage events. Client state replaces render refs with disposal. All preview routes disappeared from final working tree, so preview exemptions removed; embedded PDF preview retained. Login and anonymous protected-route redirect checked. |
| C18 Persisted heat strategy | Reviewed; decision retained | Generate Heats is active, so button/API/table retained. Current writes already await inserts. Derived/persisted authority and external readers unresolved; no data/schema retirement. |
| C19 Schema/index/API compatibility | Local helper complete; data decisions deferred | Shared typed super-admin guard used by listUsers/createUser. Retained compatibility fields/indexes/roles and heat data. results.by_meet_student is now actively used for deletion protection. |
| C20 Verification and adjacent fixes | Local complete; authenticated validation pending | Added typecheck/domain scripts, enabled unused flags, ignored generated lint. Registration clean forms follow subscriptions; one timer/serialized saves with snapshot conflict checks and explicit draft recovery. Meet switch blocked while dirty/saving; age removed. See execution report for checks and remaining sync work. |

Definition of completion: selected tasks meet their acceptance criteria; required checks are reported honestly; visible features and data contracts survive; dependencies match their consumers; conditional items remain explicitly tracked rather than being silently deleted.
