import {
    buildSellerCampaignAcknowledgementKey,
    buildSellerCampaignEnabledMessage,
    getSellerCampaignAccessStatusLabel,
    getSellerCampaignSourceLabel
} from '../sellerCampaign';

describe('sellerCampaign helpers', () => {
    it('mapeia a origem do vínculo comercial', () => {
        expect(getSellerCampaignSourceLabel('link')).toBe('Entrou pelo link');
        expect(getSellerCampaignSourceLabel('manual')).toBe('Habilitado manualmente');
    });

    it('mapeia o status de acesso da campanha', () => {
        expect(getSellerCampaignAccessStatusLabel('pending_enable')).toBe('Pendente de habilitação');
        expect(getSellerCampaignAccessStatusLabel('enabled_for_this_seller')).toBe('Planos liberados');
        expect(getSellerCampaignAccessStatusLabel('enabled_for_other_seller')).toBe('Vinculado a outro vendedor');
    });

    it('monta a mensagem explícita para a liberação manual dos planos', () => {
        expect(buildSellerCampaignEnabledMessage({
            sellerName: 'vendendor01',
            source: 'manual'
        })).toBe('Seus planos semanal e mensal já foram habilitados por vendendor01. Escolha abaixo o pacote da campanha que deseja comprar.');
    });

    it('monta uma chave estável para reconhecer a liberação já exibida ao usuário', () => {
        expect(buildSellerCampaignAcknowledgementKey({
            sellerId: 'seller-1',
            source: 'manual',
            campaignEnabledAt: '2026-03-23T14:00:00.000Z'
        })).toBe('seller-campaign-access:seller-1:manual:2026-03-23T14:00:00.000Z');
    });
});
