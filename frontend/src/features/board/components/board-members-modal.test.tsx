import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoardMembers } from "../types";
import { BoardMembersModal } from "./board-members-modal";

const getBoardMembers = vi.fn();
const inviteBoardMember = vi.fn();
const removeBoardMember = vi.fn();
const push = vi.fn();
let currentUserId = "owner-1";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getBoardMembers: (id: string) => getBoardMembers(id),
      inviteBoardMember: (id: string, email: string) => inviteBoardMember(id, email),
      removeBoardMember: (id: string, userId: string) => removeBoardMember(id, userId),
    },
  };
});

vi.mock("@/features/auth/components/auth-provider", () => ({
  useAuth: () => ({ user: { id: currentUserId, display_name: "Me", email: "me@example.com" } }),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function members(canManage: boolean): BoardMembers {
  return {
    can_manage: canManage,
    people: [
      { user_id: "owner-1", display_name: "Olivia Owner", email: "olivia@example.com", role: "owner" },
      { user_id: "mate-1", display_name: "Max Mate", email: "max@example.com", role: "member" },
    ],
    invitations: canManage
      ? [{ id: "inv-1", email: "later@example.com", created_at: "2026-09-23T09:00:00Z" }]
      : [],
  };
}

function renderModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MantineProvider,
        { env: "test" },
        createElement(BoardMembersModal, { boardId: "board-1", boardName: "Work", opened: true, onClose: vi.fn() }),
      ),
    ),
  );
}

describe("BoardMembersModal", () => {
  beforeEach(() => {
    getBoardMembers.mockReset();
    inviteBoardMember.mockReset();
    removeBoardMember.mockReset().mockResolvedValue(undefined);
    push.mockReset();
  });

  it("lets the owner invite by email, remove members and see pending invitations", async () => {
    currentUserId = "owner-1";
    getBoardMembers.mockResolvedValue(members(true));
    inviteBoardMember.mockResolvedValue({ status: "added", members: members(true) });
    renderModal();

    expect(await screen.findByText("Max Mate")).toBeInTheDocument();
    expect(screen.getByText("later@example.com")).toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: /Invite by email/ });
    await userEvent.type(input, "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(inviteBoardMember).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    await waitFor(() => expect(inviteBoardMember).toHaveBeenCalledWith("board-1", "new@example.com"));

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removeBoardMember).toHaveBeenCalledWith("board-1", "mate-1"));
  });

  it("shows members a read-only list with a leave option", async () => {
    currentUserId = "mate-1";
    getBoardMembers.mockResolvedValue(members(false));
    renderModal();

    expect(await screen.findByText("Max Mate (you)")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Invite by email/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(removeBoardMember).toHaveBeenCalledWith("board-1", "mate-1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/boards"));
  });
});
