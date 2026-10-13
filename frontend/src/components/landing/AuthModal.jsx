import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { X, Shield, Lock, User, Mail, Phone, Building, AlertCircle, CheckCircle2, Waves, ArrowRight } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const { login } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [role, setRole] = useState('public_viewer'); // 'public_viewer' | 'ndma_officer'
  
  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [agency, setAgency] = useState('NDMA Crisis Operations');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      await login(username || 'ndma_officer', password || 'Password123!');
      setLoading(false);
      onSuccess?.();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Authentication failed. Please check credentials.');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      const res = await api.register({
        username,
        email,
        password,
        role,
        agency: role === 'ndma_officer' ? agency : '',
        phone_number: role === 'ndma_officer' ? phoneNumber : ''
      });

      setLoading(false);
      if (res.warning) {
        setNotice(res.warning);
      } else {
        setNotice('Registration successful! Logging into mission control...');
      }

      // Auto login
      setTimeout(async () => {
        await login(username, password);
        onSuccess?.();
        onClose();
      }, 1000);

    } catch (err) {
      setLoading(false);
      setError(err.message || 'Registration failed. Username may already exist.');
    }
  };

  const fillDemo = (demoRole) => {
    if (demoRole === 'ndma_officer') {
      setUsername('ndma_officer');
      setPassword('OfficerPass123!');
      setRole('ndma_officer');
    } else if (demoRole === 'admin') {
      setUsername('admin');
      setPassword('AdminPass123!');
      setRole('admin');
    } else {
      setUsername('citizen_user');
      setPassword('CitizenPass123!');
      setRole('public_viewer');
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Dark frosted overlay */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-3xl bg-[#090e1a] border border-cyan-500/30 p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-10 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-cyan-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Brand */}
        <div className="flex items-center space-x-2.5 mb-6">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/40 text-cyan-400">
            <Waves className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-base">CognitwinX Mission Access</h3>
            <p className="text-[11px] text-slate-400">National Disaster AI Operations</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800 mb-6 text-xs font-semibold">
          <button
            onClick={() => { setTab('login'); setError(''); setNotice(''); }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              tab === 'login'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('register'); setError(''); setNotice(''); }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              tab === 'register'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register Account
          </button>
        </div>

        {/* Errors & Notices */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-950/80 border border-red-800/80 text-red-300 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="p-3 mb-4 rounded-xl bg-amber-950/80 border border-amber-800/80 text-amber-300 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>{notice}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">Username / Call Sign</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. ndma_officer"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">Passcode</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all mt-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Access Mission Control'}
            </button>

            {/* Quick Demo Pre-sets */}
            <div className="pt-4 border-t border-slate-800/80">
              <span className="text-[10px] font-mono text-slate-500 uppercase block mb-2">Instant Demo Profiles:</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemo('ndma_officer')}
                  className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-cyan-400 hover:border-cyan-500 transition-all"
                >
                  NDMA Officer
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('admin')}
                  className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-amber-400 hover:border-amber-500 transition-all"
                >
                  Admin HQ
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('citizen_user')}
                  className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-slate-300 hover:border-slate-500 transition-all"
                >
                  Citizen Viewer
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* REGISTER FORM */
          <form onSubmit={handleRegister} className="space-y-3.5">
            {/* Role Switcher */}
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">Account Role Designation</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('public_viewer')}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    role === 'public_viewer'
                      ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="font-bold">Public Observer</div>
                  <div className="text-[10px] text-slate-500">Instant Access</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('ndma_officer')}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    role === 'ndma_officer'
                      ? 'bg-emerald-500/10 border-emerald-400 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="font-bold flex items-center">
                    <Shield className="w-3 h-3 mr-1" />
                    NDMA Officer
                  </div>
                  <div className="text-[10px] text-slate-500">Requires Approval</div>
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose username"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@disaster.gov.in"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">Password (min 6 chars)</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-white focus:outline-none"
              />
            </div>

            {/* Officer Specific Fields */}
            {role === 'ndma_officer' && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center">
                  <Shield className="w-3.5 h-3.5 mr-1" />
                  Officer Verification Credentials
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Disaster Management Agency</label>
                  <input
                    type="text"
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    placeholder="NDMA / SDMA HQ"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Official Mobile (for SMS Dispatch)</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <p className="text-[10px] text-amber-400/90 leading-relaxed">
                  * Note: NDMA Officer accounts require administrative review for emergency actuation override. You may explore read-only twin features immediately.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-black font-extrabold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all mt-1 disabled:opacity-50"
            >
              {loading ? 'Creating Credentials...' : 'Complete Registration'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
