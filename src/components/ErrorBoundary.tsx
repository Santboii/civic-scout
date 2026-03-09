'use client'

import React from 'react'

interface Props {
    children: React.ReactNode
    fallback?: React.ReactNode
}

interface State {
    hasError: boolean
    error?: Error
}

/**
 * NOTE(Agent): Class component required — React error boundaries cannot be
 * implemented with hooks. Wraps the app to prevent a single render error
 * from crashing the entire UI with a white screen.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // NOTE(Agent): Structured with a distinct prefix so these are easily
        // filterable in server log aggregators (e.g. Vercel, Datadog).
        console.error('[ErrorBoundary] Caught render error:', error, info.componentStack)
        // TODO: forward to error tracking (Sentry etc.) once integrated.
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback

            return (
                <div
                    style={{
                        minHeight: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: '1rem',
                        padding: '2rem',
                        textAlign: 'center',
                        backgroundColor: 'var(--background-primary, #fafaf7)',
                        color: 'var(--text-primary, #1A1D26)',
                        fontFamily: 'system-ui, sans-serif',
                    }}
                >
                    <p style={{ fontSize: '2rem' }}>⚠️</p>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                        Something went wrong
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #5C6370)', margin: 0, maxWidth: '24rem' }}>
                        An unexpected error occurred. Please refresh the page to continue.
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        style={{
                            marginTop: '0.5rem',
                            padding: '0.625rem 1.5rem',
                            borderRadius: '0.75rem',
                            border: 'none',
                            backgroundColor: 'var(--accent-primary, #0A9E8E)',
                            color: '#fff',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Try Again
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}
