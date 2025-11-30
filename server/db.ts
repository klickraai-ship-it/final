import { config } from 'dotenv';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema.js";

// Load environment variables from .env.local
config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Re-export specific schema items for convenient access
export const emailProviderIntegrations = schema.emailProviderIntegrations;
export const insertEmailProviderIntegrationSchema = schema.insertEmailProviderIntegrationSchema;
export type EmailProviderIntegration = typeof schema.emailProviderIntegrations.$inferSelect;
export type InsertEmailProviderIntegration = typeof schema.insertEmailProviderIntegrationSchema;
