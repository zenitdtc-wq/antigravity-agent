const ProviderProxy = require('./ProviderProxy');

class Sentinel {
  constructor() {
    this.results = {};
  }

  async runHealthCheck() {
    console.log("🛡️ Antigravity Sentinel: Running provider health checks...");
    
    const providers = ['OPENROUTER', 'GROQ'];
    const pings = providers.map(async (p) => {
      const proxy = new ProviderProxy(p);
      try {
        const start = Date.now();
        await proxy.chat([{ role: 'user', content: 'health-check ping' }], { max_tokens: 5 });
        const latency = Date.now() - start;
        this.results[p] = { status: 'healthy', latency: `${latency}ms` };
      } catch (err) {
        this.results[p] = { status: 'failed', error: err.message };
      }
    });

    await Promise.all(pings);
    
    console.table(this.results);
    
    const bestProvider = this.getBestProvider();
    if (bestProvider) {
      console.log(`🧠 Primary Intelligence set to: ${bestProvider}`);
      return bestProvider;
    } else {
      console.error("🚨 CRITICAL: No healthy AI providers found! Antigravity is offline.");
      return null;
    }
  }

  getBestProvider() {
    if (this.results.OPENROUTER?.status === 'healthy') return 'OPENROUTER';
    if (this.results.GROQ?.status === 'healthy') return 'GROQ';
    return null;
  }
}

module.exports = new Sentinel();
