import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTwinStore } from '../../store/twinStore';
import PageContainer from './PageContainer';
import TwinChatPanel from '../chat/TwinChatPanel';
import ErrorBoundary from '../common/ErrorBoundary';
import { Waves, LayoutDashboard, Compass, Bell, Shield, LogOut, Globe, ChevronDown } from 'lucide-react';
import { zIndexHierarchy } from './designTokens';
import Button from '../common/Button';

/**
 * AppShell: The single root layout providing consistent navigation,
 * mission control header, role switcher, responsive drawer, and chat container.
 */
export default function AppShell({
  currentPage,
  onNavigate,
  children,
}) {
  const { user, logout, switchRole } = useAuth();
  const { unreadAlertCount } = useTwinStore();
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#070b14] text-slate-100 overflow-x-hidden selection:bg-cyan-500 selection:text-black font-sans">
      {/* Top Mission Control Header with zIndexHierarchy.navbar */}
      <header
        style={{ zIndex: zIndexHierarchy.navbar }}
        className="sticky top-0 glass-panel border-b border-cyan-500/20 px-3 sm:px-6 py-2.5 flex items-center justify-between"
      >
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('landing')}
            className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:scale-105 transition-transform"
            title="Return to Public Portal Home"
          >
            <Waves className="w-5 h-5 animate-pulse" />
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1
                className="font-extrabold text-white text-base tracking-tight cursor-pointer hover:text-cyan-300 transition-colors"
                onClick={() => onNavigate('landing')}
              >
                CognitwinX
              </h1>
              <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                v2.4
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Cognitive Digital Twin for Urban Flood Risk & Disaster Management
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 glass-panel px-1.5 py-1 rounded-xl border border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('landing')}
            className="text-xs text-slate-400 hover:text-cyan-300"
            title="Overview & Architecture"
          >
            <Globe className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Portal Home</span>
          </Button>

          <div className="h-4 w-px bg-slate-800" />

          <Button
            variant={currentPage === 'dashboard' ? 'activeTab' : 'inactiveTab'}
            size="sm"
            onClick={() => onNavigate('dashboard')}
            className="text-xs"
          >
            <LayoutDashboard className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Mission Control</span>
          </Button>

          <Button
            variant={currentPage === 'zone_detail' ? 'activeTab' : 'inactiveTab'}
            size="sm"
            onClick={() => onNavigate('zone_detail')}
            className="text-xs"
          >
            <Compass className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Zone Analysis</span>
          </Button>

          <Button
            variant={currentPage === 'alerts' ? 'activeTab' : 'inactiveTab'}
            size="sm"
            onClick={() => onNavigate('alerts')}
            className="text-xs relative"
          >
            <Bell className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Alerts</span>
            {unreadAlertCount > 0 && (
              <span className="ml-1.5 w-4 h-4 rounded-full bg-red-500 text-white font-bold text-[9px] flex items-center justify-center">
                {unreadAlertCount}
              </span>
            )}
          </Button>
        </nav>

        {/* User Role Badge & Actions */}
        <div className="flex items-center space-x-2.5">
          {/* Role Switcher Pill */}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-cyan-500/30 text-xs text-slate-200 hover:border-cyan-400"
            >
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <div className="text-left hidden md:block">
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">Role</div>
                <div className="font-bold capitalize text-cyan-300">
                  {user?.role ? user.role.replace('_', ' ') : 'NDMA Officer'}
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </Button>

            {showRoleMenu && (
              <div
                style={{ zIndex: zIndexHierarchy.dropdown }}
                className="absolute right-0 mt-2 w-52 glass-panel-glow rounded-xl border border-cyan-500/40 p-1.5 space-y-1 text-xs shadow-2xl backdrop-blur-xl"
              >
                <div className="px-2.5 py-1 text-[10px] text-slate-400 uppercase font-semibold border-b border-white/10 pb-1">
                  Switch Role for Demo:
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { switchRole('ndma_officer'); setShowRoleMenu(false); }}
                  className="w-full justify-start text-xs font-normal"
                >
                  NDMA / SDMA Officer
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { switchRole('admin'); setShowRoleMenu(false); }}
                  className="w-full justify-start text-xs font-normal"
                >
                  Disaster Command Admin
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { switchRole('public_viewer'); setShowRoleMenu(false); }}
                  className="w-full justify-start text-xs font-normal"
                >
                  Public Viewer
                </Button>
              </div>
            )}
          </div>

          <Button
            variant="secondary"
            size="icon"
            onClick={() => {
              logout();
              onNavigate('landing');
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 border-slate-700/60"
            title="Logout and return to Portal"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Page Area wrapped with PageContainer */}
      <main className="flex-1 w-full">
        <PageContainer>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </PageContainer>
      </main>

      {/* Conversational "Chat with the Twin" Floating Interface (7th Agent) with zIndexHierarchy.chat */}
      <TwinChatPanel />
    </div>
  );
}
