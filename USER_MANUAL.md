# Task Management: User Manual

| | |
|---|---|
| **Application** | Task Management |
| **Document** | User Manual |
| **Manual version** | 2.2 |
| **Last updated** | 2026-11-25 |

**Who should use this manual:** anyone who uses Task Management in a web browser to organize their own work or work shared with a team. Team leaders and board owners will also find the permissions they control. Server administrators and developers should start with [Additional resources](#14-additional-resources).

---

## Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Glossary](#3-glossary)
4. [Intended users and roles](#4-intended-users-and-roles)
5. [Getting started](#5-getting-started)
6. [Understanding the interface](#6-understanding-the-interface)
7. [Feature guide](#7-feature-guide)
   - 7.1 [Account and preferences](#71-account-and-preferences)
   - 7.2 [Workspace pages](#72-workspace-pages)
   - 7.3 [Boards](#73-boards)
   - 7.4 [Board folders](#74-board-folders)
   - 7.5 [Statuses](#75-statuses)
   - 7.6 [Tasks](#76-tasks)
   - 7.7 [Board views and filters](#77-board-views-and-filters)
   - 7.8 [Calendar](#78-calendar)
   - 7.9 [Search](#79-search)
   - 7.10 [Today and My Tasks](#710-today-and-my-tasks)
   - 7.11 [Inbox and notifications](#711-inbox-and-notifications)
   - 7.12 [Reports](#712-reports)
   - 7.13 [Plans](#713-plans)
   - 7.14 [Notepad](#714-notepad)
   - 7.15 [Schedule](#715-schedule)
8. [Common workflows](#8-common-workflows)
9. [Roles and permissions reference](#9-roles-and-permissions-reference)
10. [Keyboard and interaction reference](#10-keyboard-and-interaction-reference)
11. [Data, privacy and expected behavior](#11-data-privacy-and-expected-behavior)
12. [Troubleshooting](#12-troubleshooting)
13. [Limitations and important notes](#13-limitations-and-important-notes)
14. [Additional resources](#14-additional-resources)
15. [Revision history](#15-revision-history)

---

## 1. Purpose

Task Management gives you one place to keep track of the work you need to do, whether it is personal work, team work or both.

It helps you solve these everyday problems:

- **Work is scattered.** Tasks live in emails, chats, notes and memory. Task Management keeps them together.
- **It is hard to see what matters today.** The Today page, My Tasks and the Calendar show what is due, what is overdue and what is planned.
- **Shared work is unclear.** Shared boards and assignees show who is responsible for each task.
- **Progress is invisible.** Progress views and Reports show how much is finished and what is falling behind.

How the parts fit together:

- A **board** holds the tasks for one area of work, such as *Work*, *Home* or a project. You can group boards into **folders**.
- Each **task** moves through **statuses** (for example *To Do*, *In Progress*, *Done*) until it is complete.
- **Planning** tools help you decide when work happens: the Calendar shows tasks by due date, Plans break a goal into days, and the Schedule holds your weekly routine.
- **Collaboration** happens on shared boards: the owner invites people, tasks are assigned, and notifications tell people what changed.

Expected outcome: you always know what is due, who is doing it and how far along it is.

## 2. Scope

**What the application manages**

- Tasks organized on boards, with statuses, priorities, categories, dates, assignees, details, links and files
- Multi-day plans with daily checklists
- A weekly schedule of time blocks
- Personal notes
- Notifications and reminders about your work

**Who can use it**

Anyone who has an account. Each person signs in with their own login ID and password and has a private workspace. Boards can be shared with other account holders.

**Types of work supported**

Personal to-do lists, small-team work tracking, study or project plans, and weekly routines. It is not designed for time tracking, invoicing or large-scale project portfolio management.

**How you use it**

Task Management is a **web-browser application**. You use it by opening its web address in a browser on a computer, tablet or phone. There is no separate desktop or mobile app to install.

**Included in this manual**

Everything you can do in the application's screens, the permissions that apply, common workflows and troubleshooting for everyday problems.

**Outside the scope of this manual**

- Installing or running the server
- Database administration and backups
- Changing or building the source code
- Deploying the application on a server or network

For these topics, see [Additional resources](#14-additional-resources).

## 3. Glossary

Terms are listed alphabetically. Words in **bold** inside a definition are also defined in this glossary.

| Term | Meaning |
|---|---|
| **Agenda** | A Calendar view that lists days and their tasks from top to bottom, instead of a grid. |
| **Archive** | To hide a board or status without deleting it. Archived items can be restored later. |
| **Assignee** | A person a task is assigned to. A task can have several assignees or none. Shown as **Assign to** in the task form. |
| **Board** | A collection of tasks for one area of work. Tasks on a board are arranged in **status** columns. |
| **Board member** | A person the **board owner** has invited to a board. Members can work with tasks but cannot change the board's setup. |
| **Board owner** | The person who created a board. Shown as **Owner** in the board's sharing window. |
| **Category** | A label that groups tasks inside one board, such as *Errands* or *Design*. Every task has one category. |
| **Completed task** | A task in a status marked **Counts as completed**. |
| **Daily digest** | A once-a-day **notification** that summarizes tasks due today, overdue tasks and today's schedule. |
| **Due date** | The day a task should be finished. |
| **Filter** | A setting that hides tasks that don't match what you choose, such as a priority or a category. |
| **Folder** | A group of boards in your sidebar. Folders are personal: only you see your folders. |
| **Global search** | Searching across all your tasks, boards, notes and plans at once, from the **Search** field at the top of the sidebar. `Ctrl+K` (Windows, Linux) or `Cmd+K` (macOS) puts the cursor in that field. |
| **Inbox** | The page that lists all your **notifications**. |
| **Note** | A free-form text entry in the Notepad. |
| **Notification** | A message from the application, such as a reminder or "assigned to you". Notifications appear in the bell menu and the Inbox. |
| **Overdue** | Past its due date and not completed. |
| **Plan** | A set of days, each with a checklist of items, used for goals such as a trip or a study plan. |
| **Priority** | How important a task is: **High**, **Medium** or **Low**. |
| **Quiet hours** | A daily period when reminder and schedule notifications are held back or skipped. |
| **Reminder** | A notification at a time you choose with **Remind me**. |
| **Schedule** | Your weekly timetable of time blocks, such as routines and meetings. Use it for anything that happens regularly; board tasks don't repeat. |
| **Shared board** | A board that has at least one **board member** besides the owner. |
| **Start date** | The day work on a task begins. Optional. It must be on or before the due date. |
| **Status** | A stage of work, such as *To Do* or *Done*. Each status is a column on the board. |
| **Subtask** | A smaller task inside another task. Subtasks have their own details, files and assignees. |
| **Task** | One piece of work. A task lives on one board and has one status at a time. |
| **View** | A way of showing a board's tasks: **Board** (columns), **Table** (rows) or **Progress** (summary). The Calendar has its own views: **Month**, **Week** and **Agenda**. |

## 4. Intended users and roles

### User groups

| Group | What they need from the application |
|---|---|
| **General staff and regular users** | Record their own tasks, see what is due, receive reminders and work on tasks assigned to them. |
| **Team leaders and board owners** | Set up boards and statuses, invite people, assign work and follow progress. |
| **People who run the server** (often called administrators) | Install, configure and maintain the server. This work happens outside the application. See [Additional resources](#14-additional-resources). |
| **Developers** | A functional overview of what users can do. This manual gives that overview. Technical details are in the README. |

### Roles in the application

The application has only two roles, and both apply to a single board:

- **Board owner:** the person who created the board. The owner controls the board's settings, statuses and members.
- **Board member:** a person the owner invited. Members work with the board's tasks.

Every signed-in person is the owner of the boards they create, and may be a member of boards others share with them. Outside boards, everything you create (notes, plans, schedule entries, folders) is private to you.

> **Note:** There is no administrator role inside the application. Nobody can open another person's private boards, notes or plans through the application.

A short summary of what each role can do:

| Action | Owner | Member |
|---|---|---|
| Work with tasks (create, edit, move, complete, delete, assign) | Yes | Yes |
| Create categories | Yes | Yes |
| Change statuses | Yes | No |
| Rename, recolor, reorder, archive or delete the board | Yes | No |
| Invite or remove members | Yes | No |
| Leave the board | No | Yes |
| Put the board in a folder | Yes | No |

The full table is in [Roles and permissions reference](#9-roles-and-permissions-reference).

## 5. Getting started

### Open the application

1. Open a web browser, such as Chrome, Edge, Firefox or Safari.
2. Go to the web address your organization gave you.

The sign-in page appears.

### Create an account

If you already have an account, skip to [Sign in](#sign-in).

1. On the sign-in page, select **Create one**.
2. Enter your **Name**. This is shown to people you share boards with.
3. Enter a **Login ID**. Use 3 to 32 letters, numbers, dots, dashes or underscores, starting with a letter or number.
4. Enter a **Password** of at least 8 characters.
5. Enter the password again in **Confirm password**.
6. Select **Create account**.

Your workspace opens. If you are not sure whether you should create your own account, ask the person who manages the application for your team.

### Sign in

1. Enter your **Login ID**.
2. Enter your **Password**.
3. Select **Sign in**.

You stay signed in in that browser for up to 30 days. After that, you are asked to sign in again.

### Understand the first screen

After you sign in, the **Home** page opens. It shows today's tasks, schedule and pinned notes. On the left is the **sidebar**, which takes you to every part of the application. See [Understanding the interface](#6-understanding-the-interface).

A new account has no boards yet, so most pages are empty.

### Create your first board

1. In the sidebar, select **+** next to **Boards**.
2. Select **New board**.
3. Enter a name, such as *Work*.
4. Select **Create board**.

The board opens with three statuses: *To Do*, *In Progress* and *Done*. For all board options, see [Creating a board](#creating-a-board).

### Create your first task

1. On the board, select **Quick add**.
2. Enter a **Title**.
3. Choose or type a **Category**.
4. Select **Add task**.

The task appears in the first status column. For all task options, see [Creating a task](#creating-a-task).

### Sign out

1. At the bottom of the sidebar, select **Logout**.

If the sidebar is collapsed, select your initials at the bottom, and then select **Logout**.

## 6. Understanding the interface

### Main areas

- **Sidebar** (left): moves you between pages, boards and folders, and holds your account, language and theme controls.
- **Main workspace** (right): shows the page you selected.
- **Page header** (top of the main workspace): shows the page name and the page's main actions, such as **Quick add** on a board or **New note** in the Notepad.

### The sidebar

From top to bottom, the full sidebar contains:

1. The **Collapse sidebar** button, the application name and the **notification bell**.
2. **Search**, a field that searches the whole application. See [Search](#79-search).
3. **Home**, **My Tasks**, **Calendar**, **Inbox** and **Reports**. Numbers next to **My Tasks** and **Inbox** show open tasks and unread notifications.
4. **Boards**: your folders and boards. See [Board and folder navigation](#board-and-folder-navigation).
5. **Plans**, **Notepad** and **Schedule**.
6. At the bottom: your name (opens **Account settings**), **Logout**, the language button and the theme button.

The page you are on is highlighted.

### Collapse and expand the sidebar

On a large screen, you can shrink the sidebar to a narrow strip of icons to give the main workspace more room.

1. Select the **Collapse sidebar** button at the top left of the sidebar.
2. To bring the full sidebar back, select the same button again. It is now labeled **Expand sidebar**.

When the sidebar is collapsed:

- You still see icons for Search, Home, My Tasks, Calendar, Inbox, Boards, Reports, Plans, Notepad and Schedule.
- The search icon opens the search field in a small panel beside the strip.
- Pointing at an icon, or moving to it with the `Tab` key, shows its name.
- Small numbers on icons show counts. Counts above 99 show as **99+**.
- The notification bell, language and theme buttons stay visible.
- Your initials at the bottom open a menu with **Account settings** and **Logout**.
- The list of boards and folders is hidden. To open a board, select the **Boards** icon or use [Search](#79-search).

Your browser remembers whether the sidebar is collapsed, so it stays that way when you change pages or come back later. This choice is saved in the current browser only.

### Small screens

On a phone or a narrow browser window (narrower than about 768 pixels), the sidebar is hidden to save space.

1. To open it, select the **menu** button (three lines) at the top left of the page.
2. The full sidebar slides in over the page, and the page behind it is dimmed.

The sidebar closes when you:

- Select a page or a board
- Select outside the sidebar, on the dimmed area
- Press `Escape`
- Select the **Close navigation** button at the top of the sidebar

While it is open, the page behind it does not scroll. Opening and closing the sidebar on a small screen does not change whether it is collapsed on a large screen.

### Board and folder navigation

In the **Boards** section of the sidebar:

- Select a board's name to open it.
- Select a folder's name to show or hide its boards.
- Select the arrow next to **Boards** to show or hide the whole list.
- Boards shared with you are marked with a people icon. Pointing at it shows who shared the board.

Your sidebar remembers which folders and sections you hid. For folder actions, see [Board folders](#74-board-folders).

### Account, language and theme controls

- **Your name:** opens **Account settings**. See [Profile settings](#profile-settings).
- **Language button** (**EN**, **中** or **RU**): changes the interface language. See [Language](#language).
- **Theme button:** switches between light and dark. See [Light and dark themes](#light-and-dark-themes).

---

## 7. Feature guide

Each feature below uses the same layout: what it does, when to use it, who can use it (when permissions apply), how to use it, what happens afterward, and tips or limitations.

### 7.1 Account and preferences

#### Registration and sign-in

See [Create an account](#create-an-account) and [Sign in](#sign-in) in Getting started.

**Tips and limitations**

- Login IDs must be unique. If yours is taken, you see *Login ID already taken*.
- If you see *Invalid login ID or password*, check the spelling and the keyboard's Caps Lock.

#### Profile settings

**What it does:** changes your name and login ID.

**When to use it:** when your name changes, or when you want a different login ID.

**How to use it**

1. At the bottom of the sidebar, select your name.
2. Under **Profile**, change your **Name** or **Login ID**.
3. If you change your login ID, enter your **Current password**.
4. Select **Save profile**.

**What happens afterward:** you see *Profile saved*. People you share boards with see your new name and login ID. Use the new login ID the next time you sign in.

#### Password changes

**What it does:** sets a new password for your account.

**When to use it:** when you think someone else knows your password, or when you want a stronger one.

**How to use it**

1. At the bottom of the sidebar, select your name.
2. Under **Change password**, enter your **Current password**.
3. Enter the **New password** (at least 8 characters, different from the current one).
4. Enter it again in **Confirm new password**.
5. Select **Change password**.

**What happens afterward:** you see *Password changed*. You stay signed in on this device. Every other device or browser where you were signed in is signed out.

#### Signing out

**What it does:** ends your session in this browser.

**When to use it:** always on a shared or public computer.

**How to use it:** see [Sign out](#sign-out).

**What happens afterward:** the sign-in page appears. Your data is kept. Other devices where you are signed in are not affected.

#### Language

**What it does:** changes the language of the interface. English, Simplified Chinese (简体中文) and Russian (Русский) are available.

**How to use it**

1. At the bottom of the sidebar, select the language button (**EN**, **中** or **RU**).
2. Select a language.

**What happens afterward:** the interface changes immediately. Your own content, such as task titles, is not translated. The choice is remembered in this browser.

#### Light and dark themes

**What it does:** switches between a light and a dark color scheme.

**When to use it:** dark mode can be easier on the eyes in a dim room.

**How to use it**

1. At the bottom of the sidebar, select the theme button (**Switch to dark mode** or **Switch to light mode**).

**What happens afterward:** the colors change immediately. The choice is remembered in this browser.

### 7.2 Workspace pages

Each page in the sidebar has its own purpose:

| Sidebar item | Use it to | Details |
|---|---|---|
| **Home** | See today's tasks, schedule and pinned notes. The page title is *Dashboard*. | [Today](#today) |
| **My Tasks** | See open work assigned to you or to nobody, across all boards. | [My Tasks](#my-tasks) |
| **Calendar** | See tasks on their due dates and reschedule them. | [Calendar](#78-calendar) |
| **Inbox** | Read and manage all your notifications. | [Inbox and notifications](#711-inbox-and-notifications) |
| **Reports** | See progress and workload across your boards. | [Reports](#712-reports) |
| **Boards** | See all boards and the full task list, and manage boards. | [Boards](#73-boards) |
| **Plans** | Plan activities for specific days. | [Plans](#713-plans) |
| **Notepad** | Write and pin notes. | [Notepad](#714-notepad) |
| **Schedule** | Keep a weekly timetable. | [Schedule](#715-schedule) |

To move around, see [Understanding the interface](#6-understanding-the-interface).

### 7.3 Boards

#### Creating a board

**What it does:** creates a new board for a separate area of work.

**When to use it:** when you start a new project, team or area of life you want to keep separate.

**Who can use it:** any signed-in user. You become the board's owner.

**How to use it**

1. In the sidebar, select **+** next to **Boards**, and then select **New board**. You can also select **New board** on the Boards page.
2. Enter a **Name**. Each of your boards needs a different name.
3. Choose a **Color** and an **Icon**. These help you recognize the board in lists.
4. Check the **Timezone**. It starts with your computer's timezone.
5. Review the **Initial statuses**. You can rename, recolor, reorder, add or remove them.
6. Select **Create board**.

**What happens afterward:** the board opens and appears in your sidebar.

**Tips and limitations**

- A board needs between 1 and 20 initial statuses, with different names, and at least one marked **Counts as completed**.
- To create the board inside a folder, see [Creating a board inside a folder](#creating-a-board-inside-a-folder).
- You can't change the timezone after the board is created. The board's **Settings** menu (gear icon) shows it.

#### Opening a board

**How to use it:** select the board's name in the sidebar. You can also select a board on the **Boards** or **Reports** page, or find it with [Search](#79-search).

**What happens afterward:** the board opens and is highlighted in the sidebar. The board opens with the view and filters you used last time. See [Saved board preferences](#saved-board-preferences).

#### Editing board settings

**What it does:** changes a board's name, color or icon.

**Who can use it:** the board owner.

**How to use it**

1. In the sidebar, select **Boards**.
2. Select **Manage boards**.
3. On the **Active** tab, find the board.
4. Change the name, then select outside the name box to save it.
5. Select a color or an icon to change it.

**What happens afterward:** each change is saved immediately and shows everywhere the board appears.

**Tips and limitations:** **Manage boards** lists only boards you own. Board colors include slate, gray, teal, blue, indigo, violet, pink, red, orange, yellow, lime, green and cyan. Icons include Home, Briefcase, People, Heart, Star, Flag, Bookmark and Calendar.

#### Reordering boards

**What it does:** changes the order of your boards in the sidebar and on the Boards page.

**Who can use it:** the board owner.

**How to use it**

1. On the Boards page, select **Manage boards**.
2. On the **Active** tab, drag a board by its handle (the dotted grip on the left) to a new position.

**Tips and limitations:** dragging a board in the sidebar does not reorder it. Sidebar dragging only moves boards into or out of folders.

#### Archiving and restoring boards

**What it does:** archiving hides a board you don't need right now without losing anything. Restoring brings it back.

**When to use it:** when a project is finished but you may need its tasks later.

**Who can use it:** the board owner.

**How to use it**

1. On the Boards page, select **Manage boards**.
2. On the **Active** tab, select **Archive** next to the board.
3. Confirm.

To restore it:

1. In **Manage boards**, open the **Archived** tab.
2. Select **Restore** next to the board.

**What happens afterward:** an archived board and its tasks no longer appear in the sidebar, Home, My Tasks, Calendar, Reports, search or notifications. Members also stop seeing it. Everything returns when you restore the board.

**Tips and limitations:** you can't archive your last active board.

#### Deleting boards

**What it does:** permanently removes a board, with all its tasks, statuses, categories and attachments.

**Who can use it:** the board owner.

**How to use it**

1. [Archive the board](#archiving-and-restoring-boards) first. Active boards can't be deleted.
2. In **Manage boards**, open the **Archived** tab.
3. Select **Delete permanently** next to the board.
4. Type the board's name exactly to confirm.
5. Select **Delete permanently**.

**What happens afterward:** the board and everything in it are removed for everyone.

> **Warning:** Deleting a board can't be undone.

#### Sharing boards

**What it does:** gives other people access to a board so you can work together.

**When to use it:** when tasks on a board involve other people, or you want to assign tasks to them.

**Who can use it:** the board owner invites and removes people. Members can see who is on the board and can leave.

**How to use it**

1. Open the board.
2. Select **Share** in the page header.
3. Under **Invite by login ID**, enter the person's login ID.
4. Select **Invite**.

To remove someone, select **Remove** next to their name. To leave a board you were invited to, select **Leave** next to your name.

**What happens afterward:**

- The invited person receives a *Shared board* notification, and the board appears in their sidebar with a people icon.
- The **Share** button shows how many people are on the board, for example **Share · 3**.
- When someone is removed or leaves, they are unassigned from the board's tasks.

**Tips and limitations:** the person must already have an account. Ask them for their exact login ID.

#### Owner and member permissions

See the [Roles and permissions reference](#9-roles-and-permissions-reference).

### 7.4 Board folders

Folders group boards in your sidebar, for example *Work*, *Projects* and *Personal*. Folders are personal: other people never see your folders, and you can only put boards you own into them.

#### Creating folders

**How to use it**

1. In the sidebar, select **+** next to **Boards**.
2. Select **New folder**.
3. Enter a **Folder name** (up to 80 characters).
4. Select **Save**.

**What happens afterward:** the empty folder appears in the Boards list with the text *No boards yet*.

**Tips and limitations:** each of your folders needs a different name. Folders can't be placed inside other folders.

#### Renaming folders

1. Point at the folder in the sidebar.
2. Select its **...** (options) button.
3. Select **Rename folder**.
4. Enter the new name and select **Save**.

#### Deleting folders

1. Point at the folder in the sidebar.
2. Select its **...** (options) button.
3. Select **Delete folder**.
4. Confirm.

**What happens afterward:** only the folder is removed. Its boards and tasks stay and appear outside any folder.

#### Creating a board inside a folder

1. Point at the folder in the sidebar.
2. Select its **+** button (**New board in** *folder name*).
3. Complete the board form, as in [Creating a board](#creating-a-board).

**What happens afterward:** the new board appears inside that folder.

#### Moving a board with the ... menu

**When to use it:** when you prefer menus to dragging, or you use a touch screen.

**How to use it**

1. Point at the board in the sidebar.
2. Select its **...** button.
3. Under **Move to folder**, select a folder. The current folder has a check mark.

To take the board out of its folder, select **No folder**.

**What happens afterward:** the sidebar updates to show the board in its new place.

#### Moving a board by dragging it onto a folder

"Dragging" means pressing on an item, moving it while still pressing, and letting go over the place you want it.

**How to use it**

1. In the sidebar, press and hold the mouse button on a board's name.
2. While still holding, move the pointer over a folder's name. The folder is highlighted when you can drop the board there.
3. Release the mouse button.

**What happens afterward:** the board moves into the folder. You can drop boards onto empty folders and onto folders whose boards are hidden.

**Tips and limitations**

- A short click without moving still opens the board.
- Press `Escape` while dragging to cancel.
- Dropping a board onto the folder it is already in does nothing, so that folder is not highlighted.
- With a keyboard: press `Tab` until the board's name is selected, press `Space` to pick it up, use the arrow keys to move it, and press `Space` again to drop it.

#### Moving a board out of a folder

1. Drag the board from its folder down to the area below the folders.
2. While you drag, a dashed box reading *Drop here to remove from its folder* marks this area. Release the board there.

You can also use **No folder** in the board's [... menu](#moving-a-board-with-the--menu).

#### Restrictions for shared boards

- Boards shared with you (people icon) can't be dragged and have no **...** folder menu, because folders belong to each person.
- When you share your own board, your folders are not visible to members.
- Moving a board needs at least one folder. Create one first.

### 7.5 Statuses

#### Understanding status columns

A **status** describes where a task is in its life, such as *To Do*, *In Progress* or *Done*. In the Board view, each status is a column. Every task has exactly one status.

**Who can use it:** everyone on the board can move tasks between statuses. Only the board owner can create, change, reorder, archive or delete statuses. If a board has no statuses yet, members see *The board owner has not set up any statuses yet.*

#### Creating and editing statuses

**Who can use it:** the board owner.

**How to add a status**

1. Open the board.
2. Select **Manage statuses** in the page header. You can also select **+ Add status** at the end of the columns.
3. Enter a status name (up to 50 characters). Each status on a board needs a different name.
4. Choose a color and whether it **Counts as completed**.
5. Select **Add status**.

**How to change a status**

1. On the board, double-click the status name at the top of its column, or open the column's menu and select **Rename**.
2. Type the new name and press `Enter`. Press `Escape` to cancel.

The column menu also lets you change the **Color**.

#### Reordering statuses

- On the board, open the column's menu and select **Move left** or **Move right**.
- Or, in **Manage statuses**, drag a status to a new position.

The order of columns is the same for everyone on the board.

#### Completed statuses

Turn on **Counts as completed** for statuses that mean the work is finished, such as *Done*. Tasks in these statuses:

- Count as completed in progress figures and Reports
- No longer appear as overdue
- Show as done in search results and the Calendar

Turn it on or off in the column menu or in **Manage statuses**. A board should have at least one completed status, or the Progress view can't show completion.

#### Archiving and restoring statuses

**What it does:** archiving hides a status you no longer use. Deleting removes it for good. In both cases its tasks are kept and moved to another status.

**How to use it**

1. Select **Manage statuses**.
2. Select **Remove…** next to the status.
3. Under **Move tasks to**, choose the status that should receive its tasks.
4. Select **Archive** to keep the status for later, or **Delete** to remove it permanently.

To restore an archived status, open the **Archived** tab in **Manage statuses** and select **Restore**.

You can also select **Delete status** in a column's menu. This moves its tasks to the status you pick and deletes the status permanently.

**Tips and limitations**

- You can't archive a board's last active status.
- An archived status that still has tasks can't be deleted permanently until its tasks are moved.
- Tasks in archived statuses don't appear on Home, My Tasks, the Calendar, Reports or in search.

#### Owner-only restrictions

All status changes are owner-only. Members who need a new status should ask the board owner.

### 7.6 Tasks

#### Creating a task

**What it does:** adds a new piece of work to a board.

**Who can use it:** the owner and members of the board.

**How to use it**

1. Open the board.
2. Select **Quick add** in the page header to add the task to the first status. To add it to a specific status, select the **+** button at the top of that column.
3. In **Basics**, enter a **Title** (up to 160 characters).
4. Choose a **Category**, or type a new one and select **Create** "*name*".
5. Optionally set a **Start date** and **Due date**.
6. Optionally choose people under **Assign to**.
7. Choose a **Priority**.
8. Optionally add **Details**, **Reference links** and **Attachments**.
9. Select **Add task**.

**What happens afterward:** the task appears on the board. Anyone you assigned receives a notification. If the task falls outside the board's current date range or filters, a message tells you so and offers **View task**.

**Tips and limitations**

- You can also create tasks from the [Calendar](#creating-a-task-from-a-date).
- Tasks don't repeat. For something that happens regularly, such as a weekly meeting or a daily routine, add a routine to the [Schedule](#715-schedule).

#### Viewing task details

**How to use it:** select a task card on the board, a row in a table, or a task in any list.

**What happens afterward:** the task details window opens. It shows:

- **Details:** the formatted description
- **Subtasks**
- **Properties:** status, category, priority, dates, assignees, reminder, created and updated times
- **Links** and **Files**
- **History** of changes, in a side panel

#### Editing a task

1. Open the task.
2. Select **Edit**.
3. Make your changes.
4. Select **Save changes**.

**What happens afterward:** the changes are saved and recorded in the task's history. If you close the window with unsaved changes, you are asked whether to **Discard** them or **Keep editing**.

**Tips and limitations:** if someone else changed the task at the same time, you see *Version conflict*. The task refreshes; make your change again.

#### Completing a task

**What it does:** marks the work as finished.

**How to use it:** move the task into a status marked **Counts as completed**, such as *Done*. You can:

- Drag the card to that column in the Board view
- Open the card's menu (**Task menu**), select **Change status** and choose the status
- Choose the status in the **Status** column of the Table view
- Select **Complete** on an overdue or reminder notification

**What happens afterward:** the task counts as completed everywhere and no longer appears as overdue.

#### Deleting a task

**How to use it**

1. Open the card's menu, or open the task and select **More**.
2. Select **Delete**.
3. Confirm.

**What happens afterward:** the task, its subtasks, links and files are removed.

> **Warning:** Deleting a task can't be undone.

#### Duplicating a task

**What it does:** makes a copy of a task, placed directly below the original.

**When to use it:** when you need a similar task, such as the same checklist for a new client.

**How to use it:** open the card's menu, or open the task and select **More**, and then select **Duplicate**.

**What happens afterward:** the copy gets "(copy)" after its title. It includes the details, dates, priority, category, links, files and subtasks. It does **not** include assignees or reminders.

#### Moving a task between statuses

- **Drag:** in the Board view, drag the card to another column. Drag it up or down within a column to change its position.
- **Menu:** open the card's menu, select **Change status** and choose a status.
- **Table:** choose a new status in the task's **Status** cell.

#### Moving a task to another board

**What it does:** moves a task, with its content, subtasks, links and files, to a different board.

**Who can use it:** anyone who can open both boards.

**How to use it**

1. Open the card's menu, or open the task and select **More**.
2. Select **Move to board…**.
3. Choose a board.
4. Choose a status on that board.
5. Select **Move task**.

**What happens afterward**

- The task appears on the other board.
- Assignees who aren't on the other board are unassigned. The window tells you who before you move.
- The task keeps its category name. If the other board doesn't have that category, it is created.

**Tips and limitations:** you can't move a task to an archived board. Subtasks move with their parent task and can't be moved on their own.

#### Task priorities

Every task has a priority: **High**, **Medium** or **Low**. Use priorities to decide what to do first. You can [filter](#filtering-by-priority) and sort by priority.

#### Categories

**What it does:** groups tasks within a board, such as *Errands*, *Bugs* or *Meetings*. Each board has its own categories.

**Who can use it:** the owner and members can create categories.

**How to use it:** in the task form's **Category** box, choose a category from the list. To add a new one, type its name (up to 60 characters) and select **Create** "*name*".

**Tips and limitations:** categories can't be renamed or deleted from the application. Choose names carefully.

#### Assignees

**What it does:** shows who is responsible for a task.

**How to use it**

- In the task form, choose people under **Assign to**.
- Or open the card's menu and use **Assign to** or **Unassign everyone**.

**What happens afterward:** newly assigned people receive an *Assigned to you* notification. You don't receive one when you assign yourself.

**Tips and limitations:** you can only assign people who are on the board. To add people, [share the board](#sharing-boards).

#### Due dates and start dates

- **Due date:** when the task should be finished. The Calendar shows tasks on their due date.
- **Start date:** when work begins. It must be on or before the due date.

A task whose dates include today appears on the [Today](#today) page. Unfinished tasks past their due date are marked **Overdue**.

#### Rich-text content

**What it does:** lets you write formatted task details.

**How to use it:** in the **Details** section, type in the editor. The toolbar offers bold, italic, underline, strikethrough, text color, highlight, headings, bullet and numbered lists, task lists (checklists), quotes, code, text alignment, links, a horizontal line, and images.

**Tips:** checklists in the details are counted on the task card, for example *Checklist 2/5*.

#### Images in task details

1. In **Details**, paste an image, drop an image file, or select **Insert image**.
2. Optionally describe the image in **Alt text** so people using screen readers know what it shows.

To view an image at full size, select it in the task details.

#### Links

**What it does:** stores web addresses related to the task, such as a document or a web page.

**How to use it**

1. In the task form, under **Reference links**, select **Add link**.
2. Enter a **Name** and a **URL**.
3. Save the task.

**Tips and limitations:** only web addresses that start with `http://` or `https://` are accepted.

#### Attachments

**What it does:** attaches files to a task.

**How to use it**

1. In the task form, under **Attachments**, select **Add files**.
2. Choose one or more files.
3. Save the task.

To get a file back, open the task and select **Download**. To remove a file, edit the task and select **Remove attachment**.

**Tips and limitations**

- Each file can be up to 10 MB. Empty files are rejected.
- Accepted file types: PNG, JPG/JPEG, GIF, WebP, PDF, TXT, MD, DOC, DOCX, XLS, XLSX, CSV and ZIP.
- If some files fail, the task is still saved and a message lists the failed files.

#### Screenshots and image annotation

**What it does:** captures your screen into the task details, and lets you mark up any image with arrows, shapes and text.

**When to use it:** to show a problem or highlight part of a screen.

**How to take a screenshot**

1. In the task form's **Details** section, select **Take screenshot**.
2. To wait first, select the arrow next to it, choose **Take after a delay**, and choose 3, 5 or 10 seconds.
3. Your browser asks what to share. Choose a screen, window or tab.

The screenshot opens in the image editor.

**How to mark up an image**

1. Double-click an image in the details, or select it and choose **Annotate image**.
2. Use the tools: **Select area** (crop), **Pen**, **Highlighter**, **Rectangle**, **Arrow** and **Text**. Choose a **Color** and **Size**.
3. Use **Undo** and **Redo** to correct mistakes.
4. Select **Done**.

**Tips and limitations:** screenshots work in Chrome, Edge and Firefox on a computer. Other browsers show *This browser cannot take screenshots*.

#### Subtasks

**What it does:** breaks a task into smaller tasks. Each subtask is a full task with its own details, files and assignees.

**How to use it**

1. Open the task.
2. Under **Subtasks**, type in **Add a subtask** and press `Enter`.
3. Select a subtask's checkbox to mark it done. Select its title to open it.

**What happens afterward:** the parent task shows progress, such as *2 of 5 completed*.

**Tips and limitations:** subtasks can't have their own subtasks. They don't appear separately in the Calendar or search.

#### Task history

**What it does:** shows who created the task and every change made since, such as a new due date, status or assignee.

**How to use it:** open the task. The **History** panel is beside the details.

**When to use it:** to find out when or by whom something changed.

### 7.7 Board views and filters

#### Board view

**What it does:** shows tasks as cards in status columns. This is often called a Kanban board.

**When to use it:** to see work flowing from start to finish and to move tasks by dragging.

**How to use it:** select **Board** in the view switch in the page header.

Each card shows the title, priority, category, dates, assignees and counts for checklists, subtasks, links and files. Overdue tasks are marked **Overdue**.

#### Table view

**What it does:** shows tasks as rows with the columns **Task**, **Status**, **Category**, **Priority**, **Dates** and **Subtasks**.

**When to use it:** to scan many tasks at once or change statuses quickly.

**How to use it**

1. Select **Table** in the view switch.
2. Select the **Priority** or **Dates** heading to sort. Select it again to reverse the order.

#### Progress view

**What it does:** shows how many tasks are completed, **By status** and **By category**, for the tasks that match the current filters.

**When to use it:** to check how much work is done in a period, for example this month.

**How to use it:** select **Progress** in the view switch.

**Tips and limitations:** completion needs at least one status marked **Counts as completed**.

On narrower windows, the view switch is inside the **Settings** (gear) menu in the page header.

#### Board summary

Above the tasks, the **Board summary** shows the date range and the **Total**, **Completed** and **Remaining** number of tasks that match the filters.

#### Date-range selection

**What it does:** shows only tasks whose date falls in a chosen period.

**How to use it**

1. Under **Date**, choose **Due date** or **Created date**.
2. Under **Range**, choose **Year**, **Month**, **Week**, **Day**, **Custom** or **All** (no date filter).
3. For **Custom**, choose a start and end date and select **Apply**.
4. Use the arrows (**Previous period**, **Next period**) to move to the previous or next period.

#### Filtering by category

Under **Category**, choose one category, or **All categories** to show every category.

#### Filtering by assignee

Under **Assignee**, choose **All assignees**, **Assigned to me**, **Unassigned** or a specific person.

#### Searching within a board

Type in **Search tasks...** to show only tasks whose title or details contain the text. To search all boards at once, use [Search](#79-search).

#### Filtering by priority

**What it does:** shows tasks of one or more chosen priorities.

**How to use it**

1. Select the **Priority** box. A list opens.
2. Select a priority to add it. Select it again to remove it. Selected priorities appear as tags in the box.
3. To clear all priorities, select the clear (×) button.

**What you see**

- **No priority selected** (the box shows *All priorities*): tasks of every priority.
- **One priority selected:** only tasks with that priority.
- **Several priorities selected:** tasks that match **any** of them. For example, **High** and **Low** together show high-priority and low-priority tasks and hide medium ones.

#### How filters combine and how to clear them

A task must match **every** filter to be shown. For example, *Category: Work*, *Priority: High and Medium* and *Assigned to me* shows only your high- and medium-priority work tasks.

To clear all filters, select **Reset**. This returns to this month by due date, all categories, all priorities, all assignees and no search text.

#### Saved board preferences

Each board remembers its own view, date field, range and period, category and priority selection, so it opens the way you left it. Search text and the assignee filter are not remembered.

These preferences are saved in the current browser. Another browser or device starts with the default settings.

#### Display limit

A board shows up to 500 tasks at a time. If more tasks match, a message says *Reached the display limit*. Choose a shorter date range to see a complete list.

### 7.8 Calendar

The Calendar shows tasks on the day they are due, across your own boards and boards shared with you. Tasks without a due date, subtasks, and tasks on archived boards or in archived statuses are not shown. Days follow your computer's date and timezone.

#### Month, Week and Agenda views

**What it does:** shows the same tasks in three layouts.

| View | What it shows |
|---|---|
| **Month** | Six weeks as a grid, starting on Monday. Days from the previous and next month are shaded. |
| **Week** | Monday to Sunday, with more room for each day. |
| **Agenda** | A list of days that have tasks, plus today, with each task's board, status and priority. |

**How to use it:** select **Month**, **Week** or **Agenda** at the top of the page. The browser remembers your choice.

Each task shows its board's color. Completed tasks are crossed out and marked with a check mark (✓).

#### Moving between dates

- Select the arrows to go to the previous or next month (or week, in the Week view).

#### Returning to the current date

Select **Today**. The calendar returns to the period that includes today, in the same view.

#### Showing one board

Under **Show tasks from board**, choose a board. To see all boards again, choose **All boards** or clear the box.

#### Opening a task from the Calendar

Select a task's title. The task opens on its board.

#### Creating a task from a date

**How to use it**

1. Select a day's number in the Month or Week view, or **Add task** next to a day in the Agenda. Select **New task** at the top to use today (or the first visible day if today isn't shown).
2. If you have more than one board, choose a **Board** and select **Continue**. If you chose a board under **Show tasks from board**, it is used automatically.
3. The task form opens with the start and due date set to that day. Complete it as in [Creating a task](#creating-a-task).

#### Rescheduling a task by dragging

**What it does:** changes a task's due date by moving it to another day.

**How to use it**

1. In the Month or Week view, press and hold on a task.
2. Move it onto another day.
3. Release it.

**What happens afterward:** the new due date is saved immediately. If the task has a start date, the start date moves by the same number of days, so the task keeps its length. If saving fails, the task returns to its previous date and an error message appears.

#### Changing the date without dragging

**When to use it:** with a keyboard, on a touch screen, or whenever you prefer not to drag.

**How to use it**

1. Select the calendar icon next to the task (**Change date**). In the grid, the icon appears when you point at the task or move to it with `Tab`. In the Agenda, it is always visible.
2. Choose the new date.
3. Select **Move to** *date*.

#### Small screens

On a phone or a window narrower than about 992 pixels, the calendar always shows a list, because a seven-column grid would be too small to read. The Month view lists the month's days and the Week view lists the week's days.

#### When not every task is shown

A single month or week shows up to 500 tasks. If there are more, a **Not every task is shown** notice appears. Choose a board under **Show tasks from board**, or switch to the Week view.

### 7.9 Search

**What it does:** finds tasks, boards, notes and plans across the whole application. You type in the **Search** field at the top of the sidebar, and matching items appear in a list under the field.

**When to use it:** when you know part of a name and want to go straight to it, without opening the right board or page first.

#### Going to the search field

- Select the **Search** field at the top of the sidebar.
- Or press `Ctrl+K` on Windows or Linux, or `Cmd+K` on macOS. The cursor moves into the field, so you can start typing straight away. The field shows the shortcut as a reminder.

Where the field is depends on the sidebar:

- **Sidebar collapsed:** select the search icon in the narrow strip of icons, or press the shortcut. The search field opens in a small panel beside the strip, and the sidebar stays collapsed.
- **Small screen:** press the shortcut to open the navigation with the cursor already in the search field, or open the navigation with the menu button and select the field.

To leave the field, press `Escape`. The first press clears what you typed; the second takes you back to where you were. Pressing the shortcut again also leaves the field.

**Tips and limitations:** the shortcut doesn't work while you are typing in another text box, date field or the task editor, because those use the same keys (the editor uses them to add a link). Select the search field with the mouse instead.

#### Searching

1. Go to the search field.
2. Type part of a name or text.
3. Results appear under the field after a short pause, grouped by type.

| Type | What is searched | Selecting a result |
|---|---|---|
| **Tasks** | Title and details | Opens the task on its board. The result shows the board, due date and whether it is done. |
| **Boards** | Board name | Opens the board. |
| **Notes** | Title and text | Opens the note in the Notepad. |
| **Plans** | Name and description | Opens the plan. |

**What happens afterward:** the item opens and the search field is cleared. On a small screen, the navigation closes.

**Tips and limitations**

- Upper and lower case don't matter.
- Search only finds what you can open: tasks and boards on your own and shared boards, and your own notes and plans.
- Archived boards, their tasks, and subtasks are not searched.
- Each type shows up to five matches. If there are more, you see *More matches exist*. Type more to narrow the results.
- If nothing matches, the list says so. If the search fails, select **Retry**.

#### Moving through results with the keyboard

- The first result is highlighted as soon as results appear, so you can press `Enter` straight away.
- Press `↓` or `↑` to highlight the next or previous result. The highlight wraps around at the ends.
- Press `Enter` to open the highlighted result.
- You can also select a result with the mouse or by tapping it.

### 7.10 Today and My Tasks

#### Today

**What it does:** shows what needs your attention today. Open it with **Home** in the sidebar. The page title is *Dashboard*.

**What appears**

- **Today's schedule:** today's [schedule](#715-schedule) entries. Select an entry's checkbox to mark it done for today.
- **Active tasks:** tasks whose dates include today (from the start date to the due date). Completed ones are shown dimmed at the end.
- **Needs attention:** unfinished tasks past their due date.
- **Pinned notes:** up to six [notes](#714-notepad) you pinned.

The header shows how many of today's tasks and schedule entries are done.

**Tips and limitations:** from boards shared with you, only tasks assigned to you appear on Today. Tasks on your own boards appear whether or not they are assigned.

#### My Tasks

**What it does:** lists tasks assigned to you, plus tasks nobody is assigned to, across all your boards and boards shared with you.

**When to use it:** to pick your next task or to find unassigned work.

**How to use it**

1. Select **My Tasks** in the sidebar.
2. Choose **Open**, **Completed** or **All**.
3. Select a group to focus on: **Overdue**, **Due today**, **Next 7 days** or **Later**.
4. Optionally filter by text (title, board or category), **Board**, **Assignee** or **Priority**.
5. Choose a sort order: due date, priority, board or recently updated.
6. Select a task to open it.

Select **Clear** to remove the filters.

**Tips and limitations:** the list loads up to 1,000 tasks. A line at the bottom says how many are shown. The number next to **My Tasks** in the sidebar counts open tasks in this list.

The **Boards** page shows the same kind of list, called **Tasks**, for all tasks on your boards.

### 7.11 Inbox and notifications

#### Notification types

| Type | When it arrives |
|---|---|
| **Assigned to you** | Someone assigns a task to you. |
| **Shared board** | Someone adds you to a board. |
| **Reminder** | At the time you chose with **Remind me**. |
| **Overdue** | A task is past its due date and not finished. It disappears when the task is completed or rescheduled. |
| **Schedule** | A schedule entry is about to start. |
| **Daily digest** | Once a day, a summary of tasks due today, overdue tasks and today's schedule. |

Reminder and overdue notifications go to the task's assignees, or to the board owner if nobody is assigned.

#### Viewing notifications

- The **bell** at the top of the sidebar shows the number of unread notifications. Select it to see the latest ones.
- The **Inbox** page lists all notifications. Choose **All** or **Unread**.
- New notifications also appear briefly at the corner of the screen, with an **Open** button.

#### Opening related tasks

Select a notification. It is marked as read, and the related task or board opens.

#### Marking notifications as read

- Selecting a notification marks it as read.
- Select **Mark all read** to mark every notification as read.
- Select the × on a notification to dismiss it, or **Clear all** to dismiss all of them.

#### Acting on overdue and reminder notifications

These notifications have extra buttons:

- **Remind me:** choose **In 1 hour**, **In 3 hours**, **Tomorrow at 9:00**, **Next Monday at 9:00**, or **Pick a time…** and **Set reminder**.
- **Complete:** marks the task as completed.
- **Close:** dismisses the notification.

#### Notification preferences

1. Select the bell, then **Settings**. On the Inbox page, select **Settings**.
2. Turn each type on or off and adjust its options.
3. Select **Save**.

| Setting | What you can change | Starts as |
|---|---|---|
| **Desktop notifications** | Show notifications from your computer's operating system while the app is open. **Send a test notification** checks that they work. | Depends on your browser |
| **Daily digest** | On or off, and the **Digest time**. | On, 08:00 |
| **Schedule starting soon** | On or off, and **Minutes before start** (0 to 240). | On, 10 minutes |
| **Overdue tasks** | On or off. | On |
| **Reminders** | On or off. | On |
| **Quiet hours** | On or off, **From** and **Until** times. | Off, 22:00 to 07:00 |

#### Quiet hours

During quiet hours, reminders and the daily digest are held until quiet hours end. Schedule alerts during quiet hours are skipped. *Assigned to you* and *Shared board* notifications still arrive.

#### Browser notification permission

The first time, the application asks *Turn on desktop notifications?* Select **Turn on** and then allow notifications when your browser asks. Select **Not now** to skip.

If you blocked notifications earlier, allow them in your browser's site settings, and then reopen **Notification settings**.

#### When notifications are created

Notifications are checked while the application is open in your browser. If nobody has it open, nothing is sent, and the notifications appear the next time you open it. Reminders up to 24 hours late are still shown. Schedule alerts that were missed are not shown later. Notifications are kept for 30 days.

### 7.12 Reports

**What it does:** gives a snapshot of work across all your boards and the boards shared with you.

**When to use it:** to review progress, workload and problems at a glance, for example at the start of a week.

**How to use it:** select **Reports** in the sidebar.

**What appears**

- **Overview:** the number of active boards, total tasks, open, completed, completion rate, due today and overdue.
- **Board progress:** completion for each board, with the number of overdue tasks. Select a board to open it.
- **Workload:** the mix of High, Medium and Low priority tasks, and completed versus open tasks.
- **Needs attention:** lists of **Overdue** tasks and tasks **Due today**. Select a task to open it.

**Tips and limitations:** Reports has no filters, charts over time or export. Archived boards are not included. The **Boards** page shows the same panels plus the full task list.

### 7.13 Plans

A plan breaks a goal into days. Each day has a checklist of items. Use plans for things like a trip, a study plan or a project week.

#### Creating a plan

1. Select **Plans** in the sidebar.
2. Select **New plan**.
3. Enter a **Name** and an optional **Description**.
4. Select **Create plan**.

The plan opens, ready for days.

#### Adding days

1. In the plan, select **Add day**.
2. Choose a **Date** and an optional **Label**, such as *Rest day*.
3. Save.

Each date can be used only once in a plan. To change or remove a day, open the day's menu and select **Edit day** or **Delete day**.

#### Adding and completing checklist items

1. Under a day, select **+ Add an item**.
2. Type the item and press `Enter`.
3. To mark it done, select its checkbox or its text.

To edit an item, select the pencil icon, change the text and press `Enter` (or `Escape` to cancel). To delete it, select the ×.

#### Following progress

- In a plan, the progress bar shows how many items are done.
- The Plans page shows an **Overview**, **Today** (items planned for today and items left unfinished), **Daily progress** for the last two weeks and the coming week, and **Plan progress** for each plan.

#### Renaming and deleting plans

Open the plan's menu and select **Rename plan** or **Delete plan**. Deleting a plan permanently removes all its days and items.

### 7.14 Notepad

**What it does:** stores free-form notes, such as ideas, reference information or meeting notes.

**When to use it:** for information that is not a task. Notes are private to you.

#### Creating a note

1. Select **Notepad** in the sidebar.
2. Select **New note**.
3. Enter a **Title** and **Body** (plain text).
4. Optionally choose a **Priority** and turn on **Pinned**.
5. Select **Save**.

#### Editing a note

Select the note, change it, and select **Save**.

#### Pinning notes

Pinned notes appear first in the Notepad and on the [Today](#today) page. Open the note's menu (**Note actions**) and select **Pin** or **Unpin**.

#### Finding notes

- Type in **Search** to find notes by text.
- Use the priority filter to show one priority.
- Switch between **Cards** and **Table** layouts. The browser remembers your choice.

#### Deleting a note

Open the note's menu and select **Delete**, then confirm. Deleting a note can't be undone.

**Tips and limitations:** notes can't be converted into tasks. Copy the text into a new task instead.

### 7.15 Schedule

**What it does:** keeps a weekly timetable of time blocks, such as working hours, classes or the gym.

**When to use it:** for things that happen at a set time, as opposed to tasks with a due date.

#### Creating a schedule entry

1. Select **Schedule** in the sidebar.
2. Select **New schedule**, or select an empty time slot to start with that day and time.
3. Enter a **Title**.
4. Choose a **Type**:
   - **Routine** repeats every week on the days you choose.
   - **This week only** happens once, in the current week.
5. Choose the days. For routines, you can use **Every day**, **Weekdays** or **Weekend**.
6. Set the **Start time** and **End time**. The end must be later than the start.
7. Optionally choose a **Priority** and **Color**, and add **Notes**.
8. Select **Save**.

#### Viewing the schedule

Choose **Day** or **Week**. Use **Previous**, **Next** and **Today** to move between dates.

#### Completing an entry

Select an entry's checkbox to mark it complete for that date. Completion applies to that date only. A routine starts fresh on its next day.

#### Editing and deleting entries

Select the entry to edit it. To delete it, select **Delete** in the form and confirm.

**Tips and limitations:** schedule entries can trigger [Schedule starting soon](#notification-preferences) notifications. Today's entries also appear on the [Today](#today) page.

---

## 8. Common workflows

These examples combine several features. Follow the links for full instructions.

### Organize boards into folders

1. [Create folders](#creating-folders), such as *Work* and *Personal*.
2. [Drag each board onto its folder](#moving-a-board-by-dragging-it-onto-a-folder), or use the board's [... menu](#moving-a-board-with-the--menu).
3. Select a folder's name to hide boards you rarely use. You can still drop boards onto a hidden folder.

### Plan work for the week

1. Open the [Calendar](#78-calendar) and select **Week**.
2. Select a day's number to [add tasks for that day](#creating-a-task-from-a-date).
3. [Drag tasks between days](#rescheduling-a-task-by-dragging) to balance the week.
4. Add fixed time blocks, such as meetings, to the [Schedule](#715-schedule).

### Create and complete a task

1. Open the board and select **Quick add**.
2. Enter a title, category, due date and priority, and select **Add task**.
3. When you start, drag the card to *In Progress*.
4. When you finish, drag it to *Done*, or use **Change status** in the card's menu.

### Find an existing task

1. Press `Ctrl+K` (`Cmd+K` on macOS), or select the **Search** field at the top of the sidebar.
2. Type part of the title.
3. Press `↓` until the task is highlighted, and then press `Enter`.

If it isn't found, open the board and select **Reset** to clear filters, then use **Search tasks...**.

### Filter a board by several priorities

1. Open the board.
2. In **Priority**, select **High** and then **Medium**.
3. Optionally choose **Assigned to me**.

The board now shows your high- and medium-priority tasks. The selection is remembered the next time you open the board.

### Reschedule a task from the Calendar

1. Open the Calendar.
2. Drag the task onto the new day, or select **Change date** next to it and choose the date.

### Share a board with another person

1. Ask the person for their login ID.
2. Open your board and select **Share**.
3. Enter their login ID and select **Invite**.
4. Open a task, choose them under **Assign to**, and select **Save changes**.

They receive notifications for the shared board and the assignment.

### Set up a weekly routine

Board tasks don't repeat, so regular activities belong in the Schedule.

1. Open the [Schedule](#715-schedule) and select **New schedule**.
2. Enter a title, such as *Team meeting*, and choose **Routine**.
3. Choose the days, such as **Weekdays**, and set the start and end time.
4. Select **Save**.
5. Each day, select the entry's checkbox when it is done.

To get an alert before it starts, turn on **Schedule starting soon** in the [notification preferences](#notification-preferences).

### Review notifications

1. Select the bell or open the **Inbox**.
2. Choose **Unread**.
3. Select each notification to open its task, or use **Remind me** or **Complete** on overdue items.
4. Select **Mark all read** when you are done.

### Use the application on a small screen

1. Select the menu button (three lines) at the top left to open the navigation.
2. Select a page or board. The navigation closes automatically.
3. In the Calendar, use the list layout and the **Change date** button to reschedule.

## 9. Roles and permissions reference

These rules are enforced by the application for every board.

| Action | Board owner | Board member |
|---|---|---|
| Open the board and see all its tasks | Yes | Yes |
| Create, edit, duplicate and delete tasks | Yes | Yes |
| Move tasks between statuses | Yes | Yes |
| Move tasks to another board they can open | Yes | Yes |
| Assign and unassign people on the board | Yes | Yes |
| Add subtasks, links, attachments and images | Yes | Yes |
| View task history | Yes | Yes |
| Create categories | Yes | Yes |
| **Create, rename, recolor, reorder, archive, restore or delete statuses** | Yes | No |
| **Set which statuses count as completed** | Yes | No |
| **Rename the board, or change its color or icon** | Yes | No |
| **Reorder, archive, restore or delete the board** | Yes | No |
| **Invite members** | Yes | No |
| **Remove other members** | Yes | No |
| Leave the board | No | Yes |
| **Put the board in a folder** | Yes (own folders) | No |

Anything you create outside boards, such as notes, plans, schedule entries and folders, can be seen and changed only by you.

## 10. Keyboard and interaction reference

| Key or action | Where | What it does |
|---|---|---|
| `Ctrl+K` (Windows, Linux) | Anywhere, except while typing in another field | Puts the cursor in the sidebar's search field; pressed again, leaves it |
| `Cmd+K` (macOS) | Anywhere, except while typing in another field | Puts the cursor in the sidebar's search field; pressed again, leaves it |
| `↑` / `↓` | Search field | Moves through results |
| `Ctrl+Home` / `Ctrl+End` | Search field | Jumps to the first or last result |
| `Enter` | Search field | Opens the highlighted result |
| `Escape` | Search field | Clears the text; pressed again, returns to where you were |
| `Escape` | Dialogs, small-screen navigation | Closes the window or navigation |
| `Tab` | Everywhere | Moves to the next button, link or field. Collapsed sidebar icons show their names when selected. |
| `Space`, arrow keys, `Space` | Sidebar board | Picks up a board, moves it, and drops it onto a folder |
| `Escape` | While dragging a board | Cancels the drag |
| `Enter` | Status name, subtask box, plan item | Saves the name, adds the subtask, or adds or saves the item |
| `Escape` | Status name, plan item | Cancels the edit |
| Double-click | Status name | Starts renaming (board owner) |
| Double-click | Image in task details | Opens the image editor |
| `Enter` | Image editor text tool | Places the text |
| `Ctrl+Z` / `Ctrl+Y` | Image editor | Undo and redo (`Cmd` on macOS) |

## 11. Data, privacy and expected behavior

### What you can see

- You see your own boards and the boards other people shared with you.
- Notes, plans, schedule entries, folders and notification settings are private to you.
- People on a shared board can see all of its tasks, the member list, and each member's name and login ID.

### Files

Attachments, pasted images and screenshots are stored with the task they belong to. Anyone who can open the board can open its files. Before taking a screenshot, check that the screen doesn't show anything you don't want to share.

### Archiving compared with deleting

| | Archive | Delete |
|---|---|---|
| Can be undone | Yes, with **Restore** | No |
| Tasks and files | Kept | Removed |
| Who it affects | Hidden for everyone on the board | Removed for everyone on the board |
| Available for | Boards and statuses | Boards (after archiving), statuses, tasks, notes, plans, schedule entries |

### Sessions and sign-out

- A sign-in lasts up to 30 days in each browser.
- Signing out affects only the current browser.
- Changing your password signs you out everywhere except the current browser.

### Preferences stored in your browser

The sidebar state, board view and filter settings, calendar view, notepad layout, language and theme are saved in your browser. They don't follow you to another browser or device.

## 12. Troubleshooting

### I can't sign in

1. Check your login ID for typing mistakes.
2. Check that Caps Lock is off, and type the password again.
3. If you changed your login ID recently, use the new one.
4. If you forgot your password, contact the person who manages the application. There is no self-service password reset.

### The application says it can't reach the server

1. Check your internet or network connection.
2. Reload the page.
3. If the message continues, contact the person who manages the application. The server may be offline.

### A board or task doesn't appear

1. Check that the board isn't archived: open **Boards** > **Manage boards** > **Archived**.
2. If it's a shared board, ask the owner whether you are still a member.
3. On the board, select **Reset** to clear the filters and choose **All** under **Range**.
4. If the task is a subtask, open its parent task.

### Filters hide a task

1. Look at the **Priority**, **Category** and **Assignee** boxes and the search box.
2. Select **Reset**.
3. If the task still doesn't appear, check the **Range**. **Reset** returns to this month; choose **All** to remove the date filter.

### Search returns no results

1. Type a shorter part of the name.
2. Check the spelling.
3. Remember that subtasks and archived boards are not searched.
4. If you see *Could not search*, check your connection and try again.

### The Calendar doesn't show an expected task

1. Check that the task has a due date. Tasks without one are not shown.
2. Check **Show tasks from board**. Choose **All boards**.
3. Check that you are looking at the right month or week. Select **Today** to return.
4. Subtasks and tasks on archived boards or in archived statuses are not shown.
5. If you see **Not every task is shown**, choose a board or switch to the Week view.

### I can't drag a board into a folder

1. Check that you own the board. Boards with a people icon are shared with you and can't be moved.
2. Check that at least one folder exists.
3. Press on the board and move the pointer a little before expecting the drag to start.
4. If the folder isn't highlighted, the board may already be in that folder.
5. Use the board's **...** menu and **Move to folder** instead.

### Browser notifications don't appear

1. Open **Notification settings** and check that **Desktop notifications** is on.
2. Select **Send a test notification**.
3. If notifications are blocked, allow them in your browser's site settings and reopen the settings.
4. Check that your computer's "do not disturb" or focus mode is off.
5. Check **Quiet hours**.
6. Keep the application open in a browser tab. Notifications are only checked while it is open.

### An attachment upload fails

1. Check that the file is 10 MB or smaller.
2. Check that the file type is accepted. See [Attachments](#attachments).
3. Check that the file isn't empty.
4. Try again. The task is saved even when an upload fails.

### Recent changes aren't visible

1. Reload the page.
2. If you see *Version conflict*, someone changed the item at the same time. Make your change again on the refreshed version.
3. Check the filters on the board.

### The small-screen navigation doesn't close

1. Select the dimmed area beside the navigation.
2. Press `Escape` if you have a keyboard.
3. Select the **Close navigation** button at the top of the navigation.
4. Rotating the device or widening the window to a large-screen size also closes it.

### I can't change statuses or board settings

Only the board owner can. Ask the owner to make the change.

## 13. Limitations and important notes

**Display and result limits**

- A board shows up to 500 tasks at a time. Choose a shorter date range for a complete view.
- The Calendar shows up to 500 tasks per month or week.
- My Tasks loads up to 1,000 tasks.
- Search shows up to five results per type.
- The Today page shows up to six pinned notes.
- The notification list keeps notifications for 30 days.

**Boards and ownership**

- Statuses, board settings and membership can only be changed by the board owner.
- A board's timezone can't be changed after it is created.
- Categories can't be renamed or deleted.
- Folders are personal, can't be nested and can't be reordered.
- Shared boards can't be put into your folders.
- Dragging a board in the sidebar changes only its folder, not its position. Use **Manage boards** to reorder.

**Archived boards**

- Archived boards and their tasks don't appear in Home, My Tasks, the Calendar, Reports, search or notifications.
- Tasks can't be moved to an archived board.

**Notifications**

- Notifications are only checked while the application is open in a browser.
- Desktop notifications need your browser's permission.
- Reminders can only be set from a notification's **Remind me** button, not from the task form.

**Files**

- Attachments can be up to 10 MB each, in the [accepted file types](#attachments).
- Screenshots need Chrome, Edge or Firefox on a computer.

**Other**

- Board tasks don't repeat. Use [Schedule](#715-schedule) routines for regular activities.
- There is no self-service password reset.
- Notes can't be converted into tasks.
- Reports has no filters or export.
- Preferences such as views and filters are saved in each browser separately.

## 14. Additional resources

| Document | For | Contents |
|---|---|---|
| [README.md](README.md) | Developers and people who run the server | Setup, configuration, server address settings, technical interface overview and tests |
| [RHEL8_FRONTEND_DEPLOYMENT.md](RHEL8_FRONTEND_DEPLOYMENT.md) | Server administrators | Deploying the web front end on Red Hat Enterprise Linux 8 |
| [USER_MANUAL.ko.md](USER_MANUAL.ko.md) | Korean-speaking users | This manual in Korean |

## 15. Revision history

| Version | Date | Summary |
|---|---|---|
| 2.2 | 2026-11-25 | Search is now a field at the top of the sidebar; `Ctrl+K` / `Cmd+K` puts the cursor in it. Removed the search window and its quick actions. |
| 2.1 | 2026-11-25 | Removed recurring (repeating) tasks, which the application no longer has. Added a weekly-routine workflow using Schedule. |
| 2.0 | 2026-11-25 | Rewritten and restructured. Added glossary, roles and permissions, collapsible sidebar, notifications, plans, notepad, schedule, keyboard reference, data and privacy, and expanded troubleshooting. Corrected board, task-creation and navigation details. |
| 1.0 | Not recorded | First manual: boards, folders, tasks, filters, Calendar and Search. |
