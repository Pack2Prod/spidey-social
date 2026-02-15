import React, { createContext, useContext, useState } from 'react';

const RADII_MI = [0.5, 1, 2, 5, 10] as const;

type RadiusContextType = {
  radiusMi: number | null;
  setRadiusMi: (r: number | null) => void;
  radii: readonly number[];
};

const RadiusContext = createContext<RadiusContextType | null>(null);

export const RadiusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [radiusMi, setRadiusMi] = useState<number | null>(null);
  return (
    <RadiusContext.Provider value={{ radiusMi, setRadiusMi, radii: RADII_MI }}>
      {children}
    </RadiusContext.Provider>
  );
};

export function useRadius() {
  const ctx = useContext(RadiusContext);
  if (!ctx) throw new Error('useRadius must be used within RadiusProvider');
  return ctx;
}

export { RADII_MI };
