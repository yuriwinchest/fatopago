import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildDisabledEmail(userId: string) {
  const normalized = String(userId).replace(/[^a-zA-Z0-9]/g, '');
  return `deleted+${normalized}@anon.fatopago.local`;
}

function buildStrongRandomPassword() {
  const left = crypto.randomUUID().replace(/-/g, '');
  const right = crypto.randomUUID().replace(/-/g, '');
  return `${left}Aa!1${right}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: hasHistoryData, error: hasHistoryError } = await supabaseAdmin.rpc('user_has_financial_history', {
      p_user_id: user.id,
    });
    if (hasHistoryError) throw hasHistoryError;

    const hasFinancialHistory = Array.isArray(hasHistoryData)
      ? Boolean(hasHistoryData[0])
      : Boolean(hasHistoryData);

    if (hasFinancialHistory) {
      const { data: anonymizeData, error: anonymizeError } = await supabaseAdmin.rpc('anonymize_profile_account', {
        p_user_id: user.id,
        p_reason: 'self_delete_with_financial_history',
        p_actor_user_id: user.id,
      });
      if (anonymizeError) throw anonymizeError;

      const anonymizedEmail = String(
        (anonymizeData && typeof anonymizeData === 'object' && (anonymizeData as any).anonymized_email) ||
        buildDisabledEmail(user.id),
      );

      const payload: Record<string, unknown> = {
        email: anonymizedEmail,
        password: buildStrongRandomPassword(),
        user_metadata: {
          account_status: 'deleted',
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        },
        ban_duration: '876000h',
      };
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, payload as any);
      if (updateError && !String(updateError.message || '').toLowerCase().includes('user not found')) {
        throw updateError;
      }

      return new Response(JSON.stringify({
        mode: 'anonymized',
        message: 'Conta anonimizada e bloqueada. Histórico financeiro preservado.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({
      mode: 'hard_deleted',
      message: 'Conta excluída com sucesso.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
