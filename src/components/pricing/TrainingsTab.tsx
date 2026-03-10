import { useState } from "react";
import { GraduationCap, Clock, Users, Search, Calculator } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const TRAININGS = [
  // NR 01 - Disposições Gerais
  {
    id: "nr01-os",
    baseLegal: "NR 01",
    name: "Treinamento de Ordem de Serviço",
    hours: 2,
    type: "LIVRE/INTEGRAÇÃO/ANUAL",
    priceTier1_3: 507,
    priceTier4_6: 846.3,
    priceTier7_10: 1210.73,
    priceAbove10: 87.97,
  },
  {
    id: "nr01-frio",
    baseLegal: "NR 01",
    name: "Segurança no Acesso a Câmaras Frias",
    hours: 2,
    type: "LIVRE/INTEGRAÇÃO/ANUAL",
    priceTier1_3: 1417,
    priceTier4_6: 2575.3,
    priceTier7_10: 3819.4,
    priceAbove10: 300.3,
  },
  // NR 05 - CIPA
  {
    id: "nr05-designado",
    baseLegal: "NR 05",
    name: "Designado de CIPA",
    hours: 8,
    type: "FORMAÇÃO",
    priceTier1_3: 832,
    priceTier4_6: 1463.8,
    priceTier7_10: 2142.4,
    priceAbove10: 163.8,
  },
  {
    id: "nr05-cipa",
    baseLegal: "NR 05",
    name: "CIPA (Comissão Interna de Prevenção de Acidentes e Assédio)",
    hours: 8,
    type: "FORMAÇÃO",
    priceTier1_3: 832,
    priceTier4_6: 1463.8,
    priceTier7_10: 2142.4,
    priceAbove10: 163.8,
  },
  // NR 06 - EPIs
  {
    id: "nr06-epi",
    baseLegal: "NR 06",
    name: "Uso, Guarda e Conservação de EPIs",
    hours: 2,
    type: "LIVRE/INTEGRAÇÃO/ANUAL",
    priceTier1_3: 507,
    priceTier4_6: 846.3,
    priceTier7_10: 1210.73,
    priceAbove10: 87.97,
  },
  // NR 10 - Eletricidade
  {
    id: "nr10-basico",
    baseLegal: "NR 10",
    name: "Segurança em Instalações e Serviços com Eletricidade",
    hours: 40,
    type: "FORMAÇÃO",
    priceTier1_3: 3497,
    priceTier4_6: 6527.3,
    priceTier7_10: 9782.07,
    priceAbove10: 785.63,
  },
  {
    id: "nr10-sep",
    baseLegal: "NR 10",
    name: "Segurança no Sistema Elétrico de Potência (SEP) e em suas Proximidades",
    hours: 40,
    type: "FORMAÇÃO",
    priceTier1_3: 3497,
    priceTier4_6: 6527.3,
    priceTier7_10: 9782.07,
    priceAbove10: 785.63,
  },
  // NR 11 - Transporte e Movimentação
  {
    id: "nr11-ponte-rolante",
    baseLegal: "NR 11",
    name: "Segurança na Operação de Ponte Rolante",
    hours: 16,
    type: "FORMAÇÃO",
    priceTier1_3: 1547,
    priceTier4_6: 2827.3,
    priceTier7_10: 4182.07,
    priceAbove10: 325.63,
  },
  {
    id: "nr11-empilhadeira",
    baseLegal: "NR 11",
    name: "Segurança na Operação de Empilhadeira",
    hours: 16,
    type: "FORMAÇÃO",
    priceTier1_3: 1547,
    priceTier4_6: 2827.3,
    priceTier7_10: 4182.07,
    priceAbove10: 325.63,
  },
  {
    id: "nr11-transporte",
    baseLegal: "NR 11",
    name: "Transporte, Movimentação, Armazenagem e Manuseio de Materiais",
    hours: 8,
    type: "FORMAÇÃO",
    priceTier1_3: 897,
    priceTier4_6: 1587.3,
    priceTier7_10: 2328.73,
    priceAbove10: 178.97,
  },
  // NR 12 - Máquinas e Equipamentos
  {
    id: "nr12-maquinas",
    baseLegal: "NR 12",
    name: "Segurança no Trabalho em Máquinas e Equipamentos",
    hours: 16,
    type: "FORMAÇÃO",
    priceTier1_3: 1547,
    priceTier4_6: 2827.3,
    priceTier7_10: 4182.07,
    priceAbove10: 325.63,
  },
  // NR 17 - Ergonomia
  {
    id: "nr17-checkout",
    baseLegal: "NR 17",
    name: "Checkout",
    hours: 4,
    type: "FORMAÇÃO",
    priceTier1_3: 697,
    priceTier4_6: 1207.3,
    priceTier7_10: 1755.73,
    priceAbove10: 132.47,
  },
  {
    id: "nr17-telemarketing",
    baseLegal: "NR 17",
    name: "Teleatendimento / Telemarketing",
    hours: 4,
    type: "FORMAÇÃO",
    priceTier1_3: 697,
    priceTier4_6: 1207.3,
    priceTier7_10: 1755.73,
    priceAbove10: 132.47,
  },
  {
    id: "nr17-cargas",
    baseLegal: "NR 17",
    name: "Levantamento, Transporte e Descarga Individual de Cargas",
    hours: 4,
    type: "FORMAÇÃO",
    priceTier1_3: 697,
    priceTier4_6: 1207.3,
    priceTier7_10: 1755.73,
    priceAbove10: 132.47,
  },
  {
    id: "nr17-administrativo",
    baseLegal: "NR 17",
    name: "Ergonomia para Ambientes Administrativos",
    hours: 4,
    type: "FORMAÇÃO",
    priceTier1_3: 697,
    priceTier4_6: 1207.3,
    priceTier7_10: 1755.73,
    priceAbove10: 132.47,
  },
  // NR 18 - Construção Civil
  {
    id: "nr18-construcao",
    baseLegal: "NR 18",
    name: "Segurança do Trabalho na Construção Civil",
    hours: 8,
    type: "FORMAÇÃO",
    priceTier1_3: 897,
    priceTier4_6: 1587.3,
    priceTier7_10: 2328.73,
    priceAbove10: 178.97,
  },
  {
    id: "nr18-grua",
    baseLegal: "NR 18",
    name: "Operador de Grua",
    hours: 16,
    type: "FORMAÇÃO",
    priceTier1_3: 1747,
    priceTier4_6: 3207.3,
    priceTier7_10: 4755.73,
    priceAbove10: 373.47,
  },
  {
    id: "nr18-guindaste",
    baseLegal: "NR 18",
    name: "Operador de Guindaste",
    hours: 16,
    type: "FORMAÇÃO",
    priceTier1_3: 1747,
    priceTier4_6: 3207.3,
    priceTier7_10: 4755.73,
    priceAbove10: 373.47,
  },
  {
    id: "nr18-guindar",
    baseLegal: "NR 18",
    name: "Operador de Equipamento de Guindar",
    hours: 16,
    type: "FORMAÇÃO",
    priceTier1_3: 1747,
    priceTier4_6: 3207.3,
    priceTier7_10: 4755.73,
    priceAbove10: 373.47,
  },
  {
    id: "nr18-sinaleiro",
    baseLegal: "NR 18",
    name: "Sinaleiro / Amarrador de Cargas",
    hours: 8,
    type: "FORMAÇÃO",
    priceTier1_3: 897,
    priceTier4_6: 1587.3,
    priceTier7_10: 2328.73,
    priceAbove10: 178.97,
  },
  {
    id: "nr18-elevador",
    baseLegal: "NR 18",
    name: "Operador de Elevador",
    hours: 8,
    type: "FORMAÇÃO",
    priceTier1_3: 897,
    priceTier4_6: 1587.3,
    priceTier7_10: 2328.73,
    priceAbove10: 178.97,
  },
  {
    id: "nr18-pemt",
    baseLegal: "NR 18",
    name: "Operador de PEMT (Plataforma Elevatória Móvel de Trabalho)",
    hours: 16,
    type: "FORMAÇÃO",
    priceTier1_3: 1547,
    priceTier4_6: 2827.3,
    priceTier7_10: 4182.07,
    priceAbove10: 325.63,
  },
  {
    id: "nr18-ar-comprimido",
    baseLegal: "NR 18",
    name: "Encarregado de Ar Comprimido",
    hours: 8,
    type: "FORMAÇÃO",
    priceTier1_3: 1197,
    priceTier4_6: 2157.3,
    priceTier7_10: 3178.73,
    priceAbove10: 246.47,
  },
  {
    id: "nr18-tubulao",
    baseLegal: "NR 18",
    name: "Resgate e Remoção em Atividades no Tubulão",
    hours: 8,
    type: "FORMAÇÃO",
    priceTier1_3: 1197,
    priceTier4_6: 2157.3,
    priceTier7_10: 3178.73,
    priceAbove10: 246.47,
  },
  {
    id: "nr18-cadeira-suspensa",
    baseLegal: "NR 18",
    name: "Utilização de Cadeira Suspensa",
    hours: 8,
    type: "FORMAÇÃO",
    priceTier1_3: 1197,
    priceTier4_6: 2157.3,
    priceTier7_10: 3178.73,
    priceAbove10: 246.47,
  },
  // NR 20 - Inflamáveis e Combustíveis
  {
    id: "nr20-inflamaveis",
    baseLegal: "NR 20",
    name: "Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis",
    hours: 16,
    type: "FORMAÇÃO",
    priceTier1_3: 1547,
    priceTier4_6: 2827.3,
    priceTier7_10: 4182.07,
    priceAbove10: 325.63,
  },
  // NR 23 - Incêndios
  {
    id: "nr23-incendios",
    baseLegal: "NR 23",
    name: "Prevenção Contra Incêndios",
    hours: 4,
    type: "FORMAÇÃO",
    priceTier1_3: 697,
    priceTier4_6: 1207.3,
    priceTier7_10: 1755.73,
    priceAbove10: 132.47,
  },
  // NR 26 - Sinalização
  {
    id: "nr26-sinalizacao",
    baseLegal: "NR 26",
    name: "Sinalizações de Segurança",
    hours: 4,
    type: "FORMAÇÃO",
    priceTier1_3: 597,
    priceTier4_6: 1017.3,
    priceTier7_10: 1465.73,
    priceAbove10: 108.47,
  },
  // NR 33 - Espaços Confinados
  {
    id: "nr33-trabalhador",
    baseLegal: "NR 33",
    name: "Segurança e Saúde nos Trabalhos em Espaços Confinados - Trabalhador",
    hours: 16,
    type: "FORMAÇÃO",
    priceTier1_3: 1647,
    priceTier4_6: 3017.3,
    priceTier7_10: 4465.73,
    priceAbove10: 349.47,
  },
  {
    id: "nr33-vigia-supervisor",
    baseLegal: "NR 33",
    name: "Segurança e Saúde nos Trabalhos em Espaços Confinados - Vigia/Supervisor",
    hours: 40,
    type: "FORMAÇÃO",
    priceTier1_3: 3697,
    priceTier4_6: 6907.3,
    priceTier7_10: 10352.07,
    priceAbove10: 831.63,
  },
  // NR 35 - Trabalho em Altura
  {
    id: "nr35-altura",
    baseLegal: "NR 35",
    name: "Trabalho em Altura",
    hours: 8,
    type: "FORMAÇÃO",
    priceTier1_3: 1097,
    priceTier4_6: 1967.3,
    priceTier7_10: 2893.73,
    priceAbove10: 223.47,
  },
  // Outros Treinamentos
  {
    id: "pae",
    baseLegal: "PAE",
    name: "Plano de Atendimento à Emergências",
    hours: 4,
    type: "FORMAÇÃO",
    priceTier1_3: 797,
    priceTier4_6: 1397.3,
    priceTier7_10: 2035.73,
    priceAbove10: 153.97,
  },
  {
    id: "brigada-incendio",
    baseLegal: "Brigada",
    name: "Brigada de Incêndio",
    hours: 16,
    type: "FORMAÇÃO",
    priceTier1_3: 1747,
    priceTier4_6: 3207.3,
    priceTier7_10: 4755.73,
    priceAbove10: 373.47,
  },
  {
    id: "primeiros-socorros",
    baseLegal: "Lei Lucas",
    name: "Primeiros Socorros - Lei Lucas",
    hours: 8,
    type: "FORMAÇÃO",
    priceTier1_3: 997,
    priceTier4_6: 1777.3,
    priceTier7_10: 2608.73,
    priceAbove10: 200.47,
  },
];

export function TrainingsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTraining, setSelectedTraining] = useState<typeof TRAININGS[0] | null>(null);
  const [participants, setParticipants] = useState(5);

  const filteredTrainings = TRAININGS.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.baseLegal.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculatePrice = (training: typeof TRAININGS[0], numParticipants: number) => {
    if (numParticipants <= 3) return training.priceTier1_3;
    if (numParticipants <= 6) return training.priceTier4_6;
    if (numParticipants <= 10) return training.priceTier7_10;
    return training.priceTier7_10 + (numParticipants - 10) * training.priceAbove10;
  };

  const getTypeColor = (type: string) => {
    if (type.includes("FORMAÇÃO")) return "bg-primary/10 text-primary";
    if (type.includes("RECICLAGEM")) return "bg-warning/10 text-warning";
    return "bg-info/10 text-info";
  };

  return (
    <div className="space-y-6">
      {/* Busca */}
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Catálogo de Treinamentos
          </CardTitle>
          <CardDescription>
            Selecione um treinamento para simular valores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou NR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Treinamentos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTrainings.map((training, index) => (
          <Card
            key={training.id}
            className="animate-fade-in cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <Badge variant="outline" className="mb-2">
                  {training.baseLegal}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {training.hours}h
                </div>
              </div>
              <CardTitle className="text-base leading-tight">{training.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={cn("mb-3", getTypeColor(training.type))}>
                {training.type}
              </Badge>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">1-3 pessoas:</span>
                  <span className="font-medium">{formatCurrency(training.priceTier1_3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">4-6 pessoas:</span>
                  <span className="font-medium">{formatCurrency(training.priceTier4_6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">7-10 pessoas:</span>
                  <span className="font-medium">{formatCurrency(training.priceTier7_10)}</span>
                </div>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => setSelectedTraining(training)}
                  >
                    <Calculator className="mr-2 h-4 w-4" />
                    Simular Valor
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{training.name}</DialogTitle>
                    <DialogDescription>
                      {training.baseLegal} - {training.hours} horas
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Quantidade de Participantes</Label>
                      <Input
                        type="number"
                        min={1}
                        value={participants}
                        onChange={(e) => setParticipants(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          <span>{participants} participante(s)</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Valor Total</p>
                          <p className="text-2xl font-bold text-primary">
                            {formatCurrency(calculatePrice(training, participants))}
                          </p>
                        </div>
                      </div>
                      {participants > 10 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Base: {formatCurrency(training.priceTier7_10)} + {participants - 10}x{" "}
                          {formatCurrency(training.priceAbove10)}
                        </p>
                      )}
                    </div>
                    <Button className="w-full">Gerar Proposta</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
