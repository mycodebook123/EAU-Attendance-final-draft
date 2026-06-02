import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import {
  downloadAttendanceTemplateApi,
  previewAttendanceImportApi,
  submitAttendanceImportApi,
} from "@/api/axios";

interface Offering {
  id: number;
  course_name: string;
  section_name: string;
  section_year: number;
  programme_name: string;
}

interface AttendanceImportModalProps {
  open: boolean;
  onClose: () => void;
  offering: Offering | undefined;
}

type Step = "download" | "upload" | "preview" | "done";

const STATUS_COLOURS: Record<string, string> = {
  present: "bg-green-100 text-green-700 border-green-300",
  late: "bg-yellow-100 text-yellow-700 border-yellow-300",
  excused: "bg-gray-100  text-gray-600   border-gray-300",
  absent: "bg-red-100   text-red-600    border-red-300",
};

const AttendanceImportModal = ({
  open,
  onClose,
  offering,
}: AttendanceImportModalProps) => {
  const [step, setStep] = useState<Step>("download");

  // ── Download state ────────────────────────────────────────────────────────
  const [dateMode, setDateMode] = useState<"week" | "custom">("week");
  const [weekOption, setWeekOption] = useState<"current" | "last">("current");
  const [customStart, setCustomStart] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [downloading, setDownloading] = useState(false);

  // ── Upload/preview state ──────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [showPreviewRows, setShowPreviewRows] = useState(false);

  // ── Done state ────────────────────────────────────────────────────────────
  const [result, setResult] = useState<any>(null);

  const resetModal = () => {
    setStep("download");
    setFile(null);
    setPreviewData(null);
    setResult(null);
    setShowErrors(false);
    setShowPreviewRows(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // ── Build download params ─────────────────────────────────────────────────
  const getDownloadParams = () => {
    if (dateMode === "custom") {
      return { start_date: customStart, end_date: customEnd };
    }
    const base =
      weekOption === "current"
        ? startOfWeek(new Date(), { weekStartsOn: 1 })
        : startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    return { week_start: format(base, "yyyy-MM-dd") };
  };

  const getWeekLabel = () => {
    if (dateMode === "custom") return `${customStart} → ${customEnd}`;
    const base =
      weekOption === "current"
        ? startOfWeek(new Date(), { weekStartsOn: 1 })
        : startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    const end = endOfWeek(base, { weekStartsOn: 1 });
    return `${format(base, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  };

  // ── Download template ─────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!offering) return;
    setDownloading(true);
    try {
      const params = getDownloadParams();
      const res = await downloadAttendanceTemplateApi(offering.id, params);
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Attendance_${offering.course_name.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Template downloaded! Fill it in and come back to import.");
      setStep("upload");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to download template");
    } finally {
      setDownloading(false);
    }
  };

  // ── File selected ─────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      toast.error("Please upload an Excel file (.xlsx)");
      return;
    }
    setFile(f);
    setPreviewData(null);
  };

  // ── Preview ───────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!file) return;
    setPreviewing(true);
    try {
      const res = await previewAttendanceImportApi(file);
      setPreviewData(res.data);
      setStep("preview");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to parse file");
    } finally {
      setPreviewing(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      const res = await submitAttendanceImportApi(file);
      setResult(res.data);
      setStep("done");
      toast.success(res.data.message);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Import failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step labels ───────────────────────────────────────────────────────────
  const stepLabels: Record<Step, string> = {
    download: "1. Download Template",
    upload: "2. Upload Filled File",
    preview: "3. Review & Confirm",
    done: "Done",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Attendance from Excel
          </DialogTitle>
          {offering && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {offering.course_name} — Section {offering.section_name} · Year{" "}
              {offering.section_year}
            </p>
          )}
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {(["download", "upload", "preview", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["download", "upload", "preview", "done"].indexOf(step) >
                        i
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {["download", "upload", "preview", "done"].indexOf(step) > i ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <span>{i + 1}</span>
                )}
                <span className="hidden sm:inline">
                  {stepLabels[s].split(". ")[1]}
                </span>
              </div>
              {i < 3 && <div className="w-4 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="space-y-5 pt-1">
          {/* ── STEP 1: Download ─────────────────────────────────────────── */}
          {step === "download" && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">How it works</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>
                    Download the Excel template for your course — it comes
                    pre-filled with all enrolled students.
                  </li>
                  <li>
                    Fill in attendance status for each day:{" "}
                    <code className="bg-muted px-1 rounded text-xs">P</code>{" "}
                    Present ·{" "}
                    <code className="bg-muted px-1 rounded text-xs">L</code>{" "}
                    Late ·{" "}
                    <code className="bg-muted px-1 rounded text-xs">E</code>{" "}
                    Excused ·{" "}
                    <code className="bg-muted px-1 rounded text-xs">A</code>{" "}
                    Absent
                  </li>
                  <li>Upload the filled file and review before confirming.</li>
                </ol>
              </div>

              {/* Date range selection */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Date Range for Template
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDateMode("week")}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                      dateMode === "week"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    By Week
                  </button>
                  <button
                    onClick={() => setDateMode("custom")}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                      dateMode === "custom"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Custom Range
                  </button>
                </div>

                {dateMode === "week" && (
                  <div className="flex gap-2">
                    {(["current", "last"] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setWeekOption(opt)}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                          weekOption === opt
                            ? "bg-primary/10 text-primary border-primary/40"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {opt === "current" ? "This Week" : "Last Week"}
                      </button>
                    ))}
                  </div>
                )}

                {dateMode === "custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">From</p>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">To</p>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Template will include weekdays for:{" "}
                  <span className="font-medium text-foreground">
                    {getWeekLabel()}
                  </span>
                </p>
              </div>

              <Button
                onClick={handleDownload}
                disabled={downloading || !offering}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                <Download className="w-4 h-4" />
                {downloading
                  ? "Downloading..."
                  : "Download Attendance Template (.xlsx)"}
              </Button>

              <button
                onClick={() => setStep("upload")}
                className="w-full text-xs text-muted-foreground hover:text-foreground underline"
              >
                Already have a filled template? Skip to upload →
              </button>
            </div>
          )}

          {/* ── STEP 2: Upload ───────────────────────────────────────────── */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">
                  Click to select your filled Excel file
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Only .xlsx files generated by SAMS are accepted
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {file && (
                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border">
                  <FileSpreadsheet className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="p-1 hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("download")}
                  className="flex-1"
                >
                  ← Back
                </Button>
                <Button
                  onClick={handlePreview}
                  disabled={!file || previewing}
                  className="flex-1 bg-primary hover:bg-primary/90 gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {previewing ? "Parsing file..." : "Preview Import"}
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Preview ──────────────────────────────────────────── */}
          {step === "preview" && previewData && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                  <p className="text-2xl font-bold text-green-700">
                    {previewData.valid_count}
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Records to import
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-center">
                  <p className="text-2xl font-bold text-gray-500">
                    {previewData.skipped_count}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Blank cells skipped
                  </p>
                </div>
                <div
                  className={`p-3 rounded-lg border text-center ${previewData.error_count > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}
                >
                  <p
                    className={`text-2xl font-bold ${previewData.error_count > 0 ? "text-red-600" : "text-gray-400"}`}
                  >
                    {previewData.error_count}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${previewData.error_count > 0 ? "text-red-500" : "text-gray-400"}`}
                  >
                    Errors
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 text-sm">
                <span className="font-medium">{previewData.offering_name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · Section {previewData.section}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {previewData.dates?.length} day
                  {previewData.dates?.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Errors */}
              {previewData.error_count > 0 && (
                <div className="border border-destructive/30 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowErrors(!showErrors)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-destructive/5 text-sm font-medium text-destructive"
                  >
                    <span className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {previewData.error_count} errors (will be skipped)
                    </span>
                    {showErrors ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {showErrors && (
                    <div className="divide-y divide-border max-h-40 overflow-y-auto">
                      {previewData.errors.map((e: any, i: number) => (
                        <div key={i} className="px-4 py-2 text-xs">
                          <span className="font-mono font-medium">
                            {e.student_id}
                          </span>
                          {e.date && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {e.date}
                            </span>
                          )}
                          <span className="text-destructive ml-2">
                            {e.error}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Preview rows */}
              {previewData.valid_count > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowPreviewRows(!showPreviewRows)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 text-sm font-medium"
                  >
                    <span>
                      Preview ({Math.min(previewData.valid_count, 100)} of{" "}
                      {previewData.valid_count} records)
                    </span>
                    {showPreviewRows ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {showPreviewRows && (
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 border-b border-border sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Student
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Date
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Status
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Type
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Hrs
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {previewData.preview.map((r: any, i: number) => (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="px-3 py-2 font-medium">
                                {r.student_name}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {r.date}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOURS[r.status] || ""}`}
                                >
                                  {r.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {r.session_type}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {r.hours}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {previewData.valid_count === 0 && (
                <div className="p-4 text-center text-muted-foreground text-sm border border-border rounded-lg">
                  No valid records found in the file. Check that you filled in
                  the yellow cells correctly.
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("upload")}
                  className="flex-1"
                >
                  ← Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || previewData.valid_count === 0}
                  className="flex-1 bg-primary hover:bg-primary/90 gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {submitting
                    ? "Importing..."
                    : `Confirm & Import ${previewData.valid_count} Records`}
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Done ─────────────────────────────────────────────── */}
          {step === "done" && result && (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-display font-semibold">
                  Import Complete!
                </h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {result.message}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                <div className="p-2 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-xl font-bold text-green-700">
                    {result.created}
                  </p>
                  <p className="text-xs text-green-600">New</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xl font-bold text-blue-700">
                    {result.updated}
                  </p>
                  <p className="text-xs text-blue-600">Updated</p>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-xl font-bold text-gray-500">
                    {result.skipped}
                  </p>
                  <p className="text-xs text-gray-500">Skipped</p>
                </div>
              </div>
              {result.error_count > 0 && (
                <p className="text-xs text-destructive">
                  {result.error_count} rows had errors and were skipped.
                </p>
              )}
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetModal();
                  }}
                >
                  Import Another File
                </Button>
                <Button
                  onClick={handleClose}
                  className="bg-primary hover:bg-primary/90"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceImportModal;
