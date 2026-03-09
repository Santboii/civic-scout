'use client'

import { useEffect } from 'react'

/**
 * NOTE(Agent): Mounts global listeners for unhandled JS errors and unhandled
 * Promise rejections. Renders nothing — purely a side-effect component.
 * Must be a Client Component since it needs access to the `window` object.
 * Placed in layout.tsx so it is active for the entire session.
 */
export default function GlobalErrorHandler() {
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            console.error('[global] Uncaught error:', event.error ?? event.message)
            // TODO: forward to error tracking service (Sentry etc.) once integrated.
        }

        const handleRejection = (event: PromiseRejectionEvent) => {
            console.error('[global] Unhandled promise rejection:', event.reason)
            // TODO: forward to error tracking service.
        }

        window.addEventListener('error', handleError)
        window.addEventListener('unhandledrejection', handleRejection)

        return () => {
            window.removeEventListener('error', handleError)
            window.removeEventListener('unhandledrejection', handleRejection)
        }
    }, [])

    return null
}
