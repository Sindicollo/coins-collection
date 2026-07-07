import React from 'react'

interface HelpTooltipProps {
  text: string
  /** Default: 'left'. Use 'center' for narrow containers (dropdowns). */
  align?: 'left' | 'center'
}

export function HelpTooltip({ text, align = 'left' }: HelpTooltipProps): React.ReactElement {
  const tooltipAlign = align === 'center'
    ? 'left-1/2 -translate-x-1/2'
    : 'left-0'

  return (
    <span className="relative group cursor-help ml-1">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[10px] leading-none text-gray-400 border border-gray-300">
        ?
      </span>
      <span className={`absolute top-full ${tooltipAlign} mt-1.5 px-3 py-1.5 bg-gray-800 text-white text-[11px] leading-relaxed rounded shadow-lg opacity-0 invisible group-hover:opacity-85 group-hover:visible transition-all duration-150 max-w-[280px] min-w-[280px] pointer-events-none whitespace-normal z-50`}>
        {text}
      </span>
    </span>
  )
}
