import { describe, expect, it } from "vitest";

import {
  buildCategoryComboboxOptions,
  matchingCategory,
} from "./category-options";

const categories = [
  { id: "1", name: "Personal", color: "teal" },
  { id: "2", name: "Work", color: "blue" },
];

describe("category combobox options", () => {
  it("lists matching categories", () => {
    const result = buildCategoryComboboxOptions(categories, "per");
    expect(result.items.map((item) => item.name)).toEqual(["Personal"]);
    expect(result.showCreate).toBe(true);
    expect(result.createLabel).toBe("Create “per”");
  });

  it("hides create when the name already exists, ignoring case", () => {
    const result = buildCategoryComboboxOptions(categories, "personal");
    expect(result.showCreate).toBe(false);
    expect(matchingCategory(categories, "PERSONAL")?.id).toBe("1");
  });

  it("treats an exact name as a selection, not a create", () => {
    const result = buildCategoryComboboxOptions(categories, "Work");
    expect(result.items.map((item) => item.name)).toEqual(["Work"]);
    expect(result.showCreate).toBe(false);
    expect(matchingCategory(categories, "Work")?.id).toBe("2");
  });

  it("shows create for a new name", () => {
    const result = buildCategoryComboboxOptions(categories, "Health");
    expect(result.showCreate).toBe(true);
    expect(result.createLabel).toBe("Create “Health”");
  });
});
