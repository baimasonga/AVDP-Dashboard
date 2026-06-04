import React, { useState } from "react";
import { User, UserRole } from "../types";
import { signIn } from "../lib/db";
import { Key, Shield, User as UserIcon, Lock, AlertCircle, Sparkles } from "lucide-react";

interface AuthModalProps {
  currentUser: User | null;
  onLogout: () => void;
}

export default function AuthModal({ currentUser, onLogout }: AuthModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STAKEHOLDER);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Quick Preset credentials to make demoing easy (these are real Supabase Auth users)
  const Presets = [
    {
      name: "Mohamed Bangura (Admin)",
      email: "admin@avdp.org.sl",
      password: "adminPassword2026",
      role: UserRole.ADMIN,
      desc: "Full database schema controls, CSV imports, alert parameters."
    },
    {
      name: "Sorie Kamara (Kenema Officer)",
      email: "officer.kenema@avdp.org.sl",
      password: "kenemaOfficer7",
      role: UserRole.OFFICER,
      district: "Kenema",
      desc: "Update metrics exclusive to Kenema district."
    },
    {
      name: "Dr. Elena Rossi (IFAD Auditor)",
      email: "ifad.auditor@avdp.org.sl",
      password: "ifadPassword",
      role: UserRole.STAKEHOLDER,
      desc: "Read-only access, thresholds setup, export reports."
    }
  ];

  const handlePresetClick = (preset: typeof Presets[0]) => {
    setEmail(preset.email);
    setPassword(preset.password);
    setSelectedRole(preset.role);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all security parameter credentials.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Real authentication against Supabase Auth. Roles/districts come from the
      // user's server-side profile — they cannot be chosen or spoofed by the client.
      await signIn(email, password);
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Try one of the quick presets below.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative inline-block" id="auth-manager-root">
      {currentUser ? (
        <div className="flex items-center gap-3 bg-[#1e293b] border border-emerald-500/20 px-3 py-1.5 rounded-lg">
          <div className="flex flex-col text-right">
            <span className="text-xs font-semibold text-gray-200">{currentUser.name}</span>
            <span className="text-[10px] text-emerald-400 font-mono tracking-wider uppercase flex items-center justify-end gap-1">
              <Shield className="w-2.5 h-2.5" />
              {currentUser.role} {currentUser.district ? `(${currentUser.district})` : ""}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="text-xs bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 px-2.5 py-1.5 rounded-md transition-all cursor-pointer font-medium"
            id="auth-logout-btn"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg transition-all shadow-md shadow-emerald-950/20 cursor-pointer"
          id="auth-login-trigger"
        >
          <Lock className="w-3.5 h-3.5" />
          Secure Admin Login
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] rounded-2xl w-full max-w-lg border border-slate-700/50 shadow-2xl shadow-black overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-emerald-900/50 to-teal-950/50 px-6 py-4 border-b border-slate-700/50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-slate-100 tracking-tight">
                  AVDP Secure Authentication Gate
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setError(null);
                }}
                className="text-gray-400 hover:text-white text-lg font-medium p-1 transition-all"
              >
                &times;
              </button>
            </div>

            <div className="p-6">
              <p className="text-xs text-slate-400 leading-relaxed mb-5">
                Role-Based Access Control (RBAC) regulates operations according to stakeholder profile. Logged field transactions require verified digital credentials to prevent data contamination.
              </p>

              {error && (
                <div className="bg-red-950/30 border border-red-500/40 text-red-300 p-3 rounded-lg text-xs flex items-start gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono tracking-wider uppercase text-slate-400 mb-1.5 font-semibold">
                    Credential Email Address
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. officer.kenema@avdp.org.sl"
                      className="w-full bg-slate-900/60 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono tracking-wider uppercase text-slate-400 mb-1.5 font-semibold">
                    Security Key / Password
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-900/60 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                  Your access role (Admin / Officer / Stakeholder) is determined by your
                  server-side profile and enforced by database Row Level Security — it
                  cannot be selected here.
                </p>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-lg transition-all tracking-wider uppercase shadow-md shadow-emerald-900/20 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Authenticating…" : "Verify Access Authorization"}
                </button>
              </form>

              {/* Quick Preset Buttons Container */}
              <div className="mt-6 pt-5 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 mb-3 font-semibold font-mono tracking-wide uppercase">
                  <Sparkles className="w-3.5 h-3.5" />
                  Quick Access Testing Presets
                </div>
                <div className="space-y-2.5">
                  {Presets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className="w-full text-left bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/20 p-2.5 rounded-lg transition-all flex justify-between items-center cursor-pointer group"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-300 transition-all font-mono">
                          {preset.name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {preset.desc}
                        </div>
                      </div>
                      <span className="text-[9px] font-mono border border-emerald-500/30 text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded uppercase font-semibold">
                        {preset.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
