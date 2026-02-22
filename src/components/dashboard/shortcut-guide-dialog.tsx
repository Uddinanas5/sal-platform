"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

const shortcutGroups = [
  {
    label: "Navigation",
    shortcuts: [
      { keys: ["N"], description: "Go to Calendar" },
      { keys: ["/"], description: "Quick search" },
      { keys: ["⌘", "K"], description: "Open command palette" },
      { keys: ["?"], description: "Show this guide" },
    ],
  },
  {
    label: "Calendar",
    shortcuts: [
      { keys: ["←"], description: "Previous day/week" },
      { keys: ["→"], description: "Next day/week" },
      { keys: ["T"], description: "Jump to today" },
    ],
  },
  {
    label: "General",
    shortcuts: [
      { keys: ["D"], description: "Toggle dark mode" },
      { keys: ["Esc"], description: "Close dialog / panel" },
    ],
  },
]

interface ShortcutGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutGuideDialog({
  open,
  onOpenChange,
}: ShortcutGuideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Navigate faster with these shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {shortcutGroups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <Separator className="mb-4" />}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, ki) => (
                        <React.Fragment key={ki}>
                          {ki > 0 && (
                            <span className="text-xs text-muted-foreground">
                              +
                            </span>
                          )}
                          <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-cream-300 bg-cream-100 px-1.5 text-xs font-medium text-foreground shadow-sm">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
