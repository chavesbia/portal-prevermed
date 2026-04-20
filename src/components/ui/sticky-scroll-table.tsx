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
  const topScrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const syncing = useRef<"top" | "bottom" | null>(null);

  // Mede a largura real do conteúdo para dimensionar a barra fake
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
    <div className={`border rounded-lg ${className}`}>
      {/* Barra de rolagem horizontal sticky no topo do viewport */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden border-b bg-muted/40 backdrop-blur supports-[backdrop-filter]:bg-muted/60 z-30"
        style={{ height: 14, position: "sticky", top: topOffset }}
      >
        <div style={{ width: contentWidth, height: 1 }} />
      </div>
      {/* Conteúdo real (scroll horizontal nativo da tabela) */}
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
