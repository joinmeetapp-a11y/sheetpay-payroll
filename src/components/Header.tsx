import React, { useState, useRef } from 'react';
import {
  Bell,
  Building2,
  ChevronDown,
  Camera,
  LogOut,
  User,
  ShieldCheck,
  Check,
  Plus,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { CaylaPenMascot } from './CaylaPenMascot';
import { AccountType, AccountantClient, BusinessDetails } from '../types';

interface HeaderProps {
  userName: string;
  userAvatar: string;
  onUpdateAvatar: (newUrl: string) => void;
  onUpdateUserName: (newName: string) => void;
  business: BusinessDetails;
  onSwitchBusiness: (name: string) => void;
  auditCount: number;
  onOpenAudit: () => void;
  onOpenLanding?: () => void;
  onOpenOnboarding?: () => void;
  accountType?: AccountType;
  accountantClients?: AccountantClient[];
  activeClientId?: string;
  onSelectClient?: (clientId: string) => void;
  onOpenAddClientModal?: () => void;
  onSwitchAccountType?: (type: AccountType) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenBatchPayroll?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userName,
  userAvatar,
  onUpdateAvatar,
  onUpdateUserName,
  business,
  onSwitchBusiness,
  auditCount,
  onOpenAudit,
  onOpenLanding,
  onOpenOnboarding,
  accountType = 'business',
  accountantClients = [],
  activeClientId,
  onSelectClient,
  onOpenAddClientModal,
  onSwitchAccountType,
  activeTab = 'accountant_dashboard',
  onTabChange,
  onOpenBatchPayroll,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showBusinessMenu, setShowBusinessMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firstName = (userName || 'User').split(' ')[0] || 'User';
  const isAccountant = accountType === 'accountant';

  const defaultBusinesses = [
    { name: business.name, country: `${business.country} (${business.currency})`, active: true },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUpdateAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredClients = isAccountant
    ? accountantClients.filter(
        (c) =>
          (c.companyName || c.name || '').toLowerCase().includes((clientSearchQuery || '').toLowerCase()) ||
          (c.country || '').toLowerCase().includes((clientSearchQuery || '').toLowerCase()) ||
          (c.countryCode || '').toLowerCase().includes((clientSearchQuery || '').toLowerCase())
      )
    : [];

  const activeClientObj = accountantClients.find((c) => c.id === activeClientId);

  return (
    <header
      id="dashboard-header"
      className="h-16 border-b border-slate-100 bg-white px-3 sm:px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 select-none"
    >
      {/* Left: Greeting */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2 truncate">
            <span className="truncate">Good morning, {firstName} 👋</span>
            {isAccountant ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 border border-emerald-300 rounded-full px-2.5 py-0.5 bg-emerald-50 shadow-2xs shrink-0">
                <Layers className="w-3 h-3 text-emerald-600" />
                Accountant Command
              </span>
            ) : (
              <span className="hidden sm:inline-block text-[11px] font-semibold uppercase tracking-wider text-slate-500 border border-slate-200 rounded-full px-3 py-0.5 bg-slate-50 shrink-0">
                August 2026 Pay Cycle
              </span>
            )}
          </h2>
        </div>
      </div>

      {/* Right: Actions & Switchers */}
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
        {/* Account Mode Switcher (Business vs Accountant) */}
        {onSwitchAccountType && (
          <div className="flex items-center bg-slate-100 p-0.5 rounded-full border border-slate-200 shadow-2xs">
            <button
              onClick={() => {
                if (accountType !== 'business') onSwitchAccountType('business');
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                accountType === 'business'
                  ? 'bg-white text-slate-950 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800 font-semibold'
              }`}
              title="Switch to Single Business Account"
            >
              Business
            </button>
            <button
              onClick={() => {
                if (accountType !== 'accountant') onSwitchAccountType('accountant');
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                accountType === 'accountant'
                  ? 'bg-emerald-600 text-white shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800 font-semibold'
              }`}
              title="Switch to Accountant Practice Command"
            >
              Accountant
            </button>
          </div>
        )}

        {/* Business / Client Switcher Dropdown */}
        <div className="relative">
          <button
            id="business-switcher-btn"
            onClick={() => {
              setShowBusinessMenu(!showBusinessMenu);
              setShowProfileMenu(false);
              setShowNotifications(false);
            }}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="max-w-[85px] xs:max-w-[110px] sm:max-w-[160px] truncate font-bold">
              {isAccountant
                ? (activeClientObj?.companyName || activeClientObj?.name || business.name)
                : business.name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {showBusinessMenu && (
            <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto top-18 sm:top-auto sm:right-0 sm:mt-2 w-auto sm:w-80 max-w-sm sm:max-w-none bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3.5 py-1.5 flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {isAccountant ? 'Active Client Tenant' : 'Select Business Entity'}
                </div>
                {isAccountant && onOpenAddClientModal && (
                  <button
                    onClick={() => {
                      setShowBusinessMenu(false);
                      onOpenAddClientModal();
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Client</span>
                  </button>
                )}
              </div>

              {/* Client Search on mobile & desktop */}
              {isAccountant && accountantClients.length > 3 && (
                <div className="p-2 border-b border-slate-100">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search clients or country..."
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div className="max-h-72 overflow-y-auto py-1 divide-y divide-slate-100">
                {isAccountant && accountantClients.length > 0 ? (
                  filteredClients.length > 0 ? (
                    filteredClients.map((client) => {
                      const isSelected = client.id === activeClientId;
                      return (
                        <button
                          key={client.id}
                          onClick={() => {
                            if (onSelectClient) onSelectClient(client.id);
                            setShowBusinessMenu(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50 active:bg-slate-100'
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0 pr-2">
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5 truncate">
                              <span className="truncate">{client.companyName || client.name}</span>
                              <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded shrink-0">
                                {client.countryCode || 'TT'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium truncate">
                              {client.employeeCount} staff • {client.payrollSchedule} •{' '}
                              <span className="font-bold text-slate-700">
                                ${(client.totalMonthlyPayroll || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">
                      No clients found matching &quot;{clientSearchQuery}&quot;
                    </div>
                  )
                ) : (
                  defaultBusinesses.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => {
                        onSwitchBusiness(b.name);
                        setShowBusinessMenu(false);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{b.name}</div>
                        <div className="text-[11px] text-slate-500">{b.country}</div>
                      </div>
                      {b.name === business.name && (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notifications Icon with Popover */}
        <div className="relative">
          <button
            id="notifications-btn"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
              setShowBusinessMenu(false);
            }}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Notifications & Audit Logs"
          >
            <Bell className="w-5 h-5" />
            {auditCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
            )}
          </button>

          {showNotifications && (
            <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto top-18 sm:top-auto sm:right-0 sm:mt-2 w-auto sm:w-80 max-w-sm sm:max-w-none bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-50 animate-in fade-in">
              <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  {isAccountant ? 'Practice Activity & Compliance' : 'Payroll Activity & Alerts'}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                  All systems green
                </span>
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                <div className="p-3 text-xs hover:bg-slate-50">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CaylaPenMascot size="xs" />
                    Cayla Statutory Verification
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    TD4 tax allowance thresholds ($84k/yr) applied to all client payroll runs.
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Just now</span>
                </div>
                <div className="p-3 text-xs hover:bg-slate-50">
                  <div className="font-bold text-slate-800">NIS Class 16 Ceiling</div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Maximum monthly contribution verified across all active regional jurisdictions.
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">15 mins ago</span>
                </div>
              </div>
              <div className="pt-2 px-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    onOpenAudit();
                  }}
                  className="w-full py-1.5 text-center text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  View Complete Audit Trail ({auditCount})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            id="user-profile-menu-btn"
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowBusinessMenu(false);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="relative">
              <img
                src={userAvatar}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
            </div>
            <span className="hidden md:inline-block text-xs font-bold text-slate-800">
              {userName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
          </button>

          {showProfileMenu && (
            <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto top-18 sm:top-auto sm:right-0 sm:mt-2 w-auto sm:w-64 max-w-xs sm:max-w-none bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                <img
                  src={userAvatar}
                  alt={userName}
                  className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200"
                />
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-slate-900 truncate">{userName}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {isAccountant ? 'Senior Practice Partner' : 'Payroll Administrator'}
                  </div>
                </div>
              </div>

              {/* Upload Profile Image Action */}
              <div className="p-2 border-b border-slate-100">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  id="upload-avatar-action"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Change Profile Photo</span>
                </button>
              </div>

              {/* Role / Mode Switcher in Settings Dropdown */}
              {onSwitchAccountType && (
                <div className="p-2 border-b border-slate-100">
                  <button
                    onClick={() => {
                      const newType: AccountType = isAccountant ? 'business' : 'accountant';
                      if (
                        window.confirm(
                          `Switch account mode to ${
                            newType === 'accountant' ? 'Accountant Mode' : 'Standard Business Mode'
                          }?`
                        )
                      ) {
                        onSwitchAccountType(newType);
                        setShowProfileMenu(false);
                      }
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/80 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{isAccountant ? 'Switch to Single Business' : 'Switch to Accountant Mode'}</span>
                    </div>
                  </button>
                </div>
              )}

              <div className="py-1">
                <button
                  onClick={() => {
                    const newName = prompt('Enter updated display name:', userName);
                    if (newName) onUpdateUserName(newName);
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Edit Name</span>
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenAudit();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span>Audit Trail &amp; Security</span>
                </button>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  id="header-logout-btn"
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onOpenLanding) {
                      onOpenLanding();
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
