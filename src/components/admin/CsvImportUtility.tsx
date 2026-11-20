import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api.ts';
import { Button } from '../ui/button.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card.tsx';
import { FileUpload } from '../ui/file-upload.tsx';
import { Select, Textarea } from '../ui/input.tsx';

export type CsvEntityType = 'universities' | 'programmes';

interface CsvRowValidationResult {
  rowNumber: number;
  status: 'valid' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
  isDuplicateInDb: boolean;
  resolvedUniversityId?: number;
  resolvedUniversityName?: string;
  raw: Record<string, string>;
  normalized: Record<string, unknown> | null;
}

interface CsvValidationReport {
  entityType: CsvEntityType;
  headers: string[];
  missingRequiredHeaders: string[];
  summary: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
    duplicateRows: number;
  };
  rows: CsvRowValidationResult[];
}

interface CsvCommitResult {
  importedCount: number;
  skippedDuplicatesCount: number;
  skippedErrorRowsCount: number;
  createdIds: number[];
}

interface BulkUploadResponse {
  fileName: string;
  fileSize: number;
  mode: 'validate' | 'commit';
  report: CsvValidationReport;
  commitResult?: CsvCommitResult;
}

const SAMPLE_UNIVERSITIES_CSV = `name,country,city,official_website,institution_type,global_ranking,contact_email,description,source_url,last_verified_date,verification_status
University of Bonn,Germany,Bonn,https://www.uni-bonn.de/en,Public,227,info@uni-bonn.de,"Public research university in Bonn known for mathematics, computer science, and life sciences.",https://www.uni-bonn.de/en/studying,2026-10-15,pending_verification
McGill University,Canada,Montreal,https://www.mcgill.ca,Public,29,admissions@mcgill.ca,"Internationally recognized Canadian public research institution with strong engineering and AI labs.",https://www.mcgill.ca/gradapplicants,2026-10-15,pending_verification`;

const SAMPLE_PROGRAMMES_CSV = `university_name,name,degree_level,subject_area,duration,study_language,tuition_fee,currency,tuition_fee_usd_approx,application_fee,application_opening_date,application_deadline,intake,scholarship_availability,official_programme_url,min_cgpa,cgpa_scale,required_degree_background,accepted_degree_fields,ielts_overall,ielts_listening,ielts_reading,ielts_writing,ielts_speaking,toefl_min,required_documents,description
Technical University of Munich,MSc Robotics Cognition Intelligence,Master's,Computer Science,2 years,English,0,EUR,0,0,2026-01-01,2026-05-31,Fall 2026,true,https://www.tum.de/en/studies/degree-programs/detail/robotics-cognition-intelligence-master-of-science-msc,3.00,4.00,"4-year Bachelor's in Computer Science or Electrical Engineering","Computer Science;Electrical Engineering;Robotics",6.5,6.0,6.0,6.0,6.0,88,"Academic Transcripts;Degree Certificate;CV;Motivation Letter;VPD",Interdisciplinary Master's programme covering autonomous robotics and machine intelligence.
University of Toronto,MSc Applied Computing,Master's,Computer Science,16 months,English,44000,CAD,32200,125,2025-10-15,2026-01-15,Fall 2026,true,https://mscac.utoronto.ca,3.30,4.00,"4-year Honours Bachelor's degree in Computer Science","Computer Science;Software Engineering;Mathematics",7.0,6.5,6.5,6.5,6.5,93,"Academic Transcripts;Statement of Purpose;CV;3 Reference Letters",Research-and-internship Master's connecting graduate students with Canadian technology labs.`;

interface CsvImportUtilityProps {
  onImportSuccess: () => void;
  onNavigateTab?: (tab: 'catalog' | 'verification') => void;
}

export function CsvImportUtility({
  onImportSuccess,
  onNavigateTab,
}: CsvImportUtilityProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [entityType, setEntityType] = useState<CsvEntityType>('universities');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>(SAMPLE_UNIVERSITIES_CSV);
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [skipInvalidRows, setSkipInvalidRows] = useState<boolean>(false);
  const [rowFilter, setRowFilter] = useState<string>('all');
  const [report, setReport] = useState<CsvValidationReport | null>(null);
  const [commitResult, setCommitResult] = useState<CsvCommitResult | null>(null);

  const switchEntityType = (nextType: CsvEntityType) => {
    setEntityType(nextType);
    setStep(1);
    setSelectedFile(null);
    setReport(null);
    setCommitResult(null);
    setCsvText(nextType === 'universities' ? SAMPLE_UNIVERSITIES_CSV : SAMPLE_PROGRAMMES_CSV);
  };

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setReport(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = typeof ev.target?.result === 'string' ? ev.target.result : '';
      setCsvText(content);
      toast.success(
        `Loaded "${file.name}" (${content.split(/\r?\n/).filter(Boolean).length} lines). Click Process CSV to validate.`
      );
    };
    reader.readAsText(file);
  };

  const buildCsvFormData = (mode: 'validate' | 'commit'): FormData => {
    const formData = new FormData();
    const uploadFile =
      selectedFile ??
      new File([csvText], `${entityType}_upload.csv`, { type: 'text/csv' });
    formData.append('file', uploadFile);
    formData.append('entityType', entityType);
    formData.append('mode', mode);
    formData.append('skipDuplicates', String(skipDuplicates));
    formData.append('skipInvalidRows', String(skipInvalidRows));
    return formData;
  };

  const downloadFile = (name: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadValidationReport = () => {
    if (!report) return;
    const header = 'row_number,status,is_duplicate_in_db,errors,warnings\n';
    const lines = report.rows.map((r) => {
      const err = `"${r.errors.join(' | ').replace(/"/g, '""')}"`;
      const warn = `"${r.warnings.join(' | ').replace(/"/g, '""')}"`;
      return `${r.rowNumber},${r.status},${r.isDuplicateInDb},${err},${warn}`;
    });
    downloadFile(
      `${entityType}_validation_report.csv`,
      header + lines.join('\n')
    );
  };

  const processCsvMutation = useMutation({
    mutationFn: () =>
      apiFetch<BulkUploadResponse>('/api/admin/bulk-upload', {
        method: 'POST',
        body: buildCsvFormData('validate'),
      }),
    onSuccess: (res) => {
      setReport(res.report);
      setStep(2);
      if (res.report.missingRequiredHeaders.length > 0) {
        toast.error(
          `Missing required headers: ${res.report.missingRequiredHeaders.join(', ')}`
        );
      } else if (res.report.summary.errorRows > 0) {
        toast.warning(
          `Parsed "${res.fileName}": ${res.report.summary.errorRows} row(s) have validation errors.`
        );
      } else {
        toast.success(
          `Validated "${res.fileName}" (${res.report.summary.totalRows} rows). Ready to save to PostgreSQL.`
        );
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const commitMutation = useMutation({
    mutationFn: () =>
      apiFetch<BulkUploadResponse>('/api/admin/bulk-upload', {
        method: 'POST',
        body: buildCsvFormData('commit'),
      }),
    onSuccess: (res) => {
      const committed = res.commitResult ?? {
        importedCount: 0,
        skippedDuplicatesCount: 0,
        skippedErrorRowsCount: 0,
        createdIds: [],
      };
      setCommitResult(committed);
      setStep(3);
      onImportSuccess();
      toast.success(`Saved ${committed.importedCount} validated record(s) to PostgreSQL.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredRows = (report?.rows ?? []).filter((r) => {
    if (rowFilter === 'errors') return r.status === 'error';
    if (rowFilter === 'warnings') return r.status === 'warning';
    if (rowFilter === 'valid') return r.status === 'valid';
    if (rowFilter === 'duplicates') return r.isDuplicateInDb;
    return true;
  });

  const eligibleToCommitCount = (report?.rows ?? []).filter((r) => {
    if (r.status === 'error') return false;
    if (r.isDuplicateInDb && skipDuplicates) return false;
    return true;
  }).length;

  const commitBlockedReason = (() => {
    if (!report) return 'Run Process CSV validation first.';
    if (report.missingRequiredHeaders.length > 0) {
      return `Missing required headers: ${report.missingRequiredHeaders.join(', ')}`;
    }
    if (report.summary.totalRows === 0) return 'No data rows found in CSV.';
    if (!skipInvalidRows && report.summary.errorRows > 0) {
      return `${report.summary.errorRows} error row(s) must be resolved or enable partial import.`;
    }
    if (!skipDuplicates && report.summary.duplicateRows > 0) {
      return `${report.summary.duplicateRows} PostgreSQL duplicate(s) detected; enable skip duplicates to proceed.`;
    }
    if (eligibleToCommitCount === 0) {
      return 'Zero new valid rows remaining to insert into PostgreSQL.';
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      {/* Step Header Bar */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#0F2942] dark:text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                <span>CSV Bulk Upload &amp; PostgreSQL Integrity Pipeline</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Upload a CSV file and click Process CSV to parse and validate universities or programmes via /api/admin/bulk-upload before saving.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium">
              {[
                { id: 1, label: '1. Upload CSV' },
                { id: 2, label: '2. Validate Integrity' },
                { id: 3, label: '3. PostgreSQL Commit' },
              ].map((s) => (
                <span
                  key={s.id}
                  className={
                    step === s.id
                      ? 'text-[#0F2942] dark:text-blue-400 font-semibold border-b-2 border-[#0F2942] dark:border-blue-400 pb-1'
                      : step > s.id
                        ? 'text-emerald-700 dark:text-emerald-400 pb-1'
                        : 'text-slate-400 pb-1'
                  }
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STEP 1: FILE UPLOAD & INLINE EDITOR */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-8">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Step 1: Upload CSV File &amp; Select Dataset</CardTitle>
                  <CardDescription>
                    Upload a .csv file or edit the preview below, then click Process CSV.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={() => switchEntityType('universities')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                      entityType === 'universities'
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Universities
                  </button>
                  <button
                    type="button"
                    onClick={() => switchEntityType('programmes')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                      entityType === 'programmes'
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Programmes &amp; Requirements
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <FileUpload
                accept=".csv,text/csv"
                maxSizeBytes={2 * 1024 * 1024}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onError={(msg) => toast.error(msg)}
                label={`Drop ${entityType} CSV file here or click to browse`}
                helperText="Supports RFC-4180 .csv files up to 2 MB"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  CSV Preview / Inline Editor ({csvText.split(/\r?\n/).filter(Boolean).length} lines)
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    downloadFile(
                      entityType === 'universities'
                        ? 'applysmart_universities_template.csv'
                        : 'applysmart_programmes_template.csv',
                      entityType === 'universities'
                        ? SAMPLE_UNIVERSITIES_CSV
                        : SAMPLE_PROGRAMMES_CSV
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Template</span>
                </Button>
              </div>

              <Textarea
                className="min-h-56 font-mono text-xs leading-relaxed"
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setSelectedFile(null);
                  setReport(null);
                }}
                placeholder="Paste CSV headers and rows here..."
              />

              <div className="flex items-center justify-between gap-3 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedFile(null);
                    setCsvText(
                      entityType === 'universities'
                        ? SAMPLE_UNIVERSITIES_CSV
                        : SAMPLE_PROGRAMMES_CSV
                    );
                  }}
                >
                  Load Sample CSV
                </Button>

                <Button
                  type="button"
                  onClick={() => processCsvMutation.mutate()}
                  disabled={(!selectedFile && !csvText.trim()) || processCsvMutation.isPending}
                >
                  <span>
                    {processCsvMutation.isPending
                      ? 'Processing CSV...'
                      : 'Process CSV'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle className="text-base">
                {entityType === 'universities'
                  ? 'University CSV Schema'
                  : 'Programme CSV Schema'}
              </CardTitle>
              <CardDescription>
                Validation rules enforced before saving to PostgreSQL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {entityType === 'universities' ? (
                <>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white mb-1">
                      Required Columns
                    </p>
                    <p className="font-mono text-slate-600 dark:text-slate-300 leading-relaxed">
                      name, country, city, official_website
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white mb-1">
                      Optional Columns
                    </p>
                    <p className="font-mono text-slate-600 dark:text-slate-300 leading-relaxed">
                      institution_type (Public/Private), global_ranking, contact_email,
                      description, source_url, last_verified_date (YYYY-MM-DD),
                      verification_status
                    </p>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
                    <p>• Validates http(s) URLs, email syntax, and ISO dates.</p>
                    <p>• Detects intra-CSV duplicates and existing PostgreSQL records by Name + Country.</p>
                    <p>• Automatically creates corresponding records in the Data Sources queue.</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white mb-1">
                      Required Columns
                    </p>
                    <p className="font-mono text-slate-600 dark:text-slate-300 leading-relaxed">
                      university_name (or university_id), name, degree_level, subject_area,
                      duration, tuition_fee, currency, intake, official_programme_url
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white mb-1">
                      Requirements &amp; Optional Columns
                    </p>
                    <p className="font-mono text-slate-600 dark:text-slate-300 leading-relaxed">
                      min_cgpa, cgpa_scale, min_percentage, required_degree_background,
                      accepted_degree_fields (;), ielts_overall, ielts_listening,
                      ielts_reading, ielts_writing, ielts_speaking, toefl_min, duolingo_min,
                      required_documents (;), application_opening_date, application_deadline,
                      scholarship_availability, tuition_fee_usd_approx, application_fee
                    </p>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
                    <p>• Verifies foreign key against existing PostgreSQL universities before saving.</p>
                    <p>• Enforces CGPA &le; Scale, IELTS 0–9 range, and Opening Date &le; Deadline.</p>
                    <p>• Inserts both Programme and Entry Requirements atomically inside a single transaction.</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2: VALIDATION REPORT & PRE-COMMIT CHECKS */}
      {step === 2 && report && (
        <div className="space-y-6">
          {report.missingRequiredHeaders.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-200 flex items-start gap-3">
              <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Missing Required CSV Columns</p>
                <p className="text-xs mt-1">
                  Required column(s) not found in header row:{' '}
                  <span className="font-mono font-semibold">
                    {report.missingRequiredHeaders.join(', ')}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Total Rows', value: report.summary.totalRows, cls: 'text-[#0F2942] dark:text-white' },
              { label: 'Clean Valid', value: report.summary.validRows, cls: 'text-emerald-700 dark:text-emerald-400' },
              { label: 'Warnings', value: report.summary.warningRows, cls: 'text-amber-700 dark:text-amber-400' },
              { label: 'Errors', value: report.summary.errorRows, cls: 'text-red-700 dark:text-red-400' },
              { label: 'DB Duplicates', value: report.summary.duplicateRows, cls: 'text-slate-700 dark:text-slate-300' },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${stat.cls}`}>
                    {stat.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Commit Policies & Filters */}
          <Card>
            <CardContent className="pt-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6 text-xs text-slate-700 dark:text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                  />
                  <span>Skip existing PostgreSQL duplicates</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipInvalidRows}
                    onChange={(e) => setSkipInvalidRows(e.target.checked)}
                  />
                  <span>Allow partial import (skip rows with errors)</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  className="w-44 h-9 text-xs"
                  value={rowFilter}
                  onChange={(e) => setRowFilter(e.target.value)}
                >
                  <option value="all">Show All Rows ({report.rows.length})</option>
                  <option value="errors">Errors Only ({report.summary.errorRows})</option>
                  <option value="warnings">Warnings ({report.summary.warningRows})</option>
                  <option value="valid">Clean Valid ({report.summary.validRows})</option>
                  <option value="duplicates">DB Duplicates ({report.summary.duplicateRows})</option>
                </Select>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={downloadValidationReport}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Report</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Row-by-row Validation Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Row-by-Row Integrity Inspection</CardTitle>
              <CardDescription>
                Verify foreign keys, data types, and constraint checks prior to PostgreSQL commit.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4">Row</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Record</th>
                    <th className="py-2.5 pr-4">PostgreSQL Match</th>
                    <th className="py-2.5">Validation Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.map((row) => (
                    <tr key={row.rowNumber} className="align-top">
                      <td className="py-3 pr-4 font-mono text-slate-500">#{row.rowNumber}</td>
                      <td className="py-3 pr-4 whitespace-nowrap font-medium">
                        {row.status === 'error' ? (
                          <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400">
                            <XCircle className="h-3.5 w-3.5" />
                            Error
                          </span>
                        ) : row.status === 'warning' ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Warning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Valid
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {row.raw.name || '(Missing name)'}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {entityType === 'universities'
                            ? `${row.raw.city || '?'}, ${row.raw.country || '?'}`
                            : `${row.raw.university_name || row.raw.university_id || '?'} · ${row.raw.degree_level || '?'}`}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                        {entityType === 'universities' ? (
                          row.isDuplicateInDb ? (
                            <span className="text-amber-700 dark:text-amber-400">
                              Duplicate (#{row.resolvedUniversityId})
                            </span>
                          ) : (
                            <span>New university</span>
                          )
                        ) : row.resolvedUniversityId ? (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            FK: {row.resolvedUniversityName} (#{row.resolvedUniversityId})
                            {row.isDuplicateInDb ? ' · Already exists' : ''}
                          </span>
                        ) : (
                          <span className="text-red-700 dark:text-red-400">Unresolved FK</span>
                        )}
                      </td>
                      <td className="py-3 space-y-1">
                        {row.errors.map((err, i) => (
                          <p key={`e-${i}`} className="text-red-700 dark:text-red-400">
                            • {err}
                          </p>
                        ))}
                        {row.warnings.map((w, i) => (
                          <p key={`w-${i}`} className="text-amber-700 dark:text-amber-400">
                            • {w}
                          </p>
                        ))}
                        {row.errors.length === 0 && row.warnings.length === 0 && (
                          <p className="text-slate-500">All schema &amp; integrity checks passed.</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" />
              <span>Edit CSV Data</span>
            </Button>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {commitBlockedReason && (
                <p className="text-xs text-red-700 dark:text-red-400">{commitBlockedReason}</p>
              )}
              <Button
                type="button"
                disabled={Boolean(commitBlockedReason) || commitMutation.isPending}
                onClick={() => commitMutation.mutate()}
              >
                <Database className="h-4 w-4" />
                <span>
                  {commitMutation.isPending
                    ? 'Committing Transaction...'
                    : `Save ${eligibleToCommitCount} Validated Row(s) to PostgreSQL`}
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: COMMIT SUMMARY */}
      {step === 3 && commitResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span>PostgreSQL Bulk Import Complete</span>
            </CardTitle>
            <CardDescription>
              Transaction committed atomically and logged in Admin Audit Logs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500">Records Inserted</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                  {commitResult.importedCount}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500">Duplicates Skipped</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-700 dark:text-slate-300 mt-1">
                  {commitResult.skippedDuplicatesCount}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500">Error Rows Skipped</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-700 dark:text-slate-300 mt-1">
                  {commitResult.skippedErrorRowsCount}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => {
                  setStep(1);
                  setSelectedFile(null);
                  setReport(null);
                  setCommitResult(null);
                }}
              >
                Import Another CSV Batch
              </Button>
              {onNavigateTab && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onNavigateTab('catalog')}
                  >
                    View Catalog
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onNavigateTab('verification')}
                  >
                    Open Verification Queue
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
