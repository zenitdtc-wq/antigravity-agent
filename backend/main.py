import os
import time
from fastapi import FastAPI, Request, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app, Counter, Histogram

try:
    from backend.docker_client import DockerManager
    from backend.supabase_client import SupabaseManager, Task
    from backend.llm_adapter import LLMAdapter, ChatRequest
except (ImportError, ModuleNotFoundError):
    from docker_client import DockerManager
    from supabase_client import SupabaseManager, Task
    from llm_adapter import LLMAdapter, ChatRequest

app = FastAPI(title="Antigravity Orchestrator (FastAPI)", version="1.0.0")
print("Startup: Antigravity components initializing...")

# Metrics
REQUEST_COUNT = Counter("http_request_total", "Total HTTP Requests", ["method", "endpoint", "http_status"])
REQUEST_LATENCY = Histogram("http_request_duration_seconds", "HTTP Request Latency", ["endpoint"])

# Middleware for auth and metrics
@app.middleware("http")
async def setup_middlewares(request: Request, call_next):
    start_time = time.time()
    
    # Check Auth
    if request.url.path not in ["/", "/metrics", "/v1/health", "/docs", "/openapi.json"]:
        api_key = request.headers.get("X-API-Key")
        if api_key != os.getenv("X_API_KEY", "dev"):
            return JSONResponse(status_code=401, content={"detail": "Unauthorized: Invalid X-API-Key"})

    response = await call_next(request)
    
    process_time = time.time() - start_time
    REQUEST_COUNT.labels(request.method, request.url.path, response.status_code).inc()
    if request.url.path not in ["/metrics"]:
        REQUEST_LATENCY.labels(request.url.path).observe(process_time)
        
    return response

# Mount prometheus
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

llm_adapter = LLMAdapter()
docker_client = DockerManager()
supabase_client = SupabaseManager()

@app.get("/")
def read_root():
    return {
        "message": "Welcome to Antigravity Orchestrator (FastAPI)",
        "docs": "/docs",
        "health": "/v1/health",
        "status": "online"
    }

@app.get("/v1/health")
def health():
    return {"status": "ok", "provider": "hybrid", "docker_ready": bool(docker_client.client)}

@app.post("/v1/chat/completions")
async def chat_completions(req: ChatRequest, x_api_key: str = Header(None)):
    await llm_adapter.check_rate_limit(x_api_key or os.getenv("X_API_KEY", "dev"))
    return await llm_adapter.chat(req)

@app.get("/v1/docker/containers")
async def list_containers():
    return await docker_client.list_containers()

@app.post("/v1/docker/containers/{container_id}/{action}")
async def action_container(container_id: str, action: str):
    if action not in ['start', 'stop']:
        raise HTTPException(status_code=400, detail="Invalid action")
    return {"status": await docker_client.action_container(container_id, action)}

@app.get("/v1/docker/containers/{container_id}/logs")
async def get_logs(container_id: str):
    return {"logs": await docker_client.get_logs(container_id)}

@app.post("/v1/tasks")
async def create_task(task: Task):
    return await supabase_client.create_task(task)

@app.get("/v1/tasks")
async def get_tasks():
    return await supabase_client.get_tasks()
