import os
from supabase import create_client, Client
from pydantic import BaseModel
from typing import Optional, Dict

class Task(BaseModel):
    id: Optional[str] = None
    title: str
    status: str = 'pending'
    metadata: Optional[Dict] = {}

class SupabaseManager:
    def __init__(self):
        url: str = os.environ.get("SUPABASE_URL", "")
        key: str = os.environ.get("SUPABASE_KEY", "")
        if url and key:
            self.client: Client = create_client(url, key)
        else:
            self.client = None

    async def create_task(self, task: Task):
        if not self.client: return {"error": "Supabase unconnected"}
        response = self.client.table('tasks').insert(task.model_dump(exclude_none=True)).execute()
        return response.data

    async def get_tasks(self):
        if not self.client: return []
        response = self.client.table('tasks').select("*").execute()
        return response.data
