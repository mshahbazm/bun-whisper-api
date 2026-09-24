import { join } from "node:path";
import { normalizeAudio } from "./audio/normalize";
import { probeAudio } from "./audio/probe";
import type { Transcript, TranscriptionOptions } from "./domain";
import { ValidationError } from "./errors";
import type { Transcriber } from "./transcription/transcriber";

interface PipelineOptions {
  readonly transcriber: Transcriber;
  readonly maxAudioDurationSeconds: number;
  readonly mediaTimeoutMs: number;
}

export class TranscriptionPipeline {
  public constructor(private readonly options: PipelineOptions) {}

  public async run(
    inputPath: string,
    workspace: string,
    transcriptionOptions: TranscriptionOptions,
  ): Promise<Transcript> {
    const metadata = await probeAudio(inputPath, this.options.mediaTimeoutMs);

    if (metadata.durationSeconds > this.options.maxAudioDurationSeconds) {
      throw new ValidationError(
        "AUDIO_TOO_LONG",
        `Audio duration exceeds the configured limit of ${this.options.maxAudioDurationSeconds / 60} minutes.`,
      );
    }

    const normalizedPath = join(workspace, "normalized.wav");
    await normalizeAudio(
      inputPath,
      normalizedPath,
      this.options.mediaTimeoutMs,
    );

    const output = await this.options.transcriber.transcribe(
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
  }
}
