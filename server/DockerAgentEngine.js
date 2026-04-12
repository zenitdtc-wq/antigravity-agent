const { exec } = require('child_process');
const path = require('path');
require('dotenv').config();

class DockerAgentEngine {
  constructor(workspaceDir) {
    this.workspaceDir = workspaceDir;
  }

  async processMessage(userMessage, onUpdate) {
    onUpdate({ type: 'thinking', content: "Gordon (Docker AI) is analyzing your container stack..." });
    
    // Use 'docker ai' to get a response from Gordon
    // We wrap the prompt to ensure Gordon understands it's coming from an orchestrator
    const prompt = `[CONTEXT: OnePigeon.App] ${userMessage}`;
    
    return new Promise((resolve) => {
      // Execute docker ai in the workspace
      exec(`docker ai "${prompt.replace(/"/g, '\\"')}"`, { cwd: this.workspaceDir }, (err, stdout, stderr) => {
        if (err) {
          console.error("Gordon Error:", err);
          resolve(`Gordon encountered an error: ${stderr || err.message}`);
        } else {
          resolve(stdout || "Gordon has completed the task.");
        }
      });
    });
  }

  // Future: Implement 'docker agent run agent.yaml' for complex team tasks
  async runDockerAgentTeam(yamlPath, onUpdate) {
     onUpdate({ type: 'thinking', content: `Starting Docker Agent Team: ${path.basename(yamlPath)}` });
     // ... implementation for 'docker agent run'
  }
}

module.exports = DockerAgentEngine;
