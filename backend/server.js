import express from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { processarPonto, formatarPlacarAtual } from './tennisLogic.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const undoBuffer = new Map();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/tennis', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB conectado'))
    .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

const PontoSchema = new mongoose.Schema({
    pontoId: String,
    vencedor: String,
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

app.use(express.static(path.resolve(__dirname, '..', 'frontend')));
app.use('/assets', express.static(path.resolve(__dirname, '..', 'assets')));
app.get('/graficos.html', (req, res) => res.sendFile(path.resolve(__dirname, '..', 'frontend', 'graficos.html')));
app.get('/', (req, res) => res.sendFile(path.resolve(__dirname, '..', 'frontend', 'index.html')));

app.post('/api/partida', async (req, res) => {
    try {
        const { configuracao } = req.body;
        const partidaId = uuidv4();

        const sacadorInicial = configuracao.primeiroSacador === 'player1'
            ? configuracao.playerAName
            : configuracao.playerBName;

        const primeiroSet = {
            _id: uuidv4(),
            numero: 1,
            placarGames: { player1: 0, player2: 0 },
            games: [{
                gameId: uuidv4(),
                placarGame: { player1: 0, player2: 0 },
                sacador: sacadorInicial,
                isTiebreak: false,
                isSuperTiebreak: false,
                pontos: []
            }]
        };

        const novaPartida = new Partida({
            _id: partidaId,
            configuracao,
            sets: [primeiroSet],
            arbitragens: []
        });

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
        if (!partida || partida.vencedor) {
            return res.status(400).json({ success: false, message: 'Partida não encontrada ou finalizada.' });
        }

        const estadoAnterior = JSON.parse(JSON.stringify(partida.toObject()));
        undoBuffer.set(req.params.id, estadoAnterior);

        const { vencedor, modalRespostas } = req.body;
        
        const resultado = processarPonto(partida, vencedor);
        
        const { gameAtual } = resultado;
        gameAtual.pontos.push({
            pontoId: uuidv4(),
            vencedor,
            modalRespostas,
            sacador: gameAtual.sacador,
            placarNoMomento: formatarPlacarAtual(gameAtual.placarGame, gameAtual.isTiebreak || gameAtual.isSuperTiebreak).placarFormatado,
            timestamp: new Date()
        });

        partida.updatedAt = new Date();
        await partida.save();

        const partidaObj = partida.toObject();
        if (resultado.triggerChangeover) {
            partidaObj.triggerChangeoverModal = true;
            partidaObj.triggeringGameId = resultado.gameAtual.gameId;
            partidaObj.triggeringSetId = resultado.setAtual._id;
        }

        res.status(200).json({ success: true, partida: partidaObj });

    } catch (err) {
        console.error("Erro ao registrar o ponto:", err);
        res.status(500).json({ success: false, message: 'Erro ao registrar o ponto.', error: err.message });
    }
});

app.post('/api/partida/:id/undo', async (req, res) => {
    try {
        const partidaId = req.params.id;
        const estadoAnterior = undoBuffer.get(partidaId);

        if (!estadoAnterior) {
            return res.status(404).json({ success: false, message: 'Nenhum ponto para desfazer.' });
        }

        const partidaRestaurada = await Partida.findByIdAndUpdate(partidaId, estadoAnterior, { new: true, upsert: true });

        undoBuffer.delete(partidaId);

        res.status(200).json({ success: true, partida: partidaRestaurada });

    } catch (err) {
        console.error("Erro ao desfazer o ponto:", err);
        res.status(500).json({ success: false, message: 'Erro ao desfazer o ponto.', error: err.message });
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