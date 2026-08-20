import { describe, expect, it } from "vitest";

import { itemsByColumnIds } from "./reorder-tasks";

describe("itemsByColumnIds", () => {
  it("keeps every column key, including empty lists", () => {
    const next = itemsByColumnIds(
      { a: [{ id: "t1" } as never], extra: [] },
      ["a", "b"],
    );
    expect(Object.keys(next)).toEqual(["a", "b"]);
    expect(next.a).toHaveLength(1);
    expect(next.b).toEqual([]);
  });
});
