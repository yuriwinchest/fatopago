import * as Sentry from '@sentry/react'

const LOCAL_SENTRY_HOSTNAMES = new Set(['localhost', '127.0.0.1'])
const SENTRY_SMOKE_TEST_MESSAGE = 'Fatopago local Sentry smoke test'

export function parseSentrySampleRate(value: string | undefined, fallback = 0): number {
    const parsed = Number(value)

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        return fallback
    }

    return parsed
}

export function stripSensitiveUrlParts(url: string): string {
    try {
        const parsedUrl = new URL(url)
        parsedUrl.search = ''
        parsedUrl.hash = ''
        return parsedUrl.toString()
    } catch {
        return url.split('?')[0] ?? url
    }
}

export function isLocalSentrySmokeTestEnabled(url: URL): boolean {
    return LOCAL_SENTRY_HOSTNAMES.has(url.hostname) && url.searchParams.get('sentry-test') === '1'
}

export function createSentrySmokeTestError(): Error {
    return new Error(SENTRY_SMOKE_TEST_MESSAGE)
}

export function initializeSentry(): void {
    const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()

    if (!dsn || import.meta.env.MODE === 'test') {
        return
    }

    const tracesSampleRate = parseSentrySampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0)

    Sentry.init({
        dsn,
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE,
        sendDefaultPii: false,
        integrations: tracesSampleRate > 0 ? [Sentry.browserTracingIntegration()] : [],
        tracesSampleRate,
        initialScope: {
            tags: {
                app: 'fatopago-web',
            },
        },
        beforeSend(event) {
            if (event.request?.url) {
                event.request.url = stripSensitiveUrlParts(event.request.url)
            }

            if (event.user) {
                delete event.user.email
                delete event.user.ip_address
                delete event.user.ipAddress
            }

            return event
        },
    })
}
