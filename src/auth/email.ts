/**
 * Sends the sign-in code with Cloudflare Email Service (`send_email` binding `EMAIL`, owner decision on #127).
 * In `wrangler dev` the binding is simulated and the email is printed to the terminal; nothing is sent.
 * This module never logs the code itself.
 */

export interface SendEmailBinding {
  send(message: { to: string; from: string; subject: string; text: string; html?: string }): Promise<unknown>;
}

export interface EmailEnv {
  EMAIL?: SendEmailBinding;
  AUTH_EMAIL_FROM?: string;
}

export function loginCodeMessage(code: string): { subject: string; text: string } {
  return {
    subject: 'Your KP-Web login code',
    text:
      `Your KP-Web login code is ${code}\n\n` +
      'It expires in 10 minutes. If you did not ask for it, you can ignore this email.\n',
  };
}

export async function sendLoginCode(env: EmailEnv, to: string, code: string): Promise<void> {
  if (!env.EMAIL || !env.AUTH_EMAIL_FROM) {
    throw new Error('Email sending is not configured (EMAIL binding or AUTH_EMAIL_FROM missing).');
  }
  const { subject, text } = loginCodeMessage(code);
  await env.EMAIL.send({ to, from: env.AUTH_EMAIL_FROM, subject, text });
}
