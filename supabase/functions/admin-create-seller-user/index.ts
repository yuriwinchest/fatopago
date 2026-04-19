import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

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
    const name = String(body?.name ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');
    const phone = body?.phone ? String(body.phone).trim() : null;
    const cpf = body?.cpf ? String(body.cpf).replace(/\D/g, '').trim() : null;
    const notes = body?.notes ? String(body.notes).trim() : null;
    const avatar_url = body?.avatar_url ? String(body.avatar_url).trim() : null;

    if (name.length < 3) {
      return new Response(JSON.stringify({ error: 'Informe um nome válido para o vendedor.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Informe um e-mail válido para o vendedor.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'A senha precisa ter no mínimo 6 caracteres.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isValidCpf = (value: string) => {
      if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;

      let sum = 0;
      for (let i = 0; i < 9; i += 1) {
        sum += Number(value[i]) * (10 - i);
      }

      let digit = (sum * 10) % 11;
      if (digit === 10) digit = 0;
      if (digit !== Number(value[9])) return false;

      sum = 0;
      for (let i = 0; i < 10; i += 1) {
        sum += Number(value[i]) * (11 - i);
      }

      digit = (sum * 10) % 11;
      if (digit === 10) digit = 0;
      return digit === Number(value[10]);
    };

    if (!cpf) {
      return new Response(JSON.stringify({ error: 'CPF do vendedor é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isValidCpf(cpf)) {
      return new Response(JSON.stringify({ error: 'Informe um CPF válido para o vendedor.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let createdUserId: string | null = null;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message || 'Não foi possível criar o usuário.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    createdUserId = authData?.user?.id ?? null;

    const { data: sellerData, error: sellerError } = await supabaseUser.rpc('admin_create_seller', {
      p_name: name,
      p_email: email,
      p_phone: phone || null,
      p_notes: notes || null,
      p_avatar_url: avatar_url || null,
      p_cpf: cpf || null,
    });

    if (sellerError) {
      if (createdUserId) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      }
      return new Response(JSON.stringify({ error: sellerError.message || 'Não foi possível criar o vendedor.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const seller = Array.isArray(sellerData) ? sellerData[0] : sellerData;

    if (seller?.id && createdUserId) {
      const { error: linkError } = await supabaseAdmin
        .from('sellers')
        .update({ auth_user_id: createdUserId })
        .eq('id', seller.id);

      if (linkError) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        await supabaseAdmin.from('sellers').delete().eq('id', seller.id);

        return new Response(JSON.stringify({ error: linkError.message || 'Não foi possível vincular o login ao vendedor.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: profileError } = await supabaseAdmin.rpc('ensure_profile_for_auth_user', {
        p_user_id: createdUserId,
        p_fallback_name: name,
        p_fallback_email: email,
        p_fallback_phone: phone || null,
      });

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        await supabaseAdmin.from('sellers').delete().eq('id', seller.id);

        return new Response(JSON.stringify({ error: profileError.message || 'Não foi possível preparar o perfil financeiro do vendedor.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({
      seller,
      auth_user_id: createdUserId,
      message: 'Vendedor criado com usuário e senha iniciais.',
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
