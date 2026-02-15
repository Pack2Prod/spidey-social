import React from 'react';
import { WebPost } from '../types';
import Card from './Card';
import Button from './Button';
import { Clock, MapPin, Zap } from 'lucide-react';

interface PostCardProps {
  post: WebPost;
  onSwingIn: (id: string) => void;
  isOwnPost?: boolean;
  /** When true, user already swung into this post (can only swing once) */
  hasSwung?: boolean;
}

const PostCard: React.FC<PostCardProps> = ({ post, onSwingIn, isOwnPost, hasSwung }) => {
  const canSwing = !isOwnPost && !hasSwung;
  return (
    <div className="web-post-animate mb-5">
      <Card>
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-3">
            <img src={`https://picsum.photos/seed/${post.userId}/48/48`} className="w-12 h-12 rounded-lg border border-noir-steel" alt={post.userName} />
            <div>
              <h3 className="text-noir-light font-semibold leading-tight">{post.userName}</h3>
              <p className="text-xs text-noir-smoke font-mono tracking-tighter">{post.userHandle} • {post.userUniversity}</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className={`flex items-center gap-1.5 font-mono text-[0.8rem] ${post.ttl < 5 ? 'text-web-red' : 'text-web-amber'} ${post.ttl < 10 ? 'timer-pulse' : ''}`}>
              <Clock size={14} />
              <span>{post.ttl}m</span>
            </div>
            <div className="text-web-amber text-xs font-mono mt-0.5">★ {post.userAura} AURA</div>
          </div>
        </div>

        <p className="text-noir-fog leading-relaxed mb-4 italic">
          &quot;{post.content}&quot;
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="bg-noir-graphite text-noir-smoke text-[0.7rem] px-2.5 py-1 rounded-md flex items-center gap-1 uppercase tracking-wide">
            <Zap size={10} className="text-web-crimson" /> {post.category}
          </span>
          <span className="bg-noir-graphite text-noir-smoke text-[0.7rem] px-2.5 py-1 rounded-md flex items-center gap-1 uppercase tracking-wide">
            <MapPin size={10} /> {post.distance} away
          </span>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-noir-steel/30">
          <span className="text-xs text-noir-ash font-mono">{post.joinedCount} heroes swinging in</span>
          {canSwing ? (
            <Button variant="primary" className="!py-2 !px-4 !text-xs" onClick={() => onSwingIn(post.id)}>
              🕸 Swing In
            </Button>
          ) : hasSwung ? (
            <span className="text-xs text-noir-ash font-mono italic">Already swung in</span>
          ) : (
            <span className="text-xs text-noir-ash font-mono italic">Your post</span>
          )}
        </div>
      </Card>
    </div>
  );
};

export default PostCard;
