# Robertão Rifas

Site de rifa única com painel administrativo e banco de dados Postgres.
O visitante cai direto na rifa — não existe página de catálogo.

## O que o sistema faz

**Site público (`/`)**

- Página única da rifa: galeria, título, descrição, valor da cota, progresso de vendas.
- Compra de cotas com formulário (nome, telefone, e-mail, CPF e data de nascimento).
- Os números são **sorteados no servidor** e nunca se repetem entre pessoas.
- Se uma cota premiada cair para o comprador, o aviso **"Sua cota foi premiada!"**
  aparece na hora, com confete e o nome do prêmio.
- Instruções de pagamento via Pix com o código do pedido.
- `/meus-numeros`: consulta das cotas por CPF, telefone ou código do pedido.

**Painel administrativo (`/admin`)**

| Aba | O que faz |
| --- | --- |
| Visão geral | Cotas vendidas, arrecadação, pedidos e prêmios conquistados. |
| Rifa | Edita título, subtítulo, descrição, regulamento, imagens, valor da cota, total de cotas, mínimo/máximo por compra, atalhos de quantidade, data e status do sorteio, chave Pix e contatos. |
| Cotas premiadas | Cadastra os prêmios e **sorteia** quais números vão escondê-los (ou define manualmente). Mostra quem conquistou cada um. |
| Pedidos | Lista todas as compras com os dados do comprador e **todas as cotas adquiridas**. Busca por nome, CPF, telefone, e-mail, código ou número da cota. Confirma pagamento, cancela ou exclui (devolvendo as cotas). |
| Buscar cota | Digite o número da cota premiada e veja imediatamente quem comprou, com telefone e botão para ligar. |
| Sorteio final | Sorteia o prêmio principal entre todas as cotas vendidas e mostra os dados do ganhador. |

## Como as cotas premiadas funcionam

Cada prêmio recebe um número secreto sorteado pelo painel. Na hora da compra, o
servidor distribui números aleatórios — mas as cotas premiadas são **seguradas**
no começo da rifa para que ninguém leve os prêmios nas primeiras compras.

A chance de liberação parte do valor configurado em
*Dificuldade das cotas premiadas (%)* e sobe até 100% quando 75% da rifa foi
vendida. Na prática, com a configuração padrão (12%):

| Faixa da rifa vendida | Prêmios que saem |
| --- | --- |
| 0–30% | ~8% |
| 30–60% | ~25% |
| 60–100% | ~68% |

Todos os prêmios sempre saem antes do fim da rifa.

## Garantia de números únicos

Três camadas impedem cota repetida:

1. Um *advisory lock* no Postgres serializa todas as compras.
2. Os candidatos vêm de uma consulta que exclui os números já vendidos.
3. `tickets.number` é **chave primária** — o banco rejeita qualquer duplicata.

Pedido, cotas e prêmios são gravados na mesma transação: ou tudo entra, ou nada entra.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL e ADMIN_PASSWORD
npm run dev
```

O site sobe em `http://localhost:3000` e o painel em `http://localhost:3000/admin`.
As tabelas são criadas automaticamente na primeira consulta ao banco.

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. Em **Storage**, crie um Postgres (ou use Neon/Supabase) e conecte ao projeto.
3. Em **Settings → Environment Variables**, confirme/defina:
   - `DATABASE_URL` — string de conexão do Postgres (use a versão *pooled*).
   - `ADMIN_PASSWORD` — senha do painel.
   - `ADMIN_SESSION_SECRET` — opcional, segredo do cookie de sessão.
4. Faça o deploy e abra `/admin` para configurar a rifa.

> As tabelas (`raffle`, `orders`, `tickets`, `prizes`) são criadas sozinhas —
> não há passo de migração manual.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS ·
Framer Motion · Postgres (`pg`)
