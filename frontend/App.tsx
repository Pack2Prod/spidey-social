import React, { useState, useEffect } from 'react';
import { AppTab } from './types';
import Layout from './components/Layout';
import BottomNav from './components/BottomNav';
import { RadiusProvider } from './lib/RadiusContext';
import Feed from './pages/Feed';
import Sense from './pages/Sense';
import Post from './pages/Post';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import { configureAuth, isAuthenticated, logout } from './lib/auth';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('onboarding');
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    configureAuth();
    isAuthenticated().then((ok) => {
      setSignedIn(ok);
      setAuthChecked(true);
      if (ok) setActiveTab('feed');
    });
  }, []);

  const handleStart = () => {
    setSignedIn(true);
    setActiveTab('feed');
  };

  const handleSignOut = async () => {
    await logout();
    setSignedIn(false);
    setActiveTab('onboarding');
  };

  if (!authChecked) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <p className="text-noir-ash font-mono animate-pulse">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!signedIn) {
    return (
      <Layout>
        <Onboarding onStart={handleStart} />
      </Layout>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'feed':
        return <Feed />;
      case 'sense':
        return <Sense onNavigate={setActiveTab} />;
      case 'post':
        return <Post onPostSuccess={() => setActiveTab('feed')} />;
      case 'chat':
        return (
          <div className="flex flex-col justify-center items-center h-screen px-10 text-center gap-6">
            <h1 className="font-display font-black text-2xl text-noir-light uppercase tracking-widest">Whispers in the dark</h1>
            <p className="font-display italic text-noir-ash">This secure channel is currently under maintenance. Try again later at midnight.</p>
          </div>
        );
      case 'profile':
        return <Profile onSignOut={handleSignOut} />;
      default:
        return <Feed />;
    }
  };

  return (
    <RadiusProvider>
      <Layout>
        {renderContent()}
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </Layout>
    </RadiusProvider>
  );
};

export default App;
