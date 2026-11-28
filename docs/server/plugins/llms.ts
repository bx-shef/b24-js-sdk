import type { H3Event } from 'h3'
import type { PageCollectionItemBase } from '@nuxt/content'
import { withoutTrailingSlash } from 'ufo'
import { clearMD } from '../utils/clearMD'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('content:llms:generate:document', async (event: H3Event, doc: PageCollectionItemBase) => {
    if (doc.body.value[0]?.[0] !== 'h1') {
      doc.body.value.push(['hr', {}, ''])
      doc.body.value.unshift(['blockquote', {}, doc.description])
    }

    await transformMDC(event, doc as any)
  })

  nitroApp.hooks.hook('llms:generate', (_, { sections }) => {
    // Transform links except for "Documentation Sets"
    sections.forEach((section) => {
      if (section.title !== 'Documentation Sets') {
        section.links = section.links.map(link => ({
          ...link,
          href: transformRawLink(link.href)
        }))
      }
    })

    // Раздел о MCP-сервере (свой вместо раздела модуля, mcp.llms: false в nuxt.config.ts): адрес сервера —
    // как есть, страница о подключении — в /raw/…md, как остальные ссылки llms.txt.
    const config = useRuntimeConfig()
    const site = `${config.public.canonicalUrl}${config.public.baseUrl}`
    sections.push({
      title: 'MCP-сервер',
      description: `Сайт работает как MCP-сервер (Model Context Protocol, транспорт Streamable HTTP, без авторизации): ${site}/mcp/. Инструменты — список и текст страниц документации, примеры кода; промпты — подбор метода SDK и генерация примера.`,
      links: [
        {
          title: 'Адрес MCP-сервера',
          description: 'Подключите к этому адресу клиент MCP (Claude Code, Cursor, VS Code, Windsurf), чтобы агент сам читал документацию и примеры.',
          href: `${site}/mcp/`
        },
        {
          title: 'Как подключить MCP-сервер',
          description: 'Команды и настройки для Claude Code, Cursor, VS Code и Windsurf; список инструментов и промптов.',
          href: `${site}/raw/docs/getting-started/ai/mcp.md`
        }
      ]
    })

    // Move "Documentation Sets" to the end
    const docSetIdx = sections.findIndex(s => s.title === 'Documentation Sets')
    if (docSetIdx !== -1) {
      const [docSet] = sections.splice(docSetIdx, 1)
      sections.push(docSet)
    }
  })

  /**
   * @see docs/server/routes/raw/[...slug].md.get.ts
   */
  nitroApp.hooks.hook('beforeResponse', (event, content) => {
    if (event.path === '/llms-full.txt') {
      content.body = clearMD(content.body)
    }
  })
})

function transformRawLink(href: string) {
  const config = useRuntimeConfig()

  return `${withoutTrailingSlash(href.replace(new RegExp(`^${config.public.canonicalUrl}${config.public.baseUrl}`), `${config.public.canonicalUrl}${config.public.baseUrl}/raw`))}.md`
}
