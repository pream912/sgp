import React, { useEffect, useState } from 'react';

/**
 * The reveal moment: page screenshots stream in over SSE while the site is
 * being built, and each new shot wipes in diagonally — like a print surfacing
 * in a developer bath. Before the first shot arrives, a quiet shimmering
 * canvas holds the space.
 *
 * previews: [{ page, url, seq, stage }] (ascending seq)
 */
export default function ScreenshotReveal({ previews, businessName }) {
  const latest = previews.length ? previews[previews.length - 1] : null;
  const [shown, setShown] = useState(null);   // url currently displayed
  const [incoming, setIncoming] = useState(null); // url wiping in

  useEffect(() => {
    if (!latest || latest.url === shown || latest.url === incoming) return;
    const img = new Image();
    img.onload = () => setIncoming(latest.url);
    img.src = latest.url;
  }, [latest, shown, incoming]);

  const onWipeEnd = () => {
    if (incoming) {
      setShown(incoming);
      setIncoming(null);
    }
  };

  return (
    <div className="w-full">
      {/* Browser chrome frame */}
      <div className="rounded-xl overflow-hidden border border-white/10 bg-[#141824] shadow-2xl shadow-orange-950/40">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border-b border-white/10">
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <div className="ml-3 flex-1 min-w-0">
            <div className="text-[11px] text-slate-400 bg-white/[0.05] rounded-md px-3 py-1 truncate max-w-[240px]">
              {businessName ? `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.genweb.in` : 'yoursite.genweb.in'}
            </div>
          </div>
          {latest && (
            <span className="text-[10px] uppercase tracking-wider text-orange-400/80 whitespace-nowrap">
              {latest.page} {latest.stage === 'fixed' ? '· refined' : ''}
            </span>
          )}
        </div>

        <div className="relative aspect-[16/10] max-h-[45vh] w-full overflow-hidden">
          {/* Holding canvas before the first screenshot */}
          {!shown && !incoming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 build-shimmer">
              <div className="w-10 h-10 rounded-full border-2 border-orange-500/30 border-t-orange-400 animate-spin" />
              <p className="text-xs text-slate-400">Your first look will appear here</p>
            </div>
          )}

          {shown && (
            <img src={shown} alt="Website preview" className="absolute inset-0 w-full h-full object-cover object-top" />
          )}

          {incoming && (
            <img
              src={incoming}
              alt="New website preview"
              onAnimationEnd={onWipeEnd}
              className="absolute inset-0 w-full h-full object-cover object-top build-wipe-in"
            />
          )}
        </div>
      </div>
    </div>
  );
}
