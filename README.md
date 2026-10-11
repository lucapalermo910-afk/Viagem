# Viagem

App para simplificar a organização de viagens: importa a planilha do roteiro (.xlsx) e mostra a viagem dia a dia.

## Privacidade

A planilha é lida no navegador e fica guardada só no aparelho. Nenhum dado de viagem entra neste repositório (`.gitignore` bloqueia `.xlsx`, `.xls` e `.csv`).

## Formato da planilha

O formato principal é o modelo `public/modelo-roteiro.xlsx` (no app: "Baixar modelo vazio"), com as abas:

- `Dias`: cidade e anotações de cada dia (opcional)
- `Compromissos`: uma linha por atividade, com horário, duração, tipo, funcionamento, trajeto, reserva e custo
- `Hospedagem`: uma linha por hotel, com check-in e check-out
- `Transporte`: uma linha por trecho de voo, trem ou ônibus
- `Pendências`: contagens e custos por fórmula

O app importa esse modelo e exporta de volta para ele ("Baixar Excel"), sem perda. A planilha antiga, de uma linha por dia (`Data`, `Base`, `Programa`, `Hotel`, `Diária`), continua aceita.

Para alterar o modelo, edite `scripts/gerar-modelo.py` e rode `python3 scripts/gerar-modelo.py`.

## Desenvolvimento

```
npm install
npm run dev     # servidor local
npm test        # testes do leitor da planilha
npm run build   # gera dist/
```

## Fluxo de trabalho

- `main` é sempre publicável e gera o preview no GitHub Pages.
- Cada funcionalidade nasce em uma branch `feat/...` ou `fix/...` e entra por pull request, com merge em squash.
- Marcos viram tags: `v0.1.0`, `v0.2.0`, `v1.0.0`.
