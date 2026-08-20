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

export interface LoginPayload {
  email: string;
  password: string;
}
