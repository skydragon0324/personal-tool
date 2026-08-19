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
import { todayISO } from "@/lib/dates";
import { descriptionToDoc } from "../utils/description-to-doc";
import { TaskRichTextEditor } from "./task-rich-text-editor";

interface PendingFile {
  id: string;
  file: File;
  previewUrl?: string;
  error?: string;
}

interface TaskFormProps {
  initial?: TaskDetail | null;
  columnId: string;
  dueDate: string;
  submitting?: boolean;
  onSubmit: (payload: TaskCreate, pendingFiles: File[]) => Promise<void>;
  onCancel?: () => void;
  onUploadExisting?: (file: File) => Promise<{ download_url: string | null }>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
  uploading?: boolean;
}

export function TaskForm({
  initial,
  columnId,
  dueDate,
  submitting = false,
  onSubmit,
  onCancel,
  onUploadExisting,
  onDeleteAttachment,
  uploading,
}: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [taskDueDate, setTaskDueDate] = useState(dueDate || todayISO());
  const [content, setContent] = useState<TiptapJSON | null>(null);
  const [links, setLinks] = useState<TaskLinkInput[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setPriority(initial.priority);
      setTaskDueDate(initial.due_date);
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
    } else {
      setTitle("");
      setPriority("medium");
      setTaskDueDate(dueDate || todayISO());
      setContent(null);
      setLinks([]);
    }
    setPendingFiles([]);
    setError(null);
  }, [initial, dueDate]);

  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
  }, []);

  const imageAttachments = useMemo(
    () => (initial?.attachments ?? []).filter((a) => a.attachment_kind === "image"),
    [initial],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    try {
      await onSubmit(
        {
          column_id: initial?.column_id ?? columnId,
          title: title.trim(),
          description: null,
          content,
          due_date: taskDueDate,
          priority,
          links: links.map((link, index) => ({
            ...link,
            position: index,
          })),
        },
        pendingFiles.map((item) => item.file),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
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

  async function insertUploadedImage(file: File) {
    if (!onUploadExisting || !initial) {
      addPendingFiles([file]);
      return;
    }
    try {
      const uploaded = await onUploadExisting(file);
      if (
        uploaded.download_url &&
        editorRef.current &&
        !editorRef.current.isDestroyed
      ) {
        editorRef.current.chain().focus().setImage({ src: uploaded.download_url }).run();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    }
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
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DatePickerInput
              label="Due date"
              value={taskDueDate}
              onChange={(value) => {
                if (typeof value === "string" && value) setTaskDueDate(value);
              }}
              valueFormat="MMM D, YYYY"
            />
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
          </SimpleGrid>
        </section>

        <Divider />

        <section className="space-y-3">
          <Title order={5}>Details</Title>
          <TaskRichTextEditor
            value={content}
            onChange={setContent}
            onEditorReady={handleEditorReady}
          />
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
                    label="Label"
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
                No reference links yet.
              </Text>
            ) : null}
          </Stack>
        </section>

        <Divider />

        <section className="space-y-3">
          <Group justify="space-between">
            <Title order={5}>Attachments</Title>
            <Group gap="xs">
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
              {initial ? (
                <FileButton
                  accept="image/*"
                  onChange={(file) => {
                    if (file && !Array.isArray(file)) void insertUploadedImage(file);
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
              ) : null}
            </Group>
          </Group>

          {pendingFiles.length > 0 ? (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Waiting to upload after save
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
                        aria-label="Delete attachment"
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

      <div className="sticky bottom-0 mt-4 flex flex-wrap gap-2 border-t border-slate-200 bg-white pt-3">
        <Button type="submit" loading={submitting}>
          {initial ? "Save changes" : "Add task"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="default" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
