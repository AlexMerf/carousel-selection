import { RotateCcw, Trash2 } from "lucide-react";

import { ItemRow } from "@/components/item-row";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/items";
import type { Item } from "@/types";

interface HiddenViewProps {
  items: Item[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export function HiddenView({ items, onRestore, onDelete }: HiddenViewProps) {
  const hidden = [...items].sort((a, b) => b.statusChangedAt - a.statusChangedAt);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <div>
        <h2 className="text-base font-medium">Скрытые</h2>
        <p className="text-xs text-muted-foreground">
          {hidden.length === 0
            ? "Пусто — всё, что ты отклонил, будет лежать здесь"
            : `${hidden.length} скрытых · их можно вернуть в любой момент`}
        </p>
      </div>

      {hidden.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center text-sm text-muted-foreground">
          Когда нажмёшь «Не хочу» на выпавшем тайтле — он окажется здесь.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {hidden.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              meta={<span className="text-[11px] text-muted-foreground">скрыт {formatDate(item.statusChangedAt)}</span>}
            >
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  aria-label={`Вернуть в пул: ${item.title}`}
                  onClick={() => onRestore(item.id)}
                >
                  <RotateCcw className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Удалить: ${item.title}`}
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </ItemRow>
          ))}
        </div>
      )}
    </div>
  );
}
