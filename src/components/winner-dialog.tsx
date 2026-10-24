"use client";

// The winner reveal: a real dialog (Radix owns focus trap, Esc, scroll lock)
// whose poster morphs out of the winning card on the wheel. Motion's shared
// `layoutId` can't be used here — the wheel sits in a `perspective` context with
// rotated ancestors and projection never engages — so the morph is a manual
// FLIP: the wheel reports the card's box, we animate the poster from it.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate } from "motion/react";
import { Check, Clock, X } from "lucide-react";

import { Particles, ParticlesEffect } from "@/components/motion/particles";
import { TextEffect } from "@/components/motion/text-effect";
import { PosterThumb } from "@/components/poster-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, TYPE_BADGE, TYPE_LABEL } from "@/lib/items";
import { cn } from "@/lib/utils";
import type { Item } from "@/types";

interface WinnerDialogProps {
  item: Item | null;
  /** Box of the winning card on the wheel, in viewport coordinates. */
  originRect: DOMRect | null;
  onDismiss: () => void;
  onWatch: () => void;
  onLater: () => void;
  onNever: () => void;
}

/** The poster that flies out of the winning card: a manual FLIP on mount. */
function PosterMorph({
  originRect,
  children,
}: {
  originRect: DOMRect | null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Measured once per mount: under StrictMode the layout effect runs twice and
  // the second pass would see the element already moved to its origin.
  const flip = useRef<{ dx: number; dy: number; sx: number; sy: number } | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !originRect) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (!flip.current) {
      const target = node.getBoundingClientRect();
      if (!target.width || !target.height) return;
      flip.current = {
        dx: originRect.left + originRect.width / 2 - (target.left + target.width / 2),
        dy: originRect.top + originRect.height / 2 - (target.top + target.height / 2),
        sx: Math.max(0.05, originRect.width / target.width),
        sy: Math.max(0.05, originRect.height / target.height),
      };
    }

    const { dx, dy, sx, sy } = flip.current;
    node.style.transformOrigin = "center";
    node.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

    const controls = animate(
      node,
      { x: [dx, 0], y: [dy, 0], scaleX: [sx, 1], scaleY: [sy, 1] },
      { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
    );
    return () => controls.stop();
  }, [originRect]);

  return (
    <div ref={ref} data-slot="winner-poster" className="size-full overflow-hidden bg-muted">
      {children}
    </div>
  );
}

export function WinnerDialog({
  item,
  originRect,
  onDismiss,
  onWatch,
  onLater,
  onNever,
}: WinnerDialogProps) {
  const [open, setOpen] = useState(false);

  // Open one frame later so the dialog is not part of the same commit as the
  // winner landing — the content gets a clean layout to measure against.
  useEffect(() => {
    if (!item) {
      setOpen(false);
      return;
    }
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [item]);

  return (
    <Dialog open={Boolean(item) && open} onOpenChange={(next) => !next && onDismiss()}>
      {item ? (
        <DialogContent
          className="max-w-[min(24rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-2xl border-white/10 bg-card p-0 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:max-w-[min(24rem,calc(100vw-2rem))]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Выпало: {item.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Кольцо выбрало «{item.title}». Можно отметить просмотр, оставить в пуле или скрыть.
          </DialogDescription>

          <div className="relative h-60 w-full">
            <Particles className="size-full">
              <PosterMorph originRect={originRect}>
                <PosterThumb item={item} className="size-full" fallbackClassName="text-4xl" />
              </PosterMorph>
              <ParticlesEffect
                style={{ top: "70%", left: "50%" }}
                count={16}
                radius={120}
                duration={0.95}
                holdDelay={0.015}
                className="pointer-events-none size-1.5 rounded-full bg-primary"
              />
              <ParticlesEffect
                style={{ top: "70%", left: "50%" }}
                count={10}
                radius={160}
                duration={1.1}
                delay={0.05}
                holdDelay={0.02}
                className="pointer-events-none size-1 rounded-full bg-primary/60"
              />
            </Particles>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent" />
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Закрыть"
              className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-black/40 text-white/80 backdrop-blur transition-colors hover:bg-black/60 hover:text-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-4"
            >
              <X />
            </button>
          </div>

          <div className="px-5 pt-1 pb-5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-primary/80">выпало</p>
            <TextEffect
              as="h2"
              per="char"
              preset="blur"
              aria-hidden="true"
              className="mt-1 text-2xl font-semibold leading-tight"
            >
              {item.title}
            </TextEffect>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <Badge variant="outline" className={cn(TYPE_BADGE[item.type])}>
                {TYPE_LABEL[item.type]}
              </Badge>
              <span>В пуле с {formatDate(item.createdAt)}</span>
            </div>

            <div className="mt-5 space-y-2">
              <Button onClick={onWatch} className="h-11 w-full">
                <Check className="size-4" />
                Смотрю
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={onLater} className="h-10">
                  <Clock className="size-4" />
                  Не сейчас
                </Button>
                <Button
                  variant="outline"
                  onClick={onNever}
                  className="h-10 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <X className="size-4" />
                  Не хочу
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
