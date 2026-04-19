import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const notConfiguredError = { message: 'Erro de Configuração: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.' };

const createQueryStub = () => {
    const result = Promise.resolve({ data: null, error: notConfiguredError });

    const chain: any = new Proxy(
        {},
        {
            get: (_target, prop) => {
                if (prop === 'then') return result.then.bind(result);
                return (..._args: any[]) => chain;
            }
        }
    );

    return chain;
};

export const supabase =
    supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey)
        : ({
              auth: {
                  signUp: async () => ({ data: { user: null, session: null }, error: notConfiguredError }),
                  signInWithPassword: async () => ({ data: { user: null, session: null }, error: notConfiguredError }),
                  signOut: async () => ({ error: null }),
                  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                  getSession: async () => ({ data: { session: null }, error: null }),
                  getUser: async () => ({ data: { user: null }, error: notConfiguredError })
              },
              from: () => createQueryStub(),
              rpc: async () => ({ data: null, error: notConfiguredError }),
              functions: {
                  invoke: async () => ({ data: null, error: notConfiguredError })
              }
          } as any);
