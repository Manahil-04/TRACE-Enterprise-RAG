from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api import auth, chat, documents, upload
from app.services.vector_store import get_vector_store


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    get_vector_store()  # connects and ensures schema exists at boot
    yield


app = FastAPI(lifespan=lifespan)

# Only needed when the frontend runs on its own dev server (Vite, different
# origin). The production build is served from this same app - no CORS needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(documents.router)
app.include_router(chat.router)

# Serve the built frontend (produced by `npm run build`, copied in at Docker
# build time) - only present in the packaged/production image, so local
# API-only development is unaffected when it's absent. Registered after all
# API routers so those routes always win; StaticFiles(html=True) alone won't
# do here since it only falls back to index.html for directory-style paths,
# not client-side routes like /chat - a hard refresh there would 404.
_frontend_dist = (Path(__file__).resolve().parent.parent / "frontend_dist").resolve()
if _frontend_dist.is_dir():
    _frontend_index = _frontend_dist / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str) -> FileResponse:
        # full_path is user-controlled - resolve it and confirm it's actually
        # inside _frontend_dist before serving, or "../../etc/passwd"-style
        # paths could read arbitrary files on the container filesystem.
        candidate = (_frontend_dist / full_path).resolve()
        if full_path and candidate.is_relative_to(_frontend_dist) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_frontend_index)
