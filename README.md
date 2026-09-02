# AI Interview Coach

**Live application:** [ai-interview-coach-gray-pi.vercel.app](https://ai-interview-coach-gray-pi.vercel.app)

A privacy-minded Next.js application that extracts a resume and job description, then provides two independent local-AI conversations:

- Resume and job-match coaching grounded in the supplied documents
- Technical interview preparation tailored to the target role

Local development uses Ollama and `llama3.2:latest` by default. The chat UI talks to a provider-neutral interface, so deployment can switch to an authenticated remote Ollama-compatible service through server-only environment settings.

Clerk authentication protects document extraction and both AI coaches. Resume and job-description text remain in the browser session and server memory rather than being persisted by authentication.

When a hosted provider is configured, the resume, job description, and conversation context are sent to that provider to generate each answer. The application itself still does not persist that content.

## Local setup

1. Install dependencies with `npm install`.
2. Ensure Ollama is running and the configured model is installed.
3. Copy `.env.example` to `.env.local` if local configuration is missing.
4. Start the app with `npm run dev`.
5. Open `http://localhost:3000`.

## Automated tests

The normal automated suite mocks Ollama. It does not require a running model and does not transmit resume data to an external service.

```bash
# Unit and security tests
npm run test

# Watch unit tests while editing
npm run test:watch

# Unit tests with an HTML coverage report
npm run test:coverage

# Browser flows in isolated Chromium
npm run test:e2e

# Both unit and browser suites
npm run test:all
```

The browser suite reuses a development server already running on `localhost:3000`. If none is running, Playwright starts and stops one automatically.

Anonymous authentication-boundary browser tests run without setup. Signed-in coach-flow tests require `E2E_AUTH_STORAGE` to point to a Playwright storage-state file created from a dedicated Clerk test user; never use a personal account session or commit that file.

## Deployment rate limiting

Chat requests, document extraction, and AI health checks are rate limited. Local development uses an in-memory limiter with no setup. Before deploying to Vercel, create an Upstash Redis database and add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and a long random `RATE_LIMIT_ID_SALT` to the Vercel project's server-only environment variables. This switches the same application code to a shared limiter that works across serverless instances.

## Vercel preview with Fireworks AI

Fireworks is the preferred hosted provider for this project. It uses Fireworks' OpenAI-compatible streaming Chat Completions endpoint without changing either coach UI. Configure these Vercel Preview environment variables:

- `AI_PROVIDER=fireworks`
- `AI_BASE_URL=https://api.fireworks.ai/inference/v1`
- `AI_MODEL=accounts/fireworks/models/glm-5p2` (or another serverless model available to the account)
- `FIREWORKS_API_KEY` set to the Fireworks key; keep it server-only
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the Clerk instance intended for the preview
- The three Upstash values described above for distributed rate limiting

Do not paste the Fireworks key into chat, commit it, or expose it using a `NEXT_PUBLIC_` prefix. Add it directly to `.env.local` for private local testing and to Vercel's encrypted environment-variable settings for previews.

### Alternative: Ollama Cloud

The local Ollama address cannot be reached from Vercel. Create an Ollama API key in the Ollama account settings, then configure these Vercel environment variables for the Preview environment:

- `AI_PROVIDER=ollama`
- `AI_BASE_URL=https://ollama.com`
- `AI_MODEL=gpt-oss:120b` (or another model available to the account)
- `AI_API_KEY` set to the Ollama API key; keep it server-only
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the Clerk instance intended for the preview
- The three Upstash values described above for distributed rate limiting

Do not copy `.env.local` into source control or expose any secret using a `NEXT_PUBLIC_` prefix. Vercel sets `VERCEL=1`; the application deliberately rejects loopback AI URLs in that environment so a bad deployment fails clearly instead of silently attempting to contact itself.

## Final verification

```bash
npm run lint
npm run test:all
npm run build
```

Generated coverage and browser-test artifacts are ignored by Git.
