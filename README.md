# Speech-to-text API

A small asynchronous transcription API built with Bun, TypeScript, FFmpeg, `fastq`, and `whisper.cpp`.

It accepts an audio file, returns a job ID, processes the audio in the background, and returns the completed transcript with timestamps for each segment.

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

The API immediately returns `202 Accepted` with a job ID:

```json
{
  "id": "tr_...",
  "status": "queued",
  "createdAt": "2026-09-25T10:00:00.000Z",
  "updatedAt": "2026-09-25T10:00:00.000Z"
}
```

Use that ID to get the status or completed transcript:

```bash
curl http://127.0.0.1:3000/v1/transcriptions/tr_YOUR_JOB_ID
```

A completed response contains the full text and segment timestamps in seconds:

```json
{
  "id": "tr_...",
  "status": "completed",
  "result": {
    "text": "Before FUBU made Damon John a millionaire...",
    "language": "en",
    "durationSeconds": 180.164,
    "segments": [
      {
        "id": 0,
        "startSeconds": 0,
        "endSeconds": 6.24,
        "text": "Before FUBU made Damon John a millionaire, he got so many orders he almost had to close the business."
      }
    ]
  }
}
```

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check that the API is running |
| `POST` | `/v1/transcriptions` | Upload audio and create a job |
| `GET` | `/v1/transcriptions/:id` | Get the job status or result |

The upload endpoint expects `multipart/form-data` with an `audio` file and an optional `language` field. The language defaults to `auto`.

## Code structure

```text
src/
├── server.ts                  Starts the API and connects the functions
├── config.ts                  Reads and validates environment variables
├── errors.ts                  Defines consistent application errors
├── process.ts                 Runs external commands safely
└── transcription/
    ├── api.ts                 HTTP routes and multipart request handling
    ├── service.ts             Creates jobs and schedules background work
    ├── jobs.ts                fastq setup and in-memory job state
    ├── pipeline.ts            Runs the audio-to-transcript steps
    ├── audio.ts               FFprobe validation and FFmpeg conversion
    ├── whisper.ts             Runs whisper.cpp and parses its JSON
    └── types.ts               Transcript, segment, and job types

scripts/
└── setup.ts                   Builds whisper.cpp and downloads the model
```

The application uses functions rather than service classes. `server.ts` creates the functions and passes their dependencies explicitly.

## Code walkthrough

This is the simplest order to follow when reading or demonstrating the code.

### 1. Start with `src/server.ts`

This is the entry point. It loads the configuration and creates:

- the whisper.cpp transcription function;
- the audio pipeline;
- the in-memory job store;
- the `fastq` queue;
- the transcription service;
- the Bun HTTP server.

There is no business logic in this file. It only connects the modules.

### 2. Show the routes in `src/transcription/api.ts`

`createRequestHandler` contains the three API routes. For `POST /v1/transcriptions`, it reads the multipart form, checks that the `audio` field is a file, and calls `transcriptions.submit()`.

`GET /v1/transcriptions/:id` reads the current job directly from the job store through the service.

### 3. Follow the upload into `src/transcription/service.ts`

The service validates the file size, creates an isolated temporary directory, and writes the uploaded file there. It creates a job with the `queued` status and pushes the processing function into `fastq`.

When the queue starts the job, its status changes to `processing`. The service calls the pipeline and then stores either the completed transcript or a safe error. The temporary directory is removed in `finally`, so cleanup runs after both success and failure.

### 4. Show queue and status handling in `src/transcription/jobs.ts`

`createJobQueue` configures `fastq` with `TRANSCRIPTION_CONCURRENCY`. This prevents too many Whisper processes from running at the same time.

`createJobStore` keeps the job states in a `Map`. A job moves through:

```text
queued → processing → completed
                    ↘ failed
```

Finished jobs expire after `JOB_TTL_MINUTES`.

### 5. Show the processing steps in `src/transcription/pipeline.ts`

The pipeline performs three steps:

1. Read and validate the audio metadata with FFprobe.
2. Convert the audio into the consistent format expected by Whisper.
3. Pass the normalized file to the whisper.cpp function.

It returns one stable transcript object containing the text, detected language, duration, and segments.

### 6. Show format handling in `src/transcription/audio.ts`

FFprobe checks that the upload contains a valid audio stream and reads its duration. FFmpeg converts supported inputs such as MP3, WAV, M4A, FLAC, and OGG into mono, 16 kHz, signed 16-bit PCM WAV.

This keeps format handling outside the transcription engine and gives Whisper consistent input.

### 7. Finish with `src/transcription/whisper.ts`

This function runs the compiled `whisper-cli` with the configured model, language, and thread count. whisper.cpp writes a JSON result containing detected language and timestamped segments.

The JSON is validated before it is converted into the API's transcript format.

## Complete request flow

```text
POST audio file
    ↓
API validates multipart input
    ↓
Service writes the temporary source file
    ↓
Job is stored and added to fastq
    ↓
FFprobe validates audio and duration
    ↓
FFmpeg converts it to mono 16 kHz WAV
    ↓
whisper.cpp produces timestamped JSON
    ↓
Job is marked completed or failed
    ↓
Temporary files are removed
    ↓
GET job endpoint returns the result
```

## Engineering decisions

### Bun and TypeScript

Bun provides the HTTP server, package runner, file APIs, and test runner. The project uses strict TypeScript, while Zod validates values that enter at runtime, including environment variables and whisper.cpp output.

The API only needs three routes, so Bun's native server is enough and an additional web framework is not necessary.

### whisper.cpp and model choice

`whisper.cpp` is open source, runs locally, supports multiple hardware platforms, and returns segment timestamps. The multilingual `base` model is the default because it gives a reasonable balance between size, speed, and accuracy.

Models ending in `.en` are English-only. Models without that suffix are multilingual. To set up a different model:

```bash
bun run setup small
```

### Long audio

whisper.cpp already processes long recordings through its internal audio windows while preserving timestamps. The API therefore passes the complete normalized recording to whisper.cpp instead of adding another chunking layer.

If the selected engine did not support long audio, I would first split around detected pauses. When no safe pause was available, I would use overlapping chunks and remove duplicated text while combining the results.

### Concurrent uploads

Every upload receives its own temporary directory. `fastq` provides a small in-memory queue and limits concurrent transcription processes, protecting the machine from running too many CPU- or memory-heavy jobs at once.

For a production system with multiple API instances, I would replace the in-memory queue with BullMQ and Redis so jobs are durable and can be processed by separate workers.

### Storage

For this assessment, audio is temporary and job results are held in memory. Temporary files are deleted when processing succeeds or fails.

In production, clients would upload large files directly to object storage using signed URLs. Audio and transcript JSON could use account-scoped keys such as:

```text
accounts/{accountId}/transcriptions/{jobId}/source.mp3
accounts/{accountId}/transcriptions/{jobId}/transcript.json
```

The database would only need the account ID, job status, storage keys, and small metadata. A separate search index would only be necessary if the product needed to search across transcripts.

### Polling and webhooks

The current API uses polling because it keeps the assessment small. A production version could accept a signed webhook URL and deliver the result with retry and duplicate-delivery protection.

## Configuration

```dotenv
HOST=127.0.0.1
PORT=3000
MAX_UPLOAD_MB=500
MAX_AUDIO_DURATION_MINUTES=240
TRANSCRIPTION_CONCURRENCY=1
JOB_TIMEOUT_MINUTES=240
JOB_TTL_MINUTES=60
WHISPER_MODEL=base
WHISPER_LANGUAGE=auto
WHISPER_THREADS=4
```

Human-readable units are used in `.env`; the application converts them into bytes, seconds, and milliseconds internally.

## Tests

```bash
bun run check
```

This runs strict TypeScript checks, Biome, and the test suite. The tests cover the API, environment configuration, `fastq` concurrency, the audio pipeline, and whisper.cpp JSON parsing. Unit tests use a fake transcription function and do not download or run a model.

## Current limitations

- Job state is lost when the process restarts.
- The queue and worker run inside the API process.
- Uploaded files use local temporary storage.
- Authentication, rate limiting, account isolation, and webhooks are outside this assessment.
