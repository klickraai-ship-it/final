import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function createSuperAdmin() {
  const email = "zero.ai.info@gmail.com";
  const password = "Tripti@gr@w@l";
  const name = "Super Admin";
  
  console.log("🚀 Creating superadmin account...");

  try {
    // Check if admin already exists
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    
    if (existing) {
      console.log("✅ Super admin already exists:", email);
      
      // Update to ensure they have superadmin flag
      if (!existing.isSuperAdmin) {
        await db.update(users)
          .set({ isSuperAdmin: true })
          .where(eq(users.email, email));
        console.log("✅ Updated existing user to superadmin");
      }
      return;
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create superadmin
    const [newAdmin] = await db.insert(users).values({
      email,
      passwordHash,
      name,
      role: 'admin',
      isSuperAdmin: true,
      isVerified: true,
      paymentStatus: 'paid', // Superadmin doesn't need to pay
    }).returning();

    console.log("✅ Super admin created successfully!");
    console.log("   Email:", email);
    console.log("   Name:", name);
    console.log("   ID:", newAdmin.id);
  } catch (error) {
    console.error("❌ Error creating super admin:", error);
    process.exit(1);
  }
}

createSuperAdmin()
  .then(() => {
    console.log("\n✅ Setup complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  });
