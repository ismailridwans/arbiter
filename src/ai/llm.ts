import type { LlmConfig } from '../config';

/**
 * Provider-agnostic LLM client. Supports any OpenAI-compatible endpoint
 * (Groq, OpenRouter, Together, local Ollama) plus Google Gemini — all of which
 * have free tiers. The engine NEVER depends on the LLM: when disabled or on any
 * error, callers fall back to deterministic logic.
 */

export interface CompleteOptions {
  system?: string;
  json?: boolean;
  maxTokens?: number;
}

export interface LlmClient {
  readonly enabled: boolean;
  readonly label: string;
  complete(prompt: string, opts?: CompleteOptions): Promise<string>;
}

const TIMEOUT_MS = 20_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

class DisabledLlm implements LlmClient {
  readonly enabled = false;
  readonly label = 'disabled';
  async complete(): Promise<string> {
    throw new Error('LLM is disabled');
  }
}

/** OpenAI-compatible chat-completions backend (Groq / OpenRouter / Ollama / …). */
class OpenAiCompatLlm implements LlmClient {
  readonly enabled = true;
  constructor(
    readonly label: string,
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly apiKey?: string,
  ) {}

  async complete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
    const messages = [
      ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
      { role: 'user', content: prompt },
    ];
    const data = (await postJson(
      `${this.baseUrl}/chat/completions`,
      this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {},
      {
        model: this.model,
        messages,
        temperature: 0,
        max_tokens: opts.maxTokens ?? 512,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      },
    )) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? '';
  }
}

/** Google Gemini generateContent backend. */
class GeminiLlm implements LlmClient {
  readonly enabled = true;
  readonly label = 'gemini';
  constructor(
    private readonly model: string,
    private readonly apiKey: string,
  ) {}

  async complete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
    const text = (opts.system ? `${opts.system}\n\n` : '') + prompt;
    const data = (await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {},
      {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: opts.maxTokens ?? 512,
          ...(opts.json ? { responseMimeType: 'application/json' } : {}),
        },
      },
    )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
}

export function createLlm(cfg: LlmConfig): LlmClient {
  if (!cfg.enabled) return new DisabledLlm();
  switch (cfg.provider) {
    case 'groq':
      return new OpenAiCompatLlm('groq', 'https://api.groq.com/openai/v1', cfg.model, cfg.apiKey);
    case 'openrouter':
      return new OpenAiCompatLlm('openrouter', 'https://openrouter.ai/api/v1', cfg.model, cfg.apiKey);
    case 'ollama':
      return new OpenAiCompatLlm('ollama', `${cfg.baseUrl ?? 'http://localhost:11434'}/v1`, cfg.model);
    case 'gemini':
      return new GeminiLlm(cfg.model, cfg.apiKey ?? '');
    default:
      return new DisabledLlm();
  }
}

/** Strip markdown code fences so JSON responses parse cleanly. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : body.trim();
}
