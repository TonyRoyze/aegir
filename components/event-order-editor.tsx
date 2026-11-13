"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { preferredMeetId } from "@/lib/meet-selection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Grip,
  Loader2,
  LockKeyhole,
  LockKeyholeOpen,
  Maximize,
  Save,
  Undo2,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  summarizeEventRest,
  type RegistrationLike,
} from "@/lib/event-rest-utils";
import {
  emptyOrderConstraints,
  isEventOrderValid,
  resolveEventOrder,
  scoreEventOrder,
  type OrderConstraints,
  type optimizeConstrainedEventOrder,
} from "@/lib/event-order-constraints";
import {
  arrangeEventCards,
  loadOrderEditorState,
  saveOrderEditorState,
  type CanvasPoint,
  type OrderEditorState,
} from "@/lib/event-order-editor-state";

const CARD_WIDTH = 260,
  CARD_HEIGHT = 148;
type OptimizeResult = ReturnType<typeof optimizeConstrainedEventOrder>;

export function EventOrderEditor({ meetId }: { meetId?: string }) {
  const meets = useQuery(api.meets.getMeets);
  const id = meetId ?? preferredMeetId(meets);
  const meet = meets?.find((item) => item._id === id);
  const registrations = useQuery(
    api.registrations.get,
    meet ? { meetId: meet._id } : "skip",
  );
  if (!meets || (meet && registrations === undefined))
    return (
      <div className="flex min-h-96 items-center justify-center gap-2">
        <Loader2 className="animate-spin" />
        Loading program…
      </div>
    );
  if (!meet)
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-semibold">Meet unavailable</h1>
        <p className="text-muted-foreground">
          Select an existing meet to edit its program.
        </p>
        <Button asChild variant="outline">
          <Link href="/event_order">Back to program</Link>
        </Button>
      </div>
    );
  if (!meet.events.length)
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-semibold">No events to arrange</h1>
        <p className="text-muted-foreground">
          Add events to this meet before opening the canvas.
        </p>
        <Button asChild>
          <Link href="/meets">Edit meets</Link>
        </Button>
      </div>
    );
  return (
    <EventOrderCanvas
      key={meet._id}
      meetId={meet._id}
      meetName={meet.name}
      events={meet.events}
      registrations={registrations ?? []}
    />
  );
}

/** Kept separate from backend subscriptions so the canvas can be exercised with fixtures. */
export function EventOrderCanvas({
  meetId,
  meetName,
  events,
  registrations,
}: {
  meetId: string;
  meetName: string;
  events: string[];
  registrations: RegistrationLike[];
}) {
  const [state, setState] = useState<OrderEditorState>(() =>
    loadOrderEditorState(meetId, events),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<OrderEditorState[]>([]);
  const [dirty, setDirty] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState(
    "Choose a card to edit its program position.",
  );
  const viewport = useRef<HTMLDivElement>(null);
  const worker = useRef<Worker | null>(null);
  const drag = useRef<{
    event: string;
    client: CanvasPoint;
    origin: CanvasPoint;
    moved: boolean;
  } | null>(null);
  const pan = useRef<{ client: CanvasPoint; scroll: CanvasPoint } | null>(null);
  const score = useMemo(
    () => scoreEventOrder(registrations, state.order),
    [registrations, state.order],
  );
  const summaries = useMemo(
    () =>
      new Map(
        summarizeEventRest(registrations, state.order).map((summary) => [
          summary.eventName,
          summary,
        ]),
      ),
    [registrations, state.order],
  );
  const eventsChanged =
    events.length !== state.order.length ||
    events.some((event) => !state.order.includes(event));
  const width = Math.max(
    1030,
    ...Object.values(state.positions).map((point) => point.x + CARD_WIDTH + 80),
  );
  const height = Math.max(
    660,
    ...Object.values(state.positions).map(
      (point) => point.y + CARD_HEIGHT + 80,
    ),
  );
  const backHref = `/event_order?meet=${encodeURIComponent(meetId)}`;

  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let initial = true;
    const observer = new ResizeObserver(() => {
      if (initial) {
        setZoom(
          element.clientWidth < 600
            ? 1
            : Math.max(0.35, Math.min(1, (element.clientWidth - 24) / 1030)),
        );
        initial = false;
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (next: OrderEditorState) => {
    setHistory((previous) => [...previous.slice(-29), state]);
    setState(next);
    setDirty(true);
    setError(null);
  };
  const applyConstraints = (
    constraints: OrderConstraints,
    preferred = state.order,
  ) => {
    try {
      change({
        ...state,
        constraints,
        order: resolveEventOrder(preferred, constraints),
      });
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not arrange these events.",
      );
      return false;
    }
  };
  const setPosition = (
    event: string,
    slot: number,
    lock = state.constraints.locks[event] !== undefined,
  ) => {
    if (!Number.isInteger(slot) || slot < 0 || slot >= state.order.length) {
      setError(`Choose a position between 1 and ${state.order.length}.`);
      return;
    }
    const occupant = Object.entries(state.constraints.locks).find(
      ([other, position]) => other !== event && position === slot,
    );
    if (occupant) {
      setError(
        `Position ${slot + 1} is locked to ${occupant[0]}. Unlock it first.`,
      );
      return;
    }
    // Temporarily pin the requested position while arranging around other locks/arrows.
    const locks = { ...state.constraints.locks, [event]: slot };
    try {
      const order = resolveEventOrder(state.order, {
        ...state.constraints,
        locks,
      });
      if (!lock) delete locks[event];
      change({ ...state, order, constraints: { ...state.constraints, locks } });
      setMessage(
        `${event} ${lock ? "locked at" : "moved to"} position ${slot + 1}.`,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not move this event.",
      );
    }
  };
  const toggleLock = (event: string) => {
    const locks = { ...state.constraints.locks };
    if (locks[event] === undefined) locks[event] = state.order.indexOf(event);
    else delete locks[event];
    applyConstraints({ ...state.constraints, locks });
  };
  const connect = (after: string) => {
    if (!connecting) {
      setSelected(after);
      setMessage(
        "Choose an output (+) first, then an input to connect events.",
      );
      return;
    }
    if (
      state.constraints.connections.some(
        (edge) => edge.before === connecting && edge.after === after,
      )
    ) {
      setConnecting(null);
      return;
    }
    const accepted = applyConstraints({
      ...state.constraints,
      connections: [
        ...state.constraints.connections,
        { before: connecting, after },
      ],
    });
    if (accepted) {
      setMessage(`${connecting} will run before ${after}.`);
      setConnecting(null);
    }
  };
  const optimize = () => {
    setOptimizing(true);
    setError(null);
    setConnecting(null);
    try {
      const connection = new Worker(
        new URL("../lib/event-order.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = connection;
      connection.onmessage = (
        event: MessageEvent<{ result?: OptimizeResult; error?: string }>,
      ) => {
        connection.terminate();
        worker.current = null;
        setOptimizing(false);
        if (event.data.error || !event.data.result) {
          setError(event.data.error ?? "Optimization failed.");
          return;
        }
        const result = event.data.result;
        if (!isEventOrderValid(result.order, state.constraints)) {
          setError("The suggested order did not satisfy your constraints.");
          return;
        }
        if (result.order.some((name, index) => name !== state.order[index]))
          change({ ...state, order: result.order });
        setMessage(
          `${score.adjacent} → ${result.score.adjacent} back-to-back swimmer conflicts. ${result.exact ? "Best valid order found." : "Best order found in this optimization pass."}`,
        );
      };
      connection.onerror = () => {
        connection.terminate();
        worker.current = null;
        setOptimizing(false);
        setError(
          "Could not start the optimizer. Reload the page and try again.",
        );
      };
      connection.postMessage({
        registrations,
        order: state.order,
        constraints: state.constraints,
      });
    } catch {
      setOptimizing(false);
      setError(
        "This browser could not start the optimizer. Try a browser with web worker support.",
      );
    }
  };
  const save = () => {
    try {
      if (eventsChanged)
        throw new Error(
          "Meet events changed while you were editing. Reload before saving.",
        );
      saveOrderEditorState(meetId, state);
      setDirty(false);
      setError(null);
      setMessage("Program order, locks and arrows saved in this browser.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save this program.",
      );
    }
  };
  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setState(previous);
    setHistory((items) => items.slice(0, -1));
    setDirty(true);
    setError(null);
    setConnecting(null);
  };
  const startDrag = (
    event: string,
    pointer: PointerEvent<HTMLButtonElement>,
  ) => {
    if (optimizing || pointer.button !== 0) return;
    setSelected(event);
    pointer.currentTarget.setPointerCapture(pointer.pointerId);
    drag.current = {
      event,
      client: { x: pointer.clientX, y: pointer.clientY },
      origin: state.positions[event],
      moved: false,
    };
  };
  const moveDrag = (pointer: PointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    if (!active || optimizing) return;
    const dx = (pointer.clientX - active.client.x) / zoom,
      dy = (pointer.clientY - active.client.y) / zoom;
    if (!active.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    if (!active.moved) {
      setHistory((previous) => [...previous.slice(-29), state]);
      active.moved = true;
    }
    setState((previous) => ({
      ...previous,
      positions: {
        ...previous.positions,
        [active.event]: {
          x: Math.max(24, Math.min(10000, active.origin.x + dx)),
          y: Math.max(24, Math.min(10000, active.origin.y + dy)),
        },
      },
    }));
    setDirty(true);
  };
  const path = (before: string, after: string) => {
    const a = state.positions[before],
      b = state.positions[after];
    const start = { x: a.x + CARD_WIDTH + 6, y: a.y + CARD_HEIGHT / 2 },
      end = { x: b.x - 6, y: b.y + CARD_HEIGHT / 2 };
    return `M ${start.x} ${start.y} C ${start.x + 90} ${start.y}, ${end.x - 90} ${end.y}, ${end.x} ${end.y}`;
  };
  const selectedSlot = selected ? state.order.indexOf(selected) : -1;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="outline"
            size="icon"
            aria-label="Back to program"
          >
            <Link
              href={backHref}
              onClick={(event) => {
                if (
                  dirty &&
                  !window.confirm("Leave without saving the program changes?")
                )
                  event.preventDefault();
              }}
            >
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Program canvas
            </h1>
            <p className="text-sm text-muted-foreground">{meetName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={score.adjacent > 0 ? "destructive" : "secondary"}>
            {score.adjacent} back-to-back conflicts
          </Badge>
          <Button
            variant="outline"
            onClick={undo}
            disabled={optimizing || !history.length}
          >
            <Undo2 data-icon="inline-start" />
            Undo
          </Button>
          <Button
            variant="outline"
            onClick={optimize}
            disabled={optimizing || eventsChanged || state.order.length < 2}
          >
            {optimizing ? (
              <Loader2 className="animate-spin" />
            ) : (
              <WandSparkles data-icon="inline-start" />
            )}
            {optimizing ? "Optimizing…" : "Optimize conflicts"}
          </Button>
          <Button
            onClick={save}
            disabled={optimizing || eventsChanged || !dirty}
          >
            <Save data-icon="inline-start" />
            Save program
          </Button>
        </div>
      </header>
      {(error || eventsChanged) && (
        <Alert variant="destructive">
          <AlertTitle>Check the program</AlertTitle>
          <AlertDescription>
            {error ??
              "Meet events changed. Reload this page before editing or saving."}
          </AlertDescription>
        </Alert>
      )}
      <div
        className="flex items-center justify-between gap-3 text-sm"
        role="status"
        aria-live="polite"
      >
        <p className="text-muted-foreground">
          {connecting
            ? `Connecting from ${connecting}. Choose another card’s input.`
            : message}
        </p>
        {connecting && (
          <Button size="sm" variant="ghost" onClick={() => setConnecting(null)}>
            Cancel connection
          </Button>
        )}
        <span className="shrink-0 text-xs text-muted-foreground">
          {dirty ? "Unsaved changes" : "Saved order"}
        </span>
      </div>
      <div className="grid min-h-[650px] grid-cols-1 overflow-hidden rounded-xl border bg-card xl:grid-cols-[minmax(0,1fr)_300px]">
        <section
          className="flex min-w-0 flex-col"
          aria-label="Event order canvas"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Drag cards to arrange the canvas. Connect + to an input to set
              precedence.
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom out"
                onClick={() => setZoom((value) => Math.max(0.35, value - 0.15))}
              >
                <ZoomOut />
              </Button>
              <span className="w-12 text-center text-xs tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom in"
                onClick={() => setZoom((value) => Math.min(1.6, value + 0.15))}
              >
                <ZoomIn />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Arrange cards in program order"
                disabled={optimizing}
                onClick={() => {
                  change({
                    ...state,
                    positions: arrangeEventCards(state.order),
                  });
                  setZoom(
                    Math.max(
                      0.35,
                      Math.min(
                        1,
                        ((viewport.current?.clientWidth ?? 1030) - 24) / 1030,
                      ),
                    ),
                  );
                  viewport.current?.scrollTo(0, 0);
                }}
              >
                <Maximize />
              </Button>
            </div>
          </div>
          <div
            ref={viewport}
            className="relative h-[480px] md:h-[610px] overflow-auto overscroll-contain bg-muted/30 touch-pan-x touch-pan-y"
            onPointerDown={(event) => {
              if (
                (event.target as HTMLElement).closest("[data-event-card]") ||
                event.button !== 0
              )
                return;
              pan.current = {
                client: { x: event.clientX, y: event.clientY },
                scroll: {
                  x: event.currentTarget.scrollLeft,
                  y: event.currentTarget.scrollTop,
                },
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (pan.current) {
                event.currentTarget.scrollLeft =
                  pan.current.scroll.x - event.clientX + pan.current.client.x;
                event.currentTarget.scrollTop =
                  pan.current.scroll.y - event.clientY + pan.current.client.y;
              }
            }}
            onPointerUp={() => {
              pan.current = null;
            }}
            onPointerCancel={() => {
              pan.current = null;
            }}
          >
            <div style={{ width: width * zoom, height: height * zoom }}>
              <div
                className="relative origin-top-left"
                style={{
                  width,
                  height,
                  transform: `scale(${zoom})`,
                  backgroundImage:
                    "radial-gradient(var(--border) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              >
                <svg
                  width={width}
                  height={height}
                  className="pointer-events-none absolute inset-0 overflow-visible"
                  aria-hidden="true"
                >
                  <defs>
                    <marker
                      id="sequence-arrow"
                      markerWidth="8"
                      markerHeight="8"
                      refX="7"
                      refY="4"
                      orient="auto"
                    >
                      <path
                        d="M 0 0 L 8 4 L 0 8 Z"
                        fill="var(--muted-foreground)"
                      />
                    </marker>
                    <marker
                      id="constraint-arrow"
                      markerWidth="10"
                      markerHeight="10"
                      refX="9"
                      refY="5"
                      orient="auto"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--primary)" />
                    </marker>
                  </defs>
                  {state.order.slice(0, -1).map((event, index) => (
                    <path
                      key={`sequence-${event}`}
                      d={path(event, state.order[index + 1])}
                      stroke="var(--muted-foreground)"
                      opacity="0.3"
                      strokeWidth="1.5"
                      strokeDasharray="6 5"
                      fill="none"
                      markerEnd="url(#sequence-arrow)"
                    />
                  ))}
                  {state.constraints.connections.map((edge) => (
                    <path
                      key={`${edge.before}-${edge.after}`}
                      d={path(edge.before, edge.after)}
                      stroke="var(--primary)"
                      strokeWidth="2.5"
                      fill="none"
                      markerEnd="url(#constraint-arrow)"
                    />
                  ))}
                </svg>
                {state.order.map((event, index) => {
                  const point = state.positions[event],
                    locked = state.constraints.locks[event] !== undefined,
                    summary = summaries.get(event);
                  return (
                    <article
                      key={event}
                      data-event-card={event}
                      className={cn(
                        "absolute flex flex-col rounded-xl border bg-card shadow-sm",
                        selected === event &&
                          "border-primary ring-2 ring-primary/15",
                        connecting === event && "ring-2 ring-primary",
                      )}
                      style={{
                        left: point.x,
                        top: point.y,
                        width: CARD_WIDTH,
                        height: CARD_HEIGHT,
                      }}
                    >
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="absolute -left-4 top-[58px] z-10 rounded-full"
                        aria-label={`Connect before ${event}`}
                        disabled={optimizing}
                        onClick={() => connect(event)}
                      >
                        <ArrowRight />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="absolute -right-4 top-[58px] z-10 rounded-full"
                        aria-label={`Connect from ${event}`}
                        aria-pressed={connecting === event}
                        disabled={optimizing}
                        onClick={() => {
                          setConnecting(connecting === event ? null : event);
                          setSelected(event);
                        }}
                      >
                        <span aria-hidden="true">+</span>
                      </Button>
                      <div className="flex items-start gap-3 px-4 pt-4">
                        <span className="min-w-8 text-2xl font-semibold tabular-nums text-primary">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <button
                          className="flex min-w-0 flex-1 cursor-grab touch-none items-start gap-2 text-left active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-primary"
                          aria-label={`Select or move ${event}`}
                          onClick={() => setSelected(event)}
                          onPointerDown={(pointer) => startDrag(event, pointer)}
                          onPointerMove={moveDrag}
                          onPointerUp={() => {
                            drag.current = null;
                          }}
                          onPointerCancel={() => {
                            drag.current = null;
                          }}
                          onKeyDown={(key) => {
                            const directions: Record<string, CanvasPoint> = {
                              ArrowLeft: { x: -24, y: 0 },
                              ArrowRight: { x: 24, y: 0 },
                              ArrowUp: { x: 0, y: -24 },
                              ArrowDown: { x: 0, y: 24 },
                            };
                            if (optimizing || !directions[key.key]) return;
                            key.preventDefault();
                            const delta = directions[key.key];
                            change({
                              ...state,
                              positions: {
                                ...state.positions,
                                [event]: {
                                  x: Math.max(24, point.x + delta.x),
                                  y: Math.max(24, point.y + delta.y),
                                },
                              },
                            });
                          }}
                        >
                          <span className="line-clamp-3 text-sm font-semibold leading-5">
                            {event}
                          </span>
                          <Grip className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2 px-4 pb-3">
                        <p
                          className={cn(
                            "text-xs",
                            summary?.sharedWithNext
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {index === state.order.length - 1
                            ? "Final event"
                            : `${summary?.sharedWithNext ?? 0} shared with next`}
                        </p>
                        <Button
                          variant={locked ? "secondary" : "ghost"}
                          size="icon-sm"
                          aria-label={`${locked ? "Unlock" : "Lock"} ${event} at position ${index + 1}`}
                          aria-pressed={locked}
                          disabled={optimizing}
                          onClick={() => toggleLock(event)}
                        >
                          {locked ? <LockKeyhole /> : <LockKeyholeOpen />}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-5 border-t px-4 py-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="w-6 border-t border-dashed border-muted-foreground" />
              Current sequence
            </span>
            <span className="flex items-center gap-2">
              <span className="w-6 border-t-2 border-primary" />
              Must run before
            </span>
            <span className="flex items-center gap-2">
              <LockKeyhole className="size-3" />
              Fixed program slot
            </span>
          </div>
        </section>
        <aside className="flex min-w-0 flex-col gap-4 border-t p-4 xl:border-l xl:border-t-0">
          <div>
            <h2 className="font-semibold">{selected ?? "Program positions"}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Locks fix exact positions. Arrows leave room for other events
              between them.
            </p>
          </div>
          {selected && (
            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="event-slot">Program position</FieldLabel>
                <Input
                  key={`${selected}-${selectedSlot}`}
                  id="event-slot"
                  type="number"
                  min={1}
                  max={state.order.length}
                  defaultValue={selectedSlot + 1}
                  disabled={optimizing}
                  onBlur={(event) => {
                    const slot = Number(event.target.value) - 1;
                    if (slot !== selectedSlot) setPosition(selected, slot);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
              </Field>
              <Button
                variant="outline"
                disabled={optimizing}
                onClick={() => toggleLock(selected)}
              >
                {state.constraints.locks[selected] !== undefined ? (
                  <LockKeyholeOpen />
                ) : (
                  <LockKeyhole />
                )}
                {state.constraints.locks[selected] !== undefined
                  ? "Unlock position"
                  : `Lock position ${selectedSlot + 1}`}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={optimizing}
                  onClick={() => setPosition(selected, 0, true)}
                >
                  Lock first
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={optimizing}
                  onClick={() =>
                    setPosition(selected, state.order.length - 1, true)
                  }
                >
                  Lock last
                </Button>
              </div>
            </div>
          )}
          {state.constraints.connections.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold">Connections</h3>
              {state.constraints.connections.map((edge) => (
                <div
                  key={`${edge.before}-${edge.after}`}
                  className="flex items-center gap-2 rounded-md bg-muted/50 p-2"
                >
                  <span className="min-w-0 flex-1 text-xs leading-5">
                    {edge.before}
                    <ArrowRight className="mx-1 inline size-3" />
                    {edge.after}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={optimizing}
                    aria-label={`Remove connection from ${edge.before} to ${edge.after}`}
                    onClick={() =>
                      applyConstraints({
                        ...state.constraints,
                        connections: state.constraints.connections.filter(
                          (item) => item !== edge,
                        ),
                      })
                    }
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Running order</h2>
            <span className="text-xs text-muted-foreground">
              {Object.keys(state.constraints.locks).length} locked
            </span>
          </div>
          <ol className="flex max-h-96 flex-col gap-1 overflow-auto">
            {state.order.map((event, index) => (
              <li key={event}>
                <button
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-primary",
                    selected === event ? "bg-accent" : "hover:bg-muted",
                  )}
                  onClick={() => setSelected(event)}
                >
                  <span className="w-5 shrink-0 tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="flex-1">{event}</span>
                  {state.constraints.locks[event] !== undefined && (
                    <LockKeyhole className="size-3 shrink-0 text-primary" />
                  )}
                </button>
              </li>
            ))}
          </ol>
          <Button
            variant="outline"
            size="sm"
            disabled={optimizing || eventsChanged}
            onClick={() => {
              if (applyConstraints(state.constraints, events))
                setMessage(
                  "Default event order restored around your locks and arrows. Save to apply it.",
                );
            }}
          >
            Reset order
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={
              optimizing ||
              (!Object.keys(state.constraints.locks).length &&
                !state.constraints.connections.length)
            }
            onClick={() => {
              applyConstraints(emptyOrderConstraints());
              setMessage(
                "Locks and connections cleared. The current order was kept.",
              );
            }}
          >
            Clear constraints
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            Optimize minimizes back-to-back overlaps first, then improves rest
            between shared events. Larger programs use a best-effort search.
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="size-3" />
            Saved per meet in this browser.
          </p>
        </aside>
      </div>
    </div>
  );
}
