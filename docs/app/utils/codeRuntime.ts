// Где выполняется пример кода (#113): по точке входа SDK в самом примере.
// Порядок важен: пример установки приложения часто содержит и OAuth, и фрейм — тогда побеждает первое совпадение.
const RULES: ReadonlyArray<{ test: RegExp, label: string }> = [
  { test: /\bB24OAuth\b/, label: 'сервер, OAuth-приложение' },
  { test: /\bB24Hook\b|\bfromWebhookUrl\b/, label: 'сервер или скрипт, входящий вебхук' },
  { test: /\binitializeB24Frame\b|\bB24Frame\b|\$initializeB24Frame\b|\buseB24\(|\$b24\.(?:parent|placement|slider|auth\.getAuthData)\b/, label: 'приложение внутри Битрикс24 (фрейм)' }
]

const CODE_LANGUAGES = new Set(['ts', 'typescript', 'js', 'javascript', 'vue', 'tsx', 'jsx'])

/** Подпись среды для блока кода или `undefined`, если точки входа в примере нет. */
export function codeRuntime(code: string, language?: string): string | undefined {
  if (!code || (language && !CODE_LANGUAGES.has(language))) {
    return undefined
  }
  return RULES.find(rule => rule.test.test(code))?.label
}
