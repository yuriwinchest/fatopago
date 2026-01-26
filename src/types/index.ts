export interface UserProfile {
    name: string;
    lastname: string;
    current_balance: number;
    reputation_score: number;
    city: string;
    state: string;
    affiliate_code: string;
    email?: string;
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
    };
    created_at: string;
    difficulty?: string;
}
