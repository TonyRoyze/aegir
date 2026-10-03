# Shared event order and reliable registration sync

Implementation plan for Aegir, reviewed **2026-10-02**. Intended for incremental implementation with a model such as Luna. This document proposes changes; it does not implement or deploy them.

## 1. Expected behavior

- Event order belongs to a meet and persists in Convex. Logged-in users viewing that meet receive committed changes automatically.
- Dragging, auto-sort, and reset use the same shared order. Timing, program previews/downloads, and event lists use that order consistently.
- Registration edits appear in another user's open registration page without a reload.
- Editing one row cannot overwrite another user's unrelated edits or delete rows omitted from an outdated browser snapshot.
- Remote updates do not erase text someone is currently typing. Same-field conflicts are visible and resolvable.
- The UI distinguishes unsaved changes, saving, saved, disconnected, failed, and conflicting changes.

Recommended priority: **stop destructive registration snapshot overwrites first**, then complete shared ordering and collaborative form reconciliation. These are functional fixes; keep them separate from general code cleanup.

## 2. What the current code establishes

These findings come from source inspection and the baseline checks recorded under S01 below. The reported bug has not yet been reproduced in two authenticated browser sessions, so distinguish confirmed code defects from the exact symptoms a user experiences.

### Event order

| Location | Current behavior | Consequence |
| --- | --- | --- |
| `lib/program-event-order.ts` | Stores string labels under `aegir-program-event-order:<meetId>` in localStorage | Browser-local persistence; other users/devices cannot see it |
| `app/event_order/page.tsx` | Drag/auto-sort call local storage helpers; reset removes the browser entry | No backend mutation for order |
| `app/timing/page.tsx` | Reads localStorage to select ordered events | Can disagree with another browser and lacks a reactive subscription to local storage changes |
| `convex/meetConfiguration.ts` | Configured events have IDs and are sorted by their `order` property | An existing canonical configuration order is available as the default |

The working tree now contains an in-progress migration to `meetTeams`/`meetEvents`, `configuredEvents`, and ID-based registrations/results. **Build on this work. Do not add a second label-only event catalog or undo the migration.**

### Registration

| Finding | Evidence | Effect |
| --- | --- | --- |
| Remote changes stop reaching the form after initialization | `form.reset({ registrations: remoteData })` only runs when `!hasLoaded` | The Convex subscription may update, but the visible form retains old data |
| Saves replace a whole meet snapshot | Frontend sends every populated row to `registrations.sync`; backend deletes rows absent from that payload | A stale browser can overwrite edits and remove another user's newly added rows |
| Pending debounce is canceled, but in-flight writes and drafts have no queue | `RegistrationForm` clears its timer on edits and effect cleanup; once `syncData` starts, it is fire-and-forget except for an alert on rejection | Meet switches cancel unsent work, while accepted/in-flight snapshots have no generation tracking or visible saved state |
| Save errors are only surfaced as transient alerts | The mutation promise has a `.catch(...)`, but no persistent per-row save/error state | Users cannot tell which draft failed or retry it reliably |
| Seed input may be a string at runtime | The form schema declares `z.number()`, but the input registration does not use `valueAsNumber`; the mutation accepts `number|string` and converts it | Form state and submitted payload can disagree about seed type |
| Team identity and event identity are only partly carried by the client | The form submits `teamId`, but event selections remain string labels; the backend resolves those labels to configured event IDs | Stable event IDs are stored, but stale/renamed labels can still fail to resolve |
| Domain IDs and field-array IDs coexist | Rows have a domain `id`, while desktop/mobile React keys use the generated field-array `id` | New APIs must use the domain ID and never persist the React key |

### S01 execution notes — 2026-10-02

- Inspected `git status` and diffs before work. The working tree contains an in-progress PDF rewrite and meet configuration migration; neither was reverted or edited for S01.
- The app port 3000 belongs to `/Users/vidura/Code/travel-buddy` and serves “Travel Buddy,” not Aegir. The collaborative preview was opened, but snapshot automation failed twice. No authenticated Aegir sessions were available, so the required two-session browser repro remains **unverified**; no credentials or participant data were captured.
- Exact reproduction procedure for the next two authenticated Aegir sessions: open the same meet's registration page in sessions A and B; in A edit a populated row's name or event and wait more than one second; leave B open and check whether that change appears; then in B edit a different row and wait more than one second; inspect both open pages and reload both. Repeat with team and seed changes, then delete/add a row in A while B is stale. Finally start an edit in A and switch meets before the one-second debounce expires. Record each UI value, row count, and mutation result, without logging tokens or unnecessary swimmer details.
- Baseline checks: `pnpm exec tsc --noEmit` passed; `pnpm test:config` passed (1 file, 5 tests); `pnpm test:pdf` failed (3/4 tests, the meet-program test throws `Cannot read properties of undefined (reading 'heats')` at `tests/pdf-generation.test.ts:77`); `pnpm lint` failed (34 errors, 20 warnings across the working tree).
- Source-confirmed defect: `convex/registrations.sync` upserts every supplied registration and deletes every existing registration omitted from the submitted array. The exact two-user loss scenario remains unverified in a browser until sessions are available.

The meet selector **does reset `hasLoaded` to false**. That is already present. The remaining switch risk is pending timers/subscriptions/drafts carrying state across meet changes, not simply a missing reset in the selector. This corrects the broader warning in the earlier cleanup plan.

Backend student records are shared across meets; team membership is now registration-specific. A plan that protects only a registration document can still overwrite shared student name/seed fields. Handle both entities explicitly.

## 3. Architecture decisions

### A. Keep configuration order and program order separate

Recommended: retain `meetEvents.order` as the configured/default order and store a program-order override in a new per-meet document. This preserves reset-to-default behavior and prevents saving the meet editor from silently undoing a program reorder.

Proposed `meetProgramOrders` table:

| Field | Type / purpose |
| --- | --- |
| `meetId` | `Id<"meets">` |
| `eventIds` | Array of `Id<"meetEvents">`, maximum current `MAX_MEET_ITEMS` (100) |
| `revision` | Increasing integer used to reject stale reorder attempts |
| `updatedAt` | Server timestamp |
| `updatedBy` | User ID derived from a validated session, optional if omitted for simplicity |

Index: `by_meetId`. One document per meet is maintained transactionally; an index alone is not a uniqueness constraint. Read using `.unique()` and insert/update within the same mutation.

This is a bounded event-order array, not an unbounded participant list. Do not place registration rows in it. Keep order independent of the entire `getMeets` subscription using a dedicated per-meet query.

When the document is absent, return configured/default order with revision `0`. For an unmigrated meet, return a read-only legacy label projection; materialize stable event IDs through the existing migration/`ensureConfiguration` path before accepting the first reorder. Queries must not perform writes.

Do not use `configurationVersion` as a concurrency counter: it currently identifies the configuration migration format, not each edit.

### B. Use targeted registration operations

Retire whole-list autosave in favor of:

- Create one registration with a stable client-generated ID.
- Patch only explicitly edited student/registration fields.
- Add/remove an event membership by event ID, rather than replace all memberships from an old snapshot.
- Delete exactly one requested registration, retaining the existing recorded-result protection.

Absence from a browser payload must never mean deletion.

For scalar fields, compare each submitted field's base value with its current persisted value before writing. Independent fields can then merge, while two users editing the same field produce a conflict. This comparison happens in the mutation transaction; frontend checking alone is insufficient.

Convex supplies atomic transactions and retries transaction-level races. An application still needs to detect stale browser intent: retrying a transaction containing an old full-form snapshot does not make that snapshot current. See [Convex OCC and atomicity](https://docs.convex.dev/database/advanced/occ).

### C. Reconcile subscriptions by stable identity

Maintain a server baseline and a local edit overlay keyed by domain registration ID. Use React Hook Form to edit values, but do not identify edits by their temporary array positions or RHF-generated keys.

Unedited fields follow the server. Dirty/pending fields retain local drafts until acknowledged or resolved. Additions/deletions from other users update the row list without moving a user's draft to a different swimmer.

## 4. Implementation tasks

### S01 — Capture reproductions and align with current migration

Files: registration/event-order pages, `convex/meetConfiguration.ts`, migration/test configuration.

1. Inspect current `git status` and target diffs; the repository is actively changing. Preserve the PDF rewrite and meet configuration migration.
2. Read `convex/_generated/ai/guidelines.md` before backend work. Use `.agents/skills/convex-migration-helper/SKILL.md` for nontrivial backfills.
3. Record exact repros using two different logged-in browser sessions against the same development deployment and meet.
4. Repro: A changes a name/event; B leaves the page open; B changes another row; inspect both views and persisted data. Also test team choice, seed edits, deleting/adding a row, and switching meets before the save delay expires.
5. Inspect mutation failures and captured payload shapes without recording passwords/session tokens or unnecessary participant data in logs.
6. Record the baseline type/test/lint results. Existing scripts currently include `test:pdf`; testing dependencies may already be installed by the ongoing migration, so inspect before adding duplicates.

Acceptance: a reproducible scenario and observed failures are recorded. A source-based finding must remain labeled as such until browser behavior is checked.

### S02 — Add backend session authorization for the new write APIs

Suggested file: `convex/sessionAuth.ts`.

The app uses custom `aegir_session` tokens stored in the `sessions` table, not configured JWT identities. Validate the supplied session token on the server with `sessions.by_token`, expiry, and the associated user. Derive the actor ID from that lookup. Never authorize writes using a client-provided user ID or a hidden UI button.

Apply the helper to new order/registration mutations. Preserve the existing admin/super-admin editing behavior unless a different role policy is specified. Session expiry should reject a save and leave the draft visibly unsaved.

Do not call `ctx.auth.getUserIdentity()` and assume it identifies these custom sessions. A JWT migration is separate work. Existing intentionally public meet queries retain read-only access; do not expose admin session metadata through them.

Acceptance: expired/missing/invalid tokens and unauthorized roles cannot write; authorized users can. Public meet viewing continues to work without login.

### S03 — Implement persistent event-order APIs

Files: `convex/schema.ts`, proposed `convex/programOrder.ts`, `convex/meetConfiguration.ts`, `lib/meet-configuration.ts`.

Proposed contracts:

| API | Input | Result |
| --- | --- | --- |
| `programOrder.get` | `meetId`, session token for admin read | `{ eventIds, orderedEvents, revision, isOverride, editable }` |
| `programOrder.set` | `meetId`, token, `eventIds`, `expectedRevision` | Accepted order and new revision, or structured conflict |
| `programOrder.reset` | `meetId`, token, `expectedRevision` | Default order and new revision |

`orderedEvents` is a derived label projection for existing heat/PDF consumers. IDs are authoritative. Do not maintain an independently writable label order.

Mutation rules:

1. Authenticate, confirm the meet exists, and load its actual event configuration.
2. Ensure stable IDs exist using the agreed migration path. If initialization changes the configuration, return a refresh-required result rather than pretend submitted legacy labels are IDs.
3. Require a full permutation of current event IDs: no duplicates, missing entries, foreign-meet IDs, or unknown IDs. Enforce the 100-event limit.
4. Compare `expectedRevision` with stored revision. On mismatch return a conflict/current order without writing. Do not automatically replay an old full permutation against a new revision.
5. Patch only order-related data and increment revision atomically. Do not replace the meet document or rewrite registration/results/configuration.
6. A no-op order change can return the current revision without a write.
7. Reset must write/retain a revisioned document with default order. Do not delete the document and reset revision to zero; that would allow an old revision-zero request to pass again.

Configuration integration:

- On event addition/removal, reconcile stored order in the same configuration transaction: preserve surviving IDs' relative order; append new IDs in default order; remove retired IDs; increment order revision if the effective order changes.
- A rename keeps the same ID and changes its label projection, retaining position.
- Meet deletion removes the per-meet order document according to the existing delete workflow.
- Meet configuration edits using stale event lists must be separately validated/versioned; an order mutation must not be used to save the configuration editor's whole state.

Acceptance: two stale reorder requests cannot silently overwrite each other; foreign events are rejected; rename/add/remove/reset behavior remains deterministic.

### S04 — Connect every order consumer

Files: `app/event_order/page.tsx`, `app/timing/page.tsx`, meet/public queries, program preview/PDF inputs, and a shared hook such as `hooks/use-meet-program-order.ts`.

1. Subscribe to the dedicated order query for the selected meet.
2. Drag/auto-sort/reset invoke the backend APIs, all using event IDs. Convert to label strings only when calling current rest/PDF utilities.
3. Keep responsiveness with either a Convex optimistic update or a small explicit pending-order overlay. Prefer one mechanism; two competing optimistic stores complicate reconciliation. See [Convex optimistic updates](https://docs.convex.dev/client/react/optimistic-updates).
4. Serialize/coalesce local reorder requests per meet. For the first implementation, disabling further saves while one request is pending is acceptable and easier to verify.
5. On conflict, use the latest server order and show that another user changed it. Preserve the attempted order as a draft if offering an explicit reapply action. Do not show “saved” until the write succeeds.
6. Handle query updates received during an active drag: defer display replacement until drag ends, retain the drag's base revision, and let the server conflict check resolve stale intent.
7. Remove normal localStorage read/write usage from event-order and timing. Neither should fall back to a browser override when a backend query temporarily loads.
8. Feed preview/download the same order. If an order save is pending/conflicted, disable final export or clearly require saving first; never silently export a different order from the other user's saved program.
9. Expose shared ordered labels in the existing public-token projection for public event selectors. Public reads are authorized by the public-link policy and do not reveal editor identity/session details.

Public event ordering does not require changing lane/heat allocation. Keep the separate persisted-heat decision from the cleanup plan out of this task.

Acceptance: A reorders, B sees the new order while staying on the page; timing and PDFs match; reload/new device sees the same state; public event lists reflect it.

### S05 — Migrate browser-only order deliberately

The server cannot discover localStorage values on other users' browsers, and different browsers may contain different orders.

Recommended default: use configured order as the shared initial order. Offer an explicit **“Use this browser's saved order”** action to an authorized user only while no shared override has been established.

1. Read the old browser value only for that import action.
2. Normalize labels and map them to the current event IDs using unambiguous current/legacy labels. Reject ambiguous mappings; append missing current events in default order.
3. Submit through the normal revision-checked mutation at revision zero. Two users importing simultaneously must not overwrite one another.
4. Remove the old browser key only after successful import. Dismissal can retain it temporarily for recovery, but it must not influence the displayed shared order.
5. Document the retention period and remove obsolete helpers once recovery is no longer needed.

Acceptance: no automatic first-browser-wins publishing, no silent loss of an existing shared order, and no resurrected local override after a reset.

### S06 — Add targeted registration backend APIs

Files: `convex/registrations.ts`, `convex/schema.ts`, session helper, configuration helper, and shared validated input types.

Suggested API boundary:

| Operation | Required behavior |
| --- | --- |
| `create` | Meet-scoped idempotent creation using a client-generated domain registration ID; validate team/events; do not create an empty draft automatically |
| `patch` | Explicit scalar fields plus expected base values; compare/write only touched fields; return accepted canonical values or conflicts |
| `setEventMembership` | One registration/event ID and desired membership; read the current membership set and add/remove that ID without replacing unrelated events |
| `remove` | Explicit registration ID and expected row/student versions; verify meet ownership and existing result-removal restriction |
| `get` | Include domain registration ID, student identity, canonical team/event IDs, and revision metadata required by clients |

Design details:

1. Use the registration's actual meet ID for ownership checks. Every submitted team/event must belong to that meet. A global student ID does not establish registration ownership.
2. Add a compound lookup index such as `by_meetId_and_externalId` for existing stable external row IDs, or expose/use Convex registration document IDs consistently. Keep client-generated IDs for create retries.
3. Make create idempotent: finding the same row ID does not authorize overwriting its latest data. Return the existing row or a clear conflict according to the original request; avoid duplicate students on repeated creation.
4. Allow only named patch fields. Separate shared student fields (`name`, `nameInUse`, registration number, gender, seed) from meet-specific registration fields (`teamId`, event memberships). Never accept an arbitrary database patch object.
5. Normalize before comparing expected/current values; use explicit null semantics for clearing optional fields and preserve legitimate seed zero. Omitted fields mean unchanged, not cleared.
6. Compare touched scalar fields atomically with their submitted base values. If a current value already equals the desired value, acknowledge it as an idempotent no-op. Otherwise a differing base value returns a field conflict and performs no partial write for that request.
7. Add optional `revision` fields to registrations/students, defaulting absent values to zero. Increment them on actual changes through every supported writer. Use versions for safe deletion and acknowledgements; scalar merges should compare touched fields so independent fields on one row can still succeed.
8. Student changes are global under the current schema. Reconcile/test another meet's view of that student and validate gender changes against that student's affected registrations through a bounded/indexed workflow. Do not let a gender edit invalidate other existing event entries silently.
9. Preserve current team/gender validation, supported-size guards, result-removal rules, ID-based memberships, and legacy label adapters. Do not write team choice back to global faculty.
10. All creation, student upsert, and row update steps belonging to one request must be atomic. Do not split into actions or separate client mutations that can leave half-saved rows.

Use structured error/result codes for conflict, missing row, invalid team/event, session expiry, and upgrade-required. Return only the necessary current field data, never credentials.

Acceptance: unrelated row/field edits both survive; conflicting scalar edits are reported; add/remove one event preserves other users' different event choices; deleting one row never deletes another.

### S07 — Replace registration autosave with an explicit edit queue

Suggested hook: `hooks/use-registration-sync.ts`, used by both desktop/mobile views.

State per domain row/field: server base value, local draft value, generation number, pending request, save status, and any conflict. The queue must capture meet ID and actor/session context when an edit is made.

1. Text/numeric changes can debounce for 300–500 ms; event clicks and explicit row removals can save immediately. Debounce one pending edit batch per row, not a full-meet snapshot.
2. Keep actual timer handles in refs and explicitly cancel/replace them. Effect cleanup cancels pending timers and unsubscribes. Returning a cleanup from the `form.watch` callback is ineffective in the installed RHF code.
3. Prefer explicit change handlers for persistence intent, including event toggles/add/remove. A form subscription may observe changes, but do not assume `info.name` exists for every field-array/programmatic operation.
4. Await every mutation and handle errors. A fire-and-forget promise cannot drive accurate “Saved” status.
5. Serialize pending requests for the same row. Coalesce a newer unsent change, but never erase a later local edit when an earlier request resolves.
6. Acknowledgement clears only the generation/value actually accepted. If typing continued during the request, keep the newer draft and its original expected baseline until the accepted server result updates it.
7. Programmatic hydration/reconciliation must not enqueue writes. Suppress hydration notifications and update baselines before exposing the merged form values. Compare normalized data to avoid echo loops.
8. Create empty rows as local drafts with stable domain IDs. Persist once minimum backend requirements are met. Do not rely on filtering all blank rows out of a snapshot to distinguish deletions.
9. Normalize numeric seed inputs with `setValueAs` or an equivalent explicit parser: empty means absent, finite numeric values remain numbers, zero follows the agreed seed rule. Avoid `NaN` and string-number drift.
10. Remove obsolete `age` from form/payload contracts if no feature uses it; do not send fields the backend does not accept.
11. Add user-visible per-row errors and a compact pending/saved summary. Provide retry and conflict resolution actions that preserve drafts.

Acceptance: quick successive edits produce one coherent batch, failure remains visible, and later local typing cannot be marked saved by an earlier response.

### S08 — Reconcile incoming rows with unsaved drafts

Files: registration form, mobile form, shared types/sync hook.

Algorithm keyed by domain registration ID:

1. Receive current server rows; retain a previous server baseline for comparisons.
2. For each clean field, apply the newest server value.
3. For each locally dirty/pending field, retain the draft. If the server changed that same field away from its base and it is not an acknowledgement of our request, mark a conflict.
4. Add new remote rows and preserve local-only draft rows; don't attach drafts to array indexes after insertion/reordering.
5. Remove remotely deleted clean rows. If a deleted row has a local draft, show “This registration was removed”; block update/upsert and require an explicit user decision. Never resurrect it automatically.
6. Resolve conflicts with “Use saved value” or explicit “Apply my edit.” Reapply must start from the current server base and still pass normal authorization/validation; do not disable conflict detection.
7. Recompute visible counts/warnings from the merged values. Filter by current watched team/gender, rather than solely by `useFieldArray.fields` snapshots.
8. Use a shared schema/type for desktop/mobile; distinguish `registrationId` from a generated `formKey`. Rename or adapt the array's ID field deliberately rather than persisting RHF's key.

Do not solve this with `form.reset(remoteData)` on every query update: it can erase typing. `keepDirtyValues` alone also does not define correct merging when array membership/positions change. Prefer stable-ID reconciliation and explicit intent tracking. RHF provides reset options, but application reconciliation must still map the correct row; see [React Hook Form's official type definitions](https://github.com/react-hook-form/react-hook-form/blob/master/src/types/form.ts).

Configuration UI alignment:

- Use `selectedMeet.teams` and stable `teamId` for filtering/new rows; keep legacy faculty labels as display adapters only.
- Use `configuredEvents` IDs for selection, including the intended mixed-event rules. Do not filter legitimate mixed events out merely because they lack an `M:`/`W:` prefix.
- A team/event removed or changed while editing produces a visible validation/conflict result; do not silently drop the user's selection.

Acceptance: B sees A's edits immediately for clean fields; B's typing survives; inserted rows do not shift drafts; desktop/mobile show the same merged data.

### S09 — Handle meet switching, reconnects, and unsaved work

1. Use a meet-keyed editor/controller so each meet owns its baseline, timers, and pending edits. Ignore late completions from a different controller generation for the current UI.
2. Pending work keeps its captured original meet ID. Never build a queued request using whichever meet happens to be selected when a timer fires.
3. On meet switch, flush valid edits and await completion, or retain a visible per-meet draft when flushing fails. Cancel leftover timers. Choose one consistent policy and test it.
4. Switching faculty/team or gender only changes the visible subset. It must not discard or delete hidden rows.
5. Disconnected edits remain visibly pending; reconnect first refreshes the server baseline and applies normal stale-intent checks. Do not assume offline full-snapshot replay is safe.
6. Scope initial guarantees to the current open tab/session. If draft recovery after reload is required, persist a versioned local edit journal keyed by deployment/meet/user identity, excluding the token. It is recovery data, not authoritative shared state.
7. Warn before closing with unsaved changes where the browser permits it. Do not rely on an unload handler to finish network saves. Logout/session changes must not replay one user's drafts as a different user.

Acceptance: switching meets during the debounce/in-flight window cannot write rows to the wrong meet; reconnect produces no silent overwrites; errors keep recoverable drafts visible.

### S10 — Roll out without an old-client overwrite path

Files: schema/migrations, legacy `registrations.sync`, new APIs/client, existing deployment workflow.

1. Widen: add the new table/indexes and optional revision/write-mode fields; deploy APIs that can read legacy records. New rows write the new format.
2. Integrate with the existing meetTeams/meetEvents migration rather than running competing conversion jobs. Use resumable batches/dry runs for nontrivial legacy backfills; inspect `convex/migrations.ts` if added by the ongoing work.
3. While legacy `sync` remains supported, make it increment revisions too. Revision bookkeeping alone does **not** make old full snapshots safe.
4. Add an explicit server-side compatibility barrier, for example optional `registrationWriteMode: "operations"` on meets. Once a meet uses the new collaborative writer, legacy `sync` must reject with an upgrade-required result **before any write/delete**. An old tab cannot be allowed to bypass the new protocol.
5. Activate the barrier and new client coherently in the deployment rollout. Test old-tab requests against the new backend. Refresh guidance must accompany rejected legacy writes.
6. Keep legacy schema fields/adapters until backfills and consumers are verified; narrow later. Do not delete data or require missing revision fields prematurely.
7. Rollback must preserve new order documents/IDs and the legacy-write barrier. Returning to a UI that only supports unsafe `sync` requires read-only mode or a compatible fix, not reopening destructive writes.

Acceptance: old tabs cannot remove new-client rows; migration is repeatable; existing registrations/results survive; rollback does not re-enable silent data loss.

## 5. Test matrix

Backend: use `convex-test` with Vitest/edge runtime and the required module map described in generated guidelines. UI: exercise two independent logged-in sessions, not just two components sharing one client cache.

| Scenario | Required result |
| --- | --- |
| A saves an order; B remains open | B receives the committed order; reload preserves it |
| A/B submit different orders from the same revision | One succeeds; the other receives conflict/current order |
| Reorder/reset request repeats or fails | No revision regression; visible retry/conflict state |
| Event rename/add/remove while another user drags | IDs preserve rename position; membership reconciles; stale permutation rejected |
| LocalStorage import races with another order write | Cannot overwrite an established shared order |
| A edits row 1, B edits row 2 | Both survive; neither full list replaces the other |
| A edits name, B edits seed on the same row | Independent touched fields merge |
| A/B edit the same name from one base | One gets a visible conflict; no silent overwrite |
| A adds event X, B adds event Y | Both memberships survive |
| A and B submit opposing membership intents for X | Commit order defines membership; all clients converge; no unrelated events lost |
| A inserts/deletes a row while B types elsewhere | Stable-ID draft remains on the correct swimmer |
| A deletes a row while B edits that row | B sees removed-row state; no automatic resurrection |
| B has an invalid team/event, or expired session | Error displayed; draft retained; no partial write |
| Student edited through a different meet | Shared fields update/conflict correctly; team stays meet-specific |
| Seed cleared/zero/typed invalid input | Deterministic numeric contract; no silent rejection/NaN |
| Rapid typing, then meet switch/unmount | Timers canceled/flushed appropriately; no wrong-meet save |
| Query hydration or acknowledgement | Does not trigger another autosave loop |
| Disconnect/reconnect; edit during in-flight request | New draft survives acknowledgement; stale intent checked |
| Legacy snapshot sent after operation-mode activation | Rejected before patch/delete |
| Timing/PDF/public selector after reorder | All consume shared order; no local override leakage |

Run type checking, tests for these contracts, PDF regression tests, lint on changed files, and production build. Use the actual migration/test configuration present at implementation time. Do not claim browser sync is verified solely because backend/unit tests pass.

## 6. Work breakdown for Luna

| Batch | Tasks | Deliverable |
| --- | --- | --- |
| 1 | S01–S02 | Reproduction evidence and tested authorization helper |
| 2 | S06 | Targeted registration operations and backend conflict tests |
| 3 | S07–S09 | Reactive draft-preserving editor, save status, two-session tests |
| 4 | S03 | Event-order storage/APIs and configuration integration tests |
| 5 | S04–S05 | Shared order consumers and deliberate local order import |
| 6 | S10 | Compatibility barrier, migration validation, rollout/rollback notes |

S10 must be designed alongside batch 2 and enforced before releasing collaborative writes; its later batch is final rollout verification, not permission to keep an unsafe legacy endpoint active in production.

Copyable prompt:

```text
Read AGENTS.md, convex/_generated/ai/guidelines.md, and REALTIME_SYNC_PLAN.md.
Implement only task <SXX>, including the tests and acceptance criteria stated.
Inspect current files/diffs first: preserve the ongoing PDF and meet configuration
migrations. Use stable meetEvents/team/registration identities, not old label-only
snapshots or React Hook Form-generated keys.

Do not implement full-list registration autosave, unconditional form reset on each
query update, automatic localStorage order publishing, or blind stale-save retries.
Validate custom session tokens server-side; do not assume JWT auth is configured.
Report exact checks, two-session observations when relevant, unresolved decisions,
and the next dependency. Do not perform production deployment or data removal.
```

## 7. Completion criteria and scope

- Shared order survives refresh/device changes and agrees across open user sessions and consumers.
- Registration subscribers display clean remote updates while preserving local drafts.
- Targeted operations eliminate deletion-by-omission and unrelated snapshot overwrites.
- Failed saves, stale edits, and disconnected states are visible; conflict handling is tested.
- Legacy clients cannot bypass the operation protocol after activation.
- Existing PDF behavior, result constraints, meet-team/event migration, and stored records are preserved.

This plan supersedes localStorage persistence assumptions and the registration-sync recommendations in `CODE_CLEANUP_PLAN.md` (especially C13, C16, C19, C20). Follow this functional plan before deleting related helpers or restructuring those screens. Deferred work includes presence indicators, edit locks, CRDTs, authentication-provider migration, and changing the heat-allocation strategy; none is necessary for the initial shared-state fix.
