import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MultiSelect, Select } from "@mantine/core";
import {
  Alert,
  Button,
  FileButton,
  Group,
  Image,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Divider,
  ActionIcon,
} from "@mantine/core";
import type { Editor } from "@tiptap/react";

import type {
  EditScope,
  Priority,
  TaskCreate,
  TaskDetail,
  TaskLinkInput,
  TiptapJSON,
} from "@/features/board/types";
import { DatePickerInput } from "@/lib/date-pickers";
import { useBoardMembers } from "@/features/board/hooks/use-board-members";
import { useCategories, useCreateCategory } from "@/features/board/hooks/use-categories";
import { todayISO } from "@/lib/dates";
import { CategoryCombobox } from "./category-combobox";
import {
  RecurrenceFields,
  buildRecurrenceInput,
  presetFromRecurrence,
  repeatUnitFromRecurrence,
  type RepeatEnd,
  type RepeatPreset,
  type RepeatUnit,
} from "./recurrence-fields";
import { RecurrenceScopeDialog } from "./recurrence-scope-dialog";
import { descriptionToDoc } from "../utils/description-to-doc";
import {
  createPendingImageId,
  type PendingInlineImage,
  replacePendingImageSrc,
  sanitizeContentForPersist,
} from "../utils/pending-images";
import { TaskRichTextEditor } from "./task-rich-text-editor";
import { t } from "@/i18n";

interface PendingFile {
  id: string;
  file: File;
  previewUrl?: string;
  error?: string;
}

interface FormValues {
  title: string;
  priority: Priority;
  startDate: string;
  dueDate: string;
  categoryId: string | null;
  content: TiptapJSON | null;
  links: TaskLinkInput[];
  assigneeIds: string[];
  repeatPreset: RepeatPreset;
  customInterval: number;
  customUnit: RepeatUnit;
  customWeekdays: number[];
  repeatEnd: RepeatEnd;
  untilDate: string | null;
  occurrenceCount: number;
}

/** What the form shows for a task (or a blank new one) before any edits. */
function formValuesFrom(initial: TaskDetail | null | undefined): FormValues {
  if (!initial) {
    return {
      title: "",
      priority: "medium",
      startDate: todayISO(),
      dueDate: todayISO(),
      categoryId: null,
      content: null,
      links: [],
      assigneeIds: [],
      repeatPreset: "none",
      customInterval: 1,
      customUnit: "weeks",
      customWeekdays: [0, 1, 2, 3, 4],
      repeatEnd: "never",
      untilDate: null,
      occurrenceCount: 10,
    };
  }
  const recurrence = initial.recurrence;
  return {
    title: initial.title,
    priority: initial.priority,
    startDate: initial.start_date ?? initial.due_date,
    dueDate: initial.due_date,
    categoryId: initial.category.id,
    content: initial.content ?? (initial.description ? descriptionToDoc(initial.description) : null),
    links: initial.links.map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      position: link.position,
    })),
    assigneeIds: (initial.assignees ?? []).map((person) => person.id),
    repeatPreset: presetFromRecurrence(recurrence),
    customInterval: recurrence?.interval ?? 1,
    customUnit: repeatUnitFromRecurrence(recurrence),
    customWeekdays: recurrence?.weekdays?.length ? recurrence.weekdays : [0, 1, 2, 3, 4],
    repeatEnd: recurrence?.until_date ? "date" : recurrence?.occurrence_limit ? "count" : "never",
    untilDate: recurrence?.until_date ?? null,
    occurrenceCount: recurrence?.occurrence_limit ?? 10,
  };
}

interface TaskFormProps {
  initial?: TaskDetail | null;
  boardId: string;
  columnId: string;
  dueDate: string;
  submitting?: boolean;
  onSubmit: (payload: TaskCreate, pendingFiles: File[], existingId?: string) => Promise<TaskDetail>;
  onCancel?: () => void;
  /** Called after a successful save; leaves the form without asking about unsaved edits. Defaults to onCancel. */
  onSaved?: () => void;
  onUploadFile?: (taskId: string, file: File) => Promise<{ download_url: string | null }>;
  onPatchContent?: (taskId: string, content: TiptapJSON) => Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
  uploading?: boolean;
  /** Called when the form gains or loses unsaved edits. */
  onDirtyChange?: (dirty: boolean) => void;
}

export function TaskForm({
  initial,
  boardId,
  columnId,
  dueDate,
  submitting = false,
  onSubmit,
  onCancel,
  onSaved,
  onUploadFile,
  onPatchContent,
  onDeleteAttachment,
  uploading,
  onDirtyChange,
}: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [repeatPreset, setRepeatPreset] = useState<RepeatPreset>("none");
  const [customInterval, setCustomInterval] = useState(1);
  const [customUnit, setCustomUnit] = useState<RepeatUnit>("weeks");
  const [customWeekdays, setCustomWeekdays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [repeatEnd, setRepeatEnd] = useState<RepeatEnd>("never");
  const [untilDate, setUntilDate] = useState<string | null>(null);
  const [occurrenceCount, setOccurrenceCount] = useState(10);
  const [pendingScopePayload, setPendingScopePayload] = useState<TaskCreate | null>(null);
  const [pendingStopPayload, setPendingStopPayload] = useState<TaskCreate | null>(null);
  const [taskStartDate, setTaskStartDate] = useState(initial?.start_date ?? todayISO());
  const [taskDueDate, setTaskDueDate] = useState(initial?.due_date ?? todayISO());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [content, setContent] = useState<TiptapJSON | null>(null);
  const [links, setLinks] = useState<TaskLinkInput[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingInlineImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedTaskId, setSavedTaskId] = useState<string | null>(initial?.id ?? null);
  const [altDraft, setAltDraft] = useState("");
  const [altFile, setAltFile] = useState<File | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const categoriesQuery = useCategories(boardId);
  const createCategory = useCreateCategory(boardId);
  const membersQuery = useBoardMembers(boardId);
  const people = useMemo(() => membersQuery.data?.people ?? [], [membersQuery.data]);
  const shared = people.length > 1;
  const assigneeOptions = useMemo(() => {
    const options = people.map((person) => ({ value: person.user_id, label: person.display_name }));
    // Keep current assignees selectable even if the member list has not loaded yet.
    for (const current of initial?.assignees ?? []) {
      if (!options.some((option) => option.value === current.id)) {
        options.push({ value: current.id, label: current.display_name });
      }
    }
    return options;
  }, [initial?.assignees, people]);
  const categories = categoriesQuery.data ?? [];

  // Reset the form only when the task identity changes. A refetch of the same task (e.g. after an
  // image upload or attachment delete) yields a new `initial` object and must not wipe unsaved edits.
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const initialId = initial?.id ?? null;

  // The form as last reset; anything different from it is an unsaved edit.
  const [baseline, setBaseline] = useState(() => JSON.stringify(formValuesFrom(initial)));

  useEffect(() => {
    const values = formValuesFrom(initialRef.current);
    setBaseline(JSON.stringify(values));
    setTitle(values.title);
    setPriority(values.priority);
    setTaskStartDate(values.startDate);
    setTaskDueDate(values.dueDate);
    setCategoryId(values.categoryId);
    setContent(values.content);
    setLinks(values.links);
    setSavedTaskId(initialRef.current?.id ?? null);
    setAssigneeIds(values.assigneeIds);
    setRepeatPreset(values.repeatPreset);
    setCustomInterval(values.customInterval);
    setCustomUnit(values.customUnit);
    setCustomWeekdays(values.customWeekdays);
    setRepeatEnd(values.repeatEnd);
    setUntilDate(values.untilDate);
    setOccurrenceCount(values.occurrenceCount);
    setPendingFiles([]);
    setPendingImages([]);
    setError(null);
  }, [initialId, dueDate]);

  // Unsaved edits: the form differs from what it was reset to, or files are waiting to upload.
  const currentValues: FormValues = {
    title,
    priority,
    startDate: taskStartDate,
    dueDate: taskDueDate,
    categoryId,
    content,
    links,
    assigneeIds,
    repeatPreset,
    customInterval,
    customUnit,
    customWeekdays,
    repeatEnd,
    untilDate,
    occurrenceCount,
  };
  const dirty = JSON.stringify(currentValues) !== baseline || pendingFiles.length > 0 || pendingImages.length > 0;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
  }, []);

  const imageAttachments = useMemo(
    () => (initial?.attachments ?? []).filter((a) => a.attachment_kind === "image"),
    [initial],
  );

  function insertLocalImage(file: File, alt: string) {
    const pendingId = createPendingImageId();
    const blobUrl = URL.createObjectURL(file);
    const image: PendingInlineImage = { pendingId, file, alt, blobUrl };
    setPendingImages((current) => [...current, image]);
    if (editorRef.current && !editorRef.current.isDestroyed) {
            editorRef.current
              .chain()
              .focus()
              .insertContent({
                type: "image",
                attrs: { src: blobUrl, alt, pendingId },
              })
              .run();
    }
  }

  async function insertUploadedImage(file: File, alt: string) {
    const taskId = savedTaskId ?? initial?.id;
    if (!onUploadFile || !taskId) {
      insertLocalImage(file, alt);
      return;
    }
    try {
      const uploaded = await onUploadFile(taskId, file);
      if (
        uploaded.download_url &&
        editorRef.current &&
        !editorRef.current.isDestroyed
      ) {
        editorRef.current
          .chain()
          .focus()
          .setImage({ src: uploaded.download_url, alt })
          .run();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("taskForm.imageUploadFailed"));
    }
  }

  function handleImageFile(file: File | null) {
    if (!file) return;
    setAltFile(file);
    setAltDraft(file.name.replace(/\.[^.]+$/, ""));
  }

  function confirmImageAlt() {
    if (!altFile) return;
    const alt = altDraft.trim() || altFile.name;
    const file = altFile;
    setAltFile(null);
    const taskId = savedTaskId ?? initial?.id;
    if (taskId && onUploadFile) {
      void insertUploadedImage(file, alt);
    } else {
      insertLocalImage(file, alt);
    }
  }

  async function uploadInlineImages(
    taskId: string,
    currentContent: TiptapJSON | null,
    images: PendingInlineImage[],
  ): Promise<{ content: TiptapJSON | null; failed: PendingInlineImage[] }> {
    const replacements: { pendingId: string; src: string }[] = [];
    const failed: PendingInlineImage[] = [];
    for (const image of images) {
      try {
        if (!onUploadFile) throw new Error(t("taskForm.uploadsUnavailable"));
        const uploaded = await onUploadFile(taskId, image.file);
        if (!uploaded.download_url) throw new Error(t("taskForm.noUploadUrl"));
        replacements.push({ pendingId: image.pendingId, src: uploaded.download_url });
      } catch (err) {
        failed.push({
          ...image,
          error: err instanceof Error ? err.message : "Image upload failed",
        });
      }
    }
    let nextLocal = currentContent;
    for (const item of replacements) {
      nextLocal = replacePendingImageSrc(nextLocal, item.pendingId, item.src);
    }
    const persistable = sanitizeContentForPersist(nextLocal);
    if (onPatchContent && (replacements.length > 0 || images.length > 0)) {
      await onPatchContent(taskId, persistable ?? { type: "doc", content: [] });
    }
    return { content: nextLocal, failed };
  }

  async function retryInlineImage(pendingId: string) {
    const image = pendingImages.find((item) => item.pendingId === pendingId);
    const taskId = savedTaskId ?? initial?.id;
    if (!image || !taskId) return;
    setError(null);
    try {
      const { content: nextContent, failed } = await uploadInlineImages(taskId, content, [
        image,
      ]);
      setContent(nextContent);
      setPendingImages((current) => {
        const remaining = current.filter((item) => item.pendingId !== pendingId);
        return failed.length ? [...remaining, ...failed] : remaining;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("taskForm.imageRetryFailed"));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError(t("taskForm.enterTitle"));
      return;
    }
    if (!categoryId) {
      setError(t("taskForm.chooseCategory"));
      return;
    }
    if (taskStartDate > taskDueDate) {
      setError(t("taskForm.startAfterDue"));
      return;
    }
    try {
      const persistableContent = sanitizeContentForPersist(content);
      const recurrence = buildRecurrenceInput({
        preset: repeatPreset,
        startDate: taskStartDate,
        customInterval,
        customUnit,
        customWeekdays,
        end: repeatEnd,
        untilDate,
        occurrenceCount,
      });
      const payload: TaskCreate = {
        column_id: initial?.column_id ?? columnId,
        category_id: categoryId,
        title: title.trim(),
        description: null,
        content: persistableContent,
        start_date: taskStartDate,
        due_date: taskDueDate,
        priority,
        links: links.map((link, index) => ({
          ...link,
          position: index,
        })),
        recurrence,
        assignee_ids: assigneeIds,
      };
      if (initial?.recurrence?.series_id) {
        if (recurrence === null) {
          setPendingStopPayload(payload);
          return;
        }
        setPendingScopePayload(payload);
        return;
      }
      await submitPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("taskForm.couldNotSave"));
    }
  }

  async function submitPayload(payload: TaskCreate) {
    try {
      const created = await onSubmit(
        payload,
        pendingFiles.map((item) => item.file),
        savedTaskId ?? initial?.id ?? undefined,
      );
      setSavedTaskId(created.id);
      setPendingFiles([]);

      if (pendingImages.length) {
        const { content: nextContent, failed } = await uploadInlineImages(
          created.id,
          content,
          pendingImages,
        );
        setContent(nextContent);
        setPendingImages(failed);
        if (failed.length) {
          setError(t("taskForm.inlineImagesFailed"));
          return;
        }
      }
      (onSaved ?? onCancel)?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("taskForm.couldNotSave"));
    }
  }

  function addPendingFiles(files: File[]) {
    setPendingFiles((current) => [
      ...current,
      ...files.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      })),
    ]);
  }

  return (
    // Fills its container; only the fields area scrolls so the action buttons stay visible.
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <section className="space-y-3">
          <Title order={5}>{t("taskForm.basics")}</Title>
          <TextInput
            label={t("taskForm.title")}
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            maxLength={160}
            required
          />
          <CategoryCombobox
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            creating={createCategory.isPending}
            required
            onCreate={async (input) => createCategory.mutateAsync(input)}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DatePickerInput
              label={t("taskForm.startDate")}
              value={taskStartDate}
              onChange={(value) => {
                if (typeof value === "string" && value) setTaskStartDate(value);
              }}
              valueFormat="MMM D, YYYY"
            />
            <DatePickerInput
              label={t("taskForm.dueDate")}
              value={taskDueDate}
              onChange={(value) => {
                if (typeof value === "string" && value) setTaskDueDate(value);
              }}
              valueFormat="MMM D, YYYY"
            />
          </SimpleGrid>
          <MultiSelect
            label={t("task.assignTo")}
            description={
              initial?.recurrence?.series_id
                ? t("taskForm.assignHintRepeating")
                : shared
                  ? t("taskForm.assignHintShared")
                  : t("taskForm.assignHintSolo")
            }
            placeholder={assigneeIds.length ? undefined : t("filters.unassigned")}
            data={assigneeOptions}
            value={assigneeIds}
            onChange={setAssigneeIds}
            clearable
            searchable
            hidePickedOptions
            maw={520}
          />
          {initial?.parent ? null : (
            <RecurrenceFields
              preset={repeatPreset}
              onPresetChange={setRepeatPreset}
              customInterval={customInterval}
              onCustomIntervalChange={setCustomInterval}
              customUnit={customUnit}
              onCustomUnitChange={setCustomUnit}
              customWeekdays={customWeekdays}
              onCustomWeekdaysChange={setCustomWeekdays}
              end={repeatEnd}
              onEndChange={setRepeatEnd}
              untilDate={untilDate}
              onUntilDateChange={setUntilDate}
              occurrenceCount={occurrenceCount}
              onOccurrenceCountChange={setOccurrenceCount}
            />
          )}
          <Select
              label={t("task.priority")}
              data={[
                { value: "low", label: t("task.priorityLow") },
                { value: "medium", label: t("task.priorityMedium") },
                { value: "high", label: t("task.priorityHigh") },
              ]}
              value={priority}
              onChange={(value) => {
                if (value) setPriority(value as Priority);
              }}
            />
        </section>

        <Divider />

        <section className="space-y-3">
          <Title order={5}>{t("taskForm.details")}</Title>
          <TaskRichTextEditor
            value={content}
            onChange={setContent}
            onEditorReady={handleEditorReady}
            extraToolbar={
              <FileButton
                accept="image/*"
                onChange={(file) => {
                  if (file && !Array.isArray(file)) handleImageFile(file);
                }}
              >
                {(props) => (
                  <Button
                    {...props}
                    size="xs"
                    variant="default"
                    type="button"
                    loading={uploading}
                  >
                    {t("taskForm.insertImage")}
                  </Button>
                )}
              </FileButton>
            }
          />
          {pendingImages.length > 0 ? (
            <Stack gap="xs">
              {pendingImages.map((image) => (
                <Alert
                  key={image.pendingId}
                  color={image.error ? "red" : "yellow"}
                  title={image.error ? t("taskForm.inlineImageFailed") : t("taskForm.willUploadAfterSave")}
                >
                  <Group justify="space-between">
                    <Text size="sm">{image.alt || image.file.name}</Text>
                    {image.error ? (
                      <Button
                        size="xs"
                        type="button"
                        onClick={() => void retryInlineImage(image.pendingId)}
                      >
                        {t("common.retry")}
                      </Button>
                    ) : null}
                  </Group>
                </Alert>
              ))}
            </Stack>
          ) : null}
        </section>

        <Divider />

        <section className="space-y-3">
          <Group justify="space-between">
            <Title order={5}>{t("taskForm.referenceLinks")}</Title>
            <Button
              size="xs"
              variant="light"
              type="button"
              onClick={() =>
                setLinks((current) => [
                  ...current,
                  { label: "", url: "https://", position: current.length },
                ])
              }
            >
              {t("taskForm.addLink")}
            </Button>
          </Group>
          <Stack gap="sm">
            {links.map((link, index) => (
              <Paper key={link.id ?? index} withBorder p="sm" radius="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label={t("taskForm.linkName")}
                    value={link.label}
                    onChange={(e) => {
                      const label = e.currentTarget.value;
                      setLinks((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, label } : item,
                        ),
                      );
                    }}
                  />
                  <TextInput
                    label={t("taskForm.linkUrl")}
                    value={link.url}
                    onChange={(e) => {
                      const url = e.currentTarget.value;
                      setLinks((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, url } : item,
                        ),
                      );
                    }}
                  />
                </SimpleGrid>
                <Group justify="flex-end" mt="xs">
                  <Button
                    size="xs"
                    color="red"
                    variant="subtle"
                    type="button"
                    onClick={() =>
                      setLinks((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    {t("taskForm.remove")}
                  </Button>
                </Group>
              </Paper>
            ))}
            {links.length === 0 ? (
              <Text size="sm" c="dimmed">
                {t("taskForm.noReferenceLinks")}
              </Text>
            ) : null}
          </Stack>
        </section>

        <Divider />

        <section className="space-y-3">
          <Group justify="space-between">
            <Title order={5}>{t("taskForm.attachments")}</Title>
            <FileButton
              multiple
              onChange={(files) => {
                if (!files) return;
                const list = Array.isArray(files) ? files : [files];
                addPendingFiles(list);
              }}
            >
              {(props) => (
                <Button {...props} size="xs" variant="light" type="button">
                  {t("taskForm.addFiles")}
                </Button>
              )}
            </FileButton>
          </Group>

          {pendingFiles.length > 0 ? (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                {t("taskForm.willUploadAfterSave")}
              </Text>
              {pendingFiles.map((item) => (
                <Paper key={item.id} withBorder p="xs" radius="md">
                  <Group justify="space-between">
                    <Text size="sm">{item.file.name}</Text>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      type="button"
                      onClick={() =>
                        setPendingFiles((current) =>
                          current.filter((f) => f.id !== item.id),
                        )
                      }
                    >
                      {t("taskForm.remove")}
                    </Button>
                  </Group>
                  {item.error ? (
                    <Alert color="red" mt="xs">
                      {item.error}
                    </Alert>
                  ) : null}
                  {item.previewUrl ? (
                    <Image src={item.previewUrl} alt={item.file.name} mt="xs" h={80} w="auto" />
                  ) : null}
                </Paper>
              ))}
            </Stack>
          ) : null}

          {initial?.attachments?.length ? (
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {initial.attachments.map((attachment) => (
                <Paper key={attachment.id} withBorder p="xs" radius="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text size="sm" fw={500}>
                        {attachment.original_name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {attachment.attachment_kind} · {attachment.size_bytes} bytes
                      </Text>
                      {attachment.download_url ? (
                        <Text
                          component="a"
                          href={attachment.download_url}
                          size="xs"
                          c="teal"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("taskForm.download")}
                        </Text>
                      ) : null}
                    </div>
                    {onDeleteAttachment ? (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => void onDeleteAttachment(attachment.id)}
                        aria-label={t("taskForm.removeAttachment")}
                      >
                        ×
                      </ActionIcon>
                    ) : null}
                  </Group>
                </Paper>
              ))}
            </SimpleGrid>
          ) : null}

          {imageAttachments.length > 0 ? (
            <div>
              <Text size="sm" fw={500} mb="xs">
                {t("taskForm.imageGallery")}
              </Text>
              <SimpleGrid cols={{ base: 2, sm: 3 }}>
                {imageAttachments.map((image) =>
                  image.download_url ? (
                    <Image
                      key={image.id}
                      src={image.download_url}
                      alt={image.original_name}
                      radius="md"
                      h={100}
                      fit="cover"
                    />
                  ) : null,
                )}
              </SimpleGrid>
            </div>
          ) : null}
        </section>
      </div>

      {error ? (
        <Alert color="red" mt="md">
          {error}
        </Alert>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--app-border)] pt-3">
        <Button type="submit" loading={submitting || createCategory.isPending}>
          {initial || savedTaskId ? t("taskForm.saveChanges") : t("taskForm.addTask")}
        </Button>
        {onCancel ? (
          <Button type="button" variant="default" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        ) : null}
      </div>

      <Modal
        opened={altFile !== null}
        onClose={() => setAltFile(null)}
        title={t("taskForm.imageAltTitle")}
        size="sm"
      >
        <Stack>
          <TextInput
            label={t("taskForm.altText")}
            value={altDraft}
            onChange={(event) => setAltDraft(event.currentTarget.value)}
            description={t("taskForm.altTextHint")}
          />
          <Group justify="flex-end">
            <Button variant="default" type="button" onClick={() => setAltFile(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={confirmImageAlt}>
              {t("taskForm.insert")}
            </Button>
          </Group>
        </Stack>
      </Modal>
      <RecurrenceScopeDialog
        open={pendingScopePayload !== null}
        mode="edit"
        taskTitle={title}
        submitting={submitting}
        onClose={() => setPendingScopePayload(null)}
        onConfirm={(scope) => {
          if (!pendingScopePayload) return;
          const next: TaskCreate = {
            ...pendingScopePayload,
            edit_scope: scope as EditScope,
            recurrence: scope === "this" ? undefined : pendingScopePayload.recurrence,
          };
          setPendingScopePayload(null);
          void submitPayload(next);
        }}
      />
      <Modal
        opened={pendingStopPayload !== null}
        onClose={() => setPendingStopPayload(null)}
        title={t("taskForm.stopRepeatingTitle")}
        size="sm"
      >
        <Stack>
          <Text size="sm">
            {t("taskForm.stopRepeatingBody")}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" type="button" onClick={() => setPendingStopPayload(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              loading={submitting}
              onClick={() => {
                if (!pendingStopPayload) return;
                const next: TaskCreate = {
                  ...pendingStopPayload,
                  recurrence: null,
                };
                delete next.edit_scope;
                setPendingStopPayload(null);
                void submitPayload(next);
              }}
            >
              {t("taskForm.stopRepeating")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </form>
  );
}
