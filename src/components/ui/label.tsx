"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import styles from "./label.module.css"

function Label({ className, onMouseDown, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(styles.Label, className)}
      onMouseDown={(event) => {
        onMouseDown?.(event)
        // Like Radix Label: a double-click on the label shouldn't select text.
        if (!event.defaultPrevented && event.detail > 1) event.preventDefault()
      }}
      {...props}
    />
  )
}

export { Label }
