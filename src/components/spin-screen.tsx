import { useCallback, useMemo, useState } from "react";
import { Plus, Shuffle, Sparkles } from "lucide-react";

import { ListSwitcher } from "@/components/list-switcher";
import { Button } from "@/components/ui/button";
import { WheelStage } from "@/components/wheel-stage";
import { WinnerDialog } from "@/components/winner-dialog";
import { nextListWithItems, pickWinner, TYPE_LABEL } from "@/lib/items";
import { isWatchable } from "@/lib/seasons";
import type { Item, ItemType } from "@/types";

interface SpinScreenProps {
  pool: Item[];
  activeList: ItemType;
  counts: Record<ItemType, number>;
  onListChange: (type: ItemType) => void;
  lastWinnerId: string | null;
  onSpun: (item: Item) => void;
  onWatch: (item: Item) => void;
  onNever: (item: Item) => void;
  onAddClick: (list: ItemType) => void;
  onAddExamples: (list?: ItemType) => void;
  onOpenPool: () => void;
}

export function SpinScreen({
  pool,
  activeList,
  counts,
  onListChange,
  lastWinnerId,
  onSpun,
  onWatch,
  onNever,
  onAddClick,
  onAddExamples,
  onOpenPool,
}: SpinScreenProps) {
  const [spinToken, setSpinToken] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Item | null>(null);
  /** On-screen box of the winning card, handed to the dialog so it can morph. */
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);

  const listItems = useMemo(
    () => pool.filter((item) => item.type === activeList),
    [pool, activeList],
  );
  /** Only titles with something left to watch take part in the spin. */
  const candidates = useMemo(() => listItems.filter(isWatchable), [listItems]);
  const otherList = useMemo(() => nextListWithItems(pool, activeList), [pool, activeList]);
  const pick = useCallback(() => pickWinner(candidates, lastWinnerId), [candidates, lastWinnerId]);

  // Switching lists unmounts the current ring — never leave the button stuck on "Крутится…".
  const changeList = (type: ItemType) => {
    setSpinning(false);
    onListChange(type);
  };

  const startSpin = () => {
    if (candidates.length === 0) return;
    setWinner(null);
    setOriginRect(null);
    setSpinToken((value) => value + 1);
  };

  const handleWinner = (item: Item, rect: DOMRect | null) => {
    setSpinning(false);
    setOriginRect(rect);
    setWinner(item);
    onSpun(item);
  };

  /** The active list has entries, but every released season is already closed. */
  const nothingToWatch = candidates.length === 0 && listItems.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
      <ListSwitcher active={activeList} counts={counts} onChange={changeList} />

      {pool.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Пул пока пустой</p>
            <p className="text-sm text-muted-foreground">
              Добавь то, что хочешь посмотреть, — и раскрути кольцо. Каждый список крутится отдельно.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button onClick={() => onAddClick(activeList)} className="h-11 w-full">
              <Plus className="size-4" />
              Добавить первое
            </Button>
            <Button variant="ghost" onClick={() => onAddExamples()} className="h-10 w-full">
              Заполнить примерами
            </Button>
          </div>
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">
              {nothingToWatch ? "Нет сезонов для просмотра" : `В списке «${TYPE_LABEL[activeList]}» пусто`}
            </p>
            <p className="text-sm text-muted-foreground">
              {nothingToWatch
                ? `Всё вышедшее в «${TYPE_LABEL[activeList]}» уже просмотрено. Добавь новый сезон в «Изменить» или добавь позицию.`
                : "Кольцо крутит только по активному списку. Добавь позиции сюда — или переключись на другой."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button onClick={() => onAddClick(activeList)} className="h-11 w-full">
              <Plus className="size-4" />
              Добавить в список
            </Button>
            {nothingToWatch ? (
              <Button variant="secondary" onClick={onOpenPool} className="h-10 w-full">
                Открыть Пул
              </Button>
            ) : otherList ? (
              <Button
                variant="secondary"
                onClick={() => changeList(otherList)}
                className="h-10 w-full"
              >
                Открыть «{TYPE_LABEL[otherList]}»
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => onAddExamples(activeList)} className="h-10 w-full">
              <Sparkles className="size-4" />
              Заполнить примерами
            </Button>
          </div>
        </div>
      ) : (
        <>
          <WheelStage
            items={candidates}
            pick={pick}
            spinToken={spinToken}
            onSpinStart={() => setSpinning(true)}
            onWinner={handleWinner}
          />

          <Button onClick={startSpin} disabled={spinning} size="lg" className="h-12 w-full text-base">
            <Shuffle className="size-5" />
            {spinning ? "Крутится…" : "Крутить"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Потяни кольцо и отпусти — или нажми «Крутить»
          </p>
        </>
      )}

      <WinnerDialog
        item={winner}
        originRect={originRect}
        onDismiss={() => setWinner(null)}
        onWatch={() => {
          if (!winner) return;
          onWatch(winner);
          setWinner(null);
        }}
        onLater={() => setWinner(null)}
        onNever={() => {
          if (!winner) return;
          onNever(winner);
          setWinner(null);
        }}
      />
    </div>
  );
}
