import { QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/features/auth/components/login-form";
import { RegisterForm } from "@/features/auth/components/register-form";
import { MantineProvider } from "@mantine/core";

const login = vi.fn();
const register = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/features/auth/components/auth-provider", () => ({
  useAuth: () => ({ login, register, logout: vi.fn(), user: null, isLoading: false }),
}));

function wrap(ui: ReactNode) {
  return render(createElement(MantineProvider, null, ui));
}

describe("auth forms", () => {
  beforeEach(() => {
    login.mockReset();
    register.mockReset();
  });

  it("shows login validation errors and submits a valid form", async () => {
    const user = userEvent.setup();
    wrap(createElement(LoginForm));
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "long-enough");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(login).toHaveBeenCalledWith({ email: "ada@example.com", password: "long-enough" });
  });

  it("validates register fields and includes the browser timezone", async () => {
    const user = userEvent.setup();
    wrap(createElement(RegisterForm));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "long-enough");
    await user.type(screen.getByLabelText("Confirm password"), "mismatch");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Confirm password"));
    await user.type(screen.getByLabelText("Confirm password"), "long-enough");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(register).toHaveBeenCalledWith({
      display_name: "Ada",
      email: "ada@example.com",
      password: "long-enough",
      timezone: expect.any(String),
    });
  });
});

describe("auth cache reset", () => {
  it("clears personal query data on logout-style reset", () => {
    const client = new QueryClient();
    client.setQueryData(["boards"], [{ id: "board-a", name: "A" }]);
    client.setQueryData(["notes"], [{ id: "note-a" }]);
    client.clear();
    expect(client.getQueryData(["boards"])).toBeUndefined();
    expect(client.getQueryData(["notes"])).toBeUndefined();
  });
});
