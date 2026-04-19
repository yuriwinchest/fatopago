import { useCallback, useState } from 'react';
import { BRAZIL_STATES, BrazilState } from '../lib/brazilStates';

interface Municipio {
    id: number;
    nome: string;
}

export function useLocation() {
    const [states] = useState<BrazilState[]>(BRAZIL_STATES);
    const [cities, setCities] = useState<Municipio[]>([]);
    const [loadingCities, setLoadingCities] = useState(false);

    const fetchCities = useCallback(async (uf: string) => {
        if (!uf) {
            setCities([]);
            return;
        }

        setLoadingCities(true);
        try {
            const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
            if (!response.ok) throw new Error("IBGE API Error");
            const data = await response.json();
            setCities(data);
        } catch (error) {
            console.error('Error fetching cities:', error);
            setCities([]);
        } finally {
            setLoadingCities(false);
        }
    }, []);

    return {
        states,
        cities,
        loadingStates: false,
        loadingCities,
        fetchCities
    };
}
