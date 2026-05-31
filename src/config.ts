import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

/** Raw environment schema with safe coercion + defaults. */
const RawEnv = z.object({
  LLM_PROVIDER: z.enum(['groq', 'gemini', 'openrouter', 'ollama', 'none']).default('none'),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  LLM_MODEL: z.string().optional(),
  POLYMARKET_GAMMA_URL: z.string().url().default('https://gamma-api.polymarket.com'),
  POLYMARKET_CLOB_URL: z.string().url().default('https://clob.polymarket.com'),
  MIN_EDGE: z.coerce.number().min(0).max(1).default(0.02),
  KELLY_FRACTION: z.coerce.number().min(0).max(1).default(0.25),
  MAX_STAKE_PER_LEG: z.coerce.number().min(0).default(50),
  BANKROLL: z.coerce.number().min(0).default(1000),
  TAKER_FEE_BPS: z.coerce.number().min(0).default(0),
  POLL_INTERVAL_MS: z.coerce.number().min(1000).default(15000),
  EXECUTION_MODE: z.enum(['paper', 'live']).default('paper'),
});

export type LlmProvider = z.infer<typeof RawEnv>['LLM_PROVIDER'];

/** Sensible free-tier default model per provider. */
const DEFAULT_MODELS: Record<LlmProvider, string> = {
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.0-flash',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  ollama: 'llama3.1',
  none: '',
};

export interface LlmConfig {
  provider: LlmProvider;
  /** True only when a usable provider + credential is present. */
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export interface RiskConfig {
  minEdge: number;
  kellyFraction: number;
  maxStakePerLegUsd: number;
  bankrollUsd: number;
  takerFeeBps: number;
}

export interface Config {
  llm: LlmConfig;
  polymarket: { gammaUrl: string; clobUrl: string };
  risk: RiskConfig;
  pollIntervalMs: number;
  executionMode: 'paper' | 'live';
}

/** Parse `process.env` into a validated, typed {@link Config}. */
export function loadConfig(): Config {
  const env = RawEnv.parse(process.env);

  const apiKeyByProvider: Record<LlmProvider, string | undefined> = {
    groq: env.GROQ_API_KEY,
    gemini: env.GEMINI_API_KEY,
    openrouter: env.OPENROUTER_API_KEY,
    ollama: undefined,
    none: undefined,
  };

  const apiKey = apiKeyByProvider[env.LLM_PROVIDER];
  // Ollama is local and needs no key; every other real provider needs one.
  const enabled =
    env.LLM_PROVIDER !== 'none' && (env.LLM_PROVIDER === 'ollama' || Boolean(apiKey));

  const llm: LlmConfig = {
    provider: env.LLM_PROVIDER,
    enabled,
    apiKey,
    baseUrl: env.LLM_PROVIDER === 'ollama' ? env.OLLAMA_BASE_URL : undefined,
    model: env.LLM_MODEL ?? DEFAULT_MODELS[env.LLM_PROVIDER],
  };

  return {
    llm,
    polymarket: { gammaUrl: env.POLYMARKET_GAMMA_URL, clobUrl: env.POLYMARKET_CLOB_URL },
    risk: {
      minEdge: env.MIN_EDGE,
      kellyFraction: env.KELLY_FRACTION,
      maxStakePerLegUsd: env.MAX_STAKE_PER_LEG,
      bankrollUsd: env.BANKROLL,
      takerFeeBps: env.TAKER_FEE_BPS,
    },
    pollIntervalMs: env.POLL_INTERVAL_MS,
    executionMode: env.EXECUTION_MODE,
  };
}
