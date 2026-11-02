import { Anchor, Button, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import { AuthCard } from "@/features/auth/components/auth-card";
import {
  browserTimezone,
  validateConfirmPassword,
  validateEmail,
  validateName,
  validatePassword,
} from "@/features/auth/utils/validation";
import { ApiError } from "@/lib/api-client";
import { t } from "@/i18n";

export function RegisterForm() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirm?: string;
    form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next = {
      name: validateName(name) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirm: validateConfirmPassword(password, confirm) ?? undefined,
    };
    setErrors(next);
    if (next.name || next.email || next.password || next.confirm) return;
    setSubmitting(true);
    try {
      await register({
        display_name: name.trim(),
        email: email.trim(),
        password,
        timezone: browserTimezone(),
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("auth.couldNotRegister");
      setErrors({ form: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title={t("auth.createWorkspace")} subtitle={t("auth.registerSubtitle")}>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label={t("auth.name")}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            error={errors.name}
          />
          <TextInput
            label={t("auth.email")}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            error={errors.email}
          />
          <PasswordInput
            label={t("auth.password")}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            error={errors.password}
          />
          <PasswordInput
            label={t("auth.confirmPassword")}
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
          <Button type="submit" loading={submitting}>
            {t("auth.createAccount")}
          </Button>
          <Text size="sm" c="dimmed">
            {t("auth.haveAccount")}{" "}
            <Anchor component={Link} href="/login">
              {t("auth.signIn")}
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthCard>
  );
}
