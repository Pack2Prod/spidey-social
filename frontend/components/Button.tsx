import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, className = '', ...props }) => {
  if (variant === 'primary') {
    return (
      <button
        className={`
          bg-gradient-to-br from-web-crimson to-web-red
          text-noir-light font-semibold text-sm uppercase tracking-wider
          py-3 px-7 rounded-lg shadow-[0_4px_16px_rgba(198,40,40,0.3)]
          transition-all duration-200 cursor-pointer
          hover:from-web-red hover:to-web-ember hover:shadow-[0_6px_24px_rgba(198,40,40,0.45)] hover:-translate-y-[1px]
          active:scale-[0.97] active:shadow-[0_2px_8px_rgba(198,40,40,0.2)]
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }

  if (variant === 'secondary') {
    return (
      <button
        className={`
          bg-transparent border border-noir-steel
          text-noir-fog font-semibold py-2.5 px-6 rounded-lg
          transition-all duration-200 cursor-pointer
          hover:border-noir-smoke hover:text-noir-light hover:bg-white/5
          active:scale-[0.97]
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      className={`
        bg-transparent border-none text-noir-smoke underline underline-offset-[3px]
        py-2 px-4 transition-colors hover:text-noir-light
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
