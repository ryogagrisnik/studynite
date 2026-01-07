export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function defaultFromAddress() {
  return process.env.EMAIL_FROM || "RunePrep <no-reply@runeprep.app>";
}

export async function sendEmail({ to, subject, html, text, replyTo }: SendEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.info("[mail:stub]", { to, subject });
    return;
  }

  const payload = {
    from: defaultFromAddress(),
    to,
    subject,
    html,
    text: text ?? html.replace(/<[^>]+>/g, ""),
    ...(replyTo || process.env.EMAIL_REPLY_TO
      ? { reply_to: replyTo || process.env.EMAIL_REPLY_TO }
      : {}),
  };

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Failed to send email", body);
    throw new Error("EMAIL_SEND_FAILED");
  }
}
