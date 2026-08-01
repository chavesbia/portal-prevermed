import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "lovable:chunk-reload";

/**
 * React.lazy com resiliência a falhas de rede/deploy novo.
 * - Tenta novamente 1x após pequeno atraso.
 * - Se ainda falhar, recarrega a página uma única vez (evita loop).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (err) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const mod = await factory();
        sessionStorage.removeItem(RELOAD_KEY);
        return mod;
      } catch (err2) {
        if (sessionStorage.getItem(RELOAD_KEY) !== "1") {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw err2;
      }
    }
  });
}
