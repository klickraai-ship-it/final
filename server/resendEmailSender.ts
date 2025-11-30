import { getUncachableResendClient } from './resendClient.js';

export interface SendEmailParams {
  to: string;
  from: string;
  fromName: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmailViaResend(params: SendEmailParams): Promise<void> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const fromAddress = `${params.fromName} <${fromEmail}>`;
    
    await client.emails.send({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });
    
    console.log(`Email sent successfully to ${params.to}`);
  } catch (error) {
    console.error(`Failed to send email via Resend to ${params.to}:`, error);
    throw error;
  }
}

export async function isResendConfigured(): Promise<boolean> {
  try {
    await getUncachableResendClient();
    return true;
  } catch (error) {
    return false;
  }
}
