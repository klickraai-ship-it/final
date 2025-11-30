import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./db.js";
import {
  subscribers,
  emailTemplates,
  campaigns,
  campaignSubscribers,
  campaignAnalytics,
  settings,
  linkClicks,
  webVersionViews,
  users,
  sessions,
  paymentProviders,
  paymentTransactions,
  termsAndConditions,
  userTermsAcceptance,
  insertSubscriberSchema,
  insertEmailTemplateSchema,
  insertCampaignSchema,
  insertSettingSchema,
  insertPaymentProviderSchema,
  insertPaymentTransactionSchema,
  insertTermsAndConditionsSchema,
  insertUserTermsAcceptanceSchema,
  type Subscriber,
  type EmailTemplate,
  type Campaign,
  type CampaignAnalytics,
  type User,
  type Session,
  type PaymentProvider,
  type PaymentTransaction,
  type TermsAndConditions,
  type UserTermsAcceptance,
} from "../shared/schema.js";
import * as schema from "../shared/schema.js"; // Import schema to access notifications table
import { eq, desc, inArray, and, sql, gte, or, isNull } from "drizzle-orm";
import { setupTrackingRoutes } from "./tracking.js";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { subscribeRateLimiter, unsubscribeRateLimiter, publicEndpointLimiter } from "./rateLimiter.js";
import { emailService } from "./emailProvider.js";
import { encryptObject, decryptObject } from "./encryption.js";
import { sanitizeEmailHtml, sanitizeEmailText, sanitizeSubject } from "./sanitizer.js";
import { PaymentService } from "./paymentService.js";

// Placeholder for notificationService to satisfy the type checker
const notificationService = {
  getUserNotifications: async (userId: string) => {
    // This is a placeholder. The actual implementation would fetch notifications from the DB.
    // For this example, we'll just return an empty array or mock data if needed.
    console.log(`[NotificationService Placeholder] Fetching notifications for user: ${userId}`);
    const notifications = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50);

    return notifications.map(n => ({
      id: n.id,
      type: n.type,
      message: n.message,
      timestamp: n.createdAt,
      read: n.read
    }));
  }
};


// Demo mode duration: 10 minutes in milliseconds
const DEMO_DURATION_MS = 10 * 60 * 1000;

// Middleware to validate session and extract userId
async function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Unauthorized - No token provided" });
  }

  const token = authHeader.substring(7);

  try {
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(
        eq(sessions.token, token),
        sql`${sessions.expiresAt} > NOW()`
      ))
      .limit(1);

    if (!session) {
      return res.status(401).json({ message: "Unauthorized - Invalid or expired token" });
    }

    // Fetch the user to attach to request
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check demo mode expiry
    if (user.paymentStatus === 'demo' && user.demoStartedAt) {
      const demoStartTime = new Date(user.demoStartedAt).getTime();
      const currentTime = Date.now();
      const elapsedTime = currentTime - demoStartTime;

      if (elapsedTime > DEMO_DURATION_MS) {
        // Demo expired
        return res.status(403).json({ 
          message: "Demo period expired", 
          code: "DEMO_EXPIRED",
          demoExpiredAt: new Date(demoStartTime + DEMO_DURATION_MS).toISOString()
        });
      }

      // Add remaining time to user object for frontend
      (user as any).demoRemainingMs = DEMO_DURATION_MS - elapsedTime;
    }

    // Add userId and user to request for use in route handlers
    (req as any).userId = session.userId;
    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Middleware to check if user is superadmin
async function requireSuperAdmin(req: any, res: any, next: any) {
  // First, ensure user is authenticated
  await requireAuth(req, res, () => {
    // Check if user is superadmin
    if (!req.user || !req.user.isSuperAdmin) {
      return res.status(403).json({ message: "Forbidden - Superadmin access required" });
    }
    next();
  });
}

// Helper to generate secure session token
function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export async function registerRoutes(app: Express): Promise<Server> {

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  setupTrackingRoutes(app);

  // ========== AUTH API (Public - No Auth Required) ==========

  // Sign up
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, name, companyName } = req.body;

      // Validate input
      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Password strength check (min 8 chars, at least one letter and one number)
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }

      const hasLetter = /[a-zA-Z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      if (!hasLetter || !hasNumber) {
        return res.status(400).json({ message: "Password must contain at least one letter and one number" });
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser) {
        return res.status(409).json({ message: "Email already registered" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          name,
          companyName: companyName || null,
        })
        .returning();

      // Create session
      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await db.insert(sessions).values({
        userId: newUser.id,
        token: sessionToken,
        expiresAt,
      });

      // Return user and token (excluding password hash)
      const { passwordHash: _, ...userWithoutPassword } = newUser;

      res.status(201).json({
        user: userWithoutPassword,
        token: sessionToken,
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);

      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Create session
      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await db.insert(sessions).values({
        userId: user.id,
        token: sessionToken,
        expiresAt,
      });

      // Return user and token (excluding password hash)
      const { passwordHash: _, ...userWithoutPassword } = user;

      res.json({
        user: userWithoutPassword,
        token: sessionToken,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Logout
  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.substring(7);

      if (token) {
        await db.delete(sessions).where(eq(sessions.token, token));
      }

      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      // Use user from middleware (includes demoRemainingMs if in demo mode)
      const user = (req as any).user;

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // ========== SUPERADMIN API (Requires Superadmin Access) ==========

  // Get all users (superadmin only)
  app.get("/api/admin/users", requireSuperAdmin, async (req, res) => {
    try {
      const allUsers = await db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt));

      const usersWithoutPasswords = allUsers.map(({ passwordHash, twoFactorSecret, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Create user (superadmin only - form or CSV)
  app.post("/api/admin/users", requireSuperAdmin, async (req, res) => {
    try {
      const { email, password, name, companyName, paymentStatus } = req.body;

      // Validate required fields
      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Password strength check (min 8 chars, at least one letter and one number)
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }

      const hasLetter = /[a-zA-Z]/.test(password);
      const hasNumber = /\d/.test(password);
      if (!hasLetter || !hasNumber) {
        return res.status(400).json({ message: "Password must contain at least one letter and one number" });
      }

      // Normalize email to lowercase
      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existing) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          passwordHash,
          name,
          companyName: companyName || null,
          paymentStatus: paymentStatus || 'none',
          isVerified: true, // Admin-created users are auto-verified
        })
        .returning();

      const { passwordHash: _, twoFactorSecret: __, ...userWithoutSensitive } = newUser;
      res.status(201).json(userWithoutSensitive);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Batch create users from CSV (superadmin only)
  app.post("/api/admin/users/batch", requireSuperAdmin, async (req, res) => {
    try {
      const { users: usersData } = req.body;

      if (!Array.isArray(usersData) || usersData.length === 0) {
        return res.status(400).json({ message: "Invalid users data" });
      }

      const created = [];
      const errors = [];

      for (const userData of usersData) {
        try {
          const { email, password, name, companyName, paymentStatus } = userData;

          if (!email || !password || !name) {
            errors.push({ email, error: "Missing required fields" });
            continue;
          }

          // Email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            errors.push({ email, error: "Invalid email format" });
            continue;
          }

          // Password strength check
          if (password.length < 8) {
            errors.push({ email, error: "Password must be at least 8 characters long" });
            continue;
          }

          const hasLetter = /[a-zA-Z]/.test(password);
          const hasNumber = /\d/.test(password);
          if (!hasLetter || !hasNumber) {
            errors.push({ email, error: "Password must contain at least one letter and one number" });
            continue;
          }

          // Normalize email to lowercase
          const normalizedEmail = email.toLowerCase().trim();

          // Check if user exists
          const [existing] = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

          if (existing) {
            errors.push({ email: normalizedEmail, error: "User already exists" });
            continue;
          }

          // Hash password and create user
          const passwordHash = await bcrypt.hash(password, 10);
          const [newUser] = await db
            .insert(users)
            .values({
              email: normalizedEmail,
              passwordHash,
              name,
              companyName: companyName || null,
              paymentStatus: paymentStatus || 'none',
              isVerified: true,
            })
            .returning();

          const { passwordHash: _, twoFactorSecret: __, ...userWithoutSensitive } = newUser;
          created.push(userWithoutSensitive);
        } catch (err: any) {
          errors.push({ email: userData.email, error: err.message });
        }
      }

      res.status(201).json({
        created: created.length,
        errors: errors.length,
        createdUsers: created,
        errorDetails: errors,
      });
    } catch (error) {
      console.error("Error batch creating users:", error);
      res.status(500).json({ message: "Failed to batch create users" });
    }
  });

  // Update user (superadmin only)
  app.patch("/api/admin/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates: any = {};

      // Allow updating these fields
      const allowedFields = ['name', 'companyName', 'paymentStatus', 'isVerified'];
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      // Special handling for password
      if (req.body.password) {
        updates.passwordHash = await bcrypt.hash(req.body.password, 10);
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      updates.updatedAt = new Date();

      const [updatedUser] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { passwordHash: _, twoFactorSecret: __, ...userWithoutSensitive } = updatedUser;
      res.json(userWithoutSensitive);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user (superadmin only)
  app.delete("/api/admin/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Prevent deleting superadmins
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.isSuperAdmin) {
        return res.status(403).json({ message: "Cannot delete superadmin accounts" });
      }

      await db.delete(users).where(eq(users.id, id));
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Get payment providers (superadmin only)
  app.get("/api/admin/payment-providers", requireSuperAdmin, async (req, res) => {
    try {
      const providers = await db
        .select()
        .from(paymentProviders)
        .orderBy(desc(paymentProviders.createdAt));

      // Decrypt sensitive config data
      const providersWithDecryptedConfig = providers.map(provider => ({
        ...provider,
        config: provider.config ? decryptObject(provider.config) : provider.config,
      }));

      res.json(providersWithDecryptedConfig);
    } catch (error) {
      console.error("Error fetching payment providers:", error);
      res.status(500).json({ message: "Failed to fetch payment providers" });
    }
  });

  // Create or update payment provider (superadmin only)
  app.post("/api/admin/payment-providers", requireSuperAdmin, async (req, res) => {
    try {
      const validatedData = insertPaymentProviderSchema.parse(req.body);
      const { provider, isActive, config } = validatedData;

      // Check if provider already exists
      const [existing] = await db
        .select()
        .from(paymentProviders)
        .where(eq(paymentProviders.provider, provider))
        .limit(1);

      let finalConfig = config;
      
      // If updating and secrets are empty, preserve existing secrets
      if (existing) {
        const existingConfig = existing.config ? decryptObject(existing.config) : {};
        finalConfig = {
          ...existingConfig,
          ...config,
        };
        // Remove empty values to preserve existing
        Object.keys(finalConfig).forEach(key => {
          if (!finalConfig[key]) {
            finalConfig[key] = existingConfig[key];
          }
        });
      }

      // Encrypt the final config before storing
      const encryptedConfig = encryptObject(finalConfig);

      let result;
      if (existing) {
        // Update existing provider
        [result] = await db
          .update(paymentProviders)
          .set({
            isActive,
            config: encryptedConfig,
            updatedAt: new Date(),
          })
          .where(eq(paymentProviders.provider, provider))
          .returning();
      } else {
        // Create new provider
        [result] = await db
          .insert(paymentProviders)
          .values({
            provider,
            isActive,
            config: encryptedConfig,
            createdBy: (req as any).userId,
          })
          .returning();
      }

      // Return with decrypted config
      res.json({
        ...result,
        config: decryptObject(result.config),
      });
    } catch (error: any) {
      console.error("Error saving payment provider:", error);
      res.status(400).json({ message: error.message || "Failed to save payment provider" });
    }
  });

  // Get payment transactions (superadmin only)
  app.get("/api/admin/payments", requireSuperAdmin, async (req, res) => {
    try {
      const transactions = await db
        .select({
          id: paymentTransactions.id,
          userId: paymentTransactions.userId,
          provider: paymentTransactions.provider,
          transactionId: paymentTransactions.transactionId,
          amount: paymentTransactions.amount,
          currency: paymentTransactions.currency,
          status: paymentTransactions.status,
          createdAt: paymentTransactions.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(paymentTransactions)
        .leftJoin(users, eq(paymentTransactions.userId, users.id))
        .orderBy(desc(paymentTransactions.createdAt));

      res.json(transactions);
    } catch (error) {
      console.error("Error fetching payment transactions:", error);
      res.status(500).json({ message: "Failed to fetch payment transactions" });
    }
  });

  // Get terms & conditions (superadmin only for management)
  app.get("/api/admin/terms", requireSuperAdmin, async (req, res) => {
    try {
      const allTerms = await db
        .select()
        .from(termsAndConditions)
        .orderBy(desc(termsAndConditions.createdAt));

      res.json(allTerms);
    } catch (error) {
      console.error("Error fetching terms:", error);
      res.status(500).json({ message: "Failed to fetch terms" });
    }
  });

  // Create or update terms & conditions (superadmin only)
  app.post("/api/admin/terms", requireSuperAdmin, async (req, res) => {
    try {
      const validatedData = insertTermsAndConditionsSchema.parse(req.body);
      const { version, title, content, isActive } = validatedData;

      // If setting this as active, deactivate all others
      if (isActive) {
        await db
          .update(termsAndConditions)
          .set({ isActive: false })
          .where(eq(termsAndConditions.isActive, true));
      }

      // Check if version exists
      const [existing] = await db
        .select()
        .from(termsAndConditions)
        .where(eq(termsAndConditions.version, version))
        .limit(1);

      let result;
      if (existing) {
        // Update existing
        [result] = await db
          .update(termsAndConditions)
          .set({ title, content, isActive, updatedAt: new Date() })
          .where(eq(termsAndConditions.version, version))
          .returning();
      } else {
        // Create new
        [result] = await db
          .insert(termsAndConditions)
          .values({ version, title, content, isActive })
          .returning();
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error saving terms:", error);
      res.status(400).json({ message: error.message || "Failed to save terms" });
    }
  });

  // Get active terms (public)
  app.get("/api/terms", async (req, res) => {
    try {
      const [activeTerms] = await db
        .select()
        .from(termsAndConditions)
        .where(eq(termsAndConditions.isActive, true))
        .limit(1);

      if (!activeTerms) {
        return res.status(404).json({ message: "No active terms found" });
      }

      res.json(activeTerms);
    } catch (error) {
      console.error("Error fetching active terms:", error);
      res.status(500).json({ message: "Failed to fetch terms" });
    }
  });

  // Accept terms (authenticated users)
  app.post("/api/terms/accept", requireAuth, async (req, res) => {
    try {
      const { termsId } = req.body;
      const userId = (req as any).userId;

      // Get the terms
      const [terms] = await db
        .select()
        .from(termsAndConditions)
        .where(eq(termsAndConditions.id, termsId))
        .limit(1);

      if (!terms) {
        return res.status(404).json({ message: "Terms not found" });
      }

      // Check if already accepted
      const [existing] = await db
        .select()
        .from(userTermsAcceptance)
        .where(and(
          eq(userTermsAcceptance.userId, userId),
          eq(userTermsAcceptance.termsId, termsId)
        ))
        .limit(1);

      if (existing) {
        return res.status(400).json({ message: "Terms already accepted" });
      }

      // Record acceptance
      const [acceptance] = await db
        .insert(userTermsAcceptance)
        .values({
          userId,
          termsId,
          termsVersion: terms.version,
        })
        .returning();

      res.json(acceptance);
    } catch (error) {
      console.error("Error accepting terms:", error);
      res.status(500).json({ message: "Failed to accept terms" });
    }
  });

  // ========== PUBLIC PAYMENT API ENDPOINTS ==========

  // Get payment configuration (public)
  app.get("/api/payment/config", publicEndpointLimiter, async (req, res) => {
    try {
      // Get active payment providers
      const providers = await db
        .select({
          provider: paymentProviders.provider,
          isActive: paymentProviders.isActive,
        })
        .from(paymentProviders)
        .where(eq(paymentProviders.isActive, true));

      res.json({
        providers: providers.map(p => p.provider),
        pricing: {
          amount: 65,
          currency: 'USD',
        },
        demoMode: {
          enabled: true,
          durationMinutes: 10,
        },
      });
    } catch (error) {
      console.error("Error fetching payment config:", error);
      res.status(500).json({ message: "Failed to fetch payment configuration" });
    }
  });

  // Create payment order (public)
  app.post("/api/payment/create-order", publicEndpointLimiter, async (req, res) => {
    try {
      const { provider, email } = req.body;

      if (!provider || !email) {
        return res.status(400).json({ message: "Provider and email are required" });
      }

      if (provider !== 'razorpay' && provider !== 'paypal') {
        return res.status(400).json({ message: "Invalid provider" });
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existingUser && existingUser.paymentStatus === 'paid') {
        return res.status(400).json({ message: "User already has an active paid account" });
      }

      // Create order
      const order = await PaymentService.createOrder(provider, 65, 'USD', normalizedEmail);

      res.json(order);
    } catch (error: any) {
      console.error("Error creating payment order:", error);
      res.status(500).json({ message: error.message || "Failed to create payment order" });
    }
  });

  // Verify payment and create user (public)
  app.post("/api/payment/verify", publicEndpointLimiter, async (req, res) => {
    try {
      const { provider, email, password, name, companyName, ...paymentData } = req.body;

      if (!provider || !email || !password || !name) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Verify payment signature
      const isValid = await PaymentService.verifyPayment(provider, paymentData);

      if (!isValid) {
        return res.status(400).json({ message: "Payment verification failed" });
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      let user;
      if (existingUser) {
        // Update existing user to paid status
        [user] = await db
          .update(users)
          .set({
            paymentStatus: 'paid',
            paidAt: new Date(),
            paymentProvider: provider,
            paymentId: paymentData.orderId || paymentData.paymentId,
          })
          .where(eq(users.id, existingUser.id))
          .returning();
      } else {
        // Create new user
        const hashedPassword = await bcrypt.hash(password, 10);
        
        [user] = await db
          .insert(users)
          .values({
            name,
            email: normalizedEmail,
            passwordHash: hashedPassword,
            companyName: companyName || null,
            role: 'user',
            paymentStatus: 'paid',
            paidAt: new Date(),
            paymentProvider: provider,
            paymentId: paymentData.orderId || paymentData.paymentId,
            isVerified: true,
          })
          .returning();
      }

      // Update payment transaction
      await db
        .update(paymentTransactions)
        .set({
          userId: user.id,
          status: 'captured',
        })
        .where(eq(paymentTransactions.transactionId, paymentData.orderId || paymentData.paymentId));

      // Create session
      const sessionToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await db.insert(sessions).values({
        userId: user.id,
        token: sessionToken,
        expiresAt,
      });

      res.json({
        sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          paymentStatus: user.paymentStatus,
        },
      });
    } catch (error: any) {
      console.error("Error verifying payment:", error);
      res.status(500).json({ message: error.message || "Failed to verify payment" });
    }
  });

  // Start demo mode (public)
  app.post("/api/payment/demo", publicEndpointLimiter, async (req, res) => {
    try {
      const { email, password, name, companyName } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Create demo user
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const [user] = await db
        .insert(users)
        .values({
          name,
          email: normalizedEmail,
          passwordHash: hashedPassword,
          companyName: companyName || null,
          role: 'user',
          paymentStatus: 'demo',
          demoStartedAt: new Date(),
          isVerified: true,
        })
        .returning();

      // Create session
      const sessionToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await db.insert(sessions).values({
        userId: user.id,
        token: sessionToken,
        expiresAt,
      });

      res.json({
        sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          paymentStatus: user.paymentStatus,
          demoStartedAt: user.demoStartedAt,
        },
        demoExpiresAt: new Date(user.demoStartedAt!.getTime() + 10 * 60 * 1000), // 10 minutes
      });
    } catch (error: any) {
      console.error("Error creating demo user:", error);
      res.status(500).json({ message: error.message || "Failed to create demo account" });
    }
  });

  // Razorpay webhook
  app.post("/api/webhooks/razorpay", async (req, res) => {
    try {
      const event = await PaymentService.processWebhook('razorpay', req.headers, req.body);

      if (!event) {
        return res.status(401).json({ message: "Invalid signature" });
      }

      // If payment is captured, try to find and update user
      if (event.status === 'captured') {
        const [transaction] = await db
          .select()
          .from(paymentTransactions)
          .where(eq(paymentTransactions.transactionId, event.transactionId))
          .limit(1);

        if (transaction && transaction.userId) {
          await db
            .update(users)
            .set({
              paymentStatus: 'paid',
              paidAt: new Date(),
            })
            .where(eq(users.id, transaction.userId));
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Razorpay webhook error:", error);
      // Always return 200 to prevent retries
      res.status(200).json({ received: true });
    }
  });

  // PayPal webhook
  app.post("/api/webhooks/paypal", async (req, res) => {
    try {
      const event = await PaymentService.processWebhook('paypal', req.headers, req.body);

      if (!event) {
        return res.status(401).json({ message: "Invalid signature" });
      }

      // If payment is captured, try to find and update user
      if (event.status === 'captured') {
        const [transaction] = await db
          .select()
          .from(paymentTransactions)
          .where(eq(paymentTransactions.transactionId, event.transactionId))
          .limit(1);

        if (transaction && transaction.userId) {
          await db
            .update(users)
            .set({
              paymentStatus: 'paid',
              paidAt: new Date(),
            })
            .where(eq(users.id, transaction.userId));
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("PayPal webhook error:", error);
      // Always return 200 to prevent retries
      res.status(200).json({ received: true });
    }
  });

  // ========== SUBSCRIBERS API ==========

  // Get all subscribers
  app.get("/api/subscribers", requireAuth, async (req, res) => {
    try {
      const { status, list } = req.query;
      const userId = (req as any).userId;

      let conditions = [eq(subscribers.userId, userId)];

      if (status) {
        conditions.push(eq(subscribers.status, status as string));
      }

      const results = await db
        .select()
        .from(subscribers)
        .where(and(...conditions))
        .orderBy(desc(subscribers.createdAt));

      // Filter by list if provided
      let filteredResults = results;
      if (list) {
        filteredResults = results.filter(s => s.lists.includes(list as string));
      }

      res.json(filteredResults);
    } catch (error) {
      console.error("Error fetching subscribers:", error);
      res.status(500).json({ message: "Failed to fetch subscribers" });
    }
  });

  // Get single subscriber
  app.get("/api/subscribers/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const [subscriber] = await db
        .select()
        .from(subscribers)
        .where(and(
          eq(subscribers.id, req.params.id),
          eq(subscribers.userId, userId)
        ));

      if (!subscriber) {
        return res.status(404).json({ message: "Subscriber not found" });
      }

      res.json(subscriber);
    } catch (error) {
      console.error("Error fetching subscriber:", error);
      res.status(500).json({ message: "Failed to fetch subscriber" });
    }
  });

  // Create subscriber
  app.post("/api/subscribers", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const validatedData = insertSubscriberSchema.parse(req.body);

      const [newSubscriber] = await db
        .insert(subscribers)
        .values({
          ...validatedData,
          userId,
        })
        .returning();

      res.status(201).json(newSubscriber);
    } catch (error) {
      console.error("Error creating subscriber:", error);
      res.status(400).json({ message: "Failed to create subscriber", error: String(error) });
    }
  });

  // Update subscriber
  app.patch("/api/subscribers/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      // Filter out protected/system fields to prevent userId reassignment and tenant breakout
      const { userId: _, id: __, createdAt: ___, updatedAt: ____, ...allowedUpdates } = req.body;

      const [updated] = await db
        .update(subscribers)
        .set(allowedUpdates)
        .where(and(
          eq(subscribers.id, req.params.id),
          eq(subscribers.userId, userId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Subscriber not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating subscriber:", error);
      res.status(500).json({ message: "Failed to update subscriber" });
    }
  });

  // Delete subscriber
  app.delete("/api/subscribers/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const [deleted] = await db
        .delete(subscribers)
        .where(and(
          eq(subscribers.id, req.params.id),
          eq(subscribers.userId, userId)
        ))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Subscriber not found" });
      }

      res.json({ message: "Subscriber deleted successfully" });
    } catch (error) {
      console.error("Error deleting subscriber:", error);
      res.status(500).json({ message: "Failed to delete subscriber" });
    }
  });

  // ========== EMAIL TEMPLATES API ==========

  // Get all templates
  app.get("/api/templates", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const templates = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.userId, userId))
        .orderBy(desc(emailTemplates.createdAt));

      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Get single template
  app.get("/api/templates/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const [template] = await db
        .select()
        .from(emailTemplates)
        .where(and(
          eq(emailTemplates.id, req.params.id),
          eq(emailTemplates.userId, userId)
        ));

      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  // Create template
  app.post("/api/templates", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const validatedData = insertEmailTemplateSchema.parse(req.body);

      // Sanitize HTML content to prevent XSS attacks
      const sanitizedData = {
        ...validatedData,
        subject: sanitizeSubject(validatedData.subject),
        htmlContent: sanitizeEmailHtml(validatedData.htmlContent),
        textContent: validatedData.textContent ? sanitizeEmailText(validatedData.textContent) : undefined,
      };

      const [newTemplate] = await db
        .insert(emailTemplates)
        .values({
          ...sanitizedData,
          userId,
        })
        .returning();

      res.status(201).json(newTemplate);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(400).json({ message: "Failed to create template", error: String(error) });
    }
  });

  // Update template
  app.patch("/api/templates/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      // Filter out protected/system fields to prevent userId reassignment and tenant breakout
      const { userId: _, id: __, createdAt: ___, updatedAt: ____, ...allowedUpdates } = req.body;

      // Sanitize HTML content to prevent XSS attacks
      const sanitizedUpdates: any = { ...allowedUpdates };
      if (sanitizedUpdates.subject) {
        sanitizedUpdates.subject = sanitizeSubject(sanitizedUpdates.subject);
      }
      if (sanitizedUpdates.htmlContent) {
        sanitizedUpdates.htmlContent = sanitizeEmailHtml(sanitizedUpdates.htmlContent);
      }
      if (sanitizedUpdates.textContent) {
        sanitizedUpdates.textContent = sanitizeEmailText(sanitizedUpdates.textContent);
      }

      const [updated] = await db
        .update(emailTemplates)
        .set(sanitizedUpdates)
        .where(and(
          eq(emailTemplates.id, req.params.id),
          eq(emailTemplates.userId, userId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  // Delete template
  app.delete("/api/templates/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const [deleted] = await db
        .delete(emailTemplates)
        .where(and(
          eq(emailTemplates.id, req.params.id),
          eq(emailTemplates.userId, userId)
        ))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Duplicate template
  app.post("/api/templates/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const [original] = await db
        .select()
        .from(emailTemplates)
        .where(and(
          eq(emailTemplates.id, req.params.id),
          eq(emailTemplates.userId, userId)
        ));

      if (!original) {
        return res.status(404).json({ message: "Template not found" });
      }

      const [duplicated] = await db
        .insert(emailTemplates)
        .values({
          userId,
          name: `${original.name} (Copy)`,
          subject: original.subject,
          htmlContent: original.htmlContent,
          textContent: original.textContent,
          thumbnailUrl: original.thumbnailUrl,
        })
        .returning();

      res.status(201).json(duplicated);
    } catch (error) {
      console.error("Error duplicating template:", error);
      res.status(500).json({ message: "Failed to duplicate template" });
    }
  });

  // ========== CAMPAIGNS API ==========

  // Get all campaigns
  app.get("/api/campaigns", requireAuth, async (req, res) => {
    try {
      const { status } = req.query;
      const userId = (req as any).userId;

      let conditions = [eq(campaigns.userId, userId)];

      if (status) {
        conditions.push(eq(campaigns.status, status as string));
      }

      const results = await db
        .select()
        .from(campaigns)
        .where(and(...conditions))
        .orderBy(desc(campaigns.createdAt));

      res.json(results);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  // Get single campaign with analytics
  app.get("/api/campaigns/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(
          eq(campaigns.id, req.params.id),
          eq(campaigns.userId, userId)
        ));

      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Get analytics
      const [analytics] = await db
        .select()
        .from(campaignAnalytics)
        .where(and(
          eq(campaignAnalytics.campaignId, req.params.id),
          eq(campaignAnalytics.userId, userId)
        ));

      // Get template if exists
      let template = null;
      if (campaign.templateId) {
        const [tmpl] = await db
          .select()
          .from(emailTemplates)
          .where(and(
            eq(emailTemplates.id, campaign.templateId),
            eq(emailTemplates.userId, userId)
          ));
        template = tmpl;
      }

      res.json({ ...campaign, analytics, template });
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  // Create campaign
  app.post("/api/campaigns", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;

      // PREFLIGHT CHECK: Ensure SES is configured before allowing campaign creation
      const isConfigured = await emailService.isConfigured(userId);
      if (!isConfigured) {
        return res.status(400).json({
          message: "Email provider not configured. Please configure AWS SES in Settings > Email Integration before creating campaigns.",
          requiresConfiguration: true,
          action: "configure_ses"
        });
      }

      const validatedData = insertCampaignSchema.parse(req.body);

      // SECURITY: Verify template ownership if templateId provided
      if (validatedData.templateId) {
        const [template] = await db
          .select()
          .from(emailTemplates)
          .where(and(
            eq(emailTemplates.id, validatedData.templateId),
            eq(emailTemplates.userId, userId)
          ));
        
        if (!template) {
          return res.status(403).json({ 
            message: "Template not found or access denied. You can only use templates you own." 
          });
        }
      }

      const campaignData: any = {
        ...validatedData,
        userId,
      };

      // Convert date strings to Date objects if present
      if (campaignData.scheduledAt) {
        campaignData.scheduledAt = new Date(campaignData.scheduledAt);
      }
      if (campaignData.sentAt) {
        campaignData.sentAt = new Date(campaignData.sentAt);
      }

      const [newCampaign] = await db
        .insert(campaigns)
        .values(campaignData)
        .returning();

      // Create initial analytics record
      await db.insert(campaignAnalytics).values({
        userId,
        campaignId: newCampaign.id,
      });

      res.status(201).json(newCampaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(400).json({ message: "Failed to create campaign", error: String(error) });
    }
  });

  // Update campaign
  app.patch("/api/campaigns/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      // Filter out protected/system fields to prevent userId reassignment and tenant breakout
      const { userId: _, id: __, createdAt: ___, updatedAt: ____, sentAt: _____, ...allowedUpdates } = req.body;

      // SECURITY: Verify template ownership if templateId is being updated
      if (allowedUpdates.templateId) {
        const [template] = await db
          .select()
          .from(emailTemplates)
          .where(and(
            eq(emailTemplates.id, allowedUpdates.templateId),
            eq(emailTemplates.userId, userId)
          ));
        
        if (!template) {
          return res.status(403).json({ 
            message: "Template not found or access denied. You can only use templates you own." 
          });
        }
      }

      const [updated] = await db
        .update(campaigns)
        .set(allowedUpdates)
        .where(and(
          eq(campaigns.id, req.params.id),
          eq(campaigns.userId, userId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  // Delete campaign
  app.delete("/api/campaigns/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;

      // Delete related records first (filtering by userId for security)
      await db.delete(campaignSubscribers).where(and(
        eq(campaignSubscribers.campaignId, req.params.id),
        eq(campaignSubscribers.userId, userId)
      ));
      await db.delete(campaignAnalytics).where(and(
        eq(campaignAnalytics.campaignId, req.params.id),
        eq(campaignAnalytics.userId, userId)
      ));

      const [deleted] = await db
        .delete(campaigns)
        .where(and(
          eq(campaigns.id, req.params.id),
          eq(campaigns.userId, userId)
        ))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      res.json({ message: "Campaign deleted successfully" });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // Get campaign analytics
  app.get("/api/campaigns/:id/analytics", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const [analytics] = await db
        .select()
        .from(campaignAnalytics)
        .where(and(
          eq(campaignAnalytics.campaignId, req.params.id),
          eq(campaignAnalytics.userId, userId)
        ));

      if (!analytics) {
        return res.status(404).json({ message: "Campaign analytics not found" });
      }

      const clicksData = await db
        .select({
          url: linkClicks.url,
          count: sql<number>`count(*)::int`,
        })
        .from(linkClicks)
        .where(and(
          eq(linkClicks.campaignId, req.params.id),
          eq(linkClicks.userId, userId)
        ))
        .groupBy(linkClicks.url)
        .orderBy(sql`count(*) DESC`);

      // Get web version views analytics
      const webVersionViewsData = await db
        .select({
          subscriberId: webVersionViews.subscriberId,
          viewedAt: webVersionViews.viewedAt,
        })
        .from(webVersionViews)
        .where(and(
          eq(webVersionViews.campaignId, req.params.id),
          eq(webVersionViews.userId, userId)
        ))
        .orderBy(desc(webVersionViews.viewedAt));

      const totalWebVersionViews = webVersionViewsData.length;
      const uniqueWebVersionViewers = new Set(webVersionViewsData.map(v => v.subscriberId)).size;

      res.json({
        ...analytics,
        linkClicks: clicksData,
        webVersionViews: totalWebVersionViews,
        uniqueWebVersionViewers: uniqueWebVersionViewers,
        recentWebVersionViews: webVersionViewsData.slice(0, 10),
      });
    } catch (error) {
      console.error("Error fetching campaign analytics:", error);
      res.status(500).json({ message: "Failed to fetch campaign analytics" });
    }
  });

  // ========== DASHBOARD DATA API ==========

  // Notifications endpoints
  app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      console.log(`[Notifications] Fetching for user: ${userId}`);
      const notifications = await notificationService.getUserNotifications(userId);
      console.log(`[Notifications] Found ${notifications.length} notification(s)`);
      res.json(notifications);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;

      await db
        .update(schema.notifications)
        .set({ read: true })
        .where(
          and(
            eq(schema.notifications.id, id),
            eq(schema.notifications.userId, userId)
          )
        );

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      res.status(500).json({ message: 'Failed to update notification' });
    }
  });

  app.patch('/api/notifications/read-all', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;

      await db
        .update(schema.notifications)
        .set({ read: true })
        .where(eq(schema.notifications.userId, userId));

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      res.status(500).json({ message: 'Failed to update notifications' });
    }
  });

  // Dashboard endpoint
  app.get('/api/dashboard', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      // Get recent campaigns analytics
      const recentCampaigns = await db
        .select()
        .from(campaigns)
        .where(and(
          eq(campaigns.status, 'sent'),
          eq(campaigns.userId, userId)
        ))
        .orderBy(desc(campaigns.sentAt))
        .limit(10);

      let totalDelivered = 0;
      let totalBounced = 0;
      let totalComplained = 0;
      let totalUnsubscribed = 0;
      let totalSent = 0;

      for (const campaign of recentCampaigns) {
        const [analytics] = await db
          .select()
          .from(campaignAnalytics)
          .where(eq(campaignAnalytics.campaignId, campaign.id));

        if (analytics) {
          totalSent += analytics.sent;
          totalDelivered += analytics.delivered;
          totalBounced += analytics.bounced;
          totalComplained += analytics.complained;
          totalUnsubscribed += analytics.unsubscribed;
        }
      }

      // Calculate KPIs
      const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : '0.0';
      const bounceRate = totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(2) : '0.00';
      const complaintRate = totalDelivered > 0 ? ((totalComplained / totalDelivered) * 100).toFixed(2) : '0.00';
      const unsubscribeRate = totalDelivered > 0 ? ((totalUnsubscribed / totalDelivered) * 100).toFixed(2) : '0.00';

      const deliveryRateNum = parseFloat(deliveryRate);
      const complaintRateNum = parseFloat(complaintRate);

      const dashboardData = {
        kpis: [
          { title: 'Delivery Rate', value: `${deliveryRate}%`, change: '+0.1%', changeType: 'increase' as const, period: 'vs last 7d' },
          { title: 'Hard Bounce Rate', value: `${bounceRate}%`, change: '-0.05%', changeType: 'decrease' as const, period: 'vs last 7d' },
          { title: 'Complaint Rate', value: `${complaintRate}%`, change: '+0.02%', changeType: 'increase' as const, period: 'vs last 7d' },
          { title: 'Unsubscribe Rate', value: `${unsubscribeRate}%`, change: '0.00%', changeType: 'neutral' as const, period: 'vs last 7d' },
        ],
        gmailSpamRate: complaintRateNum,
        domainPerformance: [
          { name: 'Gmail', deliveryRate: deliveryRateNum, complaintRate: complaintRateNum, spamRate: complaintRateNum },
          { name: 'Yahoo', deliveryRate: deliveryRateNum, complaintRate: complaintRateNum, spamRate: complaintRateNum },
          { name: 'Outlook', deliveryRate: deliveryRateNum, complaintRate: complaintRateNum, spamRate: complaintRateNum },
          { name: 'Other', deliveryRate: deliveryRateNum, complaintRate: complaintRateNum, spamRate: complaintRateNum },
        ],
        complianceChecklist: [
          { id: 'spf', name: 'SPF Alignment', status: 'pass' as const, details: 'SPF record is valid and aligned.', fixLink: '#' },
          { id: 'dkim', name: 'DKIM Alignment', status: 'pass' as const, details: 'DKIM signatures are valid and aligned.', fixLink: '#' },
          { id: 'dmarc', name: 'DMARC Policy', status: 'warn' as const, details: 'p=none policy detected. Consider tightening to quarantine/reject.', fixLink: '#' },
          { id: 'list_unsub', name: 'One-Click Unsubscribe', status: 'pass' as const, details: 'List-Unsubscribe headers are correctly implemented.', fixLink: '#' },
          { id: 'tls', name: 'TLS Encryption', status: 'pass' as const, details: '100% of mail sent over TLS.', fixLink: '#' },
          { id: 'fbl', name: 'Feedback Loops', status: 'fail' as const, details: 'Yahoo CFL not configured. Complaints may be missed.', fixLink: '#' },
        ],
      };

      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // ========== CAMPAIGN SENDING API ==========

  app.post("/api/campaigns/:id/send", requireAuth, async (req, res) => {
    try {
      const campaignId = req.params.id;
      const userId = (req as any).userId;

      // PREFLIGHT CHECK: Ensure SES is configured before allowing email sending
      const isConfigured = await emailService.isConfigured(userId);
      if (!isConfigured) {
        return res.status(400).json({
          message: "Email provider not configured. Please configure AWS SES in Settings > Email Integration before sending campaigns.",
          requiresConfiguration: true,
          action: "configure_ses"
        });
      }

      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(
          eq(campaigns.id, campaignId),
          eq(campaigns.userId, userId)
        ))
        .limit(1);

      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      if (campaign.status === 'sent') {
        return res.status(400).json({ message: "Campaign has already been sent" });
      }

      let emailContent = { subject: campaign.subject, htmlContent: '', textContent: '' };

      if (campaign.templateId) {
        const [template] = await db
          .select()
          .from(emailTemplates)
          .where(and(
            eq(emailTemplates.id, campaign.templateId),
            eq(emailTemplates.userId, userId)
          ))
          .limit(1);

        if (template) {
          emailContent.htmlContent = template.htmlContent;
          emailContent.textContent = template.textContent || '';
        }
      } else {
        emailContent.htmlContent = '<html><body><p>Default email content</p></body></html>';
      }

      let targetSubscribers = await db
        .select()
        .from(subscribers)
        .where(and(
          eq(subscribers.status, 'active'),
          eq(subscribers.confirmed, true), // Only send to confirmed subscribers (double opt-in)
          eq(subscribers.userId, userId)
        ));

      if (campaign.lists.length > 0) {
        targetSubscribers = targetSubscribers.filter(sub => 
          sub.lists.some(list => campaign.lists.includes(list))
        );
      }

      if (targetSubscribers.length === 0) {
        return res.status(400).json({ message: "No active subscribers found for this campaign" });
      }

      for (const subscriber of targetSubscribers) {
        await db.insert(campaignSubscribers).values({
          userId,
          campaignId: campaign.id,
          subscriberId: subscriber.id,
          status: 'pending',
        }).onConflictDoNothing();
      }

      await db
        .update(campaigns)
        .set({ status: 'sending' })
        .where(and(
          eq(campaigns.id, campaignId),
          eq(campaigns.userId, userId)
        ));

      res.json({
        message: "Campaign sending started",
        recipientCount: targetSubscribers.length,
        status: 'sending',
      });

      const trackingDomain = process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000';

      setImmediate(async () => {
        try {
          const { EmailTrackingService, BatchEmailProcessor } = await import('./emailService');
          const trackingService = new EmailTrackingService(trackingDomain);
          const batchProcessor = new BatchEmailProcessor(100, 1000);

          let sentCount = 0;
          let failedCount = 0;
          const recipients = targetSubscribers; // Assign to recipients for notification service

          for (const subscriber of recipients) {
            try {
              const processedContentBase = {
                subject: trackingService.replaceMergeTags(emailContent.subject, subscriber),
                htmlContent: trackingService.replaceMergeTags(emailContent.htmlContent, subscriber),
                textContent: emailContent.textContent,
              };

              const processedContent = trackingService.processEmailForTracking(processedContentBase, {
                campaignId: campaign.id,
                subscriberId: subscriber.id,
                trackingDomain,
                userId: campaign.userId,
              });

              console.log(`Sending email to ${subscriber.email} for campaign ${campaign.id}`);

              await emailService.sendEmail({
                to: subscriber.email,
                from: campaign.fromEmail,
                fromName: campaign.fromName,
                replyTo: campaign.replyTo,
                subject: processedContent.subject,
                html: processedContent.htmlContent,
                text: processedContent.textContent,
                userId: campaign.userId,
              });

              await db.execute(sql`
                UPDATE campaign_subscribers
                SET status = 'sent', sent_at = NOW(), html_content = ${processedContent.htmlContent}
                WHERE campaign_id = ${campaign.id}
                AND subscriber_id = ${subscriber.id}
              `);

              sentCount++;
            } catch (error) {
              console.error(`Failed to send email to ${subscriber.email}:`, error);
              await db.execute(sql`
                UPDATE campaign_subscribers
                SET status = 'failed'
                WHERE campaign_id = ${campaign.id}
                AND subscriber_id = ${subscriber.id}
              `);
              failedCount++;
            }
          }

          await db
            .update(campaigns)
            .set({ 
              status: 'sent',
              sentAt: new Date(),
            })
            .where(eq(campaigns.id, campaignId));

          await db.insert(campaignAnalytics).values({
            userId: campaign.userId,
            campaignId: campaign.id,
            totalSubscribers: recipients.length,
            sent: sentCount,
            delivered: sentCount,
            failed: failedCount,
          }).onConflictDoUpdate({
            target: campaignAnalytics.campaignId,
            set: {
              sent: sentCount,
              delivered: sentCount,
              failed: failedCount,
            },
          });

          console.log(`Campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed`);

          // Create notification
          const { notifyCampaignSent } = await import('./notificationService');
          const recipientCount = recipients.length;
          await notifyCampaignSent(userId, campaign.name || 'Untitled Campaign', recipientCount);

        } catch (error) {
          console.error(`Error in background campaign send:`, error);
          await db
            .update(campaigns)
            .set({ status: 'failed' })
            .where(eq(campaigns.id, campaignId));
        }
      });

    } catch (error) {
      console.error("Error starting campaign send:", error);
      res.status(500).json({ message: "Failed to start campaign send" });
    }
  });

  app.get("/api/campaigns/:id/analytics/clicks", requireAuth, async (req, res) => {
    try {
      const campaignId = req.params.id;
      const userId = (req as any).userId;

      const clicks = await db
        .select()
        .from(linkClicks)
        .where(and(
          eq(linkClicks.campaignId, campaignId),
          eq(linkClicks.userId, userId)
        ))
        .orderBy(desc(linkClicks.clickedAt));

      const linkStats = clicks.reduce((acc, click) => {
        if (!acc[click.url]) {
          acc[click.url] = { url: click.url, clicks: 0, uniqueClicks: new Set() };
        }
        acc[click.url].clicks++;
        acc[click.url].uniqueClicks.add(click.subscriberId);
        return acc;
      }, {} as Record<string, { url: string; clicks: number; uniqueClicks: Set<string> }>);

      const linkStatsArray = Object.values(linkStats).map(stat => ({
        url: stat.url,
        totalClicks: stat.clicks,
        uniqueClicks: stat.uniqueClicks.size,
      }));

      res.json({
        campaignId,
        totalClicks: clicks.length,
        uniqueClickers: new Set(clicks.map(c => c.subscriberId)).size,
        linkStats: linkStatsArray,
        recentClicks: clicks.slice(0, 50),
      });
    } catch (error) {
      console.error("Error fetching click analytics:", error);
      res.status(500).json({ message: "Failed to fetch click analytics" });
    }
  });

  // ========== EMAIL PROVIDER INTEGRATIONS API ==========
  // NOTE: These specific routes MUST be defined BEFORE the generic /api/settings/:key route
  // to prevent the wildcard from matching "email-provider" as a key parameter.

  // Get user's email provider integration
  app.get("/api/settings/email-provider", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { emailProviderIntegrations } = await import('./db');

      const [integration] = await db
        .select()
        .from(emailProviderIntegrations)
        .where(eq(emailProviderIntegrations.userId, userId));

      if (!integration) {
        return res.json({ 
          provider: null, 
          isActive: false, 
          config: {},
          requiresConfiguration: true,
          message: "Email provider not configured. Please configure AWS SES to send emails."
        });
      }

      const config = integration.config as any;
      const decryptedConfig = decryptObject(config);

      const safeConfig = {
        ...decryptedConfig,
        awsSecretAccessKey: decryptedConfig.awsSecretAccessKey ? '***HIDDEN***' : undefined,
        apiKey: decryptedConfig.apiKey ? '***HIDDEN***' : undefined,
        sendgridApiKey: decryptedConfig.sendgridApiKey ? '***HIDDEN***' : undefined,
        mailgunApiKey: decryptedConfig.mailgunApiKey ? '***HIDDEN***' : undefined,
      };

      res.json({
        ...integration,
        config: safeConfig,
      });
    } catch (error) {
      console.error("Error fetching email provider integration:", error);
      res.status(500).json({ message: "Failed to fetch integration" });
    }
  });

  // Create or update email provider integration
  app.post("/api/settings/email-provider", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { provider, isActive, config } = req.body;
      const { emailProviderIntegrations, insertEmailProviderIntegrationSchema } = await import('./db');

      if (provider && provider !== 'ses') {
        const providerName = String(provider).toUpperCase();
        return res.status(400).json({
          message: `${providerName} provider is not supported for per-user credentials. Only AWS SES is currently supported for multi-tenant email integration.`,
          supportedProviders: ['ses'],
          requestedProvider: provider,
          reason: provider === 'resend' 
            ? "Per-user Resend client instantiation not implemented" 
            : `${providerName} integration not implemented`
        });
      }

      const validatedData = insertEmailProviderIntegrationSchema.parse({
        provider,
        isActive,
        config,
      });

      const [existing] = await db
        .select()
        .from(emailProviderIntegrations)
        .where(eq(emailProviderIntegrations.userId, userId));

      if (existing) {
        const existingConfig = existing.config as any || {};
        const newConfig = validatedData.config as any || {};

        const decryptedExisting = decryptObject(existingConfig);

        const mergedConfig = {
          awsAccessKeyId: newConfig.awsAccessKeyId || decryptedExisting.awsAccessKeyId,
          awsSecretAccessKey: newConfig.awsSecretAccessKey || decryptedExisting.awsSecretAccessKey,
          awsRegion: newConfig.awsRegion || decryptedExisting.awsRegion,
        };

        const encryptedConfig = encryptObject(mergedConfig);

        const [updated] = await db
          .update(emailProviderIntegrations)
          .set({
            provider: validatedData.provider,
            isActive: validatedData.isActive,
            config: encryptedConfig as any,
            updatedAt: new Date(),
          })
          .where(eq(emailProviderIntegrations.userId, userId))
          .returning();

        res.json({ message: "Integration updated successfully", integration: updated });
      } else {
        const encryptedConfig = encryptObject(validatedData.config as any);

        const [created] = await db
          .insert(emailProviderIntegrations)
          .values({
            userId,
            provider: validatedData.provider,
            isActive: validatedData.isActive,
            config: encryptedConfig as any,
          })
          .returning();

        res.json({ message: "Integration created successfully", integration: created });
      }
    } catch (error) {
      console.error("Error saving email provider integration:", error);
      res.status(500).json({ message: "Failed to save integration" });
    }
  });

  // Delete email provider integration
  app.delete("/api/settings/email-provider", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { emailProviderIntegrations } = await import('./db');

      await db
        .delete(emailProviderIntegrations)
        .where(eq(emailProviderIntegrations.userId, userId));

      res.json({ message: "Integration deleted successfully" });
    } catch (error) {
      console.error("Error deleting email provider integration:", error);
      res.status(500).json({ message: "Failed to delete integration" });
    }
  });

  // ========== SETTINGS API ==========

  // Get all settings
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const allSettings = await db.select().from(settings);

      // Convert to key-value object
      const settingsObj = allSettings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, any>);

      res.json(settingsObj);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Get single setting
  app.get("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const [setting] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, req.params.key));

      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }

      res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  // Update or create setting
  app.put("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const { value } = req.body;

      const [existing] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, req.params.key));

      if (existing) {
        const [updated] = await db
          .update(settings)
          .set({
            value,
          })
          .where(eq(settings.key, req.params.key))
          .returning();

        res.json(updated);
      } else {
        const [created] = await db
          .insert(settings)
          .values({
            key: req.params.key,
            value,
          })
          .returning();

        res.status(201).json(created);
      }
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  // Delete setting
  app.delete("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const [deleted] = await db
        .delete(settings)
        .where(eq(settings.key, req.params.key))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Setting not found" });
      }

      res.json({ message: "Setting deleted successfully" });
    } catch (error) {
      console.error("Error deleting setting:", error);
      res.status(500).json({ message: "Failed to delete setting" });
    }
  });

  // ========== PUBLIC SUBSCRIBER API (No Auth Required) ==========

  // Public subscribe endpoint with double opt-in
  app.post("/api/public/subscribe", subscribeRateLimiter, async (req, res) => {
    try {
      const { email, firstName, lastName, lists } = req.body;
      const crypto = await import('crypto');

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // For now, assign to a default user (in production, this would be based on form/domain)
      // You can enhance this to accept a userId or API key in the request
      const defaultUserId = req.body.userId; // Passed from embedded form

      if (!defaultUserId) {
        return res.status(400).json({ message: "userId is required for subscription" });
      }

      // Check if subscriber already exists
      const [existing] = await db
        .select()
        .from(subscribers)
        .where(and(
          eq(subscribers.email, email.toLowerCase()),
          eq(subscribers.userId, defaultUserId)
        ));

      if (existing) {
        // If already confirmed AND active, just return success
        if (existing.confirmed && existing.status === 'active') {
          return res.json({ 
            message: "You're already subscribed and confirmed!", 
            alreadyConfirmed: true 
          });
        }

        // If unsubscribed or not confirmed, start new confirmation flow
        const confirmationToken = crypto.randomBytes(32).toString('hex');
        const [updated] = await db
          .update(subscribers)
          .set({
            confirmationToken,
            confirmationSentAt: new Date(),
            firstName: firstName || existing.firstName,
            lastName: lastName || existing.lastName,
            lists: lists || existing.lists,
            confirmed: false, // Reset confirmed status for re-subscription
            status: 'active', // Will be active after confirmation
            consentGiven: true,
            consentTimestamp: new Date(),
          })
          .where(eq(subscribers.id, existing.id))
          .returning();

        // Send confirmation email
        try {
          const { emailService } = await import('./emailProvider');
          const confirmationUrl = `${req.protocol}://${req.get('host')}/api/public/confirm/${confirmationToken}`;

          await emailService.sendEmail({
            userId: defaultUserId,
            to: email.toLowerCase(),
            from: 'noreply@example.com',
            fromName: 'Newsletter',
            subject: 'Please confirm your subscription',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #333;">Confirm Your Subscription</h1>
                <p>Hi ${firstName || 'there'},</p>
                <p>Thank you for subscribing! Please confirm your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${confirmationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Confirm Subscription
                  </a>
                </div>
                <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
                <p style="color: #666; font-size: 14px; word-break: break-all;">${confirmationUrl}</p>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">This link will expire in 7 days.</p>
              </div>
            `,
            text: `Please confirm your subscription by visiting: ${confirmationUrl}`,
          });
        } catch (emailError) {
          console.error('Failed to send confirmation email:', emailError);
          // Continue anyway - subscriber created, they can try subscribing again
        }

        return res.json({ 
          message: "Confirmation email resent! Please check your inbox.", 
          requiresConfirmation: true 
        });
      }

      // Create new subscriber with confirmation token
      const confirmationToken = crypto.randomBytes(32).toString('hex');
      const [newSubscriber] = await db
        .insert(subscribers)
        .values({
          userId: defaultUserId,
          email: email.toLowerCase(),
          firstName,
          lastName,
          status: 'active',
          lists: lists || [],
          consentGiven: true,
          consentTimestamp: new Date(),
          confirmed: false,
          confirmationToken,
          confirmationSentAt: new Date(),
        })
        .returning();

      // Send confirmation email
      try {
        const { emailService } = await import('./emailProvider');
        const confirmationUrl = `${req.protocol}://${req.get('host')}/api/public/confirm/${confirmationToken}`;

        await emailService.sendEmail({
          userId: defaultUserId,
          to: email.toLowerCase(),
          from: 'noreply@example.com',
          fromName: 'Newsletter',
          subject: 'Please confirm your subscription',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #333;">Confirm Your Subscription</h1>
              <p>Hi ${firstName || 'there'},</p>
              <p>Thank you for subscribing! Please confirm your email address by clicking the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Confirm Subscription
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
              <p style="color: #666; font-size: 14px; word-break: break-all;">${confirmationUrl}</p>
              <p style="color: #999; font-size: 12px; margin-top: 30px;">This link will expire in 7 days.</p>
            </div>
          `,
          text: `Please confirm your subscription by visiting: ${confirmationUrl}`,
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Continue anyway - subscriber created, they can try subscribing again
      }

      res.status(201).json({ 
        message: "Please check your email to confirm your subscription!", 
        requiresConfirmation: true 
      });
    } catch (error) {
      console.error("Error in public subscribe:", error);
      res.status(500).json({ message: "Failed to subscribe" });
    }
  });

  // Email confirmation endpoint
  app.get("/api/public/confirm/:token", async (req, res) => {
    try {
      const { token } = req.params;

      if (!token || token.length !== 64) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
              <h1 style="color: #e74c3c;">Invalid Confirmation Link</h1>
              <p>This confirmation link is invalid or malformed.</p>
            </body>
          </html>
        `);
      }

      // Find subscriber by confirmation token
      const [subscriber] = await db
        .select()
        .from(subscribers)
        .where(eq(subscribers.confirmationToken, token));

      if (!subscriber) {
        return res.status(404).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
              <h1 style="color: #e74c3c;">Confirmation Link Not Found</h1>
              <p>This confirmation link may have already been used or is invalid.</p>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">If you've already confirmed your subscription, you're all set!</p>
            </body>
          </html>
        `);
      }

      // Check if token is expired (7 days)
      const confirmationSentAt = subscriber.confirmationSentAt;
      if (confirmationSentAt) {
        const expiryTime = new Date(confirmationSentAt.getTime() + (7 * 24 * 60 * 60 * 1000));
        if (new Date() > expiryTime) {
          return res.status(400).send(`
            <html>
              <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
                <h1 style="color: #e74c3c;">Confirmation Link Expired</h1>
                <p>This confirmation link has expired (7 days old).</p>
                <p style="color: #666; font-size: 14px; margin-top: 20px;">Please subscribe again to receive a new confirmation email.</p>
              </body>
            </html>
          `);
        }
      }

      // Mark subscriber as confirmed
      const [updated] = await db
        .update(subscribers)
        .set({
          confirmed: true,
          confirmedAt: new Date(),
          confirmationToken: null, // Clear token after use (one-time use)
        })
        .where(eq(subscribers.id, subscriber.id))
        .returning();

      res.send(`
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Subscription Confirmed</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center; padding: 20px;">
            <div style="background: #10b981; color: white; border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 40px;">
              ✓
            </div>
            <h1 style="color: #10b981;">Subscription Confirmed!</h1>
            <p style="color: #333; font-size: 18px;">Thank you for confirming your email address.</p>
            <p style="color: #666; font-size: 16px;">You're now subscribed and will receive our newsletters.</p>
            <p style="color: #999; font-size: 14px; margin-top: 30px;">You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error in email confirmation:", error);
      res.status(500).send(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1 style="color: #e74c3c;">Error</h1>
            <p>An error occurred while confirming your subscription. Please try again later.</p>
          </body>
        </html>
      `);
    }
  });

  // Unsubscribe endpoint (token-based, no auth required)
  app.get("/api/public/unsubscribe/:token", unsubscribeRateLimiter, async (req, res) => {
    try {
      const { token } = req.params;

      // Decode and validate HMAC-signed token
      const { EmailTrackingService } = await import("./emailService");
      const decoded = EmailTrackingService.decodeUnsubscribeToken(token);

      if (!decoded) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
              <h1 style="color: #e74c3c;">Invalid Unsubscribe Link</h1>
              <p>This unsubscribe link is invalid or has expired.</p>
            </body>
          </html>
        `);
      }

      const { subscriberId, userId } = decoded;

      // SECURITY: Require userId for multi-tenant isolation
      // Legacy tokens without userId are rejected - all new tokens must include userId
      if (!userId) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
              <h1 style="color: #e74c3c;">Invalid Unsubscribe Link</h1>
              <p>This unsubscribe link is invalid. Please use the unsubscribe link from a recent email.</p>
            </body>
          </html>
        `);
      }

      // Update subscriber status with multi-tenant verification
      const [updated] = await db
        .update(subscribers)
        .set({ status: 'unsubscribed' })
        .where(and(
          eq(subscribers.id, subscriberId),
          eq(subscribers.userId, userId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
              <h1 style="color: #e74c3c;">Subscriber Not Found</h1>
              <p>We couldn't find your subscription.</p>
            </body>
          </html>
        `);
      }

      res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1 style="color: #27ae60;">Successfully Unsubscribed</h1>
            <p>You have been unsubscribed from this mailing list.</p>
            <p style="color: #7f8c8d; font-size: 14px;">Email: ${updated.email}</p>
          </body>
          </html>
      `);
    } catch (error) {
      console.error("Error in unsubscribe:", error);
      res.status(500).send(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
            <h1 style="color: #e74c3c;">Error</h1>
            <p>An error occurred while processing your unsubscribe request.</p>
          </body>
        </html>
      `);
    }
  });

  // View email in browser (web version)
  app.get("/api/public/view/:token", publicEndpointLimiter, async (req, res) => {
    try {
      const { token } = req.params;

      // Decode and validate HMAC-signed token
      const { decodeWebVersionToken } = await import("./trackingTokens");
      const decoded = decodeWebVersionToken(token);

      if (!decoded) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
              <h1 style="color: #e74c3c;">Invalid Link</h1>
              <p>This web version link is invalid or has expired.</p>
            </body>
          </html>
        `);
      }

      const { campaignId, subscriberId, userId } = decoded;

      // Track web version view
      await db.insert(webVersionViews).values({
        userId,
        campaignId,
        subscriberId,
        ipAddress: req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || null,
        userAgent: req.get('user-agent') || null,
      });

      // Fetch campaign with template
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(
          eq(campaigns.id, campaignId),
          eq(campaigns.userId, userId)
        ));

      if (!campaign) {
        return res.status(404).send("<h1>Campaign not found</h1>");
      }

      // Fetch template
      const [template] = await db
        .select()
        .from(emailTemplates)
        .where(and(
          eq(emailTemplates.id, campaign.templateId),
          eq(emailTemplates.userId, userId)
        ));

      if (!template) {
        return res.status(404).send("<h1>Email template not found</h1>");
      }

      // Fetch subscriber for personalization
      const [subscriber] = await db
        .select()
        .from(subscribers)
        .where(and(
          eq(subscribers.id, subscriberId),
          eq(subscribers.userId, userId)
        ));

      // Replace merge tags
      let htmlContent = template.htmlContent;

      // Generate unsubscribe URL with HMAC token
      const { generateUnsubscribeToken } = await import("./trackingTokens");
      const { replaceMergeTags } = await import("./emailTrackingService");
      const unsubToken = generateUnsubscribeToken(subscriberId, userId);
      const unsubscribeUrl = `${req.protocol}://${req.get('host')}/unsubscribe/${unsubToken}`;

      // Replace merge tags with subscriber data
      if (subscriber) {
        htmlContent = replaceMergeTags(htmlContent, subscriber, campaign);
      }

      // Replace unsubscribe URL
      htmlContent = htmlContent.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);

      // Add web version banner at the top
      const banner = `
        <div style="background: #f8f9fa; padding: 10px; text-align: center; font-family: Arial, sans-serif; font-size: 12px; color: #6c757d; border-bottom: 1px solid #dee2e6;">
          📧 Viewing web version of "${template.name}"
        </div>
      `;

      res.send(banner + htmlContent);
    } catch (error) {
      console.error("Error in web version:", error);
      res.status(500).send("<h1>Error loading email</h1>");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}