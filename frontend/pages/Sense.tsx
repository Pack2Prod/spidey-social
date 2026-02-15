import React, { useState, useEffect, useCallback } from 'react';
import { listWebs, swingIn } from '../api/webs';
import { getPosition } from '../lib/geolocation';
import { useRadius } from '../lib/RadiusContext';
import Card from '../components/Card';
import Button from '../components/Button';
import { X, MapPin } from 'lucide-react';
import type { WebPost } from '../types';
import type { AppTab } from '../types';

interface SenseProps {
  onNavigate?: (tab: AppTab) => void;
}

const Sense: React.FC<SenseProps> = ({ onNavigate }) => {
  const { radiusMi, setRadiusMi, radii } = useRadius();
  const [webs, setWebs] = useState<WebPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWeb, setSelectedWeb] = useState<WebPost | null>(null);
  const [swingingIn, setSwingingIn] = useState(false);

  const fetchWebs = useCallback(async (radius: number | null) => {
    try {
      setError('');
      const coords = await getPosition();
      if (!coords) {
        const list = await listWebs(null, null);
        setWebs(list);
        setRadiusMi(null);
        setLoading(false);
        return;
      }
      if (radius != null) {
        const list = await listWebs(coords, radius);
        setWebs(list);
        setRadiusMi(radius);
      } else {
        for (const r of radii) {
          const list = await listWebs(coords, r);
          setRadiusMi(r);
          if (list.length > 0) {
            setWebs(list);
            setLoading(false);
            return;
          }
        }
        setWebs(await listWebs(coords, radii[radii.length - 1]!));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan.');
    } finally {
      setLoading(false);
    }
  }, [radii, setRadiusMi]);

  useEffect(() => {
    fetchWebs(radiusMi);
  }, [radiusMi, fetchWebs]);

  const websOnRadar = webs.filter((w) => w.radarX != null && w.radarY != null);

  if (loading) {
    return (
      <div className="flex flex-col items-center pt-8 pb-32 h-screen overflow-hidden">
        <h1 className="font-display font-black text-3xl text-noir-light uppercase tracking-widest mb-2">
          Spider-Sense
        </h1>
        <p className="text-noir-ash font-mono animate-pulse">Scanning vicinity...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-8 pb-32 h-screen overflow-hidden relative">
      <div className="w-full px-4 mb-4 z-10">
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-display font-black text-3xl text-noir-light uppercase tracking-widest">
            Spider-Sense
          </h1>
          <p className="text-noir-smoke font-mono text-xs uppercase tracking-tighter">
            Radar active — {websOnRadar.length} within {radiusMi ?? '?'}mi
          </p>
          <select
            value={radiusMi ?? 'auto'}
            onChange={(e) => {
              const v = e.target.value;
              setRadiusMi(v === 'auto' ? null : Number(v));
            }}
            className="bg-noir-graphite border border-noir-steel rounded-lg px-3 py-2 text-sm text-noir-light focus:outline-none focus:border-web-crimson"
          >
            <option value="auto">Auto (expand)</option>
            {radii.map((r) => (
              <option key={r} value={r}>
                {r} mi
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-web-red text-sm mb-2">{error}</p>}

      <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(var(--noir-steel)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute w-[80%] aspect-square rounded-full border border-web-red/10 radar-sweep" />
        <div className="absolute w-[60%] aspect-square rounded-full border border-web-red/10 radar-sweep [animation-delay:1s]" />
        <div className="absolute w-[40%] aspect-square rounded-full border border-web-red/10 radar-sweep [animation-delay:2s]" />

        {websOnRadar.map((web) => (
          <button
            key={web.id}
            onClick={() => setSelectedWeb(web)}
            className="absolute p-1 transition-all hover:scale-125 z-20 group -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(web.radarX ?? 0.5) * 100}%`,
              top: `${(web.radarY ?? 0.5) * 100}%`,
            }}
          >
            <div
              className={`
                w-4 h-4 rounded-full shadow-lg
                ${web.userAura > 500 ? 'bg-web-amber border-2 border-white' : 'bg-web-red'}
                group-hover:ring-4 ring-web-red/20 animate-pulse
              `}
            />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-noir-charcoal/90 px-2 py-0.5 rounded text-[0.6rem] text-noir-light whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {web.userName} • {web.distance}
            </div>
          </button>
        ))}

        <div className="relative z-30 w-16 h-16 rounded-full border-2 border-web-crimson p-1 shadow-[0_0_20px_rgba(139,26,26,0.4)]">
          <img
            src="https://picsum.photos/seed/me/100/100"
            className="w-full h-full rounded-full grayscale brightness-50 contrast-125"
            alt="You"
          />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-web-red rounded-full border-2 border-noir-black animate-ping" />
        </div>
      </div>

      {websOnRadar.length === 0 && !error && (
        <p className="text-noir-ash text-sm text-center px-6">
          No one within {radiusMi ?? 10}mi. Enable location or spin a web from Post.
        </p>
      )}

      {selectedWeb && (
        <div className="absolute inset-x-0 bottom-24 p-4 z-50 animate-in slide-in-from-bottom-20 duration-300">
          <Card className="relative overflow-visible">
            <button
              onClick={() => setSelectedWeb(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-noir-graphite rounded-full border border-noir-steel flex items-center justify-center text-noir-light hover:text-web-red transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col">
              <div className="flex gap-3 mb-3">
                <img
                  src={`https://picsum.photos/seed/${selectedWeb.userId}/96/96`}
                  className="w-16 h-16 rounded-xl border-2 border-noir-steel"
                  alt={selectedWeb.userName}
                />
                <div>
                  <h2 className="text-lg font-display font-bold text-noir-light tracking-wide uppercase">
                    {selectedWeb.userName}
                  </h2>
                  <p className="text-xs text-noir-smoke font-mono">
                    {selectedWeb.userHandle} • {selectedWeb.userUniversity}
                  </p>
                  <div className="flex gap-1.5 items-center text-noir-ash text-xs mt-1">
                    <MapPin size={12} className="text-web-red" />
                    <span>{selectedWeb.distance} away</span>
                  </div>
                  <div className="text-web-amber text-xs font-mono mt-0.5">★ {selectedWeb.userAura} AURA</div>
                </div>
              </div>

              <p className="text-noir-fog text-sm italic mb-4">&quot;{selectedWeb.content}&quot;</p>

              <div className="flex gap-2 mb-4">
                <span className="bg-noir-graphite text-noir-smoke text-[0.65rem] px-2 py-1 rounded border border-noir-steel">
                  {selectedWeb.category}
                </span>
                <span className="text-xs text-noir-ash">{selectedWeb.joinedCount} swinging in</span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  disabled={swingingIn}
                  onClick={async () => {
                    setSwingingIn(true);
                    try {
                      const coords = await getPosition();
                      await swingIn(selectedWeb.id, coords ?? undefined);
                      setWebs((prev) =>
                        prev.map((p) =>
                          p.id === selectedWeb.id
                            ? { ...p, joinedCount: p.joinedCount + 1 }
                            : p
                        )
                      );
                      setSelectedWeb((w) => (w ? { ...w, joinedCount: w.joinedCount + 1 } : null));
                    } catch {
                      /* ignore */
                    } finally {
                      setSwingingIn(false);
                    }
                  }}
                >
                  {swingingIn ? '...' : '🕸 Swing In'}
                </Button>
                <Button variant="secondary" onClick={() => { setSelectedWeb(null); onNavigate?.('feed'); }}>
                  Feed
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Sense;
