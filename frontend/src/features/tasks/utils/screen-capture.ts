/**
 * One still frame from the screen, a window or a tab, through the browser's screen-sharing picker.
 *
 * Web pages cannot read the screen silently: `getDisplayMedia` always asks the user what to share,
 * only works on HTTPS or localhost, and does not exist on phones. Sharing stops as soon as the frame
 * is taken, so the "sharing your screen" bar disappears right away.
 */

/** Chrome's ImageCapture (not in the TypeScript DOM types). It reads the current frame even when this tab is in the background. */
interface ImageCaptureLike {
  grabFrame(): Promise<ImageBitmap>;
}
type ImageCaptureConstructor = new (track: MediaStreamTrack) => ImageCaptureLike;

export function canCaptureScreen(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices) &&
    typeof navigator.mediaDevices.getDisplayMedia === "function"
  );
}

/** True when the user closed the picker or refused sharing; nothing to report then. */
export function isCaptureCancelled(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError");
}

export interface ScreenCapture {
  /** Takes the frame and stops sharing. */
  grab(): Promise<Blob>;
  /** Stops sharing without taking a frame. */
  stop(): void;
  /** Called if the user stops sharing from the browser's own bar before the frame is taken. */
  onEnded(listener: () => void): void;
}

/** Shows the browser's picker; resolves once the user has chosen what to share. */
export async function startScreenCapture(): Promise<ScreenCapture> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const [track] = stream.getVideoTracks();
  // A playing video is the fallback for browsers without ImageCapture (Firefox).
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  const playing = video.play().catch(() => undefined);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    stream.getTracks().forEach((item) => item.stop());
    video.srcObject = null;
  };

  return {
    stop,
    onEnded(listener) {
      track.addEventListener("ended", () => {
        if (!stopped) {
          stop();
          listener();
        }
      });
    },
    async grab() {
      try {
        const Capture = (window as unknown as { ImageCapture?: ImageCaptureConstructor }).ImageCapture;
        if (Capture) {
          try {
            const bitmap = await new Capture(track).grabFrame();
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
            bitmap.close();
            return await canvasToBlob(canvas);
          } catch {
            // Fall through to the video element.
          }
        }
        await playing;
        await waitForVideoFrame(video);
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        return await canvasToBlob(canvas);
      } finally {
        stop();
      }
    },
  };
}

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0 && video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    // Timers (not animation frames) so this still runs while the tab is in the background.
    const started = Date.now();
    const check = () => {
      if (video.videoWidth > 0 && video.readyState >= 2) resolve();
      else if (Date.now() - started > 5000) reject(new Error("No video frame"));
      else setTimeout(check, 50);
    };
    check();
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))), type);
  });
}

/** The bytes of an image already in the text: a local blob, or an uploaded file behind the session cookie. */
export async function fetchImageBlob(src: string): Promise<Blob> {
  const response = await fetch(src, { credentials: src.startsWith("blob:") ? "same-origin" : "include" });
  if (!response.ok) throw new Error(`Image request failed (${response.status})`);
  return response.blob();
}
