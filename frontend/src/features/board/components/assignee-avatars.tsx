"use client";

import { Avatar, Tooltip } from "@mantine/core";

import { initials } from "../utils/person";

export interface AvatarPerson {
  id: string;
  display_name: string;
}

const COLORS = ["teal", "blue", "violet", "orange", "pink", "cyan", "grape", "indigo"];

/** A stable avatar color per person, so the same teammate looks the same everywhere. */
export function avatarColor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return COLORS[hash % COLORS.length];
}

/** Stacked avatars for a task's assignees. Hovering an avatar shows the person's name. */
export function AssigneeAvatars({
  people,
  size = 20,
  max = 3,
}: {
  people: AvatarPerson[];
  size?: number;
  max?: number;
}) {
  if (!people.length) return null;

  const shown = people.slice(0, max);
  const hidden = people.slice(max);
  return (
    <Avatar.Group spacing={Math.round(size / 5)} aria-label={people.map((person) => person.display_name).join(", ")}>
      {shown.map((person) => (
        <Tooltip key={person.id} label={person.display_name} withinPortal>
          <Avatar size={size} radius="xl" color={avatarColor(person.id)}>
            <span style={{ fontSize: Math.max(8, Math.round(size * 0.42)) }}>{initials(person.display_name)}</span>
          </Avatar>
        </Tooltip>
      ))}
      {hidden.length ? (
        <Tooltip label={hidden.map((person) => person.display_name).join(", ")} withinPortal>
          <Avatar size={size} radius="xl">
            <span style={{ fontSize: Math.max(8, Math.round(size * 0.42)) }}>+{hidden.length}</span>
          </Avatar>
        </Tooltip>
      ) : null}
    </Avatar.Group>
  );
}
