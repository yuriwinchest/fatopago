import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

async function findAuthUserIdsByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) {
  const targetEmail = normalizeEmail(email);
  if (!targetEmail) return [];

  const collected = new Set<string>();
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = Array.isArray(data?.users) ? data.users : [];
    users.forEach((authUser) => {
      if (normalizeEmail(authUser.email) === targetEmail && authUser.id) {
        collected.add(String(authUser.id));
      }
    });

    if (users.length < perPage) break;
    page += 1;
  }

  return Array.from(collected);
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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: adminRoleData, error: adminRoleError } = await supabaseAdmin.rpc('is_admin_user', {
      p_user_id: user.id,
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
    const sellerId = String(body?.seller_id ?? '').trim();
    const newPassword = String(body?.password ?? '');

    if (!sellerId) {
      return new Response(JSON.stringify({ error: 'seller_id é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'A nova senha precisa ter no mínimo 6 caracteres.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: seller, error: sellerError } = await supabaseAdmin
      .from('sellers')
      .select('id, name, email, auth_user_id')
      .eq('id', sellerId)
      .maybeSingle();

    if (sellerError) {
      return new Response(JSON.stringify({ error: sellerError.message || 'Não foi possível localizar o vendedor.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!seller) {
      return new Response(JSON.stringify({ error: 'Vendedor não encontrado.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const candidateIds = new Set<string>();
    if (typeof seller.auth_user_id === 'string' && seller.auth_user_id) {
      candidateIds.add(seller.auth_user_id);
    }

    const matchedByEmail = await findAuthUserIdsByEmail(supabaseAdmin, seller.email);
    matchedByEmail.forEach((id) => candidateIds.add(id));

    let authUserId = Array.from(candidateIds)[0] || null;

    if (!authUserId) {
      const { data: createdAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: seller.email,
        password: newPassword,
        email_confirm: true,
      });

      if (createAuthError || !createdAuthUser?.user?.id) {
        return new Response(JSON.stringify({ error: createAuthError?.message || 'Não foi possível recriar o login do vendedor.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      authUserId = createdAuthUser.user.id;
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      password: newPassword,
      email_confirm: true,
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message || 'Não foi possível redefinir a senha.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (seller.auth_user_id !== authUserId) {
      await supabaseAdmin
        .from('sellers')
        .update({ auth_user_id: authUserId })
        .eq('id', seller.id);
    }

    return new Response(JSON.stringify({
      message: 'Senha do vendedor redefinida com sucesso.',
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
      },
      auth_user_id: authUserId,
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
