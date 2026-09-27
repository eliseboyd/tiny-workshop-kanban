"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import styles from "./mode-toggle.module.css"

export function ModeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      <Sun className={styles.Sun} />
      <Moon className={styles.Moon} />
      <span className={styles.SrOnly}>Toggle theme</span>
    </Button>
  )
}


