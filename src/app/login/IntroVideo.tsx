"use client";

import { useState } from "react";

export default function IntroVideo({ src }: { src: string }) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <video
        src={src}
        autoPlay
        muted
        playsInline
        onEnded={() => setVisible(false)}
        className="max-h-full max-w-full"
      />
      <button
        onClick={() => setVisible(false)}
        className="absolute bottom-6 right-6 rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white"
      >
        Saltar intro
      </button>
    </div>
  );
}