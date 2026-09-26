"use client";

import { ActionIcon, Checkbox, Menu, TextInput } from "@mantine/core";
import { useState } from "react";

import { todayISO } from "@/lib/dates";

import type { PlanDay, PlanItem } from "../types";
import { dayProgress } from "../utils/plan-cache";
import { formatPlanDay } from "../utils/plan-dates";

interface PlanDayCardProps {
  day: PlanDay;
  onToggleItem: (item: PlanItem, completed: boolean) => void;
  onRenameItem: (item: PlanItem, title: string) => void;
  onDeleteItem: (item: PlanItem) => void;
  onAddItem: (day: PlanDay, title: string) => Promise<void>;
  onEditDay: (day: PlanDay) => void;
  onDeleteDay: (day: PlanDay) => void;
}

export function PlanDayCard({
  day,
  onToggleItem,
  onRenameItem,
  onDeleteItem,
  onAddItem,
  onEditDay,
  onDeleteDay,
}: PlanDayCardProps) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const { done, total } = dayProgress(day);
  const isToday = day.day === todayISO();
  const heading = formatPlanDay(day.day);

  async function add() {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      await onAddItem(day, title);
      setDraft("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section
      aria-label={heading}
      className={`flex flex-col rounded-xl border bg-[var(--app-surface)] shadow-sm ${
        isToday ? "border-[var(--app-primary)]" : "border-[var(--app-border)]"
      }`}
    >
      <header className="flex items-start justify-between gap-2 border-b border-[var(--app-border)] px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-[var(--app-text)]">
            {heading}
            {isToday ? (
              <span className="ml-2 text-xs font-medium text-[var(--app-primary)]">Today</span>
            ) : null}
          </h2>
          {day.title ? (
            <p className="truncate text-xs text-[var(--app-text-muted)]">{day.title}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={`text-xs tabular-nums ${
              total > 0 && done === total ? "text-[var(--app-primary)]" : "text-[var(--app-text-muted)]"
            }`}
            aria-label={`${done} of ${total} done`}
          >
            {done}/{total}
          </span>
          <Menu shadow="md" position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Day menu for ${heading}`}>
                ⋯
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => onEditDay(day)}>Edit day</Menu.Item>
              <Menu.Item color="red" onClick={() => onDeleteDay(day)}>
                Delete day
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </header>

      <ul className="flex flex-col py-1" aria-label={`Items for ${heading}`}>
        {day.items.map((item) => (
          <PlanItemRow
            key={item.id}
            item={item}
            onToggle={(completed) => onToggleItem(item, completed)}
            onRename={(title) => onRenameItem(item, title)}
            onDelete={() => onDeleteItem(item)}
          />
        ))}
        {!day.items.length ? (
          <li className="px-3 py-1.5 text-xs text-[var(--app-text-muted)]">No items yet.</li>
        ) : null}
      </ul>

      <form
        className="mt-auto border-t border-[var(--app-border)] px-2 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <TextInput
          size="xs"
          variant="unstyled"
          px={4}
          placeholder="+ Add an item"
          aria-label={`Add an item to ${heading}`}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          disabled={adding}
          maxLength={500}
        />
      </form>
    </section>
  );
}

function PlanItemRow({
  item,
  onToggle,
  onRename,
  onDelete,
}: {
  item: PlanItem;
  onToggle: (completed: boolean) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.title);

  function commit() {
    const title = value.trim();
    setEditing(false);
    if (title && title !== item.title) onRename(title);
    else setValue(item.title);
  }

  return (
    <li className="group flex items-center gap-2 px-3 py-1 hover:bg-[var(--app-surface-muted)]">
      <Checkbox
        size="xs"
        checked={item.is_completed}
        onChange={(event) => onToggle(event.currentTarget.checked)}
        aria-label={item.title}
      />
      {editing ? (
        <TextInput
          size="xs"
          className="min-w-0 flex-1"
          value={value}
          autoFocus
          maxLength={500}
          aria-label="Item text"
          onChange={(event) => setValue(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              setValue(item.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className={`min-w-0 flex-1 cursor-pointer text-left text-sm ${
            item.is_completed
              ? "text-[var(--app-text-muted)] line-through"
              : "text-[var(--app-text)]"
          }`}
          aria-hidden
          tabIndex={-1}
          onClick={() => onToggle(!item.is_completed)}
        >
          {item.title}
        </button>
      )}
      {!editing ? (
        <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            aria-label={`Edit ${item.title}`}
            onClick={() => {
              setValue(item.title);
              setEditing(true);
            }}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden>
              <path
                d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" size="xs" aria-label={`Delete ${item.title}`} onClick={onDelete}>
            <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </ActionIcon>
        </div>
      ) : null}
    </li>
  );
}
