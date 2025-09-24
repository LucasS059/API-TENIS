document.addEventListener('DOMContentLoaded', () => {
    // ========================
    // 1. STATE - Gerencia o estado do jogo
    // ========================
    const appState = {
        partida: null,
        jogadorAtual: null,
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
                return data.partida;
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
    };

    // ========================
    // 3. UI - Manipulação da Interface
    // ========================
    const ui = {
        elements: {
            configModal: new bootstrap.Modal(document.getElementById('configModal')),
            pontoModal: new bootstrap.Modal(document.getElementById('meuModal')),
            configForm: document.getElementById('configForm'),
            btnReiniciar: document.getElementById('btnReiniciar'),
            btnPontoJogadorA: document.getElementById('btnPontoJogadorA'),
            btnPontoJogadorB: document.getElementById('btnPontoJogadorB'),
            btnSalvarModal: document.getElementById('btnSalvarModal'),
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
            document.querySelectorAll('#meuModal .modal-body button.active').forEach(btn => {
                btn.classList.remove('active', 'btn-success');
                btn.classList.add('btn-secondary');
            });
        },

        alternarBotoesDePonto(habilitar = true) {
            this.elements.btnPontoJogadorA.disabled = !habilitar;
            this.elements.btnPontoJogadorB.disabled = !habilitar;
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
            if (!partida) return;

            const { playerAName, playerBName, jogadorAvaliado } = partida.configuracao;
            this.elements.nomeJogadorA.innerHTML = `${playerAName}${jogadorAvaliado === 'player1' ? ' <span style="color:yellow;font-weight:bold;">*</span>' : ''}`;
            this.elements.nomeJogadorB.innerHTML = `${playerBName}${jogadorAvaliado === 'player2' ? ' <span style="color:yellow;font-weight:bold;">*</span>' : ''}`;
            document.getElementById('placarBtnJogadorA').textContent = playerAName;
            document.getElementById('placarBtnJogadorB').textContent = playerBName;

            // Atualiza os sets
            partida.sets.forEach((set, i) => {
                const setCellA = document.getElementById(`set${i + 1}JogadorA`);
                const setCellB = document.getElementById(`set${i + 1}JogadorB`);
                if (setCellA && setCellB) {
                    const gamesA = set.games.filter(g => g.vencedor === playerAName).length;
                    const gamesB = set.games.filter(g => g.vencedor === playerBName).length;

                    // Verifica se o set foi vencido por tie-break
                    if (set.vencedor && set.games.length > 0 && set.games[set.games.length - 1].isTiebreak) {
                        const ultimoGame = set.games[set.games.length - 1];
                        const tbA = ultimoGame.placarGame.player1;
                        const tbB = ultimoGame.placarGame.player2;
                        setCellA.textContent = `${gamesA} (TB: ${tbA})`;
                        setCellB.textContent = `${gamesB} (TB: ${tbB})`;
                    } else {
                        setCellA.textContent = gamesA;
                        setCellB.textContent = gamesB;
                    }
                }
            });

            // Atualiza o game atual e gerencia a visibilidade do placar de tie-break
            const setAtual = partida.sets[partida.sets.length - 1];
            if (setAtual && setAtual.games.length > 0) {
                const gameAtual = setAtual.games[setAtual.games.length - 1];
                
                // Lógica para mostrar o sacador
                this.elements.saqueJogadorA.textContent = (gameAtual.sacador === playerAName) ? ' 🎾' : '';
                this.elements.saqueJogadorB.textContent = (gameAtual.sacador === playerBName) ? ' 🎾' : '';

                if (gameAtual.isTiebreak) {
                    this.elements.tiebreakPlacar.style.display = 'block';
                    this.elements.placarPrincipal.style.display = 'none';
                    this.elements.tbJogadorA.textContent = gameAtual.placarGame.player1;
                    this.elements.tbJogadorB.textContent = gameAtual.placarGame.player2;

                    // Nomes dos jogadores no placar do tie-break
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
            } else {
                this.alternarBotoesDePonto(true);
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

            const partida = await api.registrarPonto(appState.partida._id, pontoData);
            if (partida) {
                appState.partida = partida;
                ui.atualizarPlacar(appState.partida);
            }
        },

        init() {
            ui.alternarBotoesDePonto(false);
            
            const modalButtons = document.querySelectorAll('#meuModal .modal-body button');
            modalButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const secao = btn.dataset.secao;
                    document.querySelectorAll(`#meuModal button[data-secao="${secao}"]`).forEach(b => {
                        b.classList.remove('active', 'btn-success');
                        b.classList.add('btn-secondary');
                    });
                    btn.classList.add('active', 'btn-success');
                    btn.classList.remove('btn-secondary');
                });
            });

            ui.elements.configForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.iniciarPartida();
            });

            ui.elements.btnReiniciar.addEventListener('click', () => {
                ui.abrirModal(ui.elements.configModal);
            });

            ui.elements.btnPontoJogadorA.addEventListener('click', () => {
                appState.jogadorAtual = appState.partida.configuracao.playerAName;
                ui.abrirModal(ui.elements.pontoModal);
            });

            ui.elements.btnPontoJogadorB.addEventListener('click', () => {
                appState.jogadorAtual = appState.partida.configuracao.playerBName;
                ui.abrirModal(ui.elements.pontoModal);
            });

            ui.elements.btnSalvarModal.addEventListener('click', () => {
                ui.fecharModal(ui.elements.pontoModal);
                this.registrarPonto();
                ui.resetarModalDePonto();
                ui.mostrarConfirmacao("Ponto registrado!");
            });
        }
    };

    app.init();
});