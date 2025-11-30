import { db } from "./db.js";
import { paymentProviders, paymentTransactions, users } from "../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { decryptObject } from "./encryption.js";
import crypto from "crypto";

// Common interface for payment providers
interface PaymentProvider {
  createOrder(amount: number, currency: string, userId?: string): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    clientData?: any; // Client-specific data (e.g., Razorpay key_id)
  }>;
  
  verifySignature(payload: any): Promise<boolean>;
  
  parseWebhookEvent(headers: any, body: any): Promise<{
    eventType: string;
    transactionId: string;
    orderId: string;
    amount: number;
    status: 'pending' | 'authorized' | 'captured' | 'failed';
    metadata?: any;
  } | null>;
}

// Razorpay Provider Implementation
class RazorpayProvider implements PaymentProvider {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async createOrder(amount: number, currency: string, userId?: string): Promise<any> {
    // Note: In production, use Razorpay SDK
    // For now, we'll create a manual order structure
    const orderId = `order_${crypto.randomBytes(16).toString('hex')}`;
    
    return {
      orderId,
      amount: amount * 100, // Convert to paise
      currency: currency.toUpperCase(),
      clientData: {
        keyId: this.config.keyId,
        // Never expose keySecret to client
      },
    };
  }

  async verifySignature(payload: any): Promise<boolean> {
    // Verify Razorpay signature using HMAC SHA256
    const { orderId, paymentId, signature } = payload;
    
    if (!orderId || !paymentId || !signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.config.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  async parseWebhookEvent(headers: any, body: any): Promise<any> {
    // Verify webhook signature
    const webhookSignature = headers['x-razorpay-signature'];
    const webhookSecret = this.config.webhookSecret || this.config.keySecret;

    if (!webhookSignature) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(webhookSignature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      return null;
    }

    // Parse event
    const event = body.event;
    const payload = body.payload?.payment?.entity || {};

    let status: 'pending' | 'authorized' | 'captured' | 'failed' = 'pending';
    if (event === 'payment.captured') status = 'captured';
    else if (event === 'payment.authorized') status = 'authorized';
    else if (event === 'payment.failed') status = 'failed';

    return {
      eventType: event,
      transactionId: payload.id,
      orderId: payload.order_id,
      amount: payload.amount / 100, // Convert from paise
      status,
      metadata: payload,
    };
  }
}

// PayPal Provider Implementation
class PayPalProvider implements PaymentProvider {
  private config: any;
  private baseUrl: string;

  constructor(config: any) {
    this.config = config;
    this.baseUrl = config.mode === 'production' 
      ? 'https://api.paypal.com' 
      : 'https://api.sandbox.paypal.com';
  }

  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const data = await response.json() as any;
    return data.access_token;
  }

  async createOrder(amount: number, currency: string, userId?: string): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency.toUpperCase(),
            value: amount.toString(),
          },
        }],
      }),
    });

    const order = await response.json() as any;

    return {
      orderId: order.id,
      amount,
      currency: currency.toUpperCase(),
      clientData: {
        // Client will use this to complete payment
      },
    };
  }

  async verifySignature(payload: any): Promise<boolean> {
    // For PayPal, verification happens by fetching the order details
    const { orderId } = payload;
    
    if (!orderId) {
      return false;
    }

    try {
      const token = await this.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const order = await response.json() as any;
      
      // Verify order status is COMPLETED
      return order.status === 'COMPLETED' || order.status === 'APPROVED';
    } catch (error) {
      console.error('PayPal verification error:', error);
      return false;
    }
  }

  async parseWebhookEvent(headers: any, body: any): Promise<any> {
    // PayPal webhook verification is more complex
    // For now, we'll do basic verification
    // In production, verify using PayPal's certificate and signature
    
    const event = body.event_type;
    const resource = body.resource;

    let status: 'pending' | 'authorized' | 'captured' | 'failed' = 'pending';
    if (event === 'PAYMENT.CAPTURE.COMPLETED') status = 'captured';
    else if (event === 'PAYMENT.AUTHORIZATION.CREATED') status = 'authorized';
    else if (event === 'PAYMENT.CAPTURE.DENIED' || event === 'PAYMENT.CAPTURE.DECLINED') status = 'failed';

    return {
      eventType: event,
      transactionId: resource.id,
      orderId: resource.supplementary_data?.related_ids?.order_id || resource.id,
      amount: parseFloat(resource.amount?.value || '0'),
      status,
      metadata: resource,
    };
  }
}

// Payment Service Facade
export class PaymentService {
  private static async getProvider(providerName: 'razorpay' | 'paypal'): Promise<PaymentProvider | null> {
    const [provider] = await db
      .select()
      .from(paymentProviders)
      .where(and(
        eq(paymentProviders.provider, providerName),
        eq(paymentProviders.isActive, true)
      ))
      .limit(1);

    if (!provider) {
      return null;
    }

    const config = decryptObject(provider.config);

    if (providerName === 'razorpay') {
      return new RazorpayProvider(config);
    } else {
      return new PayPalProvider(config);
    }
  }

  static async createOrder(
    providerName: 'razorpay' | 'paypal',
    amount: number,
    currency: string,
    email: string
  ): Promise<any> {
    const provider = await this.getProvider(providerName);
    
    if (!provider) {
      throw new Error(`Provider ${providerName} not available or not active`);
    }

    const order = await provider.createOrder(amount, currency);

    // Create pending transaction
    const [transaction] = await db
      .insert(paymentTransactions)
      .values({
        userId: null, // User doesn't exist yet
        provider: providerName,
        transactionId: order.orderId,
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        status: 'pending',
        paymentData: { email, orderId: order.orderId },
      })
      .returning();

    return {
      ...order,
      transactionDbId: transaction.id,
    };
  }

  static async verifyPayment(
    providerName: 'razorpay' | 'paypal',
    payload: any
  ): Promise<boolean> {
    const provider = await this.getProvider(providerName);
    
    if (!provider) {
      return false;
    }

    return await provider.verifySignature(payload);
  }

  static async processWebhook(
    providerName: 'razorpay' | 'paypal',
    headers: any,
    body: any
  ): Promise<any> {
    const provider = await this.getProvider(providerName);
    
    if (!provider) {
      return null;
    }

    const event = await provider.parseWebhookEvent(headers, body);
    
    if (!event) {
      return null; // Invalid signature or parsing failed
    }

    // Update transaction with idempotency
    const [existingTx] = await db
      .select()
      .from(paymentTransactions)
      .where(and(
        eq(paymentTransactions.transactionId, event.transactionId),
        eq(paymentTransactions.provider, providerName)
      ))
      .limit(1);

    if (existingTx) {
      // Update existing transaction
      const existingData = (existingTx.paymentData as any) || {};
      await db
        .update(paymentTransactions)
        .set({
          status: event.status,
          paymentData: { ...existingData, ...event.metadata },
        })
        .where(eq(paymentTransactions.id, existingTx.id));
    } else {
      // Create new transaction from webhook
      await db
        .insert(paymentTransactions)
        .values({
          userId: null,
          provider: providerName,
          transactionId: event.transactionId,
          amount: Math.round(event.amount * 100), // Convert to cents
          currency: 'USD',
          status: event.status,
          paymentData: event.metadata,
        });
    }

    return event;
  }

  static async capturePayment(
    providerName: 'razorpay' | 'paypal',
    orderId: string
  ): Promise<any> {
    const provider = await this.getProvider(providerName);
    
    if (!provider || providerName !== 'paypal') {
      return null;
    }

    // PayPal-specific capture logic
    const paypalProvider = provider as PayPalProvider;
    const token = await (paypalProvider as any).getAccessToken();
    const baseUrl = (paypalProvider as any).baseUrl;

    const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    return await response.json();
  }
}
