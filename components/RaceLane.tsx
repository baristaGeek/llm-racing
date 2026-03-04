'use client'

import { useEffect, useRef, useState } from 'react'
import type { ModelRaceState } from '@/lib/types'

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣']
const MAX_CHARS_ESTIMATE = 1600

function formatMs(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

function formatTps(tps: number) {
  return tps.toFixed(1)
}

type Props = {
  state: ModelRaceState
  rank: number
}

export default function RaceLane({ state, rank }: Props) {
  const { config, status, text, tps, ttft, totalTime, finalTps, position, error, totalChars } = state
  const textRef = useRef<HTMLDivElement>(null)
  const [tpsKey, setTpsKey] = useState(0)
  const prevTpsRef = useRef(tps)

  // Auto-scroll text output
  useEffect(() => {
    if (textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight
    }
  }, [text])

  // Flash TPS number on significant change
  useEffect(() => {
    if (Math.abs(tps - prevTpsRef.current) > 5) {
      setTpsKey((k) => k + 1)
      prevTpsRef.current = tps
    }
  }, [tps])

  const progress = Math.min(totalChars / MAX_CHARS_ESTIMATE, status === 'finished' ? 1 : 0.97)
  const displayTps = status === 'finished' ? (finalTps ?? tps) : tps
  const isActive = status === 'racing'
  const isDone = status === 'finished'
  const isError = status === 'error'

  const borderGlow = isDone
    ? `0 0 0 1px ${config.color}80, 0 0 30px ${config.glowColor}`
    : isActive
    ? `0 0 0 1px ${config.color}30`
    : '0 0 0 1px #1e1e2e'

  return (
    <div
      className="race-lane rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: isDone ? config.dimColor : '#0d0d14',
        boxShadow: borderGlow,
        border: `1px solid ${isDone ? config.color + '40' : '#1e1e2e'}`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        {/* Model identity */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Colored badge */}
          <span
            className="text-xs font-black px-2 py-0.5 rounded shrink-0"
            style={{
              background: config.dimColor,
              color: config.color,
              border: `1px solid ${config.color}50`,
              textShadow: `0 0 8px ${config.color}`,
            }}
          >
            {config.shortName}
          </span>
          <span
            className="font-bold text-sm truncate"
            style={{ color: isDone || isActive ? config.color : '#94a3b8' }}
          >
            {config.name}
          </span>

          {/* Status indicator */}
          {isActive && (
            <span className="status-racing w-2 h-2 rounded-full shrink-0" style={{ background: config.color }} />
          )}
        </div>

        {/* Right side stats */}
        <div className="flex items-center gap-3 shrink-0">
          {/* TTFT badge */}
          {ttft !== undefined && (
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">TTFT</div>
              <div className="text-xs font-bold" style={{ color: config.color }}>
                {formatMs(ttft)}
              </div>
            </div>
          )}

          {/* TPS */}
          {(isActive || isDone) && displayTps > 0 && (
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">tok/s</div>
              <div
                key={tpsKey}
                className="text-lg font-black tps-flash tabular-nums"
                style={{
                  color: config.color,
                  textShadow: `0 0 15px ${config.color}`,
                }}
              >
                {formatTps(displayTps)}
              </div>
            </div>
          )}

          {/* Finish medal */}
          {isDone && position !== undefined && (
            <div className="medal-pop text-2xl" title={`Finished #${position}`}>
              {MEDALS[position - 1] ?? '🏁'}
            </div>
          )}

          {/* Waiting state */}
          {status === 'waiting' && (
            <div className="text-slate-600 text-xs animate-pulse">READY</div>
          )}

          {/* Total time */}
          {isDone && totalTime !== undefined && (
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">total</div>
              <div className="text-xs font-bold text-slate-400">{formatMs(totalTime)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Race bar */}
      <div className="race-bar-track h-8 relative">
        <div
          className="race-bar-fill h-full"
          style={{
            width: `${Math.max(progress * 100, status === 'idle' ? 0 : 2)}%`,
            background: isDone
              ? `linear-gradient(90deg, ${config.color}80, ${config.color})`
              : `linear-gradient(90deg, ${config.color}60, ${config.color})`,
            boxShadow: isActive
              ? `0 0 12px ${config.glowColor}, inset 0 0 8px rgba(255,255,255,0.1)`
              : isDone
              ? `0 0 8px ${config.glowColor}`
              : 'none',
          }}
        />

        {/* Car emoji at the leading edge */}
        {(isActive || isDone) && (
          <div
            className="absolute top-1/2 -translate-y-1/2 text-lg leading-none pointer-events-none select-none transition-[left] duration-75"
            style={{
              left: `calc(${Math.max(progress * 100, 2)}% - ${isDone ? '18px' : '22px'})`,
              filter: `drop-shadow(0 0 6px ${config.color})`,
              animation: isActive ? 'car-bounce 0.3s ease-in-out infinite alternate' : undefined,
            }}
          >
            {isDone ? '🏁' : '🏎️'}
          </div>
        )}

        {/* Idle state label */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-600">
            STANDBY
          </div>
        )}
        {status === 'waiting' && (
          <div className="absolute inset-0 flex items-center justify-center text-xs animate-pulse" style={{ color: config.color + '80' }}>
            CONNECTING...
          </div>
        )}
      </div>

      {/* Streaming text */}
      <div ref={textRef} className="stream-text min-h-[3rem]">
        {isError ? (
          <span className="text-red-400 text-xs">Error: {error}</span>
        ) : (
          <>
            {text}
            {isActive && (
              <span
                className="inline-block w-[2px] h-[1em] ml-0.5 align-middle animate-pulse"
                style={{ background: config.color }}
              />
            )}
          </>
        )}
      </div>

      {/* Finish banner */}
      {isDone && (
        <div
          className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg"
          style={{
            background: config.dimColor,
            color: config.color,
            border: `1px solid ${config.color}30`,
          }}
        >
          <span className="flag-wave">🏁</span>
          <span>FINISHED</span>
          <span className="ml-auto text-slate-400 font-normal">
            ~{state.approxTokens} tokens
          </span>
        </div>
      )}
    </div>
  )
}
