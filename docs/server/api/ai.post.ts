// @memo we not use jsonSchema
import { streamText, convertToModelMessages, smoothStream, stepCountIs, jsonSchema } from 'ai'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { assistantGuard, assertMessages, chargeAssistant, trimToolOutputs, chatErrorText, logChatError } from '../../modules/bx-assistant/runtime/server/utils/guard'
import { z } from 'zod'
import { tools as mcpToolDefinitions } from '#nuxt-mcp-toolkit/tools.mjs'

/**
 * @docs https://ai-sdk.dev/providers/ai-sdk-providers/deepseek
 * @memo sync with: docs/content/docs/2.components/chat.md:297
 */

const maxStepCount = 5

// async function initMcpToolsForUI() {
//   const httpTransport = new StreamableHTTPClientTransport(
//     new URL(`https://b24ui.bx-shef.by/b24ui/mcp/`)
//   )
//   const httpClient = await experimental_createMCPClient({
//     transport: httpTransport
//   })
//   return await httpClient.tools()
// }
//
// async function initMcpToolsForB24RestApi() {
//   const httpTransport = new StreamableHTTPClientTransport(
//     new URL(`https://mcp-dev.bitrix24.tech/mcp`)
//   )
//   const httpClient = await experimental_createMCPClient({
//     transport: httpTransport
//   })
//   return await httpClient.tools()
// }

function mcpToolsToAiTools() {
  const aiTools: Record<string, { description: string, inputSchema: ReturnType<typeof jsonSchema>, execute: (args: any) => Promise<any> }> = {}

  for (const def of mcpToolDefinitions as any[]) {
    const filename = def._meta?.filename as string | undefined
    const name = def.name || (filename
      ? filename.replace(/\.(ts|js|mts|mjs)$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase()
      : null)
    if (!name) continue

    const schema = def.inputSchema
      ? z.toJSONSchema(z.object(def.inputSchema)) as Record<string, unknown>
      : { type: 'object' as const, properties: {} }

    aiTools[name] = {
      description: def.description || '',
      inputSchema: jsonSchema(schema),
      execute: async (args: any) => {
        try {
          return await def.handler(args, {})
        } catch (error: any) {
          return { error: error.statusCode ? `[${error.statusCode}] ${error.message}` : error.message || String(error) }
        }
      }
    }
  }

  return aiTools
}

export default defineEventHandler(async (event) => {
  assistantGuard(event, useRuntimeConfig().public.bxAssistant?.enabled === true)

  const { messages, restApiVersion, currentPage } = (await readBody<{ messages?: any, restApiVersion?: string, currentPage?: string }>(event)) || {}

  assertMessages(messages)
  chargeAssistant(event)

  const safeRestApiVersion = restApiVersion === 'vue' ? 'vue' : 'nuxt'

  const safePage = currentPage
    ? currentPage.replace(/[^\w\-/. ]/g, '').slice(0, 300)
    : undefined

  const mcpTools = mcpToolsToAiTools()

  const deepseek = createDeepSeek({
    apiKey: (process.env.DEEPSEEK_API_KEY ?? '').trim()
  })

  const abortController = new AbortController()
  event.node.req.on('close', () => abortController.abort())

  // Ссылка на страницу заявки: baseURL сайта (на GitHub Pages — с префиксом) + /request
  const requestUrl = `${(useRuntimeConfig().app?.baseURL ?? '/').replace(/\/$/, '')}/request?source=chat`

  const system = `You are a helpful assistant for Bitrix24 JS SDK, a JavaScript/TypeScript SDK for the Bitrix24 REST API. Use your knowledge base tools to search for relevant information before answering questions.

The documentation is in Russian. Always answer in Russian, whatever language the question is in; keep code, identifiers and REST method names as they are.

The user is using **${safeRestApiVersion === 'vue' ? 'Vue' : 'Nuxt'}**. Tailor your answers accordingly — ${safeRestApiVersion === 'vue' ? 'use the Vite plugin setup, Vue Router, and vite.config.ts instead of Nuxt-specific features like modules or app.config.ts. IMPORTANT: The Vite plugin auto-imports components and Bitrix24 JS SDK composables, but Vue core APIs and VueUse must be explicitly imported — always include these in code examples (e.g. `import { ref, computed } from \'vue\'`).' : 'use Nuxt modules, auto-imports, app.config.ts, and other Nuxt-specific features. Nuxt auto-imports Vue APIs (ref, computed, etc.), composables, and components — do not include these imports in code examples.'}
${safePage ? `\nThe user is currently viewing the documentation page at \`${safePage}\`. Use this context to provide more relevant answers (e.g. read that page first if the question seems related), but don't limit yourself to that page if the question is broader or unrelated.\n` : ''}
Guidelines:
- For documentation questions, ALWAYS use tools to search for information. Never rely on pre-trained knowledge for Bitrix24 JS SDK APIs, props, or usage.
— When users ask you to apply a theme change in real time (e.g., "make it blue," "create a Sakura theme," "change the font"), tell them that the library style matches the Bitrix24 style and suggest using standard properties (color, variant).
- If a question is unrelated to Bitrix24 JS SDK (e.g. general coding, off-topic), briefly answer if you can, but don't waste tool calls searching docs for it.
- If no relevant information is found after searching, say so in Russian («В документации об этом нет.») and offer a development request (see «Development requests» below).
- Be concise and direct in your responses.

**Development requests:**
- If the question calls for custom development (an integration, an application, portal customization, a migration, anything the SDK or the documentation does not cover), or the user reports an SDK bug, or asks for a specialist, or you found no answer in the documentation — answer briefly with whatever you can and offer to leave a development request, with the Markdown link \`[Оставить заявку на разработку](${requestUrl})\`.
- Do not push the link on ordinary documentation questions. Write the offer in Russian.

General Code Design Guidelines:
- Try to use TypeScript wherever appropriate and practical.
- When writing code, use SOLID approaches where practical and appropriate, but strive for simplicity. Try to avoid creating classes.

Code Style Guidelines for Vue and Nuxt:
- Use the B24 prefix (e.g. <B24Table> and so on) for Bitrix24 user interface components.
- When constructing a list of items, you need to:
  - use Skeleton components to display the loading process
  - use the Empty component to display an empty list of items
  - use the Table component (framed by a Card component) to display the list of items

**FORMATTING RULES (CRITICAL):**
- ABSOLUTELY NO MARKDOWN HEADINGS: Never use #, ##, ###, ####, #####, or ######
- NO underline-style headings with === or ---
- Use **bold text** for emphasis and section labels instead
- Examples:
  * Instead of "## Usage", write "**Usage:**" or just "Here's how to use it:"
  * Instead of "# Complete Guide", write "**Complete Guide**" or start directly with content
- Start all responses with content, never with a heading

- Reference specific component names, props, or APIs when applicable.
- If a question is ambiguous, ask for clarification rather than guessing.
- When multiple relevant items are found, list them clearly using bullet points.
- You have up to ${maxStepCount} tool calls to find the answer, so be strategic: start broad, then get specific if needed.
- Format responses in a conversational way, not as documentation sections.
    `

  return streamText({
    // @todo fix me deepseek-reasoner | deepseek-chat
    model: deepseek('deepseek-reasoner'),
    maxOutputTokens: 8000, // 10000 | 8100
    abortSignal: abortController.signal,
    providerOptions: {},
    system,
    messages: await convertToModelMessages(trimToolOutputs(messages) as Parameters<typeof convertToModelMessages>[0]),
    experimental_transform: smoothStream(),
    stopWhen: stepCountIs(maxStepCount),
    tools: {
      ...mcpTools
    },
    onError: ({ error }) => logChatError(error)
  }).toUIMessageStreamResponse({
    // Текст для окна чата: подробности ошибки провайдера пользователю не нужны.
    onError: chatErrorText
  })
})
