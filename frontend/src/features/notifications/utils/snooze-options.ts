import { t } from "@/i18n";

export interface SnoozeOption {
  label: string;
  at: Date;
}

/** Quick "remind me" choices relative to `now`. */
export function snoozeOptions(now: Date = new Date()): SnoozeOption[] {
  const inHours = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000);
  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(now.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + (((8 - now.getDay()) % 7) || 7));
  nextMonday.setHours(9, 0, 0, 0);
  return [
    { label: t("notifications.inOneHour"), at: inHours(1) },
    { label: t("notifications.inThreeHours"), at: inHours(3) },
    { label: t("notifications.tomorrowAtNine"), at: tomorrowMorning },
    { label: t("notifications.nextMondayAtNine"), at: nextMonday },
  ];
}
