# Antigravity Orchestrator (FastAPI Edition)

A completely localized, middleware-tuned, Python 3.11 multi-agent development orchestrator.

## Quick-Start

1. Update `.env` with your API keys.
2. Spin up the cluster:
```bash
docker compose up -d
```
3. Local development without Docker: 
```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

## Features
- **Local Ollama -> Claude Fallback**: Queries `qwen2.5:9b` natively over local Docker. On failure or timeout, automatically upgrades to `claude-3-opus-20240229` via Anthropic's API endpoint.
- **Docker Manager Integration**: Automatically lists, manages, and captures container logs via the real `docker-sdk-python`.
- **Supabase Persistence**: Integrates task tracking directly via `supabase-py` native.
- **Redis Security Layers**: Tracks request TTL scaling, blocks injection prompts, limits endpoints to 100 req/min.

## Grafana & Prometheus
Metrics automatically publish to `http://localhost:8000/metrics`. Configure your bundled Grafana (`localhost:3001`) to ingest Prometheus data (`localhost:9090`) to view cache hits, endpoint execution times, and more.

## Security Warning
❗ Always keep your `.env` secured. If your API keys ever leak in source control, immediately rotate them via Anthropic / Supabase consoles.
