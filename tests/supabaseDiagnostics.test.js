import test from 'node:test';
import assert from 'node:assert/strict';
import { describeSupabaseError, supabaseProjectDashboardUrl } from '../src/services/supabaseDiagnostics.js';

test('network failures explain the project URL and preserve ordinary API errors', () => {
  const url='https://abcdefghijklmnopqrst.supabase.co';
  assert.match(describeSupabaseError({message:'TypeError: Failed to fetch'},url),/abcdefghijklmnopqrst\.supabase\.co/);
  assert.match(describeSupabaseError({message:'TypeError: Failed to fetch'},url),/Paused\/Deleted/);
  assert.equal(describeSupabaseError({message:'Invalid API key'},url),'Invalid API key');
});

test('dashboard link uses a valid Supabase project host only', () => {
  assert.equal(supabaseProjectDashboardUrl('https://abcdefghijklmnopqrst.supabase.co/'),'https://supabase.com/dashboard/project/abcdefghijklmnopqrst');
  assert.equal(supabaseProjectDashboardUrl('https://example.com'),'https://supabase.com/dashboard');
});
