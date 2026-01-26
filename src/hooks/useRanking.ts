import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Profile {
    id: string;
    name: string;
    lastname: string;
    reputation_score: number;
    city: string;
    state: string;
}

const MOCK_PROFILES = [
    { id: '1', name: 'Ana', lastname: 'Silva', reputation_score: 985, city: 'São Paulo', state: 'SP' },
    { id: '2', name: 'Carlos', lastname: 'Oliveira', reputation_score: 950, city: 'Rio de Janeiro', state: 'RJ' },
    { id: '3', name: 'Marcos', lastname: 'Souza', reputation_score: 920, city: 'Belo Horizonte', state: 'MG' },
    { id: '4', name: 'Julia', lastname: 'Mendes', reputation_score: 890, city: 'Curitiba', state: 'PR' },
    { id: '5', name: 'Roberto', lastname: 'Lima', reputation_score: 850, city: 'Salvador', state: 'BA' },
];

export function useRanking() {
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [scope, setScope] = useState<'city' | 'state' | 'national'>('national');

    useEffect(() => {
        const fetchRanking = async () => {
            setLoading(true);
            try {
                // In a real app, we would apply filters based on user location + scope here
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, name, lastname, reputation_score, city, state')
                    .order('reputation_score', { ascending: false })
                    .limit(50);

                if (error) console.error(error);

                if (!data || data.length === 0) {
                    setProfiles(MOCK_PROFILES);
                } else {
                    // Padding logic for demo
                    if (data.length < 3) {
                        const padded = [...data, ...MOCK_PROFILES.slice(0, 5 - data.length).map(p => ({ ...p, id: `mock-${p.id}` }))];
                        setProfiles(padded as any);
                    } else {
                        setProfiles(data);
                    }
                }
            } catch (err) {
                console.error(err);
                setProfiles(MOCK_PROFILES);
            } finally {
                setLoading(false);
            }
        };

        fetchRanking();
    }, [scope]);

    return {
        profiles,
        scope,
        setScope,
        loading
    };
}
