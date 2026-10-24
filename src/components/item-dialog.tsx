import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ImageDown, Plus, Trash2 } from "lucide-react";

import { PosterFinder } from "@/components/poster-finder";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ITEM_TYPES, TYPE_LABEL } from "@/lib/items";
import {
  createSeasons,
  normalizeSeasons,
  SEASON_LABEL,
  SEASON_STATES,
  seasonHasProgress,
} from "@/lib/seasons";
import type { Item, ItemType, Season, SeasonState } from "@/types";

export interface ItemFormValues {
  title: string;
  type: ItemType;
  posterUrl?: string;
  /** Edited locally and saved on submit: cancel keeps the previous progress. */
  seasons: Season[];
}

interface ItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  /** Pre-selected type for a new item — the list the user is adding into. */
  initialType?: ItemType;
  omdbKey?: string;
  finderInitiallyOpen?: boolean;
  onSubmit: (values: ItemFormValues) => void;
}

export function ItemDialog({
  open,
  onOpenChange,
  item,
  initialType,
  omdbKey,
  finderInitiallyOpen,
  onSubmit,
}: ItemDialogProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ItemType>(initialType ?? "film");
  const [posterUrl, setPosterUrl] = useState("");
  const [seasons, setSeasons] = useState<Season[]>(() => createSeasons(1));
  const [seasonCount, setSeasonCount] = useState(1);
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);
  const [finderOpen, setFinderOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setType(item?.type ?? initialType ?? "film");
    setPosterUrl(item?.posterUrl ?? "");
    setSeasons(item ? item.seasons.map((season) => ({ ...season })) : createSeasons(1));
    setSeasonCount(item?.seasons.length ?? 1);
    setPendingRemoval(null);
    setFinderOpen(Boolean(finderInitiallyOpen));
  }, [open, item, initialType, finderInitiallyOpen]);

  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0;
  const isSeriesLike = type !== "film";

  const updateSeasonState = (index: number, state: SeasonState) =>
    setSeasons((prev) =>
      prev.map((season, i) => (i === index ? { state, changedAt: Date.now() } : season)),
    );

  const pushSeason = (state: SeasonState) =>
    setSeasons((prev) =>
      prev.length >= 100 ? prev : [...prev, { state, changedAt: Date.now() }],
    );

  const removeAt = (index: number) =>
    setSeasons((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const requestRemoval = (index: number) => {
    const season = seasons[index];
    if (!season) return;
    if (seasonHasProgress(season)) setPendingRemoval(index);
    else removeAt(index);
  };

  const changeType = (next: ItemType) => {
    setType(next);
    // A film has a single implicit season — drop the rest when retyping.
    if (next === "film") setSeasons((prev) => prev.slice(0, 1));
  };

  const changeSeasonCount = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    const count = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 1;
    setSeasonCount(count);
    setSeasons(createSeasons(count));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      title: trimmedTitle,
      type,
      posterUrl: posterUrl.trim() ? posterUrl.trim() : undefined,
      seasons: normalizeSeasons(type, seasons),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Изменить позицию" : "Новая позиция"}</DialogTitle>
          <DialogDescription>
            {item
              ? "Поправь название, тип, постер или прогресс по сезонам."
              : "Название и тип обязательны, постер можно подобрать автоматически."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-title">Название</Label>
            <Input
              id="item-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например, «Дюна»"
              autoComplete="off"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-type">Тип</Label>
            <Select value={type} onValueChange={(value) => changeType(value as ItemType)}>
              <SelectTrigger id="item-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {TYPE_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isSeriesLike ? (
            <div className="space-y-2">
              <Label>{item ? "Сезоны" : "Сколько сезонов уже вышло"}</Label>

              {item ? (
                <>
                  <div className="space-y-1.5">
                    {seasons.map((season, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="w-7 shrink-0 text-xs text-muted-foreground">
                          S{index + 1}
                        </span>
                        <Select
                          value={season.state}
                          onValueChange={(value) => updateSeasonState(index, value as SeasonState)}
                        >
                          <SelectTrigger className="h-8 flex-1" aria-label={`Сезон ${index + 1}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SEASON_STATES.map((state) => (
                              <SelectItem key={state} value={state}>
                                {SEASON_LABEL[state]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={seasons.length <= 1}
                          aria-label={`Удалить сезон ${index + 1}`}
                          onClick={() => requestRemoval(index)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-0.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 flex-1 gap-1 px-2 text-xs"
                      onClick={() => pushSeason("not_started")}
                    >
                      <Plus className="size-3.5" />
                      Сезон вышел
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 flex-1 gap-1 px-2 text-xs"
                      onClick={() => pushSeason("not_aired")}
                    >
                      <Plus className="size-3.5" />
                      Ещё не вышел
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    «Не вышел» — сезон анонсирован, но серий ещё нет. Отметь «смотрю», когда сядете
                    смотреть.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Input
                      id="item-season-count"
                      type="number"
                      min={1}
                      max={100}
                      value={seasonCount}
                      onChange={(event) => changeSeasonCount(event.target.value)}
                      className="h-9 w-20"
                    />
                    <p className="text-xs text-muted-foreground">
                      Остальные добавишь в «Изменить», когда выйдут.
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-2">
              <Label htmlFor="item-poster">Ссылка на постер</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-primary hover:text-primary"
                onClick={() => setFinderOpen((value) => !value)}
                disabled={!trimmedTitle}
              >
                <ImageDown className="size-3.5" />
                {finderOpen ? "Скрыть поиск" : "Найти постер"}
              </Button>
            </div>
            <Input
              id="item-poster"
              value={posterUrl}
              onChange={(event) => setPosterUrl(event.target.value)}
              placeholder="https://…/poster.jpg"
              inputMode="url"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Можно вставить ссылку или подобрать автоматически. Без постера будет заглушка.
            </p>
          </div>

          {finderOpen ? (
            <PosterFinder
              query={trimmedTitle}
              type={type}
              omdbKey={omdbKey}
              onPick={(candidate) => {
                setPosterUrl(candidate.imageUrl);
                setFinderOpen(false);
              }}
            />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {item ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </form>

        <AlertDialog
          open={pendingRemoval !== null}
          onOpenChange={(value) => {
            if (!value) setPendingRemoval(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Удалить сезон S{(pendingRemoval ?? 0) + 1}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                У сезона уже есть отметка. Она пропадёт безвозвратно, а следующие сезоны
                перенумеруются.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => {
                  if (pendingRemoval !== null) removeAt(pendingRemoval);
                  setPendingRemoval(null);
                }}
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
