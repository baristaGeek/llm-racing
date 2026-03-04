import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS, MAX_TOKENS } from '@/lib/models'
import type { ModelConfig, RaceEvent } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

function isRetryable(err: unknown): boolean {
  const s = String(err).toLowerCase()
  return (
    s.includes('overloaded') ||
    s.includes('529') ||
    s.includes('429') ||
    s.includes('too many requests') ||
    s.includes('resource_exhausted')
  )
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: RaceEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // stream closed
        }
      }

      const raceModel = async (model: ModelConfig) => {
        const startTime = Date.now()
        const maxAttempts = 3

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          let totalChars = 0
          let firstToken = true
          let tokensSent = false

          try {
            if (model.provider === 'openai') {
              const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
              const openaiStream = await client.chat.completions.create({
                model: model.id,
                messages: [{ role: 'user', content: prompt }],
                stream: true,
                max_tokens: MAX_TOKENS,
              })

              for await (const chunk of openaiStream) {
                const text = chunk.choices[0]?.delta?.content
                if (text) {
                  if (firstToken) {
                    firstToken = false
                    tokensSent = true
                    send({ type: 'ttft', modelId: model.id, ttft: Date.now() - startTime })
                  }
                  totalChars += text.length
                  const approxTokens = Math.round(totalChars / 4)
                  const tps = approxTokens / ((Date.now() - startTime) / 1000)
                  send({ type: 'token', modelId: model.id, text, totalChars, approxTokens, tps })
                }
              }
            } else if (model.provider === 'anthropic') {
              const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
              const anthropicStream = await client.messages.create({
                model: model.id,
                max_tokens: MAX_TOKENS,
                messages: [{ role: 'user', content: prompt }],
                stream: true,
              })

              for await (const event of anthropicStream) {
                if (
                  event.type === 'content_block_delta' &&
                  event.delta.type === 'text_delta' &&
                  event.delta.text
                ) {
                  const text = event.delta.text
                  if (firstToken) {
                    firstToken = false
                    tokensSent = true
                    send({ type: 'ttft', modelId: model.id, ttft: Date.now() - startTime })
                  }
                  totalChars += text.length
                  const approxTokens = Math.round(totalChars / 4)
                  const tps = approxTokens / ((Date.now() - startTime) / 1000)
                  send({ type: 'token', modelId: model.id, text, totalChars, approxTokens, tps })
                }
              }
            } else if (model.provider === 'gemini') {
              const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
              const geminiModel = genAI.getGenerativeModel({
                model: model.id,
                generationConfig: { maxOutputTokens: MAX_TOKENS },
              })
              const result = await geminiModel.generateContentStream(prompt)

              for await (const chunk of result.stream) {
                const text = chunk.text()
                if (text) {
                  if (firstToken) {
                    firstToken = false
                    tokensSent = true
                    send({ type: 'ttft', modelId: model.id, ttft: Date.now() - startTime })
                  }
                  totalChars += text.length
                  const approxTokens = Math.round(totalChars / 4)
                  const tps = approxTokens / ((Date.now() - startTime) / 1000)
                  send({ type: 'token', modelId: model.id, text, totalChars, approxTokens, tps })
                }
              }
            }

            // Success — send final stats and return
            const totalTime = Date.now() - startTime
            const approxTokens = Math.round(totalChars / 4)
            const finalTps = approxTokens / (totalTime / 1000)
            send({ type: 'done', modelId: model.id, totalTime, finalTps, approxTokens })
            return
          } catch (err) {
            // If tokens already started streaming or error isn't retryable, give up
            if (tokensSent || !isRetryable(err) || attempt === maxAttempts) {
              const error = err instanceof Error ? err.message : String(err)
              send({ type: 'error', modelId: model.id, error })
              return
            }
            // Wait before retrying (1s, 2s)
            await new Promise((r) => setTimeout(r, 1000 * attempt))
          }
        }
      }

      await Promise.allSettled(MODELS.map((m) => raceModel(m)))
      send({ type: 'all_done' })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
