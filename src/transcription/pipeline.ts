import { join } from "node:path";
import { ValidationError } from "../errors";
import { normalizeAudio, probeAudio } from "./audio";
import type { Transcript, TranscriptionOptions } from "./types";
import type { Transcriber } from "./whisper";

interface PipelineOptions {
  readonly transcriber: Transcriber;
  readonly maxAudioDurationSeconds: number;
  readonly mediaTimeoutMs: number;
}

export type TranscriptionPipeline = (
  inputPath: string,
  workspace: string,
  options: TranscriptionOptions,
) => Promise<Transcript>;

export function createTranscriptionPipeline(
  options: PipelineOptions,
): TranscriptionPipeline {
  return async (inputPath, workspace, transcriptionOptions) => {
    const metadata = await probeAudio(inputPath, options.mediaTimeoutMs);

    if (metadata.durationSeconds > options.maxAudioDurationSeconds) {
      throw new ValidationError(
        "AUDIO_TOO_LONG",
        `Audio duration exceeds the configured limit of ${options.maxAudioDurationSeconds / 60} minutes.`,
      );
    }

    const normalizedPath = join(workspace, "normalized.wav");
    await normalizeAudio(inputPath, normalizedPath, options.mediaTimeoutMs);

    const output = await options.transcriber(
      normalizedPath,
      workspace,
      transcriptionOptions,
    );

    return {
      text: output.text,
      language: output.language,
      durationSeconds: metadata.durationSeconds,
      segments: [...output.segments],
    };
  };
}
