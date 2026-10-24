import { useState } from "react";
import { EyeOff, ImageDown, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

import { ItemRow } from "@/components/item-row";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/items";
import type { Item } from "@/types";

interface PoolViewProps {
  items: Item[];
  onAddClick: () => void;
  onAddExamples: () => void;
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onHide: (id: string) => void;
  onFindPoster: (item: Item) => void;
}

export function PoolView({
  items,
  onAddClick,
  onAddExamples,
  onEdit,
  onDelete,
  onHide,
  onFindPoster,
}: PoolViewProps) {
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Пул</h2>
          <p className="text-xs text-muted-foreground">
            {items.length > 0
              ? `${items.length} ${plural(items.length, "позиция", "позиции", "позиций")} ждут своего часа`
              : "Пока ничего нет"}
          </p>
        </div>
        <Button size="sm" onClick={onAddClick} className="h-9">
          <Plus className="size-4" />
          Добавить
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Добавь то, что откладывал на потом — фильм, сериал или аниме.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={onAddClick} size="sm">
              <Plus className="size-4" />
              Добавить позицию
            </Button>
            <Button onClick={onAddExamples} size="sm" variant="ghost">
              <Sparkles className="size-4" />
              Заполнить примерами
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              meta={
                <span className="text-[11px] text-muted-foreground">
                  добавлено {formatDate(item.createdAt)}
                </span>
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
                  <DropdownMenuItem onClick={() => onEdit(item)}>
                    <Pencil className="size-4" />
                    Изменить
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onFindPoster(item)}>
                    <ImageDown className="size-4" />
                    Найти постер
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onHide(item.id)}>
                    <EyeOff className="size-4" />
                    В скрытые
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(item)}>
                    <Trash2 className="size-4" />
                    Удалить
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ItemRow>
          ))}
        </div>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить «{pendingDelete?.title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Позиция исчезнет из пула и из истории. Вернуть её будет нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
