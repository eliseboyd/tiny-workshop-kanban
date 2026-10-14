import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const classes = cn(badgeVariants({ variant }), className)

  if (asChild) {
    return <Slot data-slot="badge" className={classes} {...props} />
  }

  // A badge with a click handler is a control: render a real <button> so it
  // is focusable, keyboard-operable and announced correctly. Callers that
  // toggle something should also pass `aria-pressed`. The props are typed
  // for a span (the common case); the cast only widens the ref/handler
  // element type, which React resolves at runtime.
  if (typeof props.onClick === "function") {
    const buttonProps = props as unknown as React.ComponentProps<"button">
    return <button type="button" data-slot="badge" className={classes} {...buttonProps} />
  }

  return <span data-slot="badge" className={classes} {...props} />
}

export { Badge, badgeVariants }
