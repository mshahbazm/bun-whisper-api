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
