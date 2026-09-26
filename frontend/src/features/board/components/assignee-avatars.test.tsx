import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { AssigneeAvatars, avatarColor } from "./assignee-avatars";

const PEOPLE = [
  { id: "u1", display_name: "Ann Lee" },
  { id: "u2", display_name: "Bo" },
  { id: "u3", display_name: "Cara Diaz" },
  { id: "u4", display_name: "Dan" },
];

function renderAvatars(props: Parameters<typeof AssigneeAvatars>[0]) {
  return render(createElement(MantineProvider, { env: "test" }, createElement(AssigneeAvatars, props)));
}

describe("AssigneeAvatars", () => {
  it("stacks initials and folds extra people into +N", () => {
    renderAvatars({ people: PEOPLE, max: 3 });
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByText("BO")).toBeInTheDocument();
    expect(screen.getByText("CD")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByLabelText("Ann Lee, Bo, Cara Diaz, Dan")).toBeInTheDocument();
  });

  it("shows only avatars, never the names as text", () => {
    renderAvatars({ people: PEOPLE.slice(0, 2) });
    expect(screen.queryByText("Ann Lee")).not.toBeInTheDocument();
    expect(screen.queryByText(/Assigned to/)).not.toBeInTheDocument();
    // Names stay available to screen readers and on hover.
    expect(screen.getByLabelText("Ann Lee, Bo")).toBeInTheDocument();
  });

  it("renders nothing without people and keeps colors stable", () => {
    const { container } = renderAvatars({ people: [] });
    expect(container.querySelector(".mantine-Avatar-root")).toBeNull();
    expect(avatarColor("u1")).toBe(avatarColor("u1"));
  });
});
