import React from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'

export function Header(): React.ReactElement {
  const { t } = useTranslation()

  return (
    <header className="h-12 border-b border-gray-200 bg-white flex items-center justify-between px-4 flex-shrink-0">
      <h1 className="text-sm font-semibold text-primary-700">
        {t('app.title')}
      </h1>
      <LanguageSwitcher />
    </header>
  )
}
