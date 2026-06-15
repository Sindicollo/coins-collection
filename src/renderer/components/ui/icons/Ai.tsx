import React from 'react'

interface IconProps {
  className?: string
}

export function Ai({ className = 'w-5 h-5' }: IconProps): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v2a2 2 0 0 0 1 1.73V16a2 2 0 0 0 2 2h2v2a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4v-2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-1.73V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
      <circle cx="8.5" cy="11.5" r="1" fill="currentColor" />
      <circle cx="15.5" cy="11.5" r="1" fill="currentColor" />
      <path d="M12 7v4" />
    </svg>
  )
}
