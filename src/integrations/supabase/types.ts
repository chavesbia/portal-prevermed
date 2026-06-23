export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          department_id: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          is_pinned: boolean | null
          is_public: boolean | null
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_pinned?: boolean | null
          is_public?: boolean | null
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_pinned?: boolean | null
          is_public?: boolean | null
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_atendimentos: {
        Row: {
          agenda: string | null
          aso_assinado: boolean | null
          assinatura_entrada_em: string | null
          assinatura_saida_em: string | null
          base_socnet: boolean | null
          cargo: string | null
          carimbo_assinatura_ok: boolean | null
          conferencia_final_ok: boolean | null
          cpf: string | null
          created_at: string
          data_assinatura: string | null
          data_atendimento: string
          detalhes: string | null
          documentacao_ok: boolean | null
          email_enviado: boolean | null
          empresa: string | null
          escaneado: boolean | null
          exames_entrada_em: string | null
          exames_saida_em: string | null
          exames_texto: string | null
          faturamento_entrada_em: string | null
          faturamento_saida_em: string | null
          fechamento_lote_id: string | null
          ficha_clinica_ok: boolean | null
          finalizado_em: string | null
          funcionario: string | null
          hora_inicial: string | null
          id: string
          id_interno: string
          importado_entrada_em: string | null
          importado_saida_em: string | null
          liberacao_entrada_em: string | null
          liberacao_saida_em: string | null
          lote_id: string
          medico: string | null
          observacoes_assinatura: string | null
          observacoes_escaneamento: string | null
          observacoes_exames: string | null
          observacoes_faturamento: string | null
          observacoes_recepcao: string | null
          possui_exame_complementar: boolean | null
          processo_iniciado_em: string | null
          prontuario_conferido: boolean | null
          recepcao_entrada_em: string | null
          recepcao_saida_em: string | null
          renomeado: boolean | null
          riscos: string | null
          salvo_rede: boolean | null
          salvo_socged: boolean | null
          setor: string | null
          setor_responsavel: string | null
          signing_doctor_id: string | null
          status: Database["public"]["Enums"]["aso_status"]
          tipo_assinatura:
            | Database["public"]["Enums"]["aso_tipo_assinatura"]
            | null
          tipo_compromisso: string | null
          tipo_prontuario:
            | Database["public"]["Enums"]["aso_tipo_prontuario"]
            | null
          unidade: string | null
          updated_at: string
          updated_by: string | null
          usuario_soc: string | null
          vias_aso_ok: boolean | null
        }
        Insert: {
          agenda?: string | null
          aso_assinado?: boolean | null
          assinatura_entrada_em?: string | null
          assinatura_saida_em?: string | null
          base_socnet?: boolean | null
          cargo?: string | null
          carimbo_assinatura_ok?: boolean | null
          conferencia_final_ok?: boolean | null
          cpf?: string | null
          created_at?: string
          data_assinatura?: string | null
          data_atendimento: string
          detalhes?: string | null
          documentacao_ok?: boolean | null
          email_enviado?: boolean | null
          empresa?: string | null
          escaneado?: boolean | null
          exames_entrada_em?: string | null
          exames_saida_em?: string | null
          exames_texto?: string | null
          faturamento_entrada_em?: string | null
          faturamento_saida_em?: string | null
          fechamento_lote_id?: string | null
          ficha_clinica_ok?: boolean | null
          finalizado_em?: string | null
          funcionario?: string | null
          hora_inicial?: string | null
          id?: string
          id_interno: string
          importado_entrada_em?: string | null
          importado_saida_em?: string | null
          liberacao_entrada_em?: string | null
          liberacao_saida_em?: string | null
          lote_id: string
          medico?: string | null
          observacoes_assinatura?: string | null
          observacoes_escaneamento?: string | null
          observacoes_exames?: string | null
          observacoes_faturamento?: string | null
          observacoes_recepcao?: string | null
          possui_exame_complementar?: boolean | null
          processo_iniciado_em?: string | null
          prontuario_conferido?: boolean | null
          recepcao_entrada_em?: string | null
          recepcao_saida_em?: string | null
          renomeado?: boolean | null
          riscos?: string | null
          salvo_rede?: boolean | null
          salvo_socged?: boolean | null
          setor?: string | null
          setor_responsavel?: string | null
          signing_doctor_id?: string | null
          status?: Database["public"]["Enums"]["aso_status"]
          tipo_assinatura?:
            | Database["public"]["Enums"]["aso_tipo_assinatura"]
            | null
          tipo_compromisso?: string | null
          tipo_prontuario?:
            | Database["public"]["Enums"]["aso_tipo_prontuario"]
            | null
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
          usuario_soc?: string | null
          vias_aso_ok?: boolean | null
        }
        Update: {
          agenda?: string | null
          aso_assinado?: boolean | null
          assinatura_entrada_em?: string | null
          assinatura_saida_em?: string | null
          base_socnet?: boolean | null
          cargo?: string | null
          carimbo_assinatura_ok?: boolean | null
          conferencia_final_ok?: boolean | null
          cpf?: string | null
          created_at?: string
          data_assinatura?: string | null
          data_atendimento?: string
          detalhes?: string | null
          documentacao_ok?: boolean | null
          email_enviado?: boolean | null
          empresa?: string | null
          escaneado?: boolean | null
          exames_entrada_em?: string | null
          exames_saida_em?: string | null
          exames_texto?: string | null
          faturamento_entrada_em?: string | null
          faturamento_saida_em?: string | null
          fechamento_lote_id?: string | null
          ficha_clinica_ok?: boolean | null
          finalizado_em?: string | null
          funcionario?: string | null
          hora_inicial?: string | null
          id?: string
          id_interno?: string
          importado_entrada_em?: string | null
          importado_saida_em?: string | null
          liberacao_entrada_em?: string | null
          liberacao_saida_em?: string | null
          lote_id?: string
          medico?: string | null
          observacoes_assinatura?: string | null
          observacoes_escaneamento?: string | null
          observacoes_exames?: string | null
          observacoes_faturamento?: string | null
          observacoes_recepcao?: string | null
          possui_exame_complementar?: boolean | null
          processo_iniciado_em?: string | null
          prontuario_conferido?: boolean | null
          recepcao_entrada_em?: string | null
          recepcao_saida_em?: string | null
          renomeado?: boolean | null
          riscos?: string | null
          salvo_rede?: boolean | null
          salvo_socged?: boolean | null
          setor?: string | null
          setor_responsavel?: string | null
          signing_doctor_id?: string | null
          status?: Database["public"]["Enums"]["aso_status"]
          tipo_assinatura?:
            | Database["public"]["Enums"]["aso_tipo_assinatura"]
            | null
          tipo_compromisso?: string | null
          tipo_prontuario?:
            | Database["public"]["Enums"]["aso_tipo_prontuario"]
            | null
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
          usuario_soc?: string | null
          vias_aso_ok?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "aso_atendimentos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "aso_lotes_importacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aso_atendimentos_signing_doctor_id_fkey"
            columns: ["signing_doctor_id"]
            isOneToOne: false
            referencedRelation: "aso_signing_doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_exames_atendimento: {
        Row: {
          atendimento_id: string
          colaborador_chamado: boolean
          colaborador_chamado_em: string | null
          colaborador_chamado_por: string | null
          created_at: string
          data_conclusao: string | null
          data_datado_soc: string | null
          data_inserido_socged: string | null
          data_recebimento: string | null
          id: string
          motivo_nova_coleta: string | null
          motivo_pendencia: string | null
          nome_exame: string
          nova_coleta_canal_contato: string | null
          nova_coleta_contato_rh: string | null
          nova_coleta_data_convocacao: string | null
          nova_coleta_data_prevista_retorno: string | null
          nova_coleta_data_retorno_efetivo: string | null
          nova_coleta_observacoes_convocacao: string | null
          observacao: string | null
          status: Database["public"]["Enums"]["aso_exame_status"]
          tipo: Database["public"]["Enums"]["aso_exame_tipo"]
          updated_at: string
        }
        Insert: {
          atendimento_id: string
          colaborador_chamado?: boolean
          colaborador_chamado_em?: string | null
          colaborador_chamado_por?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_datado_soc?: string | null
          data_inserido_socged?: string | null
          data_recebimento?: string | null
          id?: string
          motivo_nova_coleta?: string | null
          motivo_pendencia?: string | null
          nome_exame: string
          nova_coleta_canal_contato?: string | null
          nova_coleta_contato_rh?: string | null
          nova_coleta_data_convocacao?: string | null
          nova_coleta_data_prevista_retorno?: string | null
          nova_coleta_data_retorno_efetivo?: string | null
          nova_coleta_observacoes_convocacao?: string | null
          observacao?: string | null
          status?: Database["public"]["Enums"]["aso_exame_status"]
          tipo?: Database["public"]["Enums"]["aso_exame_tipo"]
          updated_at?: string
        }
        Update: {
          atendimento_id?: string
          colaborador_chamado?: boolean
          colaborador_chamado_em?: string | null
          colaborador_chamado_por?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_datado_soc?: string | null
          data_inserido_socged?: string | null
          data_recebimento?: string | null
          id?: string
          motivo_nova_coleta?: string | null
          motivo_pendencia?: string | null
          nome_exame?: string
          nova_coleta_canal_contato?: string | null
          nova_coleta_contato_rh?: string | null
          nova_coleta_data_convocacao?: string | null
          nova_coleta_data_prevista_retorno?: string | null
          nova_coleta_data_retorno_efetivo?: string | null
          nova_coleta_observacoes_convocacao?: string | null
          observacao?: string | null
          status?: Database["public"]["Enums"]["aso_exame_status"]
          tipo?: Database["public"]["Enums"]["aso_exame_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aso_exames_atendimento_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "aso_atendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_fechamento_itens: {
        Row: {
          atendimento_id: string
          cargo: string | null
          cpf: string | null
          created_at: string
          data_atendimento: string | null
          empresa: string | null
          funcionario: string | null
          id: string
          lote_id: string
          setor: string | null
          tipo_prontuario: string | null
          unidade: string | null
        }
        Insert: {
          atendimento_id: string
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_atendimento?: string | null
          empresa?: string | null
          funcionario?: string | null
          id?: string
          lote_id: string
          setor?: string | null
          tipo_prontuario?: string | null
          unidade?: string | null
        }
        Update: {
          atendimento_id?: string
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_atendimento?: string | null
          empresa?: string | null
          funcionario?: string | null
          id?: string
          lote_id?: string
          setor?: string | null
          tipo_prontuario?: string | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aso_fechamento_itens_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "aso_fechamento_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_fechamento_lotes: {
        Row: {
          created_at: string
          fechado_em: string
          fechado_por: string
          fechado_por_nome: string | null
          filtro_tipo_prontuario: string
          id: string
          numero_lote: string
          observacoes: string | null
          periodo_final: string
          periodo_inicial: string
          total_prontuarios: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fechado_em?: string
          fechado_por: string
          fechado_por_nome?: string | null
          filtro_tipo_prontuario?: string
          id?: string
          numero_lote: string
          observacoes?: string | null
          periodo_final: string
          periodo_inicial: string
          total_prontuarios?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fechado_em?: string
          fechado_por?: string
          fechado_por_nome?: string | null
          filtro_tipo_prontuario?: string
          id?: string
          numero_lote?: string
          observacoes?: string | null
          periodo_final?: string
          periodo_inicial?: string
          total_prontuarios?: number
          updated_at?: string
        }
        Relationships: []
      }
      aso_historico: {
        Row: {
          acao: string
          atendimento_id: string
          campo: string | null
          created_at: string
          id: string
          observacao: string | null
          user_id: string | null
          user_name: string | null
          valor_antigo: string | null
          valor_novo: string | null
        }
        Insert: {
          acao: string
          atendimento_id: string
          campo?: string | null
          created_at?: string
          id?: string
          observacao?: string | null
          user_id?: string | null
          user_name?: string | null
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Update: {
          acao?: string
          atendimento_id?: string
          campo?: string | null
          created_at?: string
          id?: string
          observacao?: string | null
          user_id?: string | null
          user_name?: string | null
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aso_historico_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "aso_atendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_lotes_importacao: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          created_at: string
          id: string
          importado_em: string
          importado_por: string
          importado_por_nome: string | null
          total_registros: number
          unidade: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          created_at?: string
          id?: string
          importado_em?: string
          importado_por: string
          importado_por_nome?: string | null
          total_registros?: number
          unidade: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          created_at?: string
          id?: string
          importado_em?: string
          importado_por?: string
          importado_por_nome?: string | null
          total_registros?: number
          unidade?: string
        }
        Relationships: []
      }
      aso_retificacao_anexos: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          solicitacao_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          solicitacao_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          solicitacao_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "aso_retificacao_anexos_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "aso_retificacao_solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_retificacao_areas: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      aso_retificacao_medicos_examinadores: {
        Row: {
          created_at: string
          created_by: string | null
          crm: string | null
          id: string
          is_active: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crm?: string | null
          id?: string
          is_active?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crm?: string | null
          id?: string
          is_active?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      aso_retificacao_motivos: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      aso_retificacao_solicitacoes: {
        Row: {
          area_id: string | null
          cnpj: string
          colaborador_cpf: string
          colaborador_nome: string
          created_at: string
          created_by: string
          created_by_name: string | null
          data_retificacao: string | null
          data_solicitacao: string
          descricao: string
          empresa: string
          id: string
          medico_examinador_id: string | null
          motivo_id: string | null
          observacoes: string | null
          responsavel_retificacao_id: string | null
          unidade: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_id?: string | null
          cnpj: string
          colaborador_cpf: string
          colaborador_nome: string
          created_at?: string
          created_by: string
          created_by_name?: string | null
          data_retificacao?: string | null
          data_solicitacao?: string
          descricao: string
          empresa: string
          id?: string
          medico_examinador_id?: string | null
          motivo_id?: string | null
          observacoes?: string | null
          responsavel_retificacao_id?: string | null
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_id?: string | null
          cnpj?: string
          colaborador_cpf?: string
          colaborador_nome?: string
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          data_retificacao?: string | null
          data_solicitacao?: string
          descricao?: string
          empresa?: string
          id?: string
          medico_examinador_id?: string | null
          motivo_id?: string | null
          observacoes?: string | null
          responsavel_retificacao_id?: string | null
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aso_retificacao_solicitacoes_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "aso_retificacao_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aso_retificacao_solicitacoes_medico_examinador_id_fkey"
            columns: ["medico_examinador_id"]
            isOneToOne: false
            referencedRelation: "aso_retificacao_medicos_examinadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aso_retificacao_solicitacoes_motivo_id_fkey"
            columns: ["motivo_id"]
            isOneToOne: false
            referencedRelation: "aso_retificacao_motivos"
            referencedColumns: ["id"]
          },
        ]
      }
      aso_signing_doctors: {
        Row: {
          created_at: string
          created_by: string | null
          crm: string
          crm_uf: string | null
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crm: string
          crm_uf?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crm?: string
          crm_uf?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action_type: string
          comment: string | null
          created_at: string
          department_id: string | null
          details: Json | null
          id: string
          object_id: string | null
          object_type: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          comment?: string | null
          created_at?: string
          department_id?: string | null
          details?: Json | null
          id?: string
          object_id?: string | null
          object_type: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          comment?: string | null
          created_at?: string
          department_id?: string | null
          details?: Json | null
          id?: string
          object_id?: string | null
          object_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          attachment_url: string | null
          color: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          end_date: string | null
          event_date: string
          event_type: string
          id: string
          is_all_day: boolean | null
          location: string | null
          time_end: string | null
          time_start: string | null
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          event_date: string
          event_type?: string
          id?: string
          is_all_day?: boolean | null
          location?: string | null
          time_end?: string | null
          time_start?: string | null
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          event_date?: string
          event_type?: string
          id?: string
          is_all_day?: boolean | null
          location?: string | null
          time_end?: string | null
          time_start?: string | null
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_service_packages: {
        Row: {
          created_at: string
          id: string
          item_type: string
          package_id: string
          quantity: number
          service_id: string
          unit_value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_type?: string
          package_id: string
          quantity?: number
          service_id: string
          unit_value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          package_id?: string
          quantity?: number
          service_id?: string
          unit_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_service_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "catalog_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_service_packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "catalog_services"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_services: {
        Row: {
          area: string
          category: string
          created_at: string
          created_by: string | null
          delivery_days: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_eligible: boolean
          reference_value: number | null
          service_type: string
          updated_at: string
          validity_months: number | null
        }
        Insert: {
          area: string
          category: string
          created_at?: string
          created_by?: string | null
          delivery_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_eligible?: boolean
          reference_value?: number | null
          service_type: string
          updated_at?: string
          validity_months?: number | null
        }
        Update: {
          area?: string
          category?: string
          created_at?: string
          created_by?: string | null
          delivery_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_eligible?: boolean
          reference_value?: number | null
          service_type?: string
          updated_at?: string
          validity_months?: number | null
        }
        Relationships: []
      }
      client_attachments: {
        Row: {
          client_id: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          file_name: string | null
          file_url: string
          id: string
          type: string
        }
        Insert: {
          client_id: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_url: string
          id?: string
          type: string
        }
        Update: {
          client_id?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_url?: string
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_attachments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "commercial_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_attachments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "commercial_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_client_service_modules: {
        Row: {
          client_id: string
          component_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          package_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          component_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          package_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          component_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          package_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_client_service_modules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "commercial_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_client_service_modules_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "commercial_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_client_service_modules_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "commercial_services"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_client_services: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          service_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          service_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_client_services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "commercial_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_client_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "commercial_services"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_clients: {
        Row: {
          active_lives: number | null
          approval_date: string | null
          city: string | null
          cnpj: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_whatsapp: string | null
          contract_end_date: string | null
          contract_notes: string | null
          contract_number: string | null
          contract_signed: boolean | null
          contract_start_date: string | null
          created_at: string
          created_by: string | null
          has_contract: boolean | null
          id: string
          is_active: boolean | null
          legal_name: string | null
          notes: string | null
          pricing_table_attached: boolean | null
          proposal_approved: boolean | null
          proposal_number: string | null
          revisado: boolean
          revisado_em: string | null
          revisado_por: string | null
          risk_grade: string
          services_summary: string | null
          soc_code: string | null
          state: string | null
          subgroup: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_lives?: number | null
          approval_date?: string | null
          city?: string | null
          cnpj?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          contract_end_date?: string | null
          contract_notes?: string | null
          contract_number?: string | null
          contract_signed?: boolean | null
          contract_start_date?: string | null
          created_at?: string
          created_by?: string | null
          has_contract?: boolean | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          notes?: string | null
          pricing_table_attached?: boolean | null
          proposal_approved?: boolean | null
          proposal_number?: string | null
          revisado?: boolean
          revisado_em?: string | null
          revisado_por?: string | null
          risk_grade: string
          services_summary?: string | null
          soc_code?: string | null
          state?: string | null
          subgroup: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_lives?: number | null
          approval_date?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          contract_end_date?: string | null
          contract_notes?: string | null
          contract_number?: string | null
          contract_signed?: boolean | null
          contract_start_date?: string | null
          created_at?: string
          created_by?: string | null
          has_contract?: boolean | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          notes?: string | null
          pricing_table_attached?: boolean | null
          proposal_approved?: boolean | null
          proposal_number?: string | null
          revisado?: boolean
          revisado_em?: string | null
          revisado_por?: string | null
          risk_grade?: string
          services_summary?: string | null
          soc_code?: string | null
          state?: string | null
          subgroup?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      commercial_contracts: {
        Row: {
          auto_renewal: boolean
          client_id: string
          contract_number: string | null
          contract_year: number | null
          created_at: string
          created_by: string | null
          end_date: string | null
          has_exam_table: boolean
          has_service_table: boolean
          id: string
          is_current: boolean
          modelo_contratual:
            | Database["public"]["Enums"]["modelo_contratual"]
            | null
          notes: string | null
          proposal_number: string | null
          prospect_status: string | null
          renewal_term_months: number | null
          revisao_pendente: boolean
          signed: boolean
          start_date: string | null
          status_derivado: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_renewal?: boolean
          client_id: string
          contract_number?: string | null
          contract_year?: number | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          has_exam_table?: boolean
          has_service_table?: boolean
          id?: string
          is_current?: boolean
          modelo_contratual?:
            | Database["public"]["Enums"]["modelo_contratual"]
            | null
          notes?: string | null
          proposal_number?: string | null
          prospect_status?: string | null
          renewal_term_months?: number | null
          revisao_pendente?: boolean
          signed?: boolean
          start_date?: string | null
          status_derivado?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_renewal?: boolean
          client_id?: string
          contract_number?: string | null
          contract_year?: number | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          has_exam_table?: boolean
          has_service_table?: boolean
          id?: string
          is_current?: boolean
          modelo_contratual?:
            | Database["public"]["Enums"]["modelo_contratual"]
            | null
          notes?: string | null
          proposal_number?: string | null
          prospect_status?: string | null
          renewal_term_months?: number | null
          revisao_pendente?: boolean
          signed?: boolean
          start_date?: string | null
          status_derivado?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "commercial_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_service_components: {
        Row: {
          component_id: string
          created_at: string
          created_by: string | null
          id: string
          package_id: string
        }
        Insert: {
          component_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          package_id: string
        }
        Update: {
          component_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_service_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "commercial_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_service_components_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "commercial_services"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_services: {
        Row: {
          category: string | null
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_package: boolean
          name: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_package?: boolean
          name: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_package?: boolean
          name?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracao_alertas: {
        Row: {
          ativo: boolean
          created_at: string
          dias_antecedencia: number[]
          id: string
          tipo_laudo_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dias_antecedencia?: number[]
          id?: string
          tipo_laudo_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dias_antecedencia?: number[]
          id?: string
          tipo_laudo_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracao_alertas_tipo_laudo_id_fkey"
            columns: ["tipo_laudo_id"]
            isOneToOne: false
            referencedRelation: "tipos_laudo"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_assinaturas: {
        Row: {
          autentique_signer_id: string | null
          contrato_id: string
          cpf: string | null
          created_at: string
          data_assinatura: string | null
          email: string | null
          id: string
          ip_assinatura: string | null
          nome: string
          status: Database["public"]["Enums"]["contract_signer_status"]
          tipo: Database["public"]["Enums"]["contract_signer_type"]
          updated_at: string
        }
        Insert: {
          autentique_signer_id?: string | null
          contrato_id: string
          cpf?: string | null
          created_at?: string
          data_assinatura?: string | null
          email?: string | null
          id?: string
          ip_assinatura?: string | null
          nome: string
          status?: Database["public"]["Enums"]["contract_signer_status"]
          tipo: Database["public"]["Enums"]["contract_signer_type"]
          updated_at?: string
        }
        Update: {
          autentique_signer_id?: string | null
          contrato_id?: string
          cpf?: string | null
          created_at?: string
          data_assinatura?: string | null
          email?: string | null
          id?: string
          ip_assinatura?: string | null
          nome?: string
          status?: Database["public"]["Enums"]["contract_signer_status"]
          tipo?: Database["public"]["Enums"]["contract_signer_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_assinaturas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contract_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_clientes: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnae_principal: string | null
          cnpj: string
          complemento: string | null
          cpf_representante: string | null
          created_at: string
          created_by: string | null
          email: string | null
          estado: string | null
          id: string
          logradouro: string | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          razao_social: string
          representante_legal: string | null
          situacao_cadastral: string | null
          telefone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnae_principal?: string | null
          cnpj: string
          complemento?: string | null
          cpf_representante?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          razao_social: string
          representante_legal?: string | null
          situacao_cadastral?: string | null
          telefone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnae_principal?: string | null
          cnpj?: string
          complemento?: string | null
          cpf_representante?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          razao_social?: string
          representante_legal?: string | null
          situacao_cadastral?: string | null
          telefone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      contract_contratos: {
        Row: {
          autentique_document_id: string | null
          cliente_id: string
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          dia_cobranca: number | null
          html_final: string | null
          id: string
          indice_reajuste: string | null
          juros: number | null
          multa: number | null
          numero_contrato: string | null
          numero_proposta: string | null
          observacoes: string | null
          pdf_url: string | null
          prazo_aviso: number | null
          qtd_vidas: number | null
          rep_cpf: string | null
          rep_nome: string | null
          status: Database["public"]["Enums"]["contract_status"]
          template_id: string | null
          template_version_id: string | null
          testemunha1_cpf: string | null
          testemunha1_nome: string | null
          testemunha2_cpf: string | null
          testemunha2_nome: string | null
          updated_at: string
          updated_by: string | null
          valor_excedente: number | null
          valor_km: number | null
          valor_mensal: number | null
          vigencia_meses: number
        }
        Insert: {
          autentique_document_id?: string | null
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio: string
          dia_cobranca?: number | null
          html_final?: string | null
          id?: string
          indice_reajuste?: string | null
          juros?: number | null
          multa?: number | null
          numero_contrato?: string | null
          numero_proposta?: string | null
          observacoes?: string | null
          pdf_url?: string | null
          prazo_aviso?: number | null
          qtd_vidas?: number | null
          rep_cpf?: string | null
          rep_nome?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          template_version_id?: string | null
          testemunha1_cpf?: string | null
          testemunha1_nome?: string | null
          testemunha2_cpf?: string | null
          testemunha2_nome?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_excedente?: number | null
          valor_km?: number | null
          valor_mensal?: number | null
          vigencia_meses?: number
        }
        Update: {
          autentique_document_id?: string | null
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          dia_cobranca?: number | null
          html_final?: string | null
          id?: string
          indice_reajuste?: string | null
          juros?: number | null
          multa?: number | null
          numero_contrato?: string | null
          numero_proposta?: string | null
          observacoes?: string | null
          pdf_url?: string | null
          prazo_aviso?: number | null
          qtd_vidas?: number | null
          rep_cpf?: string | null
          rep_nome?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          template_version_id?: string | null
          testemunha1_cpf?: string | null
          testemunha1_nome?: string | null
          testemunha2_cpf?: string | null
          testemunha2_nome?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_excedente?: number | null
          valor_km?: number | null
          valor_mensal?: number | null
          vigencia_meses?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "contract_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_contratos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_contratos_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "contract_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_eventos: {
        Row: {
          contrato_id: string
          created_at: string
          descricao: string | null
          detalhes: Json | null
          id: string
          performed_by: string | null
          tipo: string
        }
        Insert: {
          contrato_id: string
          created_at?: string
          descricao?: string | null
          detalhes?: Json | null
          id?: string
          performed_by?: string | null
          tipo: string
        }
        Update: {
          contrato_id?: string
          created_at?: string
          descricao?: string | null
          detalhes?: Json | null
          id?: string
          performed_by?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_eventos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contract_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_placeholders: {
        Row: {
          ativo: boolean
          chave: string
          created_at: string
          created_by: string | null
          descricao: string | null
          grupo: string
          id: string
          label: string
          ordem: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          chave: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          grupo?: string
          id?: string
          label: string
          ordem?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          chave?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          grupo?: string
          id?: string
          label?: string
          ordem?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      contract_template_versions: {
        Row: {
          changelog: string | null
          conteudo_html: string
          created_at: string
          created_by: string | null
          id: string
          template_id: string
          versao: number
        }
        Insert: {
          changelog?: string | null
          conteudo_html: string
          created_at?: string
          created_by?: string | null
          id?: string
          template_id: string
          versao: number
        }
        Update: {
          changelog?: string | null
          conteudo_html?: string
          created_at?: string
          created_by?: string | null
          id?: string
          template_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["contract_categoria"]
          created_at: string
          created_by: string | null
          current_version_id: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string
          updated_by: string | null
          versao_atual: number
        }
        Insert: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["contract_categoria"]
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
          updated_by?: string | null
          versao_atual?: number
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["contract_categoria"]
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
          updated_by?: string | null
          versao_atual?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "contract_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          module_id: string | null
          name: string
          route: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          module_id?: string | null
          name: string
          route?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          module_id?: string | null
          name?: string
          route?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboards_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      department_modules: {
        Row: {
          created_at: string
          department_id: string
          id: string
          module_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          module_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_modules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_departments: {
        Row: {
          created_at: string
          department_id: string
          document_id: string
          id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          document_id: string
          id?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_departments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_users: {
        Row: {
          created_at: string
          document_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_users_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          folder: string | null
          id: string
          is_public: boolean | null
          name: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          folder?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          folder?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_avaliacao_notas: {
        Row: {
          avaliacao_id: string
          comentario: string | null
          competencia_id: string
          created_at: string
          id: string
          nota: number
        }
        Insert: {
          avaliacao_id: string
          comentario?: string | null
          competencia_id: string
          created_at?: string
          id?: string
          nota: number
        }
        Update: {
          avaliacao_id?: string
          comentario?: string | null
          competencia_id?: string
          created_at?: string
          id?: string
          nota?: number
        }
        Relationships: [
          {
            foreignKeyName: "fb_avaliacao_notas_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "fb_avaliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_avaliacao_notas_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "fb_v_status_colaborador"
            referencedColumns: ["ultima_avaliacao_id"]
          },
          {
            foreignKeyName: "fb_avaliacao_notas_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "fb_competencias"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_avaliacoes: {
        Row: {
          acoes_melhoria: string | null
          atividades: string | null
          classificacao: Database["public"]["Enums"]["fb_classificacao"] | null
          colaborador_id: string
          concluida: boolean
          created_at: string
          created_by: string | null
          data_avaliacao: string
          data_proximo_feedback: string | null
          gestor_id: string | null
          id: string
          observacoes: string | null
          pontos_melhora: string | null
          pontos_positivos: string | null
          pontuacao_total: number | null
          updated_at: string
        }
        Insert: {
          acoes_melhoria?: string | null
          atividades?: string | null
          classificacao?: Database["public"]["Enums"]["fb_classificacao"] | null
          colaborador_id: string
          concluida?: boolean
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string
          data_proximo_feedback?: string | null
          gestor_id?: string | null
          id?: string
          observacoes?: string | null
          pontos_melhora?: string | null
          pontos_positivos?: string | null
          pontuacao_total?: number | null
          updated_at?: string
        }
        Update: {
          acoes_melhoria?: string | null
          atividades?: string | null
          classificacao?: Database["public"]["Enums"]["fb_classificacao"] | null
          colaborador_id?: string
          concluida?: boolean
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string
          data_proximo_feedback?: string | null
          gestor_id?: string | null
          id?: string
          observacoes?: string | null
          pontos_melhora?: string | null
          pontos_positivos?: string | null
          pontuacao_total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fb_avaliacoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "fb_colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_avaliacoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "fb_v_status_colaborador"
            referencedColumns: ["fb_colaborador_id"]
          },
        ]
      }
      fb_colaboradores: {
        Row: {
          cargo: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          gestor_id: string | null
          id: string
          incluido_no_ciclo: boolean
          matricula: string | null
          nome: string | null
          periodicidade_dias: number
          setor_id: string | null
          status: Database["public"]["Enums"]["fb_colaborador_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          gestor_id?: string | null
          id?: string
          incluido_no_ciclo?: boolean
          matricula?: string | null
          nome?: string | null
          periodicidade_dias?: number
          setor_id?: string | null
          status?: Database["public"]["Enums"]["fb_colaborador_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          gestor_id?: string | null
          id?: string
          incluido_no_ciclo?: boolean
          matricula?: string | null
          nome?: string | null
          periodicidade_dias?: number
          setor_id?: string | null
          status?: Database["public"]["Enums"]["fb_colaborador_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fb_colaboradores_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "fb_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_competencia_niveis: {
        Row: {
          competencia_id: string
          created_at: string
          descricao_oficial: string
          id: string
          nota: number
          updated_at: string
        }
        Insert: {
          competencia_id: string
          created_at?: string
          descricao_oficial?: string
          id?: string
          nota: number
          updated_at?: string
        }
        Update: {
          competencia_id?: string
          created_at?: string
          descricao_oficial?: string
          id?: string
          nota?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fb_competencia_niveis_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "fb_competencias"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_competencias: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      fb_config: {
        Row: {
          alertas_dias: number[]
          id: number
          periodicidade_padrao_dias: number
          updated_at: string
        }
        Insert: {
          alertas_dias?: number[]
          id?: number
          periodicidade_padrao_dias?: number
          updated_at?: string
        }
        Update: {
          alertas_dias?: number[]
          id?: number
          periodicidade_padrao_dias?: number
          updated_at?: string
        }
        Relationships: []
      }
      fb_feedforward: {
        Row: {
          acao: string
          avaliacao_id: string
          created_at: string
          id: string
          prazo: string | null
          responsavel: string | null
          status: Database["public"]["Enums"]["fb_acao_status"]
          updated_at: string
        }
        Insert: {
          acao: string
          avaliacao_id: string
          created_at?: string
          id?: string
          prazo?: string | null
          responsavel?: string | null
          status?: Database["public"]["Enums"]["fb_acao_status"]
          updated_at?: string
        }
        Update: {
          acao?: string
          avaliacao_id?: string
          created_at?: string
          id?: string
          prazo?: string | null
          responsavel?: string | null
          status?: Database["public"]["Enums"]["fb_acao_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fb_feedforward_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "fb_avaliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_feedforward_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "fb_v_status_colaborador"
            referencedColumns: ["ultima_avaliacao_id"]
          },
        ]
      }
      fb_pdi: {
        Row: {
          acao: string
          avaliacao_id: string
          competencia_id: string | null
          created_at: string
          evidencia: string | null
          id: string
          prazo: string | null
          responsavel: string | null
          status: Database["public"]["Enums"]["fb_acao_status"]
          updated_at: string
        }
        Insert: {
          acao: string
          avaliacao_id: string
          competencia_id?: string | null
          created_at?: string
          evidencia?: string | null
          id?: string
          prazo?: string | null
          responsavel?: string | null
          status?: Database["public"]["Enums"]["fb_acao_status"]
          updated_at?: string
        }
        Update: {
          acao?: string
          avaliacao_id?: string
          competencia_id?: string | null
          created_at?: string
          evidencia?: string | null
          id?: string
          prazo?: string | null
          responsavel?: string | null
          status?: Database["public"]["Enums"]["fb_acao_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fb_pdi_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "fb_avaliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_pdi_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "fb_v_status_colaborador"
            referencedColumns: ["ultima_avaliacao_id"]
          },
          {
            foreignKeyName: "fb_pdi_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "fb_competencias"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_setores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      feriados: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          id: string
        }
        Insert: {
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
        }
        Relationships: []
      }
      guia_audit_log: {
        Row: {
          campo: string
          created_at: string
          guia_codigo: string | null
          id: string
          user_id: string | null
          user_name: string | null
          valor_antigo: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          created_at?: string
          guia_codigo?: string | null
          id?: string
          user_id?: string | null
          user_name?: string | null
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          created_at?: string
          guia_codigo?: string | null
          id?: string
          user_id?: string | null
          user_name?: string | null
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Relationships: []
      }
      guia_exames: {
        Row: {
          created_at: string
          exame_codigo: string | null
          exame_nome: string | null
          guia_codigo: string
          guia_id: string
          id: string
          last_seen_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exame_codigo?: string | null
          exame_nome?: string | null
          guia_codigo: string
          guia_id: string
          id?: string
          last_seen_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exame_codigo?: string | null
          exame_nome?: string | null
          guia_codigo?: string
          guia_id?: string
          id?: string
          last_seen_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guia_exames_guia_id_fkey"
            columns: ["guia_id"]
            isOneToOne: false
            referencedRelation: "guias"
            referencedColumns: ["id"]
          },
        ]
      }
      guia_gestao: {
        Row: {
          aguardando_aso: Database["public"]["Enums"]["aguardando_aso_status"]
          aso_anexado: Database["public"]["Enums"]["sim_nao_status"]
          atendimento_lancado: Database["public"]["Enums"]["sim_nao_status"]
          compareceu_status: Database["public"]["Enums"]["compareceu_status"]
          guia_codigo: string
          guia_id: string
          id: string
          observacoes: string | null
          sla_final: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aguardando_aso?: Database["public"]["Enums"]["aguardando_aso_status"]
          aso_anexado?: Database["public"]["Enums"]["sim_nao_status"]
          atendimento_lancado?: Database["public"]["Enums"]["sim_nao_status"]
          compareceu_status?: Database["public"]["Enums"]["compareceu_status"]
          guia_codigo: string
          guia_id: string
          id?: string
          observacoes?: string | null
          sla_final?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aguardando_aso?: Database["public"]["Enums"]["aguardando_aso_status"]
          aso_anexado?: Database["public"]["Enums"]["sim_nao_status"]
          atendimento_lancado?: Database["public"]["Enums"]["sim_nao_status"]
          compareceu_status?: Database["public"]["Enums"]["compareceu_status"]
          guia_codigo?: string
          guia_id?: string
          id?: string
          observacoes?: string | null
          sla_final?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guia_gestao_guia_id_fkey"
            columns: ["guia_id"]
            isOneToOne: true
            referencedRelation: "guias"
            referencedColumns: ["id"]
          },
        ]
      }
      guia_imports: {
        Row: {
          file_name: string | null
          file_size: number | null
          id: string
          imported_at: string
          imported_by: string | null
          imported_by_name: string | null
          total_exames_atualizados: number | null
          total_exames_criados: number | null
          total_guias_atualizadas: number | null
          total_guias_criadas: number | null
          total_rows_lidas: number | null
        }
        Insert: {
          file_name?: string | null
          file_size?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          imported_by_name?: string | null
          total_exames_atualizados?: number | null
          total_exames_criados?: number | null
          total_guias_atualizadas?: number | null
          total_guias_criadas?: number | null
          total_rows_lidas?: number | null
        }
        Update: {
          file_name?: string | null
          file_size?: number | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          imported_by_name?: string | null
          total_exames_atualizados?: number | null
          total_exames_criados?: number | null
          total_guias_atualizadas?: number | null
          total_guias_criadas?: number | null
          total_rows_lidas?: number | null
        }
        Relationships: []
      }
      guias: {
        Row: {
          atendido_texto: string | null
          created_at: string
          data_agendamento: string | null
          data_guia: string | null
          empresa_codigo: string | null
          empresa_nome: string | null
          funcionario_codigo: string | null
          funcionario_cpf: string | null
          funcionario_nome: string | null
          guia_codigo: string
          hora_agendamento: string | null
          id: string
          last_import_at: string | null
          last_import_by: string | null
          last_seen_at: string | null
          medico_codigo: string | null
          medico_nome: string | null
          pedido_codigo_sequencial: string | null
          prestador_codigo: string | null
          prestador_email: string | null
          prestador_nome: string | null
          prestador_socnet_codigo: string | null
          prestador_socnet_nome: string | null
          prestador_telefone: string | null
          situacao: string | null
          solicitante_nome: string | null
          tipo_exame: string | null
          unidade_nome: string | null
          updated_at: string
        }
        Insert: {
          atendido_texto?: string | null
          created_at?: string
          data_agendamento?: string | null
          data_guia?: string | null
          empresa_codigo?: string | null
          empresa_nome?: string | null
          funcionario_codigo?: string | null
          funcionario_cpf?: string | null
          funcionario_nome?: string | null
          guia_codigo: string
          hora_agendamento?: string | null
          id?: string
          last_import_at?: string | null
          last_import_by?: string | null
          last_seen_at?: string | null
          medico_codigo?: string | null
          medico_nome?: string | null
          pedido_codigo_sequencial?: string | null
          prestador_codigo?: string | null
          prestador_email?: string | null
          prestador_nome?: string | null
          prestador_socnet_codigo?: string | null
          prestador_socnet_nome?: string | null
          prestador_telefone?: string | null
          situacao?: string | null
          solicitante_nome?: string | null
          tipo_exame?: string | null
          unidade_nome?: string | null
          updated_at?: string
        }
        Update: {
          atendido_texto?: string | null
          created_at?: string
          data_agendamento?: string | null
          data_guia?: string | null
          empresa_codigo?: string | null
          empresa_nome?: string | null
          funcionario_codigo?: string | null
          funcionario_cpf?: string | null
          funcionario_nome?: string | null
          guia_codigo?: string
          hora_agendamento?: string | null
          id?: string
          last_import_at?: string | null
          last_import_by?: string | null
          last_seen_at?: string | null
          medico_codigo?: string | null
          medico_nome?: string | null
          pedido_codigo_sequencial?: string | null
          prestador_codigo?: string | null
          prestador_email?: string | null
          prestador_nome?: string | null
          prestador_socnet_codigo?: string | null
          prestador_socnet_nome?: string | null
          prestador_telefone?: string | null
          situacao?: string | null
          solicitante_nome?: string | null
          tipo_exame?: string | null
          unidade_nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      historico_os: {
        Row: {
          acao: string
          comentario: string | null
          created_at: string
          id: string
          ordem_id: string
          servico_afetado: string | null
          status_anterior: string | null
          status_novo: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          acao: string
          comentario?: string | null
          created_at?: string
          id?: string
          ordem_id: string
          servico_afetado?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          acao?: string
          comentario?: string | null
          created_at?: string
          id?: string
          ordem_id?: string
          servico_afetado?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_os_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      laudos: {
        Row: {
          created_at: string
          created_by: string | null
          data_emissao: string
          data_validade: string | null
          empresa_cliente: string
          id: string
          justificativa_sem_vigencia: string | null
          numero_os: string
          observacoes: string | null
          ordem_id: string
          possui_vigencia: boolean
          responsavel_tecnico_id: string
          responsavel_tecnico_nome: string
          responsavel_tecnico_registro: string
          servico_id: string
          tipo_laudo_id: string
          tipo_laudo_nome: string
          tipo_servico: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_validade?: string | null
          empresa_cliente: string
          id?: string
          justificativa_sem_vigencia?: string | null
          numero_os: string
          observacoes?: string | null
          ordem_id: string
          possui_vigencia?: boolean
          responsavel_tecnico_id: string
          responsavel_tecnico_nome: string
          responsavel_tecnico_registro: string
          servico_id: string
          tipo_laudo_id: string
          tipo_laudo_nome: string
          tipo_servico: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_validade?: string | null
          empresa_cliente?: string
          id?: string
          justificativa_sem_vigencia?: string | null
          numero_os?: string
          observacoes?: string | null
          ordem_id?: string
          possui_vigencia?: boolean
          responsavel_tecnico_id?: string
          responsavel_tecnico_nome?: string
          responsavel_tecnico_registro?: string
          servico_id?: string
          tipo_laudo_id?: string
          tipo_laudo_nome?: string
          tipo_servico?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "laudos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laudos_responsavel_tecnico_id_fkey"
            columns: ["responsavel_tecnico_id"]
            isOneToOne: false
            referencedRelation: "responsaveis_tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laudos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos_os"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laudos_tipo_laudo_id_fkey"
            columns: ["tipo_laudo_id"]
            isOneToOne: false
            referencedRelation: "tipos_laudo"
            referencedColumns: ["id"]
          },
        ]
      }
      life_ranges: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          max_lives: number | null
          min_lives: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          max_lives?: number | null
          min_lives: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          max_lives?: number | null
          min_lives?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      mentions: {
        Row: {
          chat_message_id: string | null
          comment_id: string | null
          created_at: string
          id: string
          mentioned_by: string
          mentioned_user_id: string
          post_id: string | null
        }
        Insert: {
          chat_message_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          mentioned_by: string
          mentioned_user_id: string
          post_id?: string | null
        }
        Update: {
          chat_message_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          mentioned_by?: string
          mentioned_user_id?: string
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      module_sessions: {
        Row: {
          id: string
          ip_address: string | null
          module_id: string
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          module_id: string
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          module_id?: string
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_sessions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          app_type: Database["public"]["Enums"]["module_app_type"] | null
          base_url: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          requires_permission: boolean | null
          route: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          app_type?: Database["public"]["Enums"]["module_app_type"] | null
          base_url?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          requires_permission?: boolean | null
          route?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          app_type?: Database["public"]["Enums"]["module_app_type"] | null
          base_url?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          requires_permission?: boolean | null
          route?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          content: string | null
          created_at: string
          email_pending: boolean
          email_sent_at: string | null
          id: string
          is_read: boolean | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          read_at: string | null
          related_id: string | null
          related_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          email_pending?: boolean
          email_sent_at?: string | null
          id?: string
          is_read?: boolean | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          email_pending?: boolean
          email_sent_at?: string | null
          id?: string
          is_read?: boolean | null
          notification_type?: Database["public"]["Enums"]["notification_type"]
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      occurrence_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_url: string
          id: string
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_url: string
          id?: string
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_url?: string
          id?: string
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "occurrence_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrence_comments: {
        Row: {
          body: string
          comment_type: Database["public"]["Enums"]["occurrence_comment_type"]
          created_at: string
          created_by: string
          id: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          body: string
          comment_type?: Database["public"]["Enums"]["occurrence_comment_type"]
          created_at?: string
          created_by: string
          id?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          comment_type?: Database["public"]["Enums"]["occurrence_comment_type"]
          created_at?: string
          created_by?: string
          id?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "occurrence_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrence_history: {
        Row: {
          action_type: string
          details: Json | null
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          performed_at: string
          performed_by: string | null
          ticket_id: string
        }
        Insert: {
          action_type: string
          details?: Json | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_at?: string
          performed_by?: string | null
          ticket_id: string
        }
        Update: {
          action_type?: string
          details?: Json | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_at?: string
          performed_by?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "occurrence_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrence_sla_config: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          priority: Database["public"]["Enums"]["occurrence_priority"]
          target_hours: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          priority: Database["public"]["Enums"]["occurrence_priority"]
          target_hours: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          priority?: Database["public"]["Enums"]["occurrence_priority"]
          target_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      occurrence_status_events: {
        Row: {
          changed_by: string | null
          entered_at: string
          exited_at: string | null
          from_status: Database["public"]["Enums"]["occurrence_status"] | null
          id: string
          reason: string | null
          ticket_id: string
          to_status: Database["public"]["Enums"]["occurrence_status"]
        }
        Insert: {
          changed_by?: string | null
          entered_at?: string
          exited_at?: string | null
          from_status?: Database["public"]["Enums"]["occurrence_status"] | null
          id?: string
          reason?: string | null
          ticket_id: string
          to_status: Database["public"]["Enums"]["occurrence_status"]
        }
        Update: {
          changed_by?: string | null
          entered_at?: string
          exited_at?: string | null
          from_status?: Database["public"]["Enums"]["occurrence_status"] | null
          id?: string
          reason?: string | null
          ticket_id?: string
          to_status?: Database["public"]["Enums"]["occurrence_status"]
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_status_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "occurrence_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrence_ticket_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignment_role: Database["public"]["Enums"]["occurrence_assignee_role"]
          id: string
          is_active: boolean
          ticket_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_role?: Database["public"]["Enums"]["occurrence_assignee_role"]
          id?: string
          is_active?: boolean
          ticket_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_role?: Database["public"]["Enums"]["occurrence_assignee_role"]
          id?: string
          is_active?: boolean
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_ticket_assignees_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "occurrence_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrence_ticket_sector_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          is_active: boolean
          sector: Database["public"]["Enums"]["occurrence_sector"]
          ticket_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_active?: boolean
          sector: Database["public"]["Enums"]["occurrence_sector"]
          ticket_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_active?: boolean
          sector?: Database["public"]["Enums"]["occurrence_sector"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_ticket_sector_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "occurrence_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrence_tickets: {
        Row: {
          action_plan_due_at: string | null
          action_plan_how: string | null
          action_plan_owner_id: string | null
          action_plan_what: string | null
          client_validated: boolean
          client_validated_at: string | null
          cnpj: string
          company_name: string
          concluded_at: string | null
          contact_origin: Database["public"]["Enums"]["occurrence_contact_origin"]
          created_at: string
          created_by: string
          description: string
          due_at: string | null
          id: string
          involved_sectors: Database["public"]["Enums"]["occurrence_sector"][]
          last_client_response_at: string | null
          last_internal_update_at: string | null
          primary_sector:
            | Database["public"]["Enums"]["occurrence_sector"]
            | null
          priority: Database["public"]["Enums"]["occurrence_priority"]
          reopened_reason: string | null
          requester_contact: string | null
          requester_name: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["occurrence_status"]
          ticket_number: string
          ticket_type: Database["public"]["Enums"]["occurrence_type"]
          unit: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action_plan_due_at?: string | null
          action_plan_how?: string | null
          action_plan_owner_id?: string | null
          action_plan_what?: string | null
          client_validated?: boolean
          client_validated_at?: string | null
          cnpj: string
          company_name: string
          concluded_at?: string | null
          contact_origin: Database["public"]["Enums"]["occurrence_contact_origin"]
          created_at?: string
          created_by: string
          description: string
          due_at?: string | null
          id?: string
          involved_sectors?: Database["public"]["Enums"]["occurrence_sector"][]
          last_client_response_at?: string | null
          last_internal_update_at?: string | null
          primary_sector?:
            | Database["public"]["Enums"]["occurrence_sector"]
            | null
          priority?: Database["public"]["Enums"]["occurrence_priority"]
          reopened_reason?: string | null
          requester_contact?: string | null
          requester_name?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["occurrence_status"]
          ticket_number: string
          ticket_type: Database["public"]["Enums"]["occurrence_type"]
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action_plan_due_at?: string | null
          action_plan_how?: string | null
          action_plan_owner_id?: string | null
          action_plan_what?: string | null
          client_validated?: boolean
          client_validated_at?: string | null
          cnpj?: string
          company_name?: string
          concluded_at?: string | null
          contact_origin?: Database["public"]["Enums"]["occurrence_contact_origin"]
          created_at?: string
          created_by?: string
          description?: string
          due_at?: string | null
          id?: string
          involved_sectors?: Database["public"]["Enums"]["occurrence_sector"][]
          last_client_response_at?: string | null
          last_internal_update_at?: string | null
          primary_sector?:
            | Database["public"]["Enums"]["occurrence_sector"]
            | null
          priority?: Database["public"]["Enums"]["occurrence_priority"]
          reopened_reason?: string | null
          requester_contact?: string | null
          requester_name?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["occurrence_status"]
          ticket_number?: string
          ticket_type?: Database["public"]["Enums"]["occurrence_type"]
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ordens_servico: {
        Row: {
          contato_cliente: string | null
          created_at: string
          created_by: string | null
          data_emissao: string | null
          data_registro: string
          empresa_cliente: string
          id: string
          numero_os: string
          observacoes: string | null
          prazo_acordado: string | null
          responsavel_atual: string
          status_os: string
          tipo_servico_resumo: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contato_cliente?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_registro?: string
          empresa_cliente: string
          id?: string
          numero_os: string
          observacoes?: string | null
          prazo_acordado?: string | null
          responsavel_atual: string
          status_os?: string
          tipo_servico_resumo?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contato_cliente?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_registro?: string
          empresa_cliente?: string
          id?: string
          numero_os?: string
          observacoes?: string | null
          prazo_acordado?: string | null
          responsavel_atual?: string
          status_os?: string
          tipo_servico_resumo?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      os_equipamento_historico: {
        Row: {
          acao: string
          comentario: string | null
          created_at: string
          equipamento_id: string
          id: string
          ordem_id: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          acao: string
          comentario?: string | null
          created_at?: string
          equipamento_id: string
          id?: string
          ordem_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          acao?: string
          comentario?: string | null
          created_at?: string
          equipamento_id?: string
          id?: string
          ordem_id?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_equipamento_historico_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "os_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_equipamento_historico_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_equipamentos: {
        Row: {
          ativo: boolean
          certificado: string | null
          created_at: string
          created_by: string | null
          data_ultima_calibracao: string | null
          fabricante: string | null
          id: string
          is_locacao: boolean
          locacao_cnpj: string | null
          locacao_custo: number | null
          locacao_fornecedor: string | null
          locacao_nf_data: string | null
          locacao_nf_numero: string | null
          nome: string
          observacoes: string | null
          tipo: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          certificado?: string | null
          created_at?: string
          created_by?: string | null
          data_ultima_calibracao?: string | null
          fabricante?: string | null
          id?: string
          is_locacao?: boolean
          locacao_cnpj?: string | null
          locacao_custo?: number | null
          locacao_fornecedor?: string | null
          locacao_nf_data?: string | null
          locacao_nf_numero?: string | null
          nome: string
          observacoes?: string | null
          tipo?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          certificado?: string | null
          created_at?: string
          created_by?: string | null
          data_ultima_calibracao?: string | null
          fabricante?: string | null
          id?: string
          is_locacao?: boolean
          locacao_cnpj?: string | null
          locacao_custo?: number | null
          locacao_fornecedor?: string | null
          locacao_nf_data?: string | null
          locacao_nf_numero?: string | null
          nome?: string
          observacoes?: string | null
          tipo?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      os_visita_equipamentos: {
        Row: {
          created_at: string
          equipamento_id: string
          visita_id: string
        }
        Insert: {
          created_at?: string
          equipamento_id: string
          visita_id: string
        }
        Update: {
          created_at?: string
          equipamento_id?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_visita_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "os_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_visita_equipamentos_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "os_visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      os_visitas: {
        Row: {
          created_at: string
          created_by: string | null
          custos_deslocamento: number
          data_visita: string
          empresa_cliente: string
          endereco: string | null
          hora_visita: string | null
          id: string
          motivo_cancelamento: string | null
          numero_os: string | null
          observacoes: string | null
          ordem_id: string | null
          responsavel_id: string | null
          responsavel_nome: string
          status: Database["public"]["Enums"]["visita_status"]
          tipo_visita: Database["public"]["Enums"]["visita_tipo"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custos_deslocamento?: number
          data_visita: string
          empresa_cliente: string
          endereco?: string | null
          hora_visita?: string | null
          id?: string
          motivo_cancelamento?: string | null
          numero_os?: string | null
          observacoes?: string | null
          ordem_id?: string | null
          responsavel_id?: string | null
          responsavel_nome: string
          status?: Database["public"]["Enums"]["visita_status"]
          tipo_visita?: Database["public"]["Enums"]["visita_tipo"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custos_deslocamento?: number
          data_visita?: string
          empresa_cliente?: string
          endereco?: string | null
          hora_visita?: string | null
          id?: string
          motivo_cancelamento?: string | null
          numero_os?: string | null
          observacoes?: string | null
          ordem_id?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string
          status?: Database["public"]["Enums"]["visita_status"]
          tipo_visita?: Database["public"]["Enums"]["visita_tipo"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_visitas_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      passivos_historico_mensal: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          observacoes: string | null
          passivo_id: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          observacoes?: string | null
          passivo_id: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          observacoes?: string | null
          passivo_id?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "passivos_historico_mensal_passivo_id_fkey"
            columns: ["passivo_id"]
            isOneToOne: false
            referencedRelation: "passivos_parcelamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      passivos_parcelamentos: {
        Row: {
          cnpj: string
          created_at: string
          created_by: string | null
          dia_vencimento: number | null
          empresa_nome: string
          guia_conferida: boolean
          guia_recebida: boolean
          id: string
          last_updated_at: string | null
          last_updated_by: string | null
          link_acesso: string | null
          link_segunda_via: string | null
          numero_acordo: string
          observacoes: string | null
          pagamento_baixado: boolean
          parcelas_em_atraso: number
          parcelas_pagas: number
          parcelas_restantes: number | null
          parcelas_totais: number
          status: Database["public"]["Enums"]["passivo_status"]
          tipo_parcelamento: string
          updated_at: string
          updated_by: string | null
          valor_mensal: number
        }
        Insert: {
          cnpj: string
          created_at?: string
          created_by?: string | null
          dia_vencimento?: number | null
          empresa_nome: string
          guia_conferida?: boolean
          guia_recebida?: boolean
          id?: string
          last_updated_at?: string | null
          last_updated_by?: string | null
          link_acesso?: string | null
          link_segunda_via?: string | null
          numero_acordo: string
          observacoes?: string | null
          pagamento_baixado?: boolean
          parcelas_em_atraso?: number
          parcelas_pagas?: number
          parcelas_restantes?: number | null
          parcelas_totais: number
          status?: Database["public"]["Enums"]["passivo_status"]
          tipo_parcelamento: string
          updated_at?: string
          updated_by?: string | null
          valor_mensal?: number
        }
        Update: {
          cnpj?: string
          created_at?: string
          created_by?: string | null
          dia_vencimento?: number | null
          empresa_nome?: string
          guia_conferida?: boolean
          guia_recebida?: boolean
          id?: string
          last_updated_at?: string | null
          last_updated_by?: string | null
          link_acesso?: string | null
          link_segunda_via?: string | null
          numero_acordo?: string
          observacoes?: string | null
          pagamento_baixado?: boolean
          parcelas_em_atraso?: number
          parcelas_pagas?: number
          parcelas_restantes?: number | null
          parcelas_totais?: number
          status?: Database["public"]["Enums"]["passivo_status"]
          tipo_parcelamento?: string
          updated_at?: string
          updated_by?: string | null
          valor_mensal?: number
        }
        Relationships: []
      }
      permission_template_shadow: {
        Row: {
          computed_at: string
          diff: Json | null
          id: string
          match_type: string
          permission_id: string
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          template_id: string
        }
        Insert: {
          computed_at?: string
          diff?: Json | null
          id?: string
          match_type: string
          permission_id: string
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          template_id: string
        }
        Update: {
          computed_at?: string
          diff?: Json | null
          id?: string
          match_type?: string
          permission_id?: string
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_template_shadow_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: true
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_template_shadow_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "role_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          can_approve: boolean | null
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string
          dashboard_id: string | null
          department_id: string | null
          id: string
          module_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          can_approve?: boolean | null
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string
          dashboard_id?: string | null
          department_id?: string | null
          id?: string
          module_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          can_approve?: boolean | null
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string
          dashboard_id?: string | null
          department_id?: string | null
          id?: string
          module_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permissions_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_service_prices: {
        Row: {
          catalog_service_id: string
          created_at: string
          id: string
          is_included_in_package: boolean
          life_range_id: string | null
          notes: string | null
          plan_id: string
          price: number
          updated_at: string
        }
        Insert: {
          catalog_service_id: string
          created_at?: string
          id?: string
          is_included_in_package?: boolean
          life_range_id?: string | null
          notes?: string | null
          plan_id: string
          price?: number
          updated_at?: string
        }
        Update: {
          catalog_service_id?: string
          created_at?: string
          id?: string
          is_included_in_package?: boolean
          life_range_id?: string | null
          notes?: string | null
          plan_id?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_service_prices_catalog_service_id_fkey"
            columns: ["catalog_service_id"]
            isOneToOne: false
            referencedRelation: "catalog_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_service_prices_life_range_id_fkey"
            columns: ["life_range_id"]
            isOneToOne: false
            referencedRelation: "life_ranges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_service_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prestadores_bloqueados: {
        Row: {
          bloqueado_por: string | null
          created_at: string
          id: string
          motivo: string | null
          nome: string
          nome_normalizado: string
        }
        Insert: {
          bloqueado_por?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          nome: string
          nome_normalizado: string
        }
        Update: {
          bloqueado_por?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          nome?: string
          nome_normalizado?: string
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          billing_model: string
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_recommended: boolean
          name: string
          updated_at: string
        }
        Insert: {
          billing_model?: string
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          billing_model?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          about: string | null
          birth_date: string | null
          contact_email: string | null
          created_at: string
          direct_leader_id: string | null
          direct_manager_id: string | null
          email: string
          full_name: string
          hierarchy_position:
            | Database["public"]["Enums"]["hierarchy_position"]
            | null
          id: string
          instagram: string | null
          internal_handle: string | null
          login: string | null
          must_change_password: boolean | null
          nickname: string | null
          phone_extension: string | null
          position: string | null
          profile_photo_url: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          unit: Database["public"]["Enums"]["unit_type"] | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          about?: string | null
          birth_date?: string | null
          contact_email?: string | null
          created_at?: string
          direct_leader_id?: string | null
          direct_manager_id?: string | null
          email: string
          full_name: string
          hierarchy_position?:
            | Database["public"]["Enums"]["hierarchy_position"]
            | null
          id?: string
          instagram?: string | null
          internal_handle?: string | null
          login?: string | null
          must_change_password?: boolean | null
          nickname?: string | null
          phone_extension?: string | null
          position?: string | null
          profile_photo_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          unit?: Database["public"]["Enums"]["unit_type"] | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          about?: string | null
          birth_date?: string | null
          contact_email?: string | null
          created_at?: string
          direct_leader_id?: string | null
          direct_manager_id?: string | null
          email?: string
          full_name?: string
          hierarchy_position?:
            | Database["public"]["Enums"]["hierarchy_position"]
            | null
          id?: string
          instagram?: string | null
          internal_handle?: string | null
          login?: string | null
          must_change_password?: boolean | null
          nickname?: string | null
          phone_extension?: string | null
          position?: string | null
          profile_photo_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          unit?: Database["public"]["Enums"]["unit_type"] | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_direct_leader_id_fkey"
            columns: ["direct_leader_id"]
            isOneToOne: false
            referencedRelation: "fb_v_status_colaborador"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_direct_leader_id_fkey"
            columns: ["direct_leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_direct_manager_id_fkey"
            columns: ["direct_manager_id"]
            isOneToOne: false
            referencedRelation: "fb_v_status_colaborador"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_direct_manager_id_fkey"
            columns: ["direct_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      quotation_versions: {
        Row: {
          client_name: string
          created_at: string
          created_by: string
          custos_adicionais: Json
          discount_percent: number | null
          discount_value: number | null
          id: string
          items: Json
          margin_percent: number
          notes: string | null
          quotation_id: string
          rejection_reason: string | null
          status: string | null
          total_cost: number
          total_result: number
          total_value: number
          version_number: number
        }
        Insert: {
          client_name: string
          created_at?: string
          created_by: string
          custos_adicionais?: Json
          discount_percent?: number | null
          discount_value?: number | null
          id?: string
          items?: Json
          margin_percent: number
          notes?: string | null
          quotation_id: string
          rejection_reason?: string | null
          status?: string | null
          total_cost: number
          total_result: number
          total_value: number
          version_number: number
        }
        Update: {
          client_name?: string
          created_at?: string
          created_by?: string
          custos_adicionais?: Json
          discount_percent?: number | null
          discount_value?: number | null
          id?: string
          items?: Json
          margin_percent?: number
          notes?: string | null
          quotation_id?: string
          rejection_reason?: string | null
          status?: string | null
          total_cost?: number
          total_result?: number
          total_value?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_versions_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          client_name: string
          created_at: string
          created_by: string
          custos_adicionais: Json
          discount_percent: number | null
          discount_value: number | null
          id: string
          items: Json
          margin_percent: number
          notes: string | null
          quotation_number: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["quotation_status"]
          total_cost: number
          total_result: number
          total_value: number
          updated_at: string
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_name: string
          created_at?: string
          created_by: string
          custos_adicionais?: Json
          discount_percent?: number | null
          discount_value?: number | null
          id?: string
          items?: Json
          margin_percent: number
          notes?: string | null
          quotation_number?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          total_cost: number
          total_result: number
          total_value: number
          updated_at?: string
          version_number?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_name?: string
          created_at?: string
          created_by?: string
          custos_adicionais?: Json
          discount_percent?: number | null
          discount_value?: number | null
          id?: string
          items?: Json
          margin_percent?: number
          notes?: string | null
          quotation_number?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          total_cost?: number
          total_result?: number
          total_value?: number
          updated_at?: string
          version_number?: number
        }
        Relationships: []
      }
      renewal_quotation_items: {
        Row: {
          adjusted_value: number
          applied_percent: number
          catalog_service_id: string | null
          comparison_status: string | null
          created_at: string
          current_value: number
          id: string
          in_monthly_package: boolean
          is_included: boolean
          observation: string | null
          quantity: number
          reference_value: number
          renewal_id: string
          service_id: string | null
          service_name: string
          sort_order: number
        }
        Insert: {
          adjusted_value?: number
          applied_percent?: number
          catalog_service_id?: string | null
          comparison_status?: string | null
          created_at?: string
          current_value?: number
          id?: string
          in_monthly_package?: boolean
          is_included?: boolean
          observation?: string | null
          quantity?: number
          reference_value?: number
          renewal_id: string
          service_id?: string | null
          service_name: string
          sort_order?: number
        }
        Update: {
          adjusted_value?: number
          applied_percent?: number
          catalog_service_id?: string | null
          comparison_status?: string | null
          created_at?: string
          current_value?: number
          id?: string
          in_monthly_package?: boolean
          is_included?: boolean
          observation?: string | null
          quantity?: number
          reference_value?: number
          renewal_id?: string
          service_id?: string | null
          service_name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "renewal_quotation_items_catalog_service_id_fkey"
            columns: ["catalog_service_id"]
            isOneToOne: false
            referencedRelation: "catalog_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_quotation_items_renewal_id_fkey"
            columns: ["renewal_id"]
            isOneToOne: false
            referencedRelation: "renewal_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_quotation_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_quotations: {
        Row: {
          adjusted_total_annual: number
          adjusted_total_monthly: number
          approved_at: string | null
          approved_by: string | null
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string
          current_lives: number
          current_total_annual: number
          current_total_monthly: number
          deviation_percent: number
          deviation_status: string
          id: string
          index_percent: number
          index_type: string
          justification: string | null
          notes: string | null
          reference_period: string | null
          reference_total_monthly: number
          rejection_reason: string | null
          renewal_number: string | null
          status: string
          updated_at: string
          version_number: number
        }
        Insert: {
          adjusted_total_annual?: number
          adjusted_total_monthly?: number
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          client_name: string
          created_at?: string
          created_by: string
          current_lives?: number
          current_total_annual?: number
          current_total_monthly?: number
          deviation_percent?: number
          deviation_status?: string
          id?: string
          index_percent?: number
          index_type?: string
          justification?: string | null
          notes?: string | null
          reference_period?: string | null
          reference_total_monthly?: number
          rejection_reason?: string | null
          renewal_number?: string | null
          status?: string
          updated_at?: string
          version_number?: number
        }
        Update: {
          adjusted_total_annual?: number
          adjusted_total_monthly?: number
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string
          current_lives?: number
          current_total_annual?: number
          current_total_monthly?: number
          deviation_percent?: number
          deviation_status?: string
          id?: string
          index_percent?: number
          index_type?: string
          justification?: string | null
          notes?: string | null
          reference_period?: string | null
          reference_total_monthly?: number
          rejection_reason?: string | null
          renewal_number?: string | null
          status?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "renewal_quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "commercial_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      responsaveis_tecnicos: {
        Row: {
          ativo: boolean
          conselho: string
          created_at: string
          email: string
          especialidade: string
          id: string
          nome: string
          numero_registro: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          conselho?: string
          created_at?: string
          email?: string
          especialidade?: string
          id?: string
          nome: string
          numero_registro: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          conselho?: string
          created_at?: string
          email?: string
          especialidade?: string
          id?: string
          nome?: string
          numero_registro?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_templates: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string
          code: string
          cost_value: number
          created_at: string
          default_markup: number | null
          description: string
          id: string
          info_text: string | null
          is_active: boolean
          min_quantity: number | null
          unit: string
          unit_value: number
          updated_at: string
        }
        Insert: {
          category?: string
          code: string
          cost_value?: number
          created_at?: string
          default_markup?: number | null
          description: string
          id?: string
          info_text?: string | null
          is_active?: boolean
          min_quantity?: number | null
          unit?: string
          unit_value?: number
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          cost_value?: number
          created_at?: string
          default_markup?: number | null
          description?: string
          id?: string
          info_text?: string | null
          is_active?: boolean
          min_quantity?: number | null
          unit?: string
          unit_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      servicos_os: {
        Row: {
          created_at: string
          data_conclusao: string | null
          data_inicio: string | null
          id: string
          observacoes: string | null
          ordem_id: string
          status: string
          tipo: string
          tipo_os: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          observacoes?: string | null
          ordem_id: string
          status?: string
          tipo: string
          tipo_os?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_conclusao?: string | null
          data_inicio?: string | null
          id?: string
          observacoes?: string | null
          ordem_id?: string
          status?: string
          tipo?: string
          tipo_os?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_os_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_laudo: {
        Row: {
          ativo: boolean
          conselhos_permitidos: string[]
          created_at: string
          descricao: string
          exige_vigencia: boolean
          id: string
          nome: string
          prazo_vigencia_padrao: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          conselhos_permitidos?: string[]
          created_at?: string
          descricao?: string
          exige_vigencia?: boolean
          id?: string
          nome: string
          prazo_vigencia_padrao?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          conselhos_permitidos?: string[]
          created_at?: string
          descricao?: string
          exige_vigencia?: boolean
          id?: string
          nome?: string
          prazo_vigencia_padrao?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      unauthorized_access_log: {
        Row: {
          attempt_source: string
          attempted_resource: string
          created_at: string
          details: Json | null
          http_method: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          attempt_source: string
          attempted_resource: string
          created_at?: string
          details?: Json | null
          http_method?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          attempt_source?: string
          attempted_resource?: string
          created_at?: string
          details?: Json | null
          http_method?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          additional_info: string | null
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          is_headquarters: boolean | null
          name: string
          phone: string | null
          sort_order: number | null
          state: string | null
          updated_at: string
        }
        Insert: {
          additional_info?: string | null
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_headquarters?: boolean | null
          name: string
          phone?: string | null
          sort_order?: number | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          additional_info?: string | null
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_headquarters?: boolean | null
          name?: string
          phone?: string | null
          sort_order?: number | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      useful_links: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      user_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          is_lotacao: boolean
          is_primary: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          is_lotacao?: boolean
          is_primary?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          is_lotacao?: boolean
          is_primary?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_access: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          is_active: boolean
          module_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          module_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_access_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      fb_v_status_colaborador: {
        Row: {
          cargo: string | null
          classificacao: Database["public"]["Enums"]["fb_classificacao"] | null
          colaborador_id: string | null
          cpf: string | null
          data_admissao: string | null
          fb_colaborador_id: string | null
          gestor_id: string | null
          gestor_nome: string | null
          incluido_no_ciclo: boolean | null
          lider_id: string | null
          lider_nome: string | null
          matricula: string | null
          nome: string | null
          periodicidade_dias: number | null
          pontuacao_total: number | null
          proximo_feedback: string | null
          risco: Database["public"]["Enums"]["fb_risco"] | null
          setor_id: string | null
          setor_nome: string | null
          status: Database["public"]["Enums"]["fb_colaborador_status"] | null
          status_feedback: string | null
          ultima_avaliacao_id: string | null
          ultimo_feedback: string | null
          unit: Database["public"]["Enums"]["unit_type"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_direct_leader_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "fb_v_status_colaborador"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_direct_leader_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_direct_manager_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "fb_v_status_colaborador"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_direct_manager_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_departments_department_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_shadow_template: {
        Args: { _notes?: string; _shadow_id: string }
        Returns: undefined
      }
      aso_build_atendimento_timestamp: {
        Args: { _data: string; _hora: string }
        Returns: string
      }
      aso_status_to_stage: {
        Args: { _status: Database["public"]["Enums"]["aso_status"] }
        Returns: string
      }
      calculate_occurrence_due_at: {
        Args: {
          _base_time: string
          _priority: Database["public"]["Enums"]["occurrence_priority"]
        }
        Returns: string
      }
      can_access_occurrence_attachment: {
        Args: { _ticket_id: string }
        Returns: boolean
      }
      can_access_occurrence_attachment_path: {
        Args: { _path: string }
        Returns: boolean
      }
      can_approve_module_route: {
        Args: { _route: string; _user_id: string }
        Returns: boolean
      }
      can_close_occurrence_ticket: {
        Args: { _ticket_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_module_route: {
        Args: { _route: string; _user_id: string }
        Returns: boolean
      }
      can_manage_occurrence_ticket: {
        Args: { _ticket_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_module_route: {
        Args: { _route: string; _user_id: string }
        Returns: boolean
      }
      contract_calc_status: {
        Args: {
          _data_inicio: string
          _status_atual: Database["public"]["Enums"]["contract_status"]
          _vigencia_meses: number
        }
        Returns: Database["public"]["Enums"]["contract_status"]
      }
      contract_recalc_vigencia: { Args: never; Returns: Json }
      dashboard_guias_agregado: {
        Args: { _periodo_fim?: string; _periodo_ini?: string }
        Returns: Json
      }
      fb_is_gestor_de: {
        Args: { _colaborador_id: string; _user_id: string }
        Returns: boolean
      }
      fb_is_rh: { Args: { _user_id: string }; Returns: boolean }
      generate_occurrence_ticket_number: { Args: never; Returns: string }
      get_user_accessible_modules: {
        Args: { _user_id: string }
        Returns: {
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          department_id: string
          department_name: string
          module_icon: string
          module_id: string
          module_name: string
          module_route: string
        }[]
      }
      guias_business_days: {
        Args: { _end: string; _start: string }
        Returns: number
      }
      guias_filtros_disponiveis: { Args: never; Returns: Json }
      guias_sla_status: {
        Args: {
          _atendimento_lancado: string
          _data_base: string
          _sla_final: string
        }
        Returns: string
      }
      guias_status_guia: {
        Args: {
          _aguardando: string
          _aso: string
          _atend: string
          _comp: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_adm_master: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_occurrence_manager: { Args: { _user_id: string }; Returns: boolean }
      is_user_in_department: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
      listar_guias: {
        Args: {
          _filters?: Json
          _page?: number
          _page_size?: number
          _sort_dir?: string
          _sort_field?: string
        }
        Returns: Json
      }
      log_unauthorized_access: {
        Args: {
          _details?: Json
          _method?: string
          _resource: string
          _source: string
        }
        Returns: string
      }
      lookup_email_by_login: { Args: { p_login: string }; Returns: string }
      reject_shadow_template: {
        Args: { _notes?: string; _shadow_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_has_module_access: {
        Args: { _module_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      aguardando_aso_status:
        | "NAO_INFORMADO"
        | "CONTATO_REALIZADO"
        | "RECEBIDO"
        | "NAO_RECEBIDO"
      aso_exame_status:
        | "aguardando"
        | "pendente"
        | "recebido"
        | "datado_soc"
        | "inserido_socged"
        | "concluido"
        | "realizado"
        | "liberado"
        | "nova_coleta"
      aso_exame_tipo: "imediato" | "complementar"
      aso_status:
        | "importado"
        | "em_triagem"
        | "aguardando_exames"
        | "pronto_assinatura_medica"
        | "em_escaneamento"
        | "liberado"
        | "liberado_faturamento"
        | "finalizado"
        | "fechado"
      aso_tipo_assinatura: "digital" | "manual"
      aso_tipo_prontuario: "digital" | "fisico"
      chat_type: "direct" | "department"
      compareceu_status:
        | "NAO_INFORMADO"
        | "COMPARECEU"
        | "NAO_COMPARECEU"
        | "REMARCADO"
        | "PARCIAL"
      contract_categoria:
        | "gestao_ocupacional"
        | "contrato_por_uso"
        | "contrato_pontual"
        | "contrato_parceiras"
        | "outros"
      contract_signer_status:
        | "pendente"
        | "enviado"
        | "assinado"
        | "recusado"
        | "cancelado"
      contract_signer_type: "representante" | "testemunha_1" | "testemunha_2"
      contract_status:
        | "rascunho"
        | "aguardando_assinatura"
        | "parcialmente_assinado"
        | "assinado"
        | "ativo"
        | "vencendo_60"
        | "vencendo_30"
        | "vencendo_15"
        | "vencido"
        | "encerrado"
        | "cancelado"
      contract_template_categoria:
        | "gestao_ocupacional"
        | "contrato_por_uso"
        | "contrato_por_uso_drps_lgpd"
        | "contrato_pontual"
        | "treinamentos"
        | "outros"
      fb_acao_status: "nao_iniciado" | "em_andamento" | "concluido" | "atrasado"
      fb_classificacao:
        | "insuficiente"
        | "fraco"
        | "razoavel"
        | "bom"
        | "excelente"
      fb_colaborador_status: "ativo" | "inativo" | "ferias" | "afastado"
      fb_risco: "baixo" | "medio" | "alto"
      hierarchy_position:
        | "director"
        | "manager"
        | "coordinator"
        | "leader"
        | "team_member"
      modelo_contratual: "Gestão Ocupacional" | "Parceira" | "Por Uso"
      module_app_type: "internal" | "external" | "iframe"
      notification_type:
        | "mention"
        | "new_post"
        | "new_announcement"
        | "new_document"
        | "chat_message"
        | "like"
        | "comment"
        | "aso_retificacao"
        | "aso_alerta"
      occurrence_assignee_role: "principal" | "apoio"
      occurrence_comment_type:
        | "comentario_interno"
        | "resposta_cliente"
        | "nota_status"
        | "sistema"
      occurrence_contact_origin:
        | "email"
        | "telefone"
        | "whatsapp"
        | "presencial"
        | "reuniao"
      occurrence_priority: "baixa" | "media" | "alta" | "critica"
      occurrence_sector:
        | "recepcao"
        | "enfermagem"
        | "medico"
        | "liberacao"
        | "faturamento"
        | "comercial"
        | "relacionamento"
        | "financeiro"
        | "engenharia"
        | "operacional"
        | "esocial"
        | "credenciamento"
        | "agendamento"
        | "suporte"
      occurrence_status:
        | "aberto"
        | "em_analise"
        | "em_tratativa"
        | "aguardando_retorno_interno"
        | "aguardando_cliente"
        | "resolvido"
        | "aguardando_validacao_cliente"
        | "concluido"
        | "reaberto"
      occurrence_type:
        | "reclamacao"
        | "solicitacao"
        | "duvida"
        | "sugestao"
        | "ocorrencia"
      passivo_status:
        | "em_dia"
        | "atrasado"
        | "encerrado"
        | "novo_acordo"
        | "suspenso"
      quotation_status:
        | "rascunho"
        | "aguardando_aprovacao"
        | "aprovado"
        | "rejeitado"
      sim_nao_status: "NAO_INFORMADO" | "SIM" | "NAO"
      unit_type: "lapa" | "osasco"
      user_role: "adm_master" | "adm_user" | "tech_user"
      user_status: "active" | "inactive"
      visita_status: "agendada" | "realizada" | "cancelada"
      visita_tipo:
        | "Avaliação"
        | "Coleta"
        | "Inspeção"
        | "Reunião"
        | "Treinamento"
        | "Outro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      aguardando_aso_status: [
        "NAO_INFORMADO",
        "CONTATO_REALIZADO",
        "RECEBIDO",
        "NAO_RECEBIDO",
      ],
      aso_exame_status: [
        "aguardando",
        "pendente",
        "recebido",
        "datado_soc",
        "inserido_socged",
        "concluido",
        "realizado",
        "liberado",
        "nova_coleta",
      ],
      aso_exame_tipo: ["imediato", "complementar"],
      aso_status: [
        "importado",
        "em_triagem",
        "aguardando_exames",
        "pronto_assinatura_medica",
        "em_escaneamento",
        "liberado",
        "liberado_faturamento",
        "finalizado",
        "fechado",
      ],
      aso_tipo_assinatura: ["digital", "manual"],
      aso_tipo_prontuario: ["digital", "fisico"],
      chat_type: ["direct", "department"],
      compareceu_status: [
        "NAO_INFORMADO",
        "COMPARECEU",
        "NAO_COMPARECEU",
        "REMARCADO",
        "PARCIAL",
      ],
      contract_categoria: [
        "gestao_ocupacional",
        "contrato_por_uso",
        "contrato_pontual",
        "contrato_parceiras",
        "outros",
      ],
      contract_signer_status: [
        "pendente",
        "enviado",
        "assinado",
        "recusado",
        "cancelado",
      ],
      contract_signer_type: ["representante", "testemunha_1", "testemunha_2"],
      contract_status: [
        "rascunho",
        "aguardando_assinatura",
        "parcialmente_assinado",
        "assinado",
        "ativo",
        "vencendo_60",
        "vencendo_30",
        "vencendo_15",
        "vencido",
        "encerrado",
        "cancelado",
      ],
      contract_template_categoria: [
        "gestao_ocupacional",
        "contrato_por_uso",
        "contrato_por_uso_drps_lgpd",
        "contrato_pontual",
        "treinamentos",
        "outros",
      ],
      fb_acao_status: ["nao_iniciado", "em_andamento", "concluido", "atrasado"],
      fb_classificacao: [
        "insuficiente",
        "fraco",
        "razoavel",
        "bom",
        "excelente",
      ],
      fb_colaborador_status: ["ativo", "inativo", "ferias", "afastado"],
      fb_risco: ["baixo", "medio", "alto"],
      hierarchy_position: [
        "director",
        "manager",
        "coordinator",
        "leader",
        "team_member",
      ],
      modelo_contratual: ["Gestão Ocupacional", "Parceira", "Por Uso"],
      module_app_type: ["internal", "external", "iframe"],
      notification_type: [
        "mention",
        "new_post",
        "new_announcement",
        "new_document",
        "chat_message",
        "like",
        "comment",
        "aso_retificacao",
        "aso_alerta",
      ],
      occurrence_assignee_role: ["principal", "apoio"],
      occurrence_comment_type: [
        "comentario_interno",
        "resposta_cliente",
        "nota_status",
        "sistema",
      ],
      occurrence_contact_origin: [
        "email",
        "telefone",
        "whatsapp",
        "presencial",
        "reuniao",
      ],
      occurrence_priority: ["baixa", "media", "alta", "critica"],
      occurrence_sector: [
        "recepcao",
        "enfermagem",
        "medico",
        "liberacao",
        "faturamento",
        "comercial",
        "relacionamento",
        "financeiro",
        "engenharia",
        "operacional",
        "esocial",
        "credenciamento",
        "agendamento",
        "suporte",
      ],
      occurrence_status: [
        "aberto",
        "em_analise",
        "em_tratativa",
        "aguardando_retorno_interno",
        "aguardando_cliente",
        "resolvido",
        "aguardando_validacao_cliente",
        "concluido",
        "reaberto",
      ],
      occurrence_type: [
        "reclamacao",
        "solicitacao",
        "duvida",
        "sugestao",
        "ocorrencia",
      ],
      passivo_status: [
        "em_dia",
        "atrasado",
        "encerrado",
        "novo_acordo",
        "suspenso",
      ],
      quotation_status: [
        "rascunho",
        "aguardando_aprovacao",
        "aprovado",
        "rejeitado",
      ],
      sim_nao_status: ["NAO_INFORMADO", "SIM", "NAO"],
      unit_type: ["lapa", "osasco"],
      user_role: ["adm_master", "adm_user", "tech_user"],
      user_status: ["active", "inactive"],
      visita_status: ["agendada", "realizada", "cancelada"],
      visita_tipo: [
        "Avaliação",
        "Coleta",
        "Inspeção",
        "Reunião",
        "Treinamento",
        "Outro",
      ],
    },
  },
} as const
