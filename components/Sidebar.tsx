
import React from 'react';
import { LayoutDashboard, BarChart3, Mail, Users, Settings, LifeBuoy, X, Shield } from 'lucide-react';

type PageType = 'dashboard' | 'campaigns' | 'templates' | 'subscribers' | 'settings' | 'admin';

interface SidebarProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  mobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
  isSuperAdmin?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, mobileMenuOpen = false, onCloseMobileMenu, isSuperAdmin = false }) => {
  const navItems: { icon: any; label: string; page: PageType }[] = [
    { icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
    { icon: BarChart3, label: 'Campaigns', page: 'campaigns' },
    { icon: Mail, label: 'Templates', page: 'templates' },
    { icon: Users, label: 'Subscribers', page: 'subscribers' },
    { icon: Settings, label: 'Settings', page: 'settings' },
    ...(isSuperAdmin ? [{ icon: Shield, label: 'Admin', page: 'admin' as PageType }] : []),
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={onCloseMobileMenu}
        />
      )}
      
      {/* Desktop sidebar - Fixed position */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 flex-col w-64 bg-gradient-to-b from-gray-800 to-gray-900 border-r border-gray-700/50 backdrop-blur-xl shadow-2xl z-30">
      <div className="flex items-center justify-center h-20 border-b border-gray-700/50 px-6">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl blur-md opacity-75"></div>
            <div className="relative h-10 w-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-xl">0</span>
            </div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent leading-tight">Zero AI</h1>
            <span className="text-xs font-medium text-gray-400 tracking-wider">MAIL</span>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.page)}
              className={`group w-full flex items-center px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-gray-400 hover:bg-gray-700/50 hover:text-white hover:scale-[1.02]'
              }`}
            >
              <Icon className={`h-5 w-5 mr-3 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>
        <div className="p-4 border-t border-gray-700/50">
           <a href="#" className="group flex items-center px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-700/50 hover:text-white transition-all duration-200 hover:scale-[1.02]">
               <LifeBuoy className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform duration-200" />
               Support
           </a>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-gradient-to-b from-gray-800 to-gray-900 border-r border-gray-700/50 backdrop-blur-xl shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 border-b border-gray-700/50 px-6">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl blur-md opacity-75"></div>
              <div className="relative h-9 w-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-lg">0</span>
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent leading-tight">Zero AI</h1>
              <span className="text-[10px] font-medium text-gray-400 tracking-wider">MAIL</span>
            </div>
          </div>
          <button
            onClick={onCloseMobileMenu}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-700/50 hover:text-white transition-all duration-200"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.label}
                onClick={() => onNavigate(item.page)}
                className={`group w-full flex items-center px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-white hover:scale-[1.02]'
                }`}
              >
                <Icon className={`h-5 w-5 mr-3 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-700/50">
           <a href="#" className="group flex items-center px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-700/50 hover:text-white transition-all duration-200 hover:scale-[1.02]">
               <LifeBuoy className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform duration-200" />
               Support
           </a>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;