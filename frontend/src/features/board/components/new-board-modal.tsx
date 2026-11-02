import { move } from "@dnd-kit/helpers";
import { CollisionPriority } from "@dnd-kit/abstract";
import { DragDropProvider } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Button, Checkbox, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "@/lib/navigation";

import { ApiError } from "@/lib/api-client";
import { notifyApiError, notifySuccess } from "@/lib/notify";
import { useBoardMutations } from "../hooks/use-boards";
import type { BoardStatusSeed } from "../types";
import { BOARD_COLORS, BOARD_ICONS, BoardGlyph, boardColorClass, boardIconLabel } from "../utils/board-icons";
import { writeLastBoardId } from "../utils/last-board";
import { STATUS_COLORS, statusHeaderClass } from "../utils/status-colors";
import { colorName, t } from "@/i18n";

interface NewBoardModalProps {
  opened: boolean;
  onClose: () => void;
}

interface DraftStatus {
  key: string;
  name: string;
  color: string;
  is_done: boolean;
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function defaultStatuses(): DraftStatus[] {
  return [
    { key: "todo", name: t("boards.defaultTodo"), color: "slate", is_done: false },
    { key: "progress", name: t("boards.defaultInProgress"), color: "blue", is_done: false },
    { key: "done", name: t("boards.defaultDone"), color: "teal", is_done: true },
  ];
}

function validateStatuses(items: DraftStatus[]): string | null {
  if (items.length < 1) return t("boards.needOneStatus");
  if (items.length > 20) return t("boards.tooManyStatuses");
  if (items.some((item) => !item.name.trim())) return t("boards.emptyStatusName");
  const names = items.map((item) => item.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return t("boards.uniqueStatusNames");
  if (!items.some((item) => item.is_done)) return t("boards.needCompletedStatus");
  return null;
}

function SortableDraftStatus({
  status,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  status: DraftStatus;
  index: number;
  onChange: (patch: Partial<DraftStatus>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { ref, handleRef } = useSortable({
    id: status.key,
    index,
    type: "seed-status",
    accept: "seed-status",
    group: "seed-statuses",
  });

  return (
    <div ref={ref} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          ref={handleRef}
          className="mt-1 cursor-grab rounded-md border border-[var(--app-border)] px-2 py-1 text-[var(--app-text-muted)]"
          aria-label={t("boards.reorderStatus", { name: status.name || t("boards.statusFallback") })}
        >
          ⋮⋮
        </button>
        <div className={`mt-1 h-8 w-1.5 rounded-full ${statusHeaderClass(status.color)}`} />
        <div className="min-w-0 flex-1 space-y-2">
          <TextInput
            label={t("boards.name")}
            value={status.name}
            onChange={(event) => onChange({ name: event.currentTarget.value })}
          />
          <Group gap="xs">
            {STATUS_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`h-6 w-6 rounded-full ${statusHeaderClass(color)} ${
                  status.color === color ? "ring-2 ring-[var(--app-primary)] ring-offset-2" : ""
                }`}
                onClick={() => onChange({ color })}
                aria-label={colorName(color)}
              />
            ))}
          </Group>
          <Checkbox
            label={t("status.countsAsCompleted")}
            checked={status.is_done}
            onChange={(event) => onChange({ is_done: event.currentTarget.checked })}
          />
          <Button size="xs" color="red" variant="light" onClick={onRemove} disabled={!canRemove}>
            {t("boards.remove")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SeedStatusList({ children }: { children: React.ReactNode }) {
  const { ref } = useDroppable({
    id: "seed-statuses",
    type: "column",
    accept: "seed-status",
    collisionPriority: CollisionPriority.Low,
  });
  return (
    <div ref={ref} className="space-y-3">
      {children}
    </div>
  );
}

export function NewBoardModal({ opened, onClose }: NewBoardModalProps) {
  const router = useRouter();
  const { create } = useBoardMutations();
  const [name, setName] = useState("");
  const [color, setColor] = useState("teal");
  const [icon, setIcon] = useState("home");
  const [timezone, setTimezone] = useState(browserTimezone);
  const [statuses, setStatuses] = useState<DraftStatus[]>(defaultStatuses);
  const orderedRef = useRef(statuses.map((item) => item.key));
  orderedRef.current = statuses.map((item) => item.key);

  const statusError = useMemo(() => validateStatuses(statuses), [statuses]);

  function reset() {
    setName("");
    setColor("teal");
    setIcon("home");
    setTimezone(browserTimezone());
    setStatuses(defaultStatuses());
  }

  async function handleSubmit() {
    if (!name.trim() || statusError || create.isPending) return;
    const payloadStatuses: BoardStatusSeed[] = statuses.map((item, index) => ({
      name: item.name.trim(),
      color: item.color,
      is_done: item.is_done,
      position: index,
    }));
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        color,
        icon_name: icon,
        timezone,
        statuses: payloadStatuses,
      });
      writeLastBoardId(created.id, window.localStorage);
      notifySuccess(t("boards.created", { name: created.name }));
      reset();
      onClose();
      router.push(`/boards/${created.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        notifyApiError(error, t("boards.nameTaken"));
        return;
      }
      notifyApiError(error, t("boards.couldNotCreate"));
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!create.isPending) onClose();
      }}
      title={t("boards.newTitle")}
      size="xl"
      radius="lg"
      styles={{ body: { maxHeight: "min(80vh, 760px)", overflowY: "auto" } }}
    >
      <Stack>
        <TextInput
          label={t("boards.name")}
          required
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          placeholder={t("boards.namePlaceholder")}
        />
        <div>
          <p className="mb-2 text-sm font-medium">{t("boards.color")}</p>
          <Group gap="xs">
            {BOARD_COLORS.map((item) => (
              <button
                key={item}
                type="button"
                className={`h-6 w-6 rounded-full ${boardColorClass(item)} ${
                  color === item ? "ring-2 ring-[var(--app-primary)] ring-offset-2" : ""
                }`}
                onClick={() => setColor(item)}
                aria-label={colorName(item)}
              />
            ))}
          </Group>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{t("boards.icon")}</p>
          <Group gap="xs">
            {BOARD_ICONS.map((item) => (
              <button
                key={item}
                type="button"
                className={`flex h-9 w-9 items-center justify-center rounded-md border ${
                  icon === item
                    ? "border-[var(--app-primary)] text-[var(--app-primary)]"
                    : "border-[var(--app-border)] text-[var(--app-text-muted)]"
                }`}
                onClick={() => setIcon(item)}
                aria-label={boardIconLabel(item)}
              >
                <BoardGlyph name={item} />
              </button>
            ))}
          </Group>
        </div>
        <TextInput
          label={t("boards.timezone")}
          value={timezone}
          onChange={(event) => setTimezone(event.currentTarget.value)}
          placeholder="America/New_York"
        />

        <div>
          <Text fw={600}>{t("boards.initialStatuses")}</Text>
          <Text size="sm" c="dimmed" mb="sm">
            {t("boards.initialStatusesHint")}
          </Text>
          <DragDropProvider
            onDragOver={(event) => {
              if (event.operation.source?.type === "column") return;
              setStatuses((current) => {
                const ids = current.map((item) => item.key);
                const next = move({ statuses: ids }, event) as { statuses: string[] };
                orderedRef.current = next.statuses;
                return next.statuses
                  .map((key) => current.find((item) => item.key === key))
                  .filter((item): item is DraftStatus => Boolean(item));
              });
            }}
          >
            <SeedStatusList>
              {statuses.map((status, index) => (
                <SortableDraftStatus
                  key={status.key}
                  status={status}
                  index={index}
                  canRemove={statuses.length > 1}
                  onChange={(patch) =>
                    setStatuses((current) =>
                      current.map((item) => (item.key === status.key ? { ...item, ...patch } : item)),
                    )
                  }
                  onRemove={() =>
                    setStatuses((current) => current.filter((item) => item.key !== status.key))
                  }
                />
              ))}
            </SeedStatusList>
          </DragDropProvider>
          <Button
            className="mt-3"
            variant="light"
            disabled={statuses.length >= 20}
            onClick={() =>
              setStatuses((current) => [
                ...current,
                {
                  key: `status-${Date.now()}`,
                  name: t("boards.newStatus"),
                  color: "slate",
                  is_done: false,
                },
              ])
            }
          >
            {t("status.addStatus")}
          </Button>
          {statusError ? (
            <Text size="sm" c="red" mt="xs">
              {statusError}
            </Text>
          ) : null}
        </div>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={create.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            loading={create.isPending}
            disabled={!name.trim() || Boolean(statusError)}
          >
            {t("boards.createBoard")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
