import { Anchor, Button, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import { AuthCard } from "@/features/auth/components/auth-card";
import { validateLoginId, validatePassword } from "@/features/auth/utils/validation";
import { ApiError } from "@/lib/api-client";
import { t } from "@/i18n";

export function LoginForm() {
  const { login } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ loginId?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next = {
      loginId: validateLoginId(loginId) ?? undefined,
      password: validatePassword(password) ?? undefined,
    };
    setErrors(next);
    if (next.loginId || next.password) return;
    setSubmitting(true);
    try {
      await login({ login_id: loginId.trim(), password });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("auth.couldNotSignIn");
      setErrors({ form: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title={t("auth.welcomeBack")} subtitle={t("auth.signInSubtitle")}>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
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
          <PasswordInput
            label={t("auth.password")}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            error={errors.password}
          />
          {errors.form ? (
            <Text size="sm" c="red">
              {errors.form}
            </Text>
          ) : null}
          <Button type="submit" loading={submitting}>
            {t("auth.signIn")}
          </Button>
          <Text size="sm" c="dimmed">
            {t("auth.needAccount")}{" "}
            <Anchor component={Link} href="/register">
              {t("auth.createOne")}
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthCard>
  );
}
