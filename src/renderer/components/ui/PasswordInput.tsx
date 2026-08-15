import React from 'react'
import { useTranslation } from 'react-i18next'
import { Eye } from '@/components/ui/icons/Eye'
import { EyeOff } from '@/components/ui/icons/EyeOff'

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

/**
 * Password input with a show/hide toggle for API keys.
 * Mirrors the Input component's layout (label + error), adding a
 * visibility toggle button on the right side of the field.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    const { t } = useTranslation()
    const [visible, setVisible] = React.useState(false)

    return (
      <div className="flex flex-col gap-1">
        {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
        <div className="relative">
          <input
            ref={ref}
            type={visible ? 'text' : 'password'}
            className={`px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm w-full
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              disabled:bg-gray-100 disabled:cursor-not-allowed
              ${error ? 'border-red-400 focus:ring-red-400' : ''}
              ${className}`}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={
              visible
                ? t('ai.settings.hideKey', { defaultValue: 'Hide API key' })
                : t('ai.settings.showKey', { defaultValue: 'Show API key' })
            }
            title={
              visible
                ? t('ai.settings.hideKey', { defaultValue: 'Hide API key' })
                : t('ai.settings.showKey', { defaultValue: 'Show API key' })
            }
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)

PasswordInput.displayName = 'PasswordInput'
