export const MIN_PASSWORD_LENGTH = 10;

export function validateName(value: string): string | null {
  if (!value.trim()) return "Name is required";
  if (value.trim().length > 80) return "Name must be 80 characters or fewer";
  return null;
}

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Password is required";
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return "Confirm your password";
  if (password !== confirm) return "Passwords do not match";
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
