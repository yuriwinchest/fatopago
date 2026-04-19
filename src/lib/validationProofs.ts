import { supabase } from './supabase';

export const VALIDATION_PROOFS_BUCKET = 'validation-proofs';
export const VALIDATION_PROOF_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,image/avif,image/heic,image/heif';
export const MIN_FALSE_JUSTIFICATION_LENGTH = 10;
export const MAX_VALIDATION_PROOF_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_VALIDATION_PROOF_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/avif',
    'image/heic',
    'image/heif'
]);

export interface FalseValidationEvidenceInput {
    justification: string;
    proofLink: string;
    proofFile: File | null;
}

export interface ValidatedFalseEvidenceInput {
    justification: string;
    proofLink: string;
    proofFile: File;
}

const inferFileExtension = (file: File) => {
    const name = String(file.name || '');
    const directExt = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
    if (directExt) return directExt;

    const mimeMap: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/webp': 'webp',
        'image/avif': 'avif',
        'image/heic': 'heic',
        'image/heif': 'heif'
    };

    return mimeMap[file.type] || 'jpg';
};

export const normalizeProofLink = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export const validateFalseEvidenceInput = (
    input: FalseValidationEvidenceInput
): { ok: true; data: ValidatedFalseEvidenceInput } | { ok: false; error: string } => {
    const justification = String(input.justification || '').trim();
    const proofLink = normalizeProofLink(String(input.proofLink || ''));
    const proofFile = input.proofFile;

    if (justification.length < MIN_FALSE_JUSTIFICATION_LENGTH) {
        return {
            ok: false,
            error: `Para validar como falsa, informe uma justificativa com pelo menos ${MIN_FALSE_JUSTIFICATION_LENGTH} caracteres.`
        };
    }

    if (!proofLink) {
        return {
            ok: false,
            error: 'Para validar como falsa, informe o link da fonte ou da prova.'
        };
    }

    if (proofLink.includes(' ')) {
        return {
            ok: false,
            error: 'O link de prova não pode conter espaços.'
        };
    }

    if (!/^https?:\/\//i.test(proofLink)) {
        return {
            ok: false,
            error: 'O link de prova precisa começar com http:// ou https://.'
        };
    }

    if (!proofFile) {
        return {
            ok: false,
            error: 'Para validar como falsa, anexe uma foto da evidência.'
        };
    }

    if (!ALLOWED_VALIDATION_PROOF_TYPES.has(proofFile.type)) {
        return {
            ok: false,
            error: 'A foto deve estar em PNG, JPG, WEBP, AVIF, HEIC ou HEIF.'
        };
    }

    if (proofFile.size > MAX_VALIDATION_PROOF_IMAGE_BYTES) {
        return {
            ok: false,
            error: 'A foto de prova deve ter no máximo 5 MB.'
        };
    }

    return {
        ok: true,
        data: {
            justification,
            proofLink,
            proofFile
        }
    };
};

export const uploadValidationProofImage = async (file: File) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user?.id) {
        throw new Error('Sua sessão expirou. Faça login novamente para enviar a foto de prova.');
    }

    const extension = inferFileExtension(file);
    const filePath = `${userData.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from(VALIDATION_PROOFS_BUCKET)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError || !uploadData?.path) {
        throw new Error('Não foi possível enviar a foto de prova. Tente novamente.');
    }

    const { data: publicUrlData } = supabase.storage
        .from(VALIDATION_PROOFS_BUCKET)
        .getPublicUrl(uploadData.path);

    if (!publicUrlData?.publicUrl) {
        throw new Error('A foto foi enviada, mas não foi possível gerar a URL pública da prova.');
    }

    return publicUrlData.publicUrl;
};
