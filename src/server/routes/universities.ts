import { Router } from 'express';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  programmeRequirements,
  programmes,
  recentlyViewed,
  universities,
} from '../../db/schema.ts';
import { ensureDatabaseSeeded } from '../../db/seed.ts';
import { optionalAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

export const universitiesRouter = Router();

universitiesRouter.get('/universities', async (req, res) => {
  try {
    await ensureDatabaseSeeded();
    const {
      q = '',
      country = '',
      institutionType = '',
      degreeLevel = '',
      subject = '',
      maxTuitionUsd = '',
      maxCgpa = '',
      maxIelts = '',
      scholarshipOnly = '',
      intake = '',
      sort = 'ranking',
      page = '1',
      limit = '12',
    } = req.query as Record<string, string>;

    const allUnis = await db.select().from(universities);
    const allProgs = await db.select().from(programmes);
    const allReqs = await db.select().from(programmeRequirements);

    const reqByProgId = new Map<number, typeof allReqs[number]>();
    for (const r of allReqs) reqByProgId.set(r.programmeId, r);

    const progsByUniId = new Map<number, Array<typeof allProgs[number] & { requirements: typeof allReqs[number] | null }>>();
    for (const p of allProgs) {
      const enriched = { ...p, requirements: reqByProgId.get(p.id) ?? null };
      const list = progsByUniId.get(p.universityId) ?? [];
      list.push(enriched);
      progsByUniId.set(p.universityId, list);
    }

    const qLower = q.trim().toLowerCase();
    const maxTuitionNum = maxTuitionUsd ? Number(maxTuitionUsd) : null;
    const maxCgpaNum = maxCgpa ? Number(maxCgpa) : null;
    const maxIeltsNum = maxIelts ? Number(maxIelts) : null;

    let filtered = allUnis
      .map((u) => {
        const uniProgs = progsByUniId.get(u.id) ?? [];
        const matchingProgs = uniProgs.filter((p) => {
          if (degreeLevel && p.degreeLevel.toLowerCase() !== degreeLevel.toLowerCase()) return false;
          if (subject && !p.subjectArea.toLowerCase().includes(subject.toLowerCase()) && !p.name.toLowerCase().includes(subject.toLowerCase())) {
            return false;
          }
          if (maxTuitionNum !== null && Number.isFinite(maxTuitionNum) && p.tuitionFeeUsdApprox > maxTuitionNum) {
            return false;
          }
          if (scholarshipOnly === 'true' && !p.scholarshipAvailability) return false;
          if (intake && !p.intake.toLowerCase().includes(intake.toLowerCase())) return false;
          if (maxCgpaNum !== null && Number.isFinite(maxCgpaNum) && p.requirements?.minCgpa) {
            if (Number(p.requirements.minCgpa) > maxCgpaNum) return false;
          }
          if (maxIeltsNum !== null && Number.isFinite(maxIeltsNum) && p.requirements?.ieltsOverall) {
            if (Number(p.requirements.ieltsOverall) > maxIeltsNum) return false;
          }
          return true;
        });

        return {
          ...u,
          programmes: matchingProgs,
          totalProgrammes: uniProgs.length,
        };
      })
      .filter((u) => {
        if (country && u.country.toLowerCase() !== country.toLowerCase()) return false;
        if (institutionType && u.institutionType.toLowerCase() !== institutionType.toLowerCase()) return false;
        if (qLower) {
          const matchesUni =
            u.name.toLowerCase().includes(qLower) ||
            u.country.toLowerCase().includes(qLower) ||
            u.city.toLowerCase().includes(qLower);
          const matchesProg = u.programmes.some(
            (p) => p.name.toLowerCase().includes(qLower) || p.subjectArea.toLowerCase().includes(qLower)
          );
          if (!matchesUni && !matchesProg) return false;
        }
        if (
          degreeLevel ||
          subject ||
          maxTuitionUsd ||
          maxCgpa ||
          maxIelts ||
          scholarshipOnly === 'true' ||
          intake
        ) {
          return u.programmes.length > 0;
        }
        return true;
      });

    filtered.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'tuition_asc') {
        const minA = Math.min(...(a.programmes.length ? a.programmes.map((p) => p.tuitionFeeUsdApprox) : [999999]));
        const minB = Math.min(...(b.programmes.length ? b.programmes.map((p) => p.tuitionFeeUsdApprox) : [999999]));
        return minA - minB;
      }
      return (a.globalRanking ?? 9999) - (b.globalRanking ?? 9999);
    });

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 12));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const countries = Array.from(new Set(allUnis.map((u) => u.country))).sort();
    const subjects = Array.from(new Set(allProgs.map((p) => p.subjectArea))).sort();

    return res.json({
      items: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      facets: { countries, subjects },
    });
  } catch (error) {
    console.error('Failed to search universities:', error);
    return res.status(500).json({ error: 'Unable to fetch universities.' });
  }
});

universitiesRouter.get('/universities/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid university ID.' });

    const [university] = await db.select().from(universities).where(eq(universities.id, id)).limit(1);
    if (!university) return res.status(404).json({ error: 'University not found.' });

    const uniProgrammes = await db
      .select()
      .from(programmes)
      .where(eq(programmes.universityId, id))
      .orderBy(asc(programmes.name));

    const allReqs = await db.select().from(programmeRequirements);
    const reqMap = new Map(allReqs.map((r) => [r.programmeId, r]));

    // Track recently viewed if authenticated
    if (req.dbUser) {
      await db
        .insert(recentlyViewed)
        .values({
          userId: req.dbUser.id,
          universityId: id,
          viewedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [recentlyViewed.userId, recentlyViewed.universityId],
          set: { viewedAt: new Date() },
        });
    }

    return res.json({
      university,
      programmes: uniProgrammes.map((p) => ({
        ...p,
        requirements: reqMap.get(p.id) ?? null,
      })),
    });
  } catch (error) {
    console.error('Failed to get university details:', error);
    return res.status(500).json({ error: 'Unable to fetch university details.' });
  }
});

universitiesRouter.get('/universities/:id/programmes', async (req, res) => {
  try {
    await ensureDatabaseSeeded();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid university ID.' });

    const rows = await db.select().from(programmes).where(eq(programmes.universityId, id));
    const allReqs = await db.select().from(programmeRequirements);
    const reqMap = new Map(allReqs.map((r) => [r.programmeId, r]));

    return res.json({
      items: rows.map((p) => ({ ...p, requirements: reqMap.get(p.id) ?? null })),
    });
  } catch (error) {
    console.error('Failed to fetch university programmes:', error);
    return res.status(500).json({ error: 'Unable to load programmes.' });
  }
});

universitiesRouter.get('/programmes', async (req, res) => {
  try {
    await ensureDatabaseSeeded();
    const {
      q = '',
      country = '',
      degreeLevel = '',
      subject = '',
      maxTuitionUsd = '',
      maxCgpa = '',
      maxIelts = '',
      scholarshipOnly = '',
      deadlineBefore = '',
      intake = '',
      sort = 'deadline',
    } = req.query as Record<string, string>;

    const allUnis = await db.select().from(universities);
    const allProgs = await db.select().from(programmes);
    const allReqs = await db.select().from(programmeRequirements);

    const uniMap = new Map(allUnis.map((u) => [u.id, u]));
    const reqMap = new Map(allReqs.map((r) => [r.programmeId, r]));

    const qLower = q.trim().toLowerCase();
    const maxTuitionNum = maxTuitionUsd ? Number(maxTuitionUsd) : null;
    const maxCgpaNum = maxCgpa ? Number(maxCgpa) : null;
    const maxIeltsNum = maxIelts ? Number(maxIelts) : null;

    let items = allProgs
      .map((p) => ({
        ...p,
        university: uniMap.get(p.universityId)!,
        requirements: reqMap.get(p.id) ?? null,
      }))
      .filter((p) => {
        if (!p.university) return false;
        if (country && p.university.country.toLowerCase() !== country.toLowerCase()) return false;
        if (degreeLevel && p.degreeLevel.toLowerCase() !== degreeLevel.toLowerCase()) return false;
        if (
          subject &&
          !p.subjectArea.toLowerCase().includes(subject.toLowerCase()) &&
          !p.name.toLowerCase().includes(subject.toLowerCase())
        ) {
          return false;
        }
        if (qLower) {
          const hit =
            p.name.toLowerCase().includes(qLower) ||
            p.subjectArea.toLowerCase().includes(qLower) ||
            p.university.name.toLowerCase().includes(qLower) ||
            p.university.country.toLowerCase().includes(qLower);
          if (!hit) return false;
        }
        if (maxTuitionNum !== null && Number.isFinite(maxTuitionNum) && p.tuitionFeeUsdApprox > maxTuitionNum) {
          return false;
        }
        if (maxCgpaNum !== null && Number.isFinite(maxCgpaNum) && p.requirements?.minCgpa) {
          if (Number(p.requirements.minCgpa) > maxCgpaNum) return false;
        }
        if (maxIeltsNum !== null && Number.isFinite(maxIeltsNum) && p.requirements?.ieltsOverall) {
          if (Number(p.requirements.ieltsOverall) > maxIeltsNum) return false;
        }
        if (scholarshipOnly === 'true' && !p.scholarshipAvailability) return false;
        if (intake && !p.intake.toLowerCase().includes(intake.toLowerCase())) return false;
        if (deadlineBefore && p.applicationDeadline && p.applicationDeadline > deadlineBefore) {
          return false;
        }
        return true;
      });

    items.sort((a, b) => {
      if (sort === 'tuition_asc') return a.tuitionFeeUsdApprox - b.tuitionFeeUsdApprox;
      if (sort === 'tuition_desc') return b.tuitionFeeUsdApprox - a.tuitionFeeUsdApprox;
      if (sort === 'name') return a.name.localeCompare(b.name);
      return (a.applicationDeadline ?? '9999-12-31').localeCompare(b.applicationDeadline ?? '9999-12-31');
    });

    return res.json({ items, total: items.length });
  } catch (error) {
    console.error('Failed to search programmes:', error);
    return res.status(500).json({ error: 'Unable to fetch programmes.' });
  }
});

universitiesRouter.get('/programmes/:id', async (req, res) => {
  try {
    await ensureDatabaseSeeded();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid programme ID.' });

    const [programme] = await db.select().from(programmes).where(eq(programmes.id, id)).limit(1);
    if (!programme) return res.status(404).json({ error: 'Programme not found.' });

    const [university] = await db
      .select()
      .from(universities)
      .where(eq(universities.id, programme.universityId))
      .limit(1);
    const [requirements] = await db
      .select()
      .from(programmeRequirements)
      .where(eq(programmeRequirements.programmeId, id))
      .limit(1);

    return res.json({
      programme,
      university,
      requirements: requirements ?? null,
    });
  } catch (error) {
    console.error('Failed to fetch programme details:', error);
    return res.status(500).json({ error: 'Unable to load programme details.' });
  }
});
