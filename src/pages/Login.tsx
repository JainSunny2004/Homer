import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DemoCredentialsPopup } from '@/components/DemoCredentialsPopup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertCircle, Eye, EyeOff,
  MapPin, Shield, Activity,
  Wifi, WifiOff, AlertTriangle
} from 'lucide-react';
import homerLogo from '@/assets/homer-logo.gif';

/* ── Fake workers for the live visualization ── */
const FAKE_WORKERS = [
  { id: 'WK-001', x: 22,  y: 30,  status: 'in-zone',     zone: 'Dock A'   },
  { id: 'WK-002', x: 55,  y: 45,  status: 'in-zone',     zone: 'Dock B'   },
  { id: 'WK-003', x: 70,  y: 25,  status: 'out-of-zone', zone: 'Dock C'   },
  { id: 'WK-004', x: 38,  y: 65,  status: 'in-zone',     zone: 'Yard 1'   },
  { id: 'WK-005', x: 80,  y: 60,  status: 'in-zone',     zone: 'Yard 2'   },
  { id: 'WK-006', x: 15,  y: 70,  status: 'offline',     zone: '—'        },
  { id: 'WK-007', x: 60,  y: 78,  status: 'in-zone',     zone: 'Gate 1'   },
];

const FAKE_ALERTS = [
  { id: 1, text: 'WK-003 left Dock C zone',   type: 'warn'   },
  { id: 2, text: 'WK-006 tracker silent 8m',  type: 'error'  },
  { id: 3, text: 'WK-001 entered Dock A',     type: 'ok'     },
  { id: 4, text: 'WK-002 co-movement flagged',type: 'warn'   },
  { id: 5, text: 'WK-007 shift started',      type: 'ok'     },
];

const STATS = [
  { value: '7',    label: 'Active Trackers' },
  { value: '3',    label: 'Task Areas'      },
  { value: '99%',  label: 'GPS Uptime'      },
];

/* ── Tiny animated map ── */
const LiveMap = () => {
  const [workers, setWorkers] = useState(FAKE_WORKERS);
  const [ping,    setPing   ] = useState<string | null>(null);
  const [alert,   setAlert  ] = useState<typeof FAKE_ALERTS[0] | null>(null);
  const alertIdx = useRef(0);

  /* Drift workers slightly every 1.8s */
  useEffect(() => {
    const t = setInterval(() => {
      setWorkers(prev => prev.map(w => {
        if (w.status === 'offline') return w;
        const dx = (Math.random() - 0.5) * 3;
        const dy = (Math.random() - 0.5) * 3;
        return {
          ...w,
          x: Math.max(8, Math.min(92, w.x + dx)),
          y: Math.max(8, Math.min(88, w.y + dy)),
        };
      }));
    }, 1800);
    return () => clearInterval(t);
  }, []);

  /* Ping a random online worker every 2.5s */
  useEffect(() => {
    const t = setInterval(() => {
      const online = workers.filter(w => w.status !== 'offline');
      const picked = online[Math.floor(Math.random() * online.length)];
      if (picked) {
        setPing(picked.id);
        setTimeout(() => setPing(null), 900);
      }
    }, 2500);
    return () => clearInterval(t);
  }, [workers]);

  /* Rotate alerts every 3s */
  useEffect(() => {
    const t = setInterval(() => {
      setAlert(FAKE_ALERTS[alertIdx.current % FAKE_ALERTS.length]);
      alertIdx.current++;
      setTimeout(() => setAlert(null), 2400);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const dotColor = (status: string) =>
    status === 'in-zone'     ? '#c3f832' :
    status === 'out-of-zone' ? '#ef4444' : '#555';

  return (
    <div className="relative w-full rounded-2xl overflow-hidden"
      style={{
        height: 240,
        backgroundColor: '#0d0d0d',
        border: '1px solid #c3f83220',
        boxShadow: 'inset 0 0 40px #c3f83208',
      }}
    >
      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: 'linear-gradient(#c3f832 1px, transparent 1px), linear-gradient(90deg, #c3f832 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Fake zone blobs */}
      <div className="absolute rounded-xl opacity-10 pointer-events-none"
        style={{ left: '10%', top: '18%', width: 90, height: 60, backgroundColor: '#c3f832', filter: 'blur(12px)' }} />
      <div className="absolute rounded-xl opacity-10 pointer-events-none"
        style={{ left: '44%', top: '35%', width: 80, height: 55, backgroundColor: '#c3f832', filter: 'blur(12px)' }} />
      <div className="absolute rounded-xl opacity-8 pointer-events-none"
        style={{ left: '60%', top: '55%', width: 70, height: 50, backgroundColor: '#c3f832', filter: 'blur(14px)' }} />

      {/* Zone outlines */}
      <div className="absolute rounded-xl pointer-events-none"
        style={{ left: '8%', top: '16%', width: 90, height: 56, border: '1px dashed #c3f83340' }} />
      <div className="absolute rounded-xl pointer-events-none"
        style={{ left: '42%', top: '34%', width: 82, height: 52, border: '1px dashed #c3f83340' }} />
      <div className="absolute rounded-xl pointer-events-none"
        style={{ left: '58%', top: '54%', width: 72, height: 48, border: '1px dashed #c3f83340' }} />

      {/* Workers */}
      {workers.map(w => (
        <div
          key={w.id}
          className="absolute transition-all duration-[1800ms] ease-in-out"
          style={{ left: `${w.x}%`, top: `${w.y}%`, transform: 'translate(-50%,-50%)' }}
        >
          {/* Ping ripple */}
          {ping === w.id && (
            <div className="absolute inset-0 rounded-full animate-ping"
              style={{
                width: 20, height: 20,
                top: -4, left: -4,
                backgroundColor: dotColor(w.status),
                opacity: 0.35,
              }}
            />
          )}
          {/* Dot */}
          <div
            className="rounded-full flex items-center justify-center font-bold select-none"
            style={{
              width: 14, height: 14,
              backgroundColor: dotColor(w.status),
              boxShadow: `0 0 8px ${dotColor(w.status)}88`,
              opacity: w.status === 'offline' ? 0.3 : 1,
            }}
          />
          {/* Label */}
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold px-1 py-0.5 rounded"
            style={{ backgroundColor: '#141414cc', color: '#ffffff99' }}
          >
            {w.id}
          </div>
        </div>
      ))}

      {/* Live alert toast */}
      <div
        className="absolute bottom-3 left-3 right-3 transition-all duration-300"
        style={{
          opacity: alert ? 1 : 0,
          transform: alert ? 'translateY(0)' : 'translateY(8px)',
        }}
      >
        {alert && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold"
            style={{
              backgroundColor: '#141414ee',
              border: `1px solid ${
                alert.type === 'ok'    ? '#c3f83250' :
                alert.type === 'warn'  ? '#f5950050' : '#ef444450'
              }`,
              color:
                alert.type === 'ok'    ? '#c3f832' :
                alert.type === 'warn'  ? '#f59500' : '#ef4444',
              backdropFilter: 'blur(8px)',
            }}
          >
            {alert.type === 'ok'
              ? <Wifi          className="h-3 w-3 flex-shrink-0" />
              : alert.type === 'warn'
              ? <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              : <WifiOff       className="h-3 w-3 flex-shrink-0" />}
            {alert.text}
            <span className="ml-auto text-[9px] opacity-50 font-mono">live</span>
          </div>
        )}
      </div>

      {/* Corner label */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-lg"
        style={{ backgroundColor: '#c3f83218', border: '1px solid #c3f83330' }}>
        <span className="h-1.5 w-1.5 rounded-full bg-[#c3f832] animate-pulse" />
        <span className="text-[9px] font-bold text-[#c3f832] tracking-widest uppercase">Live</span>
      </div>
    </div>
  );
};


const Login = () => {
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  /* Ticking online counter */
  const [onlineCount, setOnlineCount] = useState(5);
  useEffect(() => {
    const t = setInterval(() => {
      setOnlineCount(n => n === 6 ? 5 : n + 1);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f5f5f5' }}>

      {/* ══════════════════════════════
          LEFT — branding + live map
      ══════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col justify-between w-[52%] p-10 relative overflow-hidden select-none"
        style={{ backgroundColor: '#141414' }}
      >
        {/* Blobs */}
        <div className="absolute -top-32 -left-20 w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, #c3f83222 0%, transparent 65%)' }} />
        <div className="absolute -bottom-24 -right-16 w-[320px] h-[320px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, #c3f83210 0%, transparent 65%)' }} />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-10 w-10 rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 0 0 2px #c3f83240' }}>
            <img src={homerLogo} alt="ST-Homer" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-white font-bold text-[15px] leading-none">Homer</p>
            <p className="text-white/30 text-[11px] mt-0.5">Worker Tracking System</p>
          </div>
        </div>

        {/* Middle content */}
        <div className="relative z-10 space-y-6">

          {/* Live badge with ticking count */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase"
              style={{ backgroundColor: '#c3f83215', color: '#c3f832', border: '1px solid #c3f83330' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#c3f832] animate-pulse" />
              Live Monitoring
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold"
              style={{ backgroundColor: '#ffffff08', border: '1px solid #ffffff12', color: '#ffffff60' }}>
              <span className="text-[#c3f832] font-black">{onlineCount}</span> / 7 online
            </div>
          </div>

          <div>
            <h1 className="text-[38px] font-bold text-white leading-[1.15] tracking-tight">
              Worker Safety &<br />
              <span style={{ color: '#c3f832' }}>Location Intelligence</span>
            </h1>
            <p className="text-white/35 text-[13px] leading-relaxed mt-3 max-w-[340px]">
              Real-time GPS tracking, smart geo-fencing, and automated
              safety alerts for port and shipyard operations.
            </p>
          </div>

          {/* ── Animated live map ── */}
          <LiveMap />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2.5">
            {STATS.map(({ value, label }) => (
              <div key={label} className="rounded-xl p-3 text-center"
                style={{ backgroundColor: '#c3f83210', border: '1px solid #c3f83320' }}>
                <p className="text-[16px] font-black" style={{ color: '#c3f832' }}>{value}</p>
                <p className="text-white/30 text-[10px] mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/15 text-[11px] relative z-10 font-medium">
          © 2026 ST-Homer · IIT Delhi · Encrypted & Secure
        </p>
      </div>

      {/* ══════════════════════════════
          RIGHT — Login form
      ══════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[380px] space-y-5">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-2">
            <div className="h-9 w-9 rounded-xl overflow-hidden ring-1 ring-border">
              <img src={homerLogo} alt="ST-Homer" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="font-bold text-[14px] leading-none">ST-Homer</p>
              <p className="text-muted-foreground text-[11px] mt-0.5">Worker Tracking System</p>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-[26px] font-bold text-foreground tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground text-[13px]">Sign in to access your monitoring dashboard</p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4"
            style={{ boxShadow: '0 2px 20px hsl(0 0% 0% / 0.07)' }}>

            <form onSubmit={handleSubmit} className="space-y-4">

              {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl text-[13px] font-medium"
                  style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email"
                  className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                  Email
                </Label>
                <Input
                  id="email" type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl border-border bg-muted/40 text-[13px] transition-all"
                  onFocus={e => e.target.style.borderColor = '#c3f832'}
                  onBlur={e  => e.target.style.borderColor = ''}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password"
                  className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="h-11 rounded-xl border-border bg-muted/40 text-[13px] pr-10 transition-all"
                    onFocus={e => e.target.style.borderColor = '#c3f832'}
                    onBlur={e  => e.target.style.borderColor = ''}
                  />
                  <button type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-xl text-[13px] font-bold mt-1 transition-all duration-150 hover:opacity-90 hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
                style={{ backgroundColor: '#c3f832', color: '#141414', border: 'none',
                  boxShadow: '0 4px 14px #c3f83240' }}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-[#141414]/20 border-t-[#141414] animate-spin" />
                    Signing in…
                  </span>
                ) : 'Sign in →'}
              </Button>
            </form>
          </div>

          {/* Demo credentials — untouched */}
          <DemoCredentialsPopup onFill={(e, p) => { setEmail(e); setPassword(p); }} />

          <p className="text-center text-[11px] text-muted-foreground">
            Secure access · Role-based permissions · IIT Delhi
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
