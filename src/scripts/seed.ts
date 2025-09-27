import bcrypt from "bcryptjs";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { generateId } from "~/lib/utils";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Create admin user
    const adminPasswordHash = await bcrypt.hash("admin123", 10);
    const adminUser = {
      id: generateId(),
      email: "admin@example.com",
      name: "System Administrator",
      role: "system_admin" as const,
      passwordHash: adminPasswordHash,
    };

    // Create regular user
    const userPasswordHash = await bcrypt.hash("user123", 10);
    const regularUser = {
      id: generateId(),
      email: "user@example.com",
      name: "Regular User",
      role: "user" as const,
      passwordHash: userPasswordHash,
    };

    // Insert users (with conflict handling)
    await db.insert(users).values([adminUser, regularUser]).onConflictDoNothing();

    console.log("✅ Database seeded successfully!");
    console.log("👤 Admin user: admin@example.com / admin123");
    console.log("👤 Regular user: user@example.com / user123");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

void seed();