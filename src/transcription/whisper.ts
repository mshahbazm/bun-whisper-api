import { join } from "node:path";
import { z } from "zod";
import { runCommand } from "../command";
import { DependencyError, ValidationError } from "../errors";
import type { Segment, TranscriptionOptions } from "./types";

export interface TranscriptionOutput {
  readonly text: string;
  readonly language: string | null;
  readonly segments: readonly Segment[];
}

export type Transcriber = (
  audioPath: string,
  outputDirectory: string,
  options: TranscriptionOptions,
) => Promise<TranscriptionOutput>;

const WhisperOutputSchema = z.object({
  result: z.object({ language: z.string().optional() }).optional(),
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
      { cause: parsed.error },
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

interface WhisperCppOptions {
  readonly cliPath: string;
  readonly modelPath: string;
  readonly threads: number;
  readonly timeoutMs: number;
}

export async function transcribeWithWhisper(
  audioPath: string,
  outputDirectory: string,
  options: TranscriptionOptions,
  config: WhisperCppOptions,
): Promise<TranscriptionOutput> {
  const outputBase = join(outputDirectory, "whisper-result");

  try {
    const { stderr } = await runCommand(
      config.cliPath,
      [
        "--model",
        config.modelPath,
        "--file",
        audioPath,
        "--language",
        options.language,
        "--threads",
        String(config.threads),
        "--output-json-full",
        "--output-file",
        outputBase,
        "--no-prints",
      ],
      config.timeoutMs,
    );
    if (stderr.includes("error: unknown language")) {
      throw new ValidationError(
        "INVALID_LANGUAGE",
        'Language must be "auto" or a language supported by whisper.cpp.',
      );
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new DependencyError("Audio transcription failed.", {
      cause: error,
    });
  }

  const outputFile = Bun.file(`${outputBase}.json`);
  if (!(await outputFile.exists())) {
    throw new DependencyError(
      "whisper.cpp completed without creating its JSON output.",
    );
  }

  try {
    return parseWhisperOutput(await outputFile.json());
  } catch (error) {
    if (error instanceof DependencyError) throw error;
    throw new DependencyError("Could not read whisper.cpp output.", {
      cause: error,
    });
  }
}
