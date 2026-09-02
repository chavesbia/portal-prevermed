import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Pré-carrega signed URLs assim que os dados chegam, evitando bloqueio de
 * pop-up ao abrir o arquivo em nova aba no clique do usuário.
 */
export function useSignedUrls(bucket: string, paths: (string | null | undefined)[], expiresIn = 3600) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.filter(Boolean).join('|');

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split('|') : [];
    if (!list.length) { setUrls({}); return; }
    (async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(list, expiresIn);
      if (cancelled || error || !data) return;
      const map: Record<string, string> = {};
      data.forEach((item: any) => {
        if (item.signedUrl && item.path) map[item.path] = item.signedUrl;
      });
      setUrls(map);
    })();
    return () => { cancelled = true; };
  }, [bucket, key, expiresIn]);

  return urls;
}

export function openSignedUrl(url: string | undefined) {
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
