import nodemailer from 'nodemailer';

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 * @returns {Promise<{ sent: boolean, skipped?: boolean, messageId?: string }>}
 */
export async function sendTransactionalMail({ to, subject, text, html }) {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.MAIL_FROM?.trim() || user || 'noreply@localhost';

  if (!host) {
    console.warn(
      '[mail] SMTP_HOST not set — email not sent. To:',
      to,
      'Subject:',
      subject,
      '\n-----\n',
      text,
      '\n-----'
    );
    return { sent: false, skipped: true };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html: html || text.replace(/\n/g, '<br/>'),
  });

  return { sent: true, messageId: info.messageId };
}

/**
 * @param {{ to: string, name?: string, verifyUrl: string }} opts
 */
export async function sendEmailVerificationMail({ to, name, verifyUrl }) {
  const subject = 'Verify your IronLog email';
  const text = `Hi${name ? ` ${name}` : ''},

Confirm your email to unlock imports, nutrition, social features, and season ranks:

${verifyUrl}

This link expires in 48 hours. If you did not create an account, ignore this message.

— IronLog`;

  return sendTransactionalMail({ to, subject, text });
}
