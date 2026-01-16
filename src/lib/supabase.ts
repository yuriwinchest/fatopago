import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safe client initialization
// If keys are missing, we return a mock client to prevent the app from crashing on load.
// This allows the UI to render and show an error message instead of a white screen.
export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : {
        auth: {
            signUp: async () => {
                console.error("Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
                return {
                    data: { user: null },
                    error: { message: "Erro de Configuração: Variáveis de ambiente do Supabase não encontradas. Verifique o console." }
                };
            },
            signInWithPassword: async () => {
                console.error("Supabase not configured.");
                return {
                    data: { user: null },
                    error: { message: "Erro de Configuração: Conexão com banco de dados indisponível." }
                };
            }
        }
    } as any; // Cast to any to avoid complex type mocking

if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL: Missing Supabase environment variables! Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file or Vercel project settings.');
}
