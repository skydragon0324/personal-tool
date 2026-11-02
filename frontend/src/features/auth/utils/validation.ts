import { t } from "@/i18n";

export const MIN_PASSWORD_LENGTH = 10;

export function validateName(value: string): string | null {
  if (!value.trim()) return t("auth.nameRequired");
  if (value.trim().length > 80) return t("auth.nameTooLong");
  return null;
}

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return t("auth.emailRequired");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t("auth.emailInvalid");
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
