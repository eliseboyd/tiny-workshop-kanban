import * as React from "react"

import { cn } from "@/lib/utils"
import styles from "./badge.module.css"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & { variant?: BadgeVariant | null }) {
  return (
    <span
      data-slot="badge"
      data-variant={variant ?? "default"}
      className={cn(styles.Badge, className)}
      {...props}
    />
  )
}

export { Badge }
export type { BadgeVariant }
