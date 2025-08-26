# Root Dockerfile now runs the FastAPI backend for Elastic Beanstalk.
# Original frontend-only Dockerfile preserved as Dockerfile.frontend.

FROM python:3.11-slim AS runtime

ARG INSTALL_CHROME=0
ARG DISABLE_LINKEDIN=1
ENV DISABLE_LINKEDIN=${DISABLE_LINKEDIN}

ENV PYTHONDONTWRITEBYTECODE=1 \
		PYTHONUNBUFFERED=1 \
		PIP_NO_CACHE_DIR=1 \
		PORT=8000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
			ca-certificates curl wget unzip gnupg fonts-liberation \
		&& rm -rf /var/lib/apt/lists/*

RUN if [ "$INSTALL_CHROME" = "1" ]; then \
			apt-get update && apt-get install -y --no-install-recommends \
				chromium chromium-driver libnss3 libxkbcommon0 libasound2 libgbm1 libdrm2 libatk1.0-0 libatk-bridge2.0-0 libxcomposite1 libxdamage1 libxrandr2 libxfixes3 libxrender1 libxi6 libxcursor1 libxss1 \
			&& rm -rf /var/lib/apt/lists/* ; \
		else echo 'Skipping Chromium (INSTALL_CHROME=0)'; fi

ENV CHROME_BIN=/usr/bin/chromium \
		CHROMEDRIVER=/usr/bin/chromedriver

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY backend/ /app/

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

CMD ["sh", "-c", "gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:${PORT:-8000} --workers ${WORKERS:-2} --timeout ${TIMEOUT:-120} --log-level ${LOG_LEVEL:-info}"]

