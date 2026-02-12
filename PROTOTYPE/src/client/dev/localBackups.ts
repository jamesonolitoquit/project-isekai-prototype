// Local backups using localStorage

export function saveBackup(key: string, data: any): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`backup_${key}`, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save backup:', e);
  }
}

export function loadBackup(key: string): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(`backup_${key}`);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error('Failed to load backup:', e);
    return null;
  }
}

export function listBackups(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('backup_')) {
        keys.push(key.replace('backup_', ''));
      }
    }
    return keys;
  } catch (e) {
    console.error('Failed to list backups:', e);
    return [];
  }
}

export function deleteBackup(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`backup_${key}`);
  } catch (e) {
    console.error('Failed to delete backup:', e);
  }
}
