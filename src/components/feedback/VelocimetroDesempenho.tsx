import { CLASS_COLORS, CLASS_LABELS, type FbClassificacao } from "@/hooks/useFeedback";

interface Props {
  pontuacao: number | null;
  classificacao: FbClassificacao | null;
  size?: number;
}

export function VelocimetroDesempenho({ pontuacao, classificacao, size = 220 }: Props) {
  const pct = pontuacao ? Math.max(0, Math.min(1, (pontuacao - 10) / 30)) : 0;
  const angle = -90 + pct * 180; // -90 to 90
  const cx = size / 2;
  const cy = size * 0.6;
  const r = size * 0.4;

  // Arc segments per classificação band, proportional to range size
  const bands: { from: number; to: number; color: string; label: FbClassificacao }[] = [
    { from: 10, to: 18, color: CLASS_COLORS.insuficiente, label: "insuficiente" },
    { from: 19, to: 23, color: CLASS_COLORS.fraco, label: "fraco" },
    { from: 24, to: 28, color: CLASS_COLORS.razoavel, label: "razoavel" },
    { from: 29, to: 34, color: CLASS_COLORS.bom, label: "bom" },
    { from: 35, to: 40, color: CLASS_COLORS.excelente, label: "excelente" },
  ];

  const toAngle = (v: number) => -90 + ((v - 10) / 30) * 180;
  const arc = (a1: number, a2: number) => {
    const rad = (a: number) => (a * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(a1));
    const y1 = cy + r * Math.sin(rad(a1));
    const x2 = cx + r * Math.cos(rad(a2));
    const y2 = cy + r * Math.sin(rad(a2));
    const large = a2 - a1 > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const needleRad = (angle * Math.PI) / 180;
  const nx = cx + r * 0.9 * Math.cos(needleRad);
  const ny = cy + r * 0.9 * Math.sin(needleRad);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.75}`}>
        {bands.map((b, i) => (
          <path key={i} d={arc(toAngle(b.from - 0.5), toAngle(b.to + 0.5))}
                stroke={b.color} strokeWidth={size * 0.09} fill="none" strokeLinecap="butt" />
        ))}
        {pontuacao !== null && (
          <>
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="hsl(var(--foreground))" strokeWidth={3} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={6} fill="hsl(var(--foreground))" />
          </>
        )}
      </svg>
      <div className="text-center -mt-2">
        <div className="text-3xl font-bold">{pontuacao ?? "—"}<span className="text-sm font-normal text-muted-foreground"> / 40</span></div>
        {classificacao && (
          <div className="mt-1 inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
               style={{ backgroundColor: CLASS_COLORS[classificacao] + "22", color: CLASS_COLORS[classificacao] }}>
            {CLASS_LABELS[classificacao]}
          </div>
        )}
      </div>
    </div>
  );
}
