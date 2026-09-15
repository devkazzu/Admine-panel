/**
 * Mail service for password-reset delivery.
 *
 * MAIL_TRANSPORT=console (default): messages are printed to the server log —
 * zero credentials required for local development; the operator hands the link
 * to the user. MAIL_TRANSPORT=smtp: real delivery using SMTP_* env vars.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';

let transporter: Transporter | null = null;

if (config.mail.transport === 'smtp' && config.mail.host) {
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  });
} else if (config.mail.transport === 'smtp') {
  console.warn('⚠️  MAIL_TRANSPORT=smtp but SMTP_HOST is empty — falling back to console transport');
}

export interface SendResult {
  delivered: boolean;
  /** When using the console transport, the message that was logged. */
  logged?: boolean;
}

export async function sendMail(to: string, subject: string, text: string): Promise<SendResult> {
  if (transporter) {
    await transporter.sendMail({ from: config.mail.from, to, subject, text });
    return { delivered: true };
  }
  console.log('\n──────── ✉️  MAIL (console transport) ────────');
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(text);
  console.log('───────────────────────────────────────────────\n');
  return { delivered: false, logged: true };
}

export const mailerMode = transporter ? 'smtp' : 'console';
