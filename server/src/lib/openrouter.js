const DEFAULT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PER_MODEL_TIMEOUT_MS = 45_000;
const RETRY_DELAY_MS = 1200;

/**
 * Default: Qwen 3.6 Plus (free) on OpenRouter, then the generic free auto-router as fallback.
 * Override with OPENROUTER_MODEL_CHAIN (comma-separated).
 */
export const DEFAULT_MODEL_CHAIN = [
  'qwen/qwen3.6-plus:free',
  'openrouter/free',
];

/**
 * @returns {{ endpoint: string, perModelTimeoutMs: number, models: string[] }}
 */
export function getOpenRouterConfig() {
  const envChain = process.env.OPENROUTER_MODEL_CHAIN;
  const models = envChain
    ? envChain.split(',').map((s) => s.trim()).filter(Boolean)
    : [...DEFAULT_MODEL_CHAIN];

  return {
    endpoint: process.env.OPENROUTER_API_URL || DEFAULT_ENDPOINT,
    perModelTimeoutMs: Math.min(90_000, Math.max(5_000, Number(process.env.OPENROUTER_TIMEOUT_MS) || PER_MODEL_TIMEOUT_MS)),
    models,
  };
}

function clampMaxTokens(n) {
  return Math.min(8192, Math.max(256, Number(n) || 900));
}

function safeBodySnippet(text, max = 700) {
  if (text == null) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function logOpenRouterEvent(level, message, details) {
  const payload = { ...details };
  if (payload.bodySnippet) payload.bodySnippet = safeBodySnippet(payload.bodySnippet);
  const fn = level === 'warn' ? console.warn : console.error;
  fn(`[OpenRouter] ${message}`, payload);
}

/** Strip common model "thinking" wrappers so JSON parse still works. */
export function stripThinkingBlocks(text) {
  let s = String(text || '');
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
  s = s.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  s = s.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
  return s.trim();
}

export function tryParseJsonFromAI(raw) {
  let text = stripThinkingBlocks(String(raw || '').trim());
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart >= 0 && braceEnd > braceStart) {
    text = text.slice(braceStart, braceEnd + 1);
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function parseJsonFromAI(raw, fallback) {
  return tryParseJsonFromAI(raw) ?? fallback;
}

function isRetryableStatus(status) {
  return status === 404 || status === 429 || status === 502 || status === 503;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractAssistantText(choice) {
  const msg = choice?.message;
  if (!msg) return '';
  const content = String(msg.content ?? '').trim();
  const reasoning = String(msg.reasoning ?? '').trim();
  if (reasoning && content) return `${reasoning}\n\n${content}`.trim();
  if (content) return content;
  return reasoning;
}

async function openRouterFetchOnce({ endpoint, model, messages, maxTokens, signal, temperature = 0.5 }) {
  const res = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.CLIENT_URL || 'https://ironlog.app',
      'X-Title': 'IronLog',
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });

  const bodyText = await res.text();
  let data = null;
  try { data = bodyText ? JSON.parse(bodyText) : null; } catch { /* ignore */ }

  return { ok: res.ok, status: res.status, model, bodyText, data };
}

/**
 * Try a single model with its own AbortController.
 *
 *   { type: 'ok', parsed, _model }
 *   { type: 'text', raw, _model }   — valid response but not JSON
 *   { type: 'retryable' }
 *   { type: 'fatal' }
 */
async function tryModelWithTimeout({ endpoint, model, messages, maxTokens, timeoutMs, phase, temperature }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { ok, status, bodyText, data } = await openRouterFetchOnce({
      endpoint, model, messages, maxTokens, signal: controller.signal, temperature,
    });

    if (!ok) {
      const providerMsg =
        data?.error ? String(data.error.message || data.error.code || '').slice(0, 200) : '';
      logOpenRouterEvent('error', 'request failed', {
        phase, model, status,
        providerMessage: providerMsg || undefined,
        bodySnippet: bodyText,
      });
      return { type: isRetryableStatus(status) ? 'retryable' : 'fatal' };
    }

    const resolvedModel = data?.model || model;
    const choice = data?.choices?.[0];
    const finishReason = choice?.finish_reason || choice?.native_finish_reason || '';
    const raw = extractAssistantText(choice);

    if (!raw) {
      logOpenRouterEvent('error', 'empty assistant content', {
        phase, model: resolvedModel, status, finishReason, bodySnippet: bodyText,
      });
      return { type: 'retryable' };
    }

    if (finishReason === 'length') {
      logOpenRouterEvent('warn', 'response truncated (finish_reason=length), attempting parse', {
        phase, model: resolvedModel, status,
      });
    }

    const parsed = tryParseJsonFromAI(raw);
    if (parsed !== null) {
      return { type: 'ok', parsed, _model: resolvedModel };
    }

    logOpenRouterEvent('warn', 'response is plain text (not JSON), forwarding raw text', {
      phase, model: resolvedModel, status, finishReason,
    });
    return { type: 'text', raw, _model: resolvedModel };
  } catch (err) {
    if (err.name === 'AbortError') {
      logOpenRouterEvent('warn', 'request timed out', { phase, model, timeoutMs });
    } else {
      logOpenRouterEvent('error', 'network error', { phase, model, message: err.message || String(err) });
    }
    return { type: 'retryable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls OpenRouter, cycling through the model chain on retryable failures.
 * Returns an object with `_model` (the actual model that responded).
 *
 * If the AI returns plain text instead of JSON, wraps it in
 * `{ summary: rawText, ...fallbackDefaults, _model }` so the user
 * always sees what the AI actually said.
 *
 * @param {Array<{role:string,content:string}>} messages
 * @param {object} fallback
 * @param {object} [options]
 * @param {number}   [options.maxTokens]
 * @param {string[]} [options.models]
 * @param {string}   [options.endpoint]
 * @param {number}   [options.perModelTimeoutMs]
 * @param {number}   [options.temperature] 0–2; higher = more varied wording (default 0.5)
 */
export async function callOpenRouter(messages, fallback, options = {}) {
  const cfg = getOpenRouterConfig();
  const endpoint = options.endpoint || cfg.endpoint;
  const perModelTimeoutMs = options.perModelTimeoutMs ?? cfg.perModelTimeoutMs;
  const models = options.models ?? cfg.models;
  const maxTokens = clampMaxTokens(options.maxTokens);
  const temperature =
    typeof options.temperature === 'number' && Number.isFinite(options.temperature)
      ? Math.min(1.5, Math.max(0, options.temperature))
      : 0.5;

  if (!process.env.OPENROUTER_API_KEY) {
    logOpenRouterEvent('warn', 'OPENROUTER_API_KEY not set — using fallback JSON', {});
    return fallback;
  }

  if (!models.length) {
    logOpenRouterEvent('warn', 'model chain is empty — using fallback JSON', {});
    return fallback;
  }

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const phase = i === 0 ? 'primary' : `fallback-${i}`;

    if (i > 0) await sleep(RETRY_DELAY_MS);

    const result = await tryModelWithTimeout({
      endpoint, model, messages, maxTokens, timeoutMs: perModelTimeoutMs, phase, temperature,
    });

    if (result.type === 'ok') {
      return { ...result.parsed, _model: result._model };
    }

    if (result.type === 'text') {
      return { ...fallback, summary: result.raw, _model: result._model };
    }

    if (result.type === 'fatal') return fallback;
  }

  return fallback;
}
