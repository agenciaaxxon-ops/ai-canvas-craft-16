-- Adiciona coluna para armazenar o ID do billing da Abacate Pay
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS abacate_billing_id TEXT;

-- Adiciona coluna para armazenar o QR code PIX
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS pix_qr_code TEXT;

-- Cria índice para buscar por billing_id da Abacate Pay
CREATE INDEX IF NOT EXISTS idx_purchases_abacate_billing_id ON purchases(abacate_billing_id);

-- Adiciona comentários nas colunas
COMMENT ON COLUMN purchases.stripe_session_id IS 'ID da sessão do Stripe (legado)';
COMMENT ON COLUMN purchases.abacate_billing_id IS 'ID do billing da Abacate Pay';
COMMENT ON COLUMN purchases.pix_qr_code IS 'Código PIX para pagamento (Abacate Pay)';