import React from 'react';
import { Wifi, Signal, LayoutDashboard, Users, FileText, Menu, Sparkles } from 'lucide-react';
import { CaylaPenMascot } from '../CaylaPenMascot';

interface IPhoneMockupProps {
  children: React.ReactNode;
  className?: string;
  isLandscape?: boolean;
  activeIslandText?: string;
  showWaveform?: boolean;
  scale?: number;
  showBottomNav?: boolean;
  activeNavTab?: 'dashboard' | 'employees' | 'payslips' | 'menu';
}

export const IPhoneMockup: React.FC<IPhoneMockupProps> = ({
  children,
  className = '',
  activeIslandText,
  showWaveform = false,
  showBottomNav = true,
  activeNavTab = 'dashboard',
}) => {
  return (
    <div
      className={`relative mx-auto select-none transition-all duration-300 ${className}`}
      style={{
        width: '100%',
        maxWidth: '345px',
      }}
    >
      {/* Hardware Buttons - Left Side: Action Button, Volume Up, Volume Down */}
      <div className="absolute -left-[3px] top-[95px] w-[3px] h-[24px] bg-slate-400 rounded-l-xs shadow-xs" title="Action Button" />
      <div className="absolute -left-[3px] top-[135px] w-[3px] h-[46px] bg-slate-400 rounded-l-xs shadow-xs" title="Volume Up" />
      <div className="absolute -left-[3px] top-[192px] w-[3px] h-[46px] bg-slate-400 rounded-l-xs shadow-xs" title="Volume Down" />

      {/* Hardware Buttons - Right Side: Power/Side Button */}
      <div className="absolute -right-[3px] top-[145px] w-[3px] h-[64px] bg-slate-400 rounded-r-xs shadow-xs" title="Side Button" />

      {/* Outer Titanium Chassis Frame */}
      <div className="relative rounded-[50px] p-[10px] bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border border-slate-300 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.18),0_12px_28px_-10px_rgba(15,23,42,0.12),0_0_0_1px_rgba(255,255,255,0.8)_inset]">
        
        {/* Subtle Dielectric Antenna Separation Bands */}
        <div className="absolute left-0 top-[75px] w-[10px] h-[1.5px] bg-slate-400/50 pointer-events-none" />
        <div className="absolute right-0 top-[75px] w-[10px] h-[1.5px] bg-slate-400/50 pointer-events-none" />
        <div className="absolute left-0 bottom-[75px] w-[10px] h-[1.5px] bg-slate-400/50 pointer-events-none" />
        <div className="absolute right-0 bottom-[75px] w-[10px] h-[1.5px] bg-slate-400/50 pointer-events-none" />

        {/* Inner Uniform Ultra-Slim Display Bezel Ring */}
        <div className="relative bg-black rounded-[42px] p-[3px] ring-1 ring-black/90 shadow-[inset_0_0_4px_rgba(0,0,0,0.8)]">
          
          {/* OLED Screen Canvas */}
          <div className="relative bg-slate-50 rounded-[38px] overflow-hidden text-slate-800 flex flex-col h-[630px] sm:h-[650px] w-full font-sans antialiased shadow-inner">
            
            {/* Top iOS Status Bar + Dynamic Island */}
            <div className="relative z-40 px-6 pt-3 pb-1 flex items-center justify-between text-slate-900 text-[12px] font-semibold tracking-tight select-none bg-white/95 backdrop-blur-md border-b border-slate-100/80">
              {/* Clock (iOS 18 SF style) */}
              <span className="font-bold text-[13px] tracking-tight pl-0.5 text-slate-900">9:41</span>

              {/* Dynamic Island (Precision Pill with Camera Glint & Animations) */}
              <div className="absolute left-1/2 -translate-x-1/2 top-2.5 bg-black text-white px-3.5 py-1 rounded-full flex items-center gap-2 shadow-[0_3px_10px_rgba(0,0,0,0.5),inset_0_0_0_0.5px_rgba(255,255,255,0.15)] min-w-[94px] justify-center transition-all duration-300">
                {showWaveform ? (
                  <div className="flex items-center gap-1.5 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <div className="flex items-center gap-0.5 h-3 px-1">
                      <span className="w-[2px] bg-emerald-400 rounded-full h-2 animate-[pulse_0.6s_ease-in-out_infinite]" />
                      <span className="w-[2px] bg-emerald-400 rounded-full h-3 animate-[pulse_0.4s_ease-in-out_infinite]" />
                      <span className="w-[2px] bg-emerald-400 rounded-full h-1.5 animate-[pulse_0.8s_ease-in-out_infinite]" />
                      <span className="w-[2px] bg-emerald-400 rounded-full h-3.5 animate-[pulse_0.5s_ease-in-out_infinite]" />
                      <span className="w-[2px] bg-emerald-400 rounded-full h-2 animate-[pulse_0.7s_ease-in-out_infinite]" />
                    </div>
                  </div>
                ) : activeIslandText ? (
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="tracking-tight">{activeIslandText}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full px-1">
                    {/* TrueDepth Sensor */}
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-950 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-indigo-950" />
                    </div>
                    {/* Optical Camera Lens Glint */}
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-950 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-sky-950 shadow-[0_0_2px_rgba(56,189,248,0.6)]" />
                    </div>
                  </div>
                )}
              </div>

              {/* iOS Status Icons */}
              <div className="flex items-center gap-1.5 text-slate-800 pr-0.5">
                <Signal className="w-3.5 h-3.5 text-slate-800" strokeWidth={2.5} />
                <Wifi className="w-3.5 h-3.5 text-slate-800" strokeWidth={2.5} />
                
                {/* iOS Battery Capsule */}
                <div className="flex items-center gap-[1px]">
                  <div className="w-[20px] h-[10.5px] rounded-[3.5px] border-[1.5px] border-slate-700 p-[1.5px] flex items-center bg-white/60">
                    <div className="w-full h-full bg-emerald-500 rounded-[1.5px]" />
                  </div>
                  <div className="w-[1.5px] h-[4px] bg-slate-700 rounded-r-[1px]" />
                </div>
              </div>
            </div>

            {/* Screen Viewport Content */}
            <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden relative bg-slate-50 text-slate-800">
              {children}
            </div>

            {/* Floating Bottom Navigation Dock */}
            {showBottomNav && (
              <div className="relative z-30 px-3 pb-1 pt-0.5 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none">
                <div className="bg-white/95 backdrop-blur-xl text-slate-700 rounded-full px-3 py-1.5 shadow-lg border border-slate-200/90 flex items-center justify-between ring-1 ring-black/5 pointer-events-auto">
                  {/* Tab 1: Dashboard */}
                  <div className={`p-1.5 rounded-full flex flex-col items-center relative ${
                    activeNavTab === 'dashboard' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-400'
                  }`}>
                    <LayoutDashboard className="w-4 h-4" />
                    {activeNavTab === 'dashboard' && (
                      <span className="w-1 h-1 bg-emerald-600 rounded-full mt-0.5" />
                    )}
                  </div>

                  {/* Tab 2: Employees */}
                  <div className={`p-1.5 rounded-full flex flex-col items-center relative ${
                    activeNavTab === 'employees' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-400'
                  }`}>
                    <Users className="w-4 h-4" />
                    {activeNavTab === 'employees' && (
                      <span className="w-1 h-1 bg-emerald-600 rounded-full mt-0.5" />
                    )}
                  </div>

                  {/* Center Cayla Elevated Mascot Button */}
                  <div className="relative -my-3">
                    <div className="w-11 h-11 rounded-full bg-emerald-600 p-0.5 shadow-md shadow-emerald-600/30 flex items-center justify-center ring-2 ring-white">
                      <div className="w-full h-full rounded-full bg-emerald-50 flex items-center justify-center overflow-hidden relative">
                        <CaylaPenMascot size={26} showStatusDot={false} isProcessing={showWaveform} />
                        <span className="absolute -bottom-0.5 right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-1 ring-white flex items-center justify-center">
                          <Sparkles className="w-1.5 h-1.5 text-white" />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tab 3: Payslips */}
                  <div className={`p-1.5 rounded-full flex flex-col items-center relative ${
                    activeNavTab === 'payslips' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-400'
                  }`}>
                    <FileText className="w-4 h-4" />
                    {activeNavTab === 'payslips' && (
                      <span className="w-1 h-1 bg-emerald-600 rounded-full mt-0.5" />
                    )}
                  </div>

                  {/* Tab 4: Menu */}
                  <div className={`p-1.5 rounded-full flex flex-col items-center relative ${
                    activeNavTab === 'menu' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-400'
                  }`}>
                    <Menu className="w-4 h-4" />
                  </div>
                </div>
              </div>
            )}

            {/* iOS Floating Home Indicator Bar */}
            <div className="relative z-40 bg-white py-1 flex justify-center items-center pointer-events-none border-t border-slate-100/50">
              <div className="w-28 h-[4px] bg-slate-300 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
