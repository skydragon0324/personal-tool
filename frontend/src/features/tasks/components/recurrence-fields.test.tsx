import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  RecurrenceFields,
  buildRecurrenceInput,
  presetFromRecurrence,
  repeatUnitFromRecurrence,
} from "./recurrence-fields";

function wrap(allowNone = true) {
  return render(
    createElement(
      MantineProvider,
      { env: "test" },
      createElement(RecurrenceFields, {
        allowNone,
        preset: "weekly",
        onPresetChange: () => undefined,
        customInterval: 2,
        onCustomIntervalChange: () => undefined,
        customUnit: "years",
        onCustomUnitChange: () => undefined,
        customWeekdays: [4],
        onCustomWeekdaysChange: () => undefined,
        end: "never",
        onEndChange: () => undefined,
        untilDate: null,
        onUntilDateChange: () => undefined,
        occurrenceCount: 10,
        onOccurrenceCountChange: () => undefined,
      }),
    ),
  );
}

describe("RecurrenceFields", () => {
  it("includes Does not repeat by default", async () => {
    const user = userEvent.setup();
    wrap(true);
    await user.click(screen.getByRole("textbox", { name: "Repeat" }));
    expect(screen.getByRole("option", { name: "Does not repeat" })).toBeInTheDocument();
  });

  it("hides Does not repeat when allowNone is false", async () => {
    const user = userEvent.setup();
    wrap(false);
    await user.click(screen.getByRole("textbox", { name: "Repeat" }));
    expect(screen.queryByRole("option", { name: "Does not repeat" })).not.toBeInTheDocument();
  });

  it("maps yearly custom interval back to yearly frequency", () => {
    const recurrence = { freq: "yearly" as const, interval: 2, weekdays: [] as number[], month_day: 21 };
    expect(presetFromRecurrence(recurrence)).toBe("custom");
    expect(repeatUnitFromRecurrence(recurrence)).toBe("years");
    const built = buildRecurrenceInput({
      preset: "custom",
      startDate: "2026-08-21",
      customInterval: 2,
      customUnit: "years",
      customWeekdays: [],
      end: "never",
      untilDate: null,
      occurrenceCount: 10,
    });
    expect(built).toMatchObject({ freq: "yearly", interval: 2 });
  });
});
