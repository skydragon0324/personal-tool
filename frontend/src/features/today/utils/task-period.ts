/** Inclusive period used by Today: start_date <= selected_date <= due_date. */
export function isDateInTaskPeriod(selectedDate: string, startDate: string, dueDate: string): boolean {
  return startDate <= selectedDate && selectedDate <= dueDate;
}
