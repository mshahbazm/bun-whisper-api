import { ValidationError } from "../errors";
import { runProcess } from "../infrastructure/process";

export async function normalizeAudio(
  inputPath: string,
  outputPath: string,
  timeoutMs: number,
): Promise<void> {
  try {
    await runProcess(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        outputPath,
      ],
      { timeoutMs },
    );
  } catch (error) {
    throw new ValidationError(
      "UNSUPPORTED_AUDIO",
      "The provided audio could not be converted for transcription.",
      { cause: error },
    );
  }
}
