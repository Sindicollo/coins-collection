import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

const variantStyles: Record<string, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
  secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400',
  ghost: 'bg-transparent text-gray-600 hover:bg-blue-100 focus:ring-blue-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
}

const sizeStyles: Record<string, string> = {
  xs: 'px-1.5 py-0.5 text-[11px]',
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps): React.ReactElement {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium rounded-md 
        focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
