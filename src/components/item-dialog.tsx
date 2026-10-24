import { useEffect, useState } from "react";
import type { FormEvent } from "react";

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
import type { Item, ItemType } from "@/types";

export interface ItemFormValues {
  title: string;
  type: ItemType;
  posterUrl?: string;
}

interface ItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  onSubmit: (values: ItemFormValues) => void;
}

export function ItemDialog({ open, onOpenChange, item, onSubmit }: ItemDialogProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ItemType>("film");
  const [posterUrl, setPosterUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setType(item?.type ?? "film");
    setPosterUrl(item?.posterUrl ?? "");
  }, [open, item]);

  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      title: trimmedTitle,
      type,
      posterUrl: posterUrl.trim() ? posterUrl.trim() : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Изменить позицию" : "Новая позиция"}</DialogTitle>
          <DialogDescription>
            {item
              ? "Поправь название, тип или ссылку на постер."
              : "Название и тип обязательны, постер — по желанию."}
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
            <Select value={type} onValueChange={(value) => setType(value as ItemType)}>
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

          <div className="space-y-2">
            <Label htmlFor="item-poster">Ссылка на постер</Label>
            <Input
              id="item-poster"
              value={posterUrl}
              onChange={(event) => setPosterUrl(event.target.value)}
              placeholder="https://…/poster.jpg"
              inputMode="url"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Можно вставить ссылку на картинку. Без неё будет аккуратная заглушка.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {item ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
