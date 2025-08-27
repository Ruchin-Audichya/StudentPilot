web: gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT --workers 3 --timeout 120

# NOTE:
# Single process entry for platforms (Railway/Render/EB). Local setup commands were removed
# to avoid Procfile parsing errors. Use README instructions for local development.
