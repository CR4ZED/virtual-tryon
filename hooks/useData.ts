import { useEffect, useState } from 'react';
import { getSettings, listPhotos, onDataChange, type PhotoRecord, type Settings } from '@/lib/db';

export function usePhotos(): PhotoRecord[] | null {
  const [photos, setPhotos] = useState<PhotoRecord[] | null>(null);
  useEffect(() => {
    const load = () => void listPhotos().then(setPhotos);
    load();
    return onDataChange('photos', load);
  }, []);
  return photos;
}

export function useSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    const load = () => void getSettings().then(setSettings);
    load();
    return onDataChange('settings', load);
  }, []);
  return settings;
}
