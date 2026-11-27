import { MantineProvider, Modal, createTheme } from "@mantine/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useState } from "react";

import type { GalleryImage } from "../utils/gallery-images";
import { ImageGallery } from "./image-gallery";

const IMAGES: GalleryImage[] = [
  { src: "/one.png", alt: "One" },
  { src: "/two.png", alt: "Two" },
  { src: "/three.png", alt: "Three" },
];

/** A thumbnail per image that opens the gallery on it, like the task views do. */
function Harness({ images, onClose }: { images: GalleryImage[]; onClose?: () => void }) {
  const [index, setIndex] = useState<number | null>(null);
  return createElement(
    "div",
    null,
    images.map((image, i) =>
      createElement("button", { key: image.src, type: "button", onClick: () => setIndex(i) }, `Open ${image.alt}`),
    ),
    createElement(ImageGallery, {
      images,
      index,
      onIndexChange: setIndex,
      onClose: () => {
        setIndex(null);
        onClose?.();
      },
    }),
  );
}

function renderGallery(images = IMAGES, onClose?: () => void) {
  render(createElement(MantineProvider, { env: "test" }, createElement(Harness, { images, onClose })));
}

const shownSrc = () => screen.getByRole("dialog").querySelector("img")?.getAttribute("src");

describe("ImageGallery", () => {
  it("opens at the image that was clicked and shows its position", async () => {
    const user = userEvent.setup();
    renderGallery();
    await user.click(screen.getByRole("button", { name: "Open Two" }));

    const dialog = await screen.findByRole("dialog");
    expect(shownSrc()).toBe("/two.png");
    expect(dialog).toHaveTextContent("Two");
    expect(dialog).toHaveTextContent("2 of 3");
  });

  it("steps through the images with Previous and Next, unavailable at either end", async () => {
    const user = userEvent.setup();
    renderGallery();
    await user.click(screen.getByRole("button", { name: "Open One" }));
    await screen.findByRole("dialog");

    const previous = screen.getByRole("button", { name: "Previous image" });
    const next = screen.getByRole("button", { name: "Next image" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(next).toHaveAttribute("aria-disabled", "false");

    await user.click(next);
    expect(shownSrc()).toBe("/two.png");
    expect(screen.getByRole("dialog")).toHaveTextContent("2 of 3");
    await user.click(next);
    expect(shownSrc()).toBe("/three.png");
    expect(next).toHaveAttribute("aria-disabled", "true");
    await user.click(next);
    expect(shownSrc()).toBe("/three.png");

    await user.click(previous);
    expect(shownSrc()).toBe("/two.png");
    expect(screen.getByRole("dialog")).toHaveTextContent("2 of 3");
  });

  it("moves with the arrow keys and stops at either end", async () => {
    const user = userEvent.setup();
    renderGallery();
    await user.click(screen.getByRole("button", { name: "Open Two" }));
    await screen.findByRole("dialog");

    await user.keyboard("{ArrowRight}");
    expect(shownSrc()).toBe("/three.png");
    await user.keyboard("{ArrowRight}");
    expect(shownSrc()).toBe("/three.png");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(shownSrc()).toBe("/one.png");
    await user.keyboard("{ArrowLeft}");
    expect(shownSrc()).toBe("/one.png");
    expect(screen.getByRole("dialog")).toHaveTextContent("1 of 3");
  });

  it("closes on Escape and gives focus back to the thumbnail", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    renderGallery(IMAGES, onClose);
    const thumbnail = screen.getByRole("button", { name: "Open Three" });
    await user.click(thumbnail);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(thumbnail).toHaveFocus());
  });

  it("closes with its close button", async () => {
    const user = userEvent.setup();
    renderGallery();
    await user.click(screen.getByRole("button", { name: "Open One" }));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes on a click outside the image", async () => {
    const user = userEvent.setup();
    renderGallery();
    await user.click(screen.getByRole("button", { name: "Open One" }));
    await screen.findByRole("dialog");

    await user.click(document.querySelector(".mantine-Modal-overlay") as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the same stage and controls while stepping through images", async () => {
    const user = userEvent.setup();
    renderGallery();
    await user.click(screen.getByRole("button", { name: "Open One" }));
    await screen.findByRole("dialog");

    const stage = screen.getByTestId("image-gallery-stage");
    const previous = screen.getByRole("button", { name: "Previous image" });
    const next = screen.getByRole("button", { name: "Next image" });
    const controls = next.parentElement;
    expect(stage).toHaveClass("image-gallery-stage");
    expect(controls).toHaveClass("image-gallery-controls");
    // The stage's size comes from CSS alone: nothing about the image is set on it.
    expect(stage.getAttribute("style")).toBeNull();

    await user.click(next);
    await user.keyboard("{ArrowRight}");
    expect(shownSrc()).toBe("/three.png");
    expect(screen.getByTestId("image-gallery-stage")).toBe(stage);
    expect(stage.getAttribute("style")).toBeNull();
    expect(screen.getByRole("button", { name: "Previous image" })).toBe(previous);
    expect(screen.getByRole("button", { name: "Next image" })).toBe(next);
    expect(next.parentElement).toBe(controls);

    // The image is only limited by the stage, never given a size of its own.
    const image = stage.querySelector("img") as HTMLImageElement;
    expect(image).toHaveClass("image-gallery-image");
    expect(image.getAttribute("style")).toBeNull();
    expect(image).not.toHaveAttribute("width");
    expect(image).not.toHaveAttribute("height");
    expect(image).toHaveAttribute("alt", "Three");
  });

  it("uses less spacing than the app's other modals, so the stage fits the screen", async () => {
    // The app theme gives every modal 5% spacing above and below and a 90% max height.
    const theme = createTheme({
      components: {
        Modal: Modal.extend({
          styles: () => ({ inner: { paddingTop: "5vh", paddingBottom: "5vh" }, content: { maxHeight: "90vh" } }),
        }),
      },
    });
    render(
      createElement(
        MantineProvider,
        { env: "test", theme },
        createElement(ImageGallery, { images: IMAGES, index: 0, onIndexChange: jest.fn(), onClose: jest.fn() }),
      ),
    );
    await screen.findByRole("dialog");

    const content = document.querySelector(".image-gallery-content") as HTMLElement;
    const inner = document.querySelector(".image-gallery-inner") as HTMLElement;
    expect(inner.style.paddingTop).toBe("1rem");
    expect(inner.style.paddingBottom).toBe("1rem");
    expect(content.style.maxHeight).toBe("calc(100vh - 2rem)");
    expect(content.style.getPropertyValue("--image-gallery-vh")).toBe("1vh");
  });

  it("shows a spinner until each image loads, and a message if one fails", async () => {
    const user = userEvent.setup();
    renderGallery();
    await user.click(screen.getByRole("button", { name: "Open One" }));
    await screen.findByRole("dialog");
    const stage = screen.getByTestId("image-gallery-stage");

    const first = stage.querySelector("img") as HTMLImageElement;
    expect(first).toHaveAttribute("data-loading");
    expect(stage.querySelector(".mantine-Loader-root")).not.toBeNull();
    fireEvent.load(first);
    expect(first).not.toHaveAttribute("data-loading");
    expect(stage.querySelector(".mantine-Loader-root")).toBeNull();

    // The next image starts loading again, in the same stage.
    await user.click(screen.getByRole("button", { name: "Next image" }));
    const second = stage.querySelector("img") as HTMLImageElement;
    expect(second.getAttribute("src")).toBe("/two.png");
    expect(second).toHaveAttribute("data-loading");
    fireEvent.error(second);
    expect(within(stage).getByRole("alert")).toHaveTextContent("Could not load “Two”.");
    expect(stage.querySelector("img")).toBeNull();

    // The controls still work after a failed image.
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(shownSrc()).toBe("/three.png");
    expect(within(stage).queryByRole("alert")).toBeNull();
  });

  it("shows a single image without slideshow controls", async () => {
    const user = userEvent.setup();
    renderGallery([IMAGES[0]]);
    await user.click(screen.getByRole("button", { name: "Open One" }));

    const dialog = await screen.findByRole("dialog");
    expect(shownSrc()).toBe("/one.png");
    // Same fixed stage as a slideshow.
    expect(screen.getByTestId("image-gallery-stage")).toHaveClass("image-gallery-stage");
    expect(dialog.querySelector(".image-gallery-controls")).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous image" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next image" })).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("1 of 1");
    await user.keyboard("{ArrowRight}");
    expect(shownSrc()).toBe("/one.png");
  });
});
