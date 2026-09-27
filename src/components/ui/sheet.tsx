"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import styles from "./sheet.module.css"

type WithClassName<P> = Omit<P, "className"> & { className?: string }

function Sheet(props: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root {...props} />
}

function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal(props: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal {...props} />
}

function SheetOverlay({ className, ...props }: WithClassName<SheetPrimitive.Backdrop.Props>) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(styles.Backdrop, className)}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: WithClassName<SheetPrimitive.Popup.Props> & {
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(styles.Popup, className)}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className={styles.Close}>
          <XIcon />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(styles.Header, className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(styles.Footer, className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: WithClassName<SheetPrimitive.Title.Props>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(styles.Title, className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: WithClassName<SheetPrimitive.Description.Props>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn(styles.Description, className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
