import { sendEmail } from "@/lib/email";
import { type EmailPreferenceKey, isEmailPreferenceEnabled } from "@/lib/email-preferences";

export async function sendPreferenceAwareEmail(input: {
  userId: string;
  preferenceKey: EmailPreferenceKey;
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const enabled = await isEmailPreferenceEnabled(input.userId, input.preferenceKey);
  if (!enabled) {
    return false;
  }

  return sendEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}