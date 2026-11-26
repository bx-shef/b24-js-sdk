import { z } from 'zod'
import { prepareCode } from '../../../app/utils/codeTransform'

export default defineMcpTool({
  title: 'Пример кода',
  description: 'Код и описание конкретного примера JS SDK',
  inputSchema: {
    exampleName: z.string().regex(/^[\w-]+$/).describe('Название примера')
  },
  cache: '30m',
  async handler({ exampleName }) {
    try {
      const result = await $fetch<{ content: string }>(`/api/code-examples/${exampleName}.json`)

      const code = prepareCode(result.content)

      return {
        content: [{ type: 'text' as const, text: code }]
      }
    } catch {
      // @memo need change tool if you need
      return errorResult(`Example '${exampleName}' not found. Use the b24-jssdk-list-examples tool to see all available examples.`)
    }
  }
})
