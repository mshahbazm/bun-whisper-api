import { z } from "zod";
import { ValidationError } from "../errors";
import { runProcess } from "../process";

const ProbeOutputSchema = z.object({
  streams: z.array(
    z.object({
      codec_type: z.string().optional(),
      codec_name: z.string().optional(),
      sample_rate: z.string().optional(),
      channels: z.number().optional(),
    }),
  ),
  format: z.object({
    duration: z.string().optional(),
  }),
});

export interface AudioMetadata {
  readonly durationSeconds: number;
  readonly codec: string | null;
  readonly sampleRate: number | null;
  readonly channels: number | null;
}

export async function probeAudio(
  inputPath: string,
  timeoutMs: number,
): Promise<AudioMetadata> {
  let output: string;

  try {
    ({ stdout: output } = await runProcess(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_type,codec_name,sample_rate,channels",
        "-of",
        "json",
        inputPath,
      ],
      { timeoutMs },
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

  const sampleRate = Number(audioStream.sample_rate);
  return {
    durationSeconds,
    codec: audioStream.codec_name ?? null,
    sampleRate: Number.isFinite(sampleRate) ? sampleRate : null,
    channels: audioStream.channels ?? null,
  };
}

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
