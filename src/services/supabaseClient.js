import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'tbm_supabase_url';
const STORAGE_KEY_KEY = 'tbm_supabase_anon_key';

/**
 * Get current Supabase credentials from LocalStorage or Vite .env
 */
export function getSupabaseConfig() {
  try {
    const lsUrl = localStorage.getItem(STORAGE_KEY_URL);
    const lsKey = localStorage.getItem(STORAGE_KEY_KEY);

    const envUrl = import.meta.env?.VITE_SUPABASE_URL || '';
    const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

    const url = (lsUrl || envUrl || '').trim();
    const anonKey = (lsKey || envKey || '').trim();

    return { url, anonKey, isConfigured: Boolean(url && anonKey) };
  } catch {
    return { url: '', anonKey: '', isConfigured: false };
  }
}

/**
 * Save Supabase credentials to LocalStorage
 */
export function saveSupabaseConfig(url, anonKey) {
  try {
    if (url) {
      localStorage.setItem(STORAGE_KEY_URL, url.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_URL);
    }

    if (anonKey) {
      localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_KEY);
    }

    // Reset singleton instance
    cachedClient = null;
    return true;
  } catch (e) {
    console.error('Failed to save Supabase credentials:', e);
    return false;
  }
}

export function isSupabaseConfigured() {
  const { isConfigured } = getSupabaseConfig();
  return isConfigured;
}

let cachedClient = null;

/**
 * Get or create Supabase client instance
 */
export function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return cachedClient;
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
    return null;
  }
}

/**
 * Test connection to Supabase database
 */
export async function testSupabaseConnection(customUrl, customKey) {
  const url = (customUrl || getSupabaseConfig().url || '').trim();
  const anonKey = (customKey || getSupabaseConfig().anonKey || '').trim();

  if (!url || !anonKey) {
    return { success: false, message: 'กรุณากรอก Supabase Project URL และ Anon Key' };
  }

  try {
    const testClient = createClient(url, anonKey);
    const { error } = await testClient
      .from('ring_logs')
      .select('ring_number')
      .limit(1);

    if (error) {
      // If table does not exist, hint user to run SQL schema
      if (error.code === '42P01' || error.message.includes('relation "public.ring_logs" does not exist')) {
        return { 
          success: false, 
          tableMissing: true,
          message: 'เชื่อมต่อสำเร็จ แต่ยังไม่ได้สร้างตาราง (กรุณา Copy SQL Schema ไปรันใน Supabase SQL Editor)' 
        };
      }
      return { success: false, message: `Supabase Error: ${error.message} (${error.code || 'ERR'})` };
    }

    return { success: true, message: 'เชื่อมต่อฐานข้อมูล Supabase Cloud สำเร็จ 100%!' };
  } catch (e) {
    return { success: false, message: `Connection Error: ${e.message}` };
  }
}
