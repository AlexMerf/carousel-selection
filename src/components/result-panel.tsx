import { Check, Clock, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PosterThumb } from "@/components/poster-thumb";
import { formatDate, TYPE_BADGE, TYPE_LABEL } from "@/lib/items";
import { cn } from "@/lib/utils";
import type { Item } from "@/types";

interface ResultPanelProps {
  item: Item;
  onWatch: () => void;
  onLater: () => void;
  onNever: () => void;
}

export function ResultPanel({ item, onWatch, onLater, onNever }: ResultPanelProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 rounded-2xl border border-primary/30 bg-card/70 p-4 shadow-[0_0_44px_-14px_rgba(251,191,36,0.45)]">
      <div className="flex gap-4">
        <PosterThumb item={item} className="h-28 w-20 shrink-0 rounded-lg border border-white/10" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-primary/80">выпало</p>
          <h2 className="mt-1 line-clamp-2 text-lg font-semibold leading-tight">{item.title}</h2>
          <Badge variant="outline" className={cn("mt-2", TYPE_BADGE[item.type])}>
            {TYPE_LABEL[item.type]}
          </Badge>
          <p className="mt-2 text-xs text-muted-foreground">
            В пуле с {formatDate(item.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
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
  );
}
