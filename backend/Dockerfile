# Build context is the repo root (see docker-compose.yml) so this stage can
# reach the sibling frontend/ directory.

FROM node:22-slim AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.14-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-builder /frontend/dist ./frontend_dist

EXPOSE 8000

CMD ["sh", "docker-entrypoint.sh"]
