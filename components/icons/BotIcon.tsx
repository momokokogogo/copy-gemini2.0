
import React from 'react';

const BotIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 text-white"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <rect x="7" y="7" width="10" height="10" rx="2.5" />
    <path d="M10 11h4" />
    <path d="M12 7v-2" />
    <path d="M12 17v2" />
    <path d="M17 12h2" />
    <path d="M7 12h-2" />
  </svg>
);

export default BotIcon;
