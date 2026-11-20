import 'dotenv/config';
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, inArray, like } from 'drizzle-orm';

const runSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const TEST_USERS = {
  student1: {
    token: 'qa-token-student-1',
    uid: `qa-uid-student-1-${runSuffix}`,
    email: `qa-student-1-${runSuffix}@example.com`,
    name: 'QA Student One',
  },
  student2: {
    token: 'qa-token-student-2',
    uid: `qa-uid-student-2-${runSuffix}`,
    email: `qa-student-2-${runSuffix}@example.com`,
    name: 'QA Student Two',
  },
  admin: {
    token: 'qa-token-admin',
    uid: `qa-uid-admin-${runSuffix}`,
    email: `qa-admin-${runSuffix}@example.com`,
    name: 'QA Admin',
  },
  superAdmin: {
    token: 'qa-token-super-admin',
    uid: `qa-uid-super-admin-${runSuffix}`,
    email: `qa-super-admin-${runSuffix}@example.com`,
    name: 'QA Super Admin',
  },
};

vi.mock('../src/lib/firebase-admin.ts', () => ({
  adminAuth: {
    verifyIdToken: vi.fn(async (token: string) => {
      const match = Object.values(TEST_USERS).find((u) => u.token === token);
      if (!match) {
        throw new Error('Invalid Firebase ID token');
      }
      return {
        uid: match.uid,
        email: match.email,
        name: match.name,
      };
    }),
  },
}));

import { db } from '../src/db/index.ts';
import {
  adminAuditLogs,
  dataSources,
  universities,
  users,
} from '../src/db/schema.ts';
import { createApiApp } from '../src/server/app.ts';

let server: http.Server;
let baseUrl = '';
const createdUserIds: number[] = [];
const createdUniIds: number[] = [];
let sampleProgrammeId = 0;
let sampleUniversityId = 0;
let sampleScholarshipId = 0;

async function apiJson(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<{ status: number; headers: Headers; body: any }> {
  const headers = new Headers(options.headers || {});
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, headers: res.headers, body };
}

describe('ApplySmart API & Security Integration Suite', () => {
  beforeAll(async () => {
    const app = createApiApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    // Bootstrap test users and elevate admin/superAdmin roles
    const s1 = await apiJson('/api/profile', { token: TEST_USERS.student1.token });
    const s2 = await apiJson('/api/profile', { token: TEST_USERS.student2.token });
    const adm = await apiJson('/api/profile', { token: TEST_USERS.admin.token });
    const sup = await apiJson('/api/profile', { token: TEST_USERS.superAdmin.token });

    createdUserIds.push(s1.body.user.id, s2.body.user.id, adm.body.user.id, sup.body.user.id);

    await db.update(users).set({ role: 'admin' }).where(eq(users.id, adm.body.user.id));
    await db.update(users).set({ role: 'super_admin' }).where(eq(users.id, sup.body.user.id));

    // Fetch seeded catalog IDs for tests
    const unisRes = await apiJson('/api/universities?limit=10');
    sampleUniversityId = unisRes.body.items[0].id;
    sampleProgrammeId = unisRes.body.items[0].programmes[0].id;

    const schRes = await apiJson('/api/scholarships');
    sampleScholarshipId = schRes.body.items[0].id;
  }, 30000);

  afterAll(async () => {
    if (createdUniIds.length > 0) {
      await db.delete(universities).where(inArray(universities.id, createdUniIds));
      await db.delete(dataSources).where(inArray(dataSources.entityId, createdUniIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(adminAuditLogs).where(inArray(adminAuditLogs.actorUserId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    await db.delete(universities).where(like(universities.name, `%QA Test University ${runSuffix}%`));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }, 30000);

  describe('1. Authentication, Protected Routes, RBAC & Security Headers', () => {
    it('returns security headers and omits X-Powered-By', async () => {
      const res = await apiJson('/api/health');
      expect(res.status).toBe(200);
      expect(res.headers.get('x-powered-by')).toBeNull();
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    });

    it('rejects unauthenticated and invalid Bearer requests on protected routes with 401', async () => {
      for (const route of ['/api/profile', '/api/applications', '/api/documents', '/api/reminders', '/api/shortlist']) {
        const unauth = await apiJson(route);
        expect(unauth.status).toBe(401);

        const invalid = await apiJson(route, { token: 'bad-token' });
        expect(invalid.status).toBe(401);
      }
    });

    it('blocks student role from admin endpoints (403)', async () => {
      const res = await apiJson('/api/admin/overview', { token: TEST_USERS.student1.token });
      expect(res.status).toBe(403);
    });

    it('prevents regular admin from accessing super_admin audit-logs, settings, or role changes', async () => {
      const auditRes = await apiJson('/api/admin/audit-logs', { token: TEST_USERS.admin.token });
      expect(auditRes.status).toBe(403);

      const settingsRes = await apiJson('/api/admin/settings', { token: TEST_USERS.admin.token });
      expect(settingsRes.status).toBe(403);

      const s2Profile = await apiJson('/api/profile', { token: TEST_USERS.student2.token });
      const roleRes = await apiJson(`/api/admin/users/${s2Profile.body.user.id}`, {
        method: 'PUT',
        token: TEST_USERS.admin.token,
        body: JSON.stringify({ role: 'admin' }),
      });
      expect(roleRes.status).toBe(403);

      const supProfile = await apiJson('/api/profile', { token: TEST_USERS.superAdmin.token });
      const suspendSupRes = await apiJson(`/api/admin/users/${supProfile.body.user.id}`, {
        method: 'PUT',
        token: TEST_USERS.admin.token,
        body: JSON.stringify({ isActive: false }),
      });
      expect(suspendSupRes.status).toBe(403);
    });

    it('allows super_admin to suspend a user and blocks suspended user access (403)', async () => {
      const s2Profile = await apiJson('/api/profile', { token: TEST_USERS.student2.token });
      const suspendRes = await apiJson(`/api/admin/users/${s2Profile.body.user.id}`, {
        method: 'PUT',
        token: TEST_USERS.superAdmin.token,
        body: JSON.stringify({ isActive: false }),
      });
      expect(suspendRes.status).toBe(200);

      const blockedRes = await apiJson('/api/profile', { token: TEST_USERS.student2.token });
      expect(blockedRes.status).toBe(403);

      // Re-enable for subsequent isolation tests
      const reactivateRes = await apiJson(`/api/admin/users/${s2Profile.body.user.id}`, {
        method: 'PUT',
        token: TEST_USERS.superAdmin.token,
        body: JSON.stringify({ isActive: true }),
      });
      expect(reactivateRes.status).toBe(200);
    });
  });

  describe('2. Student Profile CRUD & Validation', () => {
    it('rejects cgpa > cgpaScale on full and partial updates and rejects invalid ISO calendar dates', async () => {
      const badCgpa = await apiJson('/api/profile', {
        method: 'PUT',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({ cgpa: 4.5, cgpaScale: 4.0 }),
      });
      expect(badCgpa.status).toBe(400);

      const badDate = await apiJson('/api/profile', {
        method: 'PUT',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({ dateOfBirth: '2026-02-31' }),
      });
      expect(badDate.status).toBe(400);
    });

    it('persists valid student profile data and prevents partial CGPA exceeding stored scale', async () => {
      const updateRes = await apiJson('/api/profile', {
        method: 'PUT',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({
          fullName: 'Nimra QA',
          nationality: 'Pakistan',
          currentOrCompletedDegree: "Bachelor's",
          degreeField: 'Computer Science',
          cgpa: 3.72,
          cgpaScale: 4.0,
          completedCourses: ['Algorithms', 'Data Structures', 'Operating Systems'],
          ieltsOverall: 7.0,
          ieltsListening: 7.5,
          ieltsReading: 7.0,
          ieltsWriting: 6.5,
          ieltsSpeaking: 7.0,
          languageTestDate: '2026-01-15',
          languageTestValidityDate: '2028-01-15',
          onboardingCompleted: true,
        }),
      });
      expect(updateRes.status).toBe(200);

      const partialBad = await apiJson('/api/profile', {
        method: 'PUT',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({ cgpa: 4.3 }),
      });
      expect(partialBad.status).toBe(400);

      const fetched = await apiJson('/api/profile', { token: TEST_USERS.student1.token });
      expect(fetched.status).toBe(200);
      expect(fetched.body.user.onboardingCompleted).toBe(true);
      expect(Number(fetched.body.profile.cgpa)).toBeCloseTo(3.72, 2);
      expect(Number(fetched.body.profile.ieltsOverall)).toBeCloseTo(7.0, 1);
    });
  });

  describe('3. University Finder Search, Filters & Sorting', () => {
    it('supports keyword search, country/degree/tuition filters, sorting, and 400/404 handling', async () => {
      const allRes = await apiJson('/api/universities?sort=tuition_asc');
      expect(allRes.status).toBe(200);
      expect(allRes.body.items.length).toBeGreaterThan(0);
      expect(Array.isArray(allRes.body.facets.countries)).toBe(true);

      const germanyRes = await apiJson('/api/universities?country=Germany&degreeLevel=Master%27s');
      expect(germanyRes.status).toBe(200);
      expect(germanyRes.body.items.every((u: any) => u.country === 'Germany')).toBe(true);

      const missingUni = await apiJson('/api/universities/999999');
      expect(missingUni.status).toBe(404);

      const badId = await apiJson('/api/universities/not-an-id');
      expect(badId.status).toBe(400);
    });
  });

  describe('4. Eligibility Checker & Required Documents Checker', () => {
    it('evaluates eligibility cleanly, validates what-if bounds, and returns document checklist', async () => {
      const checkRes = await apiJson('/api/eligibility/check', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({
          programmeId: sampleProgrammeId,
          includeAiExplanation: false,
        }),
      });
      expect(checkRes.status).toBe(200);
      expect(['meets_requirements', 'does_not_meet', 'needs_manual_verification', 'insufficient_information']).toContain(
        checkRes.body.evaluation.overallStatus
      );
      expect(checkRes.body.documentCheck).toBeDefined();

      // What-if failure with low IELTS Writing despite high overall
      const failBandRes = await apiJson('/api/eligibility/check', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({
          programmeId: sampleProgrammeId,
          includeAiExplanation: false,
          overrideProfile: {
            cgpa: 3.9,
            cgpaScale: 4.0,
            ieltsOverall: 7.5,
            ieltsWriting: 4.5,
          },
        }),
      });
      expect(failBandRes.status).toBe(200);
      expect(failBandRes.body.evaluation.overallStatus).toBe('does_not_meet');

      // What-if validation rejects cgpa > cgpaScale
      const badWhatIf = await apiJson('/api/eligibility/check', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({
          programmeId: sampleProgrammeId,
          overrideProfile: { cgpa: 4.8, cgpaScale: 4.0 },
        }),
      });
      expect(badWhatIf.status).toBe(400);

      // Required documents checklist endpoint checks
      const badProgChecklist = await apiJson('/api/documents/checklist?programmeId=abc', {
        token: TEST_USERS.student1.token,
      });
      expect(badProgChecklist.status).toBe(400);

      const missingProgChecklist = await apiJson('/api/documents/checklist?programmeId=999999', {
        token: TEST_USERS.student1.token,
      });
      expect(missingProgChecklist.status).toBe(404);

      const validChecklist = await apiJson(`/api/documents/checklist?programmeId=${sampleProgrammeId}`, {
        token: TEST_USERS.student1.token,
      });
      expect(validChecklist.status).toBe(200);
      expect(validChecklist.body.mode).toBe('single');
      expect(validChecklist.body.overallSummary.totalRequired).toBeGreaterThan(0);
    });
  });

  describe('5. Scholarships & Shortlist Integrity', () => {
    it('returns scholarship facets and enforces shortlist validation, deduplication & ownership', async () => {
      const schRes = await apiJson('/api/scholarships?nationality=Pakistan');
      expect(schRes.status).toBe(200);
      expect(schRes.body.items.length).toBeGreaterThan(0);
      expect(Array.isArray(schRes.body.facets?.countries)).toBe(true);

      // Missing universityId for itemType='university'
      const missingField = await apiJson('/api/shortlist', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({ itemType: 'university' }),
      });
      expect(missingField.status).toBe(400);

      // Nonexistent target
      const missingTarget = await apiJson('/api/shortlist', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({ itemType: 'university', universityId: 999999 }),
      });
      expect(missingTarget.status).toBe(404);

      // Create & deduplicate scholarship shortlist
      const saveSch1 = await apiJson(`/api/scholarships/${sampleScholarshipId}/save`, {
        method: 'POST',
        token: TEST_USERS.student1.token,
      });
      expect(saveSch1.status).toBe(201);

      const saveSchDup = await apiJson(`/api/scholarships/${sampleScholarshipId}/save`, {
        method: 'POST',
        token: TEST_USERS.student1.token,
      });
      expect(saveSchDup.status).toBe(200);
      expect(saveSchDup.body.alreadySaved).toBe(true);

      const shortlistId = saveSch1.body.item.id;

      // Student 2 cannot delete Student 1's shortlist item
      const crossDelete = await apiJson(`/api/shortlist/${shortlistId}`, {
        method: 'DELETE',
        token: TEST_USERS.student2.token,
      });
      expect(crossDelete.status).toBe(404);

      const ownerDelete = await apiJson(`/api/shortlist/${shortlistId}`, {
        method: 'DELETE',
        token: TEST_USERS.student1.token,
      });
      expect(ownerDelete.status).toBe(200);
    });
  });

  describe('6. Application Tracker CRUD, Status History & Isolation', () => {
    it('enforces university/programme match, records status transitions, isolates users, and deletes cleanly', async () => {
      const mismatchRes = await apiJson('/api/applications', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({
          universityId: sampleUniversityId + 99999,
          programmeId: sampleProgrammeId,
        }),
      });
      expect(mismatchRes.status).toBe(400);

      const createRes = await apiJson('/api/applications', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({
          universityId: sampleUniversityId,
          programmeId: sampleProgrammeId,
        }),
      });
      expect(createRes.status).toBe(201);
      const appId = createRes.body.application.id;

      const updateRes = await apiJson(`/api/applications/${appId}`, {
        method: 'PUT',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({ status: 'Rejected', notes: 'QA transition test' }),
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.application.status).toBe('Rejected');

      const detailRes = await apiJson(`/api/applications/${appId}`, {
        token: TEST_USERS.student1.token,
      });
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.history.some((h: any) => h.toStatus === 'Rejected')).toBe(true);

      // Cross-user isolation
      const s2Get = await apiJson(`/api/applications/${appId}`, { token: TEST_USERS.student2.token });
      expect(s2Get.status).toBe(404);
      const s2Del = await apiJson(`/api/applications/${appId}`, {
        method: 'DELETE',
        token: TEST_USERS.student2.token,
      });
      expect(s2Del.status).toBe(404);

      const delRes = await apiJson(`/api/applications/${appId}`, {
        method: 'DELETE',
        token: TEST_USERS.student1.token,
      });
      expect(delRes.status).toBe(200);

      const delAgain = await apiJson(`/api/applications/${appId}`, {
        method: 'DELETE',
        token: TEST_USERS.student1.token,
      });
      expect(delAgain.status).toBe(404);
    });
  });

  describe('7. Document Manager Upload, Validation, Download & Isolation', () => {
    it('rejects empty/disallowed files & invalid expiration dates, enforces owner-only download & delete', async () => {
      // Empty file
      const emptyFd = new FormData();
      emptyFd.append('file', new File([], 'empty.txt', { type: 'text/plain' }));
      const emptyRes = await apiJson('/api/documents/upload', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: emptyFd,
      });
      expect(emptyRes.status).toBe(400);

      // Disallowed MIME type
      const badMimeFd = new FormData();
      badMimeFd.append('file', new File(['MZ'], 'evil.exe', { type: 'application/x-msdownload' }));
      const badMimeRes = await apiJson('/api/documents/upload', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: badMimeFd,
      });
      expect(badMimeRes.status).toBe(400);

      // Invalid expiration date
      const badExpFd = new FormData();
      badExpFd.append('file', new File(['Transcript data'], 'transcript.txt', { type: 'text/plain' }));
      badExpFd.append('title', 'Test Transcript');
      badExpFd.append('category', 'Academic transcripts');
      badExpFd.append('expirationDate', '2026-02-30');
      const badExpRes = await apiJson('/api/documents/upload', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: badExpFd,
      });
      expect(badExpRes.status).toBe(400);

      // Valid upload
      const validFd = new FormData();
      validFd.append('file', new File(['Verified Academic Transcript'], 'transcript.txt', { type: 'text/plain' }));
      validFd.append('title', 'Verified BS Transcript');
      validFd.append('category', 'Academic transcripts');
      const uploadRes = await apiJson('/api/documents/upload', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: validFd,
      });
      expect(uploadRes.status).toBe(201);
      const docId = uploadRes.body.document.id;

      // Cross-user download/delete blocked
      const s2Download = await apiJson(`/api/documents/${docId}/download`, {
        token: TEST_USERS.student2.token,
      });
      expect(s2Download.status).toBe(404);
      const s2Delete = await apiJson(`/api/documents/${docId}`, {
        method: 'DELETE',
        token: TEST_USERS.student2.token,
      });
      expect(s2Delete.status).toBe(404);

      // Owner download works with nosniff
      const downloadRes = await apiJson(`/api/documents/${docId}/download`, {
        token: TEST_USERS.student1.token,
      });
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers.get('x-content-type-options')).toBe('nosniff');
      expect(downloadRes.body).toBe('Verified Academic Transcript');

      // Owner delete
      const deleteRes = await apiJson(`/api/documents/${docId}`, {
        method: 'DELETE',
        token: TEST_USERS.student1.token,
      });
      expect(deleteRes.status).toBe(200);
    });
  });

  describe('8. Deadline Calendar Reminders & Validation', () => {
    it('rejects invalid calendar dates, supports create/update/delete, and enforces isolation', async () => {
      const badReminder = await apiJson('/api/reminders', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({
          title: 'Invalid Date Test',
          category: 'personal',
          dueDate: '2026-02-31',
        }),
      });
      expect(badReminder.status).toBe(400);

      const createRes = await apiJson('/api/reminders', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({
          title: 'Submit TUM VPD',
          category: 'document_submission',
          dueDate: '2026-12-15',
          notes: 'Before winter deadline',
        }),
      });
      expect(createRes.status).toBe(201);
      const remId = createRes.body.reminder.id;

      const updateRes = await apiJson(`/api/reminders/${remId}`, {
        method: 'PUT',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({ isCompleted: true, title: 'Submitted TUM VPD' }),
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.reminder.isCompleted).toBe(true);

      const s2Delete = await apiJson(`/api/reminders/${remId}`, {
        method: 'DELETE',
        token: TEST_USERS.student2.token,
      });
      expect(s2Delete.status).toBe(404);

      const ownerDelete = await apiJson(`/api/reminders/${remId}`, {
        method: 'DELETE',
        token: TEST_USERS.student1.token,
      });
      expect(ownerDelete.status).toBe(200);

      const delAgain = await apiJson(`/api/reminders/${remId}`, {
        method: 'DELETE',
        token: TEST_USERS.student1.token,
      });
      expect(delAgain.status).toBe(404);
    });
  });

  describe('9. AI Assistant Error Handling & Safeguards', () => {
    it('handles unconfigured GEMINI_API_KEY without orphan conversations and validates AI endpoints', async () => {
      const statusRes = await apiJson('/api/ai/status', { token: TEST_USERS.student1.token });
      expect(statusRes.status).toBe(200);
      expect(typeof statusRes.body.aiConfigured).toBe('boolean');

      if (!statusRes.body.aiConfigured) {
        const chatRes = await apiJson('/api/ai/chat', {
          method: 'POST',
          token: TEST_USERS.student1.token,
          body: JSON.stringify({ message: 'Which German universities fit my CGPA?' }),
        });
        expect(chatRes.status).toBe(503);

        const convsRes = await apiJson('/api/ai/conversations', { token: TEST_USERS.student1.token });
        expect(convsRes.status).toBe(200);
        expect(convsRes.body.items.length).toBe(0);
      }

      const badDocAnalyze = await apiJson('/api/ai/analyze-document', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({ documentId: 'not-a-number' }),
      });
      expect(badDocAnalyze.status).toBe(400);

      const badCompare = await apiJson('/api/ai/compare-programmes', {
        method: 'POST',
        token: TEST_USERS.student1.token,
        body: JSON.stringify({ programmeIds: [sampleProgrammeId] }),
      });
      expect(badCompare.status).toBe(400);
    });
  });

  describe('10. Admin Catalog CRUD, CSV Bulk Upload & Audit Logs', () => {
    it('rejects missing FK university on programme creation, processes CSV upload, and records audit logs', async () => {
      const badProg = await apiJson('/api/admin/programmes', {
        method: 'POST',
        token: TEST_USERS.admin.token,
        body: JSON.stringify({
          universityId: 999999,
          name: 'Invalid FK Programme',
          degreeLevel: "Master's",
          subjectArea: 'Computer Science',
          description: 'Test programme with nonexistent university foreign key.',
          duration: '2 years',
          tuitionFee: 0,
          currency: 'EUR',
          tuitionFeeUsdApprox: 0,
          intake: 'Fall 2026',
          officialProgrammeUrl: 'https://example.edu/prog',
          sourceUrl: 'https://example.edu/prog',
          lastVerifiedDate: '2026-10-15',
          requiredDegreeBackground: "4-year Bachelor's",
        }),
      });
      expect(badProg.status).toBe(404);

      const uniName = `QA Test University ${runSuffix}`;
      const csvBody =
        'name,country,city,official_website,institution_type,global_ranking,contact_email,description,source_url,last_verified_date,verification_status\n' +
        `${uniName},Germany,Bonn,https://qa-test-${runSuffix}.example.edu,Public,199,info@example.edu,"QA automated CSV test university record.",https://qa-test-${runSuffix}.example.edu/admissions,2026-10-15,pending_verification`;

      const validateFd = new FormData();
      validateFd.append('file', new File([csvBody], 'qa_unis.csv', { type: 'text/csv' }));
      validateFd.append('entityType', 'universities');
      validateFd.append('mode', 'validate');

      const validateRes = await apiJson('/api/admin/bulk-upload', {
        method: 'POST',
        token: TEST_USERS.admin.token,
        body: validateFd,
      });
      expect(validateRes.status).toBe(200);
      expect(validateRes.body.report.summary.validRows).toBe(1);

      const commitFd = new FormData();
      commitFd.append('file', new File([csvBody], 'qa_unis.csv', { type: 'text/csv' }));
      commitFd.append('entityType', 'universities');
      commitFd.append('mode', 'commit');

      const commitRes = await apiJson('/api/admin/bulk-upload', {
        method: 'POST',
        token: TEST_USERS.admin.token,
        body: commitFd,
      });
      expect(commitRes.status).toBe(201);
      expect(commitRes.body.commitResult.importedCount).toBe(1);
      const createdId = commitRes.body.commitResult.createdIds[0];
      createdUniIds.push(createdId);

      // Verify persistence in public search and super_admin audit logs
      const searchRes = await apiJson(`/api/universities?q=${encodeURIComponent(uniName)}`);
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.items.some((u: any) => u.id === createdId)).toBe(true);

      const logsRes = await apiJson('/api/admin/audit-logs', {
        token: TEST_USERS.superAdmin.token,
      });
      expect(logsRes.status).toBe(200);
      expect(logsRes.body.items.some((l: any) => l.action === 'CSV_BULK_UPLOAD_UNIVERSITIES')).toBe(true);

      // Clean up test university via admin DELETE
      const delUniRes = await apiJson(`/api/admin/universities/${createdId}`, {
        method: 'DELETE',
        token: TEST_USERS.admin.token,
      });
      expect(delUniRes.status).toBe(200);
    });
  });
});
