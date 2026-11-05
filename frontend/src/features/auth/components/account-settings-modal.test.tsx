import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";

import { AccountSettingsModal } from "@/features/auth/components/account-settings-modal";
import { ApiError } from "@/lib/api-client";

const updateProfile = jest.fn();
const changePassword = jest.fn();
const user = { id: "u1", email: "ada@example.com", display_name: "Ada", timezone: "UTC", created_at: "" };

jest.mock("@/features/auth/components/auth-provider", () => ({
  useAuth: () => ({ user, updateProfile, changePassword }),
}));
jest.mock("@/lib/notify", () => ({ notifySuccess: jest.fn() }));

function open(ui: ReactNode = createElement(AccountSettingsModal, { opened: true, onClose: jest.fn() })) {
  return render(createElement(MantineProvider, null, ui));
}

describe("AccountSettingsModal", () => {
  beforeEach(() => {
    updateProfile.mockReset().mockResolvedValue(user);
    changePassword.mockReset().mockResolvedValue(undefined);
  });

  it("saves a new name without asking for the password", async () => {
    const actor = userEvent.setup();
    open();
    const name = screen.getByLabelText("Name");
    await actor.clear(name);
    await actor.type(name, "Ada Lovelace");
    // Only the password section's field: the profile form adds its own only for an email change.
    expect(screen.getAllByLabelText(/Current password/)).toHaveLength(1);
    await actor.click(screen.getByRole("button", { name: "Save profile" }));
    expect(updateProfile).toHaveBeenCalledWith({ display_name: "Ada Lovelace" });
  });

  it("asks for the current password when the email changes", async () => {
    const actor = userEvent.setup();
    open();
    const email = screen.getByLabelText("Email");
    await actor.clear(email);
    await actor.type(email, "lovelace@example.com");
    await actor.click(screen.getByRole("button", { name: "Save profile" }));
    expect(updateProfile).not.toHaveBeenCalled();

    const [profilePassword] = screen.getAllByLabelText(/Current password/);
    await actor.type(profilePassword, "my-current-pass");
    await actor.click(screen.getByRole("button", { name: "Save profile" }));
    expect(updateProfile).toHaveBeenCalledWith({ email: "lovelace@example.com", current_password: "my-current-pass" });
  });

  it("validates and changes the password, showing a wrong current password on its field", async () => {
    const actor = userEvent.setup();
    open();
    await actor.click(screen.getByRole("button", { name: "Change password" }));
    expect(changePassword).not.toHaveBeenCalled();

    await actor.type(screen.getByLabelText("Current password"), "old-password-1");
    await actor.type(screen.getByLabelText("New password"), "new-password-1");
    await actor.type(screen.getByLabelText("Confirm new password"), "new-password-1");
    changePassword.mockRejectedValueOnce(
      new ApiError("Current password is incorrect", 400, "current_password_wrong"),
    );
    await actor.click(screen.getByRole("button", { name: "Change password" }));
    expect(changePassword).toHaveBeenCalledWith({ current_password: "old-password-1", new_password: "new-password-1" });
    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
  });
});
