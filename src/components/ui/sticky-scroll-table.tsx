import { useEffect, useRef, useState, ReactNode } from "react";

/**
 * Wrapper que adiciona uma barra de rolagem horizontal "sticky" no topo do viewport,
 * sincronizada com o scroll horizontal da tabela abaixo.
 *
 * A barra fake fica fixa no topo da janela (position: sticky, top: 0) enquanto
 * o usuário rola verticalmente a página, permitindo navegar lateralmente sem
 * precisar descer até o final da tabela para alcançar a scrollbar nativa.
 */
interface StickyScrollTableProps {
  children: ReactNode;
  /** Mantido por compatibilidade — não é mais aplicado para permitir o sticky real no viewport. */
  maxHeight?: string;
  className?: string;
  /** Offset (px) do topo da janela onde a barra deve grudar (caso haja header fixo). */
  topOffset?: number;
}

export function StickyScrollTable({ children, className = "", topOffset = 0 }: StickyScrollTableProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const floatingScrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [floatingState, setFloatingState] = useState({ visible: false, left: 0, width: 0, bottom: 16 });
  const syncing = useRef<"top" | "floating" | "bottom" | null>(null);
  const barHeight = 14;
  const viewportPadding = 16;

  useEffect(() => {
    const updateLayout = () => {
      if (!wrapperRef.current || !contentRef.current || !innerRef.current) return;

      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      const nextContentWidth = innerRef.current.scrollWidth;
      const hasHorizontalOverflow = nextContentWidth > contentRef.current.clientWidth + 1;
      const availableLeft = Math.max(contentRect.left, viewportPadding);
      const availableRight = Math.min(contentRect.right, window.innerWidth - viewportPadding);
      const availableWidth = Math.max(0, availableRight - availableLeft);
      const visibleInViewport =
        wrapperRect.top < window.innerHeight - (barHeight + viewportPadding) &&
        wrapperRect.bottom > topOffset + barHeight + 8;

      setContentWidth(nextContentWidth);

      setFloatingState({
        visible: hasHorizontalOverflow && visibleInViewport && availableWidth > 0,
        left: availableLeft,
        width: availableWidth,
        bottom: viewportPadding,
      });
    };

    updateLayout();

    const resizeObserver = new ResizeObserver(updateLayout);

    if (wrapperRef.current) resizeObserver.observe(wrapperRef.current);
    if (contentRef.current) resizeObserver.observe(contentRef.current);
    if (innerRef.current) resizeObserver.observe(innerRef.current);

    window.addEventListener("scroll", updateLayout, { passive: true });
    window.addEventListener("resize", updateLayout);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updateLayout);
      window.removeEventListener("resize", updateLayout);
    };
  }, [children, topOffset]);

  const syncScroll = (source: "top" | "floating" | "bottom") => {
    if (syncing.current && syncing.current !== source) {
      syncing.current = null;
      return;
    }

    const refs = {
      top: topScrollRef,
      floating: floatingScrollRef,
      bottom: contentRef,
    } as const;

    const scrollLeft = refs[source].current?.scrollLeft ?? 0;
    syncing.current = source;

    Object.entries(refs).forEach(([key, ref]) => {
      if (key !== source && ref.current) {
        ref.current.scrollLeft = scrollLeft;
      }
    });

    requestAnimationFrame(() => {
      if (syncing.current === source) syncing.current = null;
    });
  };

  const handleTopScroll = () => {
    syncScroll("top");
  };

  const handleFloatingScroll = () => {
    syncScroll("floating");
  };

  const handleBottomScroll = () => {
    syncScroll("bottom");
  };

  return (
    <div ref={wrapperRef} className={`border rounded-lg ${className}`}>
      {floatingState.visible && (
        <div
          ref={floatingScrollRef}
          onScroll={handleFloatingScroll}
          className="fixed overflow-x-auto overflow-y-hidden rounded-md border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 z-40"
          style={{
            bottom: floatingState.bottom,
            left: floatingState.left,
            width: floatingState.width,
            height: barHeight,
          }}
        >
          <div style={{ width: contentWidth, height: 1 }} />
        </div>
      )}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden border-b bg-muted/40 backdrop-blur supports-[backdrop-filter]:bg-muted/60"
        style={{ height: barHeight }}
      >
        <div style={{ width: contentWidth, height: 1 }} />
      </div>
      <div
        ref={contentRef}
        onScroll={handleBottomScroll}
        className="overflow-x-auto"
      >
        <div ref={innerRef}>{children}</div>
      </div>
    </div>
  );
}
