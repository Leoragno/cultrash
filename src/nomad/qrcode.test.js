import { describe, it, expect } from "vitest";
import { qrPath } from "./qrcode";

describe("qrPath", () => {
  it("produce una matrice quadrata con un path non vuoto", () => {
    const { path, size, margin } = qrPath("https://cultrash.example/?room=ABCD&mode=nomad");
    expect(size).toBeGreaterThan(10);
    expect(margin).toBe(2);
    expect(path.length).toBeGreaterThan(0);
    expect(path.startsWith("M")).toBe(true);
  });

  it("testi diversi producono matrici diverse", () => {
    const a = qrPath("ABCD");
    const b = qrPath("WXYZ");
    expect(a.path).not.toBe(b.path);
  });
});
