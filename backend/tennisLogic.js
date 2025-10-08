import { v4 as uuidv4 } from 'uuid';

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
    const { player1: gamesA, player2: gamesB } = set.placarGames;
    const { configuracao, sets } = partida;
    const { playerAName, playerBName, numSets, formatoSetDecisivo } = configuracao;

    const setsParaVencer = Math.ceil(numSets / 2);
    const setsVencidosA = sets.filter(s => s.vencedor === playerAName && s._id !== set._id).length;
    const setsVencidosB = sets.filter(s => s.vencedor === playerBName && s._id !== set._id).length;
    const isDecidingSet = (setsVencidosA === setsParaVencer - 1) && (setsVencidosB === setsParaVencer - 1);

    if (isDecidingSet && formatoSetDecisivo === 'vantagem') {
        if (gamesA >= 6 && gamesA - gamesB >= 2) return { vencedor: 'player1' };
        if (gamesB >= 6 && gamesB - gamesA >= 2) return { vencedor: 'player2' };
        return {};
    }

    if (gamesA >= 6 && gamesA - gamesB >= 2) return { vencedor: 'player1' };
    if (gamesB >= 6 && gamesB - gamesA >= 2) return { vencedor: 'player2' };

    if (gamesA === 6 && gamesB === 6) {
        return { iniciarTiebreak: true };
    }

    return {};
}

function checarFimDePartida(partida) {
    const { configuracao, sets } = partida;
    const { playerAName, playerBName, numSets } = configuracao;
    const setsParaVencer = Math.ceil(numSets / 2);
    const setsA = sets.filter(s => s.vencedor === playerAName).length;
    const setsB = sets.filter(s => s.vencedor === playerBName).length;

    if (setsA >= setsParaVencer) return playerAName;
    if (setsB >= setsParaVencer) return playerBName;
    return null;
}

function getProximoSacador(partida) {
    const { playerAName, playerBName } = partida.configuracao;
    for (let i = partida.sets.length - 1; i >= 0; i--) {
        const set = partida.sets[i];
        if (set.games.length > 0) {
            const ultimoGame = set.games[set.games.length - 1];
            return ultimoGame.sacador === playerAName ? playerBName : playerAName;
        }
    }
    return playerAName;
}

function getSacadorTiebreak(gameAtual, partida) {
    const { playerAName, playerBName } = partida.configuracao;
    const totalPontos = gameAtual.placarGame.player1 + gameAtual.placarGame.player2;
    const setAtual = partida.sets.find(s => s.games.some(g => g.gameId === gameAtual.gameId));

    let primeiroSacadorDoTiebreak;

    if (gameAtual.isSuperTiebreak) {
        const indexSetAtual = partida.sets.findIndex(s => s._id === setAtual._id);
        if (indexSetAtual > 0) {
            const setAnterior = partida.sets[indexSetAtual - 1];
            const ultimoGameDoSetAnterior = setAnterior.games[setAnterior.games.length - 1];
            primeiroSacadorDoTiebreak = ultimoGameDoSetAnterior.sacador === playerAName ? playerBName : playerAName;
        } else {
            primeiroSacadorDoTiebreak = getProximoSacador(partida);
        }
    } else {
        // O último game regular é o penúltimo na lista de games do set
        const ultimoGameRegular = setAtual.games[setAtual.games.length - 2];
        primeiroSacadorDoTiebreak = ultimoGameRegular.sacador === playerAName ? playerBName : playerAName;
    }

    // Se for o primeiro ponto, o sacador é quem foi definido para iniciar.
    if (totalPontos === 0) {
        return primeiroSacadorDoTiebreak;
    }

    // A regra do tie-break é: após o primeiro ponto, o saque troca a cada 2 pontos.
    // Isso acontece quando a soma total de pontos é 1, 3, 5, 7... (números ímpares).
    if (totalPontos % 2 !== 0) {
        // Se a soma de pontos é ímpar, o sacador do PRÓXIMO ponto inverte.
        const sacadorAtual = gameAtual.sacador;
        return sacadorAtual === playerAName ? playerBName : playerAName;
    } else {
        // Se a soma de pontos é par, o sacador do PRÓXIMO ponto se mantém.
        return gameAtual.sacador;
    }
}

function criarGame(partida, isTiebreak = false, isSuperTiebreak = false) {
    return {
        gameId: uuidv4(),
        placarGame: { player1: 0, player2: 0 },
        sacador: getProximoSacador(partida),
        isTiebreak,
        isSuperTiebreak,
        pontos: []
    };
}

function criarSet(partida, numeroSet, isSuperTiebreak = false) {
    let primeiroGame;
    if (isSuperTiebreak) {
        primeiroGame = criarGame(partida, true, true);
    } else {
        primeiroGame = criarGame(partida);
    }
    return { _id: uuidv4(), numero: numeroSet, placarGames: { player1: 0, player2: 0 }, games: [primeiroGame] };
}

function iniciarProximoSetSeNecessario(partida) {
    if (partida.vencedor) {
        return;
    }
    const { playerAName, playerBName, numSets, formatoSetDecisivo } = partida.configuracao;
    const setsVencidosA = partida.sets.filter(s => s.vencedor === playerAName).length;
    const setsVencidosB = partida.sets.filter(s => s.vencedor === playerBName).length;
    const setsParaVencer = Math.ceil(numSets / 2);
    const isNextSetDeciding = (setsVencidosA === setsParaVencer - 1) && (setsVencidosB === setsParaVencer - 1);
    const useSuperTiebreak = formatoSetDecisivo === 'supertiebreak' && isNextSetDeciding;
    partida.sets.push(criarSet(partida, partida.sets.length + 1, useSuperTiebreak));
}

function formatarPlacarAtual(placarAtual, isTiebreak) {
    const pontos = ["0", "15", "30", "40", "AD"];
    const p1 = placarAtual.player1;
    const p2 = placarAtual.player2;
    if (isTiebreak) return { placarFormatado: `${p1}-${p2}` };
    if (p1 >= 3 && p2 >= 3) {
        if (p1 === p2) return { placarFormatado: "40-40" };
        if (p1 > p2) return { placarFormatado: "AD-40" };
        return { placarFormatado: "40-AD" };
    }
    return { placarFormatado: `${pontos[p1]}-${pontos[p2]}` };
}

function processarPonto(partida, vencedorDoPonto) {
    const { playerAName } = partida.configuracao;
    let setAtual = partida.sets[partida.sets.length - 1];
    let gameAtual = setAtual.games[setAtual.games.length - 1];
    let triggerChangeover = false;

    const jogadorKey = vencedorDoPonto === playerAName ? 'player1' : 'player2';
    gameAtual.placarGame[jogadorKey]++;

    const isTiebreakOrSuper = gameAtual.isTiebreak || gameAtual.isSuperTiebreak;
    const vencedorDoGameKey = isTiebreakOrSuper ? checarFimDeTiebreak(gameAtual) : checarFimDeGame(gameAtual);

    if (!vencedorDoGameKey) {
        if (isTiebreakOrSuper) {
            gameAtual.sacador = getSacadorTiebreak(gameAtual, partida);
            const totalPontosTiebreak = gameAtual.placarGame.player1 + gameAtual.placarGame.player2;
            if (totalPontosTiebreak > 0 && totalPontosTiebreak % 6 === 0) {
                triggerChangeover = true;
            }
        }
    } else {
        gameAtual.vencedor = (vencedorDoGameKey === 'player1') ? playerAName : partida.configuracao.playerBName;
        setAtual.placarGames[vencedorDoGameKey]++;

        const totalGamesNoSet = setAtual.placarGames.player1 + setAtual.placarGames.player2;
        if (!isTiebreakOrSuper && (totalGamesNoSet % 2 !== 0)) {
            triggerChangeover = true;
        }

        if (isTiebreakOrSuper) {
            setAtual.vencedor = gameAtual.vencedor;
            partida.vencedor = checarFimDePartida(partida);
            iniciarProximoSetSeNecessario(partida);
        } else {
            const resultadoSet = checarFimDeSet(setAtual, partida);
            if (resultadoSet.vencedor) {
                setAtual.vencedor = (resultadoSet.vencedor === 'player1') ? playerAName : partida.configuracao.playerBName;
                partida.vencedor = checarFimDePartida(partida);
                iniciarProximoSetSeNecessario(partida);
            } else if (resultadoSet.iniciarTiebreak) {
                setAtual.games.push(criarGame(partida, true));
            } else {
                setAtual.games.push(criarGame(partida));
            }
        }
    }

    return { partida, triggerChangeover, gameAtual, setAtual };
}

export { processarPonto, formatarPlacarAtual };