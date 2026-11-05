export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  timezone: string;
  created_at: string;
}

export interface AuthResponse {
  user: AuthUser;
  csrf_token: string;
}

export interface RegisterPayload {
  display_name: string;
  email: string;
  password: string;
  timezone: string;
}

export interface ProfileUpdatePayload {
  display_name?: string;
  email?: string;
  /** Needed only when the email changes. */
  current_password?: string;
}

export interface PasswordChangePayload {
  current_password: string;
  new_password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
