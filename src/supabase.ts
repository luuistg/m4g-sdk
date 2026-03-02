import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gfuldfbbwdjfetjfvkti.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWxkZmJid2RqZmV0amZ2a3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDQ1MzMsImV4cCI6MjA4NzcyMDUzM30.E_5di-Fh0oKZf8ODC1Y-V21bWuoG1eDKtFuKXevjtp0';

export const supabase = createClient(supabaseUrl, supabaseKey);