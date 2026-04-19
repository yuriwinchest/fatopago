export const VALIDATION_CATEGORIES = [
    'Todas',
    'Política',
    'Economia',
    'Esportes',
    'Internacional',
    'Brasil',
    'Entretenimento'
] as const;

export type ValidationCategory = typeof VALIDATION_CATEGORIES[number];
export type PublishableNewsCategory = Exclude<ValidationCategory, 'Todas'>;

export const ADMIN_NEWS_CATEGORIES: PublishableNewsCategory[] =
    VALIDATION_CATEGORIES.filter(
        (category): category is PublishableNewsCategory => category !== 'Todas'
    );
