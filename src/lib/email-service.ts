import { Resend } from "resend";
import { prisma } from "./prisma";
import {
  captureBusinessMessage,
  captureSentryException,
} from "./sentry-observability";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY environment variable is required");
  return new Resend(apiKey);
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  type: string;
  tenantId?: string;
  sentById: string;
}) {
  const resend = getResend();
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@example.com";

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      text: params.body,
    });

    if (error) throw new Error(error.message);

    await prisma.emailLog.create({
      data: {
        tenantId: params.tenantId || null,
        sentById: params.sentById,
        type: params.type as any,
        subject: params.subject,
        body: params.body,
        recipientEmail: params.to,
        status: "sent",
      },
    });

    return data;
  } catch (err: any) {
    captureBusinessMessage("Email delivery failed", {
      level: "error",
      tags: {
        tenantId: params.tenantId,
        userId: params.sentById,
        emailType: params.type,
      },
      extra: {
        recipientEmail: params.to,
        subject: params.subject,
      },
      fingerprint: ["email-delivery-failed", params.type],
    });
    captureSentryException(err, {
      level: "error",
      tags: {
        tenantId: params.tenantId,
        userId: params.sentById,
        emailType: params.type,
      },
      extra: {
        recipientEmail: params.to,
        subject: params.subject,
      },
    });

    // Log the failed send attempt
    try {
      await prisma.emailLog.create({
        data: {
          tenantId: params.tenantId || null,
          sentById: params.sentById,
          type: params.type as any,
          subject: params.subject,
          body: params.body,
          recipientEmail: params.to,
          status: "failed",
        },
      });
    } catch {
      // Don't mask the original error if logging fails
    }
    throw err;
  }
}
