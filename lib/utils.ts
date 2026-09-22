import type { MouseEvent } from "react"

export { cn } from "cn"

/**
 * An unmodified primary click, which a journey link handles in place.
 * Modified clicks keep their native behavior, such as opening a new tab.
 */
export function isPlainClick(event: MouseEvent) {
  return (
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
  )
}
