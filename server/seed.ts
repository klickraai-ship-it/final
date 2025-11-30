
import { db } from './db.js';
import { eq } from 'drizzle-orm';
import { 
  users, 
  sessions, 
  userSettings, 
  lists, 
  subscribers, 
  emailTemplates, 
  campaigns,
  campaignSubscribers,
  campaignAnalytics,
  blacklist,
  rules,
  notifications,
  settings
} from '../shared/schema.js';
import { hash } from '@node-rs/argon2';
import crypto from 'crypto';

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create admin user
    const adminPasswordHash = await hash('Admin123!', {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    const [adminUser] = await db.insert(users).values({
      email: 'admin@newsletter.com',
      passwordHash: adminPasswordHash,
      name: 'Admin User',
      companyName: 'Newsletter Inc',
      role: 'admin',
      isVerified: true,
    }).returning();

    console.log('✓ Created admin user');

    // Create demo user
    const demoPasswordHash = await hash('Demo123!', {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    const [demoUser] = await db.insert(users).values({
      email: 'demo@newsletter.com',
      passwordHash: demoPasswordHash,
      name: 'Demo User',
      companyName: 'Demo Company',
      role: 'user',
      isVerified: true,
    }).returning();

    console.log('✓ Created demo user');

    // Create user settings
    await db.insert(userSettings).values([
      {
        userId: adminUser.id,
        timezone: 'America/New_York',
        language: 'en_US',
        theme: 'dark',
        rowsPerPage: 200,
      },
      {
        userId: demoUser.id,
        timezone: 'UTC',
        language: 'en_US',
        theme: 'light',
        rowsPerPage: 100,
      },
    ]);

    console.log('✓ Created user settings');

    // Create lists
    const [generalList] = await db.insert(lists).values({
      userId: demoUser.id,
      name: 'General Newsletter',
      description: 'Main newsletter subscribers',
      subscriberCount: 0,
    }).returning();

    const [vipList] = await db.insert(lists).values({
      userId: demoUser.id,
      name: 'VIP Subscribers',
      description: 'Premium subscribers',
      subscriberCount: 0,
    }).returning();

    console.log('✓ Created lists');

    // Create sample subscribers
    const subscribersData = [
      {
        userId: demoUser.id,
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
        lists: [generalList.id],
        consentGiven: true,
        confirmed: true,
        confirmedAt: new Date(),
      },
      {
        userId: demoUser.id,
        email: 'jane.smith@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        status: 'active',
        lists: [generalList.id, vipList.id],
        consentGiven: true,
        confirmed: true,
        confirmedAt: new Date(),
      },
      {
        userId: demoUser.id,
        email: 'bob.johnson@example.com',
        firstName: 'Bob',
        lastName: 'Johnson',
        status: 'active',
        lists: [vipList.id],
        consentGiven: true,
        confirmed: true,
        confirmedAt: new Date(),
      },
    ];

    const createdSubscribers = await db.insert(subscribers).values(subscribersData).returning();
    console.log('✓ Created sample subscribers');

    // Update list subscriber counts
    await db.update(lists).set({ subscriberCount: 2 }).where(eq(lists.id, generalList.id));
    await db.update(lists).set({ subscriberCount: 2 }).where(eq(lists.id, vipList.id));

    // Create email templates
    const [welcomeTemplate] = await db.insert(emailTemplates).values({
      userId: demoUser.id,
      name: 'Welcome Email',
      subject: 'Welcome to our Newsletter!',
      htmlContent: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Welcome!</h1>
            <p>Thank you for subscribing to our newsletter.</p>
            <p>We're excited to have you on board.</p>
            <a href="{{unsubscribe_url}}" style="color: #666; font-size: 12px;">Unsubscribe</a>
          </body>
        </html>
      `,
      textContent: 'Welcome! Thank you for subscribing to our newsletter.',
    }).returning();

    const [monthlyTemplate] = await db.insert(emailTemplates).values({
      userId: demoUser.id,
      name: 'Monthly Newsletter',
      subject: 'Your Monthly Update',
      htmlContent: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Monthly Newsletter</h1>
            <h2>What's New This Month</h2>
            <p>Here are the latest updates and news.</p>
            <ul>
              <li>Feature Update 1</li>
              <li>Feature Update 2</li>
              <li>Feature Update 3</li>
            </ul>
            <a href="{{unsubscribe_url}}" style="color: #666; font-size: 12px;">Unsubscribe</a>
          </body>
        </html>
      `,
      textContent: 'Monthly Newsletter - Latest updates and news',
    }).returning();

    console.log('✓ Created email templates');

    // Create sample campaign
    const [campaign] = await db.insert(campaigns).values({
      userId: demoUser.id,
      name: 'Welcome Campaign',
      subject: 'Welcome to our Newsletter!',
      templateId: welcomeTemplate.id,
      status: 'sent',
      fromName: 'Newsletter Team',
      fromEmail: 'newsletter@example.com',
      replyTo: 'support@example.com',
      lists: [generalList.id],
      sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    }).returning();

    console.log('✓ Created sample campaign');

    // Create campaign analytics
    await db.insert(campaignAnalytics).values({
      userId: demoUser.id,
      campaignId: campaign.id,
      totalSubscribers: 2,
      sent: 2,
      delivered: 2,
      opened: 1,
      clicked: 1,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
      failed: 0,
    });

    console.log('✓ Created campaign analytics');

    // Create campaign subscribers
    await db.insert(campaignSubscribers).values([
      {
        userId: demoUser.id,
        campaignId: campaign.id,
        subscriberId: createdSubscribers[0].id,
        status: 'delivered',
        sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        openedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        clickedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      },
      {
        userId: demoUser.id,
        campaignId: campaign.id,
        subscriberId: createdSubscribers[1].id,
        status: 'delivered',
        sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    ]);

    console.log('✓ Created campaign subscribers');

    // Create automation rules
    await db.insert(rules).values({
      userId: demoUser.id,
      name: 'Auto-welcome new subscribers',
      triggerType: 'subscriber_created',
      triggerConditions: {},
      actionType: 'send_email',
      actionData: {
        templateId: welcomeTemplate.id,
      },
      isActive: true,
    });

    console.log('✓ Created automation rules');

    // Create sample blacklist entries
    await db.insert(blacklist).values([
      {
        userId: demoUser.id,
        email: 'bounce@example.com',
        reason: 'hard_bounce',
      },
      {
        userId: demoUser.id,
        domain: 'spam-domain.com',
        reason: 'spam',
      },
    ]);

    console.log('✓ Created blacklist entries');

    // Create sample notifications
    await db.insert(notifications).values([
      {
        userId: demoUser.id,
        type: 'campaign_sent',
        message: 'Campaign "Welcome Campaign" was sent successfully to 2 subscribers',
        read: false,
      },
      {
        userId: demoUser.id,
        type: 'info',
        message: 'Your monthly email quota is at 75%',
        read: false,
      },
    ]);

    console.log('✓ Created notifications');

    // Create global settings
    await db.insert(settings).values([
      {
        key: 'smtp_configured',
        value: false,
      },
      {
        key: 'max_sends_per_day',
        value: 10000,
      },
    ]);

    console.log('✓ Created global settings');

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📧 Demo Credentials:');
    console.log('   Email: demo@newsletter.com');
    console.log('   Password: Demo123!');
    console.log('\n👤 Admin Credentials:');
    console.log('   Email: admin@newsletter.com');
    console.log('   Password: Admin123!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
