import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLocation } from './useLocation';

export interface RegisterFormData {
    name: string;
    lastname: string;
    email: string;
    password: string;
    state: string;
    city: string;
    affiliateCode: string;
    acceptedTerms: boolean;
}

export function useRegisterForm() {
    const navigate = useNavigate();
    const { states, cities, loadingCities, fetchCities } = useLocation();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<RegisterFormData>({
        name: '',
        lastname: '',
        email: '',
        password: '',
        state: '',
        city: '',
        affiliateCode: '',
        acceptedTerms: false
    });

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

        const required = ['name', 'lastname', 'email', 'password', 'state', 'city'];
        const missing = required.some(field => !formData[field as keyof RegisterFormData]);

        if (missing) {
            setError("Por favor, preencha todos os campos obrigatórios.");
            setLoading(false);
            return;
        }

        try {
            // 1. Create Auth User
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        name: formData.name,
                        lastname: formData.lastname,
                        city: formData.city,
                        state: formData.state,
                        affiliate_code: formData.affiliateCode || null
                    }
                }
            });

            if (signUpError) throw signUpError;

            if (authData.user) {
                // 2. Force Profile Creation (Redundancy)
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert([
                        {
                            id: authData.user.id,
                            name: formData.name,
                            lastname: formData.lastname,
                            city: formData.city,
                            state: formData.state,
                            affiliate_code: formData.affiliateCode || null,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }
                    ], { onConflict: 'id' });

                if (profileError) {
                    console.warn('Profile upsert warning:', profileError);
                }
            }

            navigate('/login?registered=true');
        } catch (err: any) {
            let msg = err.message || "Erro ao criar conta. Tente novamente.";
            if (msg.includes("User already registered") || msg.includes("already registered")) {
                msg = "Este e-mail já está cadastrado. Por favor, faça login.";
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
        handleChange,
        handleSubmit
    };
}
