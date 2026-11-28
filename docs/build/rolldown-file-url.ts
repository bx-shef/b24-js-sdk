import { dirname, relative } from 'node:path'

/**
 * Fork workaround: Vite 8 (rolldown) leaves `import.meta.ROLLDOWN_FILE_URL_<ref>` unreplaced in some client
 * chunks — in the build it shows up in `new URL(import.meta.ROLLDOWN_FILE_URL_…, '' + import.meta.url)` for
 * assets referenced from dependencies (`@sqlite.org/sqlite-wasm`: its `.wasm` and workers). In the browser the
 * placeholder is `undefined`, the request goes to `/_nuxt/undefined` (404), Nuxt Content's client database does
 * not start, and every client-side navigation renders «Страница не найдена» (#64, тест в браузере 28.11).
 *
 * At the end of the build the reference ids are still known to the bundler, so the placeholder is replaced with
 * the emitted file's path relative to the chunk — exactly what the placeholder stands for. Chunks without the
 * placeholder are untouched. Remove once Vite/rolldown resolves it themselves (the build check in
 * `.github/workflows/docs-image.yml` keeps an eye on `/_nuxt/undefined`).
 */
export function rolldownFileUrl() {
  const PLACEHOLDER = /import\.meta\.ROLLDOWN_FILE_URL_([\w$]+)/g
  return {
    name: 'b24-fork:rolldown-file-url',
    apply: 'build' as const,
    enforce: 'post' as const,
    generateBundle(this: { getFileName: (ref: string) => string, warn: (msg: string) => void }, _options: unknown, bundle: Record<string, { type: string, code?: string, fileName: string }>) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.code?.includes('ROLLDOWN_FILE_URL_')) {
          continue
        }
        chunk.code = chunk.code.replace(PLACEHOLDER, (whole, ref: string) => {
          let file: string
          try {
            file = this.getFileName(ref)
          } catch {
            this.warn(`[rolldown-file-url] unknown reference ${ref} in ${chunk.fileName}`)
            return whole
          }
          const rel = relative(dirname(chunk.fileName), file).replace(/\\/g, '/')
          return JSON.stringify(rel.startsWith('.') ? rel : `./${rel}`)
        })
      }
    }
  }
}
