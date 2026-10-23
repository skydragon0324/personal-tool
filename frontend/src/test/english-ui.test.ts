import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

import { en } from "@/i18n/en";

const HANGUL = /[가-힣]/;
const SRC_ROOT = join(__dirname, "..");

function englishText(key: string): string {
  let node: unknown = en;
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  if (typeof node === "string") return node;
  if (node && typeof node === "object" && "other" in node) return String((node as { other: string }).other);
  return key;
}

/** A source file with every t("key") / tRich("key") replaced by its English text, so assertions
 * about the words people see still hold after the copy moved into the dictionary. */
function readUi(path: string): string {
  return readFileSync(path, "utf8").replace(/\bt(?:Rich)?\("([\w.]+)"/g, (_match, key: string) => englishText(key));
}

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
    const header = readUi(
      join(SRC_ROOT, "features/board/components/board-header.tsx"),
    );
    expect(header).toContain("Quick add");
    expect(header).toContain("Manage statuses");
    expect(header).toContain("View mode");
    expect(header).not.toContain("Daily Board");
    expect(header).not.toContain("Personal workspace");
    expect(header).not.toContain("System");
    const sidebar = readUi(
      join(SRC_ROOT, "features/shell/components/app-sidebar.tsx"),
    );
    expect(sidebar).toContain(en.common.appName);
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
    const shell = readUi(
      join(SRC_ROOT, "features/shell/components/life-management-shell.tsx"),
    );
    expect(shell).toContain("AppSidebar");
    expect(shell).not.toContain("GlobalNav");
    const notepad = readUi(
      join(SRC_ROOT, "features/notepad/components/notepad-page.tsx"),
    );
    expect(notepad).toContain("Notepad");
    expect(notepad).toContain("New note");
    expect(notepad).toContain("No notes yet");
    expect(notepad).toContain("Capture ideas, information, and anything you want to remember.");
    expect(notepad).toContain("Create note");
    expect(notepad).toContain("Cards");
    expect(notepad).toContain("Table");
    const notepadView = readUi(
      join(SRC_ROOT, "features/notepad/utils/notepad-view.ts"),
    );
    expect(notepadView).toContain("life-management:notepad-view");
    const today = readUi(join(SRC_ROOT, "features/today/components/today-page.tsx"));
    expect(today).toContain("Today");
    expect(today).toContain("Your tasks, schedule, and pinned notes for today.");
    expect(today).toContain("Could not load today.");
    expect(today).toContain("Retry");
    expect(today).not.toContain("later step");
    const todaySchedule = readUi(
      join(SRC_ROOT, "features/today/components/today-schedule-section.tsx"),
    );
    expect(todaySchedule).toContain("Today's schedule");
    expect(todaySchedule).toContain("Time blocks planned for today");
    expect(todaySchedule).toContain("Open schedule");
    const todayLabels = readUi(join(SRC_ROOT, "features/today/utils/labels.ts"));
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
    const todayProgress = readUi(
      join(SRC_ROOT, "features/today/components/today-progress.tsx"),
    );
    expect(todayProgress).toContain("Today summary");
    expect(todayProgress).toContain('label={Tasks)}');
    expect(todayProgress).toContain('label={Schedule)}');
    expect(today).toContain("DashboardGrid");
    expect(today).toContain("max-w-[1400px]");
    const todayNotes = readUi(
      join(SRC_ROOT, "features/today/components/today-notes-section.tsx"),
    );
    expect(todayNotes).toContain("Pinned notes");
    expect(todayNotes).toContain("View all notes");
    expect(todayNotes).toContain("Open notepad");
    expect(todayNotes).toContain("line-clamp-2");
    const todayRoute = readUi(join(SRC_ROOT, "pages/today.tsx"));
    expect(todayRoute).toContain("TodayPage");
    const nextConfig = readUi(join(SRC_ROOT, "../next.config.js"));
    expect(nextConfig).toContain('{ source: "/inbox", destination: "/today", permanent: false }');
    expect(nextConfig).not.toContain("InboxPage");
    const schedule = readUi(
      join(SRC_ROOT, "features/schedule/components/schedule-page.tsx"),
    );
    expect(schedule).toContain("Schedule");
    expect(schedule).toContain("Day");
    expect(schedule).toContain("Week");
    expect(schedule).toContain("Today");
    expect(schedule).toContain("New schedule");
    expect(schedule).toContain("Add your first schedule");
    expect(schedule).not.toContain("Schedule setup will be added next.");
    const dashboard = readUi(
      join(SRC_ROOT, "features/dashboard/components/boards-dashboard-page.tsx"),
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
    const recurring = readUi(
      join(SRC_ROOT, "features/recurrence/components/recurring-tasks-page.tsx"),
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
    expect(recurring).toContain("Pausing…");
    expect(recurring).toContain("Resuming…");
    expect(recurring).toContain("Restore the board before resuming this recurring task.");
    expect(recurring).toContain("Restore the board before editing this recurring task.");
    expect(recurring).toContain("Edit");
    expect(recurring).not.toContain("Delete");
    const pauseDialog = readUi(
      join(SRC_ROOT, "features/recurrence/components/pause-recurrence-dialog.tsx"),
    );
    expect(pauseDialog).toContain("Pause recurring task?");
    expect(pauseDialog).toContain(
      "Future occurrences will stop generating. Existing tasks and completed history will stay.",
    );
    const actionsHook = readUi(
      join(SRC_ROOT, "features/recurrence/hooks/use-recurrence-series-actions.ts"),
    );
    expect(actionsHook).toContain("Recurring task paused");
    expect(actionsHook).toContain("Recurring task resumed");
    expect(actionsHook).toContain("Could not pause recurring task");
    expect(actionsHook).toContain("Could not resume recurring task");
    const updateHook = readUi(
      join(SRC_ROOT, "features/recurrence/hooks/use-update-recurrence-series.ts"),
    );
    expect(updateHook).toContain("Recurring task updated");
    expect(header).toContain("Create a status first");
    const newBoard = readUi(
      join(SRC_ROOT, "features/board/components/new-board-modal.tsx"),
    );
    expect(newBoard).toContain("Initial statuses");
    expect(newBoard).toContain("Counts as completed");
    const manageBoards = readUi(
      join(SRC_ROOT, "features/board/components/manage-boards-modal.tsx"),
    );
    expect(manageBoards).toContain("Delete permanently");
    expect(manageBoards).toContain("This action cannot be undone.");
    const emptyStatuses = readUi(
      join(SRC_ROOT, "features/board/components/no-statuses-state.tsx"),
    );
    expect(emptyStatuses).toContain("No statuses yet");
    expect(emptyStatuses).toContain("Create a status to start adding tasks.");
    const theme = readUi(
      join(SRC_ROOT, "features/board/components/theme-toggle.tsx"),
    );
    expect(theme).toContain("Switch to dark mode");
    expect(theme).toContain("Switch to light mode");
    expect(theme).toContain("ThemeToggle");
    expect(theme).not.toContain("System");
    expect(theme).not.toContain('setColorScheme("auto")');
    const toolbar = readUi(
      join(SRC_ROOT, "features/board/components/board-toolbar.tsx"),
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
    const statuses = readUi(
      join(SRC_ROOT, "features/board/components/status-manager-modal.tsx"),
    );
    expect(statuses).toContain("Counts as completed");
    expect(statuses).toContain("Tasks in this status are counted as completed.");
    expect(statuses).toContain("Archive");
    expect(statuses).toContain("Delete");
    expect(statuses).toContain("Restore");
    expect(statuses).toContain("Active (");
    expect(statuses).toContain("Archived (");
    expect(statuses).toContain("hides the status and lets you restore it later.");
    expect(statuses).toContain("Delete permanently");
    expect(statuses).toContain("Archive is reversible. Delete permanently cannot be undone.");
    const boardPage = readUi(
      join(SRC_ROOT, "features/board/components/board-page.tsx"),
    );
    expect(boardPage).toContain('boardName={data?.name ?? Board)}');
    expect(boardPage).not.toContain("Daily Board");
    expect(boardPage).not.toContain('boardName={data?.name ?? "Life Management"}');
    expect(boardPage).toContain("dueDate={todayISO()}");
    expect(boardPage).not.toContain("dueDate={unbounded");
    expect(boardPage).not.toContain("dueDate={startDate}");
    const subtasks = readUi(
      join(SRC_ROOT, "features/tasks/components/subtask-list.tsx"),
    );
    expect(subtasks).toContain("Add a subtask");
    expect(subtasks).toContain("void handleCreate()");
    const recurrence = readUi(
      join(SRC_ROOT, "features/tasks/components/recurrence-fields.tsx"),
    );
    expect(recurrence).toContain("Does not repeat");
    expect(recurrence).toContain("allowNone");
    expect(recurrence).toContain("years");
    const seriesEdit = readUi(
      join(SRC_ROOT, "features/recurrence/components/recurring-series-edit-form.tsx"),
    );
    expect(seriesEdit).toContain("Pause or resume this series from the recurring tasks list.");
    expect(seriesEdit).toContain("This status is used for newly generated tasks. Existing tasks will not move.");
    expect(seriesEdit).toContain("Each occurrence is due this many days after it starts.");
    expect(seriesEdit).toContain("Automatic — first available status");
    expect(seriesEdit).toContain("No changes to save.");
    expect(seriesEdit).toContain("This recurring task changed elsewhere.");
    expect(seriesEdit).toContain("Reload latest");
    expect(seriesEdit).not.toContain("Does not repeat");
    expect(seriesEdit).not.toContain("Delete series");
    const seriesModal = readUi(
      join(SRC_ROOT, "features/recurrence/components/recurring-series-edit-modal.tsx"),
    );
    expect(seriesModal).toContain("Edit recurring task");
    expect(seriesModal).toContain("Could not load recurring task.");
    expect(recurrence).toContain("Weekdays");
    expect(recurrence).toContain("If a month has fewer days, that month is skipped.");
    expect(recurrence).toContain("February 29 is skipped in non-leap years.");
    const scope = readUi(
      join(SRC_ROOT, "features/tasks/components/recurrence-scope-dialog.tsx"),
    );
    expect(scope).toContain("This is a repeating task.");
    expect(scope).toContain("This task only");
    expect(scope).toContain("This and following tasks");
    expect(scope).toContain("All unfinished tasks in the series");
    expect(scope).toContain("All tasks in the series");
    expect(scope).toContain("Completed and individually customized tasks are kept.");
    expect(scope).toContain("This completed task will be permanently removed. Other repeats are kept.");
    const detail = readUi(
      join(SRC_ROOT, "features/tasks/components/task-detail-modal.tsx"),
    );
    expect(detail).toContain("Stop repeating");
    const taskForm = readUi(
      join(SRC_ROOT, "features/tasks/components/task-form.tsx"),
    );
    expect(taskForm).toContain("Stop repeating?");
    expect(taskForm).toContain("This series will stop repeating. Existing tasks are kept.");
    expect(taskForm).toContain("if (recurrence === null)");
    expect(taskForm).not.toContain("allowNone={false}");
    expect(seriesEdit).toContain("allowNone={false}");
  });
});
