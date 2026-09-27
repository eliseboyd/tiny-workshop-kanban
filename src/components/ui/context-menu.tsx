"use client"

import * as React from "react"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import styles from "./context-menu.module.css"

type WithClassName<P> = Omit<P, "className"> & { className?: string }

function ContextMenu(props: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root {...props} />
}

function ContextMenuTrigger(props: ContextMenuPrimitive.Trigger.Props) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
}

function ContextMenuGroup(props: ContextMenuPrimitive.Group.Props) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
}

function ContextMenuPortal(props: ContextMenuPrimitive.Portal.Props) {
  return <ContextMenuPrimitive.Portal {...props} />
}

function ContextMenuSub(props: ContextMenuPrimitive.SubmenuRoot.Props) {
  return <ContextMenuPrimitive.SubmenuRoot {...props} />
}

function ContextMenuRadioGroup(props: ContextMenuPrimitive.RadioGroup.Props) {
  return <ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: WithClassName<ContextMenuPrimitive.SubmenuTrigger.Props> & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset || undefined}
      className={cn(styles.Item, className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className={styles.SubmenuChevron} />
    </ContextMenuPrimitive.SubmenuTrigger>
  )
}

function ContextMenuSubContent({
  className,
  ...props
}: WithClassName<ContextMenuPrimitive.Popup.Props>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className={styles.Positioner}>
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-sub-content"
          className={cn(styles.Popup, styles.SubPopup, className)}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuContent({
  className,
  ...props
}: WithClassName<ContextMenuPrimitive.Popup.Props>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className={styles.Positioner}>
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(styles.Popup, className)}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: WithClassName<ContextMenuPrimitive.Item.Props> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset || undefined}
      data-variant={variant}
      className={cn(styles.Item, className)}
      {...props}
    />
  )
}

function ContextMenuCheckboxItem({
  className,
  children,
  ...props
}: WithClassName<ContextMenuPrimitive.CheckboxItem.Props>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={cn(styles.Item, styles.IndicatorItem, className)}
      {...props}
    >
      <span className={styles.Indicator}>
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className={styles.Glyph} />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: WithClassName<ContextMenuPrimitive.RadioItem.Props>) {
  return (
    <ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      className={cn(styles.Item, styles.IndicatorItem, className)}
      {...props}
    >
      <span className={styles.Indicator}>
        <ContextMenuPrimitive.RadioItemIndicator>
          <CircleIcon className={styles.RadioDot} />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}

// A plain heading, so it works outside a ContextMenuGroup (Base UI's
// GroupLabel must sit inside one).
function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & {
  inset?: boolean
}) {
  return (
    <div
      data-slot="context-menu-label"
      data-inset={inset || undefined}
      className={cn(styles.Label, className)}
      {...props}
    />
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof ContextMenuPrimitive.Separator>>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn(styles.Separator, className)}
      {...props}
    />
  )
}

function ContextMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(styles.Shortcut, className)}
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
