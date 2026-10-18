import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// اختبارات الدوالّ النقيّة فقط (ثوابت ومنطق بلا Nuxt ولا قاعدة).
export default defineConfig({
  resolve: { alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts', 'server/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.nuxt/**', '**/.output/**', '**/.claude/**']
  }
})
