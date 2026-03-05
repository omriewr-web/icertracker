// AtlasPM - Email Templates for Collection Efforts

export interface EmailContext {
  tenantName: string;
  unitNumber: string;
  buildingAddress: string;
  balance: number;
  monthsOwed: number;
  arrearsDays: number;
  marketRent: number;
  leaseExpiration: string | null;
  managerName: string;
  managerPhone?: string;
  managerEmail?: string;
  companyName?: string;
  date?: string;
}

const fmtMoney = (v: number) =>
  "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export function demandLetter(ctx: EmailContext): { subject: string; body: string } {
  return {
    subject: `NOTICE OF DEFAULT - ${ctx.buildingAddress}, Unit ${ctx.unitNumber}`,
    body: `${fmtDate(ctx.date)}

${ctx.tenantName}
${ctx.buildingAddress}
Unit ${ctx.unitNumber}

RE: NOTICE OF DEFAULT AND DEMAND FOR PAYMENT

Dear ${ctx.tenantName},

This letter serves as formal notice that your rent account is currently past due. As of the date of this notice, the outstanding balance on your account is ${fmtMoney(ctx.balance)}, representing approximately ${ctx.monthsOwed.toFixed(1)} month(s) of unpaid rent.

ACCOUNT DETAILS:
Monthly Rent: ${fmtMoney(ctx.marketRent)}
Outstanding Balance: ${fmtMoney(ctx.balance)}
Days Past Due: ${ctx.arrearsDays}

DEMAND: You are hereby demanded to pay the full outstanding balance of ${fmtMoney(ctx.balance)} within fourteen (14) days of receipt of this notice.

Failure to make payment in full within the specified timeframe may result in the commencement of legal proceedings.

Please make payment to: ${ctx.companyName || "Management Office"}
Contact: ${ctx.managerName}${ctx.managerPhone ? " | " + ctx.managerPhone : ""}${ctx.managerEmail ? " | " + ctx.managerEmail : ""}

Sincerely,
${ctx.managerName}
Property Management`.trim(),
  };
}

export function paymentReminder(ctx: EmailContext): { subject: string; body: string } {
  return {
    subject: `Rent Payment Reminder - Unit ${ctx.unitNumber}`,
    body: `Dear ${ctx.tenantName},

This is a friendly reminder that your rent account currently shows an outstanding balance of ${fmtMoney(ctx.balance)}.

Unit: ${ctx.unitNumber} at ${ctx.buildingAddress}
Monthly Rent: ${fmtMoney(ctx.marketRent)}
Current Balance: ${fmtMoney(ctx.balance)}

If you have already submitted your payment, thank you. Otherwise, we kindly ask that you remit payment at your earliest convenience.

Best regards,
${ctx.managerName}`.trim(),
  };
}

export function lateNotice(ctx: EmailContext): { subject: string; body: string } {
  return {
    subject: `Late Rent Notice - ${ctx.buildingAddress}, Unit ${ctx.unitNumber}`,
    body: `${fmtDate(ctx.date)}

Dear ${ctx.tenantName},

Our records indicate that your rent payment is now more than 30 days past due. Your current outstanding balance is ${fmtMoney(ctx.balance)}.

We understand that circumstances may arise that affect your ability to pay on time. However, it is important to bring your account current as soon as possible.

Contact us: ${ctx.managerName}
${ctx.managerEmail || ""}
${ctx.managerPhone || ""}

Regards,
${ctx.managerName}
Property Management`.trim(),
  };
}

export const EMAIL_TEMPLATES = {
  "demand-letter": { name: "14-Day Demand Letter", fn: demandLetter, description: "Formal demand with legal warning" },
  "payment-reminder": { name: "Payment Reminder", fn: paymentReminder, description: "Friendly reminder about balance" },
  "late-notice": { name: "Late Notice (30 Day)", fn: lateNotice, description: "Notice that rent is 30+ days past due" },
} as const;

export type EmailTemplateId = keyof typeof EMAIL_TEMPLATES;