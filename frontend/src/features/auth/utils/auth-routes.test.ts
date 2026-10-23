import { readFileSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "../../..");

describe("auth routes", () => {
  it("does not render the workspace sidebar on login or register", () => {
    const login = readFileSync(join(SRC, "pages/login.tsx"), "utf8");
    const register = readFileSync(join(SRC, "pages/register.tsx"), "utf8");
    const rootLayout = readFileSync(join(SRC, "pages/_app.tsx"), "utf8");
    expect(login).toContain("LoginForm");
    expect(login).toContain("GuestOnly");
    expect(login).not.toContain("LifeManagementShell");
    expect(login).not.toContain("AppSidebar");
    expect(register).toContain("RegisterForm");
    expect(register).not.toContain("LifeManagementShell");
    expect(rootLayout).not.toContain("LifeManagementShell");
  });

  it("protects workspace routes with the authenticated shell", () => {
    const workspace = readFileSync(join(SRC, "features/shell/components/workspace-layout.tsx"), "utf8");
    expect(workspace).toContain("LifeManagementShell");
    expect(workspace).toContain("WorkspaceLoadingScreen");
    expect(workspace).toContain('router.replace("/login")');
    const provider = readFileSync(join(SRC, "features/auth/components/auth-provider.tsx"), "utf8");
    const guestOnly = readFileSync(join(SRC, "features/auth/components/guest-only.tsx"), "utf8");
    expect(provider).toContain('window.location.assign("/today")');
    expect(provider).toContain("queryClient.clear()");
    expect(provider).toContain("clearUserLocalState");
    expect(provider).toContain("cancelQueries");
    expect(guestOnly).toContain('window.location.replace("/today")');
  });
});
