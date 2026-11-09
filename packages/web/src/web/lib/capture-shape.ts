import type { CaptureShape } from "./live-bus";

export const SHAPE_PRESETS: { id: NonNullable<CaptureShape["aspect"]>; label: string }[] = [
  { id: "source", label: "As captured" },
  { id: "16:9", label: "16:9" },
  { id: "4:3", label: "4:3" },
  { id: "1:1", label: "1:1 Square" },
  { id: "9:16", label: "9:16 Portrait" },
  { id: "21:9", label: "21:9 Wide" },
  { id: "custom", label: "Custom" },
];

/** Width / height for the chosen shape, or null to keep the capture's own proportions. */
export function shapeRatio(shape: CaptureShape | null | undefined): number | null {
  if (!shape?.aspect || shape.aspect === "source") return null;
  if (shape.aspect === "custom") {
    const r = shape.ratio;
    return r && r > 0.2 && r < 6 ? r : null;
  }
  const [w, h] = shape.aspect.split(":").map(Number);
  return w && h ? w / h : null;
}
