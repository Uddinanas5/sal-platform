const SAL_COLOR = "#E57A44"
const SAL_COLOR_DARK = "#C9643A"

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAL Platform</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9f7f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f9f7f4;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px; text-align: center; background-color: ${SAL_COLOR};">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="width: 40px; height: 40px; background-color: rgba(255,255,255,0.2); border-radius: 10px; text-align: center; vertical-align: middle;">
                    <span style="font-size: 20px; font-weight: bold; color: #ffffff;">S</span>
                  </td>
                  <td style="padding-left: 12px;">
                    <span style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 1px;">SAL</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #faf8f5; border-top: 1px solid #f0ece7; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #9a9590; line-height: 1.5;">
                Sent by SAL Platform<br>
                &copy; ${new Date().getFullYear()} SAL. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function bookingConfirmationEmail({
  clientName,
  serviceName,
  staffName,
  dateTime,
  businessName,
  bookingRef,
}: {
  clientName: string
  serviceName: string
  staffName: string
  dateTime: string
  businessName: string
  bookingRef: string
}): string {
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #1a1a1a;">Booking Confirmed</h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: #6b6560; line-height: 1.5;">
      Hi ${clientName}, your appointment at <strong>${businessName}</strong> has been confirmed.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #faf8f5; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td style="padding: 6px 0;">
                <span style="font-size: 13px; color: #9a9590; text-transform: uppercase; letter-spacing: 0.5px;">Service</span><br>
                <span style="font-size: 15px; color: #1a1a1a; font-weight: 600;">${serviceName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">
                <span style="font-size: 13px; color: #9a9590; text-transform: uppercase; letter-spacing: 0.5px;">Staff</span><br>
                <span style="font-size: 15px; color: #1a1a1a; font-weight: 600;">${staffName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">
                <span style="font-size: 13px; color: #9a9590; text-transform: uppercase; letter-spacing: 0.5px;">Date &amp; Time</span><br>
                <span style="font-size: 15px; color: #1a1a1a; font-weight: 600;">${dateTime}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">
                <span style="font-size: 13px; color: #9a9590; text-transform: uppercase; letter-spacing: 0.5px;">Booking Reference</span><br>
                <span style="font-size: 15px; color: ${SAL_COLOR}; font-weight: 700; letter-spacing: 0.5px;">${bookingRef}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin: 0; font-size: 14px; color: #6b6560; line-height: 1.6;">
      Need to make changes? Contact us to reschedule or cancel your appointment. Please reference your booking code <strong>${bookingRef}</strong>.
    </p>
  `
  return baseLayout(content)
}

export function passwordResetEmail({
  name,
  resetUrl,
}: {
  name: string
  resetUrl: string
}): string {
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #1a1a1a;">Reset Your Password</h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: #6b6560; line-height: 1.5;">
      Hi ${name}, we received a request to reset your password. Click the button below to create a new one.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px;">
      <tr>
        <td style="background-color: ${SAL_COLOR}; border-radius: 8px;">
          <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">
            Reset Your Password
          </a>
        </td>
      </tr>
    </table>

    <p style="margin: 0 0 16px; font-size: 14px; color: #6b6560; line-height: 1.6;">
      This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.
    </p>

    <p style="margin: 0; font-size: 13px; color: #9a9590; line-height: 1.5; word-break: break-all;">
      If the button above doesn&rsquo;t work, copy and paste this URL into your browser:<br>
      <a href="${resetUrl}" style="color: ${SAL_COLOR_DARK};">${resetUrl}</a>
    </p>
  `
  return baseLayout(content)
}

export function welcomeEmail({
  name,
  businessName,
}: {
  name: string
  businessName: string
}): string {
  const content = `
    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #1a1a1a;">Welcome to ${businessName}!</h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: #6b6560; line-height: 1.5;">
      Hi ${name}, your account has been created successfully. We&rsquo;re excited to have you on board.
    </p>

    <h2 style="margin: 0 0 16px; font-size: 17px; font-weight: 600; color: #1a1a1a;">Quick Start Tips</h2>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 24px;">
      <tr>
        <td style="padding: 12px 16px; background-color: #faf8f5; border-radius: 8px; margin-bottom: 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td style="width: 32px; vertical-align: top;">
                <span style="display: inline-block; width: 24px; height: 24px; background-color: ${SAL_COLOR}; color: #fff; border-radius: 50%; text-align: center; line-height: 24px; font-size: 13px; font-weight: 700;">1</span>
              </td>
              <td style="vertical-align: top;">
                <strong style="color: #1a1a1a; font-size: 14px;">Book an Appointment</strong>
                <p style="margin: 4px 0 0; font-size: 13px; color: #6b6560;">Browse available services and pick a time that works for you.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 12px 16px; background-color: #faf8f5; border-radius: 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td style="width: 32px; vertical-align: top;">
                <span style="display: inline-block; width: 24px; height: 24px; background-color: ${SAL_COLOR}; color: #fff; border-radius: 50%; text-align: center; line-height: 24px; font-size: 13px; font-weight: 700;">2</span>
              </td>
              <td style="vertical-align: top;">
                <strong style="color: #1a1a1a; font-size: 14px;">Complete Your Profile</strong>
                <p style="margin: 4px 0 0; font-size: 13px; color: #6b6560;">Add your preferences so we can personalize your experience.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 12px 16px; background-color: #faf8f5; border-radius: 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td style="width: 32px; vertical-align: top;">
                <span style="display: inline-block; width: 24px; height: 24px; background-color: ${SAL_COLOR}; color: #fff; border-radius: 50%; text-align: center; line-height: 24px; font-size: 13px; font-weight: 700;">3</span>
              </td>
              <td style="vertical-align: top;">
                <strong style="color: #1a1a1a; font-size: 14px;">Leave a Review</strong>
                <p style="margin: 4px 0 0; font-size: 13px; color: #6b6560;">After your visit, share your feedback to help us improve.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin: 0; font-size: 14px; color: #6b6560; line-height: 1.6;">
      If you have any questions, don&rsquo;t hesitate to reach out. We&rsquo;re here to help!
    </p>
  `
  return baseLayout(content)
}
