import { ITEM_TYPES, TYPE_LABEL } from "@/lib/items";
import { cn } from "@/lib/utils";
import type { ItemType } from "@/types";

interface ListSwitcherProps {
  active: ItemType;
  counts: Record<ItemType, number>;
  onChange: (type: ItemType) => void;
  className?: string;
}

/**
 * Single-choice switch between the type-based lists. The wheel only ever draws
 * from the active list, so this is the "what are we watching now" control.
 */
export function ListSwitcher({ active, counts, onChange, className }: ListSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Список для кольца"
      className={cn(
        "grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1",
        className,
      )}
    >
      {ITEM_TYPES.map((type) => {
        const selected = type === active;
        return (
          <button
            key={type}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(type)}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
              selected
                ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {TYPE_LABEL[type]}
            <span className={cn("text-[11px]", selected ? "text-primary/70" : "text-muted-foreground/70")}>
              {counts[type]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
