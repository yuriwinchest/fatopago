export interface UserProfile {
    name: string;
    lastname: string;
    current_balance: number;
    compensatory_credit_balance?: number;
    reputation_score: number;
    city: string;
    state: string;
    affiliate_code: string;
    email?: string;
    phone?: string;
    cpf?: string | null;
    birth_date?: string | null;
    plan_status?: 'none' | 'active' | 'expired';
    referral_code?: string;
    referral_active?: boolean;
    avatar_url?: string;
}

export interface NewsTask {
    id: string;
    content: {
        title: string;
        description: string;
        reward: number;
        category: string;
        source: string;
        difficulty: string;
        image_url?: string;
        link?: string;
        full_text?: string;
    };
    created_at: string;
    difficulty?: string;
}
