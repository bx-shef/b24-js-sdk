import { streamText, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import type { UIMessageStreamWriter, ToolCallPart, ToolSet } from 'ai'
import { createMCPClient } from '@ai-sdk/mcp'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { assistantGuard, assertMessages, chargeAssistant } from '../utils/guard'

const MAX_STEPS = 10

function stopWhenResponseComplete({ steps }: { steps: any[] }): boolean {
  const lastStep = steps.at(-1)
  if (!lastStep) return false

  // Primary condition: stop when model gives a text response without tool calls
  const hasText = Boolean(lastStep.text && lastStep.text.trim().length > 0)
  const hasNoToolCalls = !lastStep.toolCalls || lastStep.toolCalls.length === 0

  if (hasText && hasNoToolCalls) return true

  return steps.length >= MAX_STEPS
}

function getSystemPrompt(siteName: string) {
  return `You are the documentation assistant for ${siteName}. Help users navigate and understand the project documentation.

**Your identity:**
- You are an assistant helping users with ${siteName} documentation
- NEVER use first person ("I", "me", "my") - always refer to the project by name: "${siteName} provides...", "${siteName} supports...", "The project offers..."
- Be confident and knowledgeable about the project
- Speak as a helpful guide, not as the documentation itself

**Tool usage (CRITICAL):**
- You have tools: list-pages (discover pages) and get-page (read a page)
- If a page title clearly matches the question, read it directly without listing first
- ALWAYS respond with text after using tools - never end with just tool calls

**Guidelines:**
- If you can't find something, say "There is no documentation on that yet" or "${siteName} doesn't cover that topic yet"
- Be concise, helpful, and direct
- Guide users like a friendly expert would

**Links and exploration:**
- Tool results include a \`url\` for each page — prefer markdown links \`[label](url)\` so users can open the doc in one click
- When it helps, add extra links (related pages, “read more”, side topics) — make the answer easy to dig into, not a wall of text
- Stick to URLs from tool results (\`url\` / \`path\`) so links stay valid

**FORMATTING RULES (CRITICAL):**
- NEVER use markdown headings (#, ##, ###, etc.)
- Use **bold text** for emphasis and section labels
- Start responses with content directly, never with a heading
- Use bullet points for lists
- Keep code examples focused and minimal

**Response style:**
- Conversational but professional
- "Here's how you can do that:" instead of "The documentation shows:"
- "${siteName} supports TypeScript out of the box" instead of "I support TypeScript"
- Provide actionable guidance, not just information dumps`
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  assistantGuard(event, config.public.bxAssistant?.enabled === true)
  const { messages } = (await readBody<{ messages?: unknown }>(event)) || {}
  assertMessages(messages)
  chargeAssistant(event)

  // @todo fix this
  const siteName = 'Documentation'

  const mcpServer = config.bxAssistant.mcpServer
  const isExternalUrl = mcpServer.startsWith('http://') || mcpServer.startsWith('https://')
  const baseURL = config.app?.baseURL?.replace(/\/$/, '') || ''
  const mcpUrl = isExternalUrl
    ? mcpServer
    : import.meta.dev
      ? `http://localhost:3000${baseURL}${mcpServer}`
      : `http://127.0.0.1:${process.env.PORT || process.env.NITRO_PORT || 3000}${baseURL}${mcpServer}`

  const httpClient = await createMCPClient({
    transport: { type: 'http', url: mcpUrl }
  })
  const mcpTools = await httpClient.tools()

  const deepseek = createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY ?? ''
  })

  const abortController = new AbortController()
  event.node.req.on('close', () => abortController.abort())

  const stream = createUIMessageStream({
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
      const modelMessages = await convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0])
      const result = streamText({
        model: deepseek(config.bxAssistant.modelDeepSeek),
        maxOutputTokens: 4000, // Possible values: `10000` | `8100` | `4000`
        maxRetries: 2,
        abortSignal: abortController.signal,
        stopWhen: stopWhenResponseComplete,
        system: getSystemPrompt(siteName),
        messages: modelMessages,
        tools: mcpTools as ToolSet,
        onStepFinish: ({ toolCalls }: { toolCalls: ToolCallPart[] }) => {
          if (toolCalls.length === 0) return
          writer.write({
            id: toolCalls[0]?.toolCallId,
            type: 'data-tool-calls',
            data: {
              tools: toolCalls.map((tc: ToolCallPart) => {
                const args = 'args' in tc ? tc.args : 'input' in tc ? tc.input : {}
                return {
                  toolName: tc.toolName,
                  toolCallId: tc.toolCallId,
                  args
                }
              })
            }
          })
        }
      })
      writer.merge(result.toUIMessageStream())
    },
    onFinish: async () => {
      await httpClient.close()
    }
  })

  return createUIMessageStreamResponse({ stream })
})
