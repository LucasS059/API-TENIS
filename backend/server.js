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
const PONTUACAO_TENIS = [0, 15, 30, 40, 'A'];

function criarGame(isTiebreak = false) {
    return {
        gameId: uuidv4(),
        vencedor: null,
        placarGame: { player1: 0, player2: 0 },
        isTiebreak: isTiebreak,
        pontos: []
    };
}

function criarSet(numeroSet) {
    return {
        setId: uuidv4(),
        numero: numeroSet,
        vencedor: null,
        games: [criarGame()]
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
            sets: [criarSet(1)],
        });
        await novaPartida.save();
        res.status(201).json({ success: true, partida: novaPartida });
    } catch (err) {
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
        if (gameAtual.isTiebreak) {
            if (jogadorVencedorDoPonto === 'player1') {
                gameAtual.placarGame.player1++;
            } else {
                gameAtual.placarGame.player2++;
            }
        } else {
            const pA = gameAtual.placarGame.player1;
            const pB = gameAtual.placarGame.player2;

            if (pA === 3 && pB === 3) { // Deuce
                if (jogadorVencedorDoPonto === 'player1') {
                    gameAtual.placarGame.player1 = 4;
                } else {
                    gameAtual.placarGame.player2 = 4;
                }
            } else if (pA === 4 && pB === 3) { // Vantagem para A
                if (jogadorVencedorDoPonto === 'player1') {
                    gameAtual.placarGame.player1 = 5; // Venceu o game
                } else {
                    gameAtual.placarGame.player1 = 3;
                    gameAtual.placarGame.player2 = 3; // Voltou pra deuce
                }
            } else if (pA === 3 && pB === 4) { // Vantagem para B
                if (jogadorVencedorDoPonto === 'player2') {
                    gameAtual.placarGame.player2 = 5; // Venceu o game
                } else {
                    gameAtual.placarGame.player1 = 3;
                    gameAtual.placarGame.player2 = 3; // Voltou pra deuce
                }
            } else { // Pontuação normal
                if (jogadorVencedorDoPonto === 'player1') {
                    gameAtual.placarGame.player1++;
                } else {
                    gameAtual.placarGame.player2++;
                }
            }
        }

        gameAtual.pontos.push({
            pontoId: uuidv4(),
            vencedor,
            modalRespostas,
            timestamp: new Date()
        });

        // --- Lógica de avanço de Game, Set e Partida ---
        let vencedorDoGame = null;
        if (gameAtual.isTiebreak) {
            vencedorDoGame = checarFimDeTiebreak(gameAtual);
        } else {
            vencedorDoGame = checarFimDeGame(gameAtual);
        }

        if (vencedorDoGame) {
            gameAtual.vencedor = (vencedorDoGame === 'player1' ? player1Name : player2Name);

            // Se o game atual era um tie-break, o vencedor do game é o vencedor do set
            if (gameAtual.isTiebreak) {
                setAtual.vencedor = (vencedorDoGame === 'player1' ? player1Name : player2Name);
            } else {
                // Checa se o set foi vencido por 6-0 até 7-5, ou se deve ir para tie-break (6-6)
                const vencedorDoSet = checarFimDeSet(setAtual, partida.configuracao);
                if (vencedorDoSet === 'tiebreak') {
                    setAtual.games.push(criarGame(true));
                } else if (vencedorDoSet) {
                    setAtual.vencedor = (vencedorDoSet === 'player1' ? player1Name : player2Name);
                }
            }

            if (setAtual.vencedor) {
                partida.vencedor = checarFimDePartida(partida);
                
                // Se a partida não terminou e ainda há sets a serem jogados, crie um novo set
                if (!partida.vencedor && partida.sets.length < partida.configuracao.numSets) {
                    partida.sets.push(criarSet(partida.sets.length + 1));
                }
            } else {
                // Se o set ainda não acabou, cria um novo game normal
                setAtual.games.push(criarGame());
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