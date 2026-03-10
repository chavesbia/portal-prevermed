import { useState, useCallback } from "react";

const STORAGE_KEY = "quotation-form-draft";

interface FormData {
  selectedItems: any[];
  clientName: string;
  notes: string;
  discountPercent: number;
  discountValue: number;
  custosAdicionais: any;
  lastSaved: string;
}

export function useFormPersistence() {
  const [isRestored, setIsRestored] = useState(false);

  const saveDraft = useCallback((data: Omit<FormData, "lastSaved">) => {
    try {
      const draft: FormData = {
        ...data,
        lastSaved: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch (error) {
      console.error("Erro ao salvar rascunho:", error);
    }
  }, []);

  const loadDraft = useCallback((): FormData | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error("Erro ao carregar rascunho:", error);
    }
    return null;
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Erro ao limpar rascunho:", error);
    }
  }, []);

  const hasDraft = useCallback((): boolean => {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }, []);

  return {
    saveDraft,
    loadDraft,
    clearDraft,
    hasDraft,
    isRestored,
    setIsRestored,
  };
}
