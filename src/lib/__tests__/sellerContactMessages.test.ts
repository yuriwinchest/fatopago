import {
    buildDefaultSellerContactMessage,
    buildSellerContactExcerpt,
    getSellerContactStatusLabel
} from '../sellerContactMessages';

describe('sellerContactMessages helpers', () => {
    it('monta a mensagem padrão com o nome do vendedor quando disponível', () => {
        expect(buildDefaultSellerContactMessage('Equipe Yuri')).toContain('Equipe Yuri');
    });

    it('resume mensagens longas sem quebrar mensagens curtas', () => {
        expect(buildSellerContactExcerpt('mensagem curta', 40)).toBe('mensagem curta');
        expect(buildSellerContactExcerpt('a'.repeat(200), 20)).toHaveLength(20);
    });

    it('mapeia o status para rótulos legíveis', () => {
        expect(getSellerContactStatusLabel('new')).toBe('Novo');
        expect(getSellerContactStatusLabel('contacted')).toBe('Em contato');
        expect(getSellerContactStatusLabel('enabled')).toBe('Planos habilitados');
        expect(getSellerContactStatusLabel('closed')).toBe('Fechado');
    });
});
