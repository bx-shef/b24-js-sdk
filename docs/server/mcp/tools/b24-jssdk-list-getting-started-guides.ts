import { queryCollection } from '@nuxt/content/server'
import { withTrailingSlash } from 'ufo'

export default defineMcpTool({
  title: 'Список руководств «Быстрый старт»',
  description: 'Все руководства раздела «Быстрый старт»: установка, миграция, AI-инструменты',
  cache: '30m',
  async handler() {
    const event = useEvent()

    const pages = await queryCollection(event, 'docs')
      .where('path', 'LIKE', '/docs/getting-started/%')
      .where('extension', '=', 'md')
      .select('id', 'title', 'description', 'path', 'navigation')
      .all()

    const config = useRuntimeConfig()

    const result = pages.map(page => ({
      title: page.title,
      description: page.description,
      path: `${config.public.baseUrl}${withTrailingSlash(page.path)}`,
      url: `${config.public.canonicalUrl}${config.public.baseUrl}${withTrailingSlash(page.path)}`,
      navigation: page.navigation
    })).sort((a, b) => a.path.localeCompare(b.path))

    return jsonResult(result)
  }
})
