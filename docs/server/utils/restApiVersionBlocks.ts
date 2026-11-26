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

// `node` is an MDC tuple `[tag, attrs, ...children]` (children start at 2), or —
// with `start = 0` — the plain list of top-level nodes in `doc.body.value`.
// Starting a top-level list at 2 left its first two nodes unflattened, and a
// `__flatten` there leaked into the raw markdown as a literal tag.
export function flattenMarkers(node: any, start = 2): void {
  if (!Array.isArray(node)) return
  let i = start
  while (i < node.length) {
    const child = node[i]
    if (Array.isArray(child) && (child[0] === '__flatten' || child[0] === 'div')) {
      const innerChildren = child.slice(2)
      node.splice(i, 1, ...innerChildren)
    } else {
      flattenMarkers(child)
      i++
    }
  }
}
