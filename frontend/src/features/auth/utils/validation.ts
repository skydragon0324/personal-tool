import { t } from "@/i18n";

export const MIN_PASSWORD_LENGTH = 8;
const LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/i;

export function validateName(value: string): string | null {
  if (!value.trim()) return t("auth.nameRequired");
  if (value.trim().length > 80) return t("auth.nameTooLong");
  return null;
}

export function validateLoginId(value: string): string | null {
  const loginId = value.trim();
  if (!loginId) return t("auth.loginIdRequired");
  if (!LOGIN_ID_PATTERN.test(loginId)) return t("auth.loginIdInvalid");
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return t("auth.passwordRequired");
  if (value.length < MIN_PASSWORD_LENGTH) {
    return t("auth.passwordTooShort", { min: MIN_PASSWORD_LENGTH });
  }
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return t("auth.confirmRequired");
  if (password !== confirm) return t("auth.passwordsDiffer");
  return null;
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function isAuthPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/login" || pathname === "/register";
}

export function isWorkspacePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return !isAuthPath(pathname);
}
