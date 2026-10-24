import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Film } from "lucide-react";

import { sound } from "@/lib/sound";
import { TYPE_LABEL } from "@/lib/items";
import { cn } from "@/lib/utils";
import type { Item } from "@/types";
import { PosterThumb } from "@/components/poster-thumb";
import { ProgressiveBlur } from "@/components/motion/progressive-blur";
import { SpinningText } from "@/components/motion/spinning-text";
import { Tilt } from "@/components/motion/tilt";

const RING_CAPACITY = 20;
const RIM_FONT_PX = 9;
const RIM_PHRASE = "САША + ЛЕРА · КРУТИ · ";
/** Rough advance width of "0" at RIM_FONT_PX — SpinningText measures radius in ch. */
const CH_RATIO = 0.55;
const REEL_ROW_HEIGHT = 96;
const REEL_ROW_PITCH = 104;
const REEL_WINDOW_HEIGHT = 216;
const REEL_WINNER_INDEX = 18;

const reelOffsetFor = (index: number) => index * REEL_ROW_PITCH + REEL_ROW_HEIGHT / 2 - REEL_WINDOW_HEIGHT / 2;

interface StageProps {
  items: Item[];
  pick: () => Item | null;
  spinToken: number;
  /** Reports the winner plus the on-screen box of its card, for the reveal morph. */
  onWinner: (item: Item, rect: DOMRect | null) => void;
  onSpinStart: () => void;
  className?: string;
}

export function WheelStage(props: StageProps) {
  if (props.items.length === 0) {
    return <EmptyStage className={props.className} />;
  }
  return props.items.length > RING_CAPACITY ? <Reel {...props} /> : <Ring {...props} />;
}

function EmptyStage({ className }: { className?: string }) {
  return (
    <div className={cn("mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center", className)}>
      <div className="flex size-[78%] flex-col items-center justify-center gap-3 rounded-full border border-dashed border-white/15 text-center">
        <Film className="size-8 text-muted-foreground" />
        <p className="max-w-[70%] text-sm text-muted-foreground">
          Здесь появится кольцо, как только в пуле будет хоть что-то
        </p>
      </div>
    </div>
  );
}

function Ring({ items, pick, spinToken, onSpinStart, onWinner, className }: StageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  /** Poster card nodes by item id — the winner's box seeds the reveal morph. */
  const cardNodes = useRef(new Map<string, HTMLDivElement>());
  const [size, setSize] = useState(320);
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);

  const rotationRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const spinningRef = useRef(false);
  const dragRef = useRef<{ center: { x: number; y: number }; lastAngle: number; velocity: number; lastAt: number } | null>(null);

  const latest = useRef({ items, pick, onSpinStart, onWinner });
  useEffect(() => {
    latest.current = { items, pick, onSpinStart, onWinner };
  });

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setSize(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const itemsKey = items.map((item) => item.id).join("|");
  useEffect(() => {
    rotationRef.current = 0;
    setRotation(0);
  }, [itemsKey]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const runAnimation = useCallback((to: number, duration: number, winner: Item) => {
    const from = rotationRef.current;
    const delta = to - from;
    const step = 360 / Math.max(1, latest.current.items.length);
    let lastTick = Math.floor(from / step);
    const startedAt = performance.now();

    const frame = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const value = from + delta * eased;
      rotationRef.current = value;
      setRotation(value);

      const tickIndex = Math.floor(value / step);
      if (tickIndex !== lastTick) {
        lastTick = tickIndex;
        sound.tick(1 - progress);
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      const normalized = value % 360;
      rotationRef.current = normalized;
      setRotation(normalized);
      spinningRef.current = false;
      sound.chime();
      latest.current.onWinner(winner, cardNodes.current.get(winner.id)?.getBoundingClientRect() ?? null);
    };

    rafRef.current = requestAnimationFrame(frame);
  }, []);

  const spin = useCallback(
    (energy = 1) => {
      if (spinningRef.current) return;
      const list = latest.current.items;
      if (list.length === 0) return;

      const winner = latest.current.pick();
      if (!winner) return;

      const index = Math.max(
        0,
        list.findIndex((item) => item.id === winner.id),
      );

      sound.unlock();
      latest.current.onSpinStart();
      spinningRef.current = true;

      const step = 360 / list.length;
      const from = rotationRef.current;
      const turns = 3 + Math.round(Math.min(1, energy) * 3);
      const base = from + turns * 360;
      const targetAngle = -index * step;
      const delta = (((targetAngle - (base % 360)) % 360) + 360) % 360;
      const duration = 2700 + Math.random() * 800;

      runAnimation(base + delta, duration, winner);
    },
    [runAnimation],
  );

  const lastTokenRef = useRef(spinToken);
  useEffect(() => {
    if (spinToken !== lastTokenRef.current && spinToken > 0) spin();
    lastTokenRef.current = spinToken;
  }, [spinToken, spin]);

  const angleFromCenter = (clientX: number, clientY: number, center: { x: number; y: number }) =>
    (Math.atan2(clientY - center.y, clientX - center.x) * 180) / Math.PI;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (spinningRef.current) return;
    const element = stageRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    dragRef.current = {
      center,
      lastAngle: angleFromCenter(event.clientX, event.clientY, center),
      velocity: 0,
      lastAt: performance.now(),
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const angle = angleFromCenter(event.clientX, event.clientY, drag.center);
    let delta = angle - drag.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    drag.lastAngle = angle;

    const now = performance.now();
    const elapsed = Math.max(1, now - drag.lastAt);
    drag.velocity = delta / elapsed;
    drag.lastAt = now;

    rotationRef.current += delta;
    setRotation(rotationRef.current % 360);
    sound.tick(0.4);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const speed = Math.min(1, Math.abs(drag.velocity) * 900);
    dragRef.current = null;
    setDragging(false);
    spin(0.3 + speed * 0.7);
  };

  const count = items.length;
  const radius = size * 0.335;
  const step = 360 / Math.max(1, count);
  const cardWidth = Math.max(34, Math.min(84, ((2 * Math.PI * radius) / Math.max(1, count)) * 0.86));
  const cardHeight = cardWidth * 1.42;
  const activeIndex =
    count > 0 ? ((Math.round(((-rotation % 360) + 360) % 360 / step) % count) + count) % count : -1;

  // Rim lettering: fill the circumference evenly at any stage size.
  const rimRadius = size * 0.462;
  const rimRepeats = Math.max(
    1,
    Math.round((2 * Math.PI * rimRadius) / (RIM_PHRASE.length * RIM_FONT_PX * 0.88)),
  );
  const rimRadiusCh = rimRadius / (RIM_FONT_PX * CH_RATIO);

  return (
    <div className={cn("relative mx-auto w-full max-w-[420px]", className)}>
      <div
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        className={cn(
          "ring-stage relative aspect-square w-full touch-none select-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div className="wheel-glow pointer-events-none absolute inset-0 rounded-full" />
        <div className="pointer-events-none absolute inset-[8%] rounded-full border border-white/5" />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[0.07]"
          style={{ width: radius * 2 + cardWidth, height: radius * 2 + cardWidth }}
        />

        <div className="pointer-events-none absolute inset-0 grid select-none place-items-center">
          <SpinningText
            duration={80}
            fontSize={RIM_FONT_PX / 16}
            radius={rimRadiusCh}
            className="font-medium uppercase tracking-[0.14em] text-white/[0.16]"
          >
            {RIM_PHRASE.repeat(rimRepeats)}
          </SpinningText>
        </div>

        <div
          className="absolute inset-0"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {items.map((item, index) => {
            const angle = step * index;
            return (
              <div
                key={item.id}
                className="absolute left-1/2 top-1/2 will-change-transform"
                style={{
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(${-radius}px)`,
                }}
              >
                <div style={{ transform: `rotate(${-(angle + rotation)}deg)` }}>
                  <div
                    ref={(node) => {
                      if (node) cardNodes.current.set(item.id, node);
                      else cardNodes.current.delete(item.id);
                    }}
                    style={{ width: cardWidth, height: cardHeight }}
                  >
                    <Tilt
                      rotationFactor={20}
                      perspective={280}
                      springOptions={{ stiffness: 320, damping: 26 }}
                      className={cn(
                        "size-full overflow-hidden rounded-lg border bg-card shadow-lg shadow-black/50 transition-colors",
                        index === activeIndex ? "border-primary/70 shadow-primary/20" : "border-white/10",
                      )}
                    >
                      <PosterThumb item={item} className="size-full" />
                    </Tilt>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 flex size-[26%] min-h-20 min-w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/10 bg-background/85 backdrop-blur">
          <span className="text-2xl font-semibold leading-none">{count}</span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            в пуле
          </span>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1.5">
          <div className="h-0 w-0 border-x-[9px] border-t-[14px] border-x-transparent border-t-primary drop-shadow-[0_0_8px_rgba(251,191,36,0.55)]" />
        </div>
      </div>
    </div>
  );
}

function Reel({ items, pick, spinToken, onSpinStart, onWinner, className }: StageProps) {
  const [reel, setReel] = useState<Item[]>(() => items.slice(0, 7));
  const [offset, setOffset] = useState(() => reelOffsetFor(1));
  const [spinning, setSpinning] = useState(false);
  /** Poster nodes by reel index — the winner's box seeds the reveal morph. */
  const posterNodes = useRef(new Map<number, HTMLDivElement>());

  const offsetRef = useRef(reelOffsetFor(1));
  const rafRef = useRef<number | null>(null);
  const spinningRef = useRef(false);

  const latest = useRef({ items, pick, onSpinStart, onWinner });
  useEffect(() => {
    latest.current = { items, pick, onSpinStart, onWinner };
  });

  const itemsKey = items.map((item) => item.id).join("|");
  useEffect(() => {
    const next = items.slice(0, 7);
    setReel(next);
    offsetRef.current = reelOffsetFor(1);
    setOffset(reelOffsetFor(1));
  }, [itemsKey]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const buildReel = (winner: Item, pool: Item[]): Item[] => {
    const rows: Item[] = [];
    for (let index = 0; index < REEL_WINNER_INDEX + 4; index += 1) {
      if (index === REEL_WINNER_INDEX) {
        rows.push(winner);
        continue;
      }
      const random = pool[Math.floor(Math.random() * pool.length)] ?? winner;
      rows.push(random);
    }
    return rows;
  };

  const animate = (to: number, duration: number, winner: Item) => {
    const from = offsetRef.current;
    const delta = to - from;
    const startedAt = performance.now();
    let lastRow = Math.round(from / REEL_ROW_PITCH);

    const frame = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const value = from + delta * eased;
      offsetRef.current = value;
      setOffset(value);

      const row = Math.round(value / REEL_ROW_PITCH);
      if (row !== lastRow) {
        lastRow = row;
        sound.tick(1 - progress);
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      spinningRef.current = false;
      setSpinning(false);
      sound.chime();
      latest.current.onWinner(
        winner,
        posterNodes.current.get(REEL_WINNER_INDEX)?.getBoundingClientRect() ?? null,
      );
    };

    rafRef.current = requestAnimationFrame(frame);
  };

  const spin = useCallback(() => {
    if (spinningRef.current) return;
    const pool = latest.current.items;
    if (pool.length === 0) return;
    const winner = latest.current.pick();
    if (!winner) return;

    sound.unlock();
    latest.current.onSpinStart();
    spinningRef.current = true;
    setSpinning(true);

    const rows = buildReel(winner, pool);
    setReel(rows);
    offsetRef.current = 0;
    setOffset(0);

    const target = reelOffsetFor(REEL_WINNER_INDEX);
    const duration = 3000 + Math.random() * 700;
    animate(target, duration, winner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastTokenRef = useRef(spinToken);
  useEffect(() => {
    if (spinToken !== lastTokenRef.current && spinToken > 0) spin();
    lastTokenRef.current = spinToken;
  }, [spinToken, spin]);

  return (
    <div className={cn("mx-auto w-full max-w-[420px]", className)}>
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/40"
        style={{ height: REEL_WINDOW_HEIGHT }}
      >
        <div className="will-change-transform" style={{ transform: `translateY(${-offset}px)` }}>
          {reel.map((item, index) => {
            const isWinner = !spinning && !spinningRef.current && index === REEL_WINNER_INDEX;
            return (
              <div key={`${item.id}-${index}`} style={{ height: REEL_ROW_PITCH }} className="px-3 pb-2 pt-0">
                <div
                  className={cn(
                    "flex h-24 items-center gap-3 rounded-xl border bg-card/70 px-2",
                    isWinner ? "border-primary/70 shadow-[0_0_24px_-6px_rgba(251,191,36,0.45)]" : "border-white/10",
                  )}
                >
                  <div
                    ref={(node) => {
                      if (node) posterNodes.current.set(index, node);
                      else posterNodes.current.delete(index);
                    }}
                    className="h-full w-16 shrink-0 overflow-hidden rounded-md"
                  >
                    <PosterThumb item={item} className="size-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{TYPE_LABEL[item.type]}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reading line of the drum: exactly the card box, otherwise the ring
            hangs a few pixels outside the card and looks like a stray frame. */}
        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-24 -translate-y-1/2 rounded-xl ring-1 ring-primary/25" />
        <div className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2">
          <div className="h-0 w-0 border-y-[8px] border-l-[10px] border-y-transparent border-l-primary" />
        </div>
        <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2">
          <div className="h-0 w-0 border-y-[8px] border-r-[10px] border-y-transparent border-r-primary" />
        </div>

        <ProgressiveBlur
          direction="top"
          blurLayers={6}
          blurIntensity={0.5}
          className="pointer-events-none absolute inset-x-0 top-0 h-12"
        />
        <ProgressiveBlur
          direction="bottom"
          blurLayers={6}
          blurIntensity={0.5}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
        />
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Больше {RING_CAPACITY} позиций — кольцо превращается в барабан, победитель всё равно случаен
      </p>
    </div>
  );
}
