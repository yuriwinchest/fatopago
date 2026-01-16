import { useState, useEffect } from 'react';

interface Estado {
    id: number;
    sigla: string;
    nome: string;
}

interface Municipio {
    id: number;
    nome: string;
}

export function useLocation() {
    const [states, setStates] = useState<Estado[]>([]);
    const [cities, setCities] = useState<Municipio[]>([]);
    const [loadingStates, setLoadingStates] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);

    // Fetch States on mount
    useEffect(() => {
        async function fetchStates() {
            setLoadingStates(true);
            try {
                const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
                const data = await response.json();
                setStates(data);
            } catch (error) {
                console.error('Error fetching states:', error);
            } finally {
                setLoadingStates(false);
            }
        }

        fetchStates();
    }, []);

    // Function to fetch cities for a selected state
    const fetchCities = async (uf: string) => {
        if (!uf) {
            setCities([]);
            return;
        }

        setLoadingCities(true);
        try {
            const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
            const data = await response.json();
            setCities(data);
        } catch (error) {
            console.error('Error fetching cities:', error);
            setCities([]);
        } finally {
            setLoadingCities(false);
        }
    };

    return {
        states,
        cities,
        loadingStates,
        loadingCities,
        fetchCities
    };
}
