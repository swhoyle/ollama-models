import React from 'react';

const paths = {
  external: 'M7 17 17 7M7 7h10v10',
  up: 'M12 19V5m-5 5 5-5 5 5',
  down: 'M12 5v14m-5-5 5 5 5-5',
  sort: 'm8 9 4-4 4 4m-8 6 4 4 4-4',
  left: 'M19 12H5m6-6-6 6 6 6',
  right: 'M5 12h14m-6-6 6 6-6 6',
  info: 'M12 11v6m0-10h.01',
  clock: 'M12 7v5l3 2',
};

export default function Icon({ name, className = '' }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {['info', 'clock'].includes(name) && <circle cx="12" cy="12" r="9" />}
    <path d={paths[name]} />
  </svg>;
}
