"use client";

import { Anchor, Button, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import { AuthCard } from "@/features/auth/components/auth-card";
import { validateEmail, validatePassword } from "@/features/auth/utils/validation";
import { ApiError } from "@/lib/api-client";

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next = {
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
    };
    setErrors(next);
    if (next.email || next.password) return;
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Could not sign in";
      setErrors({ form: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to open your personal workspace.">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            error={errors.email}
          />
          <PasswordInput
            label="Password"
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
            Sign in
          </Button>
          <Text size="sm" c="dimmed">
            Need an account?{" "}
            <Anchor component={Link} href="/register">
              Create one
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthCard>
  );
}
