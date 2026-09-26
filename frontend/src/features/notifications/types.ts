export type NotificationKind =
  | "daily_digest"
  | "schedule_start"
  | "task_reminder"
  | "board_shared"
  | "task_assigned"
  | "task_overdue";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  board_id: string | null;
  task_id: string | null;
  schedule_entry_id: string | null;
  fire_at: string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationFeed {
  items: AppNotification[];
  unread_count: number;
  server_time: string;
}

export interface NotificationPreferences {
  digest_enabled: boolean;
  /** HH:MM:SS in the user's timezone. */
  digest_time: string;
  schedule_enabled: boolean;
  schedule_lead_minutes: number;
  task_reminders_enabled: boolean;
  overdue_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
}

export type NotificationPreferencesUpdate = Partial<NotificationPreferences>;
