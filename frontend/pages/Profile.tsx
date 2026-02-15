import React, { useState, useEffect } from 'react';
import { getCurrentUserInfo } from '../lib/auth';

interface ProfileProps {
  onSignOut: () => void;
}

const Profile: React.FC<ProfileProps> = ({ onSignOut }) => {
  const [user, setUser] = useState<{ email?: string; username?: string }>({});

  useEffect(() => {
    getCurrentUserInfo().then(setUser);
  }, []);

  const displayName = (user.email || user.username || 'hero').split('@')[0].toUpperCase();
  const handle = '@' + (user.email || user.username || 'hero').split('@')[0];

  return (
    <div className="flex flex-col items-center pt-12 pb-32 px-6 h-screen overflow-y-auto">
      <div className="relative mb-8">
        <img
          src={`https://picsum.photos/seed/${user.email || 'user'}/200/200`}
          className="w-32 h-32 rounded-3xl grayscale border-4 border-noir-steel shadow-2xl"
          alt="Profile"
        />
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-web-amber text-noir-black px-4 py-1 rounded-full font-mono text-sm font-black shadow-lg">
          ★ 100 AURA
        </div>
      </div>
      <h2 className="text-3xl font-display font-black text-noir-light uppercase tracking-widest mb-1">
        {displayName}
      </h2>
      <p className="text-sm text-noir-smoke font-mono mb-8 uppercase tracking-tighter">
        {handle} • {user.email || '—'}
      </p>

      <div className="w-full space-y-4">
        <div className="bg-noir-charcoal p-4 rounded-xl border border-noir-steel flex justify-between items-center">
          <span className="text-sm text-noir-smoke font-semibold uppercase tracking-widest">Active Webs</span>
          <span className="font-mono text-web-amber">—</span>
        </div>
        <div className="bg-noir-charcoal p-4 rounded-xl border border-noir-steel flex justify-between items-center">
          <span className="text-sm text-noir-smoke font-semibold uppercase tracking-widest">Successful Connections</span>
          <span className="font-mono text-web-amber">—</span>
        </div>
      </div>

      <p className="mt-6 text-xs text-noir-ash text-center">
        Aura and stats coming soon.
      </p>

      <button
        onClick={onSignOut}
        className="mt-8 text-web-red text-xs font-mono uppercase tracking-widest underline underline-offset-4 hover:text-web-ember transition-colors"
      >
        Go Dark (Sign Out)
      </button>
    </div>
  );
};

export default Profile;
