import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'admin' | 'manager' | 'supervisor' | 'worker';

export interface User {
  id:    string;
  email: string;
  role:  UserRole;
  name:  string;
}

const PERMISSIONS: Record<UserRole, string[]> = {
  admin:      ['view','create_fence','edit_fence','delete_fence','assign_worker',
               'acknowledge_alert','silence_alert','manage_users','view_settings','edit_settings'],
  manager:    ['view','create_fence','edit_fence','delete_fence','assign_worker',
               'acknowledge_alert','silence_alert','view_settings','edit_settings'],
  supervisor: ['view','assign_worker','acknowledge_alert','silence_alert','view_settings'],
  worker:     ['view'],
};

export interface AuthContextType {
  user:           User | null;
  login:          (email: string, password: string) => { success: boolean; error?: string };
  logout:         () => void;
  isLoading:      boolean;
  hasPermission:  (permission: string) => boolean;
}

export const DEMO_CREDENTIALS = {
  admin:      { email: 'admin@demo.com',      password: 'admin123'      },
  manager:    { email: 'manager@demo.com',    password: 'manager123'    },
  supervisor: { email: 'supervisor@demo.com', password: 'supervisor123' },
  worker:     { email: 'worker@demo.com',     password: 'worker123'     },
};

const DEMO_USERS: Record<string, User> = {
  'admin@demo.com':      { id: '0', email: 'admin@demo.com',      role: 'admin',      name: 'Admin User'     },
  'manager@demo.com':    { id: '1', email: 'manager@demo.com',    role: 'manager',    name: 'John Manager'   },
  'supervisor@demo.com': { id: '2', email: 'supervisor@demo.com', role: 'supervisor', name: 'Sam Supervisor' },
  'worker@demo.com':     { id: '3', email: 'worker@demo.com',     role: 'worker',     name: 'Jane Worker'    },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]         = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('auth-user');
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  const login = (email: string, password: string) => {
    const e = email.toLowerCase().trim();
    const match = Object.values(DEMO_CREDENTIALS).find(c => c.email === e && c.password === password);
    if (match) {
      const userData = DEMO_USERS[e];
      setUser(userData);
      localStorage.setItem('auth-user', JSON.stringify(userData));
      return { success: true };
    }
    return { success: false, error: 'Invalid email or password' };
  };

  const logout = () => { setUser(null); localStorage.removeItem('auth-user'); };

  const hasPermission = (permission: string) =>
    user ? (PERMISSIONS[user.role]?.includes(permission) ?? false) : false;

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
