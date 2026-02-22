import type { Metadata } from "next"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "Book an Appointment | SAL",
  description: "Book your next appointment online",
}

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
      <Toaster />
    </div>
  )
}
