import { useEffect, useMemo, useState } from "react";
import { Disc3, Settings, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

import { HiddenView } from "@/components/hidden-view";
import { HistoryView } from "@/components/history-view";
import { ItemDialog, type ItemFormValues } from "@/components/item-dialog";
import { PoolView } from "@/components/pool-view";
import { SettingsDialog } from "@/components/settings-dialog";
import { SpinScreen } from "@/components/spin-screen";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createEmptyState, EXAMPLE_ITEMS, ITEM_TYPES, uid } from "@/lib/items";
import { sound } from "@/lib/sound";
import { exportStateFile, loadState, readStateFile, saveState } from "@/lib/storage";
import type { AppState, Item, ItemStatus, ItemType, TabId } from "@/types";

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [tab, setTab] = useState<TabId>("wheel");
  const [types, setTypes] = useState<Set<ItemType>>(() => new Set(ITEM_TYPES));
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [finderInitiallyOpen, setFinderInitiallyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    sound.enabled = state.settings.sound;
  }, [state.settings.sound]);

  const pool = useMemo(() => state.items.filter((item) => item.status === "pool"), [state.items]);
  const history = useMemo(
    () => state.items.filter((item) => item.status !== "pool" && item.status !== "hidden"),
    [state.items],
  );
  const hidden = useMemo(() => state.items.filter((item) => item.status === "hidden"), [state.items]);

  const addItem = (values: ItemFormValues) => {
    const now = Date.now();
    const item: Item = {
      id: uid(),
      title: values.title,
      type: values.type,
      posterUrl: values.posterUrl,
      status: "pool",
      createdAt: now,
      statusChangedAt: now,
    };
    setState((prev) => ({ ...prev, items: [...prev.items, item] }));
    toast.success(`«${item.title}» — в пуле`);
  };

  const updateItem = (id: string, values: ItemFormValues) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id
          ? {
              ...item,
              title: values.title,
              type: values.type,
              posterUrl: values.posterUrl,
            }
          : item,
      ),
    }));
    toast(`«${values.title}» обновлён`);
  };

  const removeItem = (id: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
      lastWinnerId: prev.lastWinnerId === id ? null : prev.lastWinnerId,
    }));
  };

  const setStatus = (id: string, status: ItemStatus) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, status, statusChangedAt: Date.now() } : item,
      ),
    }));
  };

  const recordWinner = (item: Item) => {
    setState((prev) => ({ ...prev, lastWinnerId: item.id }));
  };

  const addExamples = () => {
    const now = Date.now();
    const examples: Item[] = EXAMPLE_ITEMS.map((example, index) => ({
      id: uid(),
      title: example.title,
      type: example.type,
      status: "pool",
      createdAt: now + index,
      statusChangedAt: now + index,
    }));
    setState((prev) => ({ ...prev, items: [...prev.items, ...examples] }));
    toast.success("Добавил шесть примеров — можно крутить");
  };

  const toggleType = (type: ItemType) => {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleImport = (file: File) => {
    readStateFile(file)
      .then((next) => {
        setState(next);
        toast.success("Резервная копия загружена");
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Не удалось импортировать");
      });
  };

  const clearAll = () => {
    setState(createEmptyState());
    toast("Всё очищено");
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setFinderInitiallyOpen(false);
    setItemDialogOpen(true);
  };

  const openEditDialog = (item: Item) => {
    setEditingItem(item);
    setFinderInitiallyOpen(false);
    setItemDialogOpen(true);
  };

  const openPosterSearch = (item: Item) => {
    setEditingItem(item);
    setFinderInitiallyOpen(true);
    setItemDialogOpen(true);
  };

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as TabId)}
        className="flex flex-1 flex-col"
      >
        <header className="sticky top-0 z-20 border-b border-white/5 bg-background/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Disc3 className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">Кинокольцо</p>
                <p className="mt-1 text-[10px] leading-none text-muted-foreground">
                  что посмотреть сегодня
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                aria-label={state.settings.sound ? "Выключить звук" : "Включить звук"}
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, sound: !prev.settings.sound },
                  }))
                }
              >
                {state.settings.sound ? (
                  <Volume2 className="size-4" />
                ) : (
                  <VolumeX className="size-4 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Настройки"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mx-auto w-full max-w-2xl px-4 pb-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="wheel">Кольцо</TabsTrigger>
              <TabsTrigger value="pool">
                Пул
                <span className="ml-1 text-[10px] text-muted-foreground">{pool.length}</span>
              </TabsTrigger>
              <TabsTrigger value="history">История</TabsTrigger>
              <TabsTrigger value="hidden">Скрытые</TabsTrigger>
            </TabsList>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-5">
          <TabsContent value="wheel">
            <SpinScreen
              pool={pool}
              types={types}
              onToggleType={toggleType}
              lastWinnerId={state.lastWinnerId}
              onSpun={recordWinner}
              onStatus={setStatus}
              onAddClick={openAddDialog}
              onAddExamples={addExamples}
            />
          </TabsContent>

          <TabsContent value="pool">
            <PoolView
              items={pool}
              onAddClick={openAddDialog}
              onAddExamples={addExamples}
              onEdit={openEditDialog}
              onDelete={removeItem}
              onHide={(id) => setStatus(id, "hidden")}
              onFindPoster={openPosterSearch}
            />
          </TabsContent>

          <TabsContent value="history">
            <HistoryView items={history} onStatus={setStatus} onDelete={removeItem} />
          </TabsContent>

          <TabsContent value="hidden">
            <HiddenView items={hidden} onRestore={(id) => setStatus(id, "pool")} onDelete={removeItem} />
          </TabsContent>
        </main>
      </Tabs>

      <ItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        item={editingItem}
        omdbKey={state.settings.omdbKey}
        finderInitiallyOpen={finderInitiallyOpen}
        onSubmit={(values) => {
          if (editingItem) updateItem(editingItem.id, values);
          else addItem(values);
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        soundEnabled={state.settings.sound}
        onSoundChange={(value) =>
          setState((prev) => ({ ...prev, settings: { ...prev.settings, sound: value } }))
        }
        omdbKey={state.settings.omdbKey}
        onOmdbKeyChange={(value) =>
          setState((prev) => ({ ...prev, settings: { ...prev.settings, omdbKey: value } }))
        }
        onExport={() => exportStateFile(state)}
        onImportFile={handleImport}
        onClearAll={clearAll}
        totals={{ pool: pool.length, history: history.length, hidden: hidden.length }}
      />

      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
