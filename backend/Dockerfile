FROM python:3.11-slim AS runtime

# Metadata (helps in EB image introspection)
LABEL maintainer="studentpilot" \
      org.opencontainers.image.source="https://github.com/Ruchin-Audichya/StudentPilot" \
      org.opencontainers.image.description="StudentPilot FastAPI backend"

# Build args / feature toggles
ARG INSTALL_CHROME=0
ARG DISABLE_LINKEDIN=0
ENV DISABLE_LINKEDIN=${DISABLE_LINKEDIN}

# Environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    PATH="/home/appuser/.local/bin:$PATH"

WORKDIR /app

# System deps (runtime). Keep minimal; add curl for health debugging.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl wget unzip gnupg fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Optional Chromium + Selenium dependencies (only if INSTALL_CHROME=1)
RUN if [ "$INSTALL_CHROME" = "1" ]; then \
      echo "Installing Chromium stack for Selenium" && \
      apt-get update && apt-get install -y --no-install-recommends \
        chromium chromium-driver \
        libnss3 libxkbcommon0 libasound2 libgbm1 libdrm2 libatk1.0-0 libatk-bridge2.0-0 libxcomposite1 libxdamage1 libxrandr2 libxfixes3 libxrender1 libxi6 libxcursor1 libxss1 \
        && rm -rf /var/lib/apt/lists/* ; \
    else \
      echo "Skipping Chromium installation (INSTALL_CHROME=0)" ; \
    fi

ENV CHROME_BIN=/usr/bin/chromium \
    CHROMEDRIVER=/usr/bin/chromedriver

# Python dependencies (single layer). Use --require-hashes later if you lock.
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY backend/ /app/

# Create non-root user AFTER dependencies to leverage layer cache on code changes
RUN useradd -ms /bin/bash appuser && chown -R appuser:appuser /app
USER appuser

# Healthcheck (EB also uses /health via nginx). This helps local / ECS reuse.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

EXPOSE 8000

# Gunicorn start (workers & timeout tunable via env)
CMD ["sh", "-c", "gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:${PORT:-8000} --workers ${WORKERS:-2} --timeout ${TIMEOUT:-120} --log-level ${LOG_LEVEL:-info}"]
