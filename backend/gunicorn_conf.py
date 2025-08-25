import multiprocessing, os

bind = f"0.0.0.0:{os.getenv('PORT','8000')}"
workers = int(os.getenv('WORKERS', (multiprocessing.cpu_count() // 2) or 1))
threads = int(os.getenv('THREADS', 1))
worker_class = 'uvicorn.workers.UvicornWorker'
keepalive = 45
preload_app = True
timeout = int(os.getenv('TIMEOUT', 120))
loglevel = os.getenv('LOG_LEVEL','info')
accesslog = '-'
errorlog = '-'
