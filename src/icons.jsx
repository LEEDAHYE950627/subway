import React from 'react';
function icon(children) {
  return function Icon({ size = 24, ...props }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
  };
}
export const ArrowUpRight = icon(<><path d="M6 18 18 6M6 6h12v12"/></>);
export const ArrowDownLeft = icon(<><path d="M18 6 6 18M6 6v12h12"/></>);
export const ArrowRight = icon(<><path d="M4 12h16m-6-6 6 6-6 6"/></>);
export const TrainFront = icon(<><rect x="5" y="3" width="14" height="16" rx="4"/><path d="M5 11h14M12 3v8M8 19l-2 3m10-3 2 3M9 6h6"/><circle cx="8.5" cy="15.5" r=".7"/><circle cx="15.5" cy="15.5" r=".7"/></>);
export const Radio = icon(<><circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17"/></>);
export const RefreshCw = icon(<><path d="M20 10a8 8 0 0 0-14-4L3 9m0-6v6h6M4 14a8 8 0 0 0 14 4l3-3m0 6v-6h-6"/></>);
export const Maximize = icon(<><path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/></>);
export const Minimize = icon(<><path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5"/></>);
export const CircleHelp = icon(<><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2.5M12 17h.01"/></>);
export const WifiOff = icon(<><path d="m3 3 18 18M2 8a16 16 0 0 1 3-2m5-1a16 16 0 0 1 12 3M5 12a11 11 0 0 1 3-1.8M13 10a11 11 0 0 1 6 2M8 16a6 6 0 0 1 7-1M12 20h.01"/></>);
