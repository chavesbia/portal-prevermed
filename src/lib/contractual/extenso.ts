// Conversão de números/valores/datas para extenso em PT-BR.

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function trioPorExtenso(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (d === 1) {
    partes.push(DEZ_A_DEZENOVE[u]);
  } else {
    if (d > 0) partes.push(DEZENAS[d]);
    if (u > 0) partes.push(UNIDADES[u]);
  }
  return partes.join(' e ');
}

export function numeroPorExtenso(num: number): string {
  if (num == null || isNaN(num)) return '';
  if (num === 0) return 'zero';
  if (num < 0) return 'menos ' + numeroPorExtenso(-num);

  const bilhoes = Math.floor(num / 1_000_000_000);
  const milhoes = Math.floor((num % 1_000_000_000) / 1_000_000);
  const milhares = Math.floor((num % 1_000_000) / 1000);
  const resto = num % 1000;

  const partes: string[] = [];
  if (bilhoes > 0) partes.push(trioPorExtenso(bilhoes) + (bilhoes === 1 ? ' bilhão' : ' bilhões'));
  if (milhoes > 0) partes.push(trioPorExtenso(milhoes) + (milhoes === 1 ? ' milhão' : ' milhões'));
  if (milhares > 0) {
    partes.push(milhares === 1 ? 'mil' : trioPorExtenso(milhares) + ' mil');
  }
  if (resto > 0) partes.push(trioPorExtenso(resto));

  // Junção com "e" quando o último bloco for < 100 ou múltiplo de 100
  let texto = '';
  for (let i = 0; i < partes.length; i++) {
    if (i === 0) texto = partes[i];
    else {
      const ultimo = i === partes.length - 1;
      texto += (ultimo && (resto < 100 || resto % 100 === 0) ? ' e ' : ', ') + partes[i];
    }
  }
  return texto.trim();
}

export function moedaPorExtenso(valor: number): string {
  if (valor == null || isNaN(valor)) return '';
  const arredondado = Math.round(valor * 100) / 100;
  const reais = Math.floor(arredondado);
  const centavos = Math.round((arredondado - reais) * 100);

  const partes: string[] = [];
  if (reais > 0) {
    partes.push(numeroPorExtenso(reais) + ' ' + (reais === 1 ? 'real' : 'reais'));
  }
  if (centavos > 0) {
    if (partes.length) partes.push('e');
    partes.push(numeroPorExtenso(centavos) + ' ' + (centavos === 1 ? 'centavo' : 'centavos'));
  }
  if (!partes.length) return 'zero real';
  return partes.join(' ');
}

export function dataPorExtenso(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string'
    ? new Date(d + (d.length === 10 ? 'T00:00:00' : ''))
    : d;
  if (isNaN(date.getTime())) return '';
  const dia = date.getDate();
  const mes = MESES[date.getMonth()];
  const ano = date.getFullYear();
  return `${dia} de ${mes} de ${ano}`;
}
