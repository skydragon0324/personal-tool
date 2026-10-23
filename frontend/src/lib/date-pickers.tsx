/**
 * Mantine 7 date pickers with string values.
 *
 * Mantine 7 (the newest that supports React 18) works with `Date` objects, while the app keeps
 * calendar days as "YYYY-MM-DD" strings everywhere. These wrappers convert at the edge so callers
 * pass and receive strings, the same as Mantine 8's pickers.
 */
import {
  DatePicker as MantineDatePicker,
  DatePickerInput as MantineDatePickerInput,
  MonthPickerInput as MantineMonthPickerInput,
  YearPickerInput as MantineYearPickerInput,
  type DatePickerInputProps,
  type DatePickerProps,
  type MonthPickerInputProps,
  type YearPickerInputProps,
} from "@mantine/dates";
import dayjs from "dayjs";

import { getLanguage } from "@/i18n";

type DayPropsResult = ReturnType<NonNullable<DatePickerProps["getDayProps"]>>;

type StringDateKeys = "type" | "value" | "defaultValue" | "onChange" | "minDate" | "maxDate" | "excludeDate" | "getDayProps";

interface StringDateOptions {
  minDate?: string;
  maxDate?: string;
  excludeDate?: (date: string) => boolean;
  getDayProps?: (date: string) => DayPropsResult;
}

interface SingleStringDate extends StringDateOptions {
  value?: string | null;
  onChange?: (value: string | null) => void;
}

export type DateRangeStrings = [string | null, string | null];

// Chinese readers expect year-first dates ("2026年10月22日"), not a translated "Oct 22, 2026".
const CHINESE_FORMATS: Record<string, string> = {
  "MMM D, YYYY": "YYYY年M月D日",
  "MMMM YYYY": "YYYY年M月",
  "YYYY": "YYYY年",
  "dddd, MMMM D, YYYY": "YYYY年M月D日 dddd",
};

/** The display format for the current language. */
function localFormat(format: string | undefined): string | undefined {
  if (!format || getLanguage() !== "zh") return format;
  return CHINESE_FORMATS[format] ?? format;
}

function toDate(value: string | null | undefined): Date | null {
  return value ? dayjs(value).toDate() : null;
}

function toISO(value: Date | null | undefined): string | null {
  return value ? dayjs(value).format("YYYY-MM-DD") : null;
}

function dateOptions({ minDate, maxDate, excludeDate, getDayProps }: StringDateOptions) {
  return {
    minDate: toDate(minDate) ?? undefined,
    maxDate: toDate(maxDate) ?? undefined,
    excludeDate: excludeDate ? (date: Date) => excludeDate(toISO(date) as string) : undefined,
    getDayProps: getDayProps ? (date: Date) => getDayProps(toISO(date) as string) : undefined,
  };
}

export function DatePickerInput({
  value,
  onChange,
  minDate,
  maxDate,
  excludeDate,
  getDayProps,
  ...props
}: Omit<DatePickerInputProps<"default">, StringDateKeys> & SingleStringDate & { type?: "default" }) {
  return (
    <MantineDatePickerInput
      {...props}
      valueFormat={localFormat(props.valueFormat)}
      {...dateOptions({ minDate, maxDate, excludeDate, getDayProps })}
      type="default"
      value={value === undefined ? undefined : toDate(value)}
      onChange={(next) => onChange?.(toISO(next))}
    />
  );
}

export function DateRangePickerInput({
  value,
  onChange,
  minDate,
  maxDate,
  excludeDate,
  getDayProps,
  ...props
}: Omit<DatePickerInputProps<"range">, StringDateKeys> &
  StringDateOptions & {
    value?: DateRangeStrings;
    onChange?: (value: DateRangeStrings) => void;
  }) {
  return (
    <MantineDatePickerInput
      {...props}
      valueFormat={localFormat(props.valueFormat)}
      {...dateOptions({ minDate, maxDate, excludeDate, getDayProps })}
      type="range"
      value={value === undefined ? undefined : [toDate(value[0]), toDate(value[1])]}
      onChange={(next) => onChange?.([toISO(next[0]), toISO(next[1])])}
    />
  );
}

export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  excludeDate,
  getDayProps,
  ...props
}: Omit<DatePickerProps<"default">, StringDateKeys> & SingleStringDate) {
  return (
    <MantineDatePicker
      {...props}
      {...dateOptions({ minDate, maxDate, excludeDate, getDayProps })}
      type="default"
      value={value === undefined ? undefined : toDate(value)}
      onChange={(next) => onChange?.(toISO(next))}
    />
  );
}

export function MonthPickerInput({
  value,
  onChange,
  minDate,
  maxDate,
  ...props
}: Omit<MonthPickerInputProps<"default">, StringDateKeys> & Omit<SingleStringDate, "excludeDate" | "getDayProps">) {
  return (
    <MantineMonthPickerInput
      {...props}
      valueFormat={localFormat(props.valueFormat)}
      type="default"
      minDate={toDate(minDate) ?? undefined}
      maxDate={toDate(maxDate) ?? undefined}
      value={value === undefined ? undefined : toDate(value)}
      onChange={(next) => onChange?.(toISO(next))}
    />
  );
}

export function YearPickerInput({
  value,
  onChange,
  minDate,
  maxDate,
  ...props
}: Omit<YearPickerInputProps<"default">, StringDateKeys> & Omit<SingleStringDate, "excludeDate" | "getDayProps">) {
  return (
    <MantineYearPickerInput
      {...props}
      valueFormat={localFormat(props.valueFormat)}
      type="default"
      minDate={toDate(minDate) ?? undefined}
      maxDate={toDate(maxDate) ?? undefined}
      value={value === undefined ? undefined : toDate(value)}
      onChange={(next) => onChange?.(toISO(next))}
    />
  );
}
