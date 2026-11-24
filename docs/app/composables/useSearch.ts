import type { ContentSearchLink } from '@bitrix24/b24ui-nuxt'
import PlayLIcon from '@bitrix24/b24icons-vue/outline/PlayLIcon'
import DeveloperResourcesIcon from '@bitrix24/b24icons-vue/outline/DeveloperResourcesIcon'
import RobotIcon from '@bitrix24/b24icons-vue/outline/RobotIcon'
import GitHubIcon from '@bitrix24/b24icons-vue/social/GitHubIcon'

export function useSearch() {
  const route = useRoute()
  // const { restApiVersions } = useRestApiVersions()
  const { track } = useAnalytics()
  // @memo this for NUXT.UI.docs
  const { open, messages } = useChat()
  const { isEnabled: isAssistantEnabled } = useAssistant()

  // @memo this for docus
  // const { open: openAIChat } = useAIChat()
  // const { open: openContentSearch } = useContentSearch()

  const searchTerm = ref('')

  function onSelect() {
    track('AI Chat Opened', { source: 'search', hasSearchTerm: !!searchTerm.value })

    // @memo this for NUXT.UI.docs
    if (searchTerm.value) {
      messages.value = [...messages.value, {
        id: String(Date.now()),
        role: 'user',
        parts: [{ type: 'text', text: searchTerm.value }]
      }]
    }

    open.value = true

    // @memo this for docus
    // openContentSearch.value = false
    // openAIChat(searchTerm.value, true)
  }

  const links = computed(() => [
    isAssistantEnabled.value && {
      label: 'Спросить ИИ',
      description: 'Спросите ИИ-помощника: он отвечает по документации через наш MCP-сервер.',
      icon: RobotIcon,
      kbds: ['meta', 'i'],
      b24ui: {
        itemLeadingIcon: 'text-primary group-data-highlighted:not-group-data-disabled:text-primary-copilot'
      },
      onSelect
    },
    {
      label: 'Быстрый старт',
      description: 'С чего начать работу с SDK.',
      icon: PlayLIcon,
      to: '/docs/getting-started/',
      active: route.path.startsWith('/docs/getting-started')
    },
    {
      label: 'Работа с API',
      description: 'Введение в работу с REST API Битрикс24.',
      icon: DeveloperResourcesIcon,
      to: '/docs/working-with-the-rest-api/',
      active: route.path.startsWith('/docs/working-with-the-rest-api')
    },
    {
      label: 'GitHub',
      description: 'Репозиторий SDK на GitHub.',
      icon: GitHubIcon,
      to: 'https://github.com/bx-shef/b24-js-sdk',
      target: '_blank'
    }
  ].filter(link => !!link) as ContentSearchLink[]) // @memo: use filter: `isAssistantEnabled`

  const groups = computed(() => [])

  return {
    links,
    groups,
    searchTerm
  }
}
