import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  showCounter?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, showCounter, maxLength, onChange, value, defaultValue, ...props }, ref) => {
    const [charCount, setCharCount] = React.useState(() => {
      const initial = (value ?? defaultValue ?? "") as string
      return initial.length
    })

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length)
      onChange?.(e)
    }

    // Sync controlled value
    React.useEffect(() => {
      if (value !== undefined) {
        setCharCount((value as string).length)
      }
    }, [value])

    const shouldShowCounter = showCounter && maxLength

    return (
      <div className="relative">
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sal-500 focus-visible:ring-offset-2 focus-visible:border-sal-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
            shouldShowCounter && "pb-6",
            className
          )}
          ref={ref}
          maxLength={maxLength}
          onChange={handleChange}
          value={value}
          defaultValue={defaultValue}
          {...props}
        />
        {shouldShowCounter && (
          <span
            className={cn(
              "absolute bottom-2 right-3 text-[10px] font-medium tabular-nums",
              charCount >= maxLength * 0.9
                ? "text-destructive"
                : charCount >= maxLength * 0.75
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground/50"
            )}
          >
            {charCount}/{maxLength}
          </span>
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
