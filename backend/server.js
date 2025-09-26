import express from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Conecta ao MongoDB usando Mongoose
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB conectado'))
    .catch(err => console.error('Erro ao conectar ao MongoDB:', err));
    
// Definição dos Schemas e Models
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

app.use(express.json());

// Rota para arquivos estáticos
app.use(express.static(path.resolve(__dirname, '..', 'frontend')));

app.get('/graficos.html', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'frontend', 'graficos.html'));
});

// Cria uma nova partida
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

// Registra um ponto na partida
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

        if (vencedor === player1Name) gameAtual.placarGame.player1++;
        else gameAtual.placarGame.player2++;

        gameAtual.pontos.push({
            pontoId: uuidv4(),
            vencedor,
            modalRespostas,
            timestamp: new Date()
        });

        if (gameAtual.isTiebreak) {
            gameAtual.sacador = getSacador(partida);
        }

        let vencedorDoGame = gameAtual.isTiebreak
            ? checarFimDeTiebreak(gameAtual)
            : checarFimDeGame(gameAtual);

        if (vencedorDoGame) {
            gameAtual.vencedor = (vencedorDoGame === 'player1') ? player1Name : player2Name;

            if (gameAtual.isTiebreak) {
                setAtual.vencedor = gameAtual.vencedor;
                partida.vencedor = checarFimDePartida(partida);

                if (!partida.vencedor && partida.sets.length < partida.configuracao.numSets) {
                    partida.sets.push(criarSet(partida, partida.sets.length + 1));
                }
            } else {
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
        }

        partida.updatedAt = new Date();
        await partida.save();
        res.status(200).json({ success: true, partida });
    } catch (err) {
        console.error("Erro ao registrar o ponto:", err);
        res.status(500).json({ success: false, message: 'Erro ao registrar o ponto.', error: err.message });
    }
});

// Salva o comportamento do set
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

// Rota para obter uma lista de todas as partidas
app.get('/api/partidas-list', async (req, res) => {
    try {
        const partidas = await Partida.find({}, { configuracao: 1, createdAt: 1 }).lean();
        const listaFormatada = partidas.map(p => {
            const playerA = p.configuracao?.playerAName || 'Jogador A';
            const playerB = p.configuracao?.playerBName || 'Jogador B';
            const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : 'Data Desconhecida';
            return {
                id: p._id,
                name: `${playerA} vs ${playerB} - ${date}`
            };
        });
        res.json(listaFormatada);
    } catch (error) {
        console.error("Erro ao buscar a lista de partidas:", error);
        res.status(500).json({ message: "Erro ao buscar a lista de partidas.", error: error.message });
    }
});

// Rota para buscar uma partida por ID
app.get('/api/partida/:id', async (req, res) => {
    try {
        const partidaId = req.params.id;
        const partida = await Partida.findById(partidaId).lean();
        if (partida) {
            res.json(partida);
        } else {
            res.status(404).json({ message: "Partida não encontrada." });
        }
    } catch (error) {
        console.error("Erro ao buscar a partida:", error);
        res.status(500).json({ message: "Erro ao buscar a partida.", error: error.message });
    }
});

// --- FIM DOS NOVOS ENDPOINTS ---

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Abra o navegador em http://localhost:${PORT}`);
});

function getSacador(partida) {
    const { playerAName, playerBName } = partida.configuracao;
    const setAtual = partida.sets[partida.sets.length - 1];
    const gamesDoSet = setAtual.games.filter(g => g.vencedor !== null);
    const totalGamesDoSet = gamesDoSet.length;

    if (setAtual.games[setAtual.games.length - 1]?.isTiebreak) {
        const gameAtual = setAtual.games[setAtual.games.length - 1];
        const totalPontos = gameAtual.placarGame.player1 + gameAtual.placarGame.player2;

        if (totalPontos === 1) {
            const sacadorGameAnterior = setAtual.games[setAtual.games.length - 2]?.sacador;
            return sacadorGameAnterior === playerAName ? playerBName : playerAName;
        }

        const sacadorInicialTiebreak = setAtual.games[setAtual.games.length - 2]?.vencedor;
        if (Math.floor(totalPontos / 2) % 2 === 0) {
            return sacadorInicialTiebreak === playerAName ? playerBName : playerAName;
        } else {
            return sacadorInicialTiebreak;
        }
    }

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