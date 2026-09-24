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

export type JobStatus = "queued" | "processing" | "completed" | "failed";

interface JobBase {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QueuedJob extends JobBase {
  readonly status: "queued";
}

export interface ProcessingJob extends JobBase {
  readonly status: "processing";
}

export interface CompletedJob extends JobBase {
  readonly status: "completed";
  readonly result: Transcript;
}

export interface FailedJob extends JobBase {
  readonly status: "failed";
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export type TranscriptionJob =
  | QueuedJob
  | ProcessingJob
  | CompletedJob
  | FailedJob;
