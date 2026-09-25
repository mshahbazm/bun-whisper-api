import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { AppError, ValidationError } from "../errors";
import { normalizeAudio, probeAudio } from "./audio";
import type { Transcript } from "./types";
import { TranscriptionOptionsSchema } from "./types";
import type { Transcriber } from "./whisper";

interface TranscribeAudioOptions {
  readonly transcriber: Transcriber;
  readonly workDirectory: string;
  readonly maxUploadBytes: number;
  readonly maxAudioDurationSeconds: number;
  readonly mediaTimeoutMs: number;
  readonly defaultLanguage: string;
}

export async function transcribeAudio(
  file: File,
  language: string | undefined,
  options: TranscribeAudioOptions,
): Promise<Transcript> {
  validateFile(file, options.maxUploadBytes);

  const transcriptionOptions = TranscriptionOptionsSchema.safeParse({
    language: language ?? options.defaultLanguage,
  });
  if (!transcriptionOptions.success) {
    throw new ValidationError(
      "INVALID_LANGUAGE",
      'Language must be "auto" or a supported language code.',
      { cause: transcriptionOptions.error },
    );
  }

  const workspace = await createWorkspace(options.workDirectory);
  const inputPath = join(workspace, "input");

  try {
    await saveUpload(inputPath, file);
    const durationSeconds = await probeAudio(inputPath, options.mediaTimeoutMs);

    if (durationSeconds > options.maxAudioDurationSeconds) {
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
      transcriptionOptions.data,
    );

    return {
      ...output,
      durationSeconds,
    };
  } finally {
    await removeWorkspace(options.workDirectory, workspace).catch((error) => {
      console.error("Failed to clean up transcription workspace", error);
    });
  }
}

function validateFile(file: File, maxUploadBytes: number): void {
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

async function createWorkspace(root: string): Promise<string> {
  await mkdir(root, { recursive: true });
  return mkdtemp(join(root, "request-"));
}

async function removeWorkspace(root: string, directory: string): Promise<void> {
  const resolvedRoot = `${resolve(root)}${sep}`;
  const resolvedDirectory = resolve(directory);

  if (!resolvedDirectory.startsWith(resolvedRoot)) {
    throw new Error(
      "Refusing to remove a directory outside the transcription root.",
    );
  }

  await rm(resolvedDirectory, { recursive: true, force: true });
}
