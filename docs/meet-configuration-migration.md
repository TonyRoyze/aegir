# Meet configuration rollout

`meetTeams` and `meetEvents` own each meet's ordered configuration. Teams store only a code, meet ID and order. Codes are local to the meet. No global team catalog is
created. Registration `teamId` and `meetEventIds`, result `meetEventId` / `teamId`,
and heat `meetEventId` hold stable identities. Display strings are produced at
the UI/PDF boundary; the existing string fields remain compatibility snapshots.
Student `faculty` is retained for legacy reads and is never changed by team
selection. Editing a meet backfills its references before applying renames.

## Deployment and backfill

1. Deploy the widened schema, migrations component and updated functions together
   with the application. Use the normal deployment for the intended environment.
   Code generation alone does not deploy the application or migrate data.
2. In the intended Convex deployment, dry-run each migration before writing:

   ```sh
   pnpm exec convex run migrations:configureMeets '{"dryRun":true,"cursor":null}'
   pnpm exec convex run migrations:registrationReferences '{"dryRun":true,"cursor":null}'
   pnpm exec convex run migrations:resultReferences '{"dryRun":true,"cursor":null}'
   pnpm exec convex run migrations:heatReferences '{"dryRun":true,"cursor":null}'
   ```

   A dry run intentionally throws after showing one batch so nothing commits.
   Inspect any conversion errors; legacy labels must contain a distance and
   stroke, for example `W:4x25m Freestyle Relay`. Missing or ambiguous legacy
   events need correction before continuing. Dry-run rollback and each backfill
   are covered by `pnpm test:config`.

3. Start the resumable, sequential backfill:

   ```sh
   pnpm exec convex run migrations:runAll
   ```

   Append `--prod` only when deliberately targeting production. Follow the
   component's migration status in the Convex dashboard until all four migrations
   are complete. Failed runs resume their unfinished batch when run again.

4. Verify representative registration, timing, results, public leaderboard and
   PDF screens. Confirm renaming a team code/event preserves its entries and results,
   and that the same swimmer can represent different teams in different meets.
   Inspect older registrations without `meetId` separately: the migration leaves
   these untouched because there is no safe way to infer their meet.

## Compatibility and limits

The first deployment retains all legacy fields. Do not remove them or narrow the
schema until the migration completes and all consumers use the new identities.
The current synchronous UI supports 100 teams/events per meet, 1,000 registrations
per meet, and 5,000 results or heat rows per meet. Larger meets require a paginated
workflow rather than silent truncation. The meet picker supports 200 meets.

Removing teams/events with entries or recorded results is rejected; reassign or
remove those entries first. Meets with records can be archived. Event gender
changes that conflict with existing swimmers are rejected. Relays keep a separate
leg count; mixed/open events share a heat group and are available to both genders.

Run `pnpm test:config`, `pnpm test:pdf`, `pnpm exec tsc --noEmit`, and `pnpm build`
when changing the configuration adapters or generators.
