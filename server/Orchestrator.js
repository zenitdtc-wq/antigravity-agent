const AgentEngine = require('./AgentEngine');
const DockerAgentEngine = require('./DockerAgentEngine');
const PERSONAS = require('./Personas');

class Orchestrator {
  constructor(workspaceDir, providerOverride = null) {
    this.workspaceDir = workspaceDir;
    this.agents = {}; // Map of agentId -> AgentEngine
    this.tasks = []; // Queue/history of orchestrated tasks
    this.nextId = 1;

    // Use CYAN as the default coordinator
    // Sentinel designates the best provider (OpenRouter or Groq)
    this.coordinator = new AgentEngine(workspaceDir, 'CYAN', providerOverride);
    this.dockerAI = new DockerAgentEngine(workspaceDir);
  }

  async runOrchestration(userMessage, onUpdate) {
    onUpdate({ type: 'status', message: "Coordinator (Cyan) is analyzing..." });
    
    // 1. Ask Coordinator to build a plan
    const response = await this.coordinator.processMessage(`
      USER REQUEST: ${userMessage}
      
      You represent Cyan. 
      Analyze the request and decide if we need sub-agents (Coop, Nest, Hawk, Loft, Gordon).
      - Use GORDON for Docker/Container tasks.
      - Use COOP for Backend.
      - Use NEST for Frontend.
      - Use HAWK for Verification.
      
      If you can answer directly, do so.
      Otherwise, output:
      <spawn-agent>
      - PERSONA: [PERSONA_NAME]
      - PLAN: [Clear specialized prompt for the worker]
      </spawn-agent>
    `, onUpdate);

    // 2. Parse spawns
    const spawns = this.parseSpawns(response);
    
    if (spawns.length > 0) {
      onUpdate({ type: 'status', message: `Spawning ${spawns.length} sub-agents...` });
      
      const promises = spawns.map(async (s) => {
        const agentId = `agent-${this.nextId++}`;
        let result;
        
        onUpdate({ 
          type: 'worker-started', 
          id: agentId, 
          persona: s.persona, 
          task: s.plan 
        });

        try {
          result = await this.executeWorkerWithRetry(s.persona, s.plan, (upd) => {
            onUpdate({ ...upd, agentId });
          });
        } catch (err) {
          result = `Worker Error after retries: ${err.message}`;
        }

        onUpdate({ 
          type: 'worker-finished', 
          id: agentId, 
          result 
        });

        return { id: agentId, persona: s.persona, result };
      });

      // Run sub-agents in parallel
      const results = await Promise.all(promises);

      // 3. Synthesize results
      onUpdate({ type: 'status', message: "Synthesizing worker results..." });
      const finalResponse = await this.coordinator.processMessage(`
        The workers have finished their tasks. Here are the results:
        ${results.map(r => `[${r.persona}] Result: ${r.result}`).join('\n\n')}
        
        Synthesize this and give a final report to the user.
      `, onUpdate);

      return finalResponse;
    }

    return response;
  }

  async executeWorkerWithRetry(persona, plan, onUpdate, retries = 1) {
    let lastError;
    for (let i = 0; i <= retries; i++) {
      try {
        if (persona === 'GORDON') {
          return await this.dockerAI.processMessage(plan, onUpdate);
        } else {
          const worker = new AgentEngine(this.workspaceDir, persona, this.coordinator.provider.provider);
          return await worker.processMessage(plan, onUpdate);
        }
      } catch (err) {
        lastError = err;
        if (i < retries) {
          onUpdate({ type: 'status', message: `Retrying ${persona} task (${i + 1}/${retries})...` });
        }
      }
    }
    throw lastError;
  }

  parseSpawns(text) {
    const spawns = [];
    const regex = /<spawn-agent>([\s\S]*?)<\/spawn-agent>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const block = match[1];
      const personaMatch = block.match(/PERSONA:\s*(\w+)/);
      const planMatch = block.match(/PLAN:\s*([\s\S]*)/);
      if (personaMatch && planMatch) {
        spawns.push({
          persona: personaMatch[1].toUpperCase(),
          plan: planMatch[1].trim()
        });
      }
    }
    return spawns;
  }
}

module.exports = Orchestrator;
