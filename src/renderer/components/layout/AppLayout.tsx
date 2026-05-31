import React from 'react'

interface AppLayoutProps {
  sidebar: React.ReactNode
  children: React.ReactNode
}

export function AppLayout({ sidebar, children }: AppLayoutProps): React.ReactElement {
  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto scrollbar-thin">
        {sidebar}
      </aside>
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
