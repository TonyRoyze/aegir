# Aegir

Swimming meet management built with Next.js 16.0.7, React, TypeScript and Convex. The app manages meet teams/events, registrations, results, standings, galleries and competition documents.

## Development

Install dependencies with the project's lockfile:

```bash
pnpm install --frozen-lockfile
```

Configure `.env.local` for your development Convex deployment:

```env
NEXT_PUBLIC_CONVEX_URL=your_convex_url
CONVEX_DEPLOYMENT=your_deployment_name
```

Run Next.js and Convex in separate terminals:

```bash
pnpm dev
```

```bash
pnpm exec convex dev
```

Open [localhost:3000](http://localhost:3000). The Next.js process serves the interface; the Convex process develops the backend. Use a development deployment for testing. Public meet links use the current browser origin.

## PDFs

Registration sheets and meet programs are generated in the browser with `pdf-lib` and `@pdf-lib/fontkit`. No headless browser or PDF API route is required. Documents include pagination, repeated headings and bundled fonts; see [font support and licenses](public/fonts/README.md). Node tests check document generation and layout; browser rendering of Indic scripts still requires visual verification.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test:domain
pnpm test:pdf
pnpm test:config
pnpm build
```

`test:config` runs isolated Convex tests without mutating a deployment. Backend API changes also require Convex code generation before release.

## Maintenance references

- [Cleanup plan and execution tracker](CODE_CLEANUP_PLAN.md)
- [Shared event order and registration synchronization plan](REALTIME_SYNC_PLAN.md)
- [Meet configuration migration](docs/meet-configuration-migration.md)

Registration subscriptions update clean forms. Autosave checks its loaded snapshot before replacing meet registrations, so concurrent stale edits are rejected and kept locally for explicit recovery. Older callers omitting this check retain the legacy API behavior; incremental row mutations remain future work in the sync plan. Event order currently persists locally in each browser.

`internal.debug.fixUser` is a trusted tooling recovery function. It is no longer a public mutation; existing deployments need a backend release for this change to take effect. `internal.cleanup.clearAll` is a destructive maintenance utility that deletes registrations in batches of 100. It is never called by the UI or automatically during deployment. Do not run it as a verification step.
