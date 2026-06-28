FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY pyproject.toml .
COPY core/ core/
COPY agents/ agents/
COPY tools/ tools/
COPY memory/ memory/
COPY cli/ cli/
COPY api/ api/
COPY config/ config/
COPY web/dist/ web/dist/

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s \
    CMD curl -f http://127.0.0.1:3001/health || exit 1

ENTRYPOINT ["python", "-m", "uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "3001"]
