'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import styles from './ScrollFade.module.css';

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkScroll();

    // Re-check when content might have changed
    const observer = new ResizeObserver(checkScroll);
    if (scrollRef.current) {
      observer.observe(scrollRef.current);
    }

    return () => observer.disconnect();
  }, [children]);

  return (
    <div className={cn(styles.Root, className)}>
      {/* Top fade */}
      <div 
        className={cn(styles.Fade, styles.TopFade, showTopFade && styles.Visible)}
      />
      
      {/* Scrollable content */}
      <div 
        ref={scrollRef}
        className={styles.Scroller}
        onScroll={checkScroll}
      >
        {children}
      </div>
      
      {/* Bottom fade with indicator */}
      <div 
        className={cn(styles.Fade, styles.BottomFade, showBottomFade && styles.Visible)}
      >
        <div className={styles.Hint}>
          <ChevronDown className={styles.HintIcon} />
          <span>scroll</span>
        </div>
      </div>
    </div>
  );
}




