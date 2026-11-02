import { ActionIcon, Avatar, Badge, Button, Group, Input, Loader, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useRouter } from "@/lib/navigation";
import { useState } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import { notifyApiError, notifySuccess } from "@/lib/notify";

import { useBoardMemberMutations, useBoardMembers } from "../hooks/use-board-members";
import { initials } from "../utils/person";
import { t } from "@/i18n";

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
      setError(t("auth.emailInvalid"));
      return;
    }
    setError(null);
    try {
      const result = await invite.mutateAsync(value);
      setEmail("");
      notifySuccess(
        result.status === "added"
          ? t("members.added", { email: value, board: boardName })
          : t("members.invitationSaved", { email: value, board: boardName }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("members.couldNotInvite"));
    }
  }

  async function leave() {
    if (!user) return;
    try {
      await remove.mutateAsync(user.id);
      onClose();
      router.push("/boards");
    } catch (err) {
      notifyApiError(err, t("members.couldNotLeave"));
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t("members.shareTitle", { name: boardName })} radius="lg" size="md">
      <Stack gap="md">
        {canManage ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {/* Label and help text sit above the row so the button always lines up with the input. */}
            <Input.Label htmlFor="invite-email">{t("members.inviteByEmail")}</Input.Label>
            <Input.Description mb={8}>
              {t("members.inviteHint")}
            </Input.Description>
            <Group align="flex-start" gap="xs" wrap="nowrap">
              <TextInput
                id="invite-email"
                className="flex-1"
                inputMode="email"
                autoComplete="email"
                placeholder={t("members.emailPlaceholder")}
                value={email}
                onChange={(event) => {
                  setEmail(event.currentTarget.value);
                  setError(null);
                }}
                error={error}
                data-autofocus
              />
              <Button type="submit" loading={invite.isPending} disabled={!email.trim()}>
                {t("members.invite")}
              </Button>
            </Group>
          </form>
        ) : null}

        <div>
          <Text size="sm" fw={600} mb={6}>
            {t("members.people")}
          </Text>
          {membersQuery.isLoading ? <Loader size="sm" /> : null}
          {membersQuery.isError ? <Text c="red" size="sm">{t("members.couldNotLoad")}</Text> : null}
          <ul aria-label={t("members.membersLabel")} className="divide-y divide-[var(--app-border)]">
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
                      {isMe ? t("members.youSuffix") : ""}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {person.email}
                    </Text>
                  </div>
                  {person.role === "owner" ? (
                    <Badge variant="light" size="sm">
                      {t("members.owner")}
                    </Badge>
                  ) : canManage ? (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="red"
                      loading={remove.isPending && remove.variables === person.user_id}
                      onClick={() =>
                        remove.mutate(person.user_id, {
                          onError: (err) => notifyApiError(err, t("members.couldNotRemove")),
                        })
                      }
                    >
                      {t("members.remove")}
                    </Button>
                  ) : isMe ? (
                    <Button size="compact-xs" variant="subtle" color="red" onClick={() => void leave()}>
                      {t("members.leave")}
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
              {t("members.pendingInvitations")}
            </Text>
            <ul aria-label={t("members.pendingInvitations")} className="divide-y divide-[var(--app-border)]">
              {members.invitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center gap-3 py-2">
                  <Text size="sm" className="min-w-0 flex-1" truncate>
                    {invitation.email}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t("members.joinsOnSignUp")}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label={t("members.cancelInvitationFor", { email: invitation.email })}
                    onClick={() =>
                      cancelInvitation.mutate(invitation.id, {
                        onError: (err) => notifyApiError(err, t("members.couldNotCancelInvitation")),
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
