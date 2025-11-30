import { sendEmailViaResend, isResendConfigured } from './resendEmailSender.js';
import { SESEmailService, SESEmailParams } from './sesService.js';
import { db } from './db.js';
import { emailProviderIntegrations } from './db.js';
import { eq } from 'drizzle-orm';
import { decryptObject } from './encryption.js';

export interface EmailParams {
  to: string;
  from: string;
  fromName: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  userId: string; // REQUIRED for per-user email provider
}

export type EmailProvider = 'resend' | 'ses' | 'sendgrid' | 'mailgun';

export class UnifiedEmailService {
  async sendEmail(params: EmailParams): Promise<{ messageId?: string }> {
    const { userId, ...emailParams } = params;
    
    // Fetch user's email provider integration
    const [integration] = await db
      .select()
      .from(emailProviderIntegrations)
      .where(eq(emailProviderIntegrations.userId, userId));
    
    if (!integration || !integration.isActive) {
      // CRITICAL: No fallback to global credentials - enforce per-user email provider configuration
      // This ensures true multi-tenant isolation and prevents accidental use of shared credentials
      throw new Error(
        `EMAIL PROVIDER NOT CONFIGURED: User ${userId} must configure an email provider integration before sending emails. ` +
        `Please configure AWS SES credentials in Settings > Email Integration. ` +
        `Per-user email provider configuration is required for multi-tenant email delivery.`
      );
    }
    
    // Decrypt credentials from database before using
    const encryptedConfig = integration.config as any;
    const config = decryptObject(encryptedConfig);
    
    switch (integration.provider) {
      case 'ses':
        return await this.sendViaSES(emailParams, config);
      case 'resend':
        // CRITICAL: Per-user Resend is NOT supported
        // This should never execute due to POST endpoint validation,
        // but if it does (e.g., legacy data), throw explicit error
        throw new Error(
          `UNSUPPORTED PROVIDER: Resend does not support per-user credentials yet. ` +
          `Only AWS SES is currently supported for multi-tenant email integration. ` +
          `Please reconfigure your email provider to use SES, or contact support.`
        );
      case 'sendgrid':
        throw new Error('SendGrid provider not yet implemented. Only AWS SES is currently supported.');
      case 'mailgun':
        throw new Error('Mailgun provider not yet implemented. Only AWS SES is currently supported.');
      default:
        throw new Error(`Unknown email provider: ${integration.provider}`);
    }
  }

  private async sendViaSES(params: Omit<EmailParams, 'userId'>, config: any): Promise<{ messageId: string }> {
    if (!config.awsAccessKeyId || !config.awsSecretAccessKey || !config.awsRegion) {
      throw new Error('AWS SES not configured. Missing credentials.');
    }
    
    const sesService = new SESEmailService(
      config.awsAccessKeyId,
      config.awsSecretAccessKey,
      config.awsRegion
    );
    
    const sesParams: SESEmailParams = {
      to: params.to,
      from: params.from,
      fromName: params.fromName,
      replyTo: params.replyTo,
      subject: params.subject,
      html: params.html,
      text: params.text,
    };

    return await sesService.sendEmail(sesParams);
  }

  private async sendViaResend(params: Omit<EmailParams, 'userId'>, config?: any): Promise<{ messageId?: string }> {
    // NOTE: Per-user Resend credentials are NOT YET SUPPORTED
    // Even if user configures Resend API key/fromEmail in their integration,
    // this will use the global Resend configuration from environment.
    // TODO: Implement custom Resend client instantiation with per-user credentials
    //       similar to how SES works (new Resend(config.apiKey))
    // For now, only AWS SES supports true per-user credential routing.
    
    await sendEmailViaResend(params);
    return {};
  }

  async isConfigured(userId: string): Promise<boolean> {
    const [integration] = await db
      .select()
      .from(emailProviderIntegrations)
      .where(eq(emailProviderIntegrations.userId, userId));
    
    // SES-only enforcement: Only return true if active SES integration exists
    // No fallback to global Resend - users must configure their own SES credentials
    return !!(integration && integration.isActive && integration.provider === 'ses');
  }

  async getProvider(userId: string): Promise<EmailProvider | null> {
    const [integration] = await db
      .select()
      .from(emailProviderIntegrations)
      .where(eq(emailProviderIntegrations.userId, userId));
    
    // Return null when no integration exists instead of defaulting to 'resend'
    // This ensures UI/backend consistency with SES-only enforcement
    return (integration?.provider as EmailProvider) || null;
  }
}

export const emailService = new UnifiedEmailService();
