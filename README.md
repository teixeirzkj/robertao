# Robertão Rifas

Site de rifa única com painel administrativo e banco de dados Postgres.
O visitante cai direto na rifa — não existe página de catálogo.

**As cotas só existem depois do pagamento confirmado.** O pedido nasce pendente
reservando a quantidade; quando o pagamento entra, o servidor sorteia os números
e o comprador vê o resultado na tela com a animação do sorteio.

## O que o sistema faz

**Site público**

| Rota | O que é |
| --- | --- |
| `/` | A rifa: galeria, valor da cota, progresso, cotas premiadas, compra |
| `/pedido/[codigo]` | Pagamento do pedido, espera da confirmação e o sorteio das cotas |
| `/meus-numeros` | Consulta de cotas por CPF, telefone ou código do pedido |

O fluxo de compra:

1. O visitante escolhe a quantidade e preenche nome, telefone, e-mail, CPF e
   data de nascimento (validados no cliente **e** no servidor).
2. O pedido é criado como **pendente** — sem nenhuma cota ainda — e reserva a
   quantidade por um tempo configurável (padrão 60 min).
3. Ele vai para `/pedido/[codigo]`, paga via Pix e a página fica verificando a
   confirmação sozinha, com contagem regressiva da reserva.
4. Confirmado o pagamento, o servidor **sorteia os números** e a página roda a
   animação do sorteio. Se uma cota premiada cair, aparece **"Sua cota foi
   premiada!"** com confete e o prêmio.

A quantidade de cotas disponíveis não é exibida no site — só a porcentagem vendida.

**Painel administrativo (`/admin`)**

| Aba | O que faz |
| --- | --- |
| Visão geral | Cotas vendidas, reservadas e livres, arrecadação, pedidos pendentes, prêmios conquistados. |
| Rifa | Edita título, subtítulo, descrição, regulamento, imagens, valor da cota, total de cotas, mínimo/máximo por compra, atalhos de quantidade, data e status, dificuldade das cotas premiadas, janela de reserva, chave Pix e contatos. |
| Cotas premiadas | Cadastra, **edita** (nome, valor, imagem, número) e **exclui** prêmios. Sorteia os números secretos ou define manualmente. Mostra quem conquistou cada um. |
| Pedidos | Todas as compras com os dados do comprador e as cotas adquiridas. Busca por nome, CPF, telefone, e-mail, código ou número da cota. **Confirmar pagamento sorteia as cotas.** Cancelar ou voltar para pendente devolve as cotas à rifa. |
| Cotas | Duas consultas: o titular de um número específico, e a **maior e a menor cota vendida em um período** (ex.: até 20/12 às 18h), com os dados de quem comprou e botão para ligar. |
| Sorteio final | Sorteia o prêmio principal entre as cotas pagas e mostra os dados do ganhador. |

## Confirmação de pagamento

Hoje a confirmação é manual, na aba **Pedidos**. Para automatizar (InfinitePay
via n8n), aponte o fluxo para o webhook:

```
POST /api/webhooks/pagamento
x-webhook-secret: <WEBHOOK_SECRET>

{ "code": "RBAB12CD", "status": "paid" }
```

- `code` aceita também `orderId`, `order_id` ou `reference`.
- `status` reconhece `paid`, `pago`, `approved`, `aprovado`, `succeeded`,
  `confirmed` e `success`. Qualquer outro valor é ignorado sem erro, então
  eventos de "pendente" não confirmam nada.
- **É idempotente**: reenviar o mesmo pedido devolve as mesmas cotas sem
  sortear de novo — retentativas do n8n são seguras.
- Sem `WEBHOOK_SECRET` definido, o endpoint responde 503 e não confirma nada.

## Como as cotas premiadas funcionam

Cada prêmio recebe um número secreto sorteado pelo painel. As cotas premiadas
são **seguradas** no começo da rifa para que ninguém leve os prêmios nas
primeiras compras: a chance de liberação parte do valor em *Dificuldade das
cotas premiadas (%)* e sobe até 100% quando 75% da rifa foi vendida.

Com a configuração padrão (12%), os prêmios saem assim:

| Faixa da rifa vendida | Prêmios que saem |
| --- | --- |
| 0–30% | ~8% |
| 30–60% | ~25% |
| 60–100% | ~68% |

Todos os prêmios sempre saem antes do fim da rifa.

## Garantia de números únicos

Quatro camadas impedem cota repetida:

1. Um *advisory lock* no Postgres serializa todas as distribuições de cotas.
2. Pedidos pendentes **reservam** a quantidade, então a rifa não vende mais
   cotas do que tem.
3. Os candidatos vêm de uma consulta que exclui os números já vendidos.
4. `tickets.number` é **chave primária** — o banco rejeita qualquer duplicata.

Pedido, cotas e prêmios são gravados na mesma transação: ou tudo entra, ou nada entra.

## Rodando localmente

**Sem instalar Postgres** — o projeto traz um Postgres embutido para desenvolvimento:

```bash
npm install
npm run dev:local     # sobe o banco local + o site em http://localhost:3000
npm run seed          # (opcional, em outro terminal) preenche com dados de exemplo
```

Os dados persistem entre reinícios. A senha padrão do painel é `robertao123`
— defina `ADMIN_PASSWORD` para trocar.

O banco de desenvolvimento tem duas limitações que **não** valem para produção:

- Ele roda o Postgres em modo single-user, com todas as conexões na mesma
  sessão. Por isso o `dev:local` limita o pool a uma conexão, mantendo as
  transações em fila. Num Postgres de verdade cada conexão é uma sessão e o
  *advisory lock* faz esse trabalho.
- Em pastas sincronizadas (OneDrive e cia.), os dados vão para o temp do
  sistema em vez da pasta do projeto — o sync mexe nos arquivos enquanto o
  Postgres os usa e **corrompe o banco**. Use `DEV_DB_DIR` para escolher
  outro lugar.

**Com um Postgres próprio** (nuvem ou local):

```bash
cp .env.example .env.local   # preencha DATABASE_URL e ADMIN_PASSWORD
npm run dev
```

As tabelas são criadas automaticamente na primeira consulta ao banco.

> **Projeto dentro do OneDrive?** Um build antigo ou interrompido faz o Next
> quebrar com `EINVAL ... readlink`. O `dev:local` e o `build` já contornam:
> descartam o `.next` anterior antes de começar (só em pastas sincronizadas —
> na Vercel o cache é preservado).

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev:local` | Banco local embutido + site, tudo junto |
| `npm run dev` | Só o site (exige `DATABASE_URL`) |
| `npm run dev:db` | Só o banco local, na porta 54321 |
| `npm run seed` | Configura a rifa e cria compras de exemplo |
| `npm run reset -- --sim` | Apaga o banco local (`.pgdata/`) |
| `npm run build` | Build de produção |

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. Em **Storage**, crie um Postgres (ou use Neon/Supabase) e conecte ao projeto.
3. Em **Settings → Environment Variables**, defina:
   - `DATABASE_URL` — string de conexão do Postgres (use a versão *pooled*).
   - `ADMIN_PASSWORD` — senha do painel. **Defina antes do primeiro deploy**,
     senão vale a senha padrão que está no código.
   - `ADMIN_SESSION_SECRET` — opcional, segredo do cookie de sessão.
   - `WEBHOOK_SECRET` — só quando for ligar a confirmação automática.
4. Faça o deploy e abra `/admin` para configurar a rifa.

> As tabelas (`raffle`, `orders`, `tickets`, `prizes`) são criadas sozinhas —
> não há passo de migração manual.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS ·
Framer Motion · Postgres (`pg`)
