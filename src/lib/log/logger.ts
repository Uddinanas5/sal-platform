import pino from "pino"

// Structured JSON logger -> stdout (Vercel captures stdout into its log drain).
// Built-in redaction so secrets / PII can never land in a log line even if a
// caller passes them. Pair with src/lib/log/context.ts to bind requestId +
// businessId to every line so you can answer "what happened to tenant X at 3:42pm".
// Redaction config (exported so tests can build an identical logger over a
// capture stream and prove secrets/PII never reach a line).
export const redact = {
  paths: [
    "authorization", "*.authorization",
    "cookie", "*.cookie",
    "password", "*.password", "*.passwordHash",
    "stripe-signature", "*.stripe-signature",
    "secret", "*.secret",
    "token", "*.token",
    "apiKey", "*.apiKey",
    "cardNumber", "*.cardNumber",
    "cvc", "*.cvc",
    "email", "*.email",
    "phone", "*.phone",
  ],
  censor: "[Redacted]",
}

export const baseLogger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact,
  // Vercel/most drains parse JSON; keep timestamps ISO for readability.
  timestamp: pino.stdTimeFunctions.isoTime,
})
