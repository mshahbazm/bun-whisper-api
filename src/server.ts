import { loadConfig } from "./config";
import { createRequestHandler } from "./transcription/api";
import { JobQueue, JobStore } from "./transcription/jobs";
import { TranscriptionPipeline } from "./transcription/pipeline";
import { TranscriptionService } from "./transcription/service";
import { WhisperCppTranscriber } from "./transcription/whisper";

const config = loadConfig();
const transcriber = new WhisperCppTranscriber({
  cliPath: config.whisper.cliPath,
  modelPath: config.whisper.modelPath,
  threads: config.whisper.threads,
  timeoutMs: config.jobTimeoutMs,
});
const pipeline = new TranscriptionPipeline({
  transcriber,
  maxAudioDurationSeconds: config.maxAudioDurationSeconds,
  mediaTimeoutMs: config.jobTimeoutMs,
});
const store = new JobStore(config.jobTtlMs);
const queue = new JobQueue(config.transcriptionConcurrency);
const jobs = new TranscriptionService({
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
