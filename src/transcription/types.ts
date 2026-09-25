import { z } from "zod";

export const SegmentSchema = z.object({
  id: z.number().int().nonnegative(),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
  text: z.string(),
});

export type Segment = z.infer<typeof SegmentSchema>;

export const TranscriptSchema = z.object({
  text: z.string(),
  language: z.string().nullable(),
  durationSeconds: z.number().nonnegative(),
  segments: z.array(SegmentSchema),
});

export type Transcript = z.infer<typeof TranscriptSchema>;

export const TranscriptionOptionsSchema = z.object({
  language: z.string().regex(/^(auto|[a-z]{2,3})$/),
});

export type TranscriptionOptions = z.infer<typeof TranscriptionOptionsSchema>;
