const { Client } = require('pg');
require('dotenv').config();

class SupabaseManager {
  constructor() {
    this.enabled = !!(process.env.SUPABASE_PASSWORD);
    this.client = null;
    
    if (this.enabled) {
      this.client = new Client({
        user: 'postgres',
        host: 'db.wjxqzleqvzblifivyqve.supabase.co',
        database: 'postgres',
        password: process.env.SUPABASE_PASSWORD,
        port: 5432,
      });
      this.initConnection();
    } else {
      console.warn("[SupabaseManager] Warning: No Supabase password found. Persistence disabled.");
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
}

module.exports = new SupabaseManager();
