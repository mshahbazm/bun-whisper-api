import { loadConfig } from "./config";
import { createTranscriptionPipeline } from "./transcription/pipeline";
import { createApp } from "./transcription/routes";
import { createTranscriptionService } from "./transcription/service";
import { createWhisperCppTranscriber } from "./transcription/whisper";

const config = loadConfig();

const transcriber = createWhisperCppTranscriber({
  cliPath: config.whisper.cliPath,
  modelPath: config.whisper.modelPath,
  threads: config.whisper.threads,
  timeoutMs: config.processTimeoutMs,
});

const pipeline = createTranscriptionPipeline({
  transcriber,
  maxAudioDurationSeconds: config.maxAudioDurationSeconds,
  mediaTimeoutMs: config.processTimeoutMs,
});

const transcriptions = createTranscriptionService({
  pipeline,
  workDirectory: config.workDirectory,
  maxUploadBytes: config.maxUploadBytes,
  defaultLanguage: config.whisper.language,
});

const app = createApp(transcriptions);

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  maxRequestBodySize: config.maxUploadBytes + 1024 * 1024,
  idleTimeout: 0,
  fetch: app.fetch,
});

console.log(`STT API listening on ${server.url}`);
