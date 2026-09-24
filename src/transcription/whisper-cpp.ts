import { join } from "node:path";
import { DependencyError } from "../errors";
import { runProcess } from "../infrastructure/process";
import type { Transcriber, TranscriptionOutput } from "./transcriber";
import { parseWhisperOutput } from "./whisper-output";

interface WhisperCppOptions {
  readonly cliPath: string;
  readonly modelPath: string;
  readonly threads: number;
  readonly timeoutMs: number;
}

export class WhisperCppTranscriber implements Transcriber {
  public constructor(private readonly config: WhisperCppOptions) {}

  public async transcribe(
    audioPath: string,
    outputDirectory: string,
    options: { readonly language: string },
  ): Promise<TranscriptionOutput> {
    const outputBase = join(outputDirectory, "whisper-result");

    try {
      await runProcess(
        this.config.cliPath,
        [
          "--model",
          this.config.modelPath,
          "--file",
          audioPath,
          "--language",
          options.language,
          "--threads",
          String(this.config.threads),
          "--output-json-full",
          "--output-file",
          outputBase,
          "--no-prints",
        ],
        { timeoutMs: this.config.timeoutMs },
      );
    } catch (error) {
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
      if (error instanceof DependencyError) {
        throw error;
      }

      throw new DependencyError("Could not read whisper.cpp output.", {
        cause: error,
      });
    }
  }
}
