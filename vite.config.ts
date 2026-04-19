import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const hasSentryBuildConfig = Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT)

    return {
        build: {
            sourcemap: hasSentryBuildConfig,
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (!id.includes('node_modules')) return undefined

                        if (id.includes('@sentry/')) return 'vendor-sentry'
                        if (id.includes('@supabase/')) return 'vendor-supabase'
                        if (id.includes('lucide-react')) return 'vendor-icons'
                        return undefined
                    },
                },
            },
        },
        plugins: [
            react(),
            ...(hasSentryBuildConfig
                ? [
                    sentryVitePlugin({
                        org: env.SENTRY_ORG,
                        project: env.SENTRY_PROJECT,
                        authToken: env.SENTRY_AUTH_TOKEN,
                        url: env.SENTRY_BASE_URL || undefined,
                        telemetry: false,
                        sourcemaps: {
                            filesToDeleteAfterUpload: [
                                'dist/**/*.js.map',
                                'dist/**/*.mjs.map',
                                'dist/**/*.cjs.map',
                                'dist/**/*.css.map',
                            ],
                        },
                    }),
                ]
                : []),
        ],
        test: {
            globals: true,
            environment: 'jsdom',
            setupFiles: ['./src/test/setup.ts'],
            exclude: [...configDefaults.exclude, '**/.claude/**'],
        },
    }
})
