import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, GraduationCap } from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader.tsx';
import { apiFetch } from '../lib/api.ts';
import { GENERATED_IMAGES } from '../lib/utils.ts';

const DESTINATIONS = [
  { country: 'Germany', highlight: 'Public tuition-free & low-fee engineering tracks' },
  { country: 'United Kingdom', highlight: '1-year taught Master’s & Chevening pathways' },
  { country: 'Switzerland', highlight: 'ETH Zurich & federal research fellowships' },
  { country: 'Canada', highlight: 'Co-op research degrees & graduate funding' },
  { country: 'Australia', highlight: 'Group of Eight IT & engineering intakes' },
  { country: 'Sweden', highlight: 'English-taught AI & sustainability Master’s' },
];

const FAQS = [
  {
    q: 'Does ApplySmart automatically convert Pakistani percentages into a 4.0 GPA?',
    a: 'No. Because universities use different conversion scales (such as the Bavarian formula in Germany or HEC equivalencies), ApplySmart never guesses conversions. When scales differ, the eligibility engine flags the criterion for manual verification and shows the university’s published rule.',
  },
  {
    q: 'How are IELTS individual band scores checked?',
    a: 'ApplySmart checks both your overall IELTS score and each individual module (Listening, Reading, Writing, Speaking) separately. If a programme requires 6.5 overall with 6.0 in each band, scoring 7.0 overall with 5.5 in Writing is accurately flagged as not meeting requirements.',
  },
  {
    q: 'Are university deadlines and scholarships invented by AI?',
    a: 'Never. Every university, programme requirement, and scholarship record stores an official source URL and last verified date. The AI Assistant answers strictly from verified database records and your profile when permitted.',
  },
  {
    q: 'Is ApplySmart only for Pakistani students?',
    a: 'While initial scholarship pathways and HEC/degree background guidance are tailored for Pakistani applicants, you can set any nationality, grading scale, and destination country in your student profile.',
  },
];

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroImgError, setHeroImgError] = useState(false);
  const [deskImgError, setDeskImgError] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['public-stats'],
    queryFn: () =>
      apiFetch<{ universitiesCount: number; programmesCount: number; scholarshipsCount: number }>(
        '/api/public/stats'
      ),
  });

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <PublicHeader />

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-6 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-4">
              Built for Pakistani &amp; International Degree Applicants
            </p>
            <h1 className="text-[clamp(2.25rem,4vw,3.75rem)] font-bold leading-[1.08] tracking-tight text-[#0F2942] dark:text-white text-balance">
              Your Study Abroad Journey, Simplified.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-600 dark:text-slate-300 max-w-xl">
              Discover universities, check your eligibility, find scholarships, and manage every
              application in one intelligent platform.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/register"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#0F2942] px-6 text-sm font-semibold text-white hover:bg-[#163A5C] dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap transition-colors"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/explore"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap transition-colors"
              >
                Explore Universities
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[340px] lg:min-h-[440px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
              {!heroImgError ? (
                <img
                  src={GENERATED_IMAGES.heroCampus}
                  alt="International university courtyard and glass library pavilion"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
                  <GraduationCap className="h-12 w-12 text-[#0F2942] dark:text-blue-400 mb-3" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Global University Discovery &amp; Admissions Workspace
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full-width database metrics row */}
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6 border-y border-slate-200 dark:border-slate-800 py-8">
          <div>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#0F2942] dark:text-white">
              {stats?.universitiesCount ?? 8}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Verified Reference Universities
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#0F2942] dark:text-white">
              {stats?.programmesCount ?? 12}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Bachelor’s, Master’s &amp; PhD Programmes
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#0F2942] dark:text-white">
              {stats?.scholarshipsCount ?? 6}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Tracked Funding &amp; Scholarship Tracks
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold font-mono tabular-nums text-[#0F2942] dark:text-white">
              100%
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Deterministic Rule Transparency
            </p>
          </div>
        </div>
      </section>

      {/* How ApplySmart Works */}
      <section className="bg-slate-50 dark:bg-slate-900/50 py-16 lg:py-24 border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-[#0F2942] dark:text-white">
              How ApplySmart Works
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
              Move from scattered spreadsheets and conflicting forum advice to a structured,
              source-backed application workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '01. Build Academic Profile',
                desc: 'Enter your degree, CGPA and scale, IELTS/TOEFL module bands, budget, and preferred intake once.',
              },
              {
                num: '02. Find & Compare Programmes',
                desc: 'Filter universities by tuition, country, CGPA cutoff, IELTS band, and scholarship availability.',
              },
              {
                num: '03. Verify Eligibility',
                desc: 'Run deterministic rule checks across every module score, degree field, and prerequisite with source links.',
              },
              {
                num: '04. Track & Apply on Time',
                desc: 'Organize transcripts, SOPs, and passports, track Kanban stages, and monitor every deadline.',
              },
            ].map((step) => (
              <div
                key={step.num}
                className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <h3 className="text-base font-semibold text-[#0F2942] dark:text-white">{step.num}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Explore Study Destinations + Find Your Programme */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[#0F2942] dark:text-white">
              Explore Study Destinations
            </h2>
            <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
              Inspect verified tuition structures, English-taught programmes, and official admission links.
            </p>
          </div>
          <Link
            to="/explore"
            className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400 whitespace-nowrap"
          >
            Browse all universities →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DESTINATIONS.map((dest) => (
            <Link
              key={dest.country}
              to={`/explore?country=${encodeURIComponent(dest.country)}`}
              className="group rounded-xl border border-slate-200 bg-white p-6 hover:border-blue-600/50 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/50"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400">
                  {dest.country}
                </h3>
                <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-700 dark:group-hover:text-blue-400" />
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{dest.highlight}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Smart Eligibility Checking */}
      <section className="bg-slate-50 dark:bg-slate-900/50 py-16 lg:py-24 border-y border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <h2 className="text-3xl font-bold tracking-tight text-[#0F2942] dark:text-white text-balance">
              Deterministic Eligibility Checking, Explained Clearly
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Minimum requirement matching runs through strict backend rules—never guesswork. See
              exact CGPA scale comparisons, per-band IELTS checks, test expiry flags, and official
              source URLs side by side.
            </p>
            <div className="mt-6">
              <Link
                to="/register"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0F2942] px-5 text-sm font-medium text-white hover:bg-[#163A5C] dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                Run Your Eligibility Check
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Example Comparison: M.Sc. Informatics (TUM)
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Meets listed requirements
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">Criterion</th>
                      <th className="px-6 py-3 font-medium">Student Profile</th>
                      <th className="px-6 py-3 font-medium">Listed Minimum</th>
                      <th className="px-6 py-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    <tr>
                      <td className="px-6 py-3.5 font-medium">CGPA (4.00 scale)</td>
                      <td className="px-6 py-3.5 font-mono tabular-nums">3.66 / 4.00</td>
                      <td className="px-6 py-3.5 font-mono tabular-nums">3.20 / 4.00</td>
                      <td className="px-6 py-3.5 text-right text-emerald-700 dark:text-emerald-400 font-medium">Pass</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3.5 font-medium">IELTS Overall &amp; Bands</td>
                      <td className="px-6 py-3.5 font-mono tabular-nums">7.0 (min 6.5)</td>
                      <td className="px-6 py-3.5 font-mono tabular-nums">6.5 (min 6.0)</td>
                      <td className="px-6 py-3.5 text-right text-emerald-700 dark:text-emerald-400 font-medium">Pass</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-3.5 font-medium">Degree Background</td>
                      <td className="px-6 py-3.5">BS Software Engineering</td>
                      <td className="px-6 py-3.5">CS / Software Eng.</td>
                      <td className="px-6 py-3.5 text-right text-emerald-700 dark:text-emerald-400 font-medium">Pass</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scholarships, Application Management & AI Assistance */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-6">
            <div className="h-full min-h-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
              {!deskImgError ? (
                <img
                  src={GENERATED_IMAGES.studyDesk}
                  alt="Applicant desk with passport, transcript folder, and laptop"
                  referrerPolicy="no-referrer"
                  onError={() => setDeskImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-8">
                  <p className="text-sm text-slate-500">Application &amp; Document Workspace</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col justify-center space-y-8">
            <div>
              <h3 className="text-xl font-bold text-[#0F2942] dark:text-white">
                Scholarship Opportunities
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Browse verified funding programmes including Chevening, DAAD EPOS, Erasmus Mundus,
                Fulbright Pakistan, and Commonwealth Master’s with exact stipend, travel, and
                nationality eligibility notes.
              </p>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 className="text-xl font-bold text-[#0F2942] dark:text-white">
                Kanban Application &amp; Document Manager
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Move each university application from Researching to Submitted and Accepted, attach
                verified transcripts and SOPs, and track every opening and submission date.
              </p>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 className="text-xl font-bold text-[#0F2942] dark:text-white">
                Grounded AI Study Abroad Assistant
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Extract requirements from admission PDFs for confirmation, draft Statements of
                Purpose, and ask profile-aware questions backed by verified source URLs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-slate-50 dark:bg-slate-900/50 py-16 lg:py-20 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-3xl font-bold tracking-tight text-[#0F2942] dark:text-white mb-8">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="p-6">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 text-left font-semibold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <span>{item.q}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-base font-bold text-[#0F2942] dark:text-white font-display">
              ApplySmart
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              AI-Powered International University Application Platform · © {new Date().getFullYear()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
            <Link to="/features" className="hover:text-slate-900 dark:hover:text-white">Features</Link>
            <Link to="/how-it-works" className="hover:text-slate-900 dark:hover:text-white">How It Works</Link>
            <Link to="/explore" className="hover:text-slate-900 dark:hover:text-white">Universities</Link>
            <Link to="/about" className="hover:text-slate-900 dark:hover:text-white">About</Link>
            <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white">Contact</Link>
            <Link to="/login" className="hover:text-slate-900 dark:hover:text-white">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
