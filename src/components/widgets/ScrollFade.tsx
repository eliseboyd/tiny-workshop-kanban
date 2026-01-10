'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

type ScrollFadeProps = {
  children: ReactNode;
  className?: string;
};

export function ScrollFade({ children, className }: ScrollFadeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const isScrollable = scrollHeight > clientHeight;
    const isAtTop = scrollTop <= 5;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;

    setShowTopFade(isScrollable && !isAtTop);
    setShowBottomFade(isScrollable && !isAtBottom);
  };

  useEffect(() => {
    checkScroll();
    
    // Re-check when content might have changed
    const observer = new ResizeObserver(checkScroll);
    if (scrollRef.current) {
      observer.observe(scrollRef.current);
    }

    return () => observer.disconnect();
  }, [children]);

  return (
    <div className={cn("relative flex-1 min-h-0", className)}>
      {/* Top fade */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-card to-transparent z-10 pointer-events-none transition-opacity duration-200",
          showTopFade ? "opacity-100" : "opacity-0"
        )}
      />
      
      {/* Scrollable content */}
      <div 
        ref={scrollRef}
        className="h-full overflow-y-auto"
        onScroll={checkScroll}
      >
        {children}
      </div>
      
      {/* Bottom fade with indicator */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card via-card/80 to-transparent z-10 pointer-events-none transition-opacity duration-200 flex items-end justify-center pb-1",
          showBottomFade ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="flex items-center gap-1 text-muted-foreground/60 text-[10px] font-medium">
          <ChevronDown className="h-3 w-3 animate-bounce" />
          <span>scroll</span>
        </div>
      </div>
    </div>
  );
}




