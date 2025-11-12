import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Subscribers table
export const subscribers = pgTable("subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  status: text("status").notNull().default('active'), // active, unsubscribed, bounced, complained
  lists: text("lists").array().notNull().default(sql`ARRAY[]::text[]`), // Tags/lists the subscriber belongs to
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Custom fields
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscribersRelations = relations(subscribers, ({ many }) => ({
  campaignSubscribers: many(campaignSubscribers),
}));

export const insertSubscriberSchema = createInsertSchema(subscribers).pick({
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  lists: true,
  metadata: true,
});

export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;
export type Subscriber = typeof subscribers.$inferSelect;

// Email Templates table
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const emailTemplatesRelations = relations(emailTemplates, ({ many }) => ({
  campaigns: many(campaigns),
}));

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).pick({
  name: true,
  subject: true,
  htmlContent: true,
  textContent: true,
  thumbnailUrl: true,
});

export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  templateId: varchar("template_id").references(() => emailTemplates.id),
  status: text("status").notNull().default('draft'), // draft, scheduled, sending, sent, paused, failed
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  replyTo: text("reply_to"),
  lists: text("lists").array().notNull().default(sql`ARRAY[]::text[]`), // Which subscriber lists to send to
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  template: one(emailTemplates, {
    fields: [campaigns.templateId],
    references: [emailTemplates.id],
  }),
  campaignSubscribers: many(campaignSubscribers),
  analytics: one(campaignAnalytics),
}));

export const insertCampaignSchema = createInsertSchema(campaigns).pick({
  name: true,
  subject: true,
  templateId: true,
  status: true,
  fromName: true,
  fromEmail: true,
  replyTo: true,
  lists: true,
  scheduledAt: true,
  sentAt: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// Campaign Subscribers (many-to-many join table)
export const campaignSubscribers = pgTable("campaign_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id),
  subscriberId: varchar("subscriber_id").notNull().references(() => subscribers.id),
  status: text("status").notNull().default('pending'), // pending, sent, opened, clicked, bounced, complained, failed
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  bouncedAt: timestamp("bounced_at"),
  complainedAt: timestamp("complained_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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

export type CampaignSubscriber = typeof campaignSubscribers.$inferSelect;

// Link Clicks tracking table
export const linkClicks = pgTable("link_clicks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id),
  subscriberId: varchar("subscriber_id").notNull().references(() => subscribers.id),
  url: text("url").notNull(), // Original URL that was clicked
  clickedAt: timestamp("clicked_at").notNull().defaultNow(),
});

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

export type LinkClick = typeof linkClicks.$inferSelect;

// Campaign Analytics table
export const campaignAnalytics = pgTable("campaign_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().unique().references(() => campaigns.id),
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
});

export const campaignAnalyticsRelations = relations(campaignAnalytics, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignAnalytics.campaignId],
    references: [campaigns.id],
  }),
}));

export type CampaignAnalytics = typeof campaignAnalytics.$inferSelect;

// Settings table
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSettingSchema = createInsertSchema(settings).pick({
  key: true,
  value: true,
});

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;
