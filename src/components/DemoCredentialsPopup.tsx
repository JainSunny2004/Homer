import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Zap, X } from 'lucide-react';
import { DEMO_CREDENTIALS } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';

interface DemoCredentialsPopupProps {
  onFill?: (email: string, password: string) => void;
}

const ROLE_CONFIG = [
  {
    key:         'admin',
    label:       'Admin',
    description: 'Full access — manage users, fences, workers, settings and all alerts.',
    accent:      { light: '#fef2f2', border: '#fca5a5', badge: '#dc2626', text: '#7f1d1d' },
  },
  {
    key:         'manager',
    label:       'Manager',
    description: 'Create fences, assign workers, acknowledge & silence alerts, edit settings.',
    accent:      { light: '#eff6ff', border: '#93c5fd', badge: '#2563eb', text: '#1e3a5f' },
  },
  {
    key:         'supervisor',
    label:       'Supervisor',
    description: 'Assign workers, acknowledge & silence alerts. Cannot edit settings.',
    accent:      { light: '#f0fdf4', border: '#86efac', badge: '#16a34a', text: '#14532d' },
  },
  {
    key:         'worker',
    label:       'Worker',
    description: 'View-only access to assigned fence and location.',
    accent:      { light: '#fafafa', border: '#d4d4d4', badge: '#737373', text: '#404040' },
  },
] as const;

const MANAGER_ROLES = ['admin', 'manager', 'supervisor'];

export const DemoCredentialsPopup = ({ onFill }: DemoCredentialsPopupProps) => {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [open,     setOpen]    = useState(false);
  const [copied,   setCopied]  = useState<string | null>(null);
  const [loading,  setLoading] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleUse = (role: keyof typeof DEMO_CREDENTIALS) => {
    const { email, password } = DEMO_CREDENTIALS[role];
    onFill?.(email, password);
    setLoading(role);
    const result = login(email, password);
    if (result.success) {
      setOpen(false);
      navigate(MANAGER_ROLES.includes(role) ? '/dashboard' : '/worker-dashboard');
    }
    setLoading(null);
  };

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/30 transition-all duration-200"
      >
        <Zap className="h-3.5 w-3.5" />
        Demo Credentials
      </button>

      {/* ── Modal overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'hsl(0,0%,0%,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="relative w-full max-w-md bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
            style={{ boxShadow: '0 24px 60px -12px hsl(0,0%,0%,0.35)' }}
          >

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Demo Credentials</p>
                  <p className="text-[11px] text-muted-foreground">Click any role to sign in instantly</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Role cards */}
            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {ROLE_CONFIG.map(({ key, label, description, accent }) => {
                const cred      = DEMO_CREDENTIALS[key as keyof typeof DEMO_CREDENTIALS];
                const isLoading = loading === key;

                return (
                  <div
                    key={key}
                    className="rounded-xl border p-3.5 transition-all duration-150 hover:shadow-sm"
                    style={{ borderColor: accent.border, backgroundColor: accent.light }}
                  >
                    {/* Role header */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full border"
                        style={{
                          backgroundColor: '#fff',
                          borderColor:      accent.border,
                          color:            accent.text,
                        }}
                      >
                        {label}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUse(key as keyof typeof DEMO_CREDENTIALS)}
                        disabled={isLoading}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
                        style={{
                          borderColor:     accent.border,
                          color:           '#fff',
                          backgroundColor: accent.badge,
                        }}
                      >
                        {isLoading ? (
                          <>
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10"
                                stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Signing in…
                          </>
                        ) : (
                          <>Use this →</>
                        )}
                      </button>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] leading-snug mb-2.5" style={{ color: accent.text, opacity: 0.8 }}>
                      {description}
                    </p>

                    {/* Credentials rows */}
                    <div className="space-y-1.5">

                      {/* Email */}
                      <div className="flex items-center justify-between gap-2 bg-white/70 border rounded-lg px-3 py-1.5"
                        style={{ borderColor: accent.border }}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40"
                            style={{ color: accent.text }}>
                            Email
                          </span>
                          <span className="font-mono text-[11px] truncate" style={{ color: accent.text }}>
                            {cred.email}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(cred.email, `${key}-email`)}
                          className="flex-shrink-0 transition-colors"
                          style={{ color: accent.badge }}
                          title="Copy email"
                        >
                          {copied === `${key}-email`
                            ? <Check className="h-3.5 w-3.5 text-green-500" />
                            : <Copy  className="h-3.5 w-3.5" />}
                        </button>
                      </div>

                      {/* Password */}
                      <div className="flex items-center justify-between gap-2 bg-white/70 border rounded-lg px-3 py-1.5"
                        style={{ borderColor: accent.border }}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40"
                            style={{ color: accent.text }}>
                            Pass
                          </span>
                          <span className="font-mono text-[11px]" style={{ color: accent.text }}>
                            {cred.password}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(cred.password, `${key}-pass`)}
                          className="flex-shrink-0 transition-colors"
                          style={{ color: accent.badge }}
                          title="Copy password"
                        >
                          {copied === `${key}-pass`
                            ? <Check className="h-3.5 w-3.5 text-green-500" />
                            : <Copy  className="h-3.5 w-3.5" />}
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal footer */}
            <div className="px-5 py-3 border-t border-border/40 bg-muted/20">
              <p className="text-[10px] text-muted-foreground text-center">
                Click outside or <button type="button" onClick={() => setOpen(false)}
                  className="underline underline-offset-2 hover:text-foreground transition-colors">
                  dismiss
                </button> to close
              </p>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
