import type { Request, Response, Express } from 'express';
import { promises as dns } from 'dns';
import { db } from './db';
import { campaignSubscribers, subscribers, linkClicks, campaigns } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  decodeTrackingToken,
  decodeClickTrackingToken,
  decodeUnsubscribeToken,
} from './trackingTokens';

const TRACKING_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

export function setupTrackingRoutes(app: Express) {
  app.get('/track/open/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const decoded = decodeTrackingToken(token);

      if (decoded) {
        await db.execute(sql`
          UPDATE campaign_subscribers
          SET opened_at = COALESCE(opened_at, NOW())
          WHERE campaign_id = ${decoded.campaignId}
          AND subscriber_id = ${decoded.subscriberId}
        `);
      }

      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Content-Length': TRACKING_PIXEL.length,
      });
      res.send(TRACKING_PIXEL);
    } catch (error) {
      console.error('Error tracking email open:', error);
      res.set('Content-Type', 'image/png');
      res.send(TRACKING_PIXEL);
    }
  });

  app.get('/track/click/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const decoded = decodeClickTrackingToken(token);

      if (!decoded) {
        return res.status(400).send('Invalid or expired tracking link');
      }

      let targetUrl: URL;
      try {
        targetUrl = new URL(decoded.url);
      } catch {
        return res.status(400).send('Invalid URL in token');
      }

      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        return res.status(400).send('Invalid URL protocol');
      }

      const hostname = targetUrl.hostname.toLowerCase();
      
      const blockedHosts = [
        'localhost', 'loopback',
        '127.0.0.1', '0.0.0.0', '::1', '0:0:0:0:0:0:0:1',
        '169.254.169.254',
        'metadata.google.internal', 'instance-data.ec2.internal',
      ];
      
      const isPrivateIPv4 = (ip: string) => ip.match(/^(10|127|172\.(1[6-9]|2[0-9]|3[01])|192\.168)\./);
      const isPrivateIPv6 = (ip: string) => ip.match(/^(fe80|fc00|fd|::1|::ffff:127)/i);
      const isLocalDomain = hostname.match(/\.(local|localhost|internal)$/);
      
      if (blockedHosts.includes(hostname) || isPrivateIPv4(hostname) || isPrivateIPv6(hostname) || isLocalDomain) {
        console.warn(`Blocked redirect to private/internal URL: ${decoded.url}`);
        return res.status(400).send('Blocked URL');
      }

      try {
        const resolvedIPs = await dns.resolve(hostname);
        
        for (const ip of resolvedIPs) {
          if (isPrivateIPv4(ip) || isPrivateIPv6(ip) || blockedHosts.includes(ip)) {
            console.warn(`Blocked redirect - hostname ${hostname} resolves to private IP: ${ip}`);
            return res.status(400).send('Blocked URL - resolves to private network');
          }
        }
      } catch (error) {
        console.error(`DNS resolution failed for ${hostname}, blocking redirect:`, error);
        return res.status(400).send('Blocked URL - DNS resolution failed');
      }

      // Get userId from campaign
      const campaign = await db.query.campaigns.findFirst({
        where: eq(campaigns.id, decoded.campaignId),
        columns: { userId: true }
      });

      if (campaign) {
        await db.insert(linkClicks).values({
          userId: campaign.userId,
          campaignId: decoded.campaignId,
          subscriberId: decoded.subscriberId,
          url: decoded.url,
        });
      }

      await db.execute(sql`
        UPDATE campaign_subscribers
        SET clicked_at = COALESCE(clicked_at, NOW())
        WHERE campaign_id = ${decoded.campaignId}
        AND subscriber_id = ${decoded.subscriberId}
      `);

      return res.redirect(decoded.url);
    } catch (error) {
      console.error('Error tracking link click:', error);
      res.status(500).send('Error processing click');
    }
  });

  app.get('/unsubscribe/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const decoded = decodeUnsubscribeToken(token);

      if (decoded) {
        const [subscriber] = await db
          .select()
          .from(subscribers)
          .where(
            and(
              eq(subscribers.id, decoded.subscriberId),
              eq(subscribers.userId, decoded.userId)
            )
          )
          .limit(1);

        if (subscriber) {
          res.send(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Unsubscribe</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    max-width: 600px;
                    margin: 80px auto;
                    padding: 20px;
                    text-align: center;
                  }
                  .container {
                    background: #f9fafb;
                    border-radius: 12px;
                    padding: 40px;
                  }
                  h1 {
                    color: #1f2937;
                    margin-bottom: 16px;
                  }
                  p {
                    color: #6b7280;
                    line-height: 1.6;
                    margin-bottom: 24px;
                  }
                  .email {
                    color: #4f46e5;
                    font-weight: 600;
                  }
                  button {
                    background: #ef4444;
                    color: white;
                    border: none;
                    padding: 12px 32px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                  }
                  button:hover {
                    background: #dc2626;
                  }
                  .success {
                    display: none;
                    color: #059669;
                    margin-top: 20px;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>Unsubscribe</h1>
                  <p>Are you sure you want to unsubscribe <span class="email">${subscriber.email}</span> from our mailing list?</p>
                  <button onclick="unsubscribe()">Confirm Unsubscribe</button>
                  <div class="success" id="success">
                    <p>✓ You have been successfully unsubscribed.</p>
                  </div>
                </div>
                <script>
                  async function unsubscribe() {
                    try {
                      const response = await fetch('/api/unsubscribe/${token}', {
                        method: 'POST'
                      });
                      if (response.ok) {
                        document.querySelector('button').style.display = 'none';
                        document.querySelector('p').style.display = 'none';
                        document.getElementById('success').style.display = 'block';
                      }
                    } catch (error) {
                      alert('An error occurred. Please try again.');
                    }
                  }
                </script>
              </body>
            </html>
          `);
          return;
        }
      }

      res.status(400).send('Invalid unsubscribe link');
    } catch (error) {
      console.error('Error showing unsubscribe page:', error);
      res.status(500).send('Error processing unsubscribe');
    }
  });

  app.post('/api/unsubscribe/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const decoded = decodeUnsubscribeToken(token);

      if (decoded) {
        await db.execute(sql`
          UPDATE subscribers
          SET status = 'unsubscribed'
          WHERE id = ${decoded.subscriberId}
          AND user_id = ${decoded.userId}
        `);

        res.json({ success: true });
        return;
      }

      res.status(400).json({ error: 'Invalid token' });
    } catch (error) {
      console.error('Error unsubscribing:', error);
      res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  });

  app.post('/webhooks/email/bounce', async (req: Request, res: Response) => {
    try {
      const { email, campaignId, type } = req.body;

      const [subscriber] = await db
        .select()
        .from(subscribers)
        .where(eq(subscribers.email, email))
        .limit(1);

      if (subscriber) {
        if (type === 'hard') {
          await db.execute(sql`
            UPDATE subscribers
            SET status = 'bounced'
            WHERE id = ${subscriber.id}
          `);
        }

        if (campaignId) {
          await db.execute(sql`
            UPDATE campaign_subscribers
            SET bounced_at = NOW(), status = 'bounced'
            WHERE campaign_id = ${campaignId}
            AND subscriber_id = ${subscriber.id}
          `);
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing bounce webhook:', error);
      res.status(500).json({ error: 'Failed to process bounce' });
    }
  });

  app.post('/webhooks/email/complaint', async (req: Request, res: Response) => {
    try {
      const { email, campaignId } = req.body;

      const [subscriber] = await db
        .select()
        .from(subscribers)
        .where(eq(subscribers.email, email))
        .limit(1);

      if (subscriber) {
        await db.execute(sql`
          UPDATE subscribers
          SET status = 'complained'
          WHERE id = ${subscriber.id}
        `);

        if (campaignId) {
          await db.execute(sql`
            UPDATE campaign_subscribers
            SET complained_at = NOW(), status = 'complained'
            WHERE campaign_id = ${campaignId}
            AND subscriber_id = ${subscriber.id}
          `);
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing complaint webhook:', error);
      res.status(500).json({ error: 'Failed to process complaint' });
    }
  });
}
