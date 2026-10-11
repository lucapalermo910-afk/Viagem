# Viagem

App para simplificar a organização de viagens: importa a planilha do roteiro (.xlsx) e mostra a viagem dia a dia.

## Privacidade

A planilha é lida no navegador e fica guardada só no aparelho. Nenhum dado de viagem entra neste repositório (`.gitignore` bloqueia `.xlsx`, `.xls` e `.csv`).

## Formato da planilha

Uma linha por dia, com as colunas `Data`, `Base`, `Programa`, `Hotel` e `Diária`. A coluna sem título logo após `Programa` é lida como detalhes do dia. O hotel é informado na primeira noite e vale para as noites seguintes que tiverem diária.

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
