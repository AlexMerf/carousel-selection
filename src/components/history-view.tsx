import {
  CheckCheck,
  Clapperboard,
  Clock3,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";

import { ItemRow } from "@/components/item-row";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, sortByStatusChange } from "@/lib/items";
import {
  hasSeasons,
  isWatchable,
  seasonBadge,
  titleStatus,
  TITLE_STATUS_LABEL,
  TITLE_STATUS_STYLE,
  upcomingSeasonNumber,
} from "@/lib/seasons";
import { cn } from "@/lib/utils";
import type { Item } from "@/types";

interface HistoryViewProps {
  items: Item[];
  onStartWatching: (item: Item) => void;
  onMarkAllWatched: (item: Item) => void;
  onDrop: (item: Item) => void;
  onReturnToPool: (id: string) => void;
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
}

export function HistoryView({
  items,
  onStartWatching,
  onMarkAllWatched,
  onDrop,
  onReturnToPool,
  onEdit,
  onDelete,
}: HistoryViewProps) {
  const history = sortByStatusChange(items);
  const watching = history.filter((item) => titleStatus(item) === "watching").length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <div>
        <h2 className="text-base font-medium">История</h2>
        <p className="text-xs text-muted-foreground">
          {history.length === 0
            ? "Пока пусто — здесь появятся те, что выпали на кольце"
            : `${history.length} записей · ${watching} сейчас смотрим`}
        </p>
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center text-sm text-muted-foreground">
          Крути кольцо и жми «Смотрю» — записи будут собираться здесь.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((item) => {
            const status = titleStatus(item);
            const badge = seasonBadge(item);
            const upcoming = upcomingSeasonNumber(item);
            const watchable = isWatchable(item);

            return (
              <ItemRow
                key={item.id}
                item={item}
                meta={
                  <>
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-px text-[10px]",
                        TITLE_STATUS_STYLE[status],
                      )}
                    >
                      {TITLE_STATUS_LABEL[status]}
                    </span>
                    {badge ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[10px] text-muted-foreground">
                        {badge}
                      </span>
                    ) : null}
                    {upcoming ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[10px] text-primary">
                        вышел S{upcoming}
                      </span>
                    ) : null}
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
                    {watchable ? (
                      <DropdownMenuItem onClick={() => onStartWatching(item)}>
                        <Clock3 className="size-4" />
                        {badge ? `Смотрю ${badge.split("/")[0]}` : "Смотрю"}
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => onMarkAllWatched(item)}>
                      <CheckCheck className="size-4" />
                      Досмотрел
                    </DropdownMenuItem>
                    {watchable ? (
                      <DropdownMenuItem onClick={() => onDrop(item)}>
                        <XCircle className="size-4" />
                        Бросил
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => onEdit(item)}>
                      {hasSeasons(item) ? (
                        <Clapperboard className="size-4" />
                      ) : (
                        <Pencil className="size-4" />
                      )}
                      {hasSeasons(item) ? "Сезоны" : "Изменить"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onReturnToPool(item.id)}>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
