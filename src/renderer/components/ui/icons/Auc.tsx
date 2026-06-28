import React from 'react'

interface IconProps {
  className?: string
}

export function Auc({ className }: IconProps): React.ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        transform="rotate(-45, 50, 50)"
        fill="currentColor"
        fontSize="32"
        fontWeight="900"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        AUC
      </text>
    </svg>
  )
}
