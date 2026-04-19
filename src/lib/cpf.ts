export const normalizeCpf = (value: string) => value.replace(/\D/g, '');

export const isValidCpf = (value: string) => {
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

export const formatCpf = (value?: string | null) => {
    const cpf = normalizeCpf(String(value || ''));
    if (cpf.length !== 11) return value || '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};
