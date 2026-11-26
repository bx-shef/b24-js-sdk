/**
 * Плоское представление блока `::rest-api-version-only` для raw-markdown
 * (`/raw/*.md`, llms-full, MCP, «Скопировать страницу»).
 *
 * Чистая функция без зависимостей от Nuxt — чтобы её можно было тестировать
 * unit-тестом. Слот `#rest-api-ver2` превращается в пометку `**REST API v2**`
 * и его содержимое, `#rest-api-ver3` — в `**REST API v3**`.
 */
const SLOT_LABELS: Record<string, string> = {
  'v-slot:rest-api-ver2': 'REST API v2',
  'v-slot:rest-api-ver3': 'REST API v3'
}

export function flattenRestApiVersionChildren(
  children: any[],
  collect: (nodes: any[]) => any[]
): any[] {
  const result: any[] = []
  for (const child of children) {
    if (!Array.isArray(child) || child[0] !== 'template') continue
    const key = Object.keys(child[1] || {}).find(k => k in SLOT_LABELS)
    if (!key) continue
    result.push(['p', {}, ['strong', {}, SLOT_LABELS[key]]])
    result.push(...collect(child.slice(2)))
  }
  return result
}
