import { namePastedImage } from "./task-form";
import { imageFilesFrom } from "./task-rich-text-editor";

const AT = new Date(2026, 10, 5, 9, 4, 7);

describe("pasted images", () => {
  it("gives screenshots a dated name and keeps real file names", () => {
    const shot = new File(["x"], "image.png", { type: "image/png" });
    expect(namePastedImage(shot, 0, AT).name).toBe("Pasted image 2026-11-05 09.04.07.png");
    expect(namePastedImage(shot, 1, AT).name).toBe("Pasted image 2026-11-05 09.04.07 (2).png");
    expect(namePastedImage(new File(["x"], "", { type: "image/jpeg" }), 0, AT).name).toBe(
      "Pasted image 2026-11-05 09.04.07.jpg",
    );
    const named = new File(["x"], "floor-plan.png", { type: "image/png" });
    expect(namePastedImage(named, 0, AT)).toBe(named);
  });

  it("takes only image files from a paste or drop", () => {
    const image = new File(["x"], "a.png", { type: "image/png" });
    const text = new File(["x"], "notes.txt", { type: "text/plain" });
    const data = { files: [image, text] } as unknown as DataTransfer;
    expect(imageFilesFrom(data)).toEqual([image]);
    expect(imageFilesFrom(null)).toEqual([]);
  });
});
