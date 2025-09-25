import express from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// ========================
// Conexão com MongoDB
// ========================
mongoose.connect('mongodb://localhost:27017/tenis', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB conectado'))
  .catch(err => console.error(err));

// ========================
// Definição do Schema do Mongoose
// ========================
const PontoSchema = new mongoose.Schema({
  pontoId: String,
  vencedor: String,
  ponto: String,
  modalRespostas: Object,
  timestamp: Date
});

const GameSchema = new mongoose.Schema({
  gameId: String,
  vencedor: { type: String, default: null },
  placarGame: {
    player1: { type: Number, default: 0 },
    player2: { type: Number, default: 0 }
  },
  isTiebreak: { type: Boolean, default: false },
  sacador: String,
  pontos: [PontoSchema]
});

const SetSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  numero: Number,
  vencedor: { type: String, default: null },
  games: [GameSchema],
  modalRespostasSet: Object
});

const PartidaSchema = new mongoose.Schema({
  _id: String,
  configuracao: Object,
  sets: [SetSchema],
  vencedor: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Partida = mongoose.model('Partida', PartidaSchema);

// ========================
// Middlewares
// ========================
app.use(express.json());

// ========================
// ENDPOINTS DA API
// ========================
app.post('/api/partida', async (req, res) => {
  try {
    const { configuracao } = req.body;
    const partidaId = uuidv4();
    const novaPartida = new Partida({
      _id: partidaId,
      configuracao,
      sets: []
    });
    const novoSet = criarSet(novaPartida, 1);
    novaPartida.sets.push(novoSet);
    await novaPartida.save();
    res.status(201).json({ success: true, partida: novaPartida });
  } catch (err) {
    console.error("Erro ao criar a partida:", err);
    res.status(500).json({ success: false, message: 'Erro ao criar a partida.', error: err.message });
  }
});

app.post('/api/partida/:id/ponto', async (req, res) => {
  try {
    const { id } = req.params;
    const { vencedor, modalRespostas } = req.body;
    const partida = await Partida.findById(id);
    if (!partida) {
      return res.status(404).json({ success: false, message: 'Partida não encontrada.' });
    }
    if (partida.vencedor) {
      return res.status(400).json({ success: false, message: 'O jogo já foi finalizado.' });
    }

    const setAtual = partida.sets[partida.sets.length - 1];
    let gameAtual = setAtual.games[setAtual.games.length - 1];
    const player1Name = partida.configuracao.playerAName;
    const player2Name = partida.configuracao.playerBName;

    // Adicionar ponto
    if (vencedor === player1Name) gameAtual.placarGame.player1++;
    else gameAtual.placarGame.player2++;

    // Salvar o ponto
    gameAtual.pontos.push({
      pontoId: uuidv4(),
      vencedor,
      modalRespostas,
      timestamp: new Date()
    });

    // Lógica do saque em Tiebreak
    if (gameAtual.isTiebreak) {
      gameAtual.sacador = getSacador(partida);
    }

    // Checar se o game terminou
    let vencedorDoGame = gameAtual.isTiebreak ? checarFimDeTiebreak(gameAtual) : checarFimDeGame(gameAtual);

    if (vencedorDoGame) {
      gameAtual.vencedor = (vencedorDoGame === 'player1') ? player1Name : player2Name;

      // Checar se o set terminou
      const checarSet = checarFimDeSet(setAtual, partida.configuracao);
      if (checarSet === 'tiebreak') {
        setAtual.games.push(criarGame(partida, true));
      } else if (checarSet) {
        setAtual.vencedor = checarSet === 'player1' ? player1Name : player2Name;
        partida.vencedor = checarFimDePartida(partida);
        if (!partida.vencedor && partida.sets.length < partida.configuracao.numSets) {
          partida.sets.push(criarSet(partida, partida.sets.length + 1));
        }
      } else {
        setAtual.games.push(criarGame(partida));
      }
    }

    partida.updatedAt = new Date();
    await partida.save();
    res.status(200).json({ success: true, partida });
  } catch (err) {
    console.error("Erro ao registrar o ponto:", err);
    res.status(500).json({ success: false, message: 'Erro ao registrar o ponto.', error: err.message });
  }
});

app.post('/api/partida/:partidaId/set/:setId/comportamento', async (req, res) => {
  try {
    const { partidaId, setId } = req.params;
    const { modalRespostasSet } = req.body;

    const partida = await Partida.findById(partidaId);
    if (!partida) {
      return res.status(404).json({ message: 'Partida não encontrada' });
    }

    const setAtual = partida.sets.id(setId);
    if (!setAtual) {
      return res.status(404).json({ message: 'Set não encontrado' });
    }

    setAtual.modalRespostasSet = modalRespostasSet;

    await partida.save();
    res.json({ partida });
  } catch (error) {
    console.error("Erro ao salvar comportamento do set:", error);
    res.status(500).json({ message: 'Erro ao salvar comportamento do set', error });
  }
});

// ========================
// NOVO ENDPOINT DE RELATÓRIOS
// ========================
app.get('/api/relatorios', async (req, res) => {
  try {
    const partidas = await Partida.find({});
    res.status(200).json({ success: true, partidas });
  } catch (err) {
    console.error("Erro ao buscar dados para relatórios:", err);
    res.status(500).json({ success: false, message: 'Erro ao buscar dados.', error: err.message });
  }
});

// ========================
// Rota para arquivos estáticos
// ========================
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'frontend', 'index.html'));
});

app.use(express.static(path.resolve(__dirname, '..', 'frontend')));

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Abra o navegador em http://localhost:${PORT}`);
});

// ========================
// Funções Auxiliares
// ========================
function getSacador(partida) {
  const { playerAName, playerBName } = partida.configuracao;
  const setAtual = partida.sets[partida.sets.length - 1];
  const gamesDoSet = setAtual.games.filter(g => g.vencedor !== null);
  const totalGamesDoSet = gamesDoSet.length;

  if (setAtual.games[setAtual.games.length - 1]?.isTiebreak) {
    const gameAtual = setAtual.games[setAtual.games.length - 1];
    const totalPontos = gameAtual.placarGame.player1 + gameAtual.placarGame.player2;

    // Se for o primeiro ponto do tiebreak, o sacador é o que recebeu o saque no game anterior.
    if (totalPontos === 1) {
      const sacadorGameAnterior = setAtual.games[setAtual.games.length - 2]?.sacador;
      return sacadorGameAnterior === playerAName ? playerBName : playerAName;
    }

    // Troca de saque a cada 2 pontos
    const sacadorInicialTiebreak = setAtual.games[setAtual.games.length - 2]?.vencedor;
    if (Math.floor(totalPontos / 2) % 2 === 0) {
      return sacadorInicialTiebreak === playerAName ? playerBName : playerAName;
    } else {
      return sacadorInicialTiebreak;
    }
  }

  // Troca de saque a cada game
  const ultimoSacador = setAtual.games[totalGamesDoSet - 1]?.sacador;
  return (ultimoSacador === playerAName) ? playerBName : playerAName;
}


function criarGame(partida, isTiebreak = false) {
  let sacador;
  if (partida.sets.length === 0 || partida.sets[partida.sets.length - 1].games.length === 0) {
    sacador = partida.configuracao.playerAName;
  } else {
    sacador = getSacador(partida);
  }
  return {
    gameId: uuidv4(),
    vencedor: null,
    placarGame: { player1: 0, player2: 0 },
    isTiebreak: isTiebreak,
    sacador: sacador,
    pontos: []
  };
}

function criarSet(partida, numeroSet) {
  return {
    numero: numeroSet,
    vencedor: null,
    games: [criarGame(partida)]
  };
}

function checarFimDeGame(game) {
  const pA = game.placarGame.player1;
  const pB = game.placarGame.player2;
  if ((pA >= 4 || pB >= 4) && Math.abs(pA - pB) >= 2) {
    return pA > pB ? 'player1' : 'player2';
  }
  return null;
}

function checarFimDeTiebreak(game) {
  const pA = game.placarGame.player1;
  const pB = game.placarGame.player2;
  if ((pA >= 7 || pB >= 7) && Math.abs(pA - pB) >= 2) {
    return pA > pB ? 'player1' : 'player2';
  }
  return null;
}

function checarFimDeSet(set, partidaConfig) {
  const gamesA = set.games.filter(g => g.vencedor === partidaConfig.playerAName).length;
  const gamesB = set.games.filter(g => g.vencedor === partidaConfig.playerBName).length;

  if ((gamesA >= 6 || gamesB >= 6) && Math.abs(gamesA - gamesB) >= 2) {
    return gamesA > gamesB ? 'player1' : 'player2';
  }

  if (gamesA === 6 && gamesB === 6) {
    return 'tiebreak';
  }

  return null;
}

function checarFimDePartida(partida) {
  const setsParaVencer = Math.ceil(partida.configuracao.numSets / 2);
  const setsA = partida.sets.filter(s => s.vencedor === partida.configuracao.playerAName).length;
  const setsB = partida.sets.filter(s => s.vencedor === partida.configuracao.playerBName).length;

  if (setsA >= setsParaVencer) return partida.configuracao.playerAName;
  if (setsB >= setsParaVencer) return partida.configuracao.playerBName;

  return null;
}