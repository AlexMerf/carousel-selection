import { useCallback, useMemo, useState } from "react";
import { Plus, Shuffle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ResultPanel } from "@/components/result-panel";
import { Button } from "@/components/ui/button";
import { WheelStage } from "@/components/wheel-stage";
import { ITEM_TYPES, pickWinner, poolCandidates, TYPE_LABEL } from "@/lib/items";
import { cn } from "@/lib/utils";
import type { Item, ItemStatus, ItemType } from "@/types";

interface SpinScreenProps {
  pool: Item[];
  types: Set<ItemType>;
  onToggleType: (type: ItemType) => void;
  lastWinnerId: string | null;
  onSpun: (item: Item) => void;
  onStatus: (id: string, status: ItemStatus) => void;
  onAddClick: () => void;
  onAddExamples: () => void;
}

export function SpinScreen({
  pool,
  types,
  onToggleType,
  lastWinnerId,
  onSpun,
  onStatus,
  onAddClick,
  onAddExamples,
}: SpinScreenProps) {
  const [spinToken, setSpinToken] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Item | null>(null);

  const candidates = useMemo(() => poolCandidates(pool, types), [pool, types]);
  const pick = useCallback(() => pickWinner(candidates, lastWinnerId), [candidates, lastWinnerId]);

  const startSpin = () => {
    if (candidates.length === 0) return;
    setWinner(null);
    setSpinToken((value) => value + 1);
  };

  const handleWinner = (item: Item) => {
    setSpinning(false);
    setWinner(item);
    onSpun(item);
  };

  if (pool.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-4 rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Пул пока пустой</p>
          <p className="text-sm text-muted-foreground">
            Добавь фильмы, сериалы и аниме, которые хочешь посмотреть — и раскрути кольцо.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={onAddClick} className="h-11 w-full">
            <Plus className="size-4" />
            Добавить первое
          </Button>
          <Button variant="ghost" onClick={onAddExamples} className="h-10 w-full">
            Заполнить примерами
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {ITEM_TYPES.map((type) => {
          const count = pool.filter((item) => item.type === type).length;
          const active = types.has(type);
          return (
            <Button
              key={type}
              type="button"
              variant={active ? "secondary" : "ghost"}
              size="sm"
              disabled={count === 0}
              onClick={() => onToggleType(type)}
              aria-pressed={active}
              className={cn(
                "h-9 justify-between border border-transparent px-3 text-xs",
                active && "border-primary/35 bg-secondary text-foreground",
                count === 0 && "opacity-45",
              )}
            >
              {TYPE_LABEL[type]}
              <span className="text-[11px] text-muted-foreground">{count}</span>
            </Button>
          );
        })}
      </div>

      <WheelStage
        items={candidates}
        pick={pick}
        spinToken={spinToken}
        onSpinStart={() => setSpinning(true)}
        onWinner={handleWinner}
      />

      {candidates.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          В выбранных типах пусто — включи ещё один тип или добавь позиции.
        </p>
      ) : (
        <Button onClick={startSpin} disabled={spinning} size="lg" className="h-12 w-full text-base">
          <Shuffle className="size-5" />
          {spinning ? "Крутится…" : "Крутить"}
        </Button>
      )}

      {winner ? (
        <ResultPanel
          item={winner}
          onWatch={() => {
            onStatus(winner.id, "watching");
            toast.success(`«${winner.title}» — в истории. Приятного просмотра`);
            setWinner(null);
          }}
          onLater={() => {
            toast("Остаётся в пуле — крути ещё");
            setWinner(null);
          }}
          onNever={() => {
            onStatus(winner.id, "hidden");
            toast(`«${winner.title}» — в скрытых, вернуть можно там`);
            setWinner(null);
          }}
        />
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Потяни кольцо и отпусти — или нажми «Крутить»
        </p>
      )}
    </div>
  );
}
