import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listWebs, listMySwings, swingIn } from '../api/webs';
import { getPosition } from '../lib/geolocation';
import { getCurrentUserId } from '../lib/auth';
import { useRadius } from '../lib/RadiusContext';
import { useWebSocket } from '../lib/WebSocketContext';
import PostCard from '../components/PostCard';
import type { WebPost } from '../types';
import type { NavigateHandler } from '../types';

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistanceMi(mi: number): string {
  if (mi < 0.01) return 'here';
  if (mi < 0.1) return (mi * 5280).toFixed(0) + 'ft';
  return mi.toFixed(1) + 'mi';
}

interface FeedProps {
  onNavigate?: NavigateHandler;
}

const Feed: React.FC<FeedProps> = ({ onNavigate }) => {
  const { radiusMi, setRadiusMi, radii } = useRadius();
  const { subscribe } = useWebSocket();
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [swungWebIds, setSwungWebIds] = useState<Set<string>>(new Set());
  const [posts, setPosts] = useState<WebPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWebs = useCallback(
    async (radius: number | null, allowCache = false) => {
      try {
        setError('');
        const coords = await getPosition({ allowCache });
        coordsRef.current = coords ?? null;
        if (!coords) {
          const webs = await listWebs(null, null);
          setPosts(webs);
          setRadiusMi(null);
          setLoading(false);
          return;
        }
        if (radius != null) {
          const webs = await listWebs(coords, radius);
          setPosts(webs);
        } else {
          for (const r of radii) {
            const webs = await listWebs(coords, r);
            setRadiusMi(r);
            if (webs.length > 0) {
              setPosts(webs);
              setLoading(false);
              return;
            }
          }
          setPosts([]);
          setRadiusMi(radii[radii.length - 1] ?? 10);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load webs.');
      } finally {
        setLoading(false);
      }
    },
    [radii, setRadiusMi]
  );

  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId);
  }, []);

  useEffect(() => {
    fetchWebs(radiusMi, false); // fresh coords for accurate distance on load/radius change
  }, [radiusMi, fetchWebs]);

  useEffect(() => {
    listMySwings().then((swings) => {
      setSwungWebIds(new Set(swings.map((s) => s.webId)));
    }).catch(() => {});
  }, []);

  const refresh = useCallback(() => {
    fetchWebs(radiusMi, true); // allow cache for visibility/interval refresh (faster)
    listMySwings().then((swings) => {
      setSwungWebIds(new Set(swings.map((s) => s.webId)));
    }).catch(() => {});
  }, [radiusMi, fetchWebs]);

  useEffect(() => {
    const onVisible = () => refresh();
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(refresh, 60000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [refresh]);

  // Real-time: prepend new posts from WebSocket when within current radius
  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type !== 'web_added') return;
      const web = ev.web;
      const userId = currentUserId ?? '';
      if (web.userId === userId || swungWebIds.has(web.id)) return; // exclude own posts & swung
      const lat = web.lat ?? null;
      const lng = web.lng ?? null;
      const radius = radiusMi ?? 10;
      if (lat != null && lng != null) {
        const c = coordsRef.current;
        if (!c) return;
        const mi = haversineMi(c.lat, c.lng, lat, lng);
        const maxR = web.visibilityRadiusMi ?? 2;
        if (mi > radius || mi > maxR) return;
      }
      const webToAdd = { ...web } as WebPost;
      const c = coordsRef.current;
      if (c && lat != null && lng != null) {
        const mi = haversineMi(c.lat, c.lng, lat, lng);
        webToAdd.distance = formatDistanceMi(mi);
      }
      setPosts((prev) => {
        if (prev.some((p) => p.id === web.id)) return prev;
        return [webToAdd, ...prev];
      });
    });
  }, [subscribe, currentUserId, swungWebIds, radiusMi]);

  const handleSwingIn = async (id: string) => {
    try {
      const coords = await getPosition();
      const { isNew } = await swingIn(id, coords ?? undefined);
      if (isNew) {
        setSwungWebIds((prev) => new Set([...prev, id]));
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, joinedCount: p.joinedCount + 1 } : p
          )
        );
        onNavigate?.('chat', id);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Swing in failed.');
    }
  };

  const otherPosts = currentUserId != null
    ? posts.filter((p) => p.userId !== currentUserId && !swungWebIds.has(p.id))
    : posts;

  if (loading) {
    return (
      <div className="flex flex-col pt-8 pb-32 px-4 overflow-y-auto max-h-screen">
        <h1 className="font-display font-black text-3xl text-noir-light uppercase tracking-widest mb-8">
          The Web
        </h1>
        <p className="text-noir-ash font-mono animate-pulse">Loading webs...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col pt-8 pb-32 px-4 overflow-y-auto max-h-screen">
      <h1 className="font-display font-black text-3xl text-noir-light uppercase tracking-widest text-shadow-glow mb-2">
        The Web
      </h1>
      <p className="text-noir-smoke font-mono text-xs uppercase tracking-tighter mb-8">
        {radiusMi != null ? `Within ${radiusMi}mi` : 'Nearby activity'} in the shadows
      </p>

      {error && <p className="mb-4 text-web-red text-sm">{error}</p>}

      {otherPosts.length === 0 ? (
        <p className="font-display italic text-noir-ash text-sm">
          No webs within {radiusMi ?? '?'}mi. Spin one from the Post tab.
        </p>
      ) : (
        otherPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onSwingIn={handleSwingIn}
            hasSwung={swungWebIds.has(post.id)}
          />
        ))
      )}

      <div className="mt-10 mb-20 text-center flex flex-col items-center gap-4">
        <div className="w-12 h-[1px] bg-noir-steel"></div>
        <p className="font-display italic text-noir-ash text-sm">
          &quot;The streets are quiet tonight...&quot;
        </p>
        <div className="w-12 h-[1px] bg-noir-steel"></div>
      </div>
    </div>
  );
};

export default Feed;
