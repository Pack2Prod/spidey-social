import React, { useState, useEffect } from 'react';
import { AppTab } from './types';
import Layout from './components/Layout';
import BottomNav from './components/BottomNav';
import { RadiusProvider } from './lib/RadiusContext';
import { WebSocketProvider } from './lib/WebSocketContext';
import Feed from './pages/Feed';
import Sense from './pages/Sense';
import Post from './pages/Post';
import Chat from './pages/Chat';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import { configureAuth, isAuthenticated, logout } from './lib/auth';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('onboarding');
  const [openChatWebId, setOpenChatWebId] = useState<string | undefined>();
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

  const handleNavigate: (tab: AppTab, openChatWebId?: string) => void = (tab, webId) => {
    setActiveTab(tab);
    if (webId) setOpenChatWebId(webId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'feed':
        return <Feed onNavigate={handleNavigate} />;
      case 'sense':
        return <Sense onNavigate={handleNavigate} />;
      case 'post':
        return <Post onPostSuccess={() => setActiveTab('feed')} />;
      case 'chat':
        return <Chat openChatWebId={openChatWebId} />;
      case 'profile':
        return <Profile onSignOut={handleSignOut} />;
      default:
        return <Feed />;
    }
  };

  return (
    <RadiusProvider>
      <WebSocketProvider>
        <Layout>
          {renderContent()}
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </Layout>
      </WebSocketProvider>
    </RadiusProvider>
  );
};

export default App;
