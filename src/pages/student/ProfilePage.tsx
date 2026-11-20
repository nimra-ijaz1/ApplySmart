import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch } from '../../lib/api.ts';
import { GENERATED_IMAGES } from '../../lib/utils.ts';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Input, Label, Select } from '../../components/ui/input.tsx';

export function ProfilePage() {
  const { dbUser, profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    nationality: 'Pakistan',
    countryOfResidence: 'Pakistan',
    dateOfBirth: '',
    phoneNumber: '',
    currentOrCompletedDegree: "Bachelor's",
    degreeCompleted: true,
    degreeField: '',
    universityName: '',
    universityCountry: 'Pakistan',
    graduationYear: '',
    cgpa: '',
    cgpaScale: '4.00',
    academicPercentage: '',
    completedCoursesText: '',
    ieltsOverall: '',
    ieltsListening: '',
    ieltsReading: '',
    ieltsWriting: '',
    ieltsSpeaking: '',
    toeflScore: '',
    duolingoScore: '',
    otherLanguageTestName: '',
    otherLanguageTestScore: '',
    languageTestDate: '',
    languageTestValidityDate: '',
    desiredDegreeLevel: "Master's",
    preferredProgrammesText: '',
    preferredCountriesText: '',
    preferredIntake: '',
    maxTuitionBudgetUsd: '',
    scholarshipPreference: 'preferred',
    preferredStudyMode: 'on_campus',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName || dbUser?.fullName || '',
        nationality: profile.nationality || 'Pakistan',
        countryOfResidence: profile.countryOfResidence || 'Pakistan',
        dateOfBirth: profile.dateOfBirth || '',
        phoneNumber: profile.phoneNumber || '',
        currentOrCompletedDegree: profile.currentOrCompletedDegree || "Bachelor's",
        degreeCompleted: profile.degreeCompleted ?? true,
        degreeField: profile.degreeField || '',
        universityName: profile.universityName || '',
        universityCountry: profile.universityCountry || 'Pakistan',
        graduationYear: profile.graduationYear ? String(profile.graduationYear) : '',
        cgpa: profile.cgpa || '',
        cgpaScale: profile.cgpaScale || '4.00',
        academicPercentage: profile.academicPercentage || '',
        completedCoursesText: (profile.completedCourses || []).join(', '),
        ieltsOverall: profile.ieltsOverall || '',
        ieltsListening: profile.ieltsListening || '',
        ieltsReading: profile.ieltsReading || '',
        ieltsWriting: profile.ieltsWriting || '',
        ieltsSpeaking: profile.ieltsSpeaking || '',
        toeflScore: profile.toeflScore ? String(profile.toeflScore) : '',
        duolingoScore: profile.duolingoScore ? String(profile.duolingoScore) : '',
        otherLanguageTestName: profile.otherLanguageTestName || '',
        otherLanguageTestScore: profile.otherLanguageTestScore || '',
        languageTestDate: profile.languageTestDate || '',
        languageTestValidityDate: profile.languageTestValidityDate || '',
        desiredDegreeLevel: profile.desiredDegreeLevel || "Master's",
        preferredProgrammesText: (profile.preferredStudyProgrammes || []).join(', '),
        preferredCountriesText: (profile.preferredCountries || []).join(', '),
        preferredIntake: profile.preferredIntake || '',
        maxTuitionBudgetUsd: profile.maxTuitionBudgetUsd ? String(profile.maxTuitionBudgetUsd) : '',
        scholarshipPreference: profile.scholarshipPreference || 'preferred',
        preferredStudyMode: profile.preferredStudyMode || 'on_campus',
      });
    }
  }, [profile, dbUser]);

  const update = (k: string, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.cgpa && form.cgpaScale && Number(form.cgpa) > Number(form.cgpaScale)) {
      toast.error('CGPA cannot exceed the CGPA scale.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: form.fullName || null,
          nationality: form.nationality || null,
          countryOfResidence: form.countryOfResidence || null,
          dateOfBirth: form.dateOfBirth || null,
          phoneNumber: form.phoneNumber || null,
          currentOrCompletedDegree: form.currentOrCompletedDegree || null,
          degreeCompleted: form.degreeCompleted,
          degreeField: form.degreeField || null,
          universityName: form.universityName || null,
          universityCountry: form.universityCountry || null,
          graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
          cgpa: form.cgpa ? Number(form.cgpa) : null,
          cgpaScale: form.cgpaScale ? Number(form.cgpaScale) : null,
          academicPercentage: form.academicPercentage ? Number(form.academicPercentage) : null,
          completedCourses: form.completedCoursesText.split(',').map((s) => s.trim()).filter(Boolean),
          ieltsOverall: form.ieltsOverall ? Number(form.ieltsOverall) : null,
          ieltsListening: form.ieltsListening ? Number(form.ieltsListening) : null,
          ieltsReading: form.ieltsReading ? Number(form.ieltsReading) : null,
          ieltsWriting: form.ieltsWriting ? Number(form.ieltsWriting) : null,
          ieltsSpeaking: form.ieltsSpeaking ? Number(form.ieltsSpeaking) : null,
          toeflScore: form.toeflScore ? Number(form.toeflScore) : null,
          duolingoScore: form.duolingoScore ? Number(form.duolingoScore) : null,
          otherLanguageTestName: form.otherLanguageTestName || null,
          otherLanguageTestScore: form.otherLanguageTestScore || null,
          languageTestDate: form.languageTestDate || null,
          languageTestValidityDate: form.languageTestValidityDate || null,
          desiredDegreeLevel: form.desiredDegreeLevel || null,
          preferredStudyProgrammes: form.preferredProgrammesText.split(',').map((s) => s.trim()).filter(Boolean),
          preferredCountries: form.preferredCountriesText.split(',').map((s) => s.trim()).filter(Boolean),
          preferredIntake: form.preferredIntake || null,
          maxTuitionBudgetUsd: form.maxTuitionBudgetUsd ? Number(form.maxTuitionBudgetUsd) : null,
          scholarshipPreference: form.scholarshipPreference || 'preferred',
          preferredStudyMode: form.preferredStudyMode || 'on_campus',
          onboardingCompleted: true,
        }),
      });
      await refreshProfile();
      toast.success('Student profile updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800 shrink-0">
            {!avatarError ? (
              <img
                src={dbUser?.avatarUrl || GENERATED_IMAGES.studentAvatar}
                alt="Applicant portrait"
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-600">
                {(form.fullName || 'S').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white">Student Profile</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {dbUser?.email} · Role: {dbUser?.role}
            </p>
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Full Name</Label>
            <Input value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
          </div>
          <div>
            <Label>Nationality</Label>
            <Input value={form.nationality} onChange={(e) => update('nationality', e.target.value)} />
          </div>
          <div>
            <Label>Country of Residence</Label>
            <Input value={form.countryOfResidence} onChange={(e) => update('countryOfResidence', e.target.value)} />
          </div>
          <div>
            <Label>Date of Birth</Label>
            <Input type="date" value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} />
          </div>
          <div>
            <Label>Phone Number</Label>
            <Input value={form.phoneNumber} onChange={(e) => update('phoneNumber', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Academic Information</CardTitle>
          <CardDescription>ApplySmart never assumes conversions across different GPA scales.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Current / Completed Degree</Label>
              <Select value={form.currentOrCompletedDegree} onChange={(e) => update('currentOrCompletedDegree', e.target.value)}>
                <option value="HSSC / A-Levels">HSSC / FSc / A-Levels</option>
                <option value="Bachelor's">Bachelor's</option>
                <option value="Master's">Master's</option>
              </Select>
            </div>
            <div>
              <Label>Completion Status</Label>
              <Select value={form.degreeCompleted ? 'completed' : 'in_progress'} onChange={(e) => update('degreeCompleted', e.target.value === 'completed')}>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
              </Select>
            </div>
            <div>
              <Label>Degree Field</Label>
              <Input value={form.degreeField} onChange={(e) => update('degreeField', e.target.value)} placeholder="Computer Science" />
            </div>
            <div>
              <Label>University Name</Label>
              <Input value={form.universityName} onChange={(e) => update('universityName', e.target.value)} />
            </div>
            <div>
              <Label>University Country</Label>
              <Input value={form.universityCountry} onChange={(e) => update('universityCountry', e.target.value)} />
            </div>
            <div>
              <Label>Graduation Year</Label>
              <Input type="number" value={form.graduationYear} onChange={(e) => update('graduationYear', e.target.value)} />
            </div>
            <div>
              <Label>CGPA</Label>
              <Input type="number" step="0.01" value={form.cgpa} onChange={(e) => update('cgpa', e.target.value)} />
            </div>
            <div>
              <Label>CGPA Scale</Label>
              <Input type="number" step="0.01" value={form.cgpaScale} onChange={(e) => update('cgpaScale', e.target.value)} />
            </div>
            <div>
              <Label>Percentage % (Optional)</Label>
              <Input type="number" step="0.1" value={form.academicPercentage} onChange={(e) => update('academicPercentage', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Completed Courses (comma-separated)</Label>
            <Input
              value={form.completedCoursesText}
              onChange={(e) => update('completedCoursesText', e.target.value)}
              placeholder="Algorithms & Data Structures, Operating Systems, Linear Algebra"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language Test Information</CardTitle>
          <CardDescription>Individual IELTS module scores and test validity dates are checked explicitly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <Label>IELTS Overall</Label>
              <Input type="number" step="0.5" value={form.ieltsOverall} onChange={(e) => update('ieltsOverall', e.target.value)} />
            </div>
            <div>
              <Label>Listening</Label>
              <Input type="number" step="0.5" value={form.ieltsListening} onChange={(e) => update('ieltsListening', e.target.value)} />
            </div>
            <div>
              <Label>Reading</Label>
              <Input type="number" step="0.5" value={form.ieltsReading} onChange={(e) => update('ieltsReading', e.target.value)} />
            </div>
            <div>
              <Label>Writing</Label>
              <Input type="number" step="0.5" value={form.ieltsWriting} onChange={(e) => update('ieltsWriting', e.target.value)} />
            </div>
            <div>
              <Label>Speaking</Label>
              <Input type="number" step="0.5" value={form.ieltsSpeaking} onChange={(e) => update('ieltsSpeaking', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>TOEFL iBT</Label>
              <Input type="number" value={form.toeflScore} onChange={(e) => update('toeflScore', e.target.value)} />
            </div>
            <div>
              <Label>Duolingo</Label>
              <Input type="number" value={form.duolingoScore} onChange={(e) => update('duolingoScore', e.target.value)} />
            </div>
            <div>
              <Label>Other Test Name (Optional)</Label>
              <Input
                value={form.otherLanguageTestName}
                onChange={(e) => update('otherLanguageTestName', e.target.value)}
                placeholder="PTE Academic / GRE"
              />
            </div>
            <div>
              <Label>Other Test Score</Label>
              <Input
                value={form.otherLanguageTestScore}
                onChange={(e) => update('otherLanguageTestScore', e.target.value)}
                placeholder="68"
              />
            </div>
            <div>
              <Label>Test Date</Label>
              <Input type="date" value={form.languageTestDate} onChange={(e) => update('languageTestDate', e.target.value)} />
            </div>
            <div>
              <Label>Test Validity Date</Label>
              <Input type="date" value={form.languageTestValidityDate} onChange={(e) => update('languageTestValidityDate', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Study Preferences</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Desired Degree Level</Label>
            <Select value={form.desiredDegreeLevel} onChange={(e) => update('desiredDegreeLevel', e.target.value)}>
              <option value="Bachelor's">Bachelor's</option>
              <option value="Master's">Master's</option>
              <option value="PhD">PhD</option>
            </Select>
          </div>
          <div>
            <Label>Preferred Intake</Label>
            <Input value={form.preferredIntake} onChange={(e) => update('preferredIntake', e.target.value)} />
          </div>
          <div>
            <Label>Preferred Study Programmes (comma-separated)</Label>
            <Input value={form.preferredProgrammesText} onChange={(e) => update('preferredProgrammesText', e.target.value)} />
          </div>
          <div>
            <Label>Preferred Countries (comma-separated)</Label>
            <Input value={form.preferredCountriesText} onChange={(e) => update('preferredCountriesText', e.target.value)} />
          </div>
          <div>
            <Label>Max Annual Tuition Budget (USD)</Label>
            <Input type="number" value={form.maxTuitionBudgetUsd} onChange={(e) => update('maxTuitionBudgetUsd', e.target.value)} />
          </div>
          <div>
            <Label>Scholarship Preference</Label>
            <Select value={form.scholarshipPreference} onChange={(e) => update('scholarshipPreference', e.target.value)}>
              <option value="required">Full Scholarship Required</option>
              <option value="preferred">Scholarship Preferred</option>
              <option value="self_funded">Self-Funded</option>
            </Select>
          </div>
          <div>
            <Label>Preferred Study Mode</Label>
            <Select value={form.preferredStudyMode} onChange={(e) => update('preferredStudyMode', e.target.value)}>
              <option value="on_campus">On-Campus</option>
              <option value="hybrid">Hybrid</option>
              <option value="online">Online</option>
            </Select>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
