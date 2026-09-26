"use client";

import { ActionIcon, Avatar, Badge, Button, Group, Loader, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import { notifyApiError, notifySuccess } from "@/lib/notify";

import { useBoardMemberMutations, useBoardMembers } from "../hooks/use-board-members";
import { initials } from "../utils/person";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BoardMembersModal({
  boardId,
  boardName,
  opened,
  onClose,
}: {
  boardId: string;
  boardName: string;
  opened: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const membersQuery = useBoardMembers(boardId, opened);
  const { invite, remove, cancelInvitation } = useBoardMemberMutations(boardId);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const members = membersQuery.data;
  const canManage = members?.can_manage ?? false;

  async function submit() {
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setError("Enter a valid email address");
      return;
    }
    setError(null);
    try {
      const result = await invite.mutateAsync(value);
      setEmail("");
      notifySuccess(
        result.status === "added"
          ? `${value} now has access to ${boardName}`
          : `Invitation saved. ${value} joins ${boardName} when they sign up.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite");
    }
  }

  async function leave() {
    if (!user) return;
    try {
      await remove.mutateAsync(user.id);
      onClose();
      router.push("/boards");
    } catch (err) {
      notifyApiError(err, "Could not leave the board");
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={`Share “${boardName}”`} radius="lg" size="md">
      <Stack gap="md">
        {canManage ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Group align="flex-start" gap="xs" wrap="nowrap">
              <TextInput
                className="flex-1"
                label="Invite by email"
                description="Teammates can create, edit and assign tasks. Only you can change statuses."
                placeholder="teammate@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.currentTarget.value);
                  setError(null);
                }}
                error={error}
                data-autofocus
              />
              <Button type="submit" mt={46} loading={invite.isPending}>
                Invite
              </Button>
            </Group>
          </form>
        ) : null}

        <div>
          <Text size="sm" fw={600} mb={6}>
            People on this board
          </Text>
          {membersQuery.isLoading ? <Loader size="sm" /> : null}
          {membersQuery.isError ? <Text c="red" size="sm">Could not load members.</Text> : null}
          <ul aria-label="Board members" className="divide-y divide-[var(--app-border)]">
            {members?.people.map((person) => {
              const isMe = person.user_id === user?.id;
              return (
                <li key={person.user_id} className="flex items-center gap-3 py-2">
                  <Avatar size="sm" radius="xl" color="teal">
                    {initials(person.display_name)}
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <Text size="sm" fw={500} truncate>
                      {person.display_name}
                      {isMe ? " (you)" : ""}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {person.email}
                    </Text>
                  </div>
                  {person.role === "owner" ? (
                    <Badge variant="light" size="sm">
                      Owner
                    </Badge>
                  ) : canManage ? (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="red"
                      loading={remove.isPending && remove.variables === person.user_id}
                      onClick={() =>
                        remove.mutate(person.user_id, {
                          onError: (err) => notifyApiError(err, "Could not remove member"),
                        })
                      }
                    >
                      Remove
                    </Button>
                  ) : isMe ? (
                    <Button size="compact-xs" variant="subtle" color="red" onClick={() => void leave()}>
                      Leave
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        {canManage && members?.invitations.length ? (
          <div>
            <Text size="sm" fw={600} mb={6}>
              Pending invitations
            </Text>
            <ul aria-label="Pending invitations" className="divide-y divide-[var(--app-border)]">
              {members.invitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center gap-3 py-2">
                  <Text size="sm" className="min-w-0 flex-1" truncate>
                    {invitation.email}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Joins on sign-up
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label={`Cancel invitation for ${invitation.email}`}
                    onClick={() =>
                      cancelInvitation.mutate(invitation.id, {
                        onError: (err) => notifyApiError(err, "Could not cancel the invitation"),
                      })
                    }
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </ActionIcon>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Stack>
    </Modal>
  );
}
