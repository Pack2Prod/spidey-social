import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-noir-black flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen relative flex flex-col bg-gradient-to-b from-noir-black via-noir-charcoal to-noir-black">
        {children}
      </div>
    </div>
  );
};

export default Layout;
