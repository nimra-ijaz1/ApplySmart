import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { studentProfiles, users } from './schema.ts';

const SUPER_ADMIN_EMAILS = ['nimraijaz071@gmail.com'];

export async function getOrCreateUser(
  uid: string,
  email: string,
  fullName?: string,
  avatarUrl?: string
) {
  try {
    const normalizedEmail = email.toLowerCase();
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      const shouldPromote =
        SUPER_ADMIN_EMAILS.includes(normalizedEmail) && current.role !== 'super_admin';

      if (shouldPromote || (fullName && !current.fullName) || (avatarUrl && !current.avatarUrl)) {
        const updated = await db
          .update(users)
          .set({
            email: normalizedEmail,
            fullName: current.fullName || fullName || null,
            avatarUrl: current.avatarUrl || avatarUrl || null,
            role: shouldPromote ? 'super_admin' : current.role,
            updatedAt: new Date(),
          })
          .where(eq(users.uid, uid))
          .returning();
        return updated[0];
      }
      return current;
    }

    const defaultRole = SUPER_ADMIN_EMAILS.includes(normalizedEmail) ? 'super_admin' : 'student';

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        fullName: fullName || null,
        avatarUrl: avatarUrl || null,
        role: defaultRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          updatedAt: new Date(),
        },
      })
      .returning();

    const user = inserted[0];

    // Ensure student profile exists for the user
    await db
      .insert(studentProfiles)
      .values({
        userId: user.id,
        fullName: fullName || null,
      })
      .onConflictDoNothing({ target: studentProfiles.userId });

    return user;
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to retrieve user.', { cause: error });
  }
}
