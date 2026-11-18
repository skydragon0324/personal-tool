import { cropRect, fitSize } from "./image-annotator";
import { datedImageFile, editedImageFile } from "./task-form";

describe("image annotator", () => {
  it("fits the image in the window without enlarging it", () => {
    expect(fitSize(1920, 1080, 960, 1000)).toEqual({ width: 960, height: 540 });
    expect(fitSize(1000, 2000, 1000, 500)).toEqual({ width: 250, height: 500 });
    expect(fitSize(300, 200, 1000, 1000)).toEqual({ width: 300, height: 200 });
    expect(fitSize(300, 200, 0, 1000)).toEqual({ width: 0, height: 0 });
  });

  it("crops to the dragged area in any direction, kept inside the image", () => {
    expect(cropRect({ x: 50.4, y: 80 }, { x: 10, y: 20.6 }, 100, 100)).toEqual({ x: 10, y: 21, width: 40, height: 59 });
    expect(cropRect({ x: -20, y: -5 }, { x: 150, y: 40 }, 100, 100)).toEqual({ x: 0, y: 0, width: 100, height: 40 });
  });
});

describe("screenshot and edited image names", () => {
  const AT = new Date(2026, 10, 17, 14, 3, 9);
  const png = new Blob(["x"], { type: "image/png" });

  it("names screenshots with the time they were taken", () => {
    const file = datedImageFile(png, "Screenshot", 0, AT);
    expect(file.name).toBe("Screenshot 2026-11-17 14.03.09.png");
    expect(file.type).toBe("image/png");
  });

  it("marks edited images once, however often they are edited", () => {
    expect(editedImageFile(png, "Floor plan").name).toBe("Floor plan (edited).png");
    expect(editedImageFile(png, "Floor plan (edited)").name).toBe("Floor plan (edited).png");
    expect(editedImageFile(png, "").name).toBe("Pasted image (edited).png");
  });
});
