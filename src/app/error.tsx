'use client'

import { useEffect } from 'react'

interface ErrorProps {
    error: Error & { digest?: string }
    reset: () => void
}

/**
 * Next.js error boundary — shown when a component throws during rendering.
 * Prevents the entire app from crashing and gives users a recovery path.
 */
export default function Error({ error, reset }: ErrorProps) {
    useEffect(() => {
        console.error('[Error Boundary]', error)
    }, [error])

    return (
        <main
            className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center"
            style={{ backgroundColor: 'var(--background-primary)' }}
        >
            <div style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
                <p
                    className="text-[11px] font-semibold uppercase tracking-[0.25em] mb-3"
                    style={{ color: 'var(--accent-primary)' }}
                >
                    Something went wrong
                </p>
                <h1
                    className="text-3xl font-bold tracking-tight mb-4"
                    style={{ color: 'var(--text-primary)' }}
                >
                    CivicScout hit a snag
                </h1>
                <p
                    className="text-sm max-w-sm mx-auto mb-8"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    We encountered an unexpected error. Try again or refresh the page.
                </p>
                <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
                    style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: '#FFFFFF',
                        boxShadow: '0 4px 16px rgba(10, 158, 142, 0.2)',
                    }}
                >
                    Try Again
                </button>
            </div>
        </main>
    )
}
