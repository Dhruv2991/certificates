import fs from "fs";
import path from "path";

export interface SendCertificateEmailParams {
  recipientName: string;
  recipientEmail: string;
  certificateId: string;
  certificateType: "participant" | "volunteer";
  filename?: string;
}

export interface BrevoEmailResult {
  sent: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Sends the certificate directly to the recipient's email address using Brevo (Sendinblue) API v3.
 * Attaches the high-resolution certificate PNG directly to the email.
 */
export async function sendCertificateViaBrevo(
  params: SendCertificateEmailParams
): Promise<BrevoEmailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || "dhruvg.cs24@bmsce.ac.in";
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "TeamCodeLocked";

  // If no API key is provided, return graceful skipped state without crashing the user's search
  if (!apiKey || apiKey === "your_brevo_api_key_here") {
    console.log(
      `[Brevo Service] Skipped email sending to ${params.recipientEmail} (BREVO_API_KEY is not configured).`
    );
    return {
      sent: false,
      skipped: true,
      error: "BREVO_API_KEY not configured. Set BREVO_API_KEY in .env.local to enable auto-email delivery.",
    };
  }

  try {
    const isVol = params.certificateType === "volunteer";
    const certTypeName = isVol
      ? "Certificate of Appreciation (Volunteer)"
      : "Certificate of Participation";

    // Read certificate file from public/certificates/{id}.png to attach as base64
    const certFileName = params.filename || `${params.certificateId}.png`;
    const certPath = path.join(process.cwd(), "public", "certificates", certFileName);

    let attachments: { name: string; content: string }[] = [];

    if (fs.existsSync(/* turbopackIgnore: true */ certPath)) {
      const fileBuffer = fs.readFileSync(/* turbopackIgnore: true */ certPath);
      const base64Content = fileBuffer.toString("base64");
      attachments.push({
        name: `Certificate_${params.recipientName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${params.certificateId}.png`,
        content: base64Content,
      });
    }

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your TeamCodeLocked Orientation Certificate</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #090d16; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          
          <!-- Header Bar -->
          <tr>
            <td style="padding: 32px 36px; background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); border-bottom: 1px solid #334155;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">TeamCodeLocked</span>
                    <span style="display: inline-block; font-size: 11px; font-weight: 700; color: #f43f5e; background-color: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.3); padding: 2px 8px; border-radius: 9999px; margin-left: 8px;">ORIENTATION 2026</span>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">B.M.S. College of Engineering &bull; Powered by BitByBit</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px;">
              <h1 style="font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 12px 0;">
                Hello, <span style="color: #d946ef;">${params.recipientName}</span>! 🎉
              </h1>

              <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin: 0 0 24px 0;">
                Thank you for ${isVol ? "your invaluable contribution as an Orientation Volunteer" : "participating in the official TeamCodeLocked Club Orientation 2026"} at B.M.S. College of Engineering.
              </p>

              <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin: 0 0 24px 0;">
                Your official <strong>${certTypeName}</strong> has been generated and is attached to this email in print-ready high resolution (2000&times;1414).
              </p>

              <!-- Certificate Meta Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #020617; border: 1px solid #1e293b; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 18px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; padding-bottom: 6px;">Recipient Name</td>
                        <td align="right" style="font-size: 13px; font-weight: 600; color: #f8fafc; padding-bottom: 6px;">${params.recipientName}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 12px; color: #64748b; padding-bottom: 6px;">Unique Credential ID</td>
                        <td align="right" style="font-size: 13px; font-family: monospace; font-weight: 700; color: #38bdf8; padding-bottom: 6px;">${params.certificateId}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 12px; color: #64748b; padding-bottom: 6px;">Category</td>
                        <td align="right" style="font-size: 12px; font-weight: 700; color: ${isVol ? "#34d399" : "#a78bfa"}; padding-bottom: 6px;">${isVol ? "VOLUNTEER" : "PARTICIPANT"}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 12px; color: #64748b;">Institution</td>
                        <td align="right" style="font-size: 12px; color: #94a3b8;">B.M.S. College of Engineering</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- BitByBit Growth Arena Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%); border: 1px solid rgba(217, 70, 239, 0.3); border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px;">
                    <div style="font-size: 11px; font-weight: 800; color: #fb923c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                      ⚔️ THE NEXT CHALLENGE FOR YOU
                    </div>
                    <div style="font-size: 18px; font-weight: 800; color: #ffffff; margin-bottom: 8px;">
                      Join the BitByBit Competitive Coding Arena
                    </div>
                    <p style="font-size: 13px; color: #cbd5e1; line-height: 1.5; margin: 0 0 18px 0;">
                      BitByBit is TeamCodeLocked's coding arena. Test your problem-solving speed in real-time 1v1 code duels, ranked weekly contests, and climb the BMSCE leaderboard!
                    </p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background: linear-gradient(90deg, #7c3aed 0%, #db2777 50%, #ea580c 100%); border-radius: 8px;">
                          <a href="https://bitbybit-9h8e.vercel.app" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 13px; font-weight: 700; color: #ffffff; text-decoration: none;">
                            Launch BitByBit Arena &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
                If you have any questions or need to correct your details, feel free to contact our coordinator team at <a href="mailto:dhruvg.cs24@bmsce.ac.in" style="color: #38bdf8; text-decoration: none;">dhruvg.cs24@bmsce.ac.in</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #020617; border-top: 1px solid #1e293b; text-align: center;">
              <p style="font-size: 11px; color: #64748b; margin: 0 0 4px 0;">
                &copy; 2026 TeamCodeLocked. All rights reserved. Built by Dhruv G Nayak &amp; Technical, Design and Marketing Team of TeamCodeLocked.
              </p>
              <p style="font-size: 11px; color: #475569; margin: 0;">
                <a href="https://bitbybit-9h8e.vercel.app" style="color: #64748b; text-decoration: none;">bitbybit-9h8e.vercel.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const brevoPayload = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: params.recipientEmail,
          name: params.recipientName,
        },
      ],
      subject: `Your TeamCodeLocked ${isVol ? "Volunteer Certificate of Appreciation" : "Orientation Certificate"} 🎓`,
      htmlContent: htmlBody,
      attachment: attachments,
    };

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(brevoPayload),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[Brevo Service] Email sent to ${params.recipientEmail}. MessageId: ${data.messageId}`);
      return {
        sent: true,
        messageId: data.messageId,
      };
    } else {
      const errText = await res.text();
      console.error(`[Brevo Service] Error sending email (${res.status}): ${errText}`);
      return {
        sent: false,
        error: `Brevo API returned status ${res.status}: ${errText}`,
      };
    }
  } catch (err: any) {
    console.error("[Brevo Service] Exception sending email:", err);
    return {
      sent: false,
      error: err.message || "Unknown error sending email via Brevo",
    };
  }
}
