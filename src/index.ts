import type { Serve } from "bun";
import { loadConfig } from "./config";
import { createApp } from "./transcription/routes";
import { transcribeAudio } from "./transcription/transcribe";
import type { Transcriber } from "./transcription/whisper";
import { transcribeWithWhisper } from "./transcription/whisper";

const config = loadConfig();

const transcriber: Transcriber = (audioPath, outputDirectory, options) =>
  transcribeWithWhisper(audioPath, outputDirectory, options, {
    cliPath: config.whisper.cliPath,
    modelPath: config.whisper.modelPath,
    threads: config.whisper.threads,
    timeoutMs: config.processTimeoutMs,
  });

const app = createApp((file, language) =>
  transcribeAudio(file, language, {
    transcriber,
    workDirectory: config.workDirectory,
    maxUploadBytes: config.maxUploadBytes,
    maxAudioDurationSeconds: config.maxAudioDurationSeconds,
    mediaTimeoutMs: config.processTimeoutMs,
    defaultLanguage: config.whisper.language,
  }),
);

export default {
  hostname: config.host,
  port: config.port,
  maxRequestBodySize: config.maxUploadBytes + 1024 * 1024,
  idleTimeout: 0,
  fetch: app.fetch,
} satisfies Serve.Options<undefined>;
