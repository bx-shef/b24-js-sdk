import { dirname, relative } from 'node:path'

/**
 * Fork workaround: Vite 8 (rolldown) leaves `import.meta.ROLLDOWN_FILE_URL_<ref>` unreplaced in some client
 * chunks — in the build it shows up in `new URL(import.meta.ROLLDOWN_FILE_URL_…, '' + import.meta.url)` for
 * assets referenced from dependencies (`@sqlite.org/sqlite-wasm`: its `.wasm` and workers). In the browser the
 * placeholder is `undefined`, the request goes to `/_nuxt/undefined` (404), Nuxt Content's client database does
 * not start, and every client-side navigation renders «Страница не найдена» (#64, тест в браузере 28.11).
 *
 * While chunks are rendered the reference ids are known to the bundler, so the placeholder is replaced with
 * the emitted file's path relative to the chunk — exactly what the placeholder stands for. Chunks without the
 * placeholder are untouched; an unknown reference fails the build. Remove once Vite/rolldown resolves it
 * themselves — `.github/workflows/docs-image.yml` checks that no `ROLLDOWN_FILE_URL_` is left in the image.
 */
export function rolldownFileUrl() {
  const PLACEHOLDER = /import\.meta\.ROLLDOWN_FILE_URL_([\w$]+)/g
  return {
    name: 'b24-fork:rolldown-file-url',
    apply: 'build' as const,
    enforce: 'post' as const,
    // renderChunk, а не generateBundle: правка должна попасть в хеш имени файла. В generateBundle имя уже
    // посчитано по коду с заглушкой — исправленный файл получал имя сломанного, а браузер держит такие файлы
    // в кеше год (cache-control: immutable) и продолжал грузить сломанную копию (тест в Chrome 28.11).
    renderChunk(this: { getFileName: (ref: string) => string, error: (msg: string) => never }, code: string, chunk: { fileName: string }) {
      if (!code.includes('ROLLDOWN_FILE_URL_')) {
        return null
      }
      return code.replace(PLACEHOLDER, (whole, ref: string) => {
        let file: string
        try {
          file = this.getFileName(ref)
        } catch {
          // A placeholder left in the bundle breaks the page silently — fail the build instead.
          return this.error(`[rolldown-file-url] unknown reference ${ref} in ${chunk.fileName}: ${whole}`)
        }
        const rel = relative(dirname(chunk.fileName), file).replace(/\\/g, '/')
        return JSON.stringify(rel.startsWith('.') ? rel : `./${rel}`)
      })
    }
  }
}
