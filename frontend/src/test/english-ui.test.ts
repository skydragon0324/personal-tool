import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const HANGUL = /[가-힣]/;
const SRC_ROOT = join(__dirname, "..");

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx|css)$/.test(name) && !name.endsWith("english-ui.test.ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("English UI copy", () => {
  it("does not contain Korean user-facing strings", () => {
    const hits = walk(SRC_ROOT).flatMap((file) => {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      return lines
        .map((line, index) => (HANGUL.test(line) ? `${file}:${index + 1}:${line.trim()}` : null))
        .filter((item): item is string => Boolean(item));
    });
    expect(hits).toEqual([]);
  });

  it("keeps primary board actions in English", () => {
    const header = readFileSync(
      join(SRC_ROOT, "features/board/components/board-header.tsx"),
      "utf8",
    );
    expect(header).toContain("Quick add");
    expect(header).toContain("Manage statuses");
    expect(header).toContain("View mode");
    expect(header).not.toContain("Daily Board");
    expect(header).not.toContain("Personal workspace");
    expect(header).not.toContain("System");
    const sidebar = readFileSync(
      join(SRC_ROOT, "features/shell/components/app-sidebar.tsx"),
      "utf8",
    );
    expect(sidebar).toContain("Life Management");
    expect(sidebar).toContain("New board");
    expect(sidebar).toContain("Manage boards");
    expect(sidebar).toContain("Boards");
    expect(sidebar).toContain("Notepad");
    expect(sidebar).toContain("Schedule");
    expect(sidebar).toContain("ThemeToggle");
    expect(sidebar).toContain('aria-current={current ? "page" : undefined}');
    const shell = readFileSync(
      join(SRC_ROOT, "features/shell/components/life-management-shell.tsx"),
      "utf8",
    );
    expect(shell).toContain("AppSidebar");
    expect(shell).not.toContain("GlobalNav");
    const notepad = readFileSync(
      join(SRC_ROOT, "features/notepad/components/notepad-page.tsx"),
      "utf8",
    );
    expect(notepad).toContain("Notepad");
    expect(notepad).toContain("New note");
    expect(notepad).toContain("No notes yet");
    expect(notepad).toContain("Capture ideas, information, and anything you want to remember.");
    expect(notepad).toContain("Create note");
    expect(notepad).toContain("Cards");
    expect(notepad).toContain("Table");
    const notepadView = readFileSync(
      join(SRC_ROOT, "features/notepad/utils/notepad-view.ts"),
      "utf8",
    );
    expect(notepadView).toContain("life-management:notepad-view");
    const schedule = readFileSync(
      join(SRC_ROOT, "features/schedule/components/schedule-page.tsx"),
      "utf8",
    );
    expect(schedule).toContain("Schedule");
    expect(schedule).toContain("Day");
    expect(schedule).toContain("Week");
    expect(schedule).toContain("Today");
    expect(schedule).toContain("New schedule");
    expect(schedule).toContain("Add your first schedule");
    expect(schedule).not.toContain("Schedule setup will be added next.");
    const dashboard = readFileSync(
      join(SRC_ROOT, "features/dashboard/components/boards-dashboard-page.tsx"),
      "utf8",
    );
    expect(dashboard).toContain("Progress by board");
    expect(dashboard).toContain("Priority distribution");
    expect(dashboard).toContain("Needs attention");
    expect(dashboard).toContain("Active boards");
    expect(header).toContain("Create a status first");
    const newBoard = readFileSync(
      join(SRC_ROOT, "features/board/components/new-board-modal.tsx"),
      "utf8",
    );
    expect(newBoard).toContain("Initial statuses");
    expect(newBoard).toContain("Counts as completed");
    const manageBoards = readFileSync(
      join(SRC_ROOT, "features/board/components/manage-boards-modal.tsx"),
      "utf8",
    );
    expect(manageBoards).toContain("Delete permanently");
    expect(manageBoards).toContain("This action cannot be undone.");
    const emptyStatuses = readFileSync(
      join(SRC_ROOT, "features/board/components/no-statuses-state.tsx"),
      "utf8",
    );
    expect(emptyStatuses).toContain("No statuses yet");
    expect(emptyStatuses).toContain("Create a status to start adding tasks.");
    const theme = readFileSync(
      join(SRC_ROOT, "features/board/components/theme-toggle.tsx"),
      "utf8",
    );
    expect(theme).toContain("Switch to dark mode");
    expect(theme).toContain("Switch to light mode");
    expect(theme).toContain("ThemeToggle");
    expect(theme).not.toContain("System");
    expect(theme).not.toContain('setColorScheme("auto")');
    const toolbar = readFileSync(
      join(SRC_ROOT, "features/board/components/board-toolbar.tsx"),
      "utf8",
    );
    expect(toolbar).toContain("Due date");
    expect(toolbar).toContain("Year");
    expect(toolbar).toContain("Month");
    expect(toolbar).toContain("Week");
    expect(toolbar).toContain("Day");
    expect(toolbar).toContain("Custom");
    expect(toolbar).toContain("No date filter");
    expect(toolbar).toContain("Reset");
    expect(toolbar).toContain("Created date range");
    expect(toolbar).not.toContain("description=");
    const statuses = readFileSync(
      join(SRC_ROOT, "features/board/components/status-manager-modal.tsx"),
      "utf8",
    );
    expect(statuses).toContain("Counts as completed");
    expect(statuses).toContain("Tasks in this status are counted as completed.");
    expect(statuses).toContain("Archive status");
    expect(statuses).toContain("Restore");
    expect(statuses).toContain("Active (");
    expect(statuses).toContain("Archived (");
    expect(statuses).toContain(
      "Archiving hides this status from the board. Existing tasks must be moved to another",
    );
    expect(statuses).toContain("Delete permanently");
    expect(statuses).toContain("Archive is reversible. Delete permanently cannot be undone.");
    const boardPage = readFileSync(
      join(SRC_ROOT, "features/board/components/board-page.tsx"),
      "utf8",
    );
    expect(boardPage).toContain('boardName={data?.name ?? "Board"}');
    expect(boardPage).not.toContain("Daily Board");
    expect(boardPage).not.toContain('boardName={data?.name ?? "Life Management"}');
    expect(boardPage).toContain("dueDate={todayISO()}");
    expect(boardPage).not.toContain("dueDate={unbounded");
    expect(boardPage).not.toContain("dueDate={startDate}");
    const subtasks = readFileSync(
      join(SRC_ROOT, "features/tasks/components/subtask-list.tsx"),
      "utf8",
    );
    expect(subtasks).toContain("Add a subtask");
    expect(subtasks).toContain("void handleCreate()");
  });
});
