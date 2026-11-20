import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { studentProfiles, users } from '../../db/schema.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { isValidIsoDate } from '../utils/validation.ts';

export const profileRouter = Router();

const optionalIsoDate = z
  .string()
  .max(30)
  .refine((v) => v === '' || isValidIsoDate(v), 'Invalid calendar date (use YYYY-MM-DD)')
  .nullable()
  .optional();

const profileUpdateSchema = z
  .object({
    fullName: z.string().max(150).nullable().optional(),
    nationality: z.string().max(100).nullable().optional(),
    countryOfResidence: z.string().max(100).nullable().optional(),
    dateOfBirth: optionalIsoDate,
  phoneNumber: z.string().max(40).nullable().optional(),
  currentOrCompletedDegree: z.string().max(100).nullable().optional(),
  degreeCompleted: z.boolean().nullable().optional(),
  degreeField: z.string().max(150).nullable().optional(),
  universityName: z.string().max(200).nullable().optional(),
  universityCountry: z.string().max(100).nullable().optional(),
  graduationYear: z.coerce.number().int().min(1980).max(2035).nullable().optional(),
  cgpa: z.union([z.coerce.number().min(0).max(10), z.null()]).optional(),
  cgpaScale: z.union([z.coerce.number().min(1).max(100), z.null()]).optional(),
  academicPercentage: z.union([z.coerce.number().min(0).max(100), z.null()]).optional(),
  completedCourses: z.array(z.string().max(120)).max(50).optional(),
  ieltsOverall: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
  ieltsListening: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
  ieltsReading: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
  ieltsWriting: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
  ieltsSpeaking: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
  toeflScore: z.union([z.coerce.number().int().min(0).max(120), z.null()]).optional(),
  duolingoScore: z.union([z.coerce.number().int().min(10).max(160), z.null()]).optional(),
  otherLanguageTestName: z.string().max(80).nullable().optional(),
  otherLanguageTestScore: z.string().max(40).nullable().optional(),
  languageTestDate: optionalIsoDate,
  languageTestValidityDate: optionalIsoDate,
  desiredDegreeLevel: z.string().max(60).nullable().optional(),
  preferredStudyProgrammes: z.array(z.string().max(120)).max(20).optional(),
  preferredCountries: z.array(z.string().max(100)).max(20).optional(),
  preferredIntake: z.string().max(80).nullable().optional(),
  maxTuitionBudgetUsd: z.union([z.coerce.number().int().min(0).max(500000), z.null()]).optional(),
  scholarshipPreference: z.string().max(40).nullable().optional(),
  preferredStudyMode: z.string().max(40).nullable().optional(),
  onboardingCompleted: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.cgpa != null && data.cgpaScale != null) {
        return data.cgpa <= data.cgpaScale;
      }
      return true;
    },
    { message: 'CGPA cannot exceed the specified CGPA scale.', path: ['cgpa'] }
  );

profileRouter.get('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = req.dbUser!;
    let [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, dbUser.id))
      .limit(1);

    if (!profile) {
      [profile] = await db
        .insert(studentProfiles)
        .values({ userId: dbUser.id, fullName: dbUser.fullName })
        .returning();
    }

    return res.json({ user: dbUser, profile });
  } catch (error) {
    console.error('Failed to get profile:', error);
    return res.status(500).json({ error: 'Unable to load student profile.' });
  }
});

profileRouter.put('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const dbUser = req.dbUser!;
    const data = parsed.data;

    // For partial updates, verify CGPA <= CGPA scale against stored values too
    if (data.cgpa !== undefined || data.cgpaScale !== undefined) {
      const [existingProfile] = await db
        .select({ cgpa: studentProfiles.cgpa, cgpaScale: studentProfiles.cgpaScale })
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, dbUser.id))
        .limit(1);
      const nextCgpa = data.cgpa !== undefined ? data.cgpa : existingProfile?.cgpa ? Number(existingProfile.cgpa) : null;
      const nextScale =
        data.cgpaScale !== undefined
          ? data.cgpaScale
          : existingProfile?.cgpaScale
            ? Number(existingProfile.cgpaScale)
            : null;
      if (nextCgpa !== null && nextScale !== null && nextCgpa > nextScale) {
        return res.status(400).json({ error: 'CGPA cannot exceed the specified CGPA scale.' });
      }
    }

    if (data.fullName !== undefined || data.onboardingCompleted !== undefined) {
      await db
        .update(users)
        .set({
          fullName: data.fullName !== undefined ? data.fullName : dbUser.fullName,
          onboardingCompleted:
            data.onboardingCompleted !== undefined
              ? data.onboardingCompleted
              : dbUser.onboardingCompleted,
          updatedAt: new Date(),
        })
        .where(eq(users.id, dbUser.id));
    }

    const toNumericStr = (v: number | null | undefined) =>
      v === undefined ? undefined : v === null ? null : String(v);

    const updatePayload = {
      fullName: data.fullName,
      nationality: data.nationality,
      countryOfResidence: data.countryOfResidence,
      dateOfBirth: data.dateOfBirth,
      phoneNumber: data.phoneNumber,
      currentOrCompletedDegree: data.currentOrCompletedDegree,
      degreeCompleted: data.degreeCompleted,
      degreeField: data.degreeField,
      universityName: data.universityName,
      universityCountry: data.universityCountry,
      graduationYear: data.graduationYear,
      cgpa: toNumericStr(data.cgpa),
      cgpaScale: toNumericStr(data.cgpaScale),
      academicPercentage: toNumericStr(data.academicPercentage),
      completedCourses: data.completedCourses,
      ieltsOverall: toNumericStr(data.ieltsOverall),
      ieltsListening: toNumericStr(data.ieltsListening),
      ieltsReading: toNumericStr(data.ieltsReading),
      ieltsWriting: toNumericStr(data.ieltsWriting),
      ieltsSpeaking: toNumericStr(data.ieltsSpeaking),
      toeflScore: data.toeflScore,
      duolingoScore: data.duolingoScore,
      otherLanguageTestName: data.otherLanguageTestName,
      otherLanguageTestScore: data.otherLanguageTestScore,
      languageTestDate: data.languageTestDate,
      languageTestValidityDate: data.languageTestValidityDate,
      desiredDegreeLevel: data.desiredDegreeLevel,
      preferredStudyProgrammes: data.preferredStudyProgrammes,
      preferredCountries: data.preferredCountries,
      preferredIntake: data.preferredIntake,
      maxTuitionBudgetUsd: data.maxTuitionBudgetUsd,
      scholarshipPreference: data.scholarshipPreference,
      preferredStudyMode: data.preferredStudyMode,
      updatedAt: new Date(),
    };

    // Strip undefined keys so partial updates don't overwrite fields with undefined
    const cleanedPayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updatePayload)) {
      if (v !== undefined) cleanedPayload[k] = v;
    }

    const [updatedProfile] = await db
      .update(studentProfiles)
      .set(cleanedPayload)
      .where(eq(studentProfiles.userId, dbUser.id))
      .returning();

    const [updatedUser] = await db.select().from(users).where(eq(users.id, dbUser.id)).limit(1);

    return res.json({ user: updatedUser, profile: updatedProfile });
  } catch (error) {
    console.error('Failed to update profile:', error);
    return res.status(500).json({ error: 'Unable to update student profile.' });
  }
});

profileRouter.get('/profile/preferences', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = req.dbUser!;
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, dbUser.id))
      .limit(1);

    if (!profile) {
      return res.json({ preferences: null });
    }

    return res.json({
      preferences: {
        desiredDegreeLevel: profile.desiredDegreeLevel,
        preferredStudyProgrammes: profile.preferredStudyProgrammes,
        preferredCountries: profile.preferredCountries,
        preferredIntake: profile.preferredIntake,
        maxTuitionBudgetUsd: profile.maxTuitionBudgetUsd,
        scholarshipPreference: profile.scholarshipPreference,
        preferredStudyMode: profile.preferredStudyMode,
      },
    });
  } catch (error) {
    console.error('Failed to fetch preferences:', error);
    return res.status(500).json({ error: 'Unable to load study preferences.' });
  }
});

profileRouter.delete('/account', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dbUser = req.dbUser!;
    await db.delete(users).where(eq(users.id, dbUser.id));
    return res.json({ message: 'Your ApplySmart account and all personal data have been deleted.' });
  } catch (error) {
    console.error('Failed to delete account:', error);
    return res.status(500).json({ error: 'Failed to delete user data.' });
  }
});
