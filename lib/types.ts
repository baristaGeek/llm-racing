export type Provider = 'openai' | 'anthropic' | 'gemini'

export type ModelConfig = {
  id: string
  name: string
  provider: Provider
  color: string
  dimColor: string
  glowColor: string
  shortName: string
  emoji: string
}

export type ModelRaceState = {
  config: ModelConfig
  status: 'idle' | 'waiting' | 'racing' | 'finished' | 'error'
  text: string
  totalChars: number
  approxTokens: number
  tps: number
  ttft?: number
  totalTime?: number
  finalTps?: number
  position?: number
  error?: string
}

export type RaceEvent =
  | { type: 'token'; modelId: string; text: string; totalChars: number; approxTokens: number; tps: number }
  | { type: 'ttft'; modelId: string; ttft: number }
  | { type: 'done'; modelId: string; totalTime: number; finalTps: number; approxTokens: number }
  | { type: 'error'; modelId: string; error: string }
  | { type: 'all_done' }
