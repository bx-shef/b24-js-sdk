import { z } from 'zod'

export default defineMcpPrompt({
  title: 'Сгенерировать пример кода с SDK',
  description: 'Сгенерировать пример кода с JS SDK Битрикс24 для конкретной задачи',
  inputSchema: {
    usecase: z.string().describe('Задача (например: «обновить 100 сделок пакетным запросом», «загрузка файла с прогрессом»)'),
    restApiVersion: z.string().optional().describe('Версия REST API: ver2 или ver3 (по умолчанию ver3)')
  },
  async handler({ usecase, restApiVersion }) {
    const version = restApiVersion || 'ver3'

    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Напиши полный пример кода с @bitrix24/b24jssdk для задачи: «${usecase}». Используй REST API ${version}. В примере — импорты, инициализация, основная логика, обработка ошибок; комментарии к ключевым шагам в коде — на английском, пояснения к примеру — по-русски.`
          }
        }
      ]
    }
  }
})
