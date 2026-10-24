import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { PosterThumb } from "@/components/poster-thumb";
import { TYPE_BADGE, TYPE_LABEL } from "@/lib/items";
import { cn } from "@/lib/utils";
import type { Item } from "@/types";

interface ItemRowProps {
  item: Item;
  meta?: ReactNode;
  children?: ReactNode;
}

export function ItemRow({ item, meta, children }: ItemRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-card/50 p-2">
      <PosterThumb item={item} className="h-16 w-11 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("h-5 px-1.5 text-[10px] font-medium", TYPE_BADGE[item.type])}
          >
            {TYPE_LABEL[item.type]}
          </Badge>
          {meta}
        </div>
      </div>
      {children}
    </div>
  );
}
