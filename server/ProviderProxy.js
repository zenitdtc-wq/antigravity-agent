const OpenAI = require('openai');
require('dotenv').config();

class ProviderProxy {
  constructor(provider = 'OPENROUTER') {
    this.provider = provider;
    this.client = this.initClient();
  }

  initClient() {
    let apiKey = this.provider === 'OPENROUTER' ? process.env.OPENROUTER_API_KEY : process.env.GROQ_API_KEY;
    
    // Safety: strip quotes and whitespace
    if (apiKey) apiKey = apiKey.replace(/['"]/g, '').trim();

    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      console.warn(`[ProviderProxy] Warning: No API key found for ${this.provider}. Agent will be disabled.`);
      return null;
    }

    if (this.provider === 'OPENROUTER') {
      return new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://antigravity.ai', 
          'X-Title': 'Antigravity Agent',
        }
      });
    } else if (this.provider === 'GROQ') {
      return new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
    }
  }

  async chat(messages, options = {}) {
    if (!this.client) {
      if (this.provider === 'OPENROUTER' && process.env.GROQ_API_KEY) {
        console.warn("[ProviderProxy] OpenRouter not ready, falling back to GROQ...");
        this.provider = 'GROQ';
        this.client = this.initClient();
      } else {
        throw new Error(`[ProviderProxy] Error: ${this.provider} client is not initialized.`);
      }
    }

    try {
      const model = this.provider === 'OPENROUTER' 
        ? (options.model || 'anthropic/claude-3.5-sonnet:beta')
        : (options.model || 'llama-3.3-70b-versatile');

      const response = await this.client.chat.completions.create({
        model,
        messages,
        ...options
      });

      return response.choices[0].message;
    } catch (err) {
      console.error(`Provider Error (${this.provider}):`, err);
      
      // Automatic fallback if OpenRouter fails
      if (this.provider === 'OPENROUTER' && process.env.GROQ_API_KEY) {
        console.warn("[ProviderProxy] OpenRouter request failed, retrying with GROQ...");
        this.provider = 'GROQ';
        this.client = this.initClient();
        return this.chat(messages, options);
      }
      
      throw err;
    }
  }
}

module.exports = ProviderProxy;
