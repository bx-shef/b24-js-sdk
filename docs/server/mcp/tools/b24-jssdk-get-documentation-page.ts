import { z } from 'zod'
import { withoutTrailingSlash } from 'ufo'

export default defineMcpTool({
  title: 'Страница документации',
  description: 'Текст страницы документации по пути (Markdown; блоки REST API v2 и v3 помечены)',
  inputSchema: {
    /** @memo only paths under `/docs/`; the site base URL is not accepted */
    path: z.string()
      // Только путь внутри /docs/: без `..`, `?`, `#`, `%` (путь уходит в $fetch(`/raw${path}.md`))
      .regex(/^\/docs\/[\w/.-]+$/, 'Path must look like /docs/actions/call')
      .refine(value => !value.includes('..'), 'Path must not contain ..')
      .describe('Путь страницы (например, /docs/actions/call)')
  },
  cache: '30m',
  async handler({ path }) {
    try {
      const config = useRuntimeConfig()

      const fixPath = withoutTrailingSlash(path.replace(config.public.baseUrl, ''))

      const result = await $fetch<string>(`/raw${fixPath}.md`)
      return {
        content: [{ type: 'text' as const, text: result }]
      }
    } catch (error) {
      return errorResult(`Failed to fetch documentation page: ${error}`)
    }
  }
})
