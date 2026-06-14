import { useEffect, useRef, useState } from 'react'
import { share } from '../share'

/**
 * THE share button — every share action goes through here so the silent clipboard
 * fallback always gets a visible "✓ copied" confirmation (the native sheet is its
 * own feedback, so the label stays put there).
 */
export function ShareButton({
  label,
  message,
  className,
}: {
  label: string
  /** Built lazily so the message reflects state at click time. */
  message: () => string
  className: string
}) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const onClick = async () => {
    if ((await share(message())) === 'copied') {
      setCopied(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {copied ? '✓ copied' : label}
    </button>
  )
}
