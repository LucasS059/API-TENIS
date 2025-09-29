document.addEventListener('DOMContentLoaded', () => {

    const categorias = [
        "Expressão Emocional", "Linguagem Corporal", "Ritual e Rotina",
        "Comportamento na virada de lado", "Comportamento após finalizar o SET",
        "Arbitragem", "Presença de Gemidos", "Ritmo Entre Pontos",
        "Reação ao Erro", "Ápice de Explosão Emocional", "Auto Análise Técnica", "Monologo"
    ];

    const radarChartConfig = {
        w: 600, h: 600,
        margin: { top: 100, right: 100, bottom: 100, left: 100 },
        levels: 5, maxValue: 1, labelFactor: 1.25, wrapWidth: 80,
        opacityArea: 0.35, dotRadius: 4, opacityCircles: 0.1,
        strokeWidth: 2, roundStrokes: true
    };

    const keyMap = {
        "Expressão Emocional": "expressaoEmocional",
        "Linguagem Corporal": "linguagemCorporal",
        "Ritual e Rotina": "ritual",
        "Comportamento na virada de lado": "viradaGame",
        "Comportamento após finalizar o SET": "comportamentoSet",
        "Arbitragem": "arbitragem_resultado",
        "Presença de Gemidos": "gemidos",
        "Ritmo Entre Pontos": "ritmo",
        "Reação ao Erro": "reacaoErro",
        "Ápice de Explosão Emocional": "explosaoEmocional",
        "Auto Análise Técnica": "autoAnalise",
        "Monologo": "monologo"
    };

    function fetchPartidasList() {
        return fetch('/api/partidas-list')
            .then(response => response.ok ? response.json() : Promise.reject('Erro de rede'))
            .then(data => data.partidas)
            .catch(err => { console.error('Erro fetchPartidasList:', err); return null; });
    }

    function fetchPartidaData(partidaId) {
        if (!partidaId) return Promise.resolve(null);
        return fetch(`/api/partida/${partidaId}`)
            .then(response => response.ok ? response.json() : Promise.reject('Erro de rede'))
            .then(data => data.partida)
            .catch(err => { console.error('Erro fetchPartidaData:', err); return null; });
    }

    function getPropertyCaseInsensitive(obj, key) {
        if(!obj || !key) return undefined;
        const asLowercase = key.toLowerCase();
        const keyFound = Object.keys(obj).find(k => k.toLowerCase() === asLowercase);
        return keyFound ? obj[keyFound] : undefined;
    }

    function processRadarData(partidaData, categorias) {
        if (!partidaData || !Array.isArray(partidaData.sets) || !partidaData.configuracao) return [];
        const sentimentMap = { "Vibração positiva": "positivo", "Expressão equilibrada": "positivo", "Fair Play": "positivo", "Postura ereta": "positivo", "Relaxamento facial": "positivo", "Ativação corporal": "positivo", "Ir à toalha": "positivo", "Ritual pré-ponto": "positivo", "Respiração profunda": "positivo", "Hidratação consistente": "positivo", "Nutrição consistente": "positivo", "Suplementação consistente": "positivo", "Ritual de concentração": "positivo", "Troca de camiseta": "positivo", "Ir ao banheiro após ganhar": "positivo", "Decisão favorável": "positivo", "Consistentes": "positivo", "Equilibrado": "positivo", "Indiferença construtiva": "positivo", "Expressão (dentro das regras)": "positivo", "Sorrir com leveza": "positivo", "Foco visual na quadra": "positivo", "Extravasar (permitido)": "positivo", "Correção técnica (sombra)": "positivo", "Positivo": "positivo", "Ausência de correção verbal": "positivo", "Jogar raquete/xingar": "negativo", "Movimentos bruscos/depressivos": "negativo", "Discussão hostil": "negativo", "Postura caída": "negativo", "Tensão facial": "negativo", "Postura passiva": "negativo", "Demorar entre pontos": "negativo", "Trocar raquete de mão": "negativo", "Manter raquete na mão": "negativo", "Gestos de fraqueza": "negativo", "Respiração ofegante": "negativo", "Não trocar camiseta": "negativo", "Ir ao banheiro após perder": "negativo", "Decisão desfavorável": "negativo", "Ausência": "negativo", "Excessivos": "negativo", "Desatento": "negativo", "Acelerado": "negativo", "Apatia": "negativo", "Expressão (fora das regras)": "negativo", "Sorrir com ironia": "negativo", "Foco visual fora da quadra": "negativo", "Comportamento autolesivo": "negativo", "Ausência de correção": "negativo", "Negativo": "negativo", "Auto-correção negativa": "negativo" };
        const positiveCounts = categorias.reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {});
        const negativeCounts = categorias.reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {});
        partidaData.sets.forEach(set => {
            if (set.games) {
                set.games.forEach(game => {
                    if (game.pontos) {
                        game.pontos.forEach(ponto => {
                            const modal = ponto.modalRespostas || {};
                            for (const cat of categorias) {
                                const key = keyMap[cat];
                                if (!key || cat === "Comportamento na virada de lado" || cat === "Comportamento após finalizar o SET" || cat === "Arbitragem") continue;
                                const values = getPropertyCaseInsensitive(modal, key);
                                if (values && Array.isArray(values)) {
                                    values.forEach(value => {
                                        const sentiment = sentimentMap[value];
                                        if (sentiment === "positivo") positiveCounts[cat]++;
                                        else if (sentiment === "negativo") negativeCounts[cat]++;
                                    });
                                }
                            }
                        });
                    }
                    const changeoverData = game.changeoverData || {};
                    const valuesVirada = getPropertyCaseInsensitive(changeoverData, "viradaGame");
                    if (valuesVirada && Array.isArray(valuesVirada)) {
                        valuesVirada.forEach(value => {
                            const sentiment = sentimentMap[value];
                            if (sentiment === "positivo") positiveCounts["Comportamento na virada de lado"]++;
                            else if (sentiment === "negativo") negativeCounts["Comportamento na virada de lado"]++;
                        });
                    }
                });
            }
            const setEndData = set.modalRespostasSet || {};
            const keySet = keyMap["Comportamento após finalizar o SET"];
            const valuesSet = getPropertyCaseInsensitive(setEndData, keySet);
            if (valuesSet && Array.isArray(valuesSet)) {
                valuesSet.forEach(value => {
                    const sentiment = sentimentMap[value];
                    if (sentiment === "positivo") positiveCounts["Comportamento após finalizar o SET"]++;
                    else if (sentiment === "negativo") negativeCounts["Comportamento após finalizar o SET"]++;
                });
            }
        });
        if (partidaData.arbitragens) {
            partidaData.arbitragens.forEach(arbitragem => {
                const value = arbitragem.resultado;
                const sentiment = sentimentMap[value];
                if (sentiment === "positivo") positiveCounts["Arbitragem"]++;
                else if (sentiment === "negativo") negativeCounts["Arbitragem"]++;
            });
        }
        const aggregatedData = [{ series: "Positivo", values: categorias.map(cat => ({ axis: cat, value: positiveCounts[cat] })) },{ series: "Negativo", values: categorias.map(cat => ({ axis: cat, value: negativeCounts[cat] })) }];
        const maxCounts = d3.max(aggregatedData, d => d3.max(d.values, v => v.value)) || 0;
        radarChartConfig.maxValue = Math.max(1, maxCounts);
        radarChartConfig.color = d3.scaleOrdinal().domain(["Positivo", "Negativo"]).range(["#2ca02c", "#d62728"]);
        return aggregatedData;
    }

    function RadarChart(id, data) {
        const cfg = radarChartConfig;
        d3.select(id).select("svg").remove();
        if (!data || data.length === 0 || !data[0].values.length || data[0].values.every(v => v.value === 0) && data[1].values.every(v => v.value === 0)) {
            d3.select(id).html('<div>Dados insuficientes para o gráfico de perfil</div>');
            return;
        }
        const allAxis = data[0].values.map(i => i.axis), total = allAxis.length, radius = Math.min(cfg.w / 2, cfg.h / 2), angleSlice = Math.PI * 2 / total;
        const rScale = d3.scaleLinear().range([0, radius]).domain([0, cfg.maxValue]);
        const svg = d3.select(id).append("svg").attr("width", cfg.w + cfg.margin.left + cfg.margin.right).attr("height", cfg.h + cfg.margin.top + cfg.margin.bottom).attr("class", "radar-chart-svg");
        const g = svg.append("g").attr("transform", "translate(" + (cfg.w / 2 + cfg.margin.left) + "," + (cfg.h / 2 + cfg.margin.top) + ")");
        const axisGrid = g.append("g").attr("class", "axisWrapper");
        axisGrid.selectAll(".levels").data(d3.range(1, cfg.levels + 1).reverse()).enter().append("circle").attr("class", "gridCircle").attr("r", d => radius / cfg.levels * d).style("fill", "#CDCDCD").style("stroke", "#CDCDCD").style("fill-opacity", cfg.opacityCircles);
        const axis = g.selectAll(".axis").data(allAxis).enter().append("g").attr("class", "axis");
        axis.append("line").attr("x1", 0).attr("y1", 0).attr("x2", (d, i) => rScale(cfg.maxValue * 1.1) * Math.cos(angleSlice * i - Math.PI / 2)).attr("y2", (d, i) => rScale(cfg.maxValue * 1.1) * Math.sin(angleSlice * i - Math.PI / 2)).style("stroke", "grey");
        axis.append("text").attr("class", "legend").style("font-size", "11px").attr("text-anchor", "middle").attr("dy", "0.35em").attr("x", (d, i) => rScale(cfg.maxValue * cfg.labelFactor) * Math.cos(angleSlice * i - Math.PI / 2)).attr("y", (d, i) => rScale(cfg.maxValue * cfg.labelFactor) * Math.sin(angleSlice * i - Math.PI / 2)).text(d => d);
        const radarLine = d3.lineRadial().curve(d3.curveCardinalClosed).radius(d => rScale(d.value)).angle((d, i) => i * angleSlice);
        const blobWrapper = g.selectAll(".radarWrapper").data(data).enter().append("g").attr("class", "radarWrapper");
        blobWrapper.append("path").attr("class", "radarArea").attr("d", d => radarLine(d.values)).style("fill", d => cfg.color(d.series)).style("fill-opacity", cfg.opacityArea)
            .on('mouseover', function () { g.selectAll("path.radarArea").transition().duration(200).style("fill-opacity", 0.1); d3.select(this).transition().duration(200).style("fill-opacity", 0.7); })
            .on('mouseout', function () { g.selectAll("path.radarArea").transition().duration(200).style("fill-opacity", cfg.opacityArea); });
        blobWrapper.append("path").attr("class", "radarStroke").attr("d", d => radarLine(d.values)).style("stroke-width", cfg.strokeWidth + "px").style("stroke", d => cfg.color(d.series)).style("fill", "none");
    }

    function processPointsData(partidaData) {
        if (!partidaData || !partidaData.sets) return { data: [], setBoundaries: [] };
        const players = [partidaData.configuracao.playerAName, partidaData.configuracao.playerBName];
        const combinedData = [];
        const setBoundaries = [];
        let totalPoints = 0;
        partidaData.sets.forEach(set => {
            if (!set.games) return;
            set.games.forEach(game => {
                let gamePointsA = 0;
                let gamePointsB = 0;
                if (!game.pontos) return;
                game.pontos.forEach(ponto => {
                    totalPoints++;
                    if (ponto.vencedor === players[0]) gamePointsA++;
                    else if (ponto.vencedor === players[1]) gamePointsB++;
                    let scoreA_display = 0, scoreB_display = 0;
                    if (game.isTiebreak || game.isSuperTiebreak) {
                        scoreA_display = gamePointsA;
                        scoreB_display = gamePointsB;
                    } else {
                        if (gamePointsA >= 4 && gamePointsA >= gamePointsB + 2) { scoreA_display = 5; } 
                        else if (gamePointsB >= 4 && gamePointsB >= gamePointsA + 2) { scoreB_display = 5; }
                        else if (gamePointsA >= 3 && gamePointsB >= 3) {
                            if (gamePointsA === gamePointsB) { scoreA_display = 3; scoreB_display = 3; }
                            else if (gamePointsA > gamePointsB) { scoreA_display = 4; scoreB_display = 3; }
                            else { scoreA_display = 3; scoreB_display = 4; }
                        } else {
                            scoreA_display = gamePointsA;
                            scoreB_display = gamePointsB;
                        }
                    }
                    const winnerIsPlayerA = ponto.vencedor === players[0];
                    combinedData.push({ x: totalPoints, score: winnerIsPlayerA ? scoreA_display : -scoreB_display, winner: ponto.vencedor });
                });
            });
            if (set.vencedor) { setBoundaries.push(totalPoints); }
        });
        return { data: combinedData, setBoundaries };
    }

    function PointsChart(id, partidaData) {
        const { data, setBoundaries } = processPointsData(partidaData);
        if (!partidaData || !partidaData.configuracao) return;
        const players = [partidaData.configuracao.playerAName, partidaData.configuracao.playerBName];
        if (!data || data.length === 0) {
            d3.select(id).html('<p>Dados insuficientes para gerar o gráfico de pontos.</p>');
            return;
        }
        const margin = { top: 40, right: 40, bottom: 40, left: 80 };
        const chartHeight = 500 - margin.top - margin.bottom;
        const totalPoints = data.length;
        const pointWidth = 40;
        const actualChartWidth = Math.max(800, totalPoints * pointWidth);
        d3.select(id).html('');
        const containerDiv = d3.select(id).append("div").style("overflow-x", "auto").style("width", "100%");
        const svg = containerDiv.append("svg").attr("width", actualChartWidth + margin.left + margin.right).attr("height", chartHeight + margin.top + margin.bottom).append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
        const x = d3.scaleLinear().range([0, actualChartWidth]).domain([0.5, totalPoints + 0.5]);
        const y = d3.scaleLinear().range([chartHeight, 0]).domain([-5, 5]);
        const yAxisLabels = { 0: '0', 1: '15', 2: '30', 3: '40', 4: 'Vantagem', 5: 'Game' };

        svg.append("g").attr("class", "x axis").attr("transform", `translate(0,${y(0)})`).call(d3.axisBottom(x).tickValues(d3.range(1, totalPoints + 1)).tickFormat(d3.format("d")));
        svg.append("g").attr("class", "y axis").call(d3.axisLeft(y).tickValues([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]).tickFormat(d => yAxisLabels[Math.abs(d)] || ''));

        svg.append("g").attr("class", "grid").call(d3.axisLeft(y).tickValues([-5,-4,-3,-2,-1,1,2,3,4,5]).tickSize(-actualChartWidth).tickFormat(""));
        
        svg.append("text").attr("class", "player-label").attr("x", -10).attr("y", y(4)).text(players[0]);
        svg.append("text").attr("class", "player-label").attr("x", -10).attr("y", y(-4)).text(players[1]);

        setBoundaries.forEach(boundary => {
            svg.append("line").attr("class", "set-boundary").attr("x1", x(boundary + 0.5)).attr("y1", 0).attr("x2", x(boundary + 0.5)).attr("y2", chartHeight).style("stroke", "var(--primary-color)").style("stroke-width", "2px").style("stroke-dasharray", "5,5");
        });

        const lineGenerator = d3.line().x(d => x(d.x)).y(d => y(d.score)).curve(d3.curveMonotoneX);
        svg.append("path").datum(data).attr("d", lineGenerator).style("fill", "none").style("stroke", "gray").style("stroke-width", 2);

        const colorMap = { [players[0]]: "var(--player-a-color)", [players[1]]: "var(--player-b-color)" };
        svg.selectAll(".dot").data(data).enter().append("circle").attr("class", "dot").attr("cx", d => x(d.x)).attr("cy", d => y(d.score)).attr("r", 5).style("fill", d => colorMap[d.winner]);
    }

    function processStatsData(partidaData) {
        if (!partidaData || !Array.isArray(partidaData.sets)) return null;
        const players = [partidaData.configuracao.playerAName, partidaData.configuracao.playerBName];
        const stats = {};
        players.forEach(p => {
            stats[p] = { aces: 0, winners: 0, unforcedErrors: 0, doubleFaults: 0, forcedErrors: 0, firstServeAttempted: 0, firstServeMade: 0, secondServeAttempted: 0, secondServeWon: 0, totalPointsWon: 0 };
        });
        partidaData.sets.forEach(set => {
            if (!set.games) return;
            set.games.forEach(game => {
                if (!game.pontos) return;
                game.pontos.forEach(ponto => {
                    const modal = ponto.modalRespostas || {};
                    const vencedor = ponto.vencedor;
                    const perdedor = (vencedor === players[0]) ? players[1] : players[0];
                    const sacador = ponto.sacador;
                    
                    if (vencedor) stats[vencedor].totalPointsWon++;
                    
                    const resultadoArr = getPropertyCaseInsensitive(modal, 'resultadoPonto');
                    if (!resultadoArr || resultadoArr.length === 0) return;
                    
                    const resultado = resultadoArr[0];
                    
                    // --- LÓGICA CORRIGIDA ---
                    switch (resultado) {
                        case 'Ace':
                        case 'Ace (Oponente)':
                            if (vencedor) stats[vencedor].aces++;
                            break;
                        case 'Winner':
                        case 'Winner (Oponente)':
                            if (vencedor) stats[vencedor].winners++;
                            break;
                        case 'Double Fault':
                            if (sacador) stats[sacador].doubleFaults++;
                            break;
                        case 'Unforced Error':
                            if (perdedor) stats[perdedor].unforcedErrors++;
                            break;
                        case 'Forced Error':
                        case 'Forced Error (Oponente)':
                            if (perdedor) stats[perdedor].forcedErrors++;
                            break;
                    }

                    const tipoSaqueArr = getPropertyCaseInsensitive(modal, 'tipoSaque');
                    if (tipoSaqueArr && sacador) {
                        if (tipoSaqueArr.includes("First Serve")) {
                            stats[sacador].firstServeAttempted++;
                            if (resultado !== "Double Fault") {
                                stats[sacador].firstServeMade++;
                            }
                        } else if (tipoSaqueArr.includes("Second Serve")) {
                            stats[sacador].secondServeAttempted++;
                            if (vencedor === sacador) {
                                stats[sacador].secondServeWon++;
                            }
                        }
                    }
                });
            });
        });
        players.forEach(p => {
            const s = stats[p];
            s.firstServePct = (s.firstServeAttempted > 0) ? Math.round((s.firstServeMade / s.firstServeAttempted) * 100) : 0;
            s.secondServeWonPct = (s.secondServeAttempted > 0) ? Math.round((s.secondServeWon / s.secondServeAttempted) * 100) : 0;
        });
        return stats;
    }

    function renderStats(id, partidaData) {
        const stats = processStatsData(partidaData);
        if (!stats) { d3.select(id).html('<div>Nenhuma estatística disponível</div>'); return; }
        const players = [partidaData.configuracao.playerAName, partidaData.configuracao.playerBName];
        const container = d3.select(id).html(''), table = container.append('table').attr('class', 'stats-table');
        const thead = table.append('thead'), headRow = thead.append('tr');
        headRow.append('th').text(players[0]); headRow.append('th').text('Estatística'); headRow.append('th').text(players[1]);
        const tbody = table.append('tbody');
        const rows = [
            { label: 'Aces', key: 'aces' }, 
            { label: 'Winners', key: 'winners' },
            { label: 'Erros não forçados', key: 'unforcedErrors' }, 
            { label: 'Erros forçados', key: 'forcedErrors' },
            { label: 'Duplas faltas', key: 'doubleFaults' },
            { label: '% 1º Saque', key: 'firstServePct' }, 
            { label: '% Pontos Ganhos com 2º Saque', key: 'secondServeWonPct' },
            { label: 'Total de Pontos Ganhos', key: 'totalPointsWon' }
        ];
        rows.forEach(rowDef => {
            const tr = tbody.append('tr');
            tr.append('td').text(stats[players[0]][rowDef.key] + (rowDef.key.includes('Pct') ? '%' : ''));
            tr.append('td').text(rowDef.label);
            tr.append('td').text(stats[players[1]][rowDef.key] + (rowDef.key.includes('Pct') ? '%' : ''));
        });
    }

    function renderAllCharts(partidaData) {
        if (!partidaData) {
            console.error('Dados da partida não foram carregados.');
            d3.select('#radar-chart').html('<div>Selecione uma partida para carregar os dados.</div>');
            d3.select('#points-chart').html('');
            d3.select('#stats-chart').html('');
            return;
        }
        const radarData = processRadarData(partidaData, categorias);
        RadarChart('#radar-chart', radarData);
        PointsChart('#points-chart', partidaData);
        renderStats('#stats-chart', partidaData);
    }

    const dropdown = document.getElementById('partida-dropdown');
    const loadButton = document.getElementById('load-button');

    async function renderSelectedMatch() {
        const selectedPartidaId = dropdown.value;
        if (selectedPartidaId) {
            const partidaData = await fetchPartidaData(selectedPartidaId);
            renderAllCharts(partidaData);
        }
    }

    fetchPartidasList().then(partidas => {
        if (!partidas || partidas.length === 0) {
            console.warn('Nenhuma partida encontrada.');
            dropdown.innerHTML = '<option value="">Nenhuma partida encontrada</option>';
            return;
        }
        dropdown.innerHTML = '<option value="">-- Selecione uma partida --</option>';
        partidas.forEach(partida => {
            const option = document.createElement('option');
            option.value = partida.id;
            option.textContent = partida.name;
            dropdown.appendChild(option);
        });
        if (partidas.length > 0) {
            dropdown.value = partidas[0].id;
            renderSelectedMatch();
        }
    });

    loadButton.addEventListener('click', renderSelectedMatch);
});