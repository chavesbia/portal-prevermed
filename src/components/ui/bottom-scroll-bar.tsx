import { ReactNode, useEffect, useRef, useState } from "react";

/**
 * Container com rolagem horizontal + barra flutuante fixa no rodapé da janela,
 * sincronizada com a tabela. Aparece sempre que o fim da tabela está fora da tela.
 */
export function BottomScrollContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [st, setSt] = useState({ visible: false, left: 0, width: 0, content: 0 });

  useEffect(() => {
    const update = () => {
      const box = boxRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const overflow = box.scrollWidth > box.clientWidth + 1;
      const visible = overflow && r.top < window.innerHeight - 40 && r.bottom > window.innerHeight;
      setSt({ visible, left: r.left, width: r.width, content: box.scrollWidth });
    };
    update();
    const ro = new ResizeObserver(update);
    if (boxRef.current) { ro.observe(boxRef.current); if (boxRef.current.firstElementChild) ro.observe(boxRef.current.firstElementChild); }
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, []);

  useEffect(() => { if (st.visible && barRef.current && boxRef.current) barRef.current.scrollLeft = boxRef.current.scrollLeft; }, [st.visible]);

  const sync = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (from && to && Math.abs(to.scrollLeft - from.scrollLeft) > 1) to.scrollLeft = from.scrollLeft;
  };

  return (
    <>
      <div ref={boxRef} className={className} onScroll={() => sync(boxRef.current, barRef.current)}>{children}</div>
      {st.visible && (
        <div
          ref={barRef}
          onScroll={() => sync(barRef.current, boxRef.current)}
          className="fixed bottom-0 z-40 overflow-x-auto overflow-y-hidden border-t bg-background/95 shadow-md"
          style={{ left: st.left, width: st.width, height: 18 }}
        >
          <div style={{ width: st.content, height: 1 }} />
        </div>
      )}
    </>
  );
}
