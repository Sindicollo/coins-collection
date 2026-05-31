import React from 'react'
import { useTranslation } from 'react-i18next'

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
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{label}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
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
