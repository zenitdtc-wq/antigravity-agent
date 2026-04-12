const { Client } = require('pg');
require('dotenv').config();

class SupabaseManager {
  constructor() {
    this.enabled = !!(process.env.SUPABASE_PASSWORD);
    this.client = null;
    
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const password = process.env.SUPABASE_PASSWORD;
    const host = url ? new URL(url).hostname : 'db.wjxqzleqvzblifivyqve.supabase.co';

    if (this.enabled && password) {
      this.client = new Client({
        user: 'postgres',
        host: host,
        database: 'postgres',
        password: password,
        port: 5432,
      });
      this.initConnection();
    } else {
      console.warn("[SupabaseManager] Warning: No Supabase credentials or password found. Persistence limited.");
    }
  }

  async initConnection() {
    try {
      await this.client.connect();
      console.log("[SupabaseManager] Connected to Cyan Supabase!");
      await this.ensureSchema();
    } catch (err) {
      console.error("[SupabaseManager] Database Connection Error:", err);
      this.enabled = false;
    }
  }

  async ensureSchema() {
    console.log("[SupabaseManager] Verifying database schema...");
    const schema = `
      CREATE TABLE IF NOT EXISTS conversations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL, title TEXT, workspace_path TEXT);
      CREATE TABLE IF NOT EXISTS messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE, created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, persona TEXT, metadata JSONB DEFAULT '{}'::jsonb);
      CREATE TABLE IF NOT EXISTS agent_tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE, created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL, agent_id TEXT NOT NULL, persona TEXT NOT NULL, task_description TEXT, status TEXT DEFAULT 'pending', result TEXT);
    `;
    try {
      await this.client.query(schema);
      console.log("[SupabaseManager] Schema is ready.");
    } catch (err) {
      console.error("[SupabaseManager] Schema initialization failed:", err.message);
    }
  }

  async createConversation(title, workspacePath) {
    if (!this.enabled) return null;
    const query = 'INSERT INTO conversations (title, workspace_path) VALUES ($1, $2) RETURNING id';
    const res = await this.client.query(query, [title, workspacePath]);
    return res.rows[0].id;
  }

  async saveMessage(conversationId, role, content, persona = null, metadata = {}) {
    if (!this.enabled) return;
    const query = 'INSERT INTO messages (conversation_id, role, content, persona, metadata) VALUES ($1, $2, $3, $4, $5)';
    await this.client.query(query, [conversationId, role, content, persona, JSON.stringify(metadata)]);
  }

  async logAgentTask(conversationId, agentId, persona, taskDescription) {
    if (!this.enabled) return null;
    const query = 'INSERT INTO agent_tasks (conversation_id, agent_id, persona, task_description) VALUES ($1, $2, $3, $4) RETURNING id';
    const res = await this.client.query(query, [conversationId, agentId, persona, taskDescription]);
    return res.rows[0].id;
  }

  async updateAgentTask(taskId, status, result = null) {
    if (!this.enabled || !taskId) return;
    const query = 'UPDATE agent_tasks SET status = $1, result = $2 WHERE id = $3';
    await this.client.query(query, [status, result, taskId]);
  }

  async listConversations() {
    if (!this.enabled) return [];
    try {
      const query = 'SELECT * FROM conversations ORDER BY created_at DESC LIMIT 50';
      const res = await this.client.query(query);
      return res.rows;
    } catch (err) {
      console.error("[SupabaseManager] Failed to list conversations:", err.message);
      return [];
    }
  }

  async getMessages(conversationId) {
    if (!this.enabled) return [];
    try {
      const query = 'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC';
      const res = await this.client.query(query, [conversationId]);
      return res.rows;
    } catch (err) {
      console.error("[SupabaseManager] Failed to fetch messages:", err.message);
      return [];
    }
  }

  async getAgentTasks(conversationId) {
    if (!this.enabled) return [];
    try {
      const query = 'SELECT * FROM agent_tasks WHERE conversation_id = $1 ORDER BY created_at ASC';
      const res = await this.client.query(query, [conversationId]);
      return res.rows;
    } catch (err) {
      console.error("[SupabaseManager] Failed to fetch agent tasks:", err.message);
      return [];
    }
  }

  async updateConversationTitle(conversationId, title) {
    if (!this.enabled) return;
    try {
      const query = 'UPDATE conversations SET title = $1 WHERE id = $2';
      await this.client.query(query, [title, conversationId]);
    } catch (err) {
      console.error("[SupabaseManager] Failed to update conversation title:", err.message);
    }
  }

  async searchMessages(keyword) {
    if (!this.enabled) return [];
    try {
      const query = "SELECT * FROM messages WHERE content ILIKE $1 ORDER BY created_at DESC LIMIT 20";
      const res = await this.client.query(query, [`%${keyword}%`]);
      return res.rows;
    } catch (err) {
      console.error("[SupabaseManager] Failed to search messages:", err.message);
      return [];
    }
  }
}

module.exports = new SupabaseManager();
