import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

import type { Item } from "@/types";
import { posterFallbackInitials, TYPE_GRADIENT } from "@/lib/items";
import { cn } from "@/lib/utils";

interface PosterThumbProps {
  item: Item;
  className?: string;
  imgClassName?: string;
}

export function PosterThumb({ item, className, imgClassName }: PosterThumbProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(item.posterUrl) && !failed;

  useEffect(() => {
    setFailed(false);
  }, [item.posterUrl]);

  return (
    <div className={cn("relative overflow-hidden bg-muted/60", className)}>
      {showImage ? (
        <img
          src={item.posterUrl}
          alt={item.title}
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          className={cn("size-full object-cover", imgClassName)}
        />
      ) : (
        <div
          className={cn(
            "flex size-full flex-col items-center justify-center gap-1 bg-gradient-to-br text-center",
            TYPE_GRADIENT[item.type],
          )}
        >
          <span className="text-sm font-semibold tracking-wide text-white/80">
            {posterFallbackInitials(item.title)}
          </span>
          {item.posterUrl ? <ImageOff className="size-3 text-white/40" /> : null}
        </div>
      )}
    </div>
  );
}
