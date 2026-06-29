import { Resend } from "resend";
import { formatINR } from "@/lib/pricing";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM = process.env.EMAIL_FROM ?? "Riverscape Resort <noreply@riverscape.in>";
const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "917619124660";

export function buildWhatsAppLink(message: string): string {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function bookingConfirmationWaLink(booking: {
  bookingRef: string;
  guestName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
}): string {
  const msg =
    `Hi, I just completed my booking at Riverscape Resort!\n` +
    `Booking Ref: ${booking.bookingRef}\n` +
    `Room: ${booking.roomName}\n` +
    `Check-in: ${booking.checkIn}  Check-out: ${booking.checkOut}\n` +
    `Guest: ${booking.guestName}\n` +
    `Please confirm my reservation. Thank you!`;
  return buildWhatsAppLink(msg);
}

export async function sendBookingConfirmation(booking: {
  guestEmail: string;
  guestName: string;
  bookingRef: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: number;
}): Promise<void> {
  try {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:#1a3a2a;padding:32px;text-align:center;">
          <h1 style="color:#f5f0e8;font-family:Georgia,serif;font-size:28px;margin:0 0 4px;">Riverscape</h1>
          <p style="color:#c9a84c;font-size:13px;margin:0;letter-spacing:2px;text-transform:uppercase;">Booking Confirmed</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="color:#1a3a2a;font-size:16px;margin:0 0 24px;">Dear ${booking.guestName},</p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Your booking at Riverscape Resort, Kalady Neeleswaram has been confirmed. We look forward to welcoming you.
          </p>
          <!-- Booking details box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;border-radius:6px;padding:20px;margin-bottom:24px;">
            <tr><td>
              <table width="100%" cellpadding="6" cellspacing="0">
                <tr>
                  <td style="color:#666;font-size:13px;width:50%;">Booking Reference</td>
                  <td style="color:#1a3a2a;font-size:13px;font-weight:bold;">${booking.bookingRef}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;">Room</td>
                  <td style="color:#1a3a2a;font-size:13px;">${booking.roomName}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;">Check-in</td>
                  <td style="color:#1a3a2a;font-size:13px;">${booking.checkIn}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;">Check-out</td>
                  <td style="color:#1a3a2a;font-size:13px;">${booking.checkOut}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;">Duration</td>
                  <td style="color:#1a3a2a;font-size:13px;">${booking.nights} night${booking.nights !== 1 ? "s" : ""}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;">Guests</td>
                  <td style="color:#1a3a2a;font-size:13px;">${booking.adults} adult${booking.adults !== 1 ? "s" : ""}${booking.children > 0 ? `, ${booking.children} child${booking.children !== 1 ? "ren" : ""}` : ""}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;padding-top:12px;border-top:1px solid #ddd;">Total Paid</td>
                  <td style="color:#1a3a2a;font-size:15px;font-weight:bold;padding-top:12px;border-top:1px solid #ddd;">${formatINR(booking.totalAmount)}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 16px;">
            <strong>Check-in Time:</strong> 2:00 PM &nbsp;|&nbsp; <strong>Check-out Time:</strong> 11:00 AM
          </p>
          <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 24px;">
            For any assistance, WhatsApp us at +91 76191 24660 or email stay@riverscape.in.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#1a3a2a;padding:20px;text-align:center;">
          <p style="color:#c9a84c;font-size:12px;margin:0;">Riverscape Resort &middot; Kalady Neeleswaram, Kerala</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await getResend().emails.send({
      from: FROM,
      to: booking.guestEmail,
      subject: `Booking Confirmed — ${booking.bookingRef} | Riverscape Resort`,
      html,
    });
  } catch {
    // Non-blocking — don't fail the booking flow on email error
  }
}

export async function sendBookingCancellation(booking: {
  guestEmail: string;
  guestName: string;
  bookingRef: string;
}): Promise<void> {
  try {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#1a3a2a;padding:32px;text-align:center;">
          <h1 style="color:#f5f0e8;font-family:Georgia,serif;font-size:28px;margin:0 0 4px;">Riverscape</h1>
          <p style="color:#c9a84c;font-size:13px;margin:0;letter-spacing:2px;text-transform:uppercase;">Booking Cancelled</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#1a3a2a;font-size:16px;margin:0 0 16px;">Dear ${booking.guestName},</p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Your booking <strong>${booking.bookingRef}</strong> has been cancelled as requested.
          </p>
          <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 24px;">
            If you have any questions or would like to rebook, please contact us at stay@riverscape.in or WhatsApp +91 76191 24660.
          </p>
        </td></tr>
        <tr><td style="background:#1a3a2a;padding:20px;text-align:center;">
          <p style="color:#c9a84c;font-size:12px;margin:0;">Riverscape Resort &middot; Kalady Neeleswaram, Kerala</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await getResend().emails.send({
      from: FROM,
      to: booking.guestEmail,
      subject: `Booking Cancelled — ${booking.bookingRef} | Riverscape Resort`,
      html,
    });
  } catch {
    // Non-blocking
  }
}

/**
 * Sends a cancellation email with stay details and an optional reason.
 * Unlike the helpers above, this intentionally does NOT swallow errors — the
 * caller is expected to wrap it in try/catch and log failures, so a Resend
 * outage never breaks the cancellation flow but is still surfaced in logs.
 */
export async function sendCancellationEmail(booking: {
  guestEmail: string;
  guestName: string;
  bookingRef: string;
  roomName: string;
  checkIn: string; // formatted string
  checkOut: string;
  reason?: string;
}): Promise<void> {
  const reasonLine = booking.reason?.trim()
    ? `<p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 16px;"><strong>Reason:</strong> ${booking.reason.trim()}</p>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#1a3a2a;padding:32px;text-align:center;">
          <h1 style="color:#f5f0e8;font-family:Georgia,serif;font-size:28px;margin:0 0 4px;">Riverscape</h1>
          <p style="color:#c9a84c;font-size:13px;margin:0;letter-spacing:2px;text-transform:uppercase;">Booking Cancelled</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#1a3a2a;font-size:16px;margin:0 0 16px;">Dear ${booking.guestName},</p>
          <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Your booking <strong>${booking.bookingRef}</strong> has been cancelled.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;border-radius:6px;padding:16px;margin-bottom:16px;">
            <tr><td>
              <table width="100%" cellpadding="6" cellspacing="0">
                <tr>
                  <td style="color:#666;font-size:13px;width:40%;">Room</td>
                  <td style="color:#1a3a2a;font-size:13px;">${booking.roomName}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;">Check-in</td>
                  <td style="color:#1a3a2a;font-size:13px;">${booking.checkIn}</td>
                </tr>
                <tr>
                  <td style="color:#666;font-size:13px;">Check-out</td>
                  <td style="color:#1a3a2a;font-size:13px;">${booking.checkOut}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          ${reasonLine}
          <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 24px;">
            If you have any questions or would like to rebook, please contact us at stay@riverscape.in or WhatsApp +91 76191 24660.
          </p>
        </td></tr>
        <tr><td style="background:#1a3a2a;padding:20px;text-align:center;">
          <p style="color:#c9a84c;font-size:12px;margin:0;">Riverscape Resort &middot; Kalady Neeleswaram, Kerala</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await getResend().emails.send({
    from: FROM,
    to: booking.guestEmail,
    subject: `Booking Cancelled — ${booking.bookingRef} | Riverscape Resort`,
    html,
  });
}
