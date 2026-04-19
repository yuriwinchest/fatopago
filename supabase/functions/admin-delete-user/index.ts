import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Configuração do Supabase ausente.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !adminUser) {
      return new Response(JSON.stringify({ error: 'Token inválido.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: adminRoleData, error: adminRoleError } = await supabaseAdmin.rpc('is_admin_user', {
      p_user_id: adminUser.id,
    });
    if (adminRoleError) {
      return new Response(JSON.stringify({ error: 'Erro ao validar papel administrativo.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isAdmin = Array.isArray(adminRoleData) ? Boolean(adminRoleData[0]) : Boolean(adminRoleData);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const userId = String(body?.user_id ?? '').trim();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name, lastname')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message || 'Não foi possível localizar o usuário.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deletionReason = String(body?.reason || 'admin_close_account').trim();
    const targetEmail = normalizeEmail(profile?.email);

    try {
      const supabaseActor = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: closeResult, error: closeError } = await supabaseActor.rpc('close_user_account', {
        p_target_user_id: userId,
      });
      if (closeError) throw closeError;

      const status = Array.isArray(closeResult)
        ? (closeResult[0]?.status ?? 'closed')
        : (closeResult as any)?.status ?? 'closed';

      return new Response(JSON.stringify({
        mode: 'soft_delete_anonymized',
        status,
        user: {
          id: userId,
          previous_email: targetEmail || null,
          name: profile?.name || null,
          lastname: profile?.lastname || null,
        },
        reason: deletionReason,
        message: 'Conta encerrada com anonimização. Histórico financeiro preservado.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (cleanupError) {
      const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      return new Response(JSON.stringify({ error: message || 'Não foi possível limpar todos os registros do usuário.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message || 'Erro interno do servidor.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
