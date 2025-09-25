document.addEventListener('DOMContentLoaded', () => {
    // ========================
    // 1. STATE - Gerencia o estado do jogo
    // ========================
    const appState = {
        partida: null,
        jogadorAtual: null,
        setIDParaComportamento: null,
        ultimoPontoModalRespostas: null,
        ultimoSetModalRespostas: null,
    };

    const PONTUACAO_TENIS = ['0', '15', '30', '40'];

    // ========================
    // 2. API - Módulo para requisições
    // ========================
    const api = {
        async request(endpoint, method = 'GET', body = null) {
            try {
                const options = {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                };
                if (body) {
                    options.body = JSON.stringify(body);
                }
                const response = await fetch(endpoint, options);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Erro na API: ${errorData.message || response.statusText}`);
                }
                const data = await response.json();
                return data.partida || data.partidas;
            } catch (error) {
                console.error("Falha na comunicação com a API:", error);
                alert("Ocorreu um erro. Verifique o console para mais detalhes.");
                return null;
            }
        },

        iniciarPartida(config) {
            return this.request('/api/partida', 'POST', { configuracao: config });
        },

        registrarPonto(partidaId, pontoData) {
            return this.request(`/api/partida/${partidaId}/ponto`, 'POST', pontoData);
        },

        registrarComportamentoSet(partidaId, setId, modalRespostasSet) {
            return this.request(`/api/partida/${partidaId}/set/${setId}/comportamento`, 'POST', { modalRespostasSet });
        },

        obterRelatorios() {
            return this.request('/api/relatorios', 'GET');
        }
    };

    // ========================
    // 3. UI - Manipulação da Interface
    // ========================
    const ui = {
        elements: {
            configModal: new bootstrap.Modal(document.getElementById('configModal')),
            pontoModal: new bootstrap.Modal(document.getElementById('meuModal')),
            setModal: new bootstrap.Modal(document.getElementById('setModal')),
            configForm: document.getElementById('configForm'),
            btnReiniciar: document.getElementById('btnReiniciar'),
            btnRelatorios: document.getElementById('btnRelatorios'),
            btnPontoJogadorA: document.getElementById('btnPontoJogadorA'),
            btnPontoJogadorB: document.getElementById('btnPontoJogadorB'),
            btnSalvarModal: document.getElementById('btnSalvarModal'),
            btnSalvarSet: document.getElementById('btnSalvarSet'),
            placarContainer: document.querySelector('.placar'),
            relatoriosContainer: document.getElementById('relatoriosContainer'),
            placarHeader: document.getElementById('placarHeader'),
            placarJogadorA: document.getElementById('placarJogadorA'),
            placarJogadorB: document.getElementById('placarJogadorB'),
            nomeJogadorA: document.getElementById('nomeJogadorA'),
            nomeJogadorB: document.getElementById('nomeJogadorB'),
            gameJogadorA: document.getElementById('gameJogadorA'),
            gameJogadorB: document.getElementById('gameJogadorB'),
            confirmacaoSucesso: document.getElementById('confirmacao-sucesso'),
            mensagemConfirmacao: document.getElementById('mensagem-confirmacao'),
            tiebreakPlacar: document.getElementById('tiebreak-placar'),
            tbJogadorA: document.getElementById('tbJogadorA'),
            tbJogadorB: document.getElementById('tbJogadorB'),
            tbJogadorALabel: document.getElementById('tbJogadorALabel'),
            tbJogadorBLabel: document.getElementById('tbJogadorBLabel'),
            placarPrincipal: document.getElementById('placarPrincipal'),
            saqueJogadorA: document.getElementById('saqueJogadorA'),
            saqueJogadorB: document.getElementById('saqueJogadorB'),
        },

        abrirModal(modal) {
            modal.show();
        },

        fecharModal(modal) {
            modal.hide();
        },

        mostrarConfirmacao(mensagem) {
            this.elements.mensagemConfirmacao.textContent = mensagem;
            this.elements.confirmacaoSucesso.style.display = 'block';
            setTimeout(() => {
                if (!appState.partida || appState.partida.vencedor) return;
                this.elements.confirmacaoSucesso.style.display = 'none';
            }, 3000);
        },

        resetarModalDePonto() {
            document.querySelectorAll('#meuModal .modal-body button').forEach(btn => {
                btn.classList.remove('active', 'btn-success');
                btn.classList.add('btn-secondary');
            });
        },

        resetarModalDeSet() {
            document.querySelectorAll('#setModal .modal-body button').forEach(btn => {
                btn.classList.remove('active', 'btn-success');
                btn.classList.add('btn-secondary');
                btn.blur();
            });
        },

        alternarBotoesDePonto(habilitar = true) {
            this.elements.btnPontoJogadorA.disabled = !habilitar;
            this.elements.btnPontoJogadorB.disabled = !habilitar;
        },

        alternarVisualizacaoPlacar(mostrarPlacar = true) {
            this.elements.placarContainer.style.display = mostrarPlacar ? 'block' : 'none';
            this.elements.relatoriosContainer.style.display = mostrarPlacar ? 'none' : 'block';
        },

        criarTabelaPlacar(numSets) {
            const headerRow = this.elements.placarHeader;
            const jogadorARow = this.elements.placarJogadorA;
            const jogadorBRow = this.elements.placarJogadorB;

            while (headerRow.children.length > 2) headerRow.removeChild(headerRow.children[1]);
            while (jogadorARow.children.length > 2) jogadorARow.removeChild(jogadorARow.children[1]);
            while (jogadorBRow.children.length > 2) jogadorBRow.removeChild(jogadorBRow.children[1]);

            for (let i = 1; i <= numSets; i++) {
                const th = document.createElement('td');
                th.textContent = `Set ${i}`;
                th.classList.add('set-col');
                headerRow.insertBefore(th, document.getElementById('gameHeader'));

                const tdJogadorA = document.createElement('td');
                tdJogadorA.id = `set${i}JogadorA`;
                tdJogadorA.textContent = '0';
                tdJogadorA.classList.add('set-col');
                jogadorARow.insertBefore(tdJogadorA, document.getElementById('gameJogadorA'));

                const tdJogadorB = document.createElement('td');
                tdJogadorB.id = `set${i}JogadorB`;
                tdJogadorB.textContent = '0';
                tdJogadorB.classList.add('set-col');
                jogadorBRow.insertBefore(tdJogadorB, document.getElementById('gameJogadorB'));
            }
        },

        atualizarPlacar(partida) {
            if (!partida) {
                this.alternarBotoesDePonto(false);
                return;
            }

            const { playerAName, playerBName, jogadorAvaliado } = partida.configuracao;
            this.elements.nomeJogadorA.innerHTML = `${playerAName}${jogadorAvaliado === 'player1' ? ' <span style="color:yellow;font-weight:bold;">*</span>' : ''}`;
            this.elements.nomeJogadorB.innerHTML = `${playerBName}${jogadorAvaliado === 'player2' ? ' <span style="color:yellow;font-weight:bold;">*</span>' : ''}`;
            document.getElementById('placarBtnJogadorA').textContent = playerAName;
            document.getElementById('placarBtnJogadorB').textContent = playerBName;

            partida.sets.forEach((set, i) => {
                const setCellA = document.getElementById(`set${i + 1}JogadorA`);
                const setCellB = document.getElementById(`set${i + 1}JogadorB`);

                if (setCellA && setCellB) {
                    const gamesFinalizados = set.games.filter(g => g.vencedor);

                    const gamesA = gamesFinalizados.filter(g => g.vencedor === playerAName).length;
                    const gamesB = gamesFinalizados.filter(g => g.vencedor === playerBName).length;

                    if (
                        set.vencedor &&
                        set.games.length > 0 &&
                        set.games[set.games.length - 1].isTiebreak
                    ) {
                        const ultimoGame = set.games[set.games.length - 1];
                        const tbA = ultimoGame.placarGame.player1;
                        const tbB = ultimoGame.placarGame.player2;

                        setCellA.textContent = `${gamesA} TB:${tbA}`;
                        setCellB.textContent = `${gamesB} TB:${tbB}`;
                    } else {
                        setCellA.textContent = gamesA;
                        setCellB.textContent = gamesB;
                    }

                }
            });


            const setAnterior = partida.sets[partida.sets.length - 2];
            if (setAnterior && setAnterior.vencedor && !setAnterior.modalRespostasSet) {
                appState.setIDParaComportamento = setAnterior._id;
                this.abrirModal(this.elements.setModal);
            }

            const setFinal = partida.sets[partida.sets.length - 1];
            if (partida.vencedor && setFinal && setFinal.vencedor && !setFinal.modalRespostasSet) {
                appState.setIDParaComportamento = setFinal._id;
                this.abrirModal(this.elements.setModal);
            }

            const setAtual = partida.sets[partida.sets.length - 1];
            if (setAtual && setAtual.games.length > 0) {
                const gameAtual = setAtual.games[setAtual.games.length - 1];

                this.elements.saqueJogadorA.textContent = (gameAtual.sacador === playerAName) ? ' 🎾' : '';
                this.elements.saqueJogadorB.textContent = (gameAtual.sacador === playerBName) ? ' 🎾' : '';

                if (gameAtual.isTiebreak) {
                    this.elements.tiebreakPlacar.style.display = 'block';
                    this.elements.placarPrincipal.style.display = 'none';
                    this.elements.tbJogadorA.textContent = gameAtual.placarGame.player1;
                    this.elements.tbJogadorB.textContent = gameAtual.placarGame.player2;

                    this.elements.tbJogadorALabel.textContent = playerAName;
                    this.elements.tbJogadorBLabel.textContent = playerBName;

                } else {
                    this.elements.tiebreakPlacar.style.display = 'none';
                    this.elements.placarPrincipal.style.display = 'table';
                    if (gameAtual.vencedor) {
                        this.elements.gameJogadorA.textContent = '0';
                        this.elements.gameJogadorB.textContent = '0';
                    } else {
                        const placarA = gameAtual.placarGame.player1;
                        const placarB = gameAtual.placarGame.player2;

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
                }
            } else {
                this.elements.tiebreakPlacar.style.display = 'none';
                this.elements.placarPrincipal.style.display = 'table';
                this.elements.gameJogadorA.textContent = '0';
                this.elements.gameJogadorB.textContent = '0';
            }

            if (partida.vencedor) {
                this.mostrarConfirmacao(`${partida.vencedor} venceu a partida!`);
                this.alternarBotoesDePonto(false);
                this.elements.btnRelatorios.style.display = 'block';
            } else {
                this.alternarBotoesDePonto(true);
                this.elements.btnRelatorios.style.display = 'none';
            }
        }
    };

    // ========================
    // 4. APP - Lógica do Jogo
    // ========================
    const app = {
        async iniciarPartida() {
            const config = {
                playerAName: document.getElementById('player1').value || 'Jogador A',
                playerBName: document.getElementById('player2').value || 'Jogador B',
                numSets: parseInt(document.getElementById('numSets').value),
                jogadorAvaliado: document.getElementById('jogadorAvaliado').value
            };

            const partida = await api.iniciarPartida(config);
            if (partida) {
                appState.partida = partida;
                ui.criarTabelaPlacar(partida.configuracao.numSets);
                ui.atualizarPlacar(appState.partida);
                ui.fecharModal(ui.elements.configModal);
                ui.alternarVisualizacaoPlacar(true);
            }
        },

        async registrarPonto() {
            if (appState.partida.vencedor) {
                ui.mostrarConfirmacao("O jogo já foi finalizado. Inicie uma nova partida.");
                return;
            }

            const pontoData = {
                vencedor: appState.jogadorAtual,
                modalRespostas: {}
            };
            document.querySelectorAll('#meuModal .modal-body button.active').forEach(btn => {
                const secao = btn.dataset.secao;
                if (!pontoData.modalRespostas[secao]) {
                    pontoData.modalRespostas[secao] = [];
                }
                pontoData.modalRespostas[secao].push(btn.dataset.valor);
            });

            appState.ultimoPontoModalRespostas = pontoData.modalRespostas;

            const partida = await api.registrarPonto(appState.partida._id, pontoData);
            if (partida) {
                appState.partida = partida;
                ui.atualizarPlacar(appState.partida);
            }
        },

        async registrarComportamentoSet() {
            const setID = appState.setIDParaComportamento;
            if (!appState.partida || !setID) {
                console.error("Erro: ID da partida ou do set não encontrado no estado.");
                return;
            }

            const modalRespostasSet = {};
            document.querySelectorAll('#setModal .modal-body button.active').forEach(btn => {
                const secao = btn.dataset.secao;
                if (!modalRespostasSet[secao]) {
                    modalRespostasSet[secao] = [];
                }
                modalRespostasSet[secao].push(btn.dataset.valor);
            });

            appState.ultimoSetModalRespostas = modalRespostasSet;

            const partida = await api.registrarComportamentoSet(appState.partida._id, setID, modalRespostasSet);

            if (partida) {
                const setCorrigido = partida.sets.find(set => set._id === setID);
                if (setCorrigido) {
                    setCorrigido.modalRespostasSet = modalRespostasSet;
                }
                appState.partida = partida;
                ui.atualizarPlacar(appState.partida);
            }
        },

        preencherModalDePonto(respostas) {
            if (!respostas) return;
            for (const secao in respostas) {
                respostas[secao].forEach(valor => {
                    const btn = document.querySelector(`#meuModal button[data-secao="${secao}"][data-valor="${valor}"]`);
                    if (btn) {
                        btn.classList.add('active', 'btn-success');
                        btn.classList.remove('btn-secondary');
                    }
                });
            }
        },

        preencherModalDeSet(respostas) {
            if (!respostas) return;
            for (const secao in respostas) {
                respostas[secao].forEach(valor => {
                    const btn = document.querySelector(`#setModal button[data-secao="${secao}"][data-valor="${valor}"]`);
                    if (btn) {
                        btn.classList.add('active', 'btn-success');
                        btn.classList.remove('btn-secondary');
                    }
                });
            }
        },

        async carregarRelatorios() {
            const partidas = await api.obterRelatorios();
            if (partidas) {
                this.processarDadosRelatorio(partidas);
            }
        },

        processarDadosRelatorio(partidas) {
            const dadosProcessados = {
                tipoPonto: {},
                comportamentoSet: {},
            };
            const jogadorAvaliadoMap = {};

            partidas.forEach(partida => {
                const { jogadorAvaliado, playerAName, playerBName } = partida.configuracao;
                const nomeJogadorAvaliado = (jogadorAvaliado === 'player1') ? playerAName : playerBName;
                jogadorAvaliadoMap[partida._id] = nomeJogadorAvaliado;

                partida.sets.forEach(set => {
                    set.games.forEach(game => {
                        game.pontos.forEach(ponto => {
                            if (ponto.vencedor === nomeJogadorAvaliado && ponto.modalRespostas && ponto.modalRespostas.resultadoPonto) {
                                ponto.modalRespostas.resultadoPonto.forEach(tipo => {
                                    dadosProcessados.tipoPonto[tipo] = (dadosProcessados.tipoPonto[tipo] || 0) + 1;
                                });
                            }
                        });
                    });

                    if (set.modalRespostasSet && set.vencedor === nomeJogadorAvaliado) {
                        set.modalRespostasSet.comportamentoSet.forEach(comportamento => {
                            dadosProcessados.comportamentoSet[comportamento] = (dadosProcessados.comportamentoSet[comportamento] || 0) + 1;
                        });
                    }
                });
            });

            this.desenharGraficoTipoPonto(dadosProcessados.tipoPonto);
            this.desenharGraficoComportamentoSet(dadosProcessados.comportamentoSet);
        },

        desenharGraficoTipoPonto(dados) {
            const ctx = document.getElementById('tipoPontoChart').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: Object.keys(dados),
                    datasets: [{
                        label: 'Frequência do Tipo de Ponto (Jogador Avaliado)',
                        data: Object.values(dados),
                        backgroundColor: 'rgba(255, 206, 86, 0.8)',
                        borderColor: 'rgba(255, 206, 86, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#fff'
                            }
                        }
                    }
                }
            });
        },

        desenharGraficoComportamentoSet(dados) {
            const ctx = document.getElementById('comportamentoSetChart').getContext('2d');
            const cores = [
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 99, 132, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(255, 159, 64, 0.8)',
                'rgba(201, 203, 207, 0.8)'
            ];

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(dados),
                    datasets: [{
                        label: 'Comportamento por Set (Jogador Avaliado)',
                        data: Object.values(dados),
                        backgroundColor: cores,
                        borderColor: '#fff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#fff'
                            }
                        }
                    }
                }
            });
        },

        init() {
            ui.alternarBotoesDePonto(false);

            const modalPontoButtons = document.querySelectorAll('#meuModal .modal-body button');
            modalPontoButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const secao = btn.dataset.secao;
                    const multiselect = document.querySelector(`#meuModal div[data-secao="${secao}"]`).dataset.multiselect === 'true';

                    if (!multiselect) {
                        document.querySelectorAll(`#meuModal button[data-secao="${secao}"]`).forEach(b => {
                            b.classList.remove('active', 'btn-success');
                            b.classList.add('btn-secondary');
                        });
                    }
                    btn.classList.toggle('active');
                    btn.classList.toggle('btn-success');
                    btn.classList.toggle('btn-secondary');
                });
            });

            const modalSetButtons = document.querySelectorAll('#setModal .modal-body button');
            modalSetButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const secao = btn.dataset.secao;
                    const multiselect = document.querySelector(`#setModal div[data-secao="${secao}"]`).dataset.multiselect === 'true';

                    if (!multiselect) {
                        document.querySelectorAll(`#setModal button[data-secao="${secao}"]`).forEach(b => {
                            b.classList.remove('active', 'btn-success');
                            b.classList.add('btn-secondary');
                        });
                    }
                    btn.classList.toggle('active');
                    btn.classList.toggle('btn-success');
                    btn.classList.toggle('btn-secondary');
                });
            });

            ui.elements.configForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.iniciarPartida();
            });

            ui.elements.btnReiniciar.addEventListener('click', () => {
                ui.abrirModal(ui.elements.configModal);
                ui.alternarVisualizacaoPlacar(true);
            });

            ui.elements.btnPontoJogadorA.addEventListener('click', () => {
                appState.jogadorAtual = appState.partida.configuracao.playerAName;
                ui.resetarModalDePonto();
                ui.abrirModal(ui.elements.pontoModal);
                this.preencherModalDePonto(appState.ultimoPontoModalRespostas);
            });

            ui.elements.btnPontoJogadorB.addEventListener('click', () => {
                appState.jogadorAtual = appState.partida.configuracao.playerBName;
                ui.resetarModalDePonto();
                ui.abrirModal(ui.elements.pontoModal);
                this.preencherModalDePonto(appState.ultimoPontoModalRespostas);
            });

            ui.elements.btnSalvarModal.addEventListener('click', () => {
                ui.fecharModal(ui.elements.pontoModal);
                this.registrarPonto();
                ui.mostrarConfirmacao("Ponto registrado!");
            });

            ui.elements.btnSalvarSet.addEventListener('click', () => {
                ui.fecharModal(ui.elements.setModal);
                this.registrarComportamentoSet();
                ui.mostrarConfirmacao("Comportamento do set registrado!");
            });

            ui.elements.setModal._element.addEventListener('show.bs.modal', () => {
                ui.resetarModalDeSet();
                this.preencherModalDeSet(appState.ultimoSetModalRespostas);
            });

            ui.elements.btnRelatorios.addEventListener('click', () => {
                ui.alternarVisualizacaoPlacar(false);
                this.carregarRelatorios();
            });
        }
    };

    app.init();
});