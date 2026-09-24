# Speech-to-text API

A small asynchronous transcription API built with Bun, TypeScript, FFmpeg, and `whisper.cpp`.

## Requirements

- Bun 1.3+
- FFmpeg and FFprobe
- CMake and Git (used by setup)
- A 64-bit CPU; a dedicated GPU is optional

The default multilingual `base` model downloads about 142 MiB and uses roughly 388 MB of memory. At least 1 GB of available RAM is required; 2 GB is recommended.

## Run it

```bash
cp .env.example .env
bun install
bun run setup
bun run start
```

Upload an audio file:

```bash
curl -X POST http://127.0.0.1:3000/v1/transcriptions \
  -F "audio=@./samples/jfk.wav" \
  -F "language=auto"
```

The API returns `202 Accepted` with a job ID. Poll the result:

```bash
curl http://127.0.0.1:3000/v1/transcriptions/tr_YOUR_JOB_ID
```

Completed jobs contain full text and segment-level timestamps in seconds.

## Configuration

Common options in `.env`:

```dotenv
MAX_UPLOAD_MB=500
MAX_AUDIO_DURATION_MINUTES=240
TRANSCRIPTION_CONCURRENCY=1
WHISPER_MODEL=base
WHISPER_LANGUAGE=auto
WHISPER_THREADS=4
```

Use a model name ending in `.en` for English-only transcription. Models without that suffix are multilingual. Run `bun run model:download small` before selecting another model.

## Engineering decisions

Inputs are inspected with FFprobe and normalized with FFmpeg to mono 16 kHz PCM WAV, giving Whisper one consistent audio format.

`whisper.cpp` handles long recordings through its built-in long-form windowing. The API uses a bounded asynchronous queue so transcription does not hold an HTTP request open. The queue and job store are in memory for this exercise; production deployment would use durable object storage and a persistent job queue.

## Tests

```bash
bun run check
```

Tests use a fake transcription engine and do not download a Whisper model.
