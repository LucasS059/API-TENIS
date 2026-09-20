# API-TENIS

Sistema de análise e acompanhamento de partidas de tênis, com backend em Node.js/Express e frontend em HTML/CSS/JavaScript para registrar pontos, acompanhar placar, avaliar comportamentos e visualizar estatísticas.

## Descrição do projeto

O projeto foi pensado para auxiliar na análise de desempenho de jogadores de tênis durante partidas, registrando cada ponto, o contexto da troca, o resultado da jogada e indicadores comportamentais do atleta.

A aplicação permite:

- configurar partida com nomes dos jogadores, quantidade de sets e formato do set decisivo;
- registrar pontos e atualizar o placar em tempo real;
- analisar o comportamento do atleta em diferentes momentos do jogo;
- salvar registros de arbitragem e eventos de partida;
- consultar partidas anteriores e visualizar gráficos de análise;
- desfazer o último ponto registrado;
- manter os dados persistidos em MongoDB.

## Funcionalidades principais

- Controle de placar em tempo real
- Suporte a melhor de 3 ou melhor de 5 sets
- Tiebreak e super tiebreak
- Registro de pontos com contexto de ação
- Modais de avaliação comportamental por parte do jogador
- Registro de arbitragem
- Visualização de estatísticas por gráficos
- Persistência em banco MongoDB
- API REST para gerenciamento de partidas

## Stack tecnológica

### Backend
- Node.js
- Express
- MongoDB + Mongoose
- dotenv
- UUID

### Frontend
- HTML
- CSS
- JavaScript
- Bootstrap

## Estrutura do repositório

```text
API-TENIS/
├── backend/
│   ├── server.js
│   ├── tennisLogic.js
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── index.html
│   ├── graficos.html
│   ├── script.js
│   ├── graficos.js
│   ├── cover.css
│   ├── graficos.css
│   └── assets/
├── .gitignore
└── README.md
```

## Como executar o projeto

### 1. Clonar o repositório

```bash
git clone https://github.com/LucasS059/API-TENIS.git
cd API-TENIS
```

### 2. Instalar dependências do backend

```bash
cd backend
npm install
```

### 3. Configurar MongoDB

Certifique-se de que o MongoDB esteja em execução localmente ou configure uma URI externa.

Por padrão, o backend tenta conectar em:

```bash
mongodb://localhost/tennis
```

Se necessário, crie um arquivo `.env` dentro da pasta `backend` com o seguinte conteúdo:

```env
MONGODB_URI=mongodb://localhost/tennis
PORT=3000
```

### 4. Iniciar o backend

```bash
npm start
```

Ou em modo desenvolvimento com reinício automático:

```bash
npm run dev
```

### 5. Abrir a aplicação

O frontend é servido localmente pelo backend.

Acesse no navegador:

```text
http://localhost:3000/
```

Para acessar a página de gráficos:

```text
http://localhost:3000/graficos.html
```

## API REST

O backend expõe endpoints para gerenciamento das partidas, incluindo:

- `POST /api/partida` — criar uma nova partida
- `POST /api/partida/:id/ponto` — registrar um ponto
- `POST /api/partida/:id/undo` — desfazer o último ponto
- `POST /api/partida/:partidaId/set/:setId/game/:gameId/changeover` — salvar dados da virada de lado
- `POST /api/partida/:partidaId/set/:setId/comportamento` — salvar comportamento do set
- `POST /api/partida/:id/arbitragem` — registrar arbitragem
- `GET /api/partidas-list` — listar partidas
- `GET /api/partida/:id` — buscar uma partida específica
- `DELETE /api/partida/:id` — excluir uma partida

## Observações

Este projeto foi construído como uma ferramenta interna de análise de desempenho no tênis, com foco em observação de padrões táticos, comportamentais e emocionais durante as partidas.

A estrutura atual combina uma interface web com uma API de persistência, tornando o sistema fácil de evoluir, testar e adaptar para novas métricas de análise.

## Licença

Este projeto não possui uma licença definida no repositório no momento. Caso queira, você pode adicionar uma licença como MIT ou GPL.

## Contribuição

Contribuições são bem-vindas. Para colaborar:

1. Faça um fork do projeto
2. Crie uma branch para sua funcionalidade
3. Commit das alterações
4. Abra um pull request

## Autor

LucasS059

## Descrição sugerida para o repositório no GitHub

`Sistema de análise de partidas de tênis com backend em Node.js, frontend em JavaScript e persistência em MongoDB.`

Ou uma versão mais completa:

`Aplicação para registrar pontos, acompanhar placares, avaliar comportamento de jogadores e visualizar análises de partidas de tênis.`
