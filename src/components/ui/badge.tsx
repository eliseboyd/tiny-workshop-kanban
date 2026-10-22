import * as React from "react"

import { cn } from "@/lib/utils"
import styles from "./badge.module.css"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & { variant?: BadgeVariant | null }) {
  const shared = {
    "data-slot": "badge",
    "data-variant": variant ?? "default",
    className: cn(styles.Badge, className),
  }

  // A badge with a click handler is a control: render a real <button> so it
  // is focusable, keyboard-operable and announced correctly. Callers that
  // toggle something should also pass `aria-pressed`. The props are typed
  // for a span (the common case); the cast only widens the ref/handler
  // element type, which React resolves at runtime.
  if (typeof props.onClick === "function") {
    const buttonProps = props as unknown as React.ComponentProps<"button">
    return <button type="button" {...buttonProps} {...shared} />
  }

  return <span {...props} {...shared} />
}

export { Badge }
export type { BadgeVariant }
