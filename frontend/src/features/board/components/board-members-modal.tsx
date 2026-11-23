import { Avatar, Badge, Button, Group, Input, Loader, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useRouter } from "@/lib/navigation";
import { useState } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import { validateLoginId } from "@/features/auth/utils/validation";
import { notifyApiError, notifySuccess } from "@/lib/notify";

import { useBoardMemberMutations, useBoardMembers } from "../hooks/use-board-members";
import { initials } from "../utils/person";
import { t } from "@/i18n";

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
  const { invite, remove } = useBoardMemberMutations(boardId);
  const [loginId, setLoginId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const members = membersQuery.data;
  const canManage = members?.can_manage ?? false;

  async function submit() {
    const value = loginId.trim();
    const invalid = validateLoginId(value);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    try {
      await invite.mutateAsync(value);
      setLoginId("");
      notifySuccess(t("members.added", { loginId: value, board: boardName }));
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
            <Input.Label htmlFor="invite-login-id">{t("members.inviteByLoginId")}</Input.Label>
            <Input.Description mb={8}>
              {t("members.inviteHint")}
            </Input.Description>
            <Group align="flex-start" gap="xs" wrap="nowrap">
              <TextInput
                id="invite-login-id"
                className="flex-1"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t("members.loginIdPlaceholder")}
                value={loginId}
                onChange={(event) => {
                  setLoginId(event.currentTarget.value);
                  setError(null);
                }}
                error={error}
                data-autofocus
              />
              <Button type="submit" loading={invite.isPending} disabled={!loginId.trim()}>
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
                      {person.login_id}
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
      </Stack>
    </Modal>
  );
}
