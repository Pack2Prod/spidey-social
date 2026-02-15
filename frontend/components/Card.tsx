import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`
        bg-gradient-to-br from-noir-charcoal to-[#16161B]
        border border-noir-steel border-t-[#3D3D4788] border-l-[#3D3D4744]
        shadow-[0_4px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)]
        rounded-xl p-5
        transition-all duration-300
        hover:border-web-crimson/40 hover:-translate-y-0.5
        ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default Card;
