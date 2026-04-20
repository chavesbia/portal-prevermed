import { useEffect, useRef, useState, ReactNode } from "react";

/**
 * Wrapper que adiciona uma barra de rolagem horizontal "sticky" no topo,
 * sincronizada com o scroll horizontal do conteúdo abaixo.
 * Útil para tabelas largas onde o usuário precisa rolar lateralmente
 * sem descer até o final da página.
 */
interface StickyScrollTableProps {
  children: ReactNode;
  maxHeight?: string;
  className?: string;
}

export function StickyScrollTable({ children, maxHeight = "calc(100vh - 400px)", className = "" }: StickyScrollTableProps) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const syncing = useRef<"top" | "bottom" | null>(null);

  // Mede a largura real do conteúdo (tabela) para dimensionar a barra fake do topo
  useEffect(() => {
    if (!innerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (innerRef.current) setContentWidth(innerRef.current.scrollWidth);
    });
    ro.observe(innerRef.current);
    setContentWidth(innerRef.current.scrollWidth);
    return () => ro.disconnect();
  }, [children]);

  const handleTopScroll = () => {
    if (syncing.current === "bottom") { syncing.current = null; return; }
    if (contentRef.current && topScrollRef.current) {
      syncing.current = "top";
      contentRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (syncing.current === "top") { syncing.current = null; return; }
    if (contentRef.current && topScrollRef.current) {
      syncing.current = "bottom";
      topScrollRef.current.scrollLeft = contentRef.current.scrollLeft;
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* Barra de rolagem horizontal sticky no topo */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden border-b bg-muted/30"
        style={{ height: 14 }}
      >
        <div style={{ width: contentWidth, height: 1 }} />
      </div>
      {/* Conteúdo real com scroll vertical + horizontal */}
      <div
        ref={contentRef}
        onScroll={handleBottomScroll}
        style={{ overflow: "auto", maxHeight }}
      >
        <div ref={innerRef}>{children}</div>
      </div>
    </div>
  );
}
