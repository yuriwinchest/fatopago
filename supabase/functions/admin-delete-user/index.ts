import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

async function deleteByUserIds(
  supabaseAdmin: ReturnType<typeof createClient>,
  table: string,
  column: string,
  userIds: string[],
) {
  if (!userIds.length) return;
  const { error } = await supabaseAdmin.from(table).delete().in(column, userIds);
  if (error) throw error;
}

async function countRowsByUserId(
  supabaseAdmin: ReturnType<typeof createClient>,
  table: string,
  userId: string,
) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', userId);
  if (error) throw error;
  return Number(count || 0);
}

async function hasFinancialHistory(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
) {
  const [ledgerCount, txCount, pixPaymentsCount, pixWithdrawalsCount, planPurchasesCount] = await Promise.all([
    countRowsByUserId(supabaseAdmin, 'financial_ledger', userId),
    countRowsByUserId(supabaseAdmin, 'transactions', userId),
    countRowsByUserId(supabaseAdmin, 'pix_payments', userId),
    countRowsByUserId(supabaseAdmin, 'pix_withdrawals', userId),
    countRowsByUserId(supabaseAdmin, 'plan_purchases', userId),
  ]);

  return (ledgerCount + txCount + pixPaymentsCount + pixWithdrawalsCount + planPurchasesCount) > 0;
}

function buildDisabledEmail(userId: string) {
  const normalized = String(userId).replace(/[^a-zA-Z0-9]/g, '');
  return `deleted+${normalized}@anon.fatopago.local`;
}

function buildStrongRandomPassword() {
  const left = crypto.randomUUID().replace(/-/g, '');
  const right = crypto.randomUUID().replace(/-/g, '');
  return `${left}Aa!1${right}`;
}

async function disableAuthUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  deletedEmail: string,
  actorUserId: string,
) {
  const payload: Record<string, unknown> = {
    email: deletedEmail,
    password: buildStrongRandomPassword(),
    user_metadata: {
      account_status: 'deleted',
      deleted_at: new Date().toISOString(),
      deleted_by: actorUserId,
    },
    ban_duration: '876000h',
  };

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, payload as any);
  if (error && !String(error.message || '').toLowerCase().includes('user not found')) {
    throw error;
  }
}

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
      .select('id, email, name, lastname, is_deleted, deleted_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message || 'Não foi possível localizar o usuário.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deletionReason = String(body?.reason || 'admin_delete_user').trim();
    const targetEmail = normalizeEmail(profile?.email);
    const hasHistory = await hasFinancialHistory(supabaseAdmin, userId);

    try {
      if (hasHistory) {
        const { data: anonymizeData, error: anonymizeError } = await supabaseAdmin.rpc('anonymize_profile_account', {
          p_user_id: userId,
          p_reason: deletionReason,
          p_actor_user_id: adminUser.id,
        });
        if (anonymizeError) throw anonymizeError;

        const anonymizedEmail = String(
          (anonymizeData && typeof anonymizeData === 'object' && (anonymizeData as any).anonymized_email) ||
          buildDisabledEmail(userId),
        );

        await disableAuthUser(supabaseAdmin, userId, anonymizedEmail, adminUser.id);

        return new Response(JSON.stringify({
          mode: 'anonymized',
          preserved_ledger: true,
          user: {
            id: userId,
            previous_email: targetEmail || null,
            anonymized_email: anonymizedEmail,
          },
          message: 'Usuário anonimizado e bloqueado. Histórico financeiro preservado.',
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const targetIds = [userId];
      await deleteByUserIds(supabaseAdmin, 'validations', 'user_id', targetIds);
      await deleteByUserIds(supabaseAdmin, 'user_cycles', 'user_id', targetIds);
      await deleteByUserIds(supabaseAdmin, 'plan_purchases', 'user_id', targetIds);
      await deleteByUserIds(supabaseAdmin, 'pix_payments', 'user_id', targetIds);
      await deleteByUserIds(supabaseAdmin, 'pix_withdrawals', 'user_id', targetIds);
      await deleteByUserIds(supabaseAdmin, 'transactions', 'user_id', targetIds);
      await deleteByUserIds(supabaseAdmin, 'seller_contact_messages', 'user_id', targetIds);

      const { error: referralsByReferredError } = await supabaseAdmin
        .from('referrals')
        .delete()
        .eq('referred_id', userId);
      if (referralsByReferredError) throw referralsByReferredError;

      const { error: referralsByReferrerError } = await supabaseAdmin
        .from('referrals')
        .delete()
        .eq('referrer_id', userId);
      if (referralsByReferrerError) throw referralsByReferrerError;

      const { error: commissionsByReferredError } = await supabaseAdmin
        .from('commissions')
        .delete()
        .eq('referred_id', userId);
      if (commissionsByReferredError) throw commissionsByReferredError;

      const { error: commissionsByReferrerError } = await supabaseAdmin
        .from('commissions')
        .delete()
        .eq('referrer_id', userId);
      if (commissionsByReferrerError) throw commissionsByReferrerError;

      const { error: deleteProfileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId);
      if (deleteProfileError) throw deleteProfileError;

      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteUserError && !String(deleteUserError.message || '').toLowerCase().includes('not found')) {
        throw deleteUserError;
      }
    } catch (cleanupError) {
      const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      return new Response(JSON.stringify({ error: message || 'Não foi possível limpar todos os registros do usuário.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      mode: 'hard_deleted',
      deleted_user: {
        id: userId,
        email: targetEmail || null,
        name: profile?.name || null,
        lastname: profile?.lastname || null,
      },
      message: 'Usuário excluído fisicamente (sem histórico financeiro).',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message || 'Erro interno do servidor.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
