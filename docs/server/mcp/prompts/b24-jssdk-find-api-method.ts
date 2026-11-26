import { z } from 'zod'
import { queryCollection } from '@nuxt/content/server'

export default defineMcpPrompt({
  title: 'Подобрать метод SDK под задачу',
  description: 'Подобрать подходящий метод JS SDK Битрикс24 или REST API для конкретной задачи',
  inputSchema: {
    usecase: z.string().describe('Что нужно сделать в Битрикс24 (например: «создать сделку», «получить список сотрудников», «загрузить файл на Диск»)')
  },
  async handler({ usecase }) {
    const event = useEvent()

    const pages = await queryCollection(event, 'docs')
      .andWhere(group => group
        .where('path', 'LIKE', '/docs/actions/%')
        .orWhere(q => q.where('path', 'LIKE', '/docs/entry-points/%'))
        .orWhere(q => q.where('path', 'LIKE', '/docs/tools/%')))
      .where('extension', '=', 'md')
      .select('path', 'title', 'description')
      .all()

    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Подбери лучший метод JS SDK Битрикс24 или метод REST API для задачи: «${usecase}». Ответь по-русски, со ссылкой на страницу документации. Все страницы документации: ${JSON.stringify(pages, null, 2)}`
          }
        }
      ]
    }
  }
})
