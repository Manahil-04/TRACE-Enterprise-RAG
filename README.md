# TRACE

**Self-hosted RAG for privacy-conscious organizations.** Upload your team's documents, ask questions in plain English, and get answers grounded in those documents — with every claim traced back to the exact file and page it came from.

Everything runs on infrastructure you control: documents, embeddings, and chat history live in your own Postgres database. The AI model itself is pluggable — run fully offline with a local [Ollama](https://ollama.com) model, or opt into Google's Gemini API per deployment when you want extra horsepower.

![Architecture Diagram](./assets/architecture.png)

## Features

- **Grounded Q&A** — ask a question, get an answer generated only from your uploaded documents, with inline source citations (filename + page).
- **Multi-turn conversations ("Explorations")** — every chat is saved as a thread with bounded conversation memory, so follow-up questions ("what about that policy's exceptions?") resolve correctly, and past research is never lost.
- **Semantic document search** — a dedicated search view for finding the right passage without starting a chat.
- **Workspaces** — documents and conversations are scoped to a workspace; users only see workspaces they're a member of, admins see everything.
- **PDF ingestion with OCR fallback** — text-based PDFs are parsed directly; pages with no extractable text (scanned/image pages) fall back to OCR via Tesseract, configurable per deployment.
- **Pluggable AI providers** — swap between local (Ollama) and cloud (Gemini) embedding/LLM providers via one config value, independently for embeddings and generation.
- **Admin controls** — manage users (roles), workspaces, and RAG tuning (chunk size/overlap, retrieval top-k, OCR on/off) from dedicated admin pages.
- **JWT auth**, self-hostable end-to-end via Docker.

## Architecture

```mermaid
flowchart LR
    Browser["Browser<br/>React + TypeScript"] -->|HTTPS + JWT| Backend["FastAPI Backend"]
    Backend --> DB[("Postgres + pgvector<br/>docs · chunks · users")]
    Backend -->|local, default| Ollama["Ollama"]
    Backend -.->|opt-in, cloud| Gemini["Gemini API"]

    style DB fill:#0f2226,stroke:#1d5a63,color:#eaf6f4
    style Ollama fill:#0f2226,stroke:#1d5a63,color:#eaf6f4
    style Gemini fill:#1c1830,stroke:#4c3f78,color:#eaf6f4
```

Everything to the left of the dashed arrow runs inside your own deployment. Gemini is the one component that can leave it, and only if a deployment explicitly opts in.

## Tech stack

| Layer | Stack |
|---|---|
| Backend | FastAPI, SQLAlchemy 2.0 + Alembic, `psycopg` v3, Postgres + pgvector, PyJWT + bcrypt |
| Document processing | PyPDF2, PyMuPDF, Tesseract (OCR fallback) |
| AI providers | Ollama (local) and/or Google Gemini (cloud), selected via config |
| Frontend | React 19, TypeScript, React Router, Vite — no UI framework, hand-rolled CSS |
| Deployment | Docker / Docker Compose (multi-stage build serves the frontend build from the backend image) |

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 20+
- Postgres 16+ with the [pgvector](https://github.com/pgvector/pgvector) extension (or use the provided `docker-compose.yml`)
- [Ollama](https://ollama.com) running locally, **or** a Gemini API key — see [Choosing a provider](#choosing-a-provider) below
- Tesseract OCR (optional — only needed if you want text extraction from scanned/image-only PDFs)

### 1. Clone and configure

```bash
git clone <this-repo>
cd Internal_RAG_System
cp backend/.env.example backend/.env
```

Generate a JWT secret and set it in `backend/.env`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### 2. Database

Either start Postgres via Docker:

```bash
docker compose up -d postgres
```

...or point `DATABASE_URL` in `backend/.env` at any Postgres 16+ instance with pgvector installed (`CREATE EXTENSION vector;`).

### 3. Choosing a provider

TRACE defaults to **Ollama** (fully local/offline). Pull the default models:

```bash
ollama pull llama3
ollama pull nomic-embed-text
```

To use Gemini instead (for embeddings, generation, or both), set `EMBEDDING_PROVIDER=gemini` and/or `LLM_PROVIDER=gemini` and `GEMINI_API_KEY` in `backend/.env`.

### 4. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # .venv\Scripts\activate on Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

The API is now at `http://localhost:8000` (interactive docs at `/docs`).

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app is now at `http://localhost:5173`, talking to the backend at `http://localhost:8000`.

### Alternative: one-command start with Docker

```bash
docker compose up -d --build
```

This builds and serves the frontend from the backend's image and runs migrations automatically on boot. Ollama is expected to run natively on the host (not containerized) — the container reaches it via `host.docker.internal`.

## Environment variables

All read from `backend/.env` (see `backend/.env.example`):

| Variable | Default | Notes |
|---|---|---|
| `EMBEDDING_PROVIDER` / `LLM_PROVIDER` | `ollama` | `ollama` or `gemini`, set independently |
| `GEMINI_API_KEY` | — | required if either provider above is `gemini` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | |
| `OLLAMA_EMBEDDING_MODEL` / `OLLAMA_LLM_MODEL` | `nomic-embed-text` / `llama3` | |
| `EMBEDDING_DIM` | `768` | must match the selected embedding model's output size |
| `DATABASE_URL` | `postgresql://raguser:ragpass@localhost:5432/ragdb` | |
| `STORAGE_DIR` | `./storage/documents` | where uploaded originals are kept on disk |
| `TESSERACT_CMD` | — | only needed if `tesseract` isn't already on `PATH` |
| `JWT_SECRET_KEY` | — | **required**, no default — the app refuses to boot without it |
| `JWT_ALGORITHM` / `JWT_EXPIRE_MINUTES` | `HS256` / `30` | |

## Usage

1. **Register** — the very first account to register becomes an admin automatically; everyone after that registers as a regular user and is auto-enrolled into the default workspace.
2. **Upload documents** — drag a PDF into a workspace.
3. **Ask questions** — every answer cites the source file and page it came from.
4. **Search** — look up a passage directly without starting a conversation.
5. **Admin** (admins only) — manage users and roles, create/rename/delete workspaces and their members, and tune retrieval settings (chunk size, overlap, top-k, OCR) under **Admin**.

## Development

```bash
# Backend
cd backend
ruff check .
mypy .

# Frontend
cd frontend
npm run build   # tsc + vite build
npm run lint    # oxlint
```

## Project structure

```
backend/
  app/
    api/            # FastAPI routers (auth, upload, chat, search, documents, workspaces, admin_settings, explorations)
    core/            # config, db session, JWT/password security
    models/          # SQLAlchemy models
    schemas/         # Pydantic request/response schemas
    services/        # retrieval, chunking/embedding, pluggable LLM providers, vector store
  alembic/           # database migrations
frontend/
  src/
    pages/           # one component per route
    components/      # shared UI (dialogs, icons, notices)
    auth/, workspace/, explorations/, theme/, status/   # React contexts
```
