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
    expect(sidebar).toContain("Today");
    expect(sidebar).not.toContain("Inbox");
    expect(sidebar).not.toContain("New board");
    expect(sidebar).not.toContain("Manage boards");
    expect(sidebar).not.toContain("Recurring tasks");
    expect(sidebar).toContain("Boards");
    expect(sidebar).toContain("Notepad");
    expect(sidebar).toContain("Schedule");
    expect(sidebar).toContain("Logout");
    expect(sidebar).toContain("ThemeToggle");
    expect(sidebar).toContain("Your boards");
    expect(sidebar).toContain("No boards yet");
    expect(sidebar).toContain('aria-current={current ? "page" : undefined}');
    expect(sidebar).toContain("ml-3");
    expect(sidebar).toContain("max-h-[min(40vh,320px)]");
    expect(sidebar.indexOf('href="/today"')).toBeLessThan(sidebar.indexOf('href="/boards"'));
    expect(sidebar.indexOf('href="/boards"')).toBeLessThan(sidebar.indexOf('href="/notepad"'));
    expect(sidebar.indexOf('href="/notepad"')).toBeLessThan(sidebar.indexOf('href="/schedule"'));
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
    const today = readFileSync(join(SRC_ROOT, "features/today/components/today-page.tsx"), "utf8");
    expect(today).toContain("Today");
    expect(today).toContain("Your tasks, schedule, and pinned notes for today.");
    expect(today).toContain("Could not load today.");
    expect(today).toContain("Retry");
    expect(today).not.toContain("later step");
    const todaySchedule = readFileSync(
      join(SRC_ROOT, "features/today/components/today-schedule-section.tsx"),
      "utf8",
    );
    expect(todaySchedule).toContain("Today's schedule");
    expect(todaySchedule).toContain("Time blocks planned for today");
    expect(todaySchedule).toContain("Open schedule");
    const todayLabels = readFileSync(join(SRC_ROOT, "features/today/utils/labels.ts"), "utf8");
    expect(todayLabels).toContain("Routine");
    expect(todayLabels).toContain("This week only");
    expect(todayLabels).toContain("Due today");
    expect(todayLabels).toContain("Overdue");
    expect(today).toContain("Active tasks");
    expect(today).toContain("Open boards");
    expect(today).toContain("Needs attention");
    expect(today).toContain("Unfinished tasks past their due date");
    expect(today).toContain("Tasks whose active period includes today");
    expect(today).toContain("You're all caught up.");
    const todayProgress = readFileSync(
      join(SRC_ROOT, "features/today/components/today-progress.tsx"),
      "utf8",
    );
    expect(todayProgress).toContain("Today summary");
    expect(todayProgress).toContain('label="Tasks"');
    expect(todayProgress).toContain('label="Schedule"');
    expect(today).toContain("DashboardGrid");
    expect(today).toContain("max-w-[1400px]");
    const todayNotes = readFileSync(
      join(SRC_ROOT, "features/today/components/today-notes-section.tsx"),
      "utf8",
    );
    expect(todayNotes).toContain("Pinned notes");
    expect(todayNotes).toContain("View all notes");
    expect(todayNotes).toContain("Open notepad");
    expect(todayNotes).toContain("line-clamp-2");
    const todayRoute = readFileSync(join(SRC_ROOT, "app/(workspace)/today/page.tsx"), "utf8");
    expect(todayRoute).toContain("TodayPage");
    const inboxRoute = readFileSync(join(SRC_ROOT, "app/(workspace)/inbox/page.tsx"), "utf8");
    expect(inboxRoute).toContain('redirect("/today")');
    expect(inboxRoute).not.toContain("InboxPage");
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
    expect(dashboard).toContain("Overview");
    expect(dashboard).toContain("Board progress");
    expect(dashboard).toContain("Workload");
    expect(dashboard).toContain("Needs attention");
    expect(dashboard).toContain("Active boards");
    expect(dashboard).toContain("New board");
    expect(dashboard).toContain("Manage boards");
    expect(dashboard).toContain("Recurring tasks");
    expect(dashboard).toContain("DashboardGrid");
    expect(dashboard).toContain("Due today");
    expect(dashboard).toContain("Overdue");
    const recurring = readFileSync(
      join(SRC_ROOT, "features/recurrence/components/recurring-tasks-page.tsx"),
      "utf8",
    );
    expect(recurring).toContain("Recurring tasks");
    expect(recurring).toContain("Manage repeating work across your boards.");
    expect(recurring).toContain("Back to boards");
    expect(recurring).toContain("No future occurrence");
    expect(recurring).toContain("Customized");
    expect(recurring).toContain("Reset filters");
    expect(recurring).toContain("No recurring tasks yet");
    expect(recurring).toContain("Actions");
    expect(recurring).toContain("Pause");
    expect(recurring).toContain("Resume");
    expect(recurring).toContain("Pausing...");
    expect(recurring).toContain("Resuming...");
    expect(recurring).toContain("Restore the board before resuming this recurring task.");
    expect(recurring).not.toContain("Delete");
    expect(recurring).not.toContain(">Edit<");
    const pauseDialog = readFileSync(
      join(SRC_ROOT, "features/recurrence/components/pause-recurrence-dialog.tsx"),
      "utf8",
    );
    expect(pauseDialog).toContain("Pause recurring task?");
    expect(pauseDialog).toContain(
      "Future occurrences will stop generating. Existing tasks and completed history will stay.",
    );
    const actionsHook = readFileSync(
      join(SRC_ROOT, "features/recurrence/hooks/use-recurrence-series-actions.ts"),
      "utf8",
    );
    expect(actionsHook).toContain("Recurring task paused");
    expect(actionsHook).toContain("Recurring task resumed");
    expect(actionsHook).toContain("Could not pause recurring task");
    expect(actionsHook).toContain("Could not resume recurring task");
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
    const recurrence = readFileSync(
      join(SRC_ROOT, "features/tasks/components/recurrence-fields.tsx"),
      "utf8",
    );
    expect(recurrence).toContain("Does not repeat");
    expect(recurrence).toContain("Weekdays");
    expect(recurrence).toContain("If a month has fewer days, that month is skipped.");
    expect(recurrence).toContain("February 29 is skipped in non-leap years.");
    const scope = readFileSync(
      join(SRC_ROOT, "features/tasks/components/recurrence-scope-dialog.tsx"),
      "utf8",
    );
    expect(scope).toContain("This is a repeating task.");
    expect(scope).toContain("This task only");
    expect(scope).toContain("This and following tasks");
    expect(scope).toContain("All unfinished tasks in the series");
    expect(scope).toContain("All tasks in the series");
    expect(scope).toContain("Completed and individually customized tasks are kept.");
    expect(scope).toContain("This completed task will be permanently removed. Other repeats are kept.");
    const drawer = readFileSync(
      join(SRC_ROOT, "features/tasks/components/task-detail-drawer.tsx"),
      "utf8",
    );
    expect(drawer).toContain("Stop repeating");
    const taskForm = readFileSync(
      join(SRC_ROOT, "features/tasks/components/task-form.tsx"),
      "utf8",
    );
    expect(taskForm).toContain("Stop repeating?");
    expect(taskForm).toContain("This series will stop repeating. Existing tasks are kept.");
    expect(taskForm).toContain("if (recurrence === null)");
  });
});
