import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PublicHeader } from '../components/layout/PublicHeader.tsx';
import { Button } from '../components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.tsx';
import { Input, Label, Select, Textarea } from '../components/ui/input.tsx';
import { apiFetch } from '../lib/api.ts';
import { formatCurrency } from '../lib/utils.ts';

export function FeaturesPage() {
  const features = [
    {
      title: 'University & Programme Finder',
      desc: 'Search across countries, degree levels, tuition ceilings, CGPA minimums, IELTS requirements, and scholarship availability with verified source links.',
    },
    {
      title: 'Deterministic Eligibility Engine',
      desc: 'Evaluates your CGPA scale, individual IELTS module scores, language test validity dates, degree discipline, and prerequisite courses without guessing conversions.',
    },
    {
      title: 'Scholarship Discovery & Comparison',
      desc: 'Track full and partial scholarships like Chevening, DAAD EPOS, Erasmus Mundus, and Fulbright Pakistan with monthly stipends and deadlines.',
    },
    {
      title: 'Application Kanban & Document Vault',
      desc: 'Track applications across 10 statuses, upload transcripts and passports privately, and extract admission requirements from university PDFs.',
    },
    {
      title: 'Deadline Calendar & Reminders',
      desc: 'Combine university application openings, programme deadlines, scholarship cutoffs, and custom IELTS or document reminders.',
    },
    {
      title: 'Grounded AI Study Abroad Assistant',
      desc: 'Ask profile-aware questions, compare programmes side-by-side, and build application checklists grounded strictly in verified platform records.',
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight text-[#0F2942] dark:text-white">
          Platform Capabilities
        </h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-300 max-w-2xl">
          Every module in ApplySmart connects to a structured PostgreSQL database and transparent verification pipeline.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <CardTitle>{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12">
          <Link to="/register">
            <Button size="lg">Create Your Free Student Account</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HowItWorksPage() {
  const steps = [
    {
      step: '01. Create Your Academic & Test Profile',
      detail:
        'Complete the 4-step onboarding wizard covering personal details, university CGPA and scale, IELTS/TOEFL/Duolingo module scores, and target countries or tuition budget.',
    },
    {
      step: '02. Discover Verified Programmes & Scholarships',
      detail:
        'Browse universities and filter programmes matching your desired degree level. Save candidates to your shortlist and compare up to four programmes side-by-side.',
    },
    {
      step: '03. Verify Eligibility Before Paying Application Fees',
      detail:
        'Run deterministic eligibility checks that flag scale mismatches, expired tests, or missing prerequisites clearly, paired with plain-English AI explanations.',
    },
    {
      step: '04. Organize Documents & Track Every Deadline',
      detail:
        'Upload PDFs into your private document vault, attach them to Kanban application cards, and monitor submission deadlines in your monthly calendar.',
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <PublicHeader />
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight text-[#0F2942] dark:text-white">
          How ApplySmart Works
        </h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">
          A transparent workflow designed to eliminate missed deadlines and unverified admissions guesswork.
        </p>

        <div className="mt-10 space-y-6">
          {steps.map((s) => (
            <div
              key={s.step}
              className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <h2 className="text-lg font-semibold text-[#0F2942] dark:text-white">{s.step}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {s.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <PublicHeader />
      <div className="mx-auto max-w-4xl px-6 py-16 space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-[#0F2942] dark:text-white">
          About ApplySmart
        </h1>
        <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
          Applying for Bachelor’s, Master’s, and PhD programmes abroad often forces students to
          juggle dozens of university portals, inconsistent GPA conversion claims, expiring language
          certificates, and scattered PDF checklists.
        </p>
        <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
          ApplySmart was built first with Pakistani international applicants in mind—supporting
          4-year BS degree nuances, HEC/transcript preparation, and major scholarships like
          Chevening, Fulbright, DAAD, Commonwealth, and Erasmus Mundus—while scaling cleanly for
          applicants worldwide.
        </p>
        <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
          Our core engineering principle is strict separation between deterministic eligibility
          verification and AI language assistance: ApplySmart never fabricates cutoffs or guarantees
          admission, and every curated record carries a verifiable source URL and last-verified
          date.
        </p>
      </div>
    </div>
  );
}

const contactSchema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email address'),
  subject: z.string().min(3, 'Enter a subject'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type ContactValues = z.infer<typeof contactSchema>;

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) });

  const onSubmit = async (values: ContactValues) => {
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setSubmitted(true);
      reset();
      toast.success('Inquiry sent successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to send message.');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <PublicHeader />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-[#0F2942] dark:text-white">
          Contact ApplySmart
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Have a question about university verification, institutional partnerships, or student support?
        </p>

        {submitted ? (
          <Card className="mt-8">
            <CardContent className="pt-6">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                Thank you for reaching out.
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Your inquiry has been recorded in our support queue.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => setSubmitted(false)}>
                Send Another Inquiry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-8">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" {...register('name')} placeholder="Ayesha Khan" />
                  {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" {...register('email')} placeholder="ayesha@example.com" />
                  {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" {...register('subject')} placeholder="University listing verification" />
                  {errors.subject && <p className="text-xs text-red-600 mt-1">{errors.subject.message}</p>}
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" {...register('message')} placeholder="Write your message..." />
                  {errors.message && <p className="text-xs text-red-600 mt-1">{errors.message.message}</p>}
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export function PublicExplorePage() {
  const initialCountry =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('country') || ''
      : '';
  const [q, setQ] = useState('');
  const [country, setCountry] = useState(initialCountry);
  const [degreeLevel, setDegreeLevel] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['public-universities', q, country, degreeLevel],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (country) params.set('country', country);
      if (degreeLevel) params.set('degreeLevel', degreeLevel);
      return apiFetch<{
        items: Array<{
          id: number;
          name: string;
          country: string;
          city: string;
          institutionType: string;
          globalRanking: number | null;
          officialWebsite: string;
          isDemoRecord: boolean;
          lastVerifiedDate: string;
          programmes: Array<{
            id: number;
            name: string;
            degreeLevel: string;
            tuitionFee: number;
            currency: string;
            applicationDeadline: string | null;
          }>;
        }>;
        facets: { countries: string[] };
      }>(`/api/universities?${params.toString()}`);
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <PublicHeader />
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F2942] dark:text-white">
              Explore Universities &amp; Programmes
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Preview our verified reference database. Sign in to run personalized eligibility checks and track applications.
            </p>
          </div>
          <Link to="/register">
            <Button>Sign Up to Check Eligibility</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <Input
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search university, city, or programme..."
            />
          </div>
          <Select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All Countries</option>
            {(data?.facets.countries ?? []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Select value={degreeLevel} onChange={(e) => setDegreeLevel(e.target.value)}>
            <option value="">All Degree Levels</option>
            <option value="Bachelor's">Bachelor's</option>
            <option value="Master's">Master's</option>
            <option value="PhD">PhD</option>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 rounded-xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(data?.items ?? []).map((uni) => (
              <Card key={uni.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{uni.name}</CardTitle>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {uni.city}, {uni.country} · {uni.institutionType}
                        {uni.globalRanking ? ` · Rank #${uni.globalRanking}` : ''}
                        {uni.isDemoRecord ? ' · Reference Demo Record' : ''}
                      </p>
                    </div>
                    <a
                      href={uni.officialWebsite}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400 inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Website</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {uni.programmes.slice(0, 3).map((p) => (
                      <div key={p.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{p.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {p.degreeLevel} · Deadline: {p.applicationDeadline || 'Rolling'}
                          </p>
                        </div>
                        <span className="font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300 shrink-0">
                          {formatCurrency(p.tuitionFee, p.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">Last verified: {uni.lastVerifiedDate}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
