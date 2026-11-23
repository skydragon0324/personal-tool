import { Button, Divider, Modal, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useEffect, useState } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import {
  validateConfirmPassword,
  validateLoginId,
  validateName,
  validatePassword,
} from "@/features/auth/utils/validation";
import { t } from "@/i18n";
import { ApiError } from "@/lib/api-client";
import { notifySuccess } from "@/lib/notify";

/** Lets the signed-in user change their name, login ID and password. */
export function AccountSettingsModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title={t("account.title")} radius="lg" size="md">
      {opened ? (
        <Stack gap="lg">
          <ProfileForm />
          <Divider />
          <PasswordForm />
        </Stack>
      ) : null}
    </Modal>
  );
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function ProfileForm() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.display_name ?? "");
  const [loginId, setLoginId] = useState(user?.login_id ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; loginId?: string; password?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.display_name ?? "");
    setLoginId(user?.login_id ?? "");
  }, [user?.display_name, user?.login_id]);

  if (!user) return null;
  const nameChanged = name.trim() !== user.display_name;
  const loginIdChanged = loginId.trim().toLowerCase() !== user.login_id.toLowerCase();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!nameChanged && !loginIdChanged) {
      setErrors({ form: t("account.noChanges") });
      return;
    }
    const next = {
      name: validateName(name) ?? undefined,
      loginId: validateLoginId(loginId) ?? undefined,
      password: loginIdChanged && !password ? t("account.currentPasswordForLoginId") : undefined,
    };
    setErrors(next);
    if (next.name || next.loginId || next.password) return;
    setSaving(true);
    try {
      await updateProfile({
        ...(nameChanged ? { display_name: name.trim() } : {}),
        ...(loginIdChanged ? { login_id: loginId.trim(), current_password: password } : {}),
      });
      setPassword("");
      setErrors({});
      notifySuccess(t("account.profileSaved"));
    } catch (error) {
      const message = errorText(error, t("account.couldNotSaveProfile"));
      const aboutPassword = error instanceof ApiError && error.code?.startsWith("current_password");
      setErrors(aboutPassword ? { password: message } : { form: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="sm">
        <div>
          <Title order={5}>{t("account.profile")}</Title>
          <Text size="sm" c="dimmed">
            {t("account.profileHint")}
          </Text>
        </div>
        <TextInput
          label={t("auth.name")}
          autoComplete="name"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.currentTarget.value)}
          error={errors.name}
        />
        <TextInput
          label={t("auth.loginId")}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          value={loginId}
          onChange={(event) => setLoginId(event.currentTarget.value)}
          error={errors.loginId}
        />
        {loginIdChanged ? (
          <PasswordInput
            label={t("account.currentPassword")}
            description={t("account.currentPasswordForLoginId")}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            error={errors.password}
          />
        ) : null}
        {errors.form ? (
          <Text size="sm" c="red">
            {errors.form}
          </Text>
        ) : null}
        <div>
          <Button type="submit" loading={saving}>
            {t("account.saveProfile")}
          </Button>
        </div>
      </Stack>
    </form>
  );
}

function PasswordForm() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = {
      current: current ? undefined : t("auth.passwordRequired"),
      next:
        validatePassword(next) ??
        (next && next === current ? t("account.samePassword") : null) ??
        undefined,
      confirm: validateConfirmPassword(next, confirm) ?? undefined,
    };
    setErrors(found);
    if (found.current || found.next || found.confirm) return;
    setSaving(true);
    try {
      await changePassword({ current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      setErrors({});
      notifySuccess(t("account.passwordChanged"));
    } catch (error) {
      const message = errorText(error, t("account.couldNotChangePassword"));
      const aboutCurrent = error instanceof ApiError && error.code === "current_password_wrong";
      setErrors(aboutCurrent ? { current: message } : { form: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="sm">
        <div>
          <Title order={5}>{t("account.passwordTitle")}</Title>
          <Text size="sm" c="dimmed">
            {t("account.passwordHint")}
          </Text>
        </div>
        <PasswordInput
          label={t("account.currentPassword")}
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.currentTarget.value)}
          error={errors.current}
        />
        <PasswordInput
          label={t("account.newPassword")}
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.currentTarget.value)}
          error={errors.next}
        />
        <PasswordInput
          label={t("account.confirmNewPassword")}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.currentTarget.value)}
          error={errors.confirm}
        />
        {errors.form ? (
          <Text size="sm" c="red">
            {errors.form}
          </Text>
        ) : null}
        <div>
          <Button type="submit" loading={saving}>
            {t("account.changePassword")}
          </Button>
        </div>
      </Stack>
    </form>
  );
}
