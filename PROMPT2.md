# Nova Fase — Módulo de Controle de Aulas

**Pré-requisito:** implementar somente APÓS a refatoração de layout desktop/UX estar concluída e aprovada. Não misturar com aquela tarefa.

## Contexto

Além das finanças, dou aulas particulares de idioma e hoje controlo isso numa planilha à parte. Quero trazer esse controle para dentro do app porque as aulas são uma das minhas fontes de renda ("ganhos variáveis") — e o principal problema é acompanhar **quem já pagou o quê**, já que alguns alunos pagam por aula e outros pagam o mês fechado após o fim do mês.

O módulo deve fechar o ciclo: aula dada → valor a receber → pagamento recebido → **entrada gerada automaticamente** na tabela `incomes` (source: `teaching`). Nada de lançamento duplicado.

## Modelo de dados

### `students`
- `id`, `name`, `financial_guardian` (responsável financeiro — texto; pode ser o próprio aluno ou uma empresa/pessoa)
- `billing_mode` (enum: `per_class` = paga por aula, `monthly` = paga o mês fechado depois do fim do mês)
- `default_rate` (valor padrão por aula, editável por aula)
- `active` (bool)
- `notes` (opcional)

### `lessons`
- `id`, `date`, `student_id`
- `status` (enum: `scheduled` agendada, `given` dada, `cancelled_by_student`, `cancelled_by_me`, `rescheduled`)
- `amount` (valor cobrado; default = `default_rate` do aluno, editável)
- `payment_status` (enum: `pending` a receber, `paid` pago, `not_billable` não cobrável — ex.: aula cancelada sem cobrança)
- `payment_date` (opcional)
- `income_id` (FK opcional para `incomes` — preenchida quando o pagamento gera a entrada)

## Lógica de pagamento (parte mais importante)

### Alunos `per_class`
- Ao marcar uma aula como paga → criar automaticamente um registro em `incomes` (source `teaching`, valor da aula, data do pagamento) e vincular via `income_id`.

### Alunos `monthly`
- As aulas do mês acumulam com `payment_status = pending`.
- Ação de **"Fechar mês do aluno"**: seleciona todas as aulas dadas e pendentes do aluno no mês, mostra o total, e ao confirmar o recebimento → marca todas como `paid` com a mesma `payment_date` e cria **UMA** entrada em `incomes` com o total (vinculando todas as aulas a essa entrada).
- Deve ser possível fechar parcialmente (desmarcar alguma aula da seleção) caso o pagamento venha incompleto.

### Regras
- Desfazer um pagamento deve remover/estornar a entrada vinculada em `incomes` (com confirmação).
- Aulas `cancelled_*` não entram em cobranças por padrão, mas devem permitir override manual (ex.: cancelamento em cima da hora que é cobrado mesmo assim).

## Telas

### `/aulas` (nova rota, novo item na navegação: "Aulas" 🎓)

**Desktop — tabela** (mesmo padrão da tabela de gastos):
- Colunas: Data · Aluno · Responsável financeiro · Status da aula · Valor · Status de pagamento · Ações
- Filtros: período, aluno, status da aula, status de pagamento
- Linha de totais do filtro: total dado, total a receber, total recebido
- Ações rápidas na linha: marcar como dada, marcar como paga

**Mobile — lista de cards** com as mesmas informações e ações por toque.

**Registro rápido de aula** (mesmo padrão visual dos outros formulários): data (default hoje), aluno (select), status, valor (pré-preenchido com o rate do aluno).
- Atalho útil: botão "repetir última aula deste aluno" (mesmo aluno, valor; data = hoje).

### Gestão de alunos
- Subseção simples em `/aulas` (aba ou link "Alunos"): CRUD de alunos com os campos acima. Nada elaborado.

### Widget no Dashboard: "A receber de aulas"
- Total pendente, quebrado por aluno/responsável (ex.: "Empresa X — R$ 1.200 (6 aulas)").
- Para alunos `monthly` com mês virado e aulas pendentes: destaque visual de "mês fechado, aguardando pagamento" — esse é o alerta mais valioso do módulo.

## Integração com o restante do app

- Entradas geradas por aulas aparecem normalmente em `/entradas`, marcadas com origem "Aulas" e link para as aulas que as compõem. Não devem ser editáveis diretamente por lá (editar pela tela de aulas, para manter consistência).
- O resumo do mês no dashboard passa a distinguir, dentro das entradas, o quanto veio de aulas.

## Fora de escopo
- Agenda/calendário de aulas, lembretes, integração com Google Calendar
- Emissão de recibos ou cobranças automáticas
- Multi-moeda (valores em BRL)

## Processo
1. Migration das novas tabelas + RLS.
2. CRUD de alunos.
3. Registro e tabela/lista de aulas.
4. Lógica de pagamento (per_class e fechamento mensal) com geração de entradas.
5. Widget "A receber" no dashboard.
Me mostre o resultado ao fim de cada etapa antes de seguir.