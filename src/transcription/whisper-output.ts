import { z } from "zod";
import { DependencyError } from "../errors";
import type { TranscriptionOutput } from "./transcriber";

const WhisperOutputSchema = z.object({
  result: z
    .object({
      language: z.string().optional(),
    })
    .optional(),
  transcription: z.array(
    z.object({
      offsets: z.object({
        from: z.number().nonnegative(),
        to: z.number().nonnegative(),
      }),
      text: z.string(),
    }),
  ),
});

export function parseWhisperOutput(value: unknown): TranscriptionOutput {
  const parsed = WhisperOutputSchema.safeParse(value);
  if (!parsed.success) {
    throw new DependencyError(
      "whisper.cpp returned an invalid JSON response.",
      {
        cause: parsed.error,
      },
    );
  }

  const segments = parsed.data.transcription.map((segment, id) => ({
    id,
    startSeconds: segment.offsets.from / 1000,
    endSeconds: segment.offsets.to / 1000,
    text: segment.text.trim(),
  }));

  return {
    text: segments
      .map((segment) => segment.text)
      .filter(Boolean)
      .join(" "),
    language: parsed.data.result?.language ?? null,
    segments,
  };
}
