import React, { useState, useEffect, useCallback } from 'react';
import { listWebs, swingIn } from '../api/webs';
import { getPosition } from '../lib/geolocation';
import { useRadius } from '../lib/RadiusContext';
import PostCard from '../components/PostCard';
import type { WebPost } from '../types';

const Feed: React.FC = () => {
  const { radiusMi, setRadiusMi, radii } = useRadius();
  const [posts, setPosts] = useState<WebPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWebs = useCallback(
    async (radius: number | null) => {
      try {
        setError('');
        const coords = await getPosition();
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
    fetchWebs(radiusMi);
  }, [radiusMi, fetchWebs]);

  const handleSwingIn = async (id: string) => {
    try {
      const coords = await getPosition();
      await swingIn(id, coords ?? undefined);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, joinedCount: p.joinedCount + 1 } : p
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Swing in failed.');
    }
  };

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
      <div className="mb-8">
        <h1 className="font-display font-black text-3xl text-noir-light uppercase tracking-widest text-shadow-glow">
          The Web
        </h1>
        <p className="text-noir-smoke font-mono text-xs uppercase tracking-tighter">
          {radiusMi != null ? `Within ${radiusMi}mi` : 'Nearby activity'} in the shadows
        </p>
      </div>

      {error && <p className="mb-4 text-web-red text-sm">{error}</p>}

      {posts.length === 0 ? (
        <p className="font-display italic text-noir-ash text-sm">
          No webs within {radiusMi ?? '?'}mi. Spin one from the Post tab.
        </p>
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} post={post} onSwingIn={handleSwingIn} />
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
