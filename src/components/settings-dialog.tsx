import { useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";

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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  soundEnabled: boolean;
  onSoundChange: (value: boolean) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onClearAll: () => void;
  totals: { pool: number; history: number; hidden: number };
}

export function SettingsDialog({
  open,
  onOpenChange,
  soundEnabled,
  onSoundChange,
  onExport,
  onImportFile,
  onClearAll,
  totals,
}: SettingsDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Настройки</DialogTitle>
          <DialogDescription>
            Данные живут только в этом браузере. Экспорт — единственный способ их не потерять.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-card/50 px-3 py-3">
          <div>
            <p className="text-sm font-medium">Звук</p>
            <p className="text-xs text-muted-foreground">Тиканье колеса и звук на остановке</p>
          </div>
          <Switch checked={soundEnabled} onCheckedChange={onSoundChange} aria-label="Звук" />
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            В пуле {totals.pool} · в истории {totals.history} · скрытых {totals.hidden}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onExport} className="h-10">
              <Download className="size-4" />
              Экспорт
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} className="h-10">
              <Upload className="size-4" />
              Импорт
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImportFile(file);
              event.target.value = "";
            }}
          />
        </div>

        <Separator />

        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setConfirmClear(true)}
        >
          <Trash2 className="size-4" />
          Очистить всё
        </Button>

        <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Очистить пул и историю?</AlertDialogTitle>
              <AlertDialogDescription>
                Пропадут все позиции, история и скрытые. Отменить это будет нельзя.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => {
                  onClearAll();
                  setConfirmClear(false);
                  onOpenChange(false);
                }}
              >
                Очистить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
