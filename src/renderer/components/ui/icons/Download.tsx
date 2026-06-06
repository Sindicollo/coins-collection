import React from 'react'

interface IconProps {
  className?: string
}

export function Download({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
      />
      <polyline
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        points="7 11 12 16 17 11"
      />
      <line
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        x1="12"
        y1="16"
        x2="12"
        y2="4"
      />
    </svg>
  )
}
