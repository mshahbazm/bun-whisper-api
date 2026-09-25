import { z } from "zod";

export interface Segment {
  readonly id: number;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly text: string;
}

export interface Transcript {
  readonly text: string;
  readonly language: string | null;
  readonly durationSeconds: number;
  readonly segments: readonly Segment[];
}

export const TranscriptionOptionsSchema = z.object({
  language: z.string().regex(/^(auto|[a-z]{2,3})$/),
});

export type TranscriptionOptions = z.infer<typeof TranscriptionOptionsSchema>;
