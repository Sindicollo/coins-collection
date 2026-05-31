import React from 'react'

export function Skeleton({ className = '' }: { className?: string }): React.ReactElement {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}
