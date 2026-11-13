# Event order canvas

Open **Reorder events** from the meet program page. The editor opens at `/event_order/edit?meet=<meet-id>` and keeps the selected meet when returning to the program.

## Editing

- Drag an event card by its title to arrange the canvas. Canvas coordinates are independent of program positions. Arrow keys also move a focused card.
- Select a card or a row in **Running order**. Enter its one-based **Program position** and press Enter or leave the input to move it there.
- Click the lock on a card to pin its current slot. **Lock first** and **Lock last** move and pin the selected event in one action. For example, select 200m Freestyle and click Lock first; select the Medley Relay and click Lock last.
- Click a card's **+** output, then another card's input arrow to create a **must run before** connection. It does not require the events to be adjacent: the optimizer may put other events between them to allow swimmers more rest.
- Dashed arrows show the current sequence; solid arrows show your explicit constraints. Remove connections in the inspector. A loop or a connection incompatible with pinned slots is rejected without changing the valid program.
- **Undo** restores recent edits. **Reset order** restores the meet’s default order around existing locks/arrows. **Clear constraints** removes locks/arrows while retaining the current order. The arrange button lays out the cards in running order. Zoom buttons and canvas scrolling/panning help navigate larger programs.

## Optimization

**Optimize conflicts** searches for an order satisfying all locks and arrows. It minimizes the number of shared swimmers in consecutive events first, then uses inverse-square event distance to improve rest between other shared events. The same swimmer is counted once per event, including relay memberships.

For programs with up to nine events it searches all valid permutations. Larger programs use multiple starting orders and a bounded swap search; their global minimum is not guaranteed. It never deliberately replaces a feasible starting order with one having more back-to-back conflicts. Unsatisfiable constraints produce a message rather than silently moving a pinned event. The worker keeps optimization off the UI thread and is disposed on exit.

## Saving

**Save program** stores the order, locks, connections and card coordinates per meet in the current browser. The program preview, PDF input and timing page use the saved order. A subscription updates open preview/timing pages when browser storage changes. Meet selection is included in the return link.

This feature preserves the existing browser-storage persistence model. It does not implement shared Convex order storage across logged-in users; see [the realtime sync plan](../REALTIME_SYNC_PLAN.md) for that separate work. Changes remain drafts until Save program is clicked. Leaving through the back link or closing the browser warns about unsaved changes. Other application navigation may discard an unsaved draft.

Constraints refer to the current event labels, matching the existing order storage. Removed/renamed event labels are dropped when restoring settings, and newly configured events are included. If the configured event set changes while editing, saving is disabled until reload.

## Verification

`pnpm test:domain` includes order/lock/precedence tests, exact-search checks against exhaustive permutations, relay overlap deduplication, larger-program score preservation, invalid-constraint handling and storage restore/retired-event cases.

Browser checks used a temporary isolated fixture with no participant writes: changing a program slot, locking freestyle first/medley relay last, worker optimization reducing two adjacent conflicts to zero, arrow reordering, cycle rejection, save/reload of locks/connections, keyboard movement and a 390px viewport with no page overflow. The fixture route was removed after testing. Authenticated navigation with a real meet was not exercised because no login credentials were supplied.

Typecheck, ESLint, production build, frozen-lockfile install and `git diff --check` passed. The full test runs passed 16 domain tests, 4 PDF tests and 10 isolated Convex tests. No backend deployment or data mutation was performed for this feature.
