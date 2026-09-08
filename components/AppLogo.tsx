import React from 'react';

export const AppLogo: React.FC<{ size?: number, className?: string }> = ({ size = 100, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="shieldGrad" x1="50" y1="0" x2="50" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fbbf24" />
        <stop offset="1" stopColor="#d97706" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    
    {/* Shield Body */}
    <path 
      d="M50 95C50 95 15 80 15 25L50 10L85 25C85 80 50 95 50 95Z" 
      fill="url(#shieldGrad)" 
      stroke="#78350f" 
      strokeWidth="3"
    />
    
    {/* Abstract Tiger Stripes / Wickets */}
    <path d="M35 35L42 65" stroke="#0f172a" strokeWidth="4" strokeLinecap="round"/>
    <path d="M50 30L50 70" stroke="#0f172a" strokeWidth="4" strokeLinecap="round"/>
    <path d="M65 35L58 65" stroke="#0f172a" strokeWidth="4" strokeLinecap="round"/>
    
    {/* Cricket Ball */}
    <circle cx="50" cy="78" r="8" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2"/>
    <path d="M46 74C48 76 52 76 54 74" stroke="#fca5a5" strokeWidth="1" strokeLinecap="round"/>
    <path d="M46 82C48 80 52 80 54 82" stroke="#fca5a5" strokeWidth="1" strokeLinecap="round"/>

    {/* Eyes (Fierce Look) */}
    <path d="M32 45L40 48" stroke="#0f172a" strokeWidth="3" strokeLinecap="round"/>
    <path d="M68 45L60 48" stroke="#0f172a" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);