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
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

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
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
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
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const sellerId = String(body?.seller_id ?? '').trim();

    if (!sellerId) {
      return new Response(JSON.stringify({ error: 'seller_id é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: seller, error: sellerError } = await supabaseAdmin
      .from('sellers')
      .select('id, name, email, seller_code, auth_user_id')
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

    const authUserIds = new Set<string>();
    const authUserId = typeof seller.auth_user_id === 'string' ? seller.auth_user_id : null;
    if (authUserId) {
      authUserIds.add(authUserId);
    }

    const matchedAuthUsers = await findAuthUserIdsByEmail(supabaseAdmin, seller.email);
    matchedAuthUsers.forEach((id) => authUserIds.add(id));

    for (const authId of authUserIds) {
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(authId);
      if (deleteUserError && !String(deleteUserError.message || '').toLowerCase().includes('not found')) {
        return new Response(JSON.stringify({ error: deleteUserError.message || 'Não foi possível remover o login do vendedor.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', authId);
    }

    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('email', seller.email);

    const { error: deleteSellerError } = await supabaseAdmin
      .from('sellers')
      .delete()
      .eq('id', sellerId);

    if (deleteSellerError) {
      return new Response(JSON.stringify({ error: deleteSellerError.message || 'Não foi possível remover o cadastro do vendedor.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      deleted_seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        seller_code: seller.seller_code,
      },
      deleted_auth_users: Array.from(authUserIds),
      message: 'Vendedor excluído com sucesso.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message || 'Erro interno do servidor' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
