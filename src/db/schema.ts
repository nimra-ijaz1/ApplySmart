import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. Users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  role: text('role').notNull().default('student'), // 'student' | 'admin' | 'super_admin'
  isActive: boolean('is_active').notNull().default(true),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Student Profiles
export const studentProfiles = pgTable('student_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  // Personal Information
  fullName: text('full_name'),
  nationality: text('nationality').default('Pakistan'),
  countryOfResidence: text('country_of_residence').default('Pakistan'),
  dateOfBirth: text('date_of_birth'),
  phoneNumber: text('phone_number'),
  // Academic Information
  currentOrCompletedDegree: text('current_or_completed_degree'), // e.g., Bachelor's, Master's, Intermediate/A-Levels
  degreeCompleted: boolean('degree_completed').default(true),
  degreeField: text('degree_field'),
  universityName: text('university_name'),
  universityCountry: text('university_country').default('Pakistan'),
  graduationYear: integer('graduation_year'),
  cgpa: numeric('cgpa', { precision: 4, scale: 2 }),
  cgpaScale: numeric('cgpa_scale', { precision: 4, scale: 2 }).default('4.00'),
  academicPercentage: numeric('academic_percentage', { precision: 5, scale: 2 }),
  completedCourses: jsonb('completed_courses').$type<string[]>().default([]),
  // Language Test Information
  ieltsOverall: numeric('ielts_overall', { precision: 3, scale: 1 }),
  ieltsListening: numeric('ielts_listening', { precision: 3, scale: 1 }),
  ieltsReading: numeric('ielts_reading', { precision: 3, scale: 1 }),
  ieltsWriting: numeric('ielts_writing', { precision: 3, scale: 1 }),
  ieltsSpeaking: numeric('ielts_speaking', { precision: 3, scale: 1 }),
  toeflScore: integer('toefl_score'),
  duolingoScore: integer('duolingo_score'),
  otherLanguageTestName: text('other_language_test_name'),
  otherLanguageTestScore: text('other_language_test_score'),
  languageTestDate: text('language_test_date'),
  languageTestValidityDate: text('language_test_validity_date'),
  // Study Preferences
  desiredDegreeLevel: text('desired_degree_level'), // Bachelor's | Master's | PhD
  preferredStudyProgrammes: jsonb('preferred_study_programmes').$type<string[]>().default([]),
  preferredCountries: jsonb('preferred_countries').$type<string[]>().default([]),
  preferredIntake: text('preferred_intake'),
  maxTuitionBudgetUsd: integer('max_tuition_budget_usd'),
  scholarshipPreference: text('scholarship_preference').default('preferred'), // required | preferred | self_funded
  preferredStudyMode: text('preferred_study_mode').default('on_campus'), // on_campus | hybrid | online
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Universities
export const universities = pgTable('universities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  city: text('city').notNull(),
  officialWebsite: text('official_website').notNull(),
  logoUrl: text('logo_url'),
  description: text('description').notNull(),
  institutionType: text('institution_type').notNull().default('Public'), // Public | Private
  globalRanking: integer('global_ranking'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  sourceUrl: text('source_url').notNull(),
  lastVerifiedDate: text('last_verified_date').notNull(),
  verificationStatus: text('verification_status').notNull().default('verified'), // verified | pending_verification | outdated
  isDemoRecord: boolean('is_demo_record').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Programmes
export const programmes = pgTable('programmes', {
  id: serial('id').primaryKey(),
  universityId: integer('university_id')
    .references(() => universities.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  degreeLevel: text('degree_level').notNull(), // Bachelor's | Master's | PhD
  subjectArea: text('subject_area').notNull(),
  description: text('description').notNull(),
  duration: text('duration').notNull(),
  studyLanguage: text('study_language').notNull().default('English'),
  tuitionFee: integer('tuition_fee').notNull(),
  currency: text('currency').notNull().default('USD'),
  tuitionFeeUsdApprox: integer('tuition_fee_usd_approx').notNull(),
  applicationFee: integer('application_fee').notNull().default(0),
  applicationOpeningDate: text('application_opening_date'),
  applicationDeadline: text('application_deadline'),
  intake: text('intake').notNull(),
  scholarshipAvailability: boolean('scholarship_availability').notNull().default(false),
  officialProgrammeUrl: text('official_programme_url').notNull(),
  sourceUrl: text('source_url').notNull(),
  lastVerifiedDate: text('last_verified_date').notNull(),
  verificationStatus: text('verification_status').notNull().default('verified'),
  isDemoRecord: boolean('is_demo_record').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. Programme Requirements
export const programmeRequirements = pgTable('programme_requirements', {
  id: serial('id').primaryKey(),
  programmeId: integer('programme_id')
    .references(() => programmes.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  minCgpa: numeric('min_cgpa', { precision: 4, scale: 2 }),
  cgpaScale: numeric('cgpa_scale', { precision: 4, scale: 2 }).default('4.00'),
  minPercentage: numeric('min_percentage', { precision: 5, scale: 2 }),
  requiredDegreeBackground: text('required_degree_background').notNull(),
  acceptedDegreeFields: jsonb('accepted_degree_fields').$type<string[]>().default([]),
  prerequisiteSubjects: jsonb('prerequisite_subjects').$type<string[]>().default([]),
  requiresCompletedDegree: boolean('requires_completed_degree').notNull().default(true),
  ieltsOverall: numeric('ielts_overall', { precision: 3, scale: 1 }),
  ieltsListening: numeric('ielts_listening', { precision: 3, scale: 1 }),
  ieltsReading: numeric('ielts_reading', { precision: 3, scale: 1 }),
  ieltsWriting: numeric('ielts_writing', { precision: 3, scale: 1 }),
  ieltsSpeaking: numeric('ielts_speaking', { precision: 3, scale: 1 }),
  toeflMin: integer('toefl_min'),
  duolingoMin: integer('duolingo_min'),
  otherLanguageRequirements: text('other_language_requirements'),
  requiredDocuments: jsonb('required_documents').$type<string[]>().default([]),
  gpaConversionNote: text('gpa_conversion_note'),
  additionalConditions: text('additional_conditions'),
  sourceUrl: text('source_url').notNull(),
  lastVerifiedDate: text('last_verified_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6. Scholarships
export const scholarships = pgTable('scholarships', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  provider: text('provider').notNull(),
  country: text('country').notNull(),
  fundingType: text('funding_type').notNull().default('full'), // full | partial
  fundingPercentage: integer('funding_percentage'),
  tuitionCoverage: text('tuition_coverage').notNull(),
  monthlyStipend: text('monthly_stipend'),
  travelAllowance: text('travel_allowance'),
  accommodationCoverage: text('accommodation_coverage'),
  eligibilityRequirements: text('eligibility_requirements').notNull(),
  requiredDocuments: jsonb('required_documents').$type<string[]>().default([]),
  applicationOpeningDate: text('application_opening_date'),
  applicationDeadline: text('application_deadline'),
  officialUrl: text('official_url').notNull(),
  sourceUrl: text('source_url').notNull(),
  lastVerifiedDate: text('last_verified_date').notNull(),
  verificationStatus: text('verification_status').notNull().default('verified'),
  isDemoRecord: boolean('is_demo_record').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 7. Scholarship Eligibility
export const scholarshipEligibility = pgTable('scholarship_eligibility', {
  id: serial('id').primaryKey(),
  scholarshipId: integer('scholarship_id')
    .references(() => scholarships.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  eligibleNationalities: jsonb('eligible_nationalities').$type<string[]>().default([]),
  eligibleDegreeLevels: jsonb('eligible_degree_levels').$type<string[]>().default([]),
  eligibleProgrammes: jsonb('eligible_programmes').$type<string[]>().default([]),
  minCgpa: numeric('min_cgpa', { precision: 4, scale: 2 }),
  cgpaScale: numeric('cgpa_scale', { precision: 4, scale: 2 }).default('4.00'),
  minIelts: numeric('min_ielts', { precision: 3, scale: 1 }),
  notes: text('notes'),
});

// 8. Student Shortlists (universities, programmes, or scholarships)
export const studentShortlists = pgTable(
  'student_shortlists',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    itemType: text('item_type').notNull(), // 'university' | 'programme' | 'scholarship'
    universityId: integer('university_id').references(() => universities.id, { onDelete: 'cascade' }),
    programmeId: integer('programme_id').references(() => programmes.id, { onDelete: 'cascade' }),
    scholarshipId: integer('scholarship_id').references(() => scholarships.id, { onDelete: 'cascade' }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('shortlist_unique_idx').on(t.userId, t.itemType, t.universityId, t.programmeId, t.scholarshipId),
  ]
);

// 9. Eligibility Checks History
export const eligibilityChecks = pgTable('eligibility_checks', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  programmeId: integer('programme_id')
    .references(() => programmes.id, { onDelete: 'cascade' })
    .notNull(),
  overallStatus: text('overall_status').notNull(), // meets_requirements | does_not_meet | needs_manual_verification | insufficient_information
  criteriaBreakdown: jsonb('criteria_breakdown').$type<any[]>().notNull(),
  aiExplanation: text('ai_explanation'),
  profileSnapshot: jsonb('profile_snapshot').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Applications
export const applications = pgTable('applications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  universityId: integer('university_id')
    .references(() => universities.id, { onDelete: 'cascade' })
    .notNull(),
  programmeId: integer('programme_id')
    .references(() => programmes.id, { onDelete: 'cascade' })
    .notNull(),
  status: text('status').notNull().default('Interested'),
  applicationDeadline: text('application_deadline'),
  applicationFee: integer('application_fee'),
  currency: text('currency').default('USD'),
  submissionDate: text('submission_date'),
  portalUrl: text('portal_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 11. Application Status History
export const applicationStatusHistory = pgTable('application_status_history', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id')
    .references(() => applications.id, { onDelete: 'cascade' })
    .notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  note: text('note'),
  changedByUserId: integer('changed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Documents
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  category: text('category').notNull(),
  title: text('title').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  fileDataBase64: text('file_data_base64'), // Stored privately in DB or filesystem path for reliable sandbox downloads
  extractedText: text('extracted_text'),
  description: text('description'),
  expirationDate: text('expiration_date'),
  aiAnalysis: jsonb('ai_analysis').$type<Record<string, any>>(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 13. Application Documents Junction
export const applicationDocuments = pgTable(
  'application_documents',
  {
    id: serial('id').primaryKey(),
    applicationId: integer('application_id')
      .references(() => applications.id, { onDelete: 'cascade' })
      .notNull(),
    documentId: integer('document_id')
      .references(() => documents.id, { onDelete: 'cascade' })
      .notNull(),
    attachedAt: timestamp('attached_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('app_doc_unique_idx').on(t.applicationId, t.documentId)]
);

// 14. Reminders & Calendar Events
export const reminders = pgTable('reminders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  category: text('category').notNull().default('personal'), // application_opening | application_deadline | scholarship_deadline | ielts_test | document_submission | personal
  dueDate: text('due_date').notNull(), // YYYY-MM-DD
  notes: text('notes'),
  isCompleted: boolean('is_completed').notNull().default(false),
  emailNotification: boolean('email_notification').notNull().default(false),
  relatedUniversityId: integer('related_university_id').references(() => universities.id, { onDelete: 'set null' }),
  relatedProgrammeId: integer('related_programme_id').references(() => programmes.id, { onDelete: 'set null' }),
  relatedScholarshipId: integer('related_scholarship_id').references(() => scholarships.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 15. AI Conversations
export const aiConversations = pgTable('ai_conversations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull().default('New Study Abroad Chat'),
  includeProfileContext: boolean('include_profile_context').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 16. AI Messages
export const aiMessages = pgTable('ai_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id')
    .references(() => aiConversations.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  sources: jsonb('sources').$type<{ title: string; url: string }[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 17. Data Sources
export const dataSources = pgTable('data_sources', {
  id: serial('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'university' | 'programme' | 'scholarship'
  entityId: integer('entity_id').notNull(),
  sourceUrl: text('source_url').notNull(),
  verificationStatus: text('verification_status').notNull().default('pending_verification'),
  verifiedByUserId: integer('verified_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  lastVerifiedDate: text('last_verified_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Admin Audit Logs
export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  actorEmail: text('actor_email'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id'),
  details: jsonb('details').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. System Settings (Super Admin)
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').$type<Record<string, any>>().notNull(),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 20. Recently Viewed Universities (for dynamic student dashboard)
export const recentlyViewed = pgTable(
  'recently_viewed',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    universityId: integer('university_id')
      .references(() => universities.id, { onDelete: 'cascade' })
      .notNull(),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('recently_viewed_unique_idx').on(t.userId, t.universityId)]
);

// 21. Contact Inquiries (Public contact form)
export const contactInquiries = pgTable('contact_inquiries', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(studentProfiles, {
    fields: [users.id],
    references: [studentProfiles.userId],
  }),
  shortlists: many(studentShortlists),
  applications: many(applications),
  documents: many(documents),
  reminders: many(reminders),
  eligibilityChecks: many(eligibilityChecks),
}));

export const universitiesRelations = relations(universities, ({ many }) => ({
  programmes: many(programmes),
}));

export const programmesRelations = relations(programmes, ({ one }) => ({
  university: one(universities, {
    fields: [programmes.universityId],
    references: [universities.id],
  }),
  requirements: one(programmeRequirements, {
    fields: [programmes.id],
    references: [programmeRequirements.programmeId],
  }),
}));

export const scholarshipsRelations = relations(scholarships, ({ one }) => ({
  eligibility: one(scholarshipEligibility, {
    fields: [scholarships.id],
    references: [scholarshipEligibility.scholarshipId],
  }),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(users, { fields: [applications.userId], references: [users.id] }),
  university: one(universities, { fields: [applications.universityId], references: [universities.id] }),
  programme: one(programmes, { fields: [applications.programmeId], references: [programmes.id] }),
  history: many(applicationStatusHistory),
  attachedDocuments: many(applicationDocuments),
}));
