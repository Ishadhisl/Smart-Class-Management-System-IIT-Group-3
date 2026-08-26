# Single container running both the Node backend and the Python AI microservice,
# because fastapi_service/main.py resolves image/video paths as
# `../thusitha-backend/<path>` (relative filesystem traversal) — it assumes it's running
# on the SAME machine/disk as thusitha-backend, not a separately-deployed service. See
# deploy/DEPLOY.md §0 for the full explanation of why this can't be split into two
# separate Render services without a code refactor.
#
# server.js's existing checkAndStartAIServer() already spawns `python fastapi_service/main.py`
# as a child process when nothing is listening on :8000 (exactly like local dev) — this image
# just makes sure both `node` and a working `python` (with all AI deps) exist in the same
# container, so that mechanism works unmodified.

FROM node:24-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv python3-dev \
    build-essential cmake libopenblas-dev liblapack-dev libx11-dev libgtk-3-dev \
    && rm -rf /var/lib/apt/lists/*

# venv so `pip install` isn't blocked by Debian's system-package protection (PEP 668).
# Prepending it to PATH means every later `python`/`pip` call - including the
# `spawn('python', ...)` in server.js - resolves to this venv automatically.
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY . .

RUN pip install --no-cache-dir -r fastapi_service/requirements.txt
RUN cd thusitha-backend && npm install --omit=dev

WORKDIR /app/thusitha-backend
EXPOSE 5000
CMD ["node", "server.js"]
