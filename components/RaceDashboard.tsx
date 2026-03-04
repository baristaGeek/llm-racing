'use client'

import { useCallback, useRef, useState } from 'react'
import type { ModelRaceState, RaceEvent } from '@/lib/types'
import { MODELS } from '@/lib/models'
import RaceLane from './RaceLane'

const SUGGESTED_PROMPTS = [
  'Explain quantum entanglement in simple terms',
  'Write a haiku about machine learning',
  'What is the meaning of life?',
  'Give me 5 creative startup ideas',
  'How does HTTPS work?',
]

function makeInitialStates(): Record<string, ModelRaceState> {
  return Object.fromEntries(
    MODELS.map((config) => [
      config.id,
      {
        config,
        status: 'idle' as const,
        text: '',
        totalChars: 0,
        approxTokens: 0,
        tps: 0,
      },
    ])
  )
}

function playWinSound() {
  try {
    const ctx = new AudioContext()
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      const t = ctx.currentTime + i * 0.1
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25)
      osc.start(t)
      osc.stop(t + 0.25)
    })
  } catch {
    // AudioContext not available
  }
}

async function fireConfetti(color: string) {
  const confetti = (await import('canvas-confetti')).default
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.5 },
    colors: [color, '#ffffff', '#ffd54f'],
    gravity: 1.2,
    scalar: 0.9,
  })
}

export default function RaceDashboard() {
  const [prompt, setPrompt] = useState('')
  const [models, setModels] = useState<Record<string, ModelRaceState>>(makeInitialStates())
  const [isRacing, setIsRacing] = useState(false)
  const [raceComplete, setRaceComplete] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const finishOrderRef = useRef<string[]>([])
  const winnerFiredRef = useRef(false)

  const startRace = useCallback(async () => {
    if (!prompt.trim() || isRacing) return

    // Reset state
    finishOrderRef.current = []
    winnerFiredRef.current = false
    setModels(makeInitialStates())
    setRaceComplete(false)
    setWinner(null)
    setIsRacing(true)

    // Mark all as waiting
    setModels(
      Object.fromEntries(
        MODELS.map((config) => [
          config.id,
          { config, status: 'waiting' as const, text: '', totalChars: 0, approxTokens: 0, tps: 0 },
        ])
      )
    )

    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/race', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: abort.signal,
      })

      if (!res.ok || !res.body) throw new Error('API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.replace(/^data: /, '').trim()
          if (!line) continue

          let event: RaceEvent
          try {
            event = JSON.parse(line)
          } catch {
            continue
          }

          if (event.type === 'all_done') {
            setIsRacing(false)
            setRaceComplete(true)
            break
          }

          if (!event.modelId) continue
          const modelId = event.modelId

          setModels((prev) => {
            const current = prev[modelId]
            if (!current) return prev

            if (event.type === 'ttft') {
              return {
                ...prev,
                [modelId]: { ...current, status: 'racing', ttft: event.ttft },
              }
            }

            if (event.type === 'token') {
              return {
                ...prev,
                [modelId]: {
                  ...current,
                  status: 'racing',
                  text: current.text + event.text,
                  totalChars: event.totalChars,
                  approxTokens: event.approxTokens,
                  tps: event.tps,
                },
              }
            }

            if (event.type === 'done') {
              finishOrderRef.current = [...finishOrderRef.current, modelId]
              const position = finishOrderRef.current.length

              if (!winnerFiredRef.current) {
                winnerFiredRef.current = true
                setWinner(modelId)
                playWinSound()
                fireConfetti(current.config.color)
              }

              return {
                ...prev,
                [modelId]: {
                  ...current,
                  status: 'finished',
                  totalTime: event.totalTime,
                  finalTps: event.finalTps,
                  approxTokens: event.approxTokens,
                  position,
                },
              }
            }

            if (event.type === 'error') {
              return {
                ...prev,
                [modelId]: { ...current, status: 'error', error: event.error },
              }
            }

            return prev
          })
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Race error:', err)
      }
    } finally {
      setIsRacing(false)
    }
  }, [prompt, isRacing])

  const stopRace = useCallback(() => {
    abortRef.current?.abort()
    setIsRacing(false)
  }, [])

  const sortedModels = [...MODELS].sort((a, b) => {
    const sa = models[a.id]
    const sb = models[b.id]
    if (sa.position && sb.position) return sa.position - sb.position
    if (sa.position) return -1
    if (sb.position) return 1
    return (sb.approxTokens || 0) - (sa.approxTokens || 0)
  })

  const winnerModel = winner ? MODELS.find((m) => m.id === winner) : null

  return (
    <div className="min-h-screen flex flex-col">
      {/* GitHub Star Badge */}
      <a
        href="https://github.com/baristaGeek/llm-racing"
        target="_blank"
        rel="noopener noreferrer"
        className="github-star-btn"
        aria-label="Star on GitHub"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <span>Star on GitHub</span>
        <span className="github-star-icon">⭐</span>
      </a>

      {/* Header */}
      <header className="text-center py-10 px-4">
        <div className="inline-flex items-center gap-3 mb-3">
          <span className="text-4xl">🏁</span>
          <h1
            className="text-5xl font-black tracking-tight uppercase"
            style={{
              background: 'linear-gradient(135deg, #ff3366, #ff6b35, #ffd54f)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: 'none',
            }}
          >
            LLM Drag Race
          </h1>
          <span className="text-4xl">🏎️</span>
        </div>
        <p className="text-slate-500 text-sm tracking-widest uppercase">
          Real-time TTFT &amp; TPS benchmark · 4 models · 1 winner
        </p>

        {/* Model pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {MODELS.map((m) => (
            <span
              key={m.id}
              className="text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"
              style={{
                background: m.dimColor,
                color: m.color,
                border: `1px solid ${m.color}30`,
              }}
            >
              {m.name}
            </span>
          ))}
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-4xl mx-auto w-full px-4 mb-6">
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: '#0d0d14', border: '1px solid #1e1e2e' }}
        >
          <textarea
            className="race-input w-full rounded-xl px-4 py-3 text-sm min-h-[80px]"
            placeholder="Type your prompt here... (e.g. 'Explain quantum entanglement in simple terms')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) startRace()
            }}
            disabled={isRacing}
          />

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                disabled={isRacing}
                className="text-[11px] px-2.5 py-1 rounded-full text-slate-500 hover:text-slate-300 transition-colors"
                style={{ background: '#12121c', border: '1px solid #1e1e2e' }}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={isRacing ? stopRace : startRace}
              disabled={!prompt.trim() && !isRacing}
              className="race-btn px-8 py-3 rounded-xl text-sm flex items-center gap-2"
            >
              {isRacing ? (
                <>
                  <span className="animate-spin">⏳</span> RACING...
                </>
              ) : (
                <>🏁 RACE!</>
              )}
            </button>

            <span className="text-[11px] text-slate-600">
              ⌘ + Enter to race
            </span>

            {/* Live total TPS */}
            {isRacing && (
              <div className="ml-auto flex items-center gap-4">
                {MODELS.map((m) => {
                  const s = models[m.id]
                  if (s.status !== 'racing' && s.status !== 'finished') return null
                  return (
                    <div key={m.id} className="text-center">
                      <div className="text-[10px] text-slate-600 uppercase">{m.shortName}</div>
                      <div
                        className="text-sm font-black tabular-nums"
                        style={{ color: m.color, textShadow: `0 0 8px ${m.color}` }}
                      >
                        {(s.status === 'finished' ? s.finalTps ?? s.tps : s.tps).toFixed(0)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Winner banner */}
      {raceComplete && winnerModel && (
        <div
          className="max-w-4xl mx-auto w-full px-4 mb-4"
        >
          <div
            className="rounded-2xl px-6 py-4 flex items-center gap-4 text-center justify-center"
            style={{
              background: winnerModel.dimColor,
              border: `1px solid ${winnerModel.color}50`,
              boxShadow: `0 0 30px ${winnerModel.glowColor}`,
            }}
          >
            <span className="text-3xl medal-pop">🏆</span>
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-0.5">Winner</div>
              <div className="text-2xl font-black" style={{ color: winnerModel.color, textShadow: `0 0 15px ${winnerModel.color}` }}>
                {winnerModel.name}
              </div>
            </div>
            <span className="text-3xl flag-wave">🏁</span>
            {models[winnerModel.id].ttft && (
              <div className="ml-4 text-right">
                <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-0.5">TTFT</div>
                <div className="text-lg font-bold" style={{ color: winnerModel.color }}>
                  {models[winnerModel.id].ttft}ms
                </div>
              </div>
            )}
            {models[winnerModel.id].finalTps && (
              <div className="text-right">
                <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-0.5">Avg tok/s</div>
                <div className="text-lg font-bold" style={{ color: winnerModel.color }}>
                  {models[winnerModel.id].finalTps?.toFixed(1)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Race track */}
      <div className="max-w-4xl mx-auto w-full px-4 pb-12 flex flex-col gap-3">
        {sortedModels.map((model, i) => (
          <RaceLane key={model.id} state={models[model.id]} rank={i + 1} />
        ))}
      </div>

      {/* Results table */}
      {raceComplete && (
        <div className="max-w-4xl mx-auto w-full px-4 pb-12">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid #1e1e2e' }}
          >
            <div
              className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-slate-500"
              style={{ background: '#0d0d14', borderBottom: '1px solid #1e1e2e' }}
            >
              Results
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#0a0a12', borderBottom: '1px solid #1e1e2e' }}>
                  {['#', 'Model', 'TTFT', 'Avg tok/s', 'Total Time', '~Tokens'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-[11px] text-slate-600 uppercase tracking-wider font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedModels.map((model) => {
                  const s = models[model.id]
                  const medals = ['🥇', '🥈', '🥉', '4️⃣']
                  return (
                    <tr
                      key={model.id}
                      style={{
                        background: s.position === 1 ? model.dimColor : 'transparent',
                        borderBottom: '1px solid #1e1e2e',
                      }}
                    >
                      <td className="px-4 py-3 text-lg">{s.position ? medals[s.position - 1] : '—'}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: model.color }}>
                        {model.name}
                      </td>
                      <td className="px-4 py-3 text-slate-400 tabular-nums">
                        {s.ttft !== undefined ? `${s.ttft}ms` : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-bold" style={{ color: model.color }}>
                        {s.finalTps !== undefined ? `${s.finalTps.toFixed(1)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 tabular-nums">
                        {s.totalTime !== undefined
                          ? s.totalTime < 1000
                            ? `${s.totalTime}ms`
                            : `${(s.totalTime / 1000).toFixed(2)}s`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 tabular-nums">
                        ~{s.approxTokens}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-center text-[11px] text-slate-600 mt-3">
            tok/s and token counts are estimated from character output (~4 chars/token)
          </p>
        </div>
      )}
    </div>
  )
}
