"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"

import { cn } from "@/lib/utils"
import styles from "./toggle.module.css"

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: Omit<TogglePrimitive.Props, "className"> & {
  className?: string
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
}) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      data-variant={variant}
      data-size={size}
      className={cn(styles.Toggle, className)}
      {...props}
    />
  )
}

export { Toggle }
