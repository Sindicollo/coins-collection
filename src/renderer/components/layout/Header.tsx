import React from 'react'
import { useTranslation } from 'react-i18next'
import { Settings } from '@/components/ui/icons/Settings'
import { ActionsDropdown } from '@/components/common/ActionsDropdown'

interface HeaderProps {
  onOpenSettings: () => void
}

export function Header({ onOpenSettings }: HeaderProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <header className="h-12 border-b border-gray-200 bg-white flex items-center justify-between px-4 flex-shrink-0">
      <h1 className="text-sm font-semibold text-primary-700">
        {t('app.title')}
      </h1>
      <div className="flex items-center gap-1">
        <ActionsDropdown />
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          title={t('settings.title')}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
