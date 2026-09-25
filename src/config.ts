import { resolve } from "node:path";
import { z } from "zod";

export const modelNames = [
  "tiny",
  "tiny.en",
  "base",
  "base.en",
  "small",
  "small.en",
  "medium",
  "medium.en",
  "large-v3",
  "large-v3-turbo",
] as const;

export const WhisperModelSchema = z.enum(modelNames);

const numberFromEnvironment = (fallback: number) =>
  z.preprocess(
    (value) => (value === undefined || value === "" ? fallback : value),
    z.coerce.number().positive(),
  );

const integerFromEnvironment = (fallback: number) =>
  numberFromEnvironment(fallback).pipe(z.number().int());

const EnvironmentSchema = z.object({
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: integerFromEnvironment(3000).pipe(z.number().max(65_535)),
  MAX_UPLOAD_MB: numberFromEnvironment(500),
  MAX_AUDIO_DURATION_MINUTES: numberFromEnvironment(240),
  PROCESS_TIMEOUT_MINUTES: numberFromEnvironment(240),
  WHISPER_MODEL: WhisperModelSchema.default("base"),
  WHISPER_LANGUAGE: z.string().min(2).max(16).default("auto"),
  WHISPER_THREADS: integerFromEnvironment(4).pipe(z.number().max(128)),
  WHISPER_CLI_PATH: z
    .string()
    .min(1)
    .default("./vendor/whisper.cpp/build/bin/whisper-cli"),
  WHISPER_MODEL_DIR: z.string().min(1).default("./models"),
});

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly maxUploadBytes: number;
  readonly maxAudioDurationSeconds: number;
  readonly processTimeoutMs: number;
  readonly whisper: {
    readonly model: (typeof modelNames)[number];
    readonly language: string;
    readonly threads: number;
    readonly cliPath: string;
    readonly modelPath: string;
  };
  readonly workDirectory: string;
}

export function loadConfig(
  environment: Record<string, string | undefined> = process.env,
  cwd = process.cwd(),
): AppConfig {
  const parsed = EnvironmentSchema.parse(environment);
  const modelDirectory = resolve(cwd, parsed.WHISPER_MODEL_DIR);

  return {
    host: parsed.HOST,
    port: parsed.PORT,
    maxUploadBytes: Math.floor(parsed.MAX_UPLOAD_MB * 1024 * 1024),
    maxAudioDurationSeconds: parsed.MAX_AUDIO_DURATION_MINUTES * 60,
    processTimeoutMs: parsed.PROCESS_TIMEOUT_MINUTES * 60 * 1000,
    whisper: {
      model: parsed.WHISPER_MODEL,
      language: parsed.WHISPER_LANGUAGE,
      threads: parsed.WHISPER_THREADS,
      cliPath: resolve(cwd, parsed.WHISPER_CLI_PATH),
      modelPath: resolve(modelDirectory, `ggml-${parsed.WHISPER_MODEL}.bin`),
    },
    workDirectory: resolve(cwd, "data/transcriptions"),
  };
}
