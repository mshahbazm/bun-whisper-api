import { z } from "zod";
import { runCommand } from "../command";
import { ValidationError } from "../errors";

const ProbeOutputSchema = z.object({
  streams: z.array(
    z.object({
      codec_type: z.string().optional(),
    }),
  ),
  format: z.object({
    duration: z.string().optional(),
  }),
});

export async function probeAudio(
  inputPath: string,
  timeoutMs: number,
): Promise<number> {
  let output: string;

  try {
    ({ stdout: output } = await runCommand(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_type",
        "-of",
        "json",
        inputPath,
      ],
      timeoutMs,
    ));
  } catch (error) {
    throw new ValidationError(
      "INVALID_AUDIO",
      "The provided file could not be read as audio.",
      { cause: error },
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(output);
  } catch (error) {
    throw new ValidationError(
      "INVALID_AUDIO",
      "The provided file returned invalid media metadata.",
      { cause: error },
    );
  }

  const parsed = ProbeOutputSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new ValidationError(
      "INVALID_AUDIO",
      "The provided file has invalid media metadata.",
      { cause: parsed.error },
    );
  }

  const audioStream = parsed.data.streams.find(
    (stream) => stream.codec_type === "audio",
  );
  const durationSeconds = Number(parsed.data.format.duration);

  if (
    !audioStream ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    throw new ValidationError(
      "INVALID_AUDIO",
      "The provided file does not contain a valid audio stream.",
    );
  }

  return durationSeconds;
}

export async function normalizeAudio(
  inputPath: string,
  outputPath: string,
  timeoutMs: number,
): Promise<void> {
  try {
    await runCommand(
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
      timeoutMs,
    );
  } catch (error) {
    throw new ValidationError(
      "UNSUPPORTED_AUDIO",
      "The provided audio could not be converted for transcription.",
      { cause: error },
    );
  }
}
