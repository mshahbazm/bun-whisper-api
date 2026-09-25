import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { ValidationError } from "../errors";
import { prepareAudio } from "./audio";
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

  try {
    const preparedAudio = await prepareAudio(file, workspace, {
      maxUploadBytes: options.maxUploadBytes,
      maxDurationSeconds: options.maxAudioDurationSeconds,
      timeoutMs: options.mediaTimeoutMs,
    });
    const output = await options.transcriber(
      preparedAudio.path,
      workspace,
      transcriptionOptions.data,
    );

    return {
      ...output,
      durationSeconds: preparedAudio.durationSeconds,
    };
  } finally {
    await removeWorkspace(options.workDirectory, workspace).catch((error) => {
      console.error("Failed to clean up transcription workspace", error);
    });
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
