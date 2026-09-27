"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"
import styles from "./tabs.module.css"

type WithClassName<P> = Omit<P, "className"> & { className?: string }

function Tabs({
  className,
  onValueChange,
  ...props
}: WithClassName<Omit<TabsPrimitive.Root.Props, "onValueChange">> & {
  onValueChange?: (value: string) => void
}) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn(styles.Tabs, className)}
      onValueChange={onValueChange ? (value) => onValueChange(String(value)) : undefined}
      {...props}
    />
  )
}

function TabsList({
  className,
  activateOnFocus = true, // Radix's default ("automatic"): arrow keys switch tabs
  ...props
}: WithClassName<TabsPrimitive.List.Props>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      activateOnFocus={activateOnFocus}
      className={cn(styles.List, className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: WithClassName<TabsPrimitive.Tab.Props>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(styles.Tab, className)}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: WithClassName<TabsPrimitive.Panel.Props>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(styles.Panel, className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
