document.addEventListener('DOMContentLoaded', () => {
    const appState = {
        partida: null,
        jogadorAtual: null,
        setIDParaComportamento: null,
        triggeringGameId: null,
        triggeringSetId: null,
        lastWinAnswers: {},
        lastLossAnswers: {}
    };

    const PONTUACAO_TENIS = ['0', '15', '30', '40'];

    const api = {
        async request(endpoint, method = 'GET', body = null) {
            try {
                const options = {
                    method,
                    headers: { 'Content-Type': 'application/json' }
                };
                if (body) options.body = JSON.stringify(body);
                const response = await fetch(endpoint, options);
                if (!response.ok) {
                    throw new Error(`Erro de rede: ${response.status} ${response.statusText}`);
                }
                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.message || 'Erro na resposta da API');
                }
                return data;
            } catch (error) {
                console.error("Falha na comunicação com a API:", error);
                return null;
            }
        },
        iniciarPartida: (config) => api.request('/api/partida', 'POST', {
            configuracao: config
        }),
        registrarPonto: (id, data) => api.request(`/api/partida/${id}/ponto`, 'POST', data),
        registrarComportamentoSet: (partidaId, setId, data) => api.request(`/api/partida/${partidaId}/set/${setId}/comportamento`, 'POST', data),
        registrarArbitragem: (id, data) => api.request(`/api/partida/${id}/arbitragem`, 'POST', data),
        registrarComportamentoVirada: (partidaId, setId, gameId, data) => api.request(`/api/partida/${partidaId}/set/${setId}/game/${gameId}/changeover`, 'POST', data),
    };

    const ui = {
        elements: {
            configModal: new bootstrap.Modal('#configModal'),
            pontoModal: new bootstrap.Modal('#meuModal'),
            setModal: new bootstrap.Modal('#setModal'),
            arbitragemModal: new bootstrap.Modal('#arbitragemModal'),
            viradaModal: new bootstrap.Modal('#viradaModal'),
            vencedorModal: new bootstrap.Modal('#vencedorModal'),
            nomeVencedor: document.getElementById('nomeVencedor'),
            btnNovaPartida: document.getElementById('btnNovaPartida'),
            pontoModalTitle: document.getElementById('pontoModalTitle'),
            resultadoPontoTitle: document.getElementById('resultadoPontoTitle'),
            configForm: document.getElementById('configForm'),
            btnReiniciar: document.getElementById('btnReiniciar'),
            btnPontoJogadorA: document.getElementById('btnPontoJogadorA'),
            btnPontoJogadorB: document.getElementById('btnPontoJogadorB'),
            btnSalvarModal: document.getElementById('btnSalvarModal'),
            btnSalvarSet: document.getElementById('btnSalvarSet'),
            btnSalvarArbitragem: document.getElementById('btnSalvarArbitragem'),
            btnSalvarVirada: document.getElementById('btnSalvarVirada'),
            placarDisplay: document.querySelector('.placar-display'),
            nomeJogadorA: document.getElementById('nomeJogadorA'),
            nomeJogadorB: document.getElementById('nomeJogadorB'),
            gameJogadorA: document.getElementById('gameJogadorA'),
            gameJogadorB: document.getElementById('gameJogadorB'),
            confirmacaoSucesso: document.getElementById('confirmacao-sucesso'),
            mensagemConfirmacao: document.getElementById('mensagem-confirmacao'),
            tiebreakContainer: document.getElementById('tiebreak-container'),
            tiebreakTitle: document.getElementById('tiebreak-title'),
            tiebreakRulesText: document.getElementById('tiebreak-rules-text'),
            tbScoreA: document.getElementById('tb-score-a'),
            tbScoreB: document.getElementById('tb-score-b'),
            tbJogadorANome: document.getElementById('tb-jogador-a-nome'),
            tbJogadorBNome: document.getElementById('tb-jogador-b-nome'),
            jogadorAvaliadoDisplay: document.getElementById('jogadorAvaliadoDisplay'),
        },
        abrirModal: (modal) => modal.show(),
        fecharModal(modal) {
            modal.hide();
            setTimeout(() => {
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) backdrop.remove();
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            }, 400);
        },
        mostrarConfirmacao(mensagem) {
            this.elements.mensagemConfirmacao.textContent = mensagem;
            this.elements.confirmacaoSucesso.style.display = 'block';
            setTimeout(() => {
                this.elements.confirmacaoSucesso.style.display = 'none';
            }, 2000);
        },
        resetarModal: (selector) => document.querySelectorAll(`${selector} .btn`).forEach(btn => btn.classList.remove('active')),
        alternarBotoesDePonto: (habilitar = true) => {
            ui.elements.btnPontoJogadorA.disabled = !habilitar;
            ui.elements.btnPontoJogadorB.disabled = !habilitar;
        },
        gerenciarColunasSet(numSets) {
            const gridTemplateColumns = `2fr repeat(${numSets}, 1fr) 1.2fr`;
            ui.elements.placarDisplay.querySelectorAll('.placar-header, .placar-linha').forEach(el => {
                el.style.gridTemplateColumns = gridTemplateColumns;
            });
            for (let i = 1; i <= 5; i++) {
                document.querySelectorAll(`[data-set-col="${i}"], [data-set="${i}"]`).forEach(el => {
                    el.style.display = i <= numSets ? '' : 'none';
                });
            }
        },
        resetarSelecaoSaque: () => {
            document.querySelectorAll('#saque-selector .btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('#saque-selector .btn[data-saque="First Serve"]').classList.add('active');
        },
        setupPontoModal(isWinContext, isAnalyzedPlayerServing, lastAnswers) {
            const {
                pontoModalTitle,
                resultadoPontoTitle
            } = this.elements;
            pontoModalTitle.textContent = 'Avaliação do Ponto';
            if (isWinContext) {
                resultadoPontoTitle.textContent = 'How was the point won';
                resultadoPontoTitle.style.color = 'var(--primary-color)';
            } else {
                resultadoPontoTitle.textContent = 'How was the point lost';
                resultadoPontoTitle.style.color = '#ff4d4d';
            }
            this.resetarModal('#meuModal');
            for (const secao in lastAnswers) {
                const valores = lastAnswers[secao];
                if (Array.isArray(valores)) {
                    valores.forEach(valor => {
                        const btn = document.querySelector(`#meuModal [data-secao="${secao}"] [data-valor="${valor}"]`);
                        if (btn) btn.classList.add('active');
                    });
                }
            }
            document.querySelectorAll('.option-resultado').forEach(el => el.classList.add('d-none'));
            if (isWinContext) {
                document.querySelectorAll('[data-context="win"]').forEach(el => el.classList.remove('d-none'));
                if (isAnalyzedPlayerServing) {
                    document.querySelector('[data-context="win server"]').classList.remove('d-none');
                } else {
                    document.querySelector('[data-context="win receiver"]').classList.remove('d-none');
                }
            } else { // isLossContext
                document.querySelectorAll('[data-context="loss"]').forEach(el => el.classList.remove('d-none'));
                if (isAnalyzedPlayerServing) {
                    document.querySelector('[data-context="loss server"]').classList.remove('d-none');
                } else {
                    document.querySelector('[data-context="loss receiver"]').classList.remove('d-none');
                }
            }
        },
        atualizarPlacar(partida) {
            if (!partida) return;
            const {
                playerAName,
                playerBName,
                jogadorAvaliado,
                numSets
            } = partida.configuracao;
            this.gerenciarColunasSet(numSets);
            this.elements.nomeJogadorA.innerHTML = `${playerAName} <span id="saqueJogadorA"></span>`;
            this.elements.nomeJogadorB.innerHTML = `${playerBName} <span id="saqueJogadorB"></span>`;
            const jogadorAvaliadoNome = (jogadorAvaliado === 'player1') ? playerAName : playerBName;
            this.elements.jogadorAvaliadoDisplay.innerHTML = `Analisando: <strong>${jogadorAvaliadoNome}</strong>`;
            partida.sets.forEach((set, i) => {
                const setCellA = document.querySelector(`#placarJogadorA [data-set="${i + 1}"]`);
                const setCellB = document.querySelector(`#placarJogadorB [data-set="${i + 1}"]`);
                if (setCellA && setCellB) {
                    setCellA.textContent = set.placarGames.player1;
                    setCellB.textContent = set.placarGames.player2;
                }
            });
            const setFinalizado = partida.sets.find(s => s.vencedor && !s.modalRespostasSet);
            if (setFinalizado) {
                appState.setIDParaComportamento = setFinalizado._id;
                this.abrirModal(this.elements.setModal);
            }
            const setAtual = partida.sets[partida.sets.length - 1];
            if (!setAtual || setAtual.games.length === 0) {
                this.alternarBotoesDePonto(false);
                return;
            };
            const gameAtual = setAtual.games[setAtual.games.length - 1];
            const {
                player1: placarA,
                player2: placarB
            } = gameAtual.placarGame;
            const getNextScoreLabel = (playerCurrentScore, opponentCurrentScore) => {
                const isTiebreak = gameAtual.isTiebreak || gameAtual.isSuperTiebreak;
                if (isTiebreak) {
                    const pointsNeeded = gameAtual.isSuperTiebreak ? 10 : 7;
                    if (playerCurrentScore >= pointsNeeded - 1 && playerCurrentScore > opponentCurrentScore) {
                        return gameAtual.isSuperTiebreak ? "Partida" : "Set";
                    }
                    return playerCurrentScore + 1;
                }
                if (playerCurrentScore >= 3 && opponentCurrentScore >= 3) {
                    if (playerCurrentScore === opponentCurrentScore) return 'AD';
                    if (playerCurrentScore < opponentCurrentScore) return '40';
                    return 'Game';
                }
                if (playerCurrentScore >= 3) return 'Game';
                return PONTUACAO_TENIS[playerCurrentScore + 1];
            };
            this.elements.btnPontoJogadorA.textContent = getNextScoreLabel(placarA, placarB);
            this.elements.btnPontoJogadorB.textContent = getNextScoreLabel(placarB, placarA);
            if (gameAtual.isTiebreak || gameAtual.isSuperTiebreak) {
                this.elements.tiebreakContainer.style.display = 'block';
                this.elements.placarDisplay.style.display = 'none';
                this.elements.tiebreakTitle.textContent = gameAtual.isSuperTiebreak ? 'Super Tie-break!' : 'Tie-break!';
                this.elements.tiebreakRulesText.textContent = gameAtual.isSuperTiebreak ? 'Vence quem fizer 10 pontos (com 2 de vantagem).' : 'Vence quem fizer 7 pontos (com 2 de vantagem). O saque troca a cada 2 pontos após o primeiro.';
                this.elements.tbScoreA.textContent = placarA;
                this.elements.tbScoreB.textContent = placarB;
                this.elements.tbJogadorANome.innerHTML = `${playerAName} <span id="tb-saque-a"></span>`;
                this.elements.tbJogadorBNome.innerHTML = `${playerBName} <span id="tb-saque-b"></span>`;
                document.getElementById('tb-saque-a').textContent = (gameAtual.sacador === playerAName) ? ' 🎾' : '';
                document.getElementById('tb-saque-b').textContent = (gameAtual.sacador === playerBName) ? ' 🎾' : '';
            } else {
                this.elements.tiebreakContainer.style.display = 'none';
                this.elements.placarDisplay.style.display = 'grid';
                document.getElementById('saqueJogadorA').textContent = (gameAtual.sacador === playerAName) ? ' 🎾' : '';
                document.getElementById('saqueJogadorB').textContent = (gameAtual.sacador === playerBName) ? ' 🎾' : '';
                if (placarA >= 3 && placarB >= 3) {
                    if (placarA === placarB) {
                        this.elements.gameJogadorA.textContent = '40';
                        this.elements.gameJogadorB.textContent = '40';
                    } else if (placarA > placarB) {
                        this.elements.gameJogadorA.textContent = 'A';
                        this.elements.gameJogadorB.textContent = '40';
                    } else {
                        this.elements.gameJogadorA.textContent = '40';
                        this.elements.gameJogadorB.textContent = 'A';
                    }
                } else {
                    this.elements.gameJogadorA.textContent = PONTUACAO_TENIS[placarA] || '0';
                    this.elements.gameJogadorB.textContent = PONTUACAO_TENIS[placarB] || '0';
                }
            }
            this.alternarBotoesDePonto(!partida.vencedor);
            const btnArbitragem = document.getElementById('btnAbrirModalArbitragem');
            if (partida.vencedor) {
                this.elements.nomeVencedor.textContent = partida.vencedor;
                this.abrirModal(this.elements.vencedorModal);
                btnArbitragem.disabled = true;
            } else {
                btnArbitragem.disabled = false;
            }
        }
    };

    const app = {
        async iniciarPartida() {
            const config = {
                playerAName: document.getElementById('player1').value || 'Jogador A',
                playerBName: document.getElementById('player2').value || 'Jogador B',
                numSets: parseInt(document.getElementById('numSets').value),
                jogadorAvaliado: document.getElementById('jogadorAvaliado').value,
                superTiebreak: document.getElementById('superTiebreak').checked
            };
            document.activeElement.blur();
            const response = await api.iniciarPartida(config);
            if (response && response.partida) {
                ui.fecharModal(ui.elements.configModal);
                appState.partida = response.partida;
                appState.lastWinAnswers = {};
                appState.lastLossAnswers = {};
                ui.atualizarPlacar(appState.partida);
                document.getElementById('saque-selector').style.display = 'flex';
            }
        },
        async registrarPonto() {
            if (!appState.partida || appState.partida.vencedor) return;
            const pontoData = {
                vencedor: appState.jogadorAtual,
                modalRespostas: {}
            };
            const saqueAtivo = document.querySelector('#saque-selector .btn.active');
            pontoData.modalRespostas.tipoSaque = [saqueAtivo ? saqueAtivo.dataset.saque : 'First Serve'];
            document.querySelectorAll('#meuModal .active').forEach(btn => {
                const secao = btn.closest('.modal-section').dataset.secao;
                if (!pontoData.modalRespostas[secao]) pontoData.modalRespostas[secao] = [];
                pontoData.modalRespostas[secao].push(btn.dataset.valor);
            });
            const jogadorAvaliadoKey = appState.partida.configuracao.jogadorAvaliado;
            const jogadorAvaliadoName = (jogadorAvaliadoKey === 'player1') ? appState.partida.configuracao.playerAName : appState.partida.configuracao.playerBName;
            const isWinContext = (appState.jogadorAtual === jogadorAvaliadoName);
            if (isWinContext) {
                appState.lastWinAnswers = { ...pontoData.modalRespostas };
            } else {
                appState.lastLossAnswers = { ...pontoData.modalRespostas };
            }
            const response = await api.registrarPonto(appState.partida._id, pontoData);
            if (response && response.partida) {
                appState.partida = response.partida;
                ui.atualizarPlacar(appState.partida);
                ui.resetarSelecaoSaque();
                if (response.partida.triggerChangeoverModal) {
                    appState.triggeringGameId = response.partida.triggeringGameId;
                    appState.triggeringSetId = response.partida.triggeringSetId;
                    ui.resetarModal('#viradaModal');
                    ui.abrirModal(ui.elements.viradaModal);
                }
            }
        },
        async registrarComportamentoVirada() {
            const modalRespostasVirada = {};
            document.querySelectorAll('#viradaModal .active').forEach(btn => {
                const secao = btn.closest('.modal-section').dataset.secao;
                if (!modalRespostasVirada[secao]) modalRespostasVirada[secao] = [];
                modalRespostasVirada[secao].push(btn.dataset.valor);
            });
            const {
                _id: partidaId
            } = appState.partida;
            const {
                triggeringSetId,
                triggeringGameId
            } = appState;
            if (partidaId && triggeringSetId && triggeringGameId) {
                const response = await api.registrarComportamentoVirada(partidaId, triggeringSetId, triggeringGameId, {
                    modalRespostasVirada
                });
                if (response && response.success) {
                    ui.fecharModal(ui.elements.viradaModal);
                    ui.mostrarConfirmacao('Comportamento de virada salvo!');
                } else {
                    ui.mostrarConfirmacao('Erro ao salvar dados da virada.');
                }
            }
        },
        async registrarComportamentoSet() {
            const modalRespostasSet = {};
            document.querySelectorAll('#setModal .active').forEach(btn => {
                const secao = btn.closest('.modal-section').dataset.secao;
                if (!modalRespostasSet[secao]) modalRespostasSet[secao] = [];
                modalRespostasSet[secao].push(btn.dataset.valor);
            });
            const response = await api.registrarComportamentoSet(appState.partida._id, appState.setIDParaComportamento, {
                modalRespostasSet
            });
            if (response && response.partida) appState.partida = response.partida;
        },
        async registrarArbitragem() {
            const solicitanteBtn = document.querySelector('#arbitragemModal [data-secao="arbitragem_solicitante"] .active');
            const resultadoBtn = document.querySelector('#arbitragemModal [data-secao="arbitragem_resultado"] .active');
            if (!solicitanteBtn || !resultadoBtn) {
                return ui.mostrarConfirmacao('Selecione uma opção de cada categoria.');
            }
            const p = appState.partida;
            const setsA = p.sets.filter(s => s.vencedor === p.configuracao.playerAName).length;
            const setsB = p.sets.filter(s => s.vencedor === p.configuracao.playerBName).length;
            const setAtual = p.sets[p.sets.length - 1];
            const gamesA = setAtual.placarGames.player1;
            const gamesB = setAtual.placarGames.player2;
            const pontosA = ui.elements.gameJogadorA.textContent;
            const pontosB = ui.elements.gameJogadorB.textContent;
            const placarNoMomento = `Sets: ${setsA}-${setsB}, Games: ${gamesA}-${gamesB}, Pontos: ${pontosA}-${pontosB}`;
            const dados = {
                solicitante: solicitanteBtn.dataset.valor,
                resultado: resultadoBtn.dataset.valor,
                placarNoMomento
            };
            const response = await api.registrarArbitragem(appState.partida._id, dados);
            if (response && response.partida) {
                appState.partida = response.partida;
                ui.mostrarConfirmacao('Registro de arbitragem salvo!');
                ui.fecharModal(ui.elements.arbitragemModal);
            }
        },
        init() {
            ui.alternarBotoesDePonto(false);
            ui.elements.configForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.iniciarPartida();
            });
            ui.elements.btnNovaPartida.addEventListener('click', () => {
                ui.fecharModal(ui.elements.vencedorModal);
                ui.abrirModal(ui.elements.configModal);
            });
            ['btnPontoJogadorA', 'btnPontoJogadorB'].forEach(id => {
                ui.elements[id].addEventListener('click', () => {
                    if (!appState.partida) return;
                    const pontoVencedorName = (id === 'btnPontoJogadorA') ? appState.partida.configuracao.playerAName : appState.partida.configuracao.playerBName;
                    appState.jogadorAtual = pontoVencedorName;
                    const jogadorAvaliadoKey = appState.partida.configuracao.jogadorAvaliado;
                    const jogadorAvaliadoName = (jogadorAvaliadoKey === 'player1') ? appState.partida.configuracao.playerAName : appState.partida.configuracao.playerBName;
                    const setAtual = appState.partida.sets[appState.partida.sets.length - 1];
                    const gameAtual = setAtual.games[setAtual.games.length - 1];
                    const sacador = gameAtual.sacador;
                    const isWinContext = (pontoVencedorName === jogadorAvaliadoName);
                    const isAnalyzedPlayerServing = (jogadorAvaliadoName === sacador);
                    const lastAnswers = isWinContext ? appState.lastWinAnswers : appState.lastLossAnswers;
                    ui.setupPontoModal(isWinContext, isAnalyzedPlayerServing, lastAnswers);
                    ui.abrirModal(ui.elements.pontoModal);
                });
            });
            document.querySelectorAll('#saque-selector .btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('#saque-selector .btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                });
            });
            ui.elements.btnSalvarModal.addEventListener('click', () => {
                ui.fecharModal(ui.elements.pontoModal);
                this.registrarPonto();
            });
            ui.elements.btnSalvarSet.addEventListener('click', () => {
                ui.fecharModal(ui.elements.setModal);
                this.registrarComportamentoSet();
            });
            ui.elements.btnSalvarArbitragem.addEventListener('click', () => this.registrarArbitragem());
            ui.elements.btnSalvarVirada.addEventListener('click', () => this.registrarComportamentoVirada());
            document.querySelectorAll('.modal .btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if (e.target.closest('.modal-footer') || e.target.classList.contains('btn-close')) return;
                    const secaoDiv = e.target.closest('.modal-section');
                    if (!secaoDiv) return;
                    const isMultiSelect = secaoDiv.dataset.multiselect === 'true';
                    if (!isMultiSelect) secaoDiv.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.toggle('active');
                });
            });
            const arbitragemModalEl = document.getElementById('arbitragemModal');
            if (arbitragemModalEl) {
                const quemSolicitouSection = arbitragemModalEl.querySelector('#quemSolicitouSection');
                const opcoesArbitragemSection = arbitragemModalEl.querySelector('#opcoesArbitragemSection');
                const footer = arbitragemModalEl.querySelector('.modal-footer');
                const solicitanteOptionsDiv = document.getElementById('arbitragem-solicitante-options');
                const setupArbitragemModal = () => {
                    solicitanteOptionsDiv.innerHTML = '';
                    quemSolicitouSection.style.display = 'block';
                    opcoesArbitragemSection.style.display = 'none';
                    footer.style.display = 'none';
                    ui.resetarModal('#arbitragemModal');
                    if (!appState.partida) return;
                    const {
                        playerAName,
                        playerBName
                    } = appState.partida.configuracao;
                    const players = [playerAName, playerBName];
                    players.forEach(playerName => {
                        const button = document.createElement('button');
                        button.className = 'btn btn-sm btn-secondary w-50';
                        button.dataset.valor = playerName;
                        button.textContent = playerName;
                        button.addEventListener('click', (e) => {
                            solicitanteOptionsDiv.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
                            e.currentTarget.classList.add('active');
                            quemSolicitouSection.style.display = 'none';
                            opcoesArbitragemSection.style.display = 'block';
                        });
                        solicitanteOptionsDiv.appendChild(button);
                    });
                };
                opcoesArbitragemSection.querySelectorAll('.btn').forEach(button => {
                    button.addEventListener('click', () => {
                        footer.style.display = 'flex';
                    });
                });
                arbitragemModalEl.addEventListener('show.bs.modal', setupArbitragemModal);
            }
        }
    };
    app.init();
});