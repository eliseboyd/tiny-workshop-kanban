"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import styles from "./select.module.css"

type WithClassName<P> = Omit<P, "className"> & { className?: string }

/*
 * Base UI's Select.Value shows the raw value unless Root is given `items`.
 * Call sites declare their options as <SelectItem> children (Radix-style), so
 * collect them here to build that map — the trigger then shows each item's
 * own label, icons included.
 */
function collectItems(node: React.ReactNode, items: Record<string, React.ReactNode>) {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as { value?: unknown; children?: React.ReactNode }
    if (child.type === SelectItem) {
      items[String(props.value)] = props.children
      return
    }
    if (props.children) collectItems(props.children, items)
  })
  return items
}

interface SelectProps
  extends Omit<SelectPrimitive.Root.Props<string>, "value" | "defaultValue" | "onValueChange" | "items"> {
  value?: string
  defaultValue?: string
  // Method syntax keeps the parameter bivariant, so call sites can narrow it
  // (`(v: 'all' | 'mine') => …`) as they could with Radix.
  onValueChange?(value: string): void
}

function Select(allProps: SelectProps) {
  const { children, value, onValueChange, ...props } = allProps
  const items = React.useMemo(() => collectItems(children, {}), [children])
  // Radix treated `value={undefined}` as "nothing selected"; Base UI wants null
  // for that, or it flips between controlled and uncontrolled.
  const controlled = "value" in allProps
  return (
    <SelectPrimitive.Root
      items={items}
      {...(controlled ? { value: value ?? null } : {})}
      onValueChange={onValueChange ? (next) => onValueChange(next as string) : undefined}
      {...props}
    >
      {children}
    </SelectPrimitive.Root>
  )
}

function SelectGroup({ className, ...props }: WithClassName<SelectPrimitive.Group.Props>) {
  return <SelectPrimitive.Group data-slot="select-group" className={className} {...props} />
}

function SelectValue({ className, ...props }: WithClassName<SelectPrimitive.Value.Props>) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(styles.Value, className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: WithClassName<SelectPrimitive.Trigger.Props> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(styles.Trigger, className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className={styles.Icon}>
        <ChevronDownIcon className={styles.Glyph} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  ...props
}: WithClassName<SelectPrimitive.Popup.Props> &
  Pick<SelectPrimitive.Positioner.Props, "side" | "align" | "sideOffset">) {
  return (
    <SelectPrimitive.Portal>
      {/* alignItemWithTrigger off = Radix's position="popper": a list below the trigger. */}
      <SelectPrimitive.Positioner
        className={styles.Positioner}
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignItemWithTrigger={false}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(styles.Popup, className)}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className={styles.List}>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: WithClassName<SelectPrimitive.GroupLabel.Props>) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(styles.GroupLabel, className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: WithClassName<SelectPrimitive.Item.Props>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(styles.Item, className)}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className={styles.ItemIndicator}>
        <CheckIcon className={styles.Glyph} />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className={styles.ItemText}>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }: WithClassName<SelectPrimitive.Separator.Props>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(styles.Separator, className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: WithClassName<SelectPrimitive.ScrollUpArrow.Props>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(styles.ScrollArrow, className)}
      {...props}
    >
      <ChevronUpIcon className={styles.Glyph} />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: WithClassName<SelectPrimitive.ScrollDownArrow.Props>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(styles.ScrollArrow, className)}
      {...props}
    >
      <ChevronDownIcon className={styles.Glyph} />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
