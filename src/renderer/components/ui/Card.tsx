import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps): React.ReactElement {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg shadow-sm 
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} 
        ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
