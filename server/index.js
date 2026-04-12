const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

const Orchestrator = require('./Orchestrator');
const Sentinel = require('./Sentinel');
const SupabaseManager = require('./SupabaseManager');

const app = express();
const PORT = 3001;
const WORKSPACE_DIR = path.resolve(__dirname, '..'); // Root of the project

let orchestrator;
let currentConversationId = null;

// Initialize System
async function init() {
  const bestProvider = await Sentinel.runHealthCheck();
  orchestrator = new Orchestrator(WORKSPACE_DIR, bestProvider);
  
  // Create a new conversation record in Supabase
  try {
    currentConversationId = await SupabaseManager.createConversation('Persistent Session', WORKSPACE_DIR);
    console.log(`[Supabase] Active Conversation ID: ${currentConversationId}`);
  } catch (err) {
    console.error("[Supabase] Failed to initialize persistent session:", err.message);
  }
}

init();

app.use(cors());
app.use(bodyParser.json());

// Root route to show server is up
app.get('/', (req, res) => {
  res.send('<h1>Antigravity Bridge is Live!</h1><p>Visit the dashboard at <a href="http://localhost:5173">http://localhost:5173</a></p>');
});

// Chat endpoint (Orchestrated)
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  
  // Log user message to Supabase
  if (currentConversationId) {
    await SupabaseManager.saveMessage(currentConversationId, 'user', message);
  }

  try {
    const response = await orchestrator.runOrchestration(message, async (update) => {
      // Log agent updates to Supabase
      if (currentConversationId && update.type === 'worker-started') {
        update.taskId = await SupabaseManager.logAgentTask(currentConversationId, update.id, update.persona, update.task);
      }
      if (currentConversationId && update.type === 'worker-finished' && update.taskId) {
        await SupabaseManager.updateAgentTask(update.taskId, 'completed', update.result);
      }
      
      console.log("Orchestrator update:", update);
    });

    // Log assistant response to Supabase
    if (currentConversationId) {
      await SupabaseManager.saveMessage(currentConversationId, 'assistant', response, 'CYAN');
    }

    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List files
app.get('/api/files', async (req, res) => {
  try {
    const files = await fs.readdir(WORKSPACE_DIR, { recursive: true });
    // Filter out node_modules
    const filtered = files.filter(f => !f.includes('node_modules') && !f.includes('.git'));
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read file
app.post('/api/read', async (req, res) => {
  const { filePath } = req.body;
  try {
    const fullPath = path.join(WORKSPACE_DIR, filePath);
    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      return res.json({ content: '// This is a directory' });
    }
    const content = await fs.readFile(fullPath, 'utf8');
    res.json({ content });
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Write file
app.post('/api/write', async (req, res) => {
  const { filePath, content } = req.body;
  try {
    await fs.ensureDir(path.dirname(path.join(WORKSPACE_DIR, filePath)));
    await fs.writeFile(path.join(WORKSPACE_DIR, filePath), content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Execute terminal command
app.post('/api/terminal', (req, res) => {
  const { command } = req.body;
  exec(command, { cwd: WORKSPACE_DIR }, (error, stdout, stderr) => {
    res.json({
      stdout,
      stderr,
      error: error ? error.message : null
    });
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Antigravity Bridge running on http://localhost:${PORT}`);
  });
}

module.exports = app;
