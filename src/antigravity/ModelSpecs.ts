type ModelSpec = {
  max_output_tokens?: number;
  thinking_budget?: number;
  is_thinking?: boolean;
};

type SpecsConfig = {
  models: Record<string, ModelSpec>;
  aliases: Record<string, string>;
};

const DEFAULT_MAX_OUTPUT_TOKENS = 65535;
const DEFAULT_THINKING_BUDGET = 24576;

const SPECS: SpecsConfig = {
  models: {
    'gemini-3-flash': {
      max_output_tokens: 65536,
      thinking_budget: 32768,
      is_thinking: true
    },
    'gemini-3.1-pro-low': {
      max_output_tokens: 65536,
      thinking_budget: 32768,
      is_thinking: true
    },
    'gemini-3.1-pro-high': {
      max_output_tokens: 65536,
      thinking_budget: 32768,
      is_thinking: true
    },
    'gemini-3-pro-image': {
      max_output_tokens: 65536,
      thinking_budget: 24576,
      is_thinking: true
    },
    'claude-sonnet-4-6-thinking': {
      max_output_tokens: 64000,
      thinking_budget: 32768,
      is_thinking: true
    },
    'claude-opus-4-6-thinking': {
      max_output_tokens: 64000,
      thinking_budget: 32768,
      is_thinking: true
    },
    'gpt-oss-120b-medium': {
      max_output_tokens: 32768,
      thinking_budget: 0,
      is_thinking: false
    }
  },
  aliases: {
    'gpt-4o': 'gemini-3-flash',
    'gpt-3.5-turbo': 'gemini-3-flash',
    'gemini-2.0-flash': 'gemini-3-flash',
    'gemini-2.5-flash': 'gemini-3-flash',
    'gemini-3.1-pro': 'gemini-3.1-pro-high',
    'gemini-3.1-pro-preview': 'gemini-3.1-pro-high',
    'claude-sonnet-4-6': 'claude-sonnet-4-6-thinking',
    'claude-sonnet-4-5': 'claude-sonnet-4-6-thinking',
    'claude-3-5-sonnet': 'claude-sonnet-4-6-thinking',
    'claude-3-7-sonnet': 'claude-sonnet-4-6-thinking',
    'claude-opus-4-5-thinking': 'claude-opus-4-6-thinking'
  }
};

export function resolveModelAlias(modelId: string): string {
  const normalized = modelId.trim();
  return SPECS.aliases[normalized] ?? normalized;
}

export function getMaxOutputTokens(modelId: string): number {
  const resolved = resolveModelAlias(modelId);
  const fromSpec = SPECS.models[resolved]?.max_output_tokens;
  if (typeof fromSpec === 'number' && Number.isFinite(fromSpec) && fromSpec > 0) {
    return Math.floor(fromSpec);
  }
  return DEFAULT_MAX_OUTPUT_TOKENS;
}

export function getThinkingBudget(modelId: string): number {
  const resolved = resolveModelAlias(modelId);
  const fromSpec = SPECS.models[resolved]?.thinking_budget;
  if (typeof fromSpec === 'number' && Number.isFinite(fromSpec) && fromSpec >= 0) {
    return Math.floor(fromSpec);
  }
  return DEFAULT_THINKING_BUDGET;
}
