"use client"

import * as React from "react"
import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete"

import { cn } from "@/lib/utils"
import styles from "./autocomplete.module.css"

type WithClassName<P> = Omit<P, "className"> & { className?: string }

/*
 * A text input with a suggestion list. The call site usually owns filtering
 * (pass `mode="none"` and already-filtered `items`) and reacts to picks in
 * each item's `onClick`; Base UI supplies keyboard navigation, ARIA and
 * outside-press/Escape dismissal.
 */
const Autocomplete = AutocompletePrimitive.Root

function AutocompleteInput(props: AutocompletePrimitive.Input.Props) {
  return <AutocompletePrimitive.Input data-slot="autocomplete-input" {...props} />
}

function AutocompleteContent({
  className,
  children,
  side = "bottom",
  align = "start",
  sideOffset = 4,
  ...props
}: WithClassName<AutocompletePrimitive.Popup.Props> &
  Pick<AutocompletePrimitive.Positioner.Props, "side" | "align" | "sideOffset">) {
  return (
    <AutocompletePrimitive.Portal>
      <AutocompletePrimitive.Positioner
        className={styles.Positioner}
        side={side}
        align={align}
        sideOffset={sideOffset}
      >
        <AutocompletePrimitive.Popup
          data-slot="autocomplete-content"
          className={cn(styles.Popup, className)}
          {...props}
        >
          {children}
        </AutocompletePrimitive.Popup>
      </AutocompletePrimitive.Positioner>
    </AutocompletePrimitive.Portal>
  )
}

function AutocompleteList({ className, ...props }: WithClassName<AutocompletePrimitive.List.Props>) {
  return (
    <AutocompletePrimitive.List
      data-slot="autocomplete-list"
      className={cn(styles.List, className)}
      {...props}
    />
  )
}

function AutocompleteItem({ className, ...props }: WithClassName<AutocompletePrimitive.Item.Props>) {
  return (
    <AutocompletePrimitive.Item
      data-slot="autocomplete-item"
      className={cn(styles.Item, className)}
      {...props}
    />
  )
}

function AutocompleteEmpty({ className, ...props }: WithClassName<AutocompletePrimitive.Empty.Props>) {
  return (
    <AutocompletePrimitive.Empty
      data-slot="autocomplete-empty"
      className={cn(styles.Empty, className)}
      {...props}
    />
  )
}

export {
  Autocomplete,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
}
