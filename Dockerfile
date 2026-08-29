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
    python3 python3-pip python3-venv python3-dev git \
    build-essential cmake libopenblas-dev liblapack-dev libx11-dev libgtk-3-dev \
    && rm -rf /var/lib/apt/lists/*

# venv so `pip install` isn't blocked by Debian's system-package protection (PEP 668).
# Prepending it to PATH means every later `python`/`pip` call - including the
# `spawn('python', ...)` in server.js - resolves to this venv automatically.
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY . .

# dlib's cmake build defaults to one compile job per CPU core, and Render's build
# machines expose more cores than they give RAM for - that combination OOM-killed the
# build (8GB+ used). Capping it to 1 job trades build speed for staying under the limit.
ENV CMAKE_BUILD_PARALLEL_LEVEL=1

# Core AI-service deps (small, always succeed). fastapi_service/main.py needs these to
# even start.  Keep this list in sync with fastapi_service/requirements.txt.
RUN pip install --no-cache-dir fastapi uvicorn opencv-python-headless numpy requests

# Heavy CV deps (ultralytics/torch + face-recognition/dlib). dlib compiles from source
# and can OOM on a constrained builder — if it fails we DON'T want the whole backend
# deploy to fail, so this step is allowed to error. main.py already guards both imports
# (HAS_FACE_REC / model is None) and degrades to a clear "AI unavailable" response.
RUN pip install --no-cache-dir ultralytics face-recognition \
    || echo "⚠️  AI CV deps failed to build — face recognition / headcount disabled, rest of the app is unaffected"

# The face_recognition_models wheel on PyPI (0.3.0) ships without its actual .dat model
# files - face_recognition detects this at import time and refuses to run, printing
# "Please install face_recognition_models with: pip install git+...". Force-reinstall
# from git, which bundles the real files. Allowed to fail (matches the block above) since
# main.py already degrades gracefully when face_recognition doesn't fully import.
RUN pip install --no-cache-dir --force-reinstall --no-deps \
    "git+https://github.com/ageitgey/face_recognition_models" \
    || echo "⚠️  face_recognition_models (git) failed to install — face recognition stays disabled"

RUN cd thusitha-backend && npm install --omit=dev

WORKDIR /app/thusitha-backend
EXPOSE 5000
CMD ["node", "server.js"]
