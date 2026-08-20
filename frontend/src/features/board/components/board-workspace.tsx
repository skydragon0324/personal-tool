"use client";

export {
  MobileSidebarButton,
  useWorkspaceChrome,
} from "@/features/shell/components/workspace-chrome";

export function BoardsWorkspace({ children }: { children: React.ReactNode }) {
  return children;
}

export const BoardWorkspace = BoardsWorkspace;
