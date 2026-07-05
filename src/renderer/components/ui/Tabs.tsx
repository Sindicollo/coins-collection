import React from 'react'

interface TabsContextValue {
  selected: string
  onSelect: (id: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

interface TabsProps {
  selected: string
  onSelect: (id: string) => void
  children: React.ReactNode
}

export function Tabs({ selected, onSelect, children }: TabsProps): React.ReactElement {
  return <TabsContext.Provider value={{ selected, onSelect }}>{children}</TabsContext.Provider>
}

interface TabListProps {
  children: React.ReactNode
  className?: string
}

export function TabList({ children, className = '' }: TabListProps): React.ReactElement {
  return <div className={`flex flex-col border-r border-gray-200 ${className}`}>{children}</div>
}

interface TabProps {
  id: string
  children: React.ReactNode
  badge?: number
}

export function Tab({ id, children, badge }: TabProps): React.ReactElement {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('Tab must be used inside Tabs')

  const isSelected = ctx.selected === id

  return (
    <button
      onClick={() => ctx.onSelect(id)}
      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-b border-gray-100
        ${isSelected
          ? 'bg-primary-50 text-primary-700 border-r-2 border-r-primary-600'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
        }`}
    >
      <span className="flex items-center justify-between">
        {children}
        {badge !== undefined && badge > 0 && (
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            {badge}
          </span>
        )}
      </span>
    </button>
  )
}

interface TabPanelProps {
  id: string
  children: React.ReactNode
  className?: string
}

export function TabPanel({ id, children, className = '' }: TabPanelProps): React.ReactElement {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('TabPanel must be used inside Tabs')

  if (ctx.selected !== id) return <></>

  return <div className={className}>{children}</div>
}
