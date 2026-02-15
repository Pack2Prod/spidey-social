import React, { useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { rewriteInNoir } from '../services/geminiService';
import { createWeb } from '../api/webs';
import { getPosition } from '../lib/geolocation';
import { Sparkles, Send } from 'lucide-react';

const TTL_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
];

const VISIBILITY_OPTIONS = [
  { value: 0.5, label: '0.5 mi' },
  { value: 1, label: '1 mi' },
  { value: 2, label: '2 mi' },
  { value: 5, label: '5 mi' },
  { value: 10, label: '10 mi' },
];

const CATEGORIES = ['Coffee', 'Food', 'Study', 'Music', 'Sports', 'Art', 'General'];

interface PostProps {
  onPostSuccess?: () => void;
}

const Post: React.FC<PostProps> = ({ onPostSuccess }) => {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [ttl, setTtl] = useState(60);
  const [visibilityRadius, setVisibilityRadius] = useState(2);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState('');

  const handleRewrite = async () => {
    if (!content) return;
    setIsRewriting(true);
    setError('');
    const noirVersion = await rewriteInNoir(content);
    setContent(noirVersion);
    setIsRewriting(false);
  };

  const handlePost = async () => {
    if (!content.trim()) return;
    setIsPosting(true);
    setError('');
    try {
      const coords = await getPosition();
      await createWeb(content.trim(), category, ttl, coords, visibilityRadius);
      setContent('');
      onPostSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Post failed.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex flex-col pt-8 pb-32 px-4 h-screen overflow-y-auto">
      <div className="mb-8">
        <h1 className="font-display font-black text-3xl text-noir-light uppercase tracking-widest">
          Spin a Web
        </h1>
        <p className="text-noir-smoke font-mono text-xs uppercase tracking-tighter">
          Share your presence in the shadows
        </p>
      </div>

      <Card className="mb-6">
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening in your corner of the city?"
            className="w-full bg-noir-graphite border border-noir-steel rounded-lg p-4 text-noir-light min-h-[180px] focus:outline-none focus:border-web-crimson focus:ring-2 focus:ring-web-crimson/20 placeholder:text-noir-ash italic"
          ></textarea>

          <div className="absolute bottom-4 right-4 text-[0.6rem] font-mono text-noir-ash">
            {content.length}/280
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-noir-graphite border border-noir-steel rounded-lg px-3 py-2 text-sm text-noir-light focus:outline-none focus:border-web-crimson"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={ttl}
              onChange={(e) => setTtl(Number(e.target.value))}
              className="bg-noir-graphite border border-noir-steel rounded-lg px-3 py-2 text-sm text-noir-light focus:outline-none focus:border-web-crimson"
            >
              {TTL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  Dissolves in {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-noir-ash font-mono uppercase tracking-wider mb-1">
              Location radius — who can see this
            </label>
            <select
              value={visibilityRadius}
              onChange={(e) => setVisibilityRadius(Number(e.target.value))}
              className="w-full bg-noir-graphite border border-noir-steel rounded-lg px-3 py-2 text-sm text-noir-light focus:outline-none focus:border-web-crimson"
            >
              {VISIBILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} — only people within this distance
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mt-2 text-web-red text-xs">{error}</p>}

        <div className="mt-4 flex flex-col gap-3">
          <Button
            variant="secondary"
            className="w-full flex items-center justify-center gap-2 group"
            onClick={handleRewrite}
            disabled={!content || isRewriting}
          >
            <Sparkles size={16} className={isRewriting ? 'animate-spin text-web-amber' : 'group-hover:text-web-amber'} />
            {isRewriting ? 'Translating to Noir...' : 'Noir Narrator'}
          </Button>

          <Button
            variant="primary"
            className="w-full flex items-center justify-center gap-2"
            onClick={handlePost}
            disabled={!content.trim() || isPosting}
          >
            <Send size={16} />
            {isPosting ? 'Spinning...' : 'Post Connection'}
          </Button>
        </div>
      </Card>

      <div className="bg-noir-charcoal/50 border border-dashed border-noir-steel rounded-xl p-6 text-center">
        <h3 className="font-display text-lg text-noir-smoke mb-2">Spider&apos;s Rule</h3>
        <p className="text-xs text-noir-ash leading-relaxed">
          Every web you spin only lasts for a limited time. Once the timer hits zero,
          it dissolves back into the shadows of the city. Make your connections count.
        </p>
      </div>
    </div>
  );
};

export default Post;
