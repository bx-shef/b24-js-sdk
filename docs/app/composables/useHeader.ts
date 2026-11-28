import type { NavigationMenuItem } from '@bitrix24/b24ui-nuxt'
import { createSharedComposable } from '@vueuse/core'
import PlayLIcon from '@bitrix24/b24icons-vue/outline/PlayLIcon'
import BrowserIcon from '@bitrix24/b24icons-vue/outline/BrowserIcon'
import GitHubIcon from '@bitrix24/b24icons-vue/social/GitHubIcon'
import BarcodeIcon from '@bitrix24/b24icons-vue/outline/BarcodeIcon'
import EarthIcon from '@bitrix24/b24icons-vue/outline/EarthIcon'
import TerminalIcon from '@bitrix24/b24icons-vue/file-type/TerminalIcon'
import ItemIcon from '@bitrix24/b24icons-vue/crm/ItemIcon'
import Bitrix24Icon from '@bitrix24/b24icons-vue/common-service/Bitrix24Icon'

const _useHeader = () => {
  const route = useRoute()

  // Сообщество и документация REST — русские для всех (решение владельца 2026-11-28): разработчики сидят
  // в русском чате, переключать их по языку браузера не нужно.
  const tgLink = computed(() => 'https://t.me/bitrix24apps')
  const b24DocsLink = computed(() => 'https://apidocs.bitrix24.ru/')

  const desktopLinks = computed<NavigationMenuItem[]>(() => [
    {
      label: 'Документация',
      to: '/docs/getting-started',
      active: route.path.startsWith('/docs/getting-started')
    },
    {
      label: 'Действия',
      to: '/docs/actions',
      active: route.path.startsWith('/docs/actions')
    },
    {
      label: 'Точки входа',
      to: '/docs/entry-points',
      active: route.path.startsWith('/docs/entry-points')
    },
    {
      label: 'Инструменты',
      to: '/docs/tools',
      active: route.path.startsWith('/docs/tools')
    },
    {
      label: 'Справочник API',
      to: '/docs/api-reference',
      active: route.path.startsWith('/docs/api-reference')
    },
    {
      label: 'Примеры',
      to: '/docs/examples',
      active: route.path === '/docs/examples' || route.path.startsWith('/docs/examples/')
    },
    {
      label: 'Ресурсы',
      type: 'trigger',
      children: [
        {
          label: 'B24 UI',
          description: 'Интерфейс приложений в стиле Битрикс24',
          icon: BrowserIcon,
          to: 'https://b24-ui.bx-shef.by/',
          target: '_blank'
        },
        {
          label: 'B24 Icons',
          description: 'Иконки Битрикс24 для Vue и React',
          icon: BarcodeIcon,
          to: 'https://b24-icons.bx-shef.by/',
          target: '_blank'
        },
        {
          label: 'Сообщество',
          description: 'Сообщество в Telegram',
          icon: EarthIcon,
          to: tgLink.value,
          target: '_blank'
        },
        {
          label: 'REST API',
          description: 'REST API Битрикс24 и приложения Маркета',
          icon: Bitrix24Icon,
          to: b24DocsLink.value,
          target: '_blank'
        }
      ]
    }
  ])

  const mobileLinks = computed<NavigationMenuItem[]>(() => [
    {
      label: 'Быстрый старт',
      to: '/docs/getting-started',
      icon: PlayLIcon,
      active: route.path.startsWith('/docs/getting-started')
    },
    {
      label: 'Действия',
      to: '/docs/actions',
      icon: TerminalIcon,
      active: route.path.startsWith('/docs/actions')
    },
    {
      label: 'Точки входа',
      to: '/docs/entry-points',
      icon: TerminalIcon,
      active: route.path.startsWith('/docs/entry-points')
    },
    {
      label: 'Инструменты',
      to: '/docs/tools',
      icon: TerminalIcon,
      active: route.path.startsWith('/docs/tools')
    },
    {
      label: 'Справочник API',
      to: '/docs/api-reference',
      icon: TerminalIcon,
      active: route.path.startsWith('/docs/api-reference')
    },
    {
      label: 'Примеры',
      to: '/docs/examples',
      icon: ItemIcon,
      active: route.path === '/docs/examples' || route.path.startsWith('/docs/examples/')
    },
    {
      label: 'Заявка на разработку',
      to: '/request?source=header',
      icon: ItemIcon,
      active: route.path === '/request'
    },
    {
      label: 'GitHub',
      to: 'https://github.com/bx-shef/b24-js-sdk',
      icon: GitHubIcon,
      target: '_blank',
      b24ui: {
        linkLeadingIcon: 'size-[20px] ms-[4px] me-[4px]'
      }
    }
  ])

  return {
    desktopLinks,
    mobileLinks,
    b24DocsLink,
    tgLink
  }
}

export const useHeader = /* @__PURE__ */ createSharedComposable(_useHeader)
