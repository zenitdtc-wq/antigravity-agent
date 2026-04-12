const ProviderProxy = require('./ProviderProxy');
const PERSONAS = require('./Personas');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

class AgentEngine {
  constructor(workspaceDir, personaKey = 'CYAN', providerOverride = null) {
    this.workspaceDir = workspaceDir;
    this.persona = PERSONAS[personaKey] || PERSONAS.CYAN;
    
    const defaultProvider = process.env.OPENROUTER_API_KEY ? 'OPENROUTER' : 'GROQ';
    this.provider = new ProviderProxy(providerOverride || defaultProvider);
    
    this.history = [
      { role: 'system', content: this.persona.prompt }
    ];
  }

  async processMessage(userMessage, onUpdate) {
    this.history.push({ role: 'user', content: userMessage });
    
    try {
      let response = await this.provider.chat(this.history, {
        tools: this.getToolDefinitions()
      });

      let calls = response.tool_calls;

      while (calls && calls.length > 0) {
        onUpdate({ type: 'thinking', content: `Using tools: ${calls.map(c => c.function.name).join(', ')}` });
        
        for (const call of calls) {
          const res = await this.executeTool(call.function);
          this.history.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: String(res)
          });
        }

        // Get next response from model
        response = await this.provider.chat(this.history, {
          tools: this.getToolDefinitions()
        });
        calls = response.tool_calls;
      }

      this.history.push(response);
      return response.content;
    } catch (err) {
      console.error("Agent Engine Error:", err);
      return `Error: ${err.message}.`;
    }
  }

  getToolDefinitions() {
    return [
      {
        type: "function",
        function: {
          name: "list_files",
          description: "Lists all files in the current workspace directory.",
          parameters: {
            type: "object",
            properties: {
              directory: { type: "string", description: "The subdirectory to list (optional)." }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "read_file",
          description: "Reads the content of a file.",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "The relative path to the file." }
            },
            required: ["path"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "write_file",
          description: "Writes or updates a file with new content.",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "The relative path to the file." },
              content: { type: "string", description: "The full content to write to the file." }
            },
            required: ["path", "content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "run_command",
          description: "Executes a shell command in the workspace.",
          parameters: {
            type: "object",
            properties: {
              command: { type: "string", description: "The shell command to execute." }
            },
            required: ["command"]
          }
        }
      }
    ];
  }

  async executeTool(func) {
    const { name, arguments: argsJson } = func;
    const args = JSON.parse(argsJson);
    console.log(`[${this.persona.name}] Executing tool: ${name}`, args);
    
    try {
      switch (name) {
        case 'list_files':
          const files = await fs.readdir(path.join(this.workspaceDir, args.directory || ''), { recursive: true });
          return files.filter(f => !f.includes('node_modules')).join('\n');
        
        case 'read_file':
          return await fs.readFile(path.join(this.workspaceDir, args.path), 'utf8');
        
        case 'write_file':
          await fs.ensureDir(path.dirname(path.join(this.workspaceDir, args.path)));
          await fs.writeFile(path.join(this.workspaceDir, args.path), args.content);
          return "File written successfully.";
        
        case 'run_command':
          return new Promise((resolve) => {
            exec(args.command, { cwd: this.workspaceDir }, (err, stdout, stderr) => {
              resolve(stdout || stderr || (err ? err.message : "Command executed."));
            });
          });
        
        default:
          return "Unknown tool.";
      }
    } catch (err) {
      return `Tool Error: ${err.message}`;
    }
  }
}

module.exports = AgentEngine;
