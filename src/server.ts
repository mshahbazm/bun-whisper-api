import { loadConfig } from "./config";
import { createRequestHandler } from "./transcription/api";
import { createJobQueue, createJobStore } from "./transcription/jobs";
import { createTranscriptionPipeline } from "./transcription/pipeline";
import { createTranscriptionService } from "./transcription/service";
import { createWhisperCppTranscriber } from "./transcription/whisper";

const config = loadConfig();
const transcriber = createWhisperCppTranscriber({
  cliPath: config.whisper.cliPath,
  modelPath: config.whisper.modelPath,
  threads: config.whisper.threads,
  timeoutMs: config.jobTimeoutMs,
});
const pipeline = createTranscriptionPipeline({
  transcriber,
  maxAudioDurationSeconds: config.maxAudioDurationSeconds,
  mediaTimeoutMs: config.jobTimeoutMs,
});
const store = createJobStore(config.jobTtlMs);
const queue = createJobQueue(config.transcriptionConcurrency);
const jobs = createTranscriptionService({
  store,
  queue,
  pipeline,
  workDirectory: config.workDirectory,
  maxUploadBytes: config.maxUploadBytes,
  defaultLanguage: config.whisper.language,
});

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  maxRequestBodySize: config.maxUploadBytes + 1024 * 1024,
  fetch: createRequestHandler(jobs),
});

console.log(`STT API listening on ${server.url}`);
