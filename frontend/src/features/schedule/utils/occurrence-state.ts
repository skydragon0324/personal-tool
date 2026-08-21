export function occurrenceKey(entryId: string, occurrenceDate: string): string {
  return `${entryId}:${occurrenceDate}`;
}

export function isOccurrenceCompleted(
  occurrences: Array<{ schedule_entry_id: string; occurrence_date: string; is_completed: boolean }>,
  entryId: string,
  occurrenceDate: string,
): boolean {
  return occurrences.some(
    (item) =>
      item.schedule_entry_id === entryId &&
      item.occurrence_date === occurrenceDate &&
      item.is_completed,
  );
}
