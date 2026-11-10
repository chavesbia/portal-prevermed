import type { ComponentType } from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome.tsx'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
import { template as agendaProtocoloAberto } from './agenda-protocolo-aberto.tsx'
import { template as agendaConfirmado } from './agenda-confirmado.tsx'
import { template as agendaEstruturaEngenharia } from './agenda-estrutura-engenharia.tsx'
import { template as agendaRetornoSaude } from './agenda-retorno-saude.tsx'
import { template as agendaDevolvido } from './agenda-devolvido.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'agenda-protocolo-aberto': agendaProtocoloAberto,
  'agenda-confirmado': agendaConfirmado,
  'agenda-estrutura-engenharia': agendaEstruturaEngenharia,
  'agenda-retorno-saude': agendaRetornoSaude,
  'agenda-devolvido': agendaDevolvido,
  // Add templates here as they are created, e.g.:
  // 'welcome': welcomeTemplate,
}
