"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  User,
  Mail,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  LogOut,
  ArrowLeft,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Users,
  Award,
  Filter,
} from "lucide-react";

interface CertificateRecord {
  id: string;
  name: string;
  email: string;
  type?: "participant" | "volunteer";
  fileUrl: string;
  certificateUrl?: string;
  filename?: string;
}

interface Stats {
  total: number;
  participantsCount: number;
  volunteersCount: number;
}

const ADMIN_EMAIL = "dhruvg.cs24@bmsce.ac.in";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginEmail, setLoginEmail] = useState(ADMIN_EMAIL);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Dashboard state
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, participantsCount: 0, volunteersCount: 0 });
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "participant" | "volunteer">("all");

  // Add form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newType, setNewType] = useState<"participant" | "volunteer">("participant");
  const [addLoading, setAddLoading] = useState(false);
  const [addMessage, setAddMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Verify session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/admin/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
            return;
          }
        }
      } catch {
        // Not authenticated
      }
      setIsAuthenticated(false);
    }
    checkAuth();
  }, []);

  // Fetch certificates when authenticated
  const fetchCertificates = async () => {
    setLoadingCerts(true);
    try {
      const res = await fetch("/api/admin/certificates");
      if (res.ok) {
        const data = await res.json();
        setCertificates(data.certificates || []);
        if (data.stats) {
          setStats(data.stats);
        }
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error("Failed to load certificates:", e);
    } finally {
      setLoadingCerts(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCertificates();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setLoginPassword("");
      } else {
        setLoginError(data.message || "Authentication failed.");
      }
    } catch {
      setLoginError("Network connection error. Try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } catch {
      // Ignore
    }
    setIsAuthenticated(false);
  };

  const handleAddCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      setAddMessage({ type: "error", text: "Please provide both recipient name and email." });
      return;
    }

    setAddLoading(true);
    setAddMessage(null);

    try {
      const res = await fetch("/api/admin/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          type: newType,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAddMessage({
          type: "success",
          text: `Issued certificate ${data.certificate.id} for ${data.certificate.name}!`,
        });
        setNewName("");
        setNewEmail("");
        fetchCertificates();
      } else {
        setAddMessage({
          type: "error",
          text: data.message || "Failed to create certificate.",
        });
      }
    } catch {
      setAddMessage({ type: "error", text: "Network error creating certificate." });
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete certificate ${id} for ${name}?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/certificates?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchCertificates();
      } else {
        alert("Failed to delete certificate.");
      }
    } catch {
      alert("Network error deleting certificate.");
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered list
  const filteredCertificates = certificates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const certType = c.type || (c.id.startsWith("VOL") ? "volunteer" : "participant");
    if (typeFilter !== "all" && certType !== typeFilter) return false;

    return true;
  });

  // Loading screen during session check
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-zinc-500 font-mono">
          <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
          <span>Verifying admin session...</span>
        </div>
      </div>
    );
  }

  // Login View
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between antialiased selection:bg-zinc-800">
        <header className="border-b border-zinc-800 bg-zinc-950 py-4 px-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Public Portal</span>
          </Link>
          <span className="text-xs font-mono text-zinc-500">Security: Restricted Access</span>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center">
                <Lock className="w-5 h-5 text-zinc-300" />
              </div>
              <h1 className="text-xl font-semibold text-zinc-100">TeamCodeLocked Admin</h1>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Management portal restricted strictly to{" "}
                <code className="text-zinc-200 font-mono">{ADMIN_EMAIL}</code>.
              </p>
            </div>

            {loginError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start gap-2.5 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 block">Admin Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder={ADMIN_EMAIL}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-zinc-300">Admin Password</label>
                  <span className="text-[11px] text-zinc-500">Default: codelocked2026</span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Authenticate as Admin</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </main>

        <footer className="border-t border-zinc-800 py-4 px-6 text-center text-xs text-zinc-500">
          © 2026 TeamCodeLocked. Admin authentication strictly enforced.
        </footer>
      </div>
    );
  }

  // Authenticated Admin Dashboard
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between antialiased selection:bg-zinc-800">
      {/* Admin Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Portal</span>
            </Link>
            <span className="text-zinc-700">/</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-100">Admin Dashboard</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/80 text-emerald-400">
                ACTIVE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
              <User className="w-3.5 h-3.5 text-zinc-500" />
              <span>{ADMIN_EMAIL}</span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 text-zinc-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Total Issued</span>
              <Award className="w-4 h-4 text-zinc-500" />
            </div>
            <p className="text-2xl font-semibold text-zinc-100">{stats.total}</p>
            <span className="text-[11px] text-zinc-500">Live in certificates.json</span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Participants</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-semibold text-zinc-100">{stats.participantsCount}</p>
            <span className="text-[11px] text-zinc-500">Template: Participation (2.png)</span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Volunteers</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-semibold text-zinc-100">{stats.volunteersCount}</p>
            <span className="text-[11px] text-zinc-500">Template: Appreciation (Volunteer 2.png)</span>
          </div>
        </div>

        {/* Add Certificate Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-zinc-400" />
                Issue New Certificate
              </h2>
              <p className="text-xs text-zinc-400">
                Dynamically renders a new high-resolution certificate and appends it to the live database.
              </p>
            </div>
          </div>

          {addMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                addMessage.type === "success"
                  ? "bg-emerald-950/40 border border-emerald-800/80 text-emerald-300"
                  : "bg-red-950/40 border border-red-800/80 text-red-300"
              }`}
            >
              {addMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{addMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleAddCertificate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 block font-medium">Recipient Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 block font-medium">Recipient Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="rahul.cs25@bmsce.ac.in"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 block font-medium">Certificate Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as "participant" | "volunteer")}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="participant">Participant (Participation)</option>
                <option value="volunteer">Volunteer (Appreciation)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={addLoading}
              className="w-full py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 h-[34px]"
            >
              {addLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Issue Certificate</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Certificates Table & Search */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden space-y-4 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Issued Certificates Directory</h2>
              <p className="text-xs text-zinc-400">
                Displaying {filteredCertificates.length} of {certificates.length} records.
              </p>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg bg-zinc-950 p-1 border border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => setTypeFilter("all")}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    typeFilter === "all" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  All ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter("participant")}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    typeFilter === "participant"
                      ? "bg-zinc-800 text-zinc-100 font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Participants ({stats.participantsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter("volunteer")}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    typeFilter === "volunteer"
                      ? "bg-zinc-800 text-zinc-100 font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Volunteers ({stats.volunteersCount})
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter name, email, ID..."
                  className="pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 w-48 sm:w-56"
                />
              </div>

              <button
                onClick={fetchCertificates}
                className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
                title="Refresh database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCerts ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-zinc-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Unique ID</th>
                  <th className="py-2.5 px-3">Recipient Name</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Certificate</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {filteredCertificates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs">
                      No matching certificate records found.
                    </td>
                  </tr>
                ) : (
                  filteredCertificates.slice(0, 100).map((c) => {
                    const isVol = c.type === "volunteer" || c.id.startsWith("VOL");
                    return (
                      <tr key={c.id} className="hover:bg-zinc-950/60 transition-colors">
                        <td className="py-2 px-3 font-mono text-zinc-200">{c.id}</td>
                        <td className="py-2 px-3 font-medium text-zinc-100">{c.name}</td>
                        <td className="py-2 px-3 text-zinc-400">{c.email}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                              isVol
                                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/80"
                                : "bg-blue-950/80 text-blue-400 border border-blue-800/80"
                            }`}
                          >
                            {isVol ? "Volunteer" : "Participant"}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <a
                            href={c.fileUrl || c.certificateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-400 hover:text-white inline-flex items-center gap-1 font-mono text-[11px] transition-colors"
                          >
                            <FileText className="w-3 h-3 text-zinc-500" />
                            <span>Preview</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                          </a>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleDelete(c.id, c.name)}
                            disabled={deletingId === c.id}
                            className="p-1 rounded hover:bg-red-950/60 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-40"
                            title={`Delete ${c.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredCertificates.length > 100 && (
            <p className="text-[11px] text-zinc-500 text-center pt-2">
              Showing first 100 of {filteredCertificates.length} items. Use the search bar above to narrow down.
            </p>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-6 px-4 sm:px-6 text-xs text-zinc-500 text-center">
        © 2026 TeamCodeLocked. All rights reserved. Built by Dhruv G Nayak &amp; Technical, Design and Marketing Team of TeamCodeLocked.
      </footer>
    </div>
  );
}
