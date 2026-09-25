# Speech-to-text API

A small transcription API built with Bun, TypeScript, Hono, FFmpeg, and `whisper.cpp`.

The API accepts an audio file and returns the complete transcript with timestamps for each segment.

## Requirements

- Bun 1.3+
- FFmpeg and FFprobe
- CMake and Git for the initial setup
- A 64-bit CPU; a dedicated GPU is optional

The default multilingual `base` model downloads about 142 MiB. At least 1 GB of available memory is required; 2 GB is recommended.

## Run locally

```bash
cp .env.example .env
bun install
bun run setup
bun run start
```

`bun run setup` downloads and builds the pinned version of `whisper.cpp`, then downloads the model selected by `WHISPER_MODEL`.

Upload the included three-minute sample:

```bash
curl -X POST http://127.0.0.1:3000/v1/transcriptions \
  -F "audio=@./samples/interview-sample.mp3" \
  -F "language=auto"
```

The request waits for transcription to finish and returns the result:

```json
{
  "text": "Before FUBU made Daymond John a millionaire...",
  "language": "en",
  "durationSeconds": 180.164,
  "segments": [
    {
      "id": 0,
      "startSeconds": 0,
      "endSeconds": 6.24,
      "text": "Before FUBU made Daymond John a millionaire..."
    }
  ]
}
```

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check that the API is running |
| `POST` | `/v1/transcriptions` | Upload audio and return its transcript |

The transcription endpoint expects `multipart/form-data` with:

- `audio`: the audio file
- `language`: optional language code such as `en`, or `auto` for detection

## Request flow

```text
POST audio file
    ↓
Hono validates the multipart input
    ↓
The service writes the file to a temporary workspace
    ↓
FFprobe validates the audio and reads its duration
    ↓
FFmpeg converts it to mono 16 kHz WAV
    ↓
whisper.cpp produces text and segment timestamps
    ↓
The temporary workspace is deleted
    ↓
The API returns the transcript
```

## Code structure

```text
src/
├── server.ts                  Starts the API and connects the modules
├── config.ts                  Reads and validates environment variables
├── errors.ts                  Defines consistent application errors
├── process.ts                 Runs external commands safely
└── transcription/
    ├── routes.ts              Hono routes and multipart request handling
    ├── service.ts             Handles the uploaded file and cleanup
    ├── pipeline.ts            Runs the audio-to-transcript steps
    ├── audio.ts               FFprobe validation and FFmpeg conversion
    ├── whisper.ts             Runs whisper.cpp and parses its JSON
    └── types.ts               Transcript and segment types

scripts/
└── setup.ts                   Builds whisper.cpp and downloads the model
```

## Code walkthrough

Start with `src/server.ts`. It loads the configuration, creates the whisper.cpp transcriber and processing pipeline, passes the pipeline to the transcription service, and starts the Hono application.

Next, `src/transcription/routes.ts` defines the health and transcription endpoints. The transcription route reads the multipart form, validates the `audio` file and optional language, and calls the service.

`src/transcription/service.ts` checks the file size, creates an isolated temporary workspace, saves the uploaded file, and calls the pipeline. Cleanup runs in `finally`, whether transcription succeeds or fails.

`src/transcription/pipeline.ts` connects the three processing steps. `audio.ts` validates and normalizes the input, then `whisper.ts` runs whisper.cpp and turns its output into the API response.

## Engineering decisions

### Audio formats

FFmpeg supports common inputs such as MP3, WAV, M4A, FLAC, and OGG. Every input is converted to mono, 16 kHz, signed 16-bit PCM WAV before transcription. Whisper works with consistent input, while format-specific handling stays in FFmpeg.

### Long audio

whisper.cpp processes long recordings through internal audio windows while preserving timestamps, so the service passes it the complete normalized recording.

If the selected transcription engine did not support long recordings, I would first split the audio around natural pauses. When no safe pause was available, I would use overlapping chunks and remove duplicated text while joining their results.

`MAX_AUDIO_DURATION_MINUTES` provides an operational limit so one request cannot use the machine indefinitely.

The Bun server allows the request to remain open while transcription runs, while `PROCESS_TIMEOUT_MINUTES` limits each external processing command.

### Model choice

The multilingual `base` model is the default because it gives a reasonable balance between size, speed, and accuracy. Models ending in `.en` are English-only; models without that suffix are multilingual.

To use another supported model:

```bash
bun run setup small
```

### Runtime validation

The project uses strict TypeScript for application code and Zod for values that enter at runtime, including environment variables and whisper.cpp output.

## Production design

For a production deployment, I would move long-running transcription work into durable background jobs.

### Concurrent uploads

I would upload large files directly to object storage with signed URLs. The API would create a job in BullMQ, and a separate worker pool would process jobs with concurrency based on the available CPU, memory, or GPU capacity. Redis would make the queue durable and allow multiple API and worker instances.

### Retries and recovery

I would retry temporary failures, such as a worker crash or unavailable dependency, with exponential backoff and a maximum attempt count. Invalid audio and other permanent validation errors would fail immediately. Jobs that exhaust their retries would move to a failed state for inspection or manual retry. Idempotent job IDs would prevent the same upload from creating duplicate results.

### Production API

The production API would be asynchronous:

```text
POST /v1/transcriptions          Create a transcription job
GET  /v1/transcriptions/{id}     Read its status or result
```

`POST` would return `202 Accepted` with a job ID. Clients could poll the `GET` endpoint or provide a webhook URL. Webhook requests would be signed and retried safely, and consumers would handle duplicate delivery.

### Storage

I would store audio and transcript JSON in object storage, with account-scoped keys:

```text
accounts/{accountId}/transcriptions/{jobId}/source.mp3
accounts/{accountId}/transcriptions/{jobId}/transcript.json
```

The database would contain the job status, account ID, storage keys, and other small metadata. Transcript JSON can be read from object storage and cached. I would add a separate search index only if the product needed to search across many transcripts.

## Configuration

```dotenv
HOST=127.0.0.1
PORT=3000
MAX_UPLOAD_MB=500
MAX_AUDIO_DURATION_MINUTES=240
PROCESS_TIMEOUT_MINUTES=240
WHISPER_MODEL=base
WHISPER_LANGUAGE=auto
WHISPER_THREADS=4
```

Human-readable units are used in `.env`; the application converts them into bytes, seconds, and milliseconds internally.

## Tests

```bash
bun run check
```

This runs strict TypeScript checks, Biome, and the test suite. Tests cover the synchronous API response, environment configuration, audio pipeline, and whisper.cpp JSON parsing. Unit tests use a fake transcriber and do not download or run a model.

## Local behavior

Audio is processed on the local machine, temporary files are removed after each request, and the endpoint returns when transcription is complete.
