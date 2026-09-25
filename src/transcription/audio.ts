import { join } from "node:path";
import { z } from "zod";
import { runCommand } from "../command";
import { AppError, ValidationError } from "../errors";

interface PrepareAudioOptions {
  readonly maxUploadBytes: number;
  readonly maxDurationSeconds: number;
  readonly timeoutMs: number;
}

interface PreparedAudio {
  readonly path: string;
  readonly durationSeconds: number;
}

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

async function probeAudio(
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

async function normalizeAudio(
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

export async function prepareAudio(
  file: File,
  workspace: string,
  options: PrepareAudioOptions,
): Promise<PreparedAudio> {
  validateUpload(file, options.maxUploadBytes);

  const inputPath = join(workspace, "input");
  await saveUpload(inputPath, file);

  const durationSeconds = await probeAudio(inputPath, options.timeoutMs);
  if (durationSeconds > options.maxDurationSeconds) {
    throw new ValidationError(
      "AUDIO_TOO_LONG",
      `Audio duration exceeds the configured limit of ${options.maxDurationSeconds / 60} minutes.`,
    );
  }

  const normalizedPath = join(workspace, "normalized.wav");
  await normalizeAudio(inputPath, normalizedPath, options.timeoutMs);

  return { path: normalizedPath, durationSeconds };
}

function validateUpload(file: File, maxUploadBytes: number): void {
  if (file.size === 0) {
    throw new ValidationError(
      "EMPTY_FILE",
      "The provided audio file is empty.",
    );
  }

  if (file.size > maxUploadBytes) {
    throw new AppError(
      "UPLOAD_TOO_LARGE",
      "The provided audio file exceeds the configured size limit.",
      413,
    );
  }
}

async function saveUpload(path: string, file: File): Promise<void> {
  try {
    await Bun.write(path, file);
  } catch (error) {
    throw new AppError(
      "UPLOAD_WRITE_FAILED",
      "The provided audio file could not be stored temporarily.",
      500,
      { cause: error },
    );
  }
}
