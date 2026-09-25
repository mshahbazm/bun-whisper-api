import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { prepareAudio } from "./audio";
import type { Transcript, WhisperLanguage } from "./types";
import type { Transcriber } from "./whisper";

interface TranscribeAudioOptions {
  readonly transcriber: Transcriber;
  readonly workDirectory: string;
  readonly maxUploadBytes: number;
  readonly maxAudioDurationSeconds: number;
  readonly mediaTimeoutMs: number;
  readonly defaultLanguage: WhisperLanguage;
}

export async function transcribeAudio(
  file: File,
  language: WhisperLanguage | undefined,
  options: TranscribeAudioOptions,
): Promise<Transcript> {
  const workspace = await createWorkspace(options.workDirectory);

  try {
    const preparedAudio = await prepareAudio(file, workspace, {
      maxUploadBytes: options.maxUploadBytes,
      maxDurationSeconds: options.maxAudioDurationSeconds,
      timeoutMs: options.mediaTimeoutMs,
    });
    const output = await options.transcriber(preparedAudio.path, workspace, {
      language: language ?? options.defaultLanguage,
    });

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
