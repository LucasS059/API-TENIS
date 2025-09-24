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
  setId: String,
  numero: Number,
  vencedor: { type: String, default: null },
  games: [GameSchema]
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

// Rota para servir a página principal (index.html)
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'frontend', 'index.html'));
});

// Rota para servir arquivos estáticos (CSS, JavaScript, imagens)
app.use(express.static(path.resolve(__dirname, '..', 'frontend')));

// ========================
// Lógica de Jogo
// ========================

function getSacador(partida) {
  const setsA = partida.sets.filter(s => s.vencedor === partida.configuracao.playerAName).length;
  const gamesA = partida.sets.reduce((total, set) => total + set.games.filter(g => g.vencedor === partida.configuracao.playerAName).length, 0);

  const setsB = partida.sets.filter(s => s.vencedor === partida.configuracao.playerBName).length;
  const gamesB = partida.sets.reduce((total, set) => total + set.games.filter(g => g.vencedor === partida.configuracao.playerBName).length, 0);

  const totalGames = gamesA + gamesB;
  const setAtual = partida.sets[partida.sets.length - 1];
  const gameAtual = setAtual.games[setAtual.games.length - 1];

  if (gameAtual.isTiebreak) {
    const totalPontos = gameAtual.placarGame.player1 + gameAtual.placarGame.player2;
    // Sacador inicial do tiebreak é o jogador que NÃO sacou no game 12
    const ultimoGame = setAtual.games[setAtual.games.length - 2];
    const sacadorGameAnterior = ultimoGame.sacador;
    const oponente = (sacadorGameAnterior === partida.configuracao.playerAName) ? partida.configuracao.playerBName : partida.configuracao.playerAName;

    // A cada 2 pontos o saque muda no tie-break
    return (Math.floor(totalPontos / 2) % 2 === 0) ? oponente : sacadorGameAnterior;
  }

  const sacadorInicial = partida.configuracao.playerAName;
  if (totalGames % 2 === 0) {
    return sacadorInicial;
  } else {
    return (sacadorInicial === partida.configuracao.playerAName) ? partida.configuracao.playerBName : partida.configuracao.playerAName;
  }
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
    setId: uuidv4(),
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
  // Tiebreak precisa de 7 pontos com 2 de vantagem
  if ((pA >= 7 || pB >= 7) && Math.abs(pA - pB) >= 2) {
    return pA > pB ? 'player1' : 'player2';
  }
  return null;
}

function checarFimDeSet(set, partidaConfig) {
  const gamesA = set.games.filter(g => g.vencedor === partidaConfig.playerAName).length;
  const gamesB = set.games.filter(g => g.vencedor === partidaConfig.playerBName).length;

  // Lógica para set normal
  if ((gamesA >= 6 || gamesB >= 6) && Math.abs(gamesA - gamesB) >= 2) {
    return gamesA > gamesB ? 'player1' : 'player2';
  }

  // Lógica para iniciar tie-break
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
    const gameAtual = setAtual.games[setAtual.games.length - 1];

    const player1Name = partida.configuracao.playerAName;
    const player2Name = partida.configuracao.playerBName;
    const jogadorVencedorDoPonto = (vencedor === player1Name) ? 'player1' : 'player2';

    // --- Lógica de pontuação ---
    if (jogadorVencedorDoPonto === 'player1') {
      gameAtual.placarGame.player1++;
    } else {
      gameAtual.placarGame.player2++;
    }

    gameAtual.pontos.push({
      pontoId: uuidv4(),
      vencedor,
      modalRespostas,
      timestamp: new Date()
    });

    // Atualiza sacador para tie-break
    if (gameAtual.isTiebreak) {
      gameAtual.sacador = getSacador(partida);
    }

    let vencedorDoGame = null;

    if (gameAtual.isTiebreak) {
      vencedorDoGame = checarFimDeTiebreak(gameAtual);
    } else {
      vencedorDoGame = checarFimDeGame(gameAtual);
    }

    if (vencedorDoGame) {
      gameAtual.vencedor = (vencedorDoGame === 'player1' ? player1Name : player2Name);

      if (gameAtual.isTiebreak) {
        setAtual.vencedor = (vencedorDoGame === 'player1' ? player1Name : player2Name);
        partida.vencedor = checarFimDePartida(partida);

        if (!partida.vencedor && partida.sets.length < partida.configuracao.numSets) {
          partida.sets.push(criarSet(partida, partida.sets.length + 1));
        }
      } else {
        const gamesA = setAtual.games.filter(g => g.vencedor === player1Name).length;
        const gamesB = setAtual.games.filter(g => g.vencedor === player2Name).length;

        if ((gamesA === 6 && gamesB === 6)) {
          setAtual.games.push(criarGame(partida, true));
        } else if ((gamesA >= 6 || gamesB >= 6) && Math.abs(gamesA - gamesB) >= 2) {
          setAtual.vencedor = (gamesA > gamesB ? player1Name : player2Name);
          partida.vencedor = checarFimDePartida(partida);

          if (!partida.vencedor && partida.sets.length < partida.configuracao.numSets) {
            partida.sets.push(criarSet(partida, partida.sets.length + 1));
          }
        } else {
          setAtual.games.push(criarGame(partida));
        }
      }
    }

    partida.updatedAt = new Date();
    await partida.save();

    res.status(200).json({ success: true, partida });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao registrar o ponto.', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Abra o navegador em http://localhost:${PORT}`);
});