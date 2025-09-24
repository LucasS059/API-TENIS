import { Schema, model } from 'mongoose';

// Pontos individuais
const PontoSchema = new Schema({
  pontoId: String,
  numeroPonto: Number,
  vencedor: String, // playerAName ou playerBName
  placarPonto: {
    player1: Number,
    player2: Number
  },
  modalRespostas: {
    tipoSaque: [String], // CORRIGIDO: de String para [String]
    resultadoPonto: [String], // CORRIGIDO: de String para [String]
    playerPonto: [String], // CORRIGIDO: de String para [String]
    golpe: [String], // CORRIGIDO: de String para [String]
    tipoShot: [String], // CORRIGIDO: de String para [String]
    shotLocation: [String], // CORRIGIDO: de String para [String]
    rallyLength: [String], // CORRIGIDO: de String para [String]
    ritual: [String], // CORRIGIDO: de String para [String]
    linguagemCorporal: [String], // CORRIGIDO: de String para [String]
    emocional: [String], // CORRIGIDO: de String para [String]
    monologo: [String], // CORRIGIDO: de String para [String]
    analiseTecnica: [String], // CORRIGIDO: de String para [String]
    apiceEmocional: [String], // CORRIGIDO: de String para [String]
    reacaoErro: [String], // CORRIGIDO: de String para [String]
    ritmo: [String], // CORRIGIDO: de String para [String]
    gemidos: [String], // CORRIGIDO: de String para [String]
    virada: [String], // CORRIGIDO: de String para [String]
    arbitragem: [String] // CORRIGIDO: de String para [String]
  }
}, { _id: false });

// ... (o resto do seu código permanece o mesmo)
const GameSchema = new Schema({
  gameId: String,
  numeroGame: Number,
  isTiebreak: Boolean,
  placarGame: {
    player1: Number,
    player2: Number
  },
  pontos: [PontoSchema]
}, { _id: false });

const SetSchema = new Schema({
  setId: String,
  numeroSet: Number,
  vencedor: String,
  games: [GameSchema],
  hasTiebreak: { type: Boolean, default: false },
  placarTiebreak: {
    player1: Number,
    player2: Number
  },
  tiebreakPontos: [PontoSchema]
}, { _id: false });

const PartidaSchema = new Schema({
  configuracao: {
    playerAName: String,
    playerBName: String,
    numSets: Number,
    jogadorAvaliado: String
  },
  sets: [SetSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default model('Partida', PartidaSchema);