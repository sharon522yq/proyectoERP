const env = require('../../../config/env');

// Adapter genérico compatible con "chat completions" (estándar de facto):
// sirve para OpenAI, Gemini (endpoint compatible), DeepSeek, Groq, Ollama local, etc.
// Cambiar de proveedor = cambiar AI_BASE_URL / AI_API_KEY / AI_MODEL. El ERP no cambia.
class OpenAICompatProvider {
  constructor(cfg) {
    this.name = 'openai-compatible';
    this.cfg = cfg;
    this.model = cfg.model || null;
  }

  headers() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.cfg.apiKey}` };
  }

  // POST /chat/completions con timeout por AbortController
  async _chat(messages, opts = {}) {
    const url = `${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs || this.cfg.timeoutMs || 20000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: this.cfg.model,
          messages,
          temperature: Number.isFinite(opts.temperature) ? opts.temperature : this.cfg.temperature,
          max_tokens: opts.maxTokens || this.cfg.maxTokens
        }),
        signal: controller.signal
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const err = new Error(body?.error?.message || `Proveedor IA HTTP ${res.status}`);
        err.providerStatus = res.status;
        throw err;
      }
      const text = body?.choices?.[0]?.message?.content ?? '';
      return {
        text,
        tokensIn: body?.usage?.prompt_tokens || 0,
        tokensOut: body?.usage?.completion_tokens || 0
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async generateText(messages, opts = {}) {
    const t0 = Date.now();
    const res = await this._chat(messages, opts);
    return { text: res.text, tokensIn: res.tokensIn, tokensOut: res.tokensOut, latencyMs: Date.now() - t0 };
  }

  async generateStructured(messages, schemaHint, opts = {}) {
    const instruction = {
      role: 'system',
      content: `Responde EXCLUSIVAMENTE con JSON válido (sin markdown, sin comentarios) que cumpla este esquema: ${schemaHint.description}. Campos: ${JSON.stringify(schemaHint.fields)}. Si no tienes la información necesaria, usa null / arrays vacíos.`
    };
    const t0 = Date.now();
    const res = await this._chat([instruction, ...messages], opts);
    let data = null;
    try {
      const cleaned = res.text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
      data = JSON.parse(cleaned);
    } catch {
      data = null; // el servicio aplicará retry controlado y, si persiste, respuesta segura
    }
    return { data, raw: res.text, tokensIn: res.tokensIn, tokensOut: res.tokensOut, latencyMs: Date.now() - t0 };
  }

  async analyze(prompt, opts = {}) {
    return this.generateStructured([{ role: 'user', content: prompt }], {
      description: '{type:"analysis", summary:string, findings:string[], recommendations:string[], confidence:null}',
      fields: ['type', 'summary', 'findings', 'recommendations', 'confidence']
    }, opts);
  }

  async healthCheck() {
    const base = { provider: this.name, model: this.cfg.model || null };
    if (!this.cfg.baseUrl) return { ok: false, ...base, detail: 'AI_BASE_URL no configurado' };
    const isLocal = /localhost|127\.0\.0\.1/.test(this.cfg.baseUrl);
    if (!this.cfg.apiKey && !isLocal) return { ok: false, ...base, detail: 'AI_API_KEY no configurada' };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/models`, {
        headers: this.headers(), signal: controller.signal
      }).finally(() => clearTimeout(timer));
      return { ok: res.status < 500, ...base, detail: `models HTTP ${res.status}` };
    } catch {
      return { ok: false, ...base, detail: 'Proveedor inaccesible' };
    }
  }
}

module.exports = OpenAICompatProvider;
