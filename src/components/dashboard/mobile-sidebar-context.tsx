"use client"

import { createContext, useContext } from "react"

interface MobileSidebarContextValue {
  toggleMobileSidebar: (() => void) | undefined
}

export const MobileSidebarContext = createContext<MobileSidebarContextValue>({
  toggleMobileSidebar: undefined,
})

export function useMobileSidebar() {
  return useContext(MobileSidebarContext)
}
