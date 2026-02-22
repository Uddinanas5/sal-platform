"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Check, X } from "lucide-react"

interface PasswordStrengthProps {
  password: string
  className?: string
}

interface PasswordRequirement {
  label: string
  met: boolean
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const requirements: PasswordRequirement[] = useMemo(() => [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(password) },
    { label: "Contains a number", met: /[0-9]/.test(password) },
  ], [password])

  const strength = useMemo(() => {
    const metCount = requirements.filter(r => r.met).length
    if (metCount === 0) return { level: 0, label: "", color: "" }
    if (metCount === 1) return { level: 1, label: "Weak", color: "bg-red-500" }
    if (metCount === 2) return { level: 2, label: "Fair", color: "bg-orange-500" }
    if (metCount === 3) return { level: 3, label: "Good", color: "bg-yellow-500" }
    return { level: 4, label: "Strong", color: "bg-green-500" }
  }, [requirements])

  if (!password) return null

  return (
    <div className={cn("space-y-2", className)}>
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                level <= strength.level ? strength.color : "bg-muted"
              )}
            />
          ))}
        </div>
        {strength.label && (
          <span className={cn(
            "text-xs font-medium",
            strength.level === 1 && "text-red-500",
            strength.level === 2 && "text-orange-500",
            strength.level === 3 && "text-yellow-600",
            strength.level === 4 && "text-green-500"
          )}>
            {strength.label}
          </span>
        )}
      </div>

      {/* Requirements list */}
      <ul className="space-y-1">
        {requirements.map((req, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            {req.met ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={req.met ? "text-green-600" : "text-muted-foreground"}>
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
