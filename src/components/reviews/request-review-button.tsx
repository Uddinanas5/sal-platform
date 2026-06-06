"use client"

import { useTransition } from "react"
import { Star, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { sendReviewRequest } from "@/lib/actions/reviews"

/**
 * Optional "Request review" action for a COMPLETED appointment. Self-contained
 * so it can be dropped into the appointment detail sheet (or anywhere) with a
 * single import — without touching the appointments action. It only renders for
 * completed visits; for anything else it returns null.
 *
 * Wiring example (inside AppointmentDetailSheet, near the other actions):
 *   <RequestReviewButton appointmentId={appointment.id} status={appointment.status} />
 */
export function RequestReviewButton({
  appointmentId,
  status,
  className,
}: {
  appointmentId: string
  status: string
  className?: string
}) {
  const [isPending, startTransition] = useTransition()

  if (status !== "completed") return null

  function handleClick() {
    startTransition(async () => {
      const result = await sendReviewRequest(appointmentId)
      if (result.success) {
        toast.success("Review request sent", {
          description: "We emailed the client a link to leave a review.",
        })
      } else {
        toast.error(result.error || "Could not send review request")
      }
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={isPending}
      className={className}
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Star className="mr-2 h-4 w-4" />
      )}
      Request review
    </Button>
  )
}
