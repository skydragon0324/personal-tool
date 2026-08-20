"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Select } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
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
  Priority,
  TaskCreate,
  TaskDetail,
  TaskLinkInput,
  TiptapJSON,
} from "@/features/board/types";
import { useCategories, useCreateCategory } from "@/features/board/hooks/use-categories";
import { todayISO } from "@/lib/dates";
import { CategoryCombobox } from "./category-combobox";
import { descriptionToDoc } from "../utils/description-to-doc";
import {
  createPendingImageId,
  type PendingInlineImage,
  replacePendingImageSrc,
  sanitizeContentForPersist,
} from "../utils/pending-images";
import { TaskRichTextEditor } from "./task-rich-text-editor";

interface PendingFile {
  id: string;
  file: File;
  previewUrl?: string;
  error?: string;
}

interface TaskFormProps {
  initial?: TaskDetail | null;
  boardId: string;
  columnId: string;
  dueDate: string;
  submitting?: boolean;
  onSubmit: (payload: TaskCreate, pendingFiles: File[], existingId?: string) => Promise<TaskDetail>;
  onCancel?: () => void;
  onUploadFile?: (taskId: string, file: File) => Promise<{ download_url: string | null }>;
  onPatchContent?: (taskId: string, content: TiptapJSON) => Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
  uploading?: boolean;
}

export function TaskForm({
  initial,
  boardId,
  columnId,
  dueDate,
  submitting = false,
  onSubmit,
  onCancel,
  onUploadFile,
  onPatchContent,
  onDeleteAttachment,
  uploading,
}: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [taskStartDate, setTaskStartDate] = useState(initial?.start_date ?? todayISO());
  const [taskDueDate, setTaskDueDate] = useState(initial?.due_date ?? todayISO());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [content, setContent] = useState<TiptapJSON | null>(null);
  const [links, setLinks] = useState<TaskLinkInput[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingInlineImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedTaskId, setSavedTaskId] = useState<string | null>(initial?.id ?? null);
  const [altDraft, setAltDraft] = useState("");
  const [altFile, setAltFile] = useState<File | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const categoriesQuery = useCategories(boardId);
  const createCategory = useCreateCategory(boardId);
  const categories = categoriesQuery.data ?? [];

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setPriority(initial.priority);
      setTaskStartDate(initial.start_date ?? initial.due_date);
      setTaskDueDate(initial.due_date);
      setCategoryId(initial.category.id);
      setContent(
        initial.content ??
          (initial.description ? descriptionToDoc(initial.description) : null),
      );
      setLinks(
        initial.links.map((link) => ({
          id: link.id,
          label: link.label,
          url: link.url,
          position: link.position,
        })),
      );
      setSavedTaskId(initial.id);
    } else {
      setTitle("");
      setPriority("medium");
      setTaskStartDate(todayISO());
      setTaskDueDate(todayISO());
      setCategoryId(null);
      setContent(null);
      setLinks([]);
      setSavedTaskId(null);
    }
    setPendingFiles([]);
    setPendingImages([]);
    setError(null);
  }, [initial, dueDate]);

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
      setError(err instanceof Error ? err.message : "Image upload failed");
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
        if (!onUploadFile) throw new Error("Uploads are not available");
        const uploaded = await onUploadFile(taskId, image.file);
        if (!uploaded.download_url) throw new Error("Upload URL was not returned");
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
      setError(err instanceof Error ? err.message : "Image retry failed");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Enter a title.");
      return;
    }
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    if (taskStartDate > taskDueDate) {
      setError("Start date must be on or before due date.");
      return;
    }
    try {
      const persistableContent = sanitizeContentForPersist(content);
      const created = await onSubmit(
        {
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
        },
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
          setError("The task was saved, but some inline images failed to upload.");
          return;
        }
      }
      onCancel?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the task");
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
    <form onSubmit={handleSubmit} className="flex max-h-[min(85vh,900px)] flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <section className="space-y-3">
          <Title order={5}>Basics</Title>
          <TextInput
            label="Title"
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
              label="Start date"
              value={taskStartDate}
              onChange={(value) => {
                if (typeof value === "string" && value) setTaskStartDate(value);
              }}
              valueFormat="MMM D, YYYY"
            />
            <DatePickerInput
              label="Due date"
              value={taskDueDate}
              onChange={(value) => {
                if (typeof value === "string" && value) setTaskDueDate(value);
              }}
              valueFormat="MMM D, YYYY"
            />
          </SimpleGrid>
          <Select
              label="Priority"
              data={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
              ]}
              value={priority}
              onChange={(value) => {
                if (value) setPriority(value as Priority);
              }}
            />
        </section>

        <Divider />

        <section className="space-y-3">
          <Title order={5}>Details</Title>
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
                    Insert image
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
                  title={image.error ? "Inline image failed" : "Will upload after save"}
                >
                  <Group justify="space-between">
                    <Text size="sm">{image.alt || image.file.name}</Text>
                    {image.error ? (
                      <Button
                        size="xs"
                        type="button"
                        onClick={() => void retryInlineImage(image.pendingId)}
                      >
                        Retry
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
            <Title order={5}>Reference links</Title>
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
              Add link
            </Button>
          </Group>
          <Stack gap="sm">
            {links.map((link, index) => (
              <Paper key={link.id ?? index} withBorder p="sm" radius="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="Name"
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
                    label="URL"
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
                    Remove
                  </Button>
                </Group>
              </Paper>
            ))}
            {links.length === 0 ? (
              <Text size="sm" c="dimmed">
                No reference links.
              </Text>
            ) : null}
          </Stack>
        </section>

        <Divider />

        <section className="space-y-3">
          <Group justify="space-between">
            <Title order={5}>Attachments</Title>
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
                  Add files
                </Button>
              )}
            </FileButton>
          </Group>

          {pendingFiles.length > 0 ? (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Will upload after save
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
                      Remove
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
                          Download
                        </Text>
                      ) : null}
                    </div>
                    {onDeleteAttachment ? (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => void onDeleteAttachment(attachment.id)}
                        aria-label="Remove attachment"
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
                Image gallery
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
          {initial || savedTaskId ? "Save changes" : "Add task"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="default" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>

      <Modal
        opened={altFile !== null}
        onClose={() => setAltFile(null)}
        title="Image alt text"
        size="sm"
      >
        <Stack>
          <TextInput
            label="Alt text"
            value={altDraft}
            onChange={(event) => setAltDraft(event.currentTarget.value)}
            description="Describe the image for accessibility."
          />
          <Group justify="flex-end">
            <Button variant="default" type="button" onClick={() => setAltFile(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmImageAlt}>
              Insert
            </Button>
          </Group>
        </Stack>
      </Modal>
    </form>
  );
}
