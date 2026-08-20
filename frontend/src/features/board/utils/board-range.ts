export type DateRangeValue = [string | null, string | null];

export function applyRangeChange(
  next: DateRangeValue,
  currentApplied: DateRangeValue,
): { pickerRange: DateRangeValue; appliedRange: DateRangeValue } {
  const pickerRange: DateRangeValue = [next[0] ?? null, next[1] ?? null];
  return { pickerRange, appliedRange: currentApplied };
}

export function normalizeCustomDraft(
  next: DateRangeValue,
  previous: DateRangeValue,
): DateRangeValue {
  const start = next[0] ?? null;
  const end = next[1] ?? null;
  if (start && end && start === end) {
    const hadCompleteRange = Boolean(previous[0] && previous[1]);
    const wasEmpty = !previous[0] && !previous[1];
    const continuingSameStart = previous[0] === start && previous[1] === null;
    if ((hadCompleteRange || wasEmpty) && !continuingSameStart) {
      return [start, null];
    }
  }
  return [start, end];
}

export function commitCustomRange(
  pickerRange: DateRangeValue,
): { ok: true; range: [string, string] } | { ok: false; error: string } {
  const start = pickerRange[0];
  const end = pickerRange[1];
  if (!start || !end) {
    return { ok: false, error: "Choose a start date and an end date" };
  }
  if (start > end) {
    return { ok: false, error: "Start date must be on or before the end date" };
  }
  return { ok: true, range: [start, end] };
}

export function resolvedAppliedRange(
  applied: DateRangeValue,
  fallback: string,
): { startDate: string; endDate: string } {
  const startDate = applied[0] || fallback;
  const endDate = applied[1] || applied[0] || fallback;
  return { startDate, endDate };
}
