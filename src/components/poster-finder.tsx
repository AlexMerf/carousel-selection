import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findPosters, SOURCE_LABEL } from "@/lib/poster-search";
import type { PosterCandidate, PosterSearchReport } from "@/lib/poster-search";
import { cn } from "@/lib/utils";
import type { ItemType } from "@/types";

interface PosterFinderProps {
  query: string;
  type: ItemType;
  omdbKey?: string;
  onPick: (candidate: PosterCandidate) => void;
}

export function PosterFinder({ query, type, omdbKey, onPick }: PosterFinderProps) {
  const [text, setText] = useState(query);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<PosterSearchReport | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (value: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!value.trim()) {
        setReport({ candidates: [], errors: [] });
        return;
      }

      setLoading(true);
      try {
        const result = await findPosters({ query: value, type, omdbKey, signal: controller.signal });
        if (!controller.signal.aborted) setReport(result);
      } catch (error) {
        if (!controller.signal.aborted) {
          setReport({
            candidates: [],
            errors: [error instanceof Error ? error.message : "Поиск не удался"],
          });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [omdbKey, type],
  );

  useEffect(() => {
    void run(query);
    return () => abortRef.current?.abort();
  }, [run, query]);

  const submit = () => {
    void run(text);
  };

  // The finder lives inside the item dialog's <form>, so a nested <form> here
  // would bubble its submit up and save-and-close the whole dialog.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submit();
  };

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-background/40 p-3">
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Название для поиска"
          autoComplete="off"
          className="h-9"
        />
        <Button
          type="button"
          onClick={submit}
          size="icon"
          variant="secondary"
          className="size-9 shrink-0"
          aria-label="Искать постер"
        >
          <Search className="size-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Ищу постеры…
        </div>
      ) : report && report.candidates.length > 0 ? (
        <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1">
          {report.candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onPick(candidate)}
              className="group overflow-hidden rounded-lg border border-white/10 bg-card/60 text-left transition hover:border-primary/50"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted/40">
                <img
                  src={candidate.imageUrl}
                  alt={candidate.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.style.visibility = "hidden";
                  }}
                  className="size-full object-cover transition group-hover:scale-[1.03]"
                />
              </div>
              <div className="space-y-0.5 px-1.5 py-1">
                <p className="truncate text-[11px] font-medium">{candidate.title}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {SOURCE_LABEL[candidate.source]}
                  {candidate.subtitle ? ` · ${candidate.subtitle}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : report ? (
        <p className="py-2 text-sm text-muted-foreground">
          Ничего не нашлось. Попробуй оригинальное название или добавь ключ OMDb в настройках.
        </p>
      ) : null}

      {report && report.candidates.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Не то? Вбей оригинальное название — например, «Pulp Fiction» или «Stranger Things».
        </p>
      ) : null}

      {report && report.errors.length > 0 ? (
        <p className={cn("text-[11px] text-muted-foreground")}>{report.errors.join(" · ")}</p>
      ) : null}
    </div>
  );
}
