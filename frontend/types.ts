export interface User {
  id: string;
  name: string;
  handle: string;
  university: string;
  aura: number;
  avatar: string;
  interests: string[];
  distance: string;
  location: {
    x: number;
    y: number;
  };
}

export interface WebPost {
  id: string;
  userId: string;
  userName: string;
  userHandle: string;
  userUniversity: string;
  userAura: number;
  content: string;
  category: string;
  distance: string;
  timestamp: string;
  ttl: number;
  joinedCount: number;
  isExpiring: boolean;
  /** 0-1 for radar placement when lat/lng available */
  radarX?: number;
  radarY?: number;
}

export type AppTab = 'feed' | 'sense' | 'post' | 'chat' | 'profile' | 'onboarding';

export type NavigateHandler = (tab: AppTab, openChatWebId?: string) => void;
