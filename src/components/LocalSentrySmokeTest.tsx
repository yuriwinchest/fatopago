import { useState } from 'react'
import * as Sentry from '@sentry/react'
import { createSentrySmokeTestError, isLocalSentrySmokeTestEnabled } from '../lib/sentry'

function LocalSentrySmokeTest() {
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
    const [eventId, setEventId] = useState<string | null>(null)

    if (!isLocalSentrySmokeTestEnabled(new URL(window.location.href))) {
        return null
    }

    const handleClick = async () => {
        setStatus('sending')

        const id = Sentry.captureException(createSentrySmokeTestError(), {
            tags: {
                smoke_test: 'true',
                source: 'local-ui',
            },
            extra: {
                triggeredAt: new Date().toISOString(),
                href: window.location.href,
            },
        })

        const flushed = await Sentry.flush(3000)

        setEventId(id)
        setStatus(flushed ? 'sent' : 'failed')
    }

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/90 p-4 text-white shadow-2xl">
            <button
                type="button"
                onClick={handleClick}
                disabled={status === 'sending'}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {status === 'sending' ? 'Enviando smoke test...' : 'Enviar smoke test do Sentry'}
            </button>
            <p className="max-w-xs text-xs text-slate-300">
                Disponível apenas em `localhost` ou `127.0.0.1` com `?sentry-test=1`.
            </p>
            {status === 'sent' && eventId && (
                <p className="max-w-xs break-all text-xs text-emerald-300">
                    Evento confirmado pelo SDK. ID: {eventId}
                </p>
            )}
            {status === 'failed' && (
                <p className="max-w-xs text-xs text-red-300">
                    O SDK não confirmou o envio dentro do tempo esperado. Verifique bloqueio de rede, extensões e tente novamente.
                </p>
            )}
        </div>
    )
}

export default LocalSentrySmokeTest
