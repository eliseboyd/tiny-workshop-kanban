"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import styles from "./checkbox.module.css"

function Checkbox({
  className,
  ...props
}: Omit<CheckboxPrimitive.Root.Props, "className"> & { className?: string }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(styles.Checkbox, className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={styles.Indicator}>
        <Check />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
