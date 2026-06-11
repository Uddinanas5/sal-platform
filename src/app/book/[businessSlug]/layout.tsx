import { Toaster } from "@/components/ui/toaster"

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen env-canvas-lite">
      {children}
      <Toaster />
    </div>
  )
}
