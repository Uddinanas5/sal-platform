"use client"

import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-[rgba(10,42,30,0.92)] group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-white/15 group-[.toaster]:shadow-float",
          description: "group-[.toast]:text-ink-soft",
          actionButton: "group-[.toast]:bg-sal-500 group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white",
        },
      }}
    />
  )
}
