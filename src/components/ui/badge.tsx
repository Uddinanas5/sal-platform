import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-sal-500 text-white hover:bg-sal-600",
        secondary:
          "glass-pill text-white/85 border-0",
        destructive:
          "bg-red-400/15 text-red-200 border border-red-400/30/25",
        outline: "border-white/20 text-white/80",
        success:
          "bg-emerald-400/15 text-emerald-200 border border-emerald-400/30/25",
        warning:
          "bg-amber-400/15 text-amber-200 border border-amber-400/30/25",
        info:
          "bg-sky-400/15 text-sky-200 border border-sky-400/30/25",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
