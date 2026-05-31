import React from 'react'
import { Header } from './Header'

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
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
