import { ActionIcon, Alert, Loader, Modal, Text } from "@mantine/core";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { t } from "@/i18n";
import { screenHeight } from "@/lib/viewport";
import type { GalleryImage } from "../utils/gallery-images";

interface ImageGalleryProps {
  images: GalleryImage[];
  /** The image on show, or null when the viewer is closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * Mantine modals close on Escape from a window listener, so a modal opened over another (this
 * viewer over the task modal) would close both. Mantine skips events whose target carries this
 * attribute; everything focusable in the viewer has it, and the viewer handles Escape itself.
 */
const KEEP_PARENT_OPEN = { "data-mantine-stop-propagation": "true" } as const;

/**
 * Shows a task's images at full size, one at a time, on a dark stage of fixed size (see
 * `.image-gallery-*` in globals.css): the modal, the stage and the controls keep their size and
 * place whatever the image's size, so stepping through images never moves anything. Images are
 * only scaled down to fit, never up.
 *
 * With two or more images it adds Previous and Next buttons (unavailable at either end), an
 * "n of total" counter, and the Left and Right arrow keys. It closes on Escape, its close button
 * or a click outside, and gives focus back to the thumbnail that opened it.
 */
export function ImageGallery({ images, index, onIndexChange, onClose }: ImageGalleryProps) {
  const opened = index !== null && index >= 0 && index < images.length;
  const current = opened ? images[index] : null;
  const total = images.length;
  const several = total > 1;
  const hasPrevious = opened && index > 0;
  const hasNext = opened && index < total - 1;

  useEffect(() => {
    if (!opened) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft" && several && index > 0) {
        event.preventDefault();
        onIndexChange(index - 1);
      } else if (event.key === "ArrowRight" && several && index < total - 1) {
        event.preventDefault();
        onIndexChange(index + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, onClose, onIndexChange, opened, several, total]);

  const title = current?.alt || t("tasks.imagePreview");

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<span title={title}>{title}</span>}
      centered
      radius="lg"
      zIndex={400}
      closeOnEscape={false}
      classNames={{ inner: "image-gallery-inner", content: "image-gallery-content", title: "image-gallery-title" }}
      // Less spacing than other modals (set by the theme), so the stage can be as tall as possible.
      styles={{
        inner: { paddingTop: "1rem", paddingBottom: "1rem" },
        content: {
          maxHeight: `calc(${screenHeight(100)} - 2rem)`,
          ["--image-gallery-vh" as string]: screenHeight(1),
        } as CSSProperties,
      }}
      closeButtonProps={{ "aria-label": t("common.close"), ...KEEP_PARENT_OPEN }}
    >
      {current ? (
        // Focusable (but not tabbable) so a click on the image keeps focus inside the viewer.
        <div tabIndex={-1} {...KEEP_PARENT_OPEN} className="flex flex-col gap-3 outline-none">
          <div className="image-gallery-stage" data-testid="image-gallery-stage">
            {/* A new element per image, so each one starts in its loading state. */}
            <StageImage key={current.src} image={current} />
          </div>
          {several ? (
            <div className="image-gallery-controls">
              <NavButton
                label={t("tasks.previousImage")}
                available={hasPrevious}
                onClick={() => onIndexChange((index ?? 0) - 1)}
              >
                <path d="M15 18l-6-6 6-6" />
              </NavButton>
              <Text size="sm" c="dimmed" aria-live="polite" className="truncate text-center tabular-nums">
                {t("tasks.imagePosition", { current: (index ?? 0) + 1, total })}
              </Text>
              <NavButton
                label={t("tasks.nextImage")}
                available={hasNext}
                onClick={() => onIndexChange((index ?? 0) + 1)}
              >
                <path d="M9 18l6-6-6-6" />
              </NavButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

/** The image, with a spinner while it loads and a message if it cannot be loaded. */
function StageImage({ image }: { image: GalleryImage }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const ref = useRef<HTMLImageElement>(null);

  // An image already in the browser cache can finish before React listens for `load`.
  useEffect(() => {
    const element = ref.current;
    if (element?.complete && element.naturalWidth > 0) setStatus("loaded");
  }, []);

  if (status === "failed") {
    return (
      <div className="image-gallery-status">
        <Alert color="red" variant="filled" role="alert" className="max-w-full">
          {t("tasks.imageLoadFailed", { name: image.alt || t("tasks.imagePreview") })}
        </Alert>
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- uploaded files, shown at their own size */}
      <img
        ref={ref}
        src={image.src}
        alt={image.alt}
        className="image-gallery-image"
        data-loading={status === "loading" || undefined}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("failed")}
      />
      {status === "loading" ? (
        <div className="image-gallery-status" aria-hidden>
          <Loader color="gray.3" />
        </div>
      ) : null}
    </>
  );
}

/**
 * At the first or last image the button is shown as unavailable but stays focusable, so focus is
 * not lost (and does not leave the modal) when it reaches the end.
 */
function NavButton({
  label,
  available,
  onClick,
  children,
}: {
  label: string;
  available: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <ActionIcon
      variant="default"
      size="lg"
      radius="xl"
      aria-label={label}
      title={label}
      aria-disabled={!available}
      data-disabled={!available || undefined}
      onClick={() => {
        if (available) onClick();
      }}
      {...KEEP_PARENT_OPEN}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </ActionIcon>
  );
}
