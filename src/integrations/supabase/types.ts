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
        ]
      }
      aso_exames_atendimento: {
        Row: {
          atendimento_id: string
          created_at: string
          data_conclusao: string | null
          data_datado_soc: string | null
          data_inserido_socged: string | null
          data_recebimento: string | null
          id: string
          nome_exame: string
          observacao: string | null
          status: Database["public"]["Enums"]["aso_exame_status"]
          tipo: Database["public"]["Enums"]["aso_exame_tipo"]
          updated_at: string
        }
        Insert: {
          atendimento_id: string
          created_at?: string
          data_conclusao?: string | null
          data_datado_soc?: string | null
          data_inserido_socged?: string | null
          data_recebimento?: string | null
          id?: string
          nome_exame: string
          observacao?: string | null
          status?: Database["public"]["Enums"]["aso_exame_status"]
          tipo?: Database["public"]["Enums"]["aso_exame_tipo"]
          updated_at?: string
        }
        Update: {
          atendimento_id?: string
          created_at?: string
          data_conclusao?: string | null
          data_datado_soc?: string | null
          data_inserido_socged?: string | null
          data_recebimento?: string | null
          id?: string
          nome_exame?: string
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
      chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          chat_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          chat_type: Database["public"]["Enums"]["chat_type"]
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          chat_type?: Database["public"]["Enums"]["chat_type"]
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          chat_type?: Database["public"]["Enums"]["chat_type"]
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      client_attachments: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          file_name: string | null
          file_url: string
          id: string
          type: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_url: string
          id?: string
          type: string
        }
        Update: {
          client_id?: string
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
        ]
      }
      commercial_clients: {
        Row: {
          active_lives: number | null
          approval_date: string | null
          city: string | null
          cnpj: string | null
          company_name: string
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
            foreignKeyName: "mentions_chat_message_id_fkey"
            columns: ["chat_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "profiles"
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
          is_primary: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          is_primary?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
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
      [_ in never]: never
    }
    Functions: {
      aso_build_atendimento_timestamp: {
        Args: { _data: string; _hora: string }
        Returns: string
      }
      aso_status_to_stage: {
        Args: { _status: Database["public"]["Enums"]["aso_status"] }
        Returns: string
      }
      can_approve_module_route: {
        Args: { _route: string; _user_id: string }
        Returns: boolean
      }
      can_edit_module_route: {
        Args: { _route: string; _user_id: string }
        Returns: boolean
      }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_adm_master: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_user_in_chat: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_in_department: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
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
        | "pendente"
        | "recebido"
        | "datado_soc"
        | "inserido_socged"
        | "concluido"
        | "realizado"
        | "liberado"
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
      hierarchy_position:
        | "director"
        | "manager"
        | "coordinator"
        | "leader"
        | "team_member"
      module_app_type: "internal" | "external" | "iframe"
      notification_type:
        | "mention"
        | "new_post"
        | "new_announcement"
        | "new_document"
        | "chat_message"
        | "like"
        | "comment"
      quotation_status:
        | "rascunho"
        | "aguardando_aprovacao"
        | "aprovado"
        | "rejeitado"
      sim_nao_status: "NAO_INFORMADO" | "SIM" | "NAO"
      unit_type: "lapa" | "osasco"
      user_role: "adm_master" | "adm_user" | "tech_user"
      user_status: "active" | "inactive"
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
        "pendente",
        "recebido",
        "datado_soc",
        "inserido_socged",
        "concluido",
        "realizado",
        "liberado",
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
      hierarchy_position: [
        "director",
        "manager",
        "coordinator",
        "leader",
        "team_member",
      ],
      module_app_type: ["internal", "external", "iframe"],
      notification_type: [
        "mention",
        "new_post",
        "new_announcement",
        "new_document",
        "chat_message",
        "like",
        "comment",
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
    },
  },
} as const
