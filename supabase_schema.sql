/*
  ANTIGRAVITY ORCHESTRATOR SCHEMA
  Paste this into your Supabase SQL Editor to set up your database.
*/

-- 1. Conversations (Sessions)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT,
    workspace_path TEXT,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Messages (Chat History)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    role TEXT NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    persona TEXT, -- 'CYAN', 'COOP', 'NEST', 'GORDON', etc.
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Agent Tasks (Orchestration Visibility)
CREATE TABLE IF NOT EXISTS public.agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    agent_id TEXT NOT NULL,
    persona TEXT NOT NULL,
    task_description TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    result TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE CONTROL;
ALTER TABLE public.messages ENABLE CONTROL;
ALTER TABLE public.agent_tasks ENABLE CONTROL;

-- Create basic access policies (Single User mode for now)
CREATE POLICY "Enable all for authenticated users" ON public.conversations FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.messages FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.agent_tasks FOR ALL USING (true);
