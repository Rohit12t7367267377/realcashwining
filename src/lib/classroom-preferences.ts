import { z } from "zod";

export const BOARD_PRESETS = [
  { id: "green", label: "Classic Green Board" },
  { id: "white", label: "Modern White Board" },
  { id: "midnight", label: "Midnight Dark Board" },
  { id: "blue", label: "Soft Blue Board" },
  { id: "cream", label: "Warm Cream Board" },
  { id: "contrast", label: "High-Contrast Study Mode" },
] as const;

const color = z.string().regex(/^#[\da-fA-F]{6}$/, "Choose a valid color");
export const classroomPreferencesSchema = z.object({
  preset: z.enum(["green", "white", "midnight", "blue", "cream", "contrast"]).default("white"),
  fontSize: z.number().min(14).max(28).default(18),
  font: z.enum(["sans", "serif", "mono"]).default("sans"),
  lineSpacing: z.number().min(1.3).max(2.2).default(1.7),
  zoom: z.number().min(0.8).max(1.5).default(1),
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  background: color.nullable().default(null),
  foreground: color.nullable().default(null),
  accent: color.nullable().default(null),
}).strict();

export type ClassroomPreferences = z.infer<typeof classroomPreferencesSchema>;
export const DEFAULT_CLASSROOM_PREFERENCES = classroomPreferencesSchema.parse({});

export function parseClassroomPreferences(value: unknown): ClassroomPreferences {
  const result = classroomPreferencesSchema.safeParse(value);
  return result.success ? result.data : { ...DEFAULT_CLASSROOM_PREFERENCES };
}

export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => {
    const values = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return (values[0] ?? 0) * 0.2126 + (values[1] ?? 0) * 0.7152 + (values[2] ?? 0) * 0.0722;
  };
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}