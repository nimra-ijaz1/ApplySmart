import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { apiFetch } from '../../lib/api.ts';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Input, Label, Select } from '../../components/ui/input.tsx';

export function OnboardingPage() {
  const { dbUser, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    fullName: profile?.fullName || dbUser?.fullName || '',
    nationality: profile?.nationality || 'Pakistan',
    countryOfResidence: profile?.countryOfResidence || 'Pakistan',
    dateOfBirth: profile?.dateOfBirth || '',
    phoneNumber: profile?.phoneNumber || '',
    currentOrCompletedDegree: profile?.currentOrCompletedDegree || "Bachelor's",
    degreeCompleted: profile?.degreeCompleted ?? true,
    degreeField: profile?.degreeField || '',
    universityName: profile?.universityName || '',
    universityCountry: profile?.universityCountry || 'Pakistan',
    graduationYear: profile?.graduationYear ? String(profile.graduationYear) : '2025',
    cgpa: profile?.cgpa || '',
    cgpaScale: profile?.cgpaScale || '4.00',
    academicPercentage: profile?.academicPercentage || '',
    completedCoursesText: (profile?.completedCourses || []).join(', '),
    ieltsOverall: profile?.ieltsOverall || '',
    ieltsListening: profile?.ieltsListening || '',
    ieltsReading: profile?.ieltsReading || '',
    ieltsWriting: profile?.ieltsWriting || '',
    ieltsSpeaking: profile?.ieltsSpeaking || '',
    toeflScore: profile?.toeflScore ? String(profile.toeflScore) : '',
    duolingoScore: profile?.duolingoScore ? String(profile.duolingoScore) : '',
    languageTestDate: profile?.languageTestDate || '',
    languageTestValidityDate: profile?.languageTestValidityDate || '',
    desiredDegreeLevel: profile?.desiredDegreeLevel || "Master's",
    preferredProgrammesText: (profile?.preferredStudyProgrammes || []).join(', '),
    preferredCountriesText: (profile?.preferredCountries || ['Germany', 'United Kingdom']).join(', '),
    preferredIntake: profile?.preferredIntake || 'Fall 2027',
    maxTuitionBudgetUsd: profile?.maxTuitionBudgetUsd ? String(profile.maxTuitionBudgetUsd) : '25000',
    scholarshipPreference: profile?.scholarshipPreference || 'preferred',
    preferredStudyMode: profile?.preferredStudyMode || 'on_campus',
  });

  const update = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const saveAndFinish = async () => {
    if (form.cgpa && form.cgpaScale && Number(form.cgpa) > Number(form.cgpaScale)) {
      toast.error('CGPA cannot exceed the CGPA scale.');
      setStep(2);
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
          cgpaScale: form.cgpaScale ? Number(form.cgpaScale) : 4.0,
          academicPercentage: form.academicPercentage ? Number(form.academicPercentage) : null,
          completedCourses: form.completedCoursesText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          ieltsOverall: form.ieltsOverall ? Number(form.ieltsOverall) : null,
          ieltsListening: form.ieltsListening ? Number(form.ieltsListening) : null,
          ieltsReading: form.ieltsReading ? Number(form.ieltsReading) : null,
          ieltsWriting: form.ieltsWriting ? Number(form.ieltsWriting) : null,
          ieltsSpeaking: form.ieltsSpeaking ? Number(form.ieltsSpeaking) : null,
          toeflScore: form.toeflScore ? Number(form.toeflScore) : null,
          duolingoScore: form.duolingoScore ? Number(form.duolingoScore) : null,
          languageTestDate: form.languageTestDate || null,
          languageTestValidityDate: form.languageTestValidityDate || null,
          desiredDegreeLevel: form.desiredDegreeLevel || null,
          preferredStudyProgrammes: form.preferredProgrammesText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          preferredCountries: form.preferredCountriesText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          preferredIntake: form.preferredIntake || null,
          maxTuitionBudgetUsd: form.maxTuitionBudgetUsd ? Number(form.maxTuitionBudgetUsd) : null,
          scholarshipPreference: form.scholarshipPreference || 'preferred',
          preferredStudyMode: form.preferredStudyMode || 'on_campus',
          onboardingCompleted: true,
        }),
      });
      await refreshProfile();
      toast.success('Profile saved! Welcome to ApplySmart.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save onboarding details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0F2942] dark:text-white">
              Set Up Your Study Abroad Profile
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Step {step} of 4 · Used for deterministic eligibility checks and recommendations
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500">{step} / 4</span>
        </div>

        <div className="mb-6 grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-colors ${
                s <= step ? 'bg-[#0F2942] dark:bg-blue-500' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && '01. Personal Information'}
              {step === 2 && '02. Academic Background'}
              {step === 3 && '03. Language Test Scores'}
              {step === 4 && '04. Study Preferences'}
            </CardTitle>
            <CardDescription>
              {step === 1 && 'Confirm your identity and citizenship for scholarship eligibility matching.'}
              {step === 2 && 'Enter your exact CGPA and scale without manual conversion.'}
              {step === 3 && 'Include individual IELTS band scores so band minimums are checked accurately.'}
              {step === 4 && 'Choose your target degree level, countries, and tuition budget.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Full Name</Label>
                    <Input value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="Nimra Ijaz" />
                  </div>
                  <div>
                    <Label>Nationality</Label>
                    <Input value={form.nationality} onChange={(e) => update('nationality', e.target.value)} placeholder="Pakistan" />
                  </div>
                  <div>
                    <Label>Country of Residence</Label>
                    <Input value={form.countryOfResidence} onChange={(e) => update('countryOfResidence', e.target.value)} placeholder="Pakistan" />
                  </div>
                  <div>
                    <Label>Phone Number (Optional)</Label>
                    <Input value={form.phoneNumber} onChange={(e) => update('phoneNumber', e.target.value)} placeholder="+92 300 0000000" />
                  </div>
                  <div>
                    <Label>Date of Birth (Optional)</Label>
                    <Input type="date" value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Current or Completed Degree</Label>
                    <Select
                      value={form.currentOrCompletedDegree}
                      onChange={(e) => update('currentOrCompletedDegree', e.target.value)}
                    >
                      <option value="HSSC / A-Levels">HSSC / FSc / A-Levels</option>
                      <option value="Bachelor's">Bachelor's (BS / BSc / BE)</option>
                      <option value="Master's">Master's (MS / MPhil)</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Degree Status</Label>
                    <Select
                      value={form.degreeCompleted ? 'completed' : 'in_progress'}
                      onChange={(e) => update('degreeCompleted', e.target.value === 'completed')}
                    >
                      <option value="completed">Completed</option>
                      <option value="in_progress">In Progress (Final Year)</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Degree Field / Major</Label>
                    <Input value={form.degreeField} onChange={(e) => update('degreeField', e.target.value)} placeholder="Software Engineering" />
                  </div>
                  <div>
                    <Label>University / College Name</Label>
                    <Input value={form.universityName} onChange={(e) => update('universityName', e.target.value)} placeholder="NUST / FAST / LUMS" />
                  </div>
                  <div>
                    <Label>CGPA</Label>
                    <Input type="number" step="0.01" value={form.cgpa} onChange={(e) => update('cgpa', e.target.value)} placeholder="3.66" />
                  </div>
                  <div>
                    <Label>CGPA Scale</Label>
                    <Input type="number" step="0.01" value={form.cgpaScale} onChange={(e) => update('cgpaScale', e.target.value)} placeholder="4.00" />
                  </div>
                  <div>
                    <Label>Academic Percentage % (Optional)</Label>
                    <Input type="number" step="0.1" value={form.academicPercentage} onChange={(e) => update('academicPercentage', e.target.value)} placeholder="84.5" />
                  </div>
                  <div>
                    <Label>Graduation Year</Label>
                    <Input type="number" value={form.graduationYear} onChange={(e) => update('graduationYear', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Key Completed Courses (comma-separated, helps verify prerequisites)</Label>
                  <Input
                    value={form.completedCoursesText}
                    onChange={(e) => update('completedCoursesText', e.target.value)}
                    placeholder="Algorithms, Data Structures, Operating Systems, Linear Algebra"
                  />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <Label>IELTS Overall</Label>
                    <Input type="number" step="0.5" value={form.ieltsOverall} onChange={(e) => update('ieltsOverall', e.target.value)} placeholder="7.0" />
                  </div>
                  <div>
                    <Label>Listening</Label>
                    <Input type="number" step="0.5" value={form.ieltsListening} onChange={(e) => update('ieltsListening', e.target.value)} placeholder="7.5" />
                  </div>
                  <div>
                    <Label>Reading</Label>
                    <Input type="number" step="0.5" value={form.ieltsReading} onChange={(e) => update('ieltsReading', e.target.value)} placeholder="7.0" />
                  </div>
                  <div>
                    <Label>Writing</Label>
                    <Input type="number" step="0.5" value={form.ieltsWriting} onChange={(e) => update('ieltsWriting', e.target.value)} placeholder="6.5" />
                  </div>
                  <div>
                    <Label>Speaking</Label>
                    <Input type="number" step="0.5" value={form.ieltsSpeaking} onChange={(e) => update('ieltsSpeaking', e.target.value)} placeholder="7.0" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label>TOEFL iBT Score (Optional)</Label>
                    <Input type="number" value={form.toeflScore} onChange={(e) => update('toeflScore', e.target.value)} placeholder="100" />
                  </div>
                  <div>
                    <Label>Duolingo Score (Optional)</Label>
                    <Input type="number" value={form.duolingoScore} onChange={(e) => update('duolingoScore', e.target.value)} placeholder="125" />
                  </div>
                  <div>
                    <Label>Test Date (Optional)</Label>
                    <Input type="date" value={form.languageTestDate} onChange={(e) => update('languageTestDate', e.target.value)} />
                  </div>
                  <div>
                    <Label>Test Validity / Expiry Date</Label>
                    <Input type="date" value={form.languageTestValidityDate} onChange={(e) => update('languageTestValidityDate', e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {step === 4 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <Input value={form.preferredIntake} onChange={(e) => update('preferredIntake', e.target.value)} placeholder="Fall 2027" />
                </div>
                <div>
                  <Label>Preferred Study Programmes</Label>
                  <Input value={form.preferredProgrammesText} onChange={(e) => update('preferredProgrammesText', e.target.value)} placeholder="Computer Science, Artificial Intelligence" />
                </div>
                <div>
                  <Label>Preferred Countries</Label>
                  <Input value={form.preferredCountriesText} onChange={(e) => update('preferredCountriesText', e.target.value)} placeholder="Germany, United Kingdom, Canada" />
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
                    <option value="self_funded">Self-Funded / Flexible</option>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={saveAndFinish} disabled={saving}>
                  Skip for Now
                </Button>
              )}

              {step < 4 ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (step === 2 && form.cgpa && form.cgpaScale && Number(form.cgpa) > Number(form.cgpaScale)) {
                      toast.error('CGPA cannot exceed the CGPA scale.');
                      return;
                    }
                    setStep(step + 1);
                  }}
                >
                  Continue
                </Button>
              ) : (
                <Button type="button" onClick={saveAndFinish} disabled={saving}>
                  {saving ? 'Saving Profile...' : 'Complete Setup'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
