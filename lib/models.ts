import type { ModelConfig } from './types'

export const MODELS: ModelConfig[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'openai',
    color: '#00ff94',
    dimColor: 'rgba(0,255,148,0.15)',
    glowColor: 'rgba(0,255,148,0.4)',
    shortName: 'GPT',
    emoji: '🟢',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    color: '#ff6b6b',
    dimColor: 'rgba(255,107,107,0.15)',
    glowColor: 'rgba(255,107,107,0.4)',
    shortName: 'CLA',
    emoji: '🔴',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    color: '#4fc3f7',
    dimColor: 'rgba(79,195,247,0.15)',
    glowColor: 'rgba(79,195,247,0.4)',
    shortName: 'GEM',
    emoji: '🔵',
  },
]

export const MAX_TOKENS = 400
