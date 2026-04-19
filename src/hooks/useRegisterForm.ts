import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLocation } from './useLocation';
import { buildMetaPixelDedupKey, initializeMetaPixel, trackMetaPixelEvent } from '../lib/metaPixel';
import { trackSellerFunnelEvent } from '../lib/sellerFunnel';
import {
    buildAutoPlanQueryString,
    clearStoredAutoPlanContext,
    persistAutoPlanContext,
    resolveAutoPlanContextFromSearchParams
} from '../lib/sellerMonthlyLinks';

export interface RegisterFormData {
    name: string;
    lastname: string;
    email: string;
    phone: string;
    password: string;
    state: string;
    city: string;
    acceptedTerms: boolean;
    avatar: File | null;
    cpf: string;
    birthDate: string;
}

const normalizeCpf = (value: string) => value.replace(/\D/g, '');
const normalizePhone = (value: string) => value.replace(/\D/g, '');

const isValidCpf = (value: string) => {
    const cpf = normalizeCpf(value);
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i += 1) {
        sum += Number(cpf[i]) * (10 - i);
    }
    let digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;
    if (digit !== Number(cpf[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i += 1) {
        sum += Number(cpf[i]) * (11 - i);
    }
    digit = (sum * 10) % 11;
    if (digit === 10) digit = 0;

    return digit === Number(cpf[10]);
};

const isValidRealEmail = (value: string) => {
    const email = value.trim().toLowerCase();
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
    if (!emailRegex.test(email)) return false;

    const domain = email.split('@')[1] || '';
    const blockedDomains = new Set([
        'example.com',
        'test.com',
        'mailinator.com',
        'yopmail.com',
        'tempmail.com'
    ]);

    return !blockedDomains.has(domain);
};

const isValidPhone = (value: string) => {
    const phone = normalizePhone(value);
    return phone.length === 10 || phone.length === 11;
};

const parseBirthDateToIso = (value: string): string | null => {
    const raw = value.trim();
    let day = 0;
    let month = 0;
    let year = 0;

    const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
        day = Number(brMatch[1]);
        month = Number(brMatch[2]);
        year = Number(brMatch[3]);
    } else {
        const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!isoMatch) return null;
        year = Number(isoMatch[1]);
        month = Number(isoMatch[2]);
        day = Number(isoMatch[3]);
    }

    if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) return null;

    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export function useRegisterForm() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { states, cities, loadingCities, fetchCities } = useLocation();

    // Codigo de indicacao vindo do link /convite/:code -> /register?ref=CODE
    const refFromUrl = searchParams.get('ref') || '';
    const autoPlanResolution = resolveAutoPlanContextFromSearchParams(searchParams, refFromUrl);
    const hasReferral = !!refFromUrl;
    const sellerLinkNotice = autoPlanResolution.status === 'expired' || autoPlanResolution.status === 'invalid'
        ? autoPlanResolution.message || null
        : null;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<RegisterFormData>({
        name: '',
        lastname: '',
        email: '',
        phone: '',
        password: '',
        state: '',
        city: '',
        acceptedTerms: false,
        avatar: null,
        cpf: '',
        birthDate: ''
    });

    useEffect(() => {
        if (autoPlanResolution.status === 'valid' && autoPlanResolution.context) {
            persistAutoPlanContext(autoPlanResolution.context);
            return;
        }

        if (autoPlanResolution.status === 'expired' || autoPlanResolution.status === 'invalid') {
            clearStoredAutoPlanContext();
        }
    }, [autoPlanResolution]);

    useEffect(() => {
        if (!refFromUrl) return;

        void trackSellerFunnelEvent({
            affiliateCode: refFromUrl,
            eventType: 'invite_visit',
            path: '/register',
            metadata: autoPlanResolution.status === 'valid' && autoPlanResolution.context
                ? { plan: autoPlanResolution.context.planId }
                : {}
        }).catch((error) => {
            console.warn('Falha ao rastrear visita de convite:', error);
        });
    }, [autoPlanResolution, refFromUrl]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const type = e.target.type;
        // Type assertion safe because we check type
        const checked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        if (name === 'state') {
            fetchCities(value);
            // Reset city when state changes
            setFormData(prev => ({ ...prev, city: '' }));
        }

        if (error) setError(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, avatar: e.target.files![0] }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        // Validation
        if (!formData.acceptedTerms) {
            setError("Você precisa aceitar os Termos de Uso.");
            setLoading(false);
            return;
        }

        const requiredFields: Array<keyof RegisterFormData> = [
            'name',
            'lastname',
            'email',
            'phone',
            'password',
            'state',
            'city',
            'cpf',
            'birthDate'
        ];
        const missing = requiredFields.some((field) => !String(formData[field] || '').trim());

        if (missing) {
            setError("Por favor, preencha todos os campos obrigatórios.");
            setLoading(false);
            return;
        }

        const normalizedEmail = formData.email.trim().toLowerCase();
        const normalizedCpf = normalizeCpf(formData.cpf);
        const normalizedPhone = normalizePhone(formData.phone);

        if (!isValidRealEmail(normalizedEmail)) {
            setError("Informe um e-mail válido.");
            setLoading(false);
            return;
        }

        if (!isValidPhone(normalizedPhone)) {
            setError("Informe um telefone válido com DDD.");
            setLoading(false);
            return;
        }

        if (!isValidCpf(normalizedCpf)) {
            setError("CPF inválido.");
            setLoading(false);
            return;
        }

        if ((formData.password || '').length < 8) {
            setError("A senha deve ter no mínimo 8 caracteres.");
            setLoading(false);
            return;
        }

        const birthDateIso = parseBirthDateToIso(formData.birthDate);
        if (!birthDateIso) {
            setError("Informe uma data de nascimento válida no formato DD/MM/AAAA.");
            setLoading(false);
            return;
        }

        try {
            // Best effort: check duplicate CPF before signup.
            const { data: cpfAlreadyRegistered, error: cpfLookupError } = await supabase.rpc('is_cpf_registered', {
                cpf_input: normalizedCpf
            });

            if (cpfLookupError) {
                console.warn('CPF lookup warning:', cpfLookupError);
            }

            if (cpfAlreadyRegistered === true) {
                setError('Este CPF já está cadastrado. Faça login ou recupere sua senha.');
                return;
            }

            let avatarUrl = null;

            // 1. Upload Avatar if exists
            if (formData.avatar) {
                const fileExt = formData.avatar.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, formData.avatar);

                if (uploadError) {
                    console.error('Error uploading avatar:', uploadError);
                    // Continue registration even if avatar upload fails, or handle as error
                } else {
                    const { data: publicUrlData } = supabase.storage
                        .from('avatars')
                        .getPublicUrl(filePath);
                    avatarUrl = publicUrlData.publicUrl;
                }
            }

            // 2. Create Auth User
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email: normalizedEmail,
                password: formData.password,
                options: {
                    data: {
                        name: formData.name,
                        lastname: formData.lastname,
                        city: formData.city,
                        state: formData.state,
                        phone: normalizedPhone,
                        affiliate_code: refFromUrl || null,
                        avatar_url: avatarUrl,
                        cpf: normalizedCpf,
                        birth_date: birthDateIso
                    }
                }
            });

            if (signUpError) throw signUpError;

            if (authData.user) {
                initializeMetaPixel();
                trackMetaPixelEvent(
                    'Lead',
                    {
                        content_name: 'Cadastro Fatopago',
                        status: 'completed'
                    },
                    buildMetaPixelDedupKey('lead', authData.user.id)
                );

                // 3. Force Profile Creation (Redundancy)
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert([
                        {
                            id: authData.user.id,
                            name: formData.name,
                            lastname: formData.lastname,
                            email: normalizedEmail,
                            phone: normalizedPhone,
                            city: formData.city,
                            state: formData.state,
                            affiliate_code: refFromUrl || null,
                            avatar_url: avatarUrl,
                            cpf: normalizedCpf,
                            birth_date: birthDateIso,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }
                    ], { onConflict: 'id' });

                if (profileError) {
                    console.warn('Profile upsert warning:', profileError);
                }
            }

            const loginQuery = autoPlanResolution.status === 'valid' && autoPlanResolution.context
                ? buildAutoPlanQueryString(autoPlanResolution.context, { registered: 'true' })
                : 'registered=true';
            navigate(`/login?${loginQuery}`);
        } catch (err: any) {
            const rawMsg = String(err?.message || err || '');
            const normalizedRaw = rawMsg.toLowerCase();
            let msg = rawMsg || "Erro ao criar conta. Tente novamente.";

            if (msg.includes("User already registered") || msg.includes("already registered")) {
                msg = "Este e-mail já está cadastrado. Por favor, faça login.";
            } else if (
                msg.toLowerCase().includes('cpf') ||
                msg.toLowerCase().includes('profiles_cpf') ||
                msg.toLowerCase().includes('duplicate key')
            ) {
                msg = "Este CPF já está cadastrado. Faça login ou recupere sua senha.";
            } else if (
                err?.name === 'AbortError' ||
                normalizedRaw.includes('operation was aborted') ||
                normalizedRaw.includes('the operation was aborted')
            ) {
                try {
                    // The signup request may have reached Supabase but the browser connection was interrupted.
                    // Probe login to confirm whether the account was actually created.
                    const probe = await supabase.auth.signInWithPassword({
                        email: normalizedEmail,
                        password: formData.password
                    });

                    const probeMsg = String(probe.error?.message || '').toLowerCase();
                    const accountLikelyCreated =
                        !probe.error ||
                        probeMsg.includes('email not confirmed') ||
                        probeMsg.includes('email not confirmed yet');

                    if (accountLikelyCreated) {
                        if (probe.data?.session) {
                            await supabase.auth.signOut();
                        }
                        navigate('/login?registered=true');
                        return;
                    }
                } catch (probeError) {
                    console.warn('AbortError probe failed:', probeError);
                }

                msg = "Conexão interrompida no final do cadastro. Se já recebeu e-mail de confirmação, faça login.";
            } else {
                console.error(err);
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return {
        formData,
        loading,
        error,
        states,
        cities,
        loadingCities,
        hasReferral,
        sellerLinkNotice,
        handleChange,
        handleFileChange,
        handleSubmit
    };
}
