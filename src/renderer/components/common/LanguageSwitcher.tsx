import React from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from '@/components/ui/icons/Globe'
import { ChevronDown } from '@/components/ui/icons/ChevronDown'

const LANGS = [
  { code: 'en', key: 'lang.en' },
  { code: 'ru', key: 'lang.ru' }
] as const

export function LanguageSwitcher(): React.ReactElement {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const currentLang = i18n.language?.startsWith('ru') ? 'ru' : 'en'

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const handleSelect = (code: string): void => {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  const label = t(`lang.${currentLang}`)

  return (
    <div ref={containerRef} className="relative" title={t('lang.label')}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-500
          hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
        aria-expanded={open}
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{label}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md
          shadow-lg py-1 z-50 min-w-[120px]">
          {LANGS.map(({ code, key }) => (
            <button
              key={code}
              onClick={() => handleSelect(code)}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors
                ${code === currentLang
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              {t(key)}
              {code === currentLang && (
                <span className="float-right text-primary-500">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
