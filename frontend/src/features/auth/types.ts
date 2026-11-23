export interface AuthUser {
  id: string;
  login_id: string;
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
  login_id: string;
  password: string;
  timezone: string;
}

export interface ProfileUpdatePayload {
  display_name?: string;
  login_id?: string;
  /** Needed only when the login ID changes. */
  current_password?: string;
}

export interface PasswordChangePayload {
  current_password: string;
  new_password: string;
}

export interface LoginPayload {
  login_id: string;
  password: string;
}
