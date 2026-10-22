"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Mail,
  Fingerprint,
  Calendar,
  ShieldCheck,
  FileText,
  Maximize2,
  X,
  Swords,
  Trophy,
  BarChart3,
  Flame,
  ArrowRight,
  Code2,
  Lock,
  HeartHandshake,
  UserCheck,
} from "lucide-react";

interface Certificate {
  id: string;
  name: string;
  email: string;
  type?: "participant" | "volunteer";
  fileUrl: string;
  certificateUrl?: string;
  filename?: string;
  organization?: string;
  college?: string;
  event?: string;
  partner?: string;
  partnerUrl?: string;
  emailDelivery?: {
    sent: boolean;
    alreadySent?: boolean;
    skipped?: boolean;
    sentAt?: string;
    message?: string;
    error?: string;
  };
}

export default function CertificatePortal() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);



  const handleSearch = async (searchQuery?: string) => {
    const term = (searchQuery ?? query).trim();
    if (!term) {
      setError("Please enter your registered email address or Unique ID.");
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    setError(null);
    setCertificate(null);

    try {
      const response = await fetch(
        `/api/certificates?q=${encodeURIComponent(term)}`
      );
      const data = await response.json();

      if (response.ok && data.success && (data.certificate || data.id)) {
        const certData = data.certificate || data;
        setCertificate({
          ...certData,
          type: certData.type || (certData.id.startsWith("VOL") ? "volunteer" : "participant"),
          fileUrl: certData.fileUrl || certData.certificateUrl || `/certificates/${certData.id}.png`,
        });
        setError(null);
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      } else {
        setCertificate(null);
        setError(
          data.message ||
            `No certificate found matching "${term}". Verify your credentials or check with the club coordinator.`
        );
      }
    } catch {
      setError("A network error occurred. Please try again in a few moments.");
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };



  const handleCopyId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!certificate) return;
    const certUrl = certificate.fileUrl || certificate.certificateUrl;
    if (!certUrl) return;

    try {
      const response = await fetch(certUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const cleanName = certificate.name.replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `Certificate_${cleanName}_${certificate.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      const link = document.createElement("a");
      link.href = certUrl;
      link.download = certificate.filename || `${certificate.id}.png`;
      link.target = "_blank";
      link.click();
    }
  };

  const isVolunteer = certificate?.type === "volunteer" || certificate?.id.startsWith("VOL");

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#090d16] text-slate-100 antialiased selection:bg-fuchsia-500/30 selection:text-fuchsia-200">
      {/* Header / Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shrink-0">
              <Image
                src="/logo-white.png"
                alt="TeamCodeLocked Logo"
                width={32}
                height={32}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  TeamCodeLocked Certificates
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Powered by{" "}
                <a
                  href="https://bitbybit-9h8e.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 hover:text-orange-300 font-semibold underline decoration-orange-500/40 hover:decoration-orange-400 transition-colors"
                >
                  BitByBit ↗
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Admin Portal</span>
            </Link>

            <a
              href="https://bitbybit-9h8e.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 hover:from-violet-500 hover:via-fuchsia-500 hover:to-orange-400 text-white transition-all active:scale-[0.98]"
            >
              <Swords className="w-4 h-4" />
              <span>BitByBit Arena</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col items-center">
        {/* Search Hero */}
        <div className="text-center max-w-2xl mb-8 space-y-3.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
            <span>Participant &amp; Volunteer Certificate Portal</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Claim Your Orientation{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-400 bg-clip-text text-transparent">
              Certificate
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Enter your registered BMSCE email address or Unique ID (e.g.{" "}
            <code className="text-white font-mono bg-slate-900 px-1 py-0.5 rounded border border-slate-800 text-xs">
              PAR-001
            </code>{" "}
            or{" "}
            <code className="text-white font-mono bg-slate-900 px-1 py-0.5 rounded border border-slate-800 text-xs">
              VOL-001
            </code>
            ) to view, verify, and download your credential.
          </p>
        </div>

        {/* Central Search Card */}
        <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
          <form onSubmit={handleFormSubmit} className="space-y-3">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-fuchsia-400 absolute left-3.5 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                id="participant-search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="devballav.ch26@bmsce.ac.in or PAR-001"
                className="w-full pl-10 pr-24 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setError(null);
                    setCertificate(null);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-24 mr-2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  title="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="absolute right-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 hover:from-violet-500 hover:via-fuchsia-500 hover:to-orange-400 text-white font-semibold text-xs rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching</span>
                  </>
                ) : (
                  <span>Search</span>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Case-insensitive search
              </span>
              <span className="text-slate-500">B.M.S. College of Engineering</span>
            </div>
          </form>


        </div>

        {/* Error State */}
        {error && (
          <div className="w-full max-w-xl mt-4 p-4 bg-rose-950/40 border border-rose-500/30 rounded-xl text-sm text-rose-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-rose-300">Certificate not found</p>
                <p className="text-xs text-rose-200/80 mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Result View */}
        {certificate && (
          <div ref={resultRef} className="w-full max-w-3xl mt-8 space-y-6">
            {/* Result Header & Greeting */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    {isVolunteer ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80 inline-flex items-center gap-1">
                        <HeartHandshake className="w-3 h-3" />
                        Volunteer Certificate of Appreciation
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/80 inline-flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        Participant Certificate of Participation
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Hello, <span className="text-fuchsia-300">{certificate.name}</span>!
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300">
                    {isVolunteer
                      ? "Thank you for your invaluable contribution as a Volunteer in the TeamCodeLocked Orientation!"
                      : "Congratulations on participating in the TeamCodeLocked Club Orientation!"}
                  </p>
                  {certificate.emailDelivery?.sent && (
                    <div className="pt-1.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-medium">
                        <Mail className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Official certificate copy emailed to {certificate.email}</span>
                      </span>
                    </div>
                  )}
                  {certificate.emailDelivery?.alreadySent && (
                    <div className="pt-1.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-950/80 border border-blue-800 text-blue-300 text-xs font-medium">
                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                        <span>Certificate was already emailed to {certificate.email}. You can download it directly below.</span>
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleDownload}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 hover:from-violet-500 hover:via-fuchsia-500 hover:to-orange-400 text-white font-bold rounded-xl text-xs sm:text-sm transition-all active:scale-[0.98] shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Download Certificate
                </button>
              </div>
            </div>

            {/* Certificate Preview Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span className="font-semibold text-slate-300">
                    {isVolunteer ? "Certificate of Appreciation" : "Certificate of Participation"}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>{certificate.filename || `${certificate.id}.png`}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setModalOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Enlarge</span>
                  </button>
                  <button
                    onClick={() => handleCopyId(certificate.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Preview Image Frame */}
              <div
                className="p-3 sm:p-5 bg-slate-950 flex items-center justify-center cursor-pointer"
                onClick={() => setModalOpen(true)}
              >
                <div className="relative w-full aspect-[2000/1414] max-w-2xl rounded-lg border border-slate-800 overflow-hidden bg-slate-950">
                  <Image
                    src={certificate.fileUrl || certificate.certificateUrl || `/certificates/${certificate.id}.png`}
                    alt={`Certificate for ${certificate.name}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 750px"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              {/* Metadata Details */}
              <div className="px-5 py-4 bg-slate-900 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Unique ID</span>
                  <span className="font-mono font-semibold text-slate-200">{certificate.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Category</span>
                  <span className="font-semibold text-zinc-100 uppercase font-mono text-[11px]">
                    {isVolunteer ? "Volunteer" : "Participant"}
                  </span>
                </div>
                <div className="truncate">
                  <span className="text-slate-500 block">Registered Email</span>
                  <span className="text-slate-200 truncate block font-medium">{certificate.email}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Institution</span>
                  <span className="text-slate-200 font-medium">{certificate.college || "B.M.S. College of Engineering"}</span>
                </div>
              </div>
            </div>

            {/* Growth Funnel Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold tracking-wide">
                    <Flame className="w-3.5 h-3.5 fill-orange-400" />
                    <span>NEXT LEVEL CODING ARENA</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Take Your Skills Beyond Orientation with{" "}
                    <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-400 bg-clip-text text-transparent">
                      BitByBit
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                    BitByBit is TeamCodeLocked&apos;s competitive coding platform. Test your speed, solve algorithmic puzzles, and battle peers in real-time.
                  </p>
                </div>

                <a
                  href="https://bitbybit-9h8e.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 hover:from-violet-500 hover:via-fuchsia-500 hover:to-orange-400 text-white font-bold text-xs sm:text-sm transition-all active:scale-[0.98] shrink-0"
                >
                  <span>Launch BitByBit Arena</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {/* Three Value Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center text-violet-400">
                      <Swords className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-100">1v1 Code Duels</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Match with peers in live, head-to-head algorithmic speed contests.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-md bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400">
                      <Trophy className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-100">Ranked Contests</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Compete in scheduled weekend club contests to boost your rating.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-md bg-orange-500/10 flex items-center justify-center text-orange-400">
                      <BarChart3 className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-100">Leaderboards</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Track your ranking against the best coders in TeamCodeLocked and BMSCE.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <span>Free &amp; open to all BMSCE students</span>
                <a
                  href="https://bitbybit-9h8e.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fuchsia-400 hover:text-orange-400 font-semibold transition-colors inline-flex items-center gap-1"
                >
                  <span>bitbybit-9h8e.vercel.app</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Search Again Action */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setCertificate(null);
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Search for another attendee
              </button>
            </div>
          </div>
        )}

        {/* Feature Grid when no result is active */}
        {!certificate && (
          <div className="w-full max-w-3xl mt-14 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <h3 className="text-xs font-bold text-slate-200 mb-1">Dual Certificate Templates</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Dedicated templates for Participants (Participation) and Volunteers (Appreciation).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <h3 className="text-xs font-bold text-slate-200 mb-1">Official Signatures</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Authorized by Prof. Namratha M., Pannag K., and Aakanshya A. for TeamCodeLocked.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <h3 className="text-xs font-bold text-slate-200 mb-1">2000×1414 PNG</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  High-resolution raster output ready for LinkedIn certifications and portfolios.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Fullscreen Preview Modal */}
      {modalOpen && certificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative max-w-4xl w-full flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-2.5 text-slate-300 text-xs">
              <span className="font-semibold text-white">
                {certificate.name} — {isVolunteer ? "Certificate of Appreciation" : "Certificate of Participation"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownload}
                  className="px-3 py-1 rounded-lg bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 text-white font-bold text-xs"
                >
                  Download
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative w-full aspect-[2000/1414] rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
              <Image
                src={certificate.fileUrl || certificate.certificateUrl || `/certificates/${certificate.id}.png`}
                alt={certificate.name}
                fill
                sizes="(max-width: 1280px) 100vw, 1000px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 px-4 sm:px-6 text-xs text-slate-400">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-white.png"
              alt="CodeLocked Logo"
              width={24}
              height={24}
              className="object-contain opacity-80"
            />
            <p>
              © 2026 TeamCodeLocked. All rights reserved. Built by Dhruv G Nayak &amp; Technical, Design and Marketing Team of TeamCodeLocked.
            </p>
          </div>

          <a
            href="https://bitbybit-9h8e.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-orange-400 transition-colors inline-flex items-center gap-1"
          >
            <span>bitbybit-9h8e.vercel.app</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
