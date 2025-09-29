import express from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/tennis', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));
    
// --- Esquemas do Banco de Dados ---
const PontoSchema = new mongoose.Schema({
    pontoId: String,
    vencedor: String,
    tipoPonto: String,      
    placarNoMomento: String,
    modalRespostas: Object,
    timestamp: Date,
    sacador: String
}, { _id: false });

const GameSchema = new mongoose.Schema({
    gameId: String,
    vencedor: { type: String, default: null },
    placarGame: {
        player1: { type: Number, default: 0 },
        player2: { type: Number, default: 0 }
    },
    isTiebreak: { type: Boolean, default: false },
    isSuperTiebreak: { type: Boolean, default: false },
    sacador: String,
    pontos: [PontoSchema],
    changeoverData: { type: Object, default: null } 
}, { _id: false });

const SetSchema = new mongoose.Schema({
    _id: { type: String, default: uuidv4 },
    numero: Number,
    vencedor: { type: String, default: null },
    placarGames: {
        player1: { type: Number, default: 0 },
        player2: { type: Number, default: 0 }
    },
    games: [GameSchema],
    modalRespostasSet: { type: Object, default: null }
});

const ArbitragemSchema = new mongoose.Schema({
    arbitragemId: String,
    solicitante: String,
    resultado: String,
    placarNoMomento: String,
    timestamp: Date
}, { _id: false });

const PartidaSchema = new mongoose.Schema({
    _id: String,
    configuracao: Object,
    sets: [SetSchema],
    arbitragens: [ArbitragemSchema],
    vencedor: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Partida = mongoose.model('Partida', PartidaSchema);

app.use(express.json());

// Servindo arquivos estáticos da pasta 'frontend'
app.use(express.static(path.resolve(__dirname, '..', 'frontend')));
app.use('/assets', express.static(path.resolve(__dirname, '..', 'assets')));


// --- Rotas da API ---

app.get('/graficos.html', (req, res) => res.sendFile(path.resolve(__dirname, '..', 'frontend', 'graficos.html')));
app.get('/', (req, res) => res.sendFile(path.resolve(__dirname, '..', 'frontend', 'index.html')));

app.post('/api/partida', async (req, res) => {
    try {
        const { configuracao } = req.body;
        const partidaId = uuidv4();
        const novaPartida = new Partida({
            _id: partidaId,
            configuracao,
            sets: [],
            arbitragens: []
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
        const partida = await Partida.findById(req.params.id);
        if (!partida || partida.vencedor) return res.status(400).json({ success: false, message: 'Partida não encontrada ou finalizada.' });
        
        const { vencedor, modalRespostas } = req.body;
        const { playerAName, playerBName } = partida.configuracao;
        let setAtual = partida.sets.find(s => !s.vencedor);
        let gameAtual = setAtual.games[setAtual.games.length - 1];
        let isChangeover = false;

        if (vencedor === playerAName) gameAtual.placarGame.player1++; else gameAtual.placarGame.player2++;
        
        const { tipoPonto, placarFormatado } = formatarPlacarAtual(gameAtual.placarGame, gameAtual.isTiebreak || gameAtual.isSuperTiebreak);

        gameAtual.pontos.push({ 
            pontoId: uuidv4(), 
            vencedor, 
            modalRespostas, 
            sacador: gameAtual.sacador,
            tipoPonto,
            placarNoMomento: placarFormatado,
            timestamp: new Date() 
        });
        
        const vencedorDoGame = gameAtual.isTiebreak || gameAtual.isSuperTiebreak ? checarFimDeTiebreak(gameAtual) : checarFimDeGame(gameAtual);
        
        if (vencedorDoGame) {
            gameAtual.vencedor = (vencedorDoGame === 'player1') ? playerAName : playerBName;

            if (gameAtual.isSuperTiebreak) {
                setAtual.vencedor = gameAtual.vencedor;
                if (gameAtual.vencedor === playerAName) setAtual.placarGames.player1 = 1; else setAtual.placarGames.player2 = 1;
                partida.vencedor = gameAtual.vencedor;
            } else {
                if (vencedorDoGame === 'player1') setAtual.placarGames.player1++; else setAtual.placarGames.player2++;
                
                const resultadoSet = checarFimDeSet(setAtual, partida);
                
                if (resultadoSet.vencedor) {
                    setAtual.vencedor = (resultadoSet.vencedor === 'player1') ? playerAName : playerBName;
                    partida.vencedor = checarFimDePartida(partida);

                    if (!partida.vencedor) {
                        const setsVencidosA = partida.sets.filter(s => s.vencedor === playerAName).length;
                        const setsVencidosB = partida.sets.filter(s => s.vencedor === playerBName).length;
                        const setsNecessariosParaVencer = Math.ceil(partida.configuracao.numSets / 2);
                        const isDecidingSetTime = (setsVencidosA === setsNecessariosParaVencer - 1) && (setsVencidosB === setsNecessariosParaVencer - 1);

                        if (partida.configuracao.superTiebreak && isDecidingSetTime) {
                            const numeroNovoSet = partida.sets.length + 1;
                            const superTiebreakGame = criarGame(partida, true, true);
                            const novoSet = { _id: uuidv4(), numero: numeroNovoSet, placarGames: { player1: 0, player2: 0 }, games: [superTiebreakGame] };
                            partida.sets.push(novoSet);
                        } else {
                            partida.sets.push(criarSet(partida, partida.sets.length + 1));
                        }
                    }
                } else if (resultadoSet.iniciarTiebreak) {
                    setAtual.games.push(criarGame(partida, true, false));
                } else {
                    setAtual.games.push(criarGame(partida, false, false));
                }
            }

            const totalGamesNoSet = setAtual.placarGames.player1 + setAtual.placarGames.player2;
            if (!gameAtual.isTiebreak && !gameAtual.isSuperTiebreak && totalGamesNoSet > 0 && totalGamesNoSet % 2 === 1) {
                isChangeover = true;
            }

        } else if (gameAtual.isTiebreak || gameAtual.isSuperTiebreak) {
             gameAtual.sacador = getSacadorTiebreak(gameAtual, setAtual, playerAName, playerBName, partida);
        }
        
        partida.updatedAt = new Date();
        await partida.save();

        const partidaObj = partida.toObject();
        if (isChangeover) {
            partidaObj.triggerChangeoverModal = true;
            partidaObj.triggeringGameId = gameAtual.gameId;
            partidaObj.triggeringSetId = setAtual._id;
        }

        res.status(200).json({ success: true, partida: partidaObj });

    } catch (err) {
        console.error("Erro ao registrar o ponto:", err);
        res.status(500).json({ success: false, message: 'Erro ao registrar o ponto.', error: err.message });
    }
});

app.post('/api/partida/:partidaId/set/:setId/game/:gameId/changeover', async (req, res) => {
    try {
        const { partidaId, setId, gameId } = req.params;
        const { modalRespostasVirada } = req.body;
        const partida = await Partida.findById(partidaId);
        if (!partida) return res.status(404).json({ success: false, message: 'Partida não encontrada' });
        const set = partida.sets.id(setId);
        if (!set) return res.status(404).json({ success: false, message: 'Set não encontrado' });
        const game = set.games.find(g => g.gameId === gameId);
        if (!game) return res.status(404).json({ success: false, message: 'Game não encontrado' });
        game.changeoverData = modalRespostasVirada;
        await partida.save();
        res.json({ success: true, message: 'Dados de virada de lado salvos.' });
    } catch (error) {
        console.error("Erro ao salvar dados da virada:", error);
        res.status(500).json({ success: false, message: 'Erro ao salvar dados da virada', error: error.message });
    }
});

app.post('/api/partida/:partidaId/set/:setId/comportamento', async (req, res) => {
    try {
        const { partidaId, setId } = req.params;
        const { modalRespostasSet } = req.body;
        const partida = await Partida.findById(partidaId);
        if (!partida) return res.status(404).json({ success: false, message: 'Partida não encontrada' });
        const set = partida.sets.id(setId);
        if (!set) return res.status(404).json({ success: false, message: 'Set não encontrado' });
        set.modalRespostasSet = modalRespostasSet;
        await partida.save();
        res.json({ success: true, partida });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao salvar comportamento do set', error: error.message });
    }
});

app.post('/api/partida/:id/arbitragem', async (req, res) => {
    try {
        const { id } = req.params;
        const { solicitante, resultado, placarNoMomento } = req.body;
        const partida = await Partida.findById(id);
        if (!partida) return res.status(404).json({ success: false, message: 'Partida não encontrada' });
        partida.arbitragens.push({
            arbitragemId: uuidv4(),
            solicitante,
            resultado,
            placarNoMomento,
            timestamp: new Date()
        });
        await partida.save();
        res.json({ success: true, partida });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao salvar registro de arbitragem', error: error.message });
    }
});

app.get('/api/partidas-list', async (req, res) => {
    try {
        const partidas = await Partida.find({}, { configuracao: 1, createdAt: 1, _id: 1 }).sort({ createdAt: -1 }).lean();
        const listaFormatada = partidas.map(p => {
            const playerA = p.configuracao?.playerAName || 'Jogador A';
            const playerB = p.configuracao?.playerBName || 'Jogador B';
            const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : 'Data Desconhecida';
            return { id: p._id, name: `${playerA} vs ${playerB} - ${date}` };
        });
        res.json({ success: true, partidas: listaFormatada });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erro ao buscar a lista de partidas.", error: error.message });
    }
});

app.get('/api/partida/:id', async (req, res) => {
    try {
        const partida = await Partida.findById(req.params.id).lean();
        if (partida) res.json({ success: true, partida });
        else res.status(404).json({ success: false, message: "Partida não encontrada." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erro ao buscar a partida.", error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// --- FUNÇÕES AUXILIARES ---

function formatarPlacarAtual(placarAtual, isTiebreak) {
    const pontos = ["0", "15", "30", "40", "AD"];
    const p1 = placarAtual.player1;
    const p2 = placarAtual.player2;

    if (isTiebreak) {
        return { tipoPonto: `${p1 > p2 ? p1 : p2}`, placarFormatado: `${p1}-${p2}` };
    }
    
    let placarFormatado = `${pontos[p1]}-${pontos[p2]}`;
    let tipoPonto = "Game";

    if (p1 < 4 && p2 < 4) {
        tipoPonto = pontos[Math.max(p1, p2)];
    } else if (p1 === p2) { 
        placarFormatado = "40-40";
        tipoPonto = "40";
    } else if (p1 > p2) {
        placarFormatado = "AD-40";
        tipoPonto = "AD";
    } else { 
        placarFormatado = "40-AD";
        tipoPonto = "AD";
    }

    if ((p1 >= 4 && p1 >= p2 + 2) || (p2 >= 4 && p2 >= p1 + 2)) {
        placarFormatado = "Game";
        tipoPonto = "Game";
    }
    
    return { tipoPonto, placarFormatado };
}

// CORREÇÃO APLICADA AQUI
function getSacador(partida) {
    const { playerAName, playerBName } = partida.configuracao;
    const ultimoSet = partida.sets[partida.sets.length - 1];
    const ultimoGame = ultimoSet.games[ultimoSet.games.length - 1];

    // A lógica é simples: o sacador do novo game é o jogador oposto ao sacador do último game.
    // Isso funciona tanto para a troca de games dentro de um set, quanto para o início de um novo set.
    return ultimoGame.sacador === playerAName ? playerBName : playerAName;
}


function getSacadorTiebreak(gameAtual, setAtual, playerAName, playerBName, partida) {
    const totalPontos = gameAtual.placarGame.player1 + gameAtual.placarGame.player2;

    let primeiroSacadorDoTiebreak;
    if (gameAtual.isSuperTiebreak) {
        primeiroSacadorDoTiebreak = getSacador(partida);
    } else {
        const sacadorGameAnterior = setAtual.games[setAtual.games.length - 2].sacador;
        primeiroSacadorDoTiebreak = sacadorGameAnterior;
    }

    const oponente = primeiroSacadorDoTiebreak === playerAName ? playerBName : playerAName;

    if (totalPontos === 0) {
        return primeiroSacadorDoTiebreak;
    }
    
    if ((totalPontos - 1) % 4 < 2) {
        return oponente;
    } else {
        return primeiroSacadorDoTiebreak;
    }
}

function criarGame(partida, isTiebreak = false, isSuperTiebreak = false) {
    const sacador = getSacador(partida);
    return { gameId: uuidv4(), placarGame: { player1: 0, player2: 0 }, isTiebreak, isSuperTiebreak, sacador, pontos: [] };
}

function criarSet(partida, numeroSet) {
    if (numeroSet === 1) {
        const primeiroSacador = partida.configuracao.playerAName;
        return { _id: uuidv4(), numero: 1, placarGames: { player1: 0, player2: 0 }, games: [{ gameId: uuidv4(), placarGame: { player1: 0, player2: 0 }, isTiebreak: false, isSuperTiebreak: false, sacador: primeiroSacador, pontos: [] }] };
    }
    return { _id: uuidv4(), numero: numeroSet, placarGames: { player1: 0, player2: 0 }, games: [criarGame(partida)] };
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
    const pontosNecessarios = game.isSuperTiebreak ? 10 : 7;
    const pA = game.placarGame.player1;
    const pB = game.placarGame.player2;
    if ((pA >= pontosNecessarios || pB >= pontosNecessarios) && Math.abs(pA - pB) >= 2) {
        return pA > pB ? 'player1' : 'player2';
    }
    return null;
}

function checarFimDeSet(set, partida) {
    const gamesA = set.placarGames.player1;
    const gamesB = set.placarGames.player2;

    if (gamesA === 6 && gamesB === 6) {
        return { vencedor: null, iniciarTiebreak: true, isSuperTiebreak: false };
    }
    
    if ((gamesA >= 6 && (gamesA - gamesB >= 2 || gamesA === 7)) || (gamesB >= 6 && (gamesB - gamesA >= 2 || gamesB === 7))) {
       return { vencedor: gamesA > gamesB ? 'player1' : 'player2', iniciarTiebreak: false };
    }
    
    return { vencedor: null, iniciarTiebreak: false };
}

function checarFimDePartida(partida) {
    const setsParaVencer = Math.ceil(partida.configuracao.numSets / 2);
    const setsA = partida.sets.filter(s => s.vencedor === partida.configuracao.playerAName).length;
    const setsB = partida.sets.filter(s => s.vencedor === partida.configuracao.playerBName).length;

    if (setsA >= setsParaVencer) return partida.configuracao.playerAName;
    if (setsB >= setsParaVencer) return partida.configuracao.playerBName;
    return null;
}