import docker
import asyncio

class DockerManager:
    def __init__(self):
        try:
            self.client = docker.from_env()
        except Exception:
            self.client = None

    async def list_containers(self):
        if not self.client: return [{"error": "Docker inactive in Serverless environment"}]
        def _get():
            return [{"id": c.id, "name": c.name, "status": c.status} for c in self.client.containers.list(all=True)]
        return await asyncio.to_thread(_get)

    async def action_container(self, container_id: str, action: str):
        if not self.client: return "Docker inactive"
        def _act():
            c = self.client.containers.get(container_id)
            if action == 'stop': c.stop()
            elif action == 'start': c.start()
            return c.status
        return await asyncio.to_thread(_act)

    async def get_logs(self, container_id: str):
        if not self.client: return "No logs active natively in Vercel"
        def _logs():
            c = self.client.containers.get(container_id)
            return c.logs(tail=100).decode('utf-8')
        return await asyncio.to_thread(_logs)
