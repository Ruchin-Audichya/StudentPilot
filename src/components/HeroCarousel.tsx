import { useEffect, useMemo, useRef, useState } from 'react';

type Slide = { src: string; alt: string; caption?: string };

type Props = {
  slides: Slide[];
  intervalMs?: number;
  className?: string;
};

export default function HeroCarousel({ slides, intervalMs = 4000, className }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const prefersReduced = useMemo(() => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  const next = () => setIndex((i) => (i + 1) % Math.max(slides.length, 1));
  const prev = () => setIndex((i) => (i - 1 + Math.max(slides.length, 1)) % Math.max(slides.length, 1));

  useEffect(() => {
    if (!slides.length || prefersReduced) return;
    const id = setInterval(() => { if (!paused) next(); }, intervalMs);
    return () => clearInterval(id);
  }, [slides.length, paused, intervalMs, prefersReduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!slides.length) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 ${className || ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const start = touchStartX.current; touchStartX.current = null;
        if (start == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? start) - start;
        const threshold = 30; // px
        if (dx > threshold) prev();
        if (dx < -threshold) next();
      }}
    >
      {/* Slides */}
      <div className="relative aspect-[4/3] md:aspect-[16/9]">
        {slides.map((s, i) => (
          <img
            key={i}
            src={s.src}
            alt={s.alt}
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
      </div>

      {/* Caption */}
      {slides[index]?.caption && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4">
          <div className="inline-block rounded-full bg-black/55 px-3 py-1 text-xs sm:text-sm text-white shadow">
            {slides[index]?.caption}
          </div>
        </div>
      )}

      {/* Controls (md+) */}
      <button aria-label="Previous" onClick={prev}
        className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white">‹</button>
      <button aria-label="Next" onClick={next}
        className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white">›</button>

      {/* Dots */}
      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i+1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 w-6 rounded-full transition ${i===index? 'bg-white' : 'bg-white/40 hover:bg-white/70'}`}
          />
        ))}
      </div>
    </div>
  );
}
