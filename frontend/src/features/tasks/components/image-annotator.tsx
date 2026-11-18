import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button, ColorSwatch, Group, Portal, Text } from "@mantine/core";

import { t } from "@/i18n";
import { canvasToBlob } from "../utils/screen-capture";

export type AnnotationTool = "crop" | "pen" | "highlighter" | "rect" | "arrow" | "text";

export interface Point {
  x: number;
  y: number;
}

/** Marks are kept in image pixels so they stay put when the window is resized. */
export type Shape =
  | { kind: "pen"; points: Point[]; color: string; width: number; highlight: boolean }
  | { kind: "rect"; from: Point; to: Point; color: string; width: number }
  | { kind: "arrow"; from: Point; to: Point; color: string; width: number }
  | { kind: "text"; at: Point; text: string; color: string; fontSize: number };

interface Snapshot {
  /** The picture so far; cropping bakes the marks into a new base. */
  base: HTMLCanvasElement;
  shapes: Shape[];
}

type Draft = { shape: Shape } | { crop: { from: Point; to: Point } };

const COLORS = ["#fa5252", "#fd7e14", "#fab005", "#40c057", "#228be6", "#000000", "#ffffff"];
/** Stroke and font sizes in screen pixels; scaled to the image when drawn. */
const SIZES = [
  { key: "thin", stroke: 3, font: 16 },
  { key: "medium", stroke: 6, font: 24 },
  { key: "thick", stroke: 12, font: 36 },
] as const;
const TOOLS: AnnotationTool[] = ["crop", "pen", "highlighter", "rect", "arrow", "text"];

/** The largest size that fits the box without enlarging the image. */
export function fitSize(width: number, height: number, boxWidth: number, boxHeight: number) {
  if (width <= 0 || height <= 0 || boxWidth <= 0 || boxHeight <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, boxWidth / width, boxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** The rectangle between two corners, clipped to the image and rounded to whole pixels. */
export function cropRect(from: Point, to: Point, maxWidth: number, maxHeight: number) {
  const left = Math.round(Math.max(0, Math.min(from.x, to.x)));
  const top = Math.round(Math.max(0, Math.min(from.y, to.y)));
  const right = Math.round(Math.min(maxWidth, Math.max(from.x, to.x)));
  const bottom = Math.round(Math.min(maxHeight, Math.max(from.y, to.y)));
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function isDark(hex: string): boolean {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 < 140;
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (shape.kind === "pen") {
    ctx.globalAlpha = shape.highlight ? 0.35 : 1;
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.beginPath();
    const [first, ...rest] = shape.points;
    ctx.moveTo(first.x, first.y);
    if (rest.length === 0) ctx.lineTo(first.x + 0.01, first.y); // A click leaves a dot.
    rest.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  } else if (shape.kind === "rect") {
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.strokeRect(
      Math.min(shape.from.x, shape.to.x),
      Math.min(shape.from.y, shape.to.y),
      Math.abs(shape.to.x - shape.from.x),
      Math.abs(shape.to.y - shape.from.y),
    );
  } else if (shape.kind === "arrow") {
    const dx = shape.to.x - shape.from.x;
    const dy = shape.to.y - shape.from.y;
    const length = Math.hypot(dx, dy);
    if (length >= 1) {
      const angle = Math.atan2(dy, dx);
      const head = Math.min(length, Math.max(shape.width * 4, 14));
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = shape.width;
      ctx.beginPath();
      ctx.moveTo(shape.from.x, shape.from.y);
      // Stop the shaft inside the head so its round end does not poke through the tip.
      ctx.lineTo(shape.to.x - Math.cos(angle) * head * 0.7, shape.to.y - Math.sin(angle) * head * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(shape.to.x, shape.to.y);
      ctx.lineTo(shape.to.x - head * Math.cos(angle - Math.PI / 7), shape.to.y - head * Math.sin(angle - Math.PI / 7));
      ctx.lineTo(shape.to.x - head * Math.cos(angle + Math.PI / 7), shape.to.y - head * Math.sin(angle + Math.PI / 7));
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.font = `bold ${shape.fontSize}px sans-serif`;
    ctx.textBaseline = "top";
    // A contrasting outline keeps the text readable on any background.
    ctx.strokeStyle = isDark(shape.color) ? "#ffffff" : "#000000";
    ctx.lineWidth = Math.max(2, shape.fontSize / 8);
    ctx.strokeText(shape.text, shape.at.x, shape.at.y);
    ctx.fillStyle = shape.color;
    ctx.fillText(shape.text, shape.at.x, shape.at.y);
  }
  ctx.restore();
}

function flatten(snapshot: Snapshot): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = snapshot.base.width;
  canvas.height = snapshot.base.height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(snapshot.base, 0, 0);
    snapshot.shapes.forEach((shape) => drawShape(ctx, shape));
  }
  return canvas;
}

interface ImageAnnotatorProps {
  /** The image to edit; the editor is open while this is set. */
  source: Blob | null;
  /** Start by selecting the area to keep, like a snipping tool. */
  startWithCrop?: boolean;
  onCancel: () => void;
  onDone: (image: Blob) => void;
}

/** Full-screen editor for cropping and marking up an image. */
export function ImageAnnotator({ source, startWithCrop = false, onCancel, onDone }: ImageAnnotatorProps) {
  if (!source) return null;
  return (
    <Portal>
      <AnnotatorView source={source} startWithCrop={startWithCrop} onCancel={onCancel} onDone={onDone} />
    </Portal>
  );
}

function AnnotatorView({
  source,
  startWithCrop,
  onCancel,
  onDone,
}: {
  source: Blob;
  startWithCrop: boolean;
  onCancel: () => void;
  onDone: (image: Blob) => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const [tool, setTool] = useState<AnnotationTool>(startWithCrop ? "crop" : "pen");
  const [color, setColor] = useState(COLORS[0]);
  const [sizeIndex, setSizeIndex] = useState(1);
  const [display, setDisplay] = useState({ width: 0, height: 0 });
  const [textDraft, setTextDraft] = useState<{ at: Point; value: string } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draftRef = useRef<Draft | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(source);
    const image = new Image();
    image.onload = () => {
      const base = document.createElement("canvas");
      base.width = image.naturalWidth;
      base.height = image.naturalHeight;
      base.getContext("2d")?.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      setSnapshot({ base, shapes: [] });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setLoadFailed(true);
    };
    image.src = url;
  }, [source]);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  const base = snapshot?.base ?? null;
  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!base || !stage) return;
    setDisplay(fitSize(base.width, base.height, stage.clientWidth, stage.clientHeight));
  }, [base]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  /** Image pixels per screen pixel. */
  const imageScale = base && display.width ? base.width / display.width : 1;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    if (canvas.width !== snapshot.base.width) canvas.width = snapshot.base.width;
    if (canvas.height !== snapshot.base.height) canvas.height = snapshot.base.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(snapshot.base, 0, 0);
    snapshot.shapes.forEach((shape) => drawShape(ctx, shape));
    const draft = draftRef.current;
    if (draft && "shape" in draft) drawShape(ctx, draft.shape);
    if (tool === "crop") {
      // Dim everything outside the selection, like a snipping tool.
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      if (draft && "crop" in draft) {
        const area = cropRect(draft.crop.from, draft.crop.to, canvas.width, canvas.height);
        ctx.rect(area.x, area.y, area.width, area.height);
        ctx.fill("evenodd");
        ctx.setLineDash([6 * imageScale, 4 * imageScale]);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5 * imageScale;
        ctx.strokeRect(area.x, area.y, area.width, area.height);
      } else {
        ctx.fill();
      }
      ctx.restore();
    }
  }, [snapshot, tool, imageScale]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function commit(next: Snapshot) {
    if (!snapshot) return;
    setUndoStack((stack) => [...stack, snapshot]);
    setRedoStack([]);
    setSnapshot(next);
  }

  function undo() {
    if (!snapshot || undoStack.length === 0) return;
    setRedoStack((stack) => [...stack, snapshot]);
    setSnapshot(undoStack[undoStack.length - 1]);
    setUndoStack((stack) => stack.slice(0, -1));
  }

  function redo() {
    if (!snapshot || redoStack.length === 0) return;
    setUndoStack((stack) => [...stack, snapshot]);
    setSnapshot(redoStack[redoStack.length - 1]);
    setRedoStack((stack) => stack.slice(0, -1));
  }

  /** The snapshot with the text being typed added, if any. */
  function withTextDraft(current: Snapshot): Snapshot {
    const text = textDraft?.value.trim();
    if (!textDraft || !text) return current;
    return {
      ...current,
      shapes: [
        ...current.shapes,
        { kind: "text", at: textDraft.at, text, color, fontSize: SIZES[sizeIndex].font * imageScale },
      ],
    };
  }

  function commitText() {
    if (!snapshot || !textDraft) return;
    const next = withTextDraft(snapshot);
    setTextDraft(null);
    if (next !== snapshot) commit(next);
  }

  function chooseTool(next: AnnotationTool) {
    commitText();
    draftRef.current = null;
    setTool(next);
  }

  function toImagePoint(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (event.currentTarget.width / rect.width),
      y: (event.clientY - rect.top) * (event.currentTarget.height / rect.height),
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || !snapshot) return;
    const point = toImagePoint(event);
    if (tool === "text") {
      event.preventDefault(); // Keep the click from taking focus away from the new text box.
      commitText();
      setTextDraft({ at: point, value: "" });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke = SIZES[sizeIndex].stroke * imageScale;
    if (tool === "crop") draftRef.current = { crop: { from: point, to: point } };
    else if (tool === "pen" || tool === "highlighter") {
      const highlight = tool === "highlighter";
      draftRef.current = {
        shape: { kind: "pen", points: [point], color, width: highlight ? stroke * 3 : stroke, highlight },
      };
    } else draftRef.current = { shape: { kind: tool, from: point, to: point, color, width: stroke } };
    redraw();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const draft = draftRef.current;
    if (!draft) return;
    const point = toImagePoint(event);
    if ("crop" in draft) draft.crop.to = point;
    else if (draft.shape.kind === "pen") draft.shape.points.push(point);
    else if (draft.shape.kind === "rect" || draft.shape.kind === "arrow") draft.shape.to = point;
    redraw();
  }

  function handlePointerUp() {
    const draft = draftRef.current;
    draftRef.current = null;
    if (!draft || !snapshot) return;
    if ("crop" in draft) {
      const area = cropRect(draft.crop.from, draft.crop.to, snapshot.base.width, snapshot.base.height);
      if (area.width < 4 || area.height < 4) {
        redraw();
        return;
      }
      const flat = flatten(snapshot);
      const cropped = document.createElement("canvas");
      cropped.width = area.width;
      cropped.height = area.height;
      cropped.getContext("2d")?.drawImage(flat, -area.x, -area.y);
      commit({ base: cropped, shapes: [] });
      setTool("pen");
      return;
    }
    const shape = draft.shape;
    if ((shape.kind === "rect" || shape.kind === "arrow") && Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y) < 3) {
      redraw();
      return;
    }
    commit({ ...snapshot, shapes: [...snapshot.shapes, shape] });
  }

  async function finish() {
    if (!snapshot) return;
    setSaving(true);
    try {
      onDone(await canvasToBlob(flatten(withTextDraft(snapshot))));
    } catch {
      setSaving(false);
      setLoadFailed(true);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Keep keys (Escape especially) from reaching the task dialog underneath.
    event.stopPropagation();
    if (event.target instanceof HTMLInputElement) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if ((event.ctrlKey || event.metaKey) && (key === "y" || (key === "z" && event.shiftKey))) {
      event.preventDefault();
      redo();
    }
  }

  const textFont = SIZES[sizeIndex].font;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t("annotator.title")}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 flex flex-col outline-none"
      style={{ zIndex: 1000, background: "rgba(24, 24, 27, 0.96)", color: "#f4f4f5" }}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-2">
        <Group gap={4} wrap="wrap">
          {TOOLS.map((item) => (
            <Button
              key={item}
              size="xs"
              type="button"
              variant={tool === item ? "filled" : "default"}
              onClick={() => chooseTool(item)}
            >
              {t(`annotator.tools.${item}`)}
            </Button>
          ))}
        </Group>
        <Group gap={6} wrap="nowrap" aria-label={t("annotator.color")}>
          {COLORS.map((swatch) => (
            <ColorSwatch
              key={swatch}
              component="button"
              type="button"
              color={swatch}
              size={22}
              aria-label={swatch}
              aria-pressed={color === swatch}
              onClick={() => setColor(swatch)}
              style={{
                cursor: "pointer",
                outline: color === swatch ? "2px solid #2dd4bf" : "1px solid rgba(255,255,255,0.3)",
                outlineOffset: 2,
              }}
            />
          ))}
        </Group>
        <Group gap={4} wrap="nowrap" aria-label={t("annotator.size")}>
          {SIZES.map((size, index) => (
            <Button
              key={size.key}
              size="xs"
              type="button"
              variant={sizeIndex === index ? "filled" : "default"}
              onClick={() => setSizeIndex(index)}
            >
              {t(`annotator.sizes.${size.key}`)}
            </Button>
          ))}
        </Group>
        <Group gap={4} wrap="nowrap">
          <Button size="xs" type="button" variant="default" onClick={undo} disabled={undoStack.length === 0}>
            {t("annotator.undo")}
          </Button>
          <Button size="xs" type="button" variant="default" onClick={redo} disabled={redoStack.length === 0}>
            {t("annotator.redo")}
          </Button>
        </Group>
        <Group gap={6} wrap="nowrap" ml="auto">
          <Button size="xs" type="button" variant="default" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button size="xs" type="button" onClick={() => void finish()} loading={saving} disabled={!snapshot}>
            {t("annotator.done")}
          </Button>
        </Group>
      </div>

      {tool === "crop" && snapshot ? (
        <div className="flex flex-wrap items-center justify-center gap-3 px-4 pt-2">
          <Text size="sm">{t("annotator.cropHint")}</Text>
          <Button size="xs" type="button" variant="light" onClick={() => chooseTool("pen")}>
            {t("annotator.useWholeImage")}
          </Button>
        </div>
      ) : null}

      <div ref={stageRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        {loadFailed ? (
          <Text size="sm">{t("annotator.loadFailed")}</Text>
        ) : snapshot && display.width > 0 ? (
          <div className="relative" style={{ width: display.width, height: display.height }}>
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="block shadow-lg"
              style={{
                width: display.width,
                height: display.height,
                touchAction: "none",
                cursor: tool === "text" ? "text" : "crosshair",
              }}
            />
            {textDraft ? (
              <input
                autoFocus
                value={textDraft.value}
                placeholder={t("annotator.textPlaceholder")}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setTextDraft((current) => (current ? { ...current, value } : current));
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitText();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setTextDraft(null);
                  }
                }}
                onBlur={commitText}
                className="absolute bg-transparent outline-none"
                style={{
                  left: textDraft.at.x / imageScale,
                  top: textDraft.at.y / imageScale,
                  font: `bold ${textFont}px sans-serif`,
                  lineHeight: 1,
                  color,
                  padding: 0,
                  border: "1px dashed rgba(255,255,255,0.7)",
                  minWidth: "8rem",
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
