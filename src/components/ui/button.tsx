import * as React from "react"

import { cn } from "@/lib/utils"
import styles from "./button.module.css"

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
type ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg"

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"button"> & {
  variant?: ButtonVariant | null
  size?: ButtonSize | null
}) {
  return (
    <button
      data-slot="button"
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      className={cn(styles.Button, className)}
      {...props}
    />
  )
}

export { Button }
export type { ButtonVariant, ButtonSize }
