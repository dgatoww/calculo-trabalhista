# Sistema de Cálculo de Verbas Rescisórias Trabalhistas

Sistema web completo para cálculo de verbas rescisórias conforme a legislação trabalhista brasileira.

## Estrutura

```
calculo-trabalhista/
├── backend/          — API Node.js + Express + sql.js
├── frontend/         — React (create-react-app)
├── start.bat         — Script para iniciar tudo no Windows
└── README.md
```

## Como Usar

### Opção 1: Script automático (Windows)
Double-click em `start.bat`

### Opção 2: Manual
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm start
```

Acesse: http://localhost:3000

## Cálculos Implementados

| Verba | Fórmula |
|-------|---------|
| Saldo de Salário | (Salário ÷ 30) × dias trabalhados − deduções |
| 13º Proporcional | (avos/12) × Salário |
| Férias Vencidas | Salário × (1 + 1/3) por período vencido |
| Férias Proporcionais | (avos/12) × Salário × (1 + 1/3) |

**NÃO inclui:** Aviso Prévio, FGTS, Multa 40%

## Regras de Negócio

- **Data de rescisão**: extraída do **Termo de Audiência** (prioridade máxima)
- **Último dia trabalhado**: identificado do **Cartão de Ponto**
- **Avos**: meses com ≥ 15 dias trabalhados contam para 13º e Férias
- **Licença-maternidade**: conta para fins de avos
- **Deduções do saldo de salário**: vindas da Ficha Financeira

## Tecnologias

- **Backend**: Node.js 18+, Express 4, sql.js (SQLite puro JS), multer, pdf-parse, tesseract.js, docx
- **Frontend**: React 18, axios
