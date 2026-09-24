import { loadConfig } from "./config";
import { createRequestHandler } from "./http/router";
import { JobQueue } from "./jobs/queue";
import { TranscriptionJobService } from "./jobs/service";
import { JobStore } from "./jobs/store";
import { TranscriptionPipeline } from "./pipeline";
import { WhisperCppTranscriber } from "./transcription/whisper-cpp";

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
const jobs = new TranscriptionJobService({
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
