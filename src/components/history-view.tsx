import { CheckCheck, Clock3, MoreHorizontal, RotateCcw, Trash2, XCircle } from "lucide-react";

import { ItemRow } from "@/components/item-row";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, HISTORY_STATUSES, sortByStatusChange, STATUS_LABEL } from "@/lib/items";
import { cn } from "@/lib/utils";
import type { Item, ItemStatus } from "@/types";

const STATUS_STYLE: Record<string, string> = {
  watching: "border-sky-300/30 bg-sky-300/10 text-sky-200",
  watched: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  dropped: "border-rose-300/30 bg-rose-300/10 text-rose-200",
};

interface HistoryViewProps {
  items: Item[];
  onStatus: (id: string, status: ItemStatus) => void;
  onDelete: (id: string) => void;
}

export function HistoryView({ items, onStatus, onDelete }: HistoryViewProps) {
  const history = sortByStatusChange(items.filter((item) => HISTORY_STATUSES.includes(item.status)));
  const watching = history.filter((item) => item.status === "watching").length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <div>
        <h2 className="text-base font-medium">История</h2>
        <p className="text-xs text-muted-foreground">
          {history.length === 0
            ? "Пока пусто — здесь появятся те, что выпали на кольце"
            : `${history.length} записей · ${watching} сейчас смотришь`}
        </p>
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center text-sm text-muted-foreground">
          Крути кольцо и жми «Смотрю» — записи будут собираться здесь.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              meta={
                <>
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-px text-[10px]",
                      STATUS_STYLE[item.status],
                    )}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(item.statusChangedAt)}
                  </span>
                </>
              }
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground"
                    aria-label={`Действия: ${item.title}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onStatus(item.id, "watching")}>
                    <Clock3 className="size-4" />
                    Смотрю
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatus(item.id, "watched")}>
                    <CheckCheck className="size-4" />
                    Досмотрел
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatus(item.id, "dropped")}>
                    <XCircle className="size-4" />
                    Бросил
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onStatus(item.id, "pool")}>
                    <RotateCcw className="size-4" />
                    Вернуть в пул
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(item.id)}>
                    <Trash2 className="size-4" />
                    Удалить
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ItemRow>
          ))}
        </div>
      )}
    </div>
  );
}
