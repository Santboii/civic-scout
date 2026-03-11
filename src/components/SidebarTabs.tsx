'use client'

import { useState, useCallback, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import styles from './SidebarTabs.module.css'

// ── Types ───────────────────────────────────────────────────────────────────

export interface SidebarTab {
  /** Unique identifier for the tab */
  id: string
  /** Display label */
  label: string
  /** Lucide icon component */
  icon: LucideIcon
  /** Optional count badge (e.g. "200") */
  badge?: number
  /** Tab panel content */
  content: ReactNode
}

interface SidebarTabsProps {
  tabs: SidebarTab[]
  /** Which tab to show by default (matches tab.id). Falls back to first tab. */
  defaultTab?: string
}

// ── Component ───────────────────────────────────────────────────────────────

// NOTE(Agent): SidebarTabs owns its own activeTab state rather than lifting it
// to page.tsx. This keeps the page component clean and allows the tab selection
// to persist across re-renders caused by unrelated parent state changes
// (e.g., map interactions, loading states). The `defaultTab` prop lets the
// parent hint which tab to show initially.

export default function SidebarTabs({ tabs, defaultTab }: SidebarTabsProps) {
  const [activeTabId, setActiveTabId] = useState<string>(
    defaultTab ?? tabs[0]?.id ?? ''
  )

  // If the active tab was removed (e.g. dynamic tab list), fall back to first
  const effectiveTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]

  const handleTabClick = useCallback((id: string) => {
    setActiveTabId(id)
  }, [])

  if (tabs.length === 0) return null

  return (
    <div>
      {/* Tab Bar */}
      <div
        className={styles.tabBar}
        role="tablist"
        aria-label="Sidebar sections"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === effectiveTab?.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              role="tab"
              id={`sidebar-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`sidebar-panel-${tab.id}`}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              <Icon size={13} className={styles.tabIcon} aria-hidden="true" />
              {tab.label}
              {tab.badge !== undefined && (
                <span className={styles.badge}>{tab.badge}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Active Tab Panel */}
      {effectiveTab && (
        <div
          id={`sidebar-panel-${effectiveTab.id}`}
          role="tabpanel"
          aria-labelledby={`sidebar-tab-${effectiveTab.id}`}
          className={styles.panel}
        >
          {effectiveTab.content}
        </div>
      )}
    </div>
  )
}
