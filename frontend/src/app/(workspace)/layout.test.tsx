import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceLayout from "./layout";

const replace = vi.fn();
const retrySessionCheck = vi.fn();
let authState: Record<string, unknown> = {};

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/features/auth/components/auth-provider", () => ({ useAuth: () => authState }));
vi.mock("@/features/shell/components/life-management-shell", () => ({
  LifeManagementShell: ({ children }: { children: React.ReactNode }) => createElement("main", null, children),
}));

function renderLayout() {
  return render(createElement(MantineProvider, null, createElement(WorkspaceLayout, null, "workspace")));
}

describe("WorkspaceLayout", () => {
  beforeEach(() => {
    replace.mockReset();
    retrySessionCheck.mockReset();
  });

  it("redirects to login when the session check returns 401", () => {
    authState = { user: null, isLoading: false, sessionCheckFailed: false, retrySessionCheck };
    renderLayout();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("offers a retry instead of redirecting when the session check fails transiently", async () => {
    authState = { user: null, isLoading: false, sessionCheckFailed: true, retrySessionCheck };
    renderLayout();
    expect(replace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retrySessionCheck).toHaveBeenCalled();
  });

  it("renders the workspace for a signed-in user", () => {
    authState = { user: { id: "u1" }, isLoading: false, sessionCheckFailed: false, retrySessionCheck };
    renderLayout();
    expect(screen.getByText("workspace")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
