import type { Segment, TranscriptionOptions } from "../domain";

export interface TranscriptionOutput {
  readonly text: string;
  readonly language: string | null;
  readonly segments: readonly Segment[];
}

export interface Transcriber {
  transcribe(
    audioPath: string,
    outputDirectory: string,
    options: TranscriptionOptions,
  ): Promise<TranscriptionOutput>;
}
