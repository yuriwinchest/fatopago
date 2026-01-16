import { createClient } from '@supabase/supabase-js';

// TODO: Revert to env vars after confirming deployment stability
const supabaseUrl = "https://raxjzfvunjxqbxswuipp.supabase.co";
const supabaseKey = "sb_publishable_V9cclrMml7jD7GF_8q_r2w_477uS_76";

console.log("Supabase Client Initialized with Hardcoded Values");

// Safe client initialization
let supabaseClient;

if (supabaseUrl && supabaseKey) {
    try {
        supabaseClient = createClient(supabaseUrl, supabaseKey);
    } catch (e) {
        console.error("Failed to initialize Supabase client:", e);
    }
}

if (!supabaseClient) {
    console.error('CRITICAL: Missing or Invalid Supabase environment variables! Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    // Mock client to prevent app crash
    supabaseClient = {
        auth: {
            signUp: async () => {
                console.error("Supabase not configured.");
                return { 
                    data: { user: null }, 
                    error: { message: "Erro de Configuração: Variáveis de ambiente não encontradas." } 
                };
            },
            signInWithPassword: async () => {
                 console.error("Supabase not configured.");
                 return {
                    data: { user: null },
                    error: { message: "Erro de Configuração: Banco de dados indisponível." }
                 };
            },
            signOut: async () => ({ error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            getSession: async () => ({ data: { session: null }, error: null }),
        }
    } as any;
}

export const supabase = supabaseClient;
