import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, unique, index, foreignKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import * as crypto from "crypto";

// =============================================================================
// FOUNDATION TABLES (users, sessions, settings)
// =============================================================================

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  companyName: text("company_name"),
  role: text("role").notNull().default('user'),
  isVerified: boolean("is_verified").notNull().default(false),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  companyName: z.string().optional(),
  role: z.enum(['user', 'admin']).default('user'),
}).strict();

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Sessions table
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("sessions_user_id_idx").on(table.userId),
  tokenIdx: index("sessions_token_idx").on(table.token),
}));

export type Session = typeof sessions.$inferSelect;

// User Settings table
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  timezone: text("timezone").notNull().default('UTC'),
  language: text("language").notNull().default('en_US'),
  theme: text("theme").notNull().default('dark'),
  defaultUrlParams: text("default_url_params"),
  testEmailPrefix: text("test_email_prefix").default('[Test]'),
  rowsPerPage: integer("rows_per_page").notNull().default(200),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("user_settings_user_id_idx").on(table.userId),
}));

// Client-side schema (userId will be added server-side from session)
export const insertUserSettingsSchema = z.object({
  timezone: z.string().default('UTC'),
  language: z.string().default('en_US'),
  theme: z.enum(['light', 'dark']).default('dark'),
  defaultUrlParams: z.string().optional(),
  testEmailPrefix: z.string().default('[Test]'),
  rowsPerPage: z.number().default(200),
}).strict();

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

// Settings table (global settings)
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSettingSchema = z.object({
  key: z.string(),
  value: z.any(),
}).strict();

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

// Email Provider Integrations table (per-user email provider credentials)
// ⚠️ SECURITY WARNING: Credentials are currently stored in PLAINTEXT in JSONB
// TODO PRODUCTION: Implement field-level encryption before deployment
//   - Use AES-256-GCM or similar encryption algorithm
//   - Store encryption key in secure key management service (KMS, HashiCorp Vault, etc.)
//   - Encrypt credentials before insert/update, decrypt on select
//   - Consider using pgcrypto extension or application-level encryption
export const emailProviderIntegrations = pgTable("email_provider_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  provider: text("provider").notNull().default('ses'), // CHANGED: Default to 'ses' (SES-only enforcement)
  isActive: boolean("is_active").notNull().default(true),
  config: jsonb("config").notNull(), // ⚠️ PLAINTEXT! Should be encrypted in production
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("email_provider_integrations_user_id_idx").on(table.userId),
}));

export const insertEmailProviderIntegrationSchema = z.object({
  provider: z.enum(['ses']).default('ses'), // SES-ONLY: Tightened Zod validation
  isActive: z.boolean().default(true),
  config: z.object({
    // AWS SES config (ONLY supported provider for per-user credentials)
    awsAccessKeyId: z.string().optional(),
    awsSecretAccessKey: z.string().optional(),
    awsRegion: z.string().optional(),
    // Legacy fields kept for schema compatibility, but not used
    apiKey: z.string().optional(),
    fromEmail: z.string().email().optional(),
    sendgridApiKey: z.string().optional(),
    mailgunApiKey: z.string().optional(),
    mailgunDomain: z.string().optional(),
  }),
}).strict();

export type InsertEmailProviderIntegration = z.infer<typeof insertEmailProviderIntegrationSchema>;
export type EmailProviderIntegration = typeof emailProviderIntegrations.$inferSelect;

// =============================================================================
// TENANT-SCOPED DOMAIN TABLES (lists, blacklist, rules, subscribers, templates, campaigns)
// =============================================================================

// Lists table
export const lists = pgTable("lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  subscriberCount: integer("subscriber_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("lists_user_id_idx").on(table.userId),
  uniqueUserIdName: unique("lists_user_id_name_unique").on(table.userId, table.name),
}));

// Client-side schema (userId will be added server-side from session)
export const insertListSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
}).strict();

export type InsertList = z.infer<typeof insertListSchema>;
export type List = typeof lists.$inferSelect;

// Blacklist table
export const blacklist = pgTable("blacklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: text("email"),
  domain: text("domain"),
  reason: text("reason").notNull(),
  blacklistedAt: timestamp("blacklisted_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("blacklist_user_id_idx").on(table.userId),
}));

// Client-side schema (userId will be added server-side from session)
export const insertBlacklistSchema = z.object({
  email: z.string().email().optional(),
  domain: z.string().optional(),
  reason: z.enum(['hard_bounce', 'complaint', 'manual', 'spam']),
}).strict().refine((data) => data.email || data.domain, {
  message: "Either email or domain must be provided",
});

export type InsertBlacklist = z.infer<typeof insertBlacklistSchema>;
export type Blacklist = typeof blacklist.$inferSelect;

// Rules table
export const rules = pgTable("rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(),
  triggerConditions: jsonb("trigger_conditions").notNull().default(sql`'{}'::jsonb`),
  actionType: text("action_type").notNull(),
  actionData: jsonb("action_data").notNull().default(sql`'{}'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("rules_user_id_idx").on(table.userId),
}));

// Client-side schema (userId will be added server-side from session)
export const insertRuleSchema = z.object({
  name: z.string().min(1),
  triggerType: z.enum(['subscriber_created', 'email_opened', 'link_clicked', 'subscribed_to_list']),
  triggerConditions: z.record(z.string(), z.any()).default({}),
  actionType: z.enum(['add_to_list', 'remove_from_list', 'send_email', 'update_field']),
  actionData: z.record(z.string(), z.any()).default({}),
  isActive: z.boolean().default(true),
}).strict();

export type InsertRule = z.infer<typeof insertRuleSchema>;
export type Rule = typeof rules.$inferSelect;

// Subscribers table
export const subscribers = pgTable("subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  status: text("status").notNull().default('active'),
  lists: text("lists").array().notNull().default(sql`ARRAY[]::text[]`),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  consentGiven: boolean("consent_given").notNull().default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  gdprDataExportedAt: timestamp("gdpr_data_exported_at"),
  confirmed: boolean("confirmed").notNull().default(false),
  confirmationToken: varchar("confirmation_token").unique(),
  confirmationSentAt: timestamp("confirmation_sent_at"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("subscribers_user_id_idx").on(table.userId),
  uniqueUserIdEmail: unique("subscribers_user_id_email_unique").on(table.userId, table.email),
  uniqueIdUserId: unique("subscribers_id_user_id_unique").on(table.id, table.userId),
}));

// Client-side schema (userId will be added server-side from session)
export const insertSubscriberSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.enum(['active', 'unsubscribed', 'bounced', 'complained']).default('active'),
  lists: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.any()).default({}),
  consentGiven: z.boolean().default(false),
}).strict();

export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;
export type Subscriber = typeof subscribers.$inferSelect;

// Email Templates table
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("email_templates_user_id_idx").on(table.userId),
  uniqueUserIdName: unique("email_templates_user_id_name_unique").on(table.userId, table.name),
  uniqueIdUserId: unique("email_templates_id_user_id_unique").on(table.id, table.userId),
}));

// Client-side schema (userId will be added server-side from session)
export const insertEmailTemplateSchema = z.object({
  name: z.string(),
  subject: z.string(),
  htmlContent: z.string(),
  textContent: z.string().optional(),
  thumbnailUrl: z.string().optional(),
}).strict();

export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  templateId: varchar("template_id"),
  status: text("status").notNull().default('draft'),
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  replyTo: text("reply_to"),
  lists: text("lists").array().notNull().default(sql`ARRAY[]::text[]`),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("campaigns_user_id_idx").on(table.userId),
  templateIdIdx: index("campaigns_template_id_idx").on(table.templateId),
  uniqueIdUserId: unique("campaigns_id_user_id_unique").on(table.id, table.userId),
  // Composite FK to enforce same-tenant template (SET NULL on template delete)
  templateUserFk: foreignKey({
    columns: [table.templateId, table.userId],
    foreignColumns: [emailTemplates.id, emailTemplates.userId],
    name: "campaigns_template_user_fk"
  }).onDelete('set null'),
  // Basic userId FK for user deletion cascade
  userFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "campaigns_user_fk"
  }).onDelete('cascade'),
}));

// Client-side schema (userId will be added server-side from session)
export const insertCampaignSchema = z.object({
  name: z.string(),
  subject: z.string(),
  templateId: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused', 'failed']).default('draft'),
  fromName: z.string(),
  fromEmail: z.string().email(),
  replyTo: z.string().email().optional(),
  lists: z.array(z.string()).default([]),
  scheduledAt: z.string().optional(),
  sentAt: z.string().optional(),
}).strict();

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// =============================================================================
// JOIN & ANALYTICS TABLES
// =============================================================================

// Campaign Subscribers (many-to-many join table) - with composite FK for tenant isolation
export const campaignSubscribers = pgTable("campaign_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  campaignId: varchar("campaign_id").notNull(),
  subscriberId: varchar("subscriber_id").notNull(),
  status: text("status").notNull().default('pending'),
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  bouncedAt: timestamp("bounced_at"),
  complainedAt: timestamp("complained_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("campaign_subscribers_user_id_idx").on(table.userId),
  campaignIdIdx: index("campaign_subscribers_campaign_id_idx").on(table.campaignId),
  subscriberIdIdx: index("campaign_subscribers_subscriber_id_idx").on(table.subscriberId),
  // Composite FK to enforce same-tenant campaign (with CASCADE)
  campaignUserFk: foreignKey({
    columns: [table.campaignId, table.userId],
    foreignColumns: [campaigns.id, campaigns.userId],
    name: "campaign_subscribers_campaign_user_fk"
  }).onDelete('cascade'),
  // Composite FK to enforce same-tenant subscriber (with CASCADE)
  subscriberUserFk: foreignKey({
    columns: [table.subscriberId, table.userId],
    foreignColumns: [subscribers.id, subscribers.userId],
    name: "campaign_subscribers_subscriber_user_fk"
  }).onDelete('cascade'),
  // Basic userId FK for user deletion cascade
  userFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "campaign_subscribers_user_fk"
  }).onDelete('cascade'),
}));

export type CampaignSubscriber = typeof campaignSubscribers.$inferSelect;

// Link Clicks tracking table - with composite FK for tenant isolation
export const linkClicks = pgTable("link_clicks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  campaignId: varchar("campaign_id").notNull(),
  subscriberId: varchar("subscriber_id").notNull(),
  url: text("url").notNull(),
  clickedAt: timestamp("clicked_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("link_clicks_user_id_idx").on(table.userId),
  campaignIdIdx: index("link_clicks_campaign_id_idx").on(table.campaignId),
  subscriberIdIdx: index("link_clicks_subscriber_id_idx").on(table.subscriberId),
  // Composite FK to enforce same-tenant campaign (with CASCADE)
  campaignUserFk: foreignKey({
    columns: [table.campaignId, table.userId],
    foreignColumns: [campaigns.id, campaigns.userId],
    name: "link_clicks_campaign_user_fk"
  }).onDelete('cascade'),
  // Composite FK to enforce same-tenant subscriber (with CASCADE)
  subscriberUserFk: foreignKey({
    columns: [table.subscriberId, table.userId],
    foreignColumns: [subscribers.id, subscribers.userId],
    name: "link_clicks_subscriber_user_fk"
  }).onDelete('cascade'),
  // Basic userId FK for user deletion cascade
  userFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "link_clicks_user_fk"
  }).onDelete('cascade'),
}));

export type LinkClick = typeof linkClicks.$inferSelect;

// Web Version Views tracking table - with composite FK for tenant isolation
export const webVersionViews = pgTable("web_version_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  campaignId: varchar("campaign_id").notNull(),
  subscriberId: varchar("subscriber_id").notNull(),
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (table) => ({
  userIdIdx: index("web_version_views_user_id_idx").on(table.userId),
  campaignIdIdx: index("web_version_views_campaign_id_idx").on(table.campaignId),
  subscriberIdIdx: index("web_version_views_subscriber_id_idx").on(table.subscriberId),
  // Composite FK to enforce same-tenant campaign (with CASCADE)
  campaignUserFk: foreignKey({
    columns: [table.campaignId, table.userId],
    foreignColumns: [campaigns.id, campaigns.userId],
    name: "web_version_views_campaign_user_fk"
  }).onDelete('cascade'),
  // Composite FK to enforce same-tenant subscriber (with CASCADE)
  subscriberUserFk: foreignKey({
    columns: [table.subscriberId, table.userId],
    foreignColumns: [subscribers.id, subscribers.userId],
    name: "web_version_views_subscriber_user_fk"
  }).onDelete('cascade'),
  // Basic userId FK for user deletion cascade
  userFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "web_version_views_user_fk"
  }).onDelete('cascade'),
}));

export type WebVersionView = typeof webVersionViews.$inferSelect;

// Campaign Analytics table - with composite FK for tenant isolation
export const campaignAnalytics = pgTable("campaign_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  campaignId: varchar("campaign_id").notNull().unique(),
  totalSubscribers: integer("total_subscribers").notNull().default(0),
  sent: integer("sent").notNull().default(0),
  delivered: integer("delivered").notNull().default(0),
  opened: integer("opened").notNull().default(0),
  clicked: integer("clicked").notNull().default(0),
  bounced: integer("bounced").notNull().default(0),
  complained: integer("complained").notNull().default(0),
  unsubscribed: integer("unsubscribed").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("campaign_analytics_user_id_idx").on(table.userId),
  campaignIdIdx: index("campaign_analytics_campaign_id_idx").on(table.campaignId),
  // Composite FK to enforce same-tenant campaign (with CASCADE)
  campaignUserFk: foreignKey({
    columns: [table.campaignId, table.userId],
    foreignColumns: [campaigns.id, campaigns.userId],
    name: "campaign_analytics_campaign_user_fk"
  }).onDelete('cascade'),
  // Basic userId FK for user deletion cascade
  userFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "campaign_analytics_user_fk"
  }).onDelete('cascade'),
}));

export type CampaignAnalytics = typeof campaignAnalytics.$inferSelect;

// Notifications table
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['campaign_sent', 'bounce', 'complaint', 'info'] }).notNull(),
  message: text('message').notNull(),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications);
export type Notification = typeof notifications.$inferSelect;


// =============================================================================
// RELATIONS (ALL DEFINED AT THE END)
// =============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(userSettings),
  sessions: many(sessions),
  lists: many(lists),
  blacklist: many(blacklist),
  rules: many(rules),
  subscribers: many(subscribers),
  emailTemplates: many(emailTemplates),
  campaigns: many(campaigns),
  notifications: many(notifications),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const listsRelations = relations(lists, ({ one }) => ({
  user: one(users, {
    fields: [lists.userId],
    references: [users.id],
  }),
}));

export const blacklistRelations = relations(blacklist, ({ one }) => ({
  user: one(users, {
    fields: [blacklist.userId],
    references: [users.id],
  }),
}));

export const rulesRelations = relations(rules, ({ one }) => ({
  user: one(users, {
    fields: [rules.userId],
    references: [users.id],
  }),
}));

export const subscribersRelations = relations(subscribers, ({ one, many }) => ({
  user: one(users, {
    fields: [subscribers.userId],
    references: [users.id],
  }),
  campaignSubscribers: many(campaignSubscribers),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ one, many }) => ({
  user: one(users, {
    fields: [emailTemplates.userId],
    references: [users.id],
  }),
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [campaigns.userId],
    references: [users.id],
  }),
  template: one(emailTemplates, {
    fields: [campaigns.templateId],
    references: [emailTemplates.id],
  }),
  campaignSubscribers: many(campaignSubscribers),
  analytics: one(campaignAnalytics),
}));

export const campaignSubscribersRelations = relations(campaignSubscribers, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignSubscribers.campaignId],
    references: [campaigns.id],
  }),
  subscriber: one(subscribers, {
    fields: [campaignSubscribers.subscriberId],
    references: [subscribers.id],
  }),
}));

export const linkClicksRelations = relations(linkClicks, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [linkClicks.campaignId],
    references: [campaigns.id],
  }),
  subscriber: one(subscribers, {
    fields: [linkClicks.subscriberId],
    references: [subscribers.id],
  }),
}));

export const webVersionViewsRelations = relations(webVersionViews, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [webVersionViews.campaignId],
    references: [campaigns.id],
  }),
  subscriber: one(subscribers, {
    fields: [webVersionViews.subscriberId],
    references: [subscribers.id],
  }),
}));

export const campaignAnalyticsRelations = relations(campaignAnalytics, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignAnalytics.campaignId],
    references: [campaigns.id],
  }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));