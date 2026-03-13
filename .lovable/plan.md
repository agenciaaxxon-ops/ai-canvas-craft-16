

## Atualizar chave da API Google AI Studio

A chave `GOOGLE_AI_STUDIO_API_KEY` já existe como secret no projeto. Preciso atualizá-la com o novo valor fornecido.

### Plano

1. **Atualizar o secret `GOOGLE_AI_STUDIO_API_KEY`** com o novo valor `AIzaSyAfaMi4XIOD7Khwk23eJGUe2B-lqyjB0Qo`

Nenhuma alteração de código é necessária — a edge function `generate-image` já lê esse secret via `Deno.env.get('GOOGLE_AI_STUDIO_API_KEY')`.

> **Nota de segurança**: Chaves de API não devem ser compartilhadas em chat. Após eu atualizar, considere revogar e gerar uma nova caso essa chave tenha sido exposta publicamente.

