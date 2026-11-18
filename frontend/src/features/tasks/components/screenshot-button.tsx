import { useEffect, useRef, useState } from "react";
import { Button, Menu, Paper, Portal, Text } from "@mantine/core";

import { t } from "@/i18n";
import {
  canCaptureScreen,
  isCaptureCancelled,
  type ScreenCapture,
  startScreenCapture,
} from "../utils/screen-capture";

const DELAYS = [3, 5, 10];
/** Lets the browser's picker close before the frame is taken, so it is not in the shot. */
const PICKER_CLOSE_MS = 400;

interface ScreenshotButtonProps {
  onCaptured: (image: Blob) => void;
  onError: (message: string) => void;
}

/** "Take screenshot" plus a menu for taking it after a countdown. */
export function ScreenshotButton({ onCaptured, onError }: ScreenshotButtonProps) {
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  // Stop sharing if the form closes mid-countdown.
  useEffect(() => () => cancelRef.current?.(), []);

  async function take(delaySeconds: number) {
    if (!canCaptureScreen()) {
      onError(t("screenshot.unsupported"));
      return;
    }
    setBusy(true);
    let capture: ScreenCapture;
    try {
      capture = await startScreenCapture();
    } catch (error) {
      setBusy(false);
      if (!isCaptureCancelled(error)) onError(t("screenshot.failed"));
      return;
    }

    const originalTitle = document.title;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let over = false;
    const finish = () => {
      over = true;
      if (timer) clearTimeout(timer);
      document.title = originalTitle;
      cancelRef.current = null;
      setCountdown(null);
      setBusy(false);
    };
    cancelRef.current = () => {
      capture.stop();
      finish();
    };
    capture.onEnded(finish);

    const shoot = async () => {
      if (over) return;
      try {
        const image = await capture.grab();
        finish();
        onCaptured(image);
      } catch {
        finish();
        onError(t("screenshot.failed"));
      }
    };

    if (delaySeconds <= 0) {
      timer = setTimeout(() => void shoot(), PICKER_CLOSE_MS);
      return;
    }
    let remaining = delaySeconds;
    const tick = () => {
      if (over) return;
      if (remaining <= 0) {
        document.title = originalTitle;
        setCountdown(null);
        void shoot();
        return;
      }
      setCountdown(remaining);
      // Also in the tab title, which stays visible in the taskbar after switching windows.
      document.title = `(${remaining}) ${originalTitle}`;
      remaining -= 1;
      timer = setTimeout(tick, 1000);
    };
    tick();
  }

  return (
    <>
      <Button.Group>
        <Button size="xs" variant="default" type="button" loading={busy} onClick={() => void take(0)}>
          {t("screenshot.take")}
        </Button>
        <Menu shadow="md" position="bottom-end" withinPortal zIndex={400} disabled={busy}>
          <Menu.Target>
            <Button
              size="xs"
              variant="default"
              type="button"
              px={8}
              disabled={busy}
              aria-label={t("screenshot.delayMenu")}
            >
              ▾
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{t("screenshot.delayMenu")}</Menu.Label>
            {DELAYS.map((seconds) => (
              <Menu.Item key={seconds} onClick={() => void take(seconds)}>
                {t("screenshot.inSeconds", { seconds })}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Button.Group>

      {countdown !== null ? (
        <Portal>
          <Paper
            shadow="lg"
            radius="md"
            p="md"
            withBorder
            role="status"
            className="fixed bottom-6 right-6 flex items-center gap-4"
            style={{ zIndex: 1000 }}
          >
            <Text fw={700} style={{ fontSize: 32, lineHeight: 1, minWidth: 28, textAlign: "center" }}>
              {countdown}
            </Text>
            <div>
              <Text size="sm" fw={500}>
                {t("screenshot.countdownTitle")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("screenshot.countdownHint")}
              </Text>
            </div>
            <Button size="xs" variant="default" type="button" onClick={() => cancelRef.current?.()}>
              {t("common.cancel")}
            </Button>
          </Paper>
        </Portal>
      ) : null}
    </>
  );
}
