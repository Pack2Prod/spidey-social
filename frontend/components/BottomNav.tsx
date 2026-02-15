import React from 'react';
import { AppTab } from '../types';
import { Radar, PenLine, MessageCircle, User, LayoutGrid } from 'lucide-react';

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'feed', label: 'Feed', icon: <LayoutGrid size={22} /> },
    { id: 'sense', label: 'Sense', icon: <Radar size={22} /> },
    { id: 'post', label: 'Post', icon: <PenLine size={24} />, special: true },
    { id: 'chat', label: 'Chat', icon: <MessageCircle size={22} /> },
    { id: 'profile', label: 'Profile', icon: <User size={22} /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-[480px] bg-noir-charcoal border-t border-noir-steel px-4 pb-6 pt-2 flex justify-around items-end pointer-events-auto shadow-[0_-8px_32px_rgba(0,0,0,0.6)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as AppTab)}
            className={`
              flex flex-col items-center gap-1 p-2 transition-all relative
              ${tab.special ? 'mb-2' : ''}
              ${activeTab === tab.id ? 'text-noir-light' : 'text-noir-ash'}
            `}
          >
            <div
              className={`
              ${tab.special ? 'w-14 h-14 bg-gradient-to-br from-web-crimson to-web-red rounded-full flex items-center justify-center text-noir-light shadow-lg -translate-y-2' : ''}
              ${activeTab === tab.id && !tab.special ? 'text-web-red scale-110 drop-shadow-[0_0_8px_rgba(198,40,40,0.4)]' : ''}
              transition-all duration-300
            `}
            >
              {tab.icon}
            </div>
            {!tab.special && (
              <span className={`text-[0.65rem] uppercase tracking-widest font-semibold transition-colors ${activeTab === tab.id ? 'text-noir-light' : 'text-noir-ash'}`}>
                {tab.label}
              </span>
            )}
            {activeTab === tab.id && !tab.special && (
              <div className="absolute -bottom-1 w-1 h-1 bg-web-red rounded-full shadow-[0_0_8px_rgba(198,40,40,0.8)]"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BottomNav;
