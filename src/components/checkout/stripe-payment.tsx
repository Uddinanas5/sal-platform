"use client"

import { useState, useEffect } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
)

interface StripePaymentProps {
  amount: number // in dollars
  email?: string
  name?: string
  appointmentId?: string
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
  disabled?: boolean
}

function CheckoutForm({
  onSuccess,
  onError,
  disabled,
}: {
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
  disabled?: boolean
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setMessage(null)

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success`,
        },
        redirect: "if_required",
      })

      if (error) {
        setMessage(error.message || "Payment failed")
        onError(error.message || "Payment failed")
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        onSuccess(paymentIntent.id)
      } else {
        setMessage("Payment processing...")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Payment failed"
      setMessage(errorMessage)
      onError(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      {message && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          {message}
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing || disabled}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          "Pay Now"
        )}
      </Button>
    </form>
  )
}

export function StripePayment({
  amount,
  email,
  name,
  appointmentId,
  onSuccess,
  onError,
  disabled,
}: StripePaymentProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Create PaymentIntent as soon as the component loads
    async function createPaymentIntent() {
      try {
        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            email,
            name,
            appointmentId,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to initialize payment")
        }

        setClientSecret(data.clientSecret)
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to initialize payment"
        setError(errorMessage)
        onError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    if (amount > 0) {
      createPaymentIntent()
    } else {
      setLoading(false)
    }
  }, [amount, email, name, appointmentId, onError])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-sal-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
        {error}
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        No payment required
      </div>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#059669",
            colorBackground: "#ffffff",
            colorText: "#1f2937",
            colorDanger: "#ef4444",
            fontFamily: "DM Sans, system-ui, sans-serif",
            borderRadius: "8px",
          },
        },
      }}
    >
      <CheckoutForm
        onSuccess={onSuccess}
        onError={onError}
        disabled={disabled}
      />
    </Elements>
  )
}

// Simple card input for saving card on file (no payment)
export function SaveCardForm({
  onSuccess,
  onError,
}: {
  onSuccess: (paymentMethodId: string) => void
  onError: (error: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) return

    setIsProcessing(true)

    try {
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        elements,
        params: {
          type: "card",
        },
      })

      if (error) {
        onError(error.message || "Failed to save card")
      } else if (paymentMethod) {
        onSuccess(paymentMethod.id)
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save card")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Card"
        )}
      </Button>
    </form>
  )
}
