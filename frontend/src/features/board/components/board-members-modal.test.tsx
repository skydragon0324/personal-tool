import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import type { BoardMembers } from "../types";
import { BoardMembersModal } from "./board-members-modal";

const getBoardMembers = jest.fn();
const inviteBoardMember = jest.fn();
const removeBoardMember = jest.fn();
const push = jest.fn();
let currentUserId = "owner-1";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getBoardMembers: (id: string) => getBoardMembers(id),
      inviteBoardMember: (id: string, loginId: string) => inviteBoardMember(id, loginId),
      removeBoardMember: (id: string, userId: string) => removeBoardMember(id, userId),
    },
  };
});

jest.mock("@/features/auth/components/auth-provider", () => ({
  useAuth: () => ({ user: { id: currentUserId, display_name: "Me", login_id: "me" } }),
}));

jest.mock("@/lib/navigation", () => ({ useRouter: () => ({ push }) }));

function members(canManage: boolean): BoardMembers {
  return {
    can_manage: canManage,
    people: [
      { user_id: "owner-1", display_name: "Olivia Owner", login_id: "olivia", role: "owner" },
      { user_id: "mate-1", display_name: "Max Mate", login_id: "max", role: "member" },
    ],
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
        createElement(BoardMembersModal, { boardId: "board-1", boardName: "Work", opened: true, onClose: jest.fn() }),
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

  it("lets the owner invite by login ID and remove members", async () => {
    currentUserId = "owner-1";
    getBoardMembers.mockResolvedValue(members(true));
    inviteBoardMember.mockResolvedValue({ status: "added", members: members(true) });
    renderModal();

    expect(await screen.findByText("Max Mate")).toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: /Invite by login ID/ });
    await userEvent.type(input, "not an id");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(await screen.findByText(/Use 3-32 letters/)).toBeInTheDocument();
    expect(inviteBoardMember).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, "new-mate");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    await waitFor(() => expect(inviteBoardMember).toHaveBeenCalledWith("board-1", "new-mate"));

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removeBoardMember).toHaveBeenCalledWith("board-1", "mate-1"));
  });

  it("shows members a read-only list with a leave option", async () => {
    currentUserId = "mate-1";
    getBoardMembers.mockResolvedValue(members(false));
    renderModal();

    expect(await screen.findByText("Max Mate (you)")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Invite by login ID/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(removeBoardMember).toHaveBeenCalledWith("board-1", "mate-1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/boards"));
  });
});
