document.addEventListener('DOMContentLoaded', () => {

    const categorias = [
        "Expressão Emocional",
        "Linguagem Corporal",
        "Ritual",
        "Comportamento na virada de lado",
        "Comportamento após finalizar o SET",
        "Arbitragem",
        "Presença de Gemidos",
        "Ritmo Entre Pontos",
        "Reação ao Erro",
        "Ápice de Explosão Emocional",
        "Auto Análise Técnica",
        "Monologo"
    ];

    const radarChartConfig = {
        w: 600,
        h: 600,
        margin: { top: 100, right: 100, bottom: 100, left: 100 },
        levels: 5,
        maxValue: 0,
        labelFactor: 1.25,
        wrapWidth: 60,
        opacityArea: 0.35,
        dotRadius: 4,
        opacityCircles: 0.1,
        strokeWidth: 2,
        roundStrokes: true,
        color: d3.scaleOrdinal(d3.schemeCategory10)
    };

    const keyMap = {
        "Expressão Emocional": "emocional",
        "Linguagem Corporal": "linguagemCorporal",
        "Ritual": "ritual",
        "Comportamento na virada de lado": "virada",
        "Comportamento após finalizar o SET": "comportamentoSet",
        "Arbitragem": "arbitragem",
        "Presença de Gemidos": "gemidos",
        "Ritmo Entre Pontos": "ritmo",
        "Reação ao Erro": "reacaoErro",
        "Ápice de Explosão Emocional": "apiceEmocional",
        "Auto Análise Técnica": "analiseTecnica",
        "Monologo": "monologo"
    };

    function fetchPartidasList() {
        return fetch('/api/partidas-list')
            .then(r => r.ok ? r.json() : Promise.reject('Erro ao buscar a lista de partidas'))
            .catch(err => {
                console.error('Erro fetchPartidasList:', err);
                return null;
            });
    }

    function fetchPartidaData(partidaId) {
        if (!partidaId) return Promise.resolve(null);
        return fetch(`/api/partida/${partidaId}`)
            .then(r => r.ok ? r.json() : Promise.reject('Erro ao buscar dados da partida'))
            .catch(err => {
                console.error('Erro fetchPartidaData:', err);
                return null;
            });
    }

    function getModalArray(modal, fieldName) {
        if (!modal) return [];
        const keys = Object.keys(modal);
        const found = keys.find(k => k.toLowerCase() === fieldName.toLowerCase());
        if (!found) return [];
        const val = modal[found];
        if (val == null) return [];
        return Array.isArray(val) ? val : [String(val)];
    }

    function arrayContainsAny(arr, targets) {
        if (!arr || arr.length === 0) return false;
        const lowerArr = arr.map(x => String(x).toLowerCase());
        return targets.some(t => {
            const tl = t.toLowerCase();
            return lowerArr.some(a => a.includes(tl));
        });
    }

function processRadarData(partidaData, categorias) {
    if (!partidaData || !Array.isArray(partidaData.sets)) return [];
    const players = [partidaData.configuracao.playerAName, partidaData.configuracao.playerBName];

    const aggregatedData = players.map(player => {
        const counts = categorias.reduce((acc, categoria) => { acc[categoria] = 0; return acc; }, {});

        partidaData.sets.forEach(set => {
            const comportamentoSetModal = set.modalRespostasSet || {};
            const comportamentoSetArr = getModalArray(comportamentoSetModal, keyMap["Comportamento após finalizar o SET"]);

            if (set.vencedor === player && comportamentoSetArr.length > 0) {
                 counts["Comportamento após finalizar o SET"]++;
            }

            if (!set.games) return;
            set.games.forEach(game => {
                if (!game.pontos) return;
                game.pontos.forEach(ponto => {
                    const modal = ponto.modalRespostas || {};
                    categorias.forEach(categoria => {
                        const key = keyMap[categoria];
                        if (!key || key === 'comportamentoSet') return;

                        const arr = getModalArray(modal, key);
                        
                        if (arr && arr.length > 0) {
                            if (['ritual', 'virada', 'arbitragem'].includes(key) && arrayContainsAny(arr, [player])) {
                                counts[categoria]++;
                            } 
                            else if (ponto.vencedor === player || arrayContainsAny(arr, [player])) {
                                counts[categoria]++;
                            }
                        }
                    });
                });
            });
        });
        return {
            player,
            values: categorias.map(categoria => ({ axis: categoria, value: counts[categoria] }))
        };
    });

    const maxCounts = d3.max(aggregatedData, d => d3.max(d.values, v => v.value)) || 0;
    radarChartConfig.maxValue = Math.max(1, maxCounts);

    return aggregatedData;
}
    function RadarChart(id, data) {
        const cfg = radarChartConfig;
        d3.select(id).select("svg").remove();
        if (!data || data.length === 0) {
            d3.select(id).html('<div>Dados insuficientes para o gráfico de radar</div>');
            return;
        }

        const allAxis = data[0].values.map(i => i.axis);
        const total = allAxis.length;
        const radius = Math.min(cfg.w / 2, cfg.h / 2);
        const angleSlice = Math.PI * 2 / total;

        const rScale = d3.scaleLinear().range([0, radius]).domain([0, cfg.maxValue]);

        const svg = d3.select(id).append("svg")
            .attr("width", cfg.w + cfg.margin.left + cfg.margin.right)
            .attr("height", cfg.h + cfg.margin.top + cfg.margin.bottom)
            .attr("class", "radar-chart-svg");

        const g = svg.append("g")
            .attr("transform", "translate(" + (cfg.w / 2 + cfg.margin.left) + "," + (cfg.h / 2 + cfg.margin.top) + ")");

        const axisGrid = g.append("g").attr("class", "axisWrapper");

        axisGrid.selectAll(".levels")
            .data(d3.range(1, cfg.levels + 1).reverse())
            .enter().append("circle")
            .attr("class", "gridCircle")
            .attr("r", d => radius / cfg.levels * d)
            .style("fill", "#CDCDCD")
            .style("stroke", "#CDCDCD")
            .style("fill-opacity", cfg.opacityCircles);

        const axis = g.selectAll(".axis").data(allAxis).enter().append("g").attr("class", "axis");

        axis.append("line")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", (d, i) => rScale(cfg.maxValue * 1.1) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("y2", (d, i) => rScale(cfg.maxValue * 1.1) * Math.sin(angleSlice * i - Math.PI / 2))
            .style("stroke", "grey");

        axis.append("text")
            .attr("class", "legend")
            .style("font-size", "11px")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("x", (d, i) => rScale(cfg.maxValue * cfg.labelFactor) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("y", (d, i) => rScale(cfg.maxValue * cfg.labelFactor) * Math.sin(angleSlice * i - Math.PI / 2))
            .text(d => d);

        const radarLine = d3.lineRadial()
            .curve(d3.curveCardinalClosed)
            .radius(d => rScale(d.value))
            .angle((d, i) => i * angleSlice);

        const blobWrapper = g.selectAll(".radarWrapper")
            .data(data).enter().append("g").attr("class", "radarWrapper");

        blobWrapper.append("path")
            .attr("class", "radarArea")
            .attr("d", d => radarLine(d.values))
            .style("fill", (d, i) => cfg.color(i))
            .style("fill-opacity", cfg.opacityArea)
            .on('mouseover', function () {
                g.selectAll("path.radarArea").transition().duration(200).style("fill-opacity", 0.1);
                d3.select(this).transition().duration(200).style("fill-opacity", 0.7);
            })
            .on('mouseout', function () {
                g.selectAll("path.radarArea").transition().duration(200).style("fill-opacity", cfg.opacityArea);
            });

        blobWrapper.append("path")
            .attr("class", "radarStroke")
            .attr("d", d => radarLine(d.values))
            .style("stroke-width", cfg.strokeWidth + "px")
            .style("stroke", (d, i) => cfg.color(i))
            .style("fill", "none");

        const legend = g.append("g")
            .attr("class", "legend")
            .attr("height", 200)
            .attr("width", 200)
            .attr("transform", `translate(${cfg.w / 2 + 50}, -${cfg.h / 2})`);
        
        legend.selectAll('rect')
            .data(data)
            .enter()
            .append("rect")
            .attr("x", 0)
            .attr("y", (d, i) => i * 20)
            .attr("width", 10)
            .attr("height", 10)
            .style("fill", (d, i) => cfg.color(i));

        legend.selectAll('text')
            .data(data)
            .enter()
            .append("text")
            .attr("x", 15)
            .attr("y", (d, i) => i * 20 + 9)
            .text(d => d.player)
            .style("font-size", "12px");
    }

    function processPointsData(partidaData) {
        if (!partidaData || !partidaData.sets) return { data: {}, setBoundaries: [] };
        const players = [partidaData.configuracao.playerAName, partidaData.configuracao.playerBName];
        const data = { [players[0]]: [], [players[1]]: [] };
        const setBoundaries = [];
        let totalPoints = 0;

        partidaData.sets.forEach(set => {
            if (!set.games) return;
            set.games.forEach(game => {
                if (!game.pontos) return;
                let gamePointsA = 0;
                let gamePointsB = 0;

                game.pontos.forEach(ponto => {
                    totalPoints++;
                    if (ponto.vencedor === players[0]) {
                        gamePointsA++;
                    } else if (ponto.vencedor === players[1]) {
                        gamePointsB++;
                    }

                    if (gamePointsA >= 4 && gamePointsA >= gamePointsB + 2) {
                        data[players[0]].push({ x: totalPoints, score: 5, pointWinner: ponto.vencedor });
                        data[players[1]].push({ x: totalPoints, score: gamePointsB, pointWinner: ponto.vencedor });
                    } else if (gamePointsB >= 4 && gamePointsB >= gamePointsA + 2) {
                        data[players[0]].push({ x: totalPoints, score: gamePointsA, pointWinner: ponto.vencedor });
                        data[players[1]].push({ x: totalPoints, score: 5, pointWinner: ponto.vencedor });
                    } else {
                        let scoreA_display = 0;
                        let scoreB_display = 0;

                        if (gamePointsA >= 3 && gamePointsB >= 3) {
                            if (gamePointsA === gamePointsB) {
                                scoreA_display = 3;
                                scoreB_display = 3;
                            } else if (gamePointsA > gamePointsB) {
                                scoreA_display = 4;
                                scoreB_display = 3;
                            } else {
                                scoreA_display = 3;
                                scoreB_display = 4;
                            }
                        } else {
                            const scoreMap = [0, 1, 2, 3];
                            scoreA_display = scoreMap[gamePointsA] || 0;
                            scoreB_display = scoreMap[gamePointsB] || 0;
                        }

                        data[players[0]].push({ x: totalPoints, score: scoreA_display, pointWinner: ponto.vencedor });
                        data[players[1]].push({ x: totalPoints, score: scoreB_display, pointWinner: ponto.vencedor });
                    }
                });
            });
            if (totalPoints > 0) {
                setBoundaries.push(totalPoints);
            }
        });
        return { data, setBoundaries };
    }


    function PointsChart(id, partidaData) {
        const { data, setBoundaries } = processPointsData(partidaData);
        const players = [partidaData.configuracao.playerAName, partidaData.configuracao.playerBName];
        if (!data[players[0]] || data[players[0]].length === 0) {
            d3.select(id).html('<p>Dados insuficientes para gerar o gráfico de pontos.</p>');
            return;
        }

        const margin = { top: 50, right: 20, bottom: 50, left: 70 };
        const visibleWidth = 960;
        const chartHeight = 500 - margin.top - margin.bottom;
        const totalPoints = d3.max(data[players[0]], d => d.x) || 1;
        const actualChartWidth = Math.max(visibleWidth - margin.left - margin.right, totalPoints * 40);

        d3.select(id).html('');

        const container = d3.select(id).append("div")
            .attr("class", "points-chart-container")
            .style("width", `${visibleWidth}px`)
            .style("height", `${chartHeight + margin.top + margin.bottom}px`);

        const svg = container.append("svg")
            .attr("width", actualChartWidth + margin.left + margin.right)
            .attr("height", chartHeight + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        const x = d3.scaleLinear().range([0, actualChartWidth]);
        const y = d3.scaleLinear().range([chartHeight, 0]);

        x.domain([0.5, totalPoints + 0.5]);
        y.domain([-5, 5]);

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + chartHeight / 2 + ")")
            .call(d3.axisBottom(x).tickValues(d3.range(1, totalPoints + 1)).tickFormat(d3.format("d")));

        const yAxisLabels = {
            0: '0',
            1: '15',
            2: '30',
            3: '40',
            4: 'Vantagem',
            5: 'Game'
        };

        svg.append("g")
            .attr("class", "y axis")
            .call(d3.axisLeft(y)
                .tickValues(d3.range(-5, 6))
                .tickFormat(d => yAxisLabels[Math.abs(d)] || '')
            );

        svg.append("text")
            .attr("class", "player-label")
            .attr("transform", `translate(${-margin.left + 15}, ${y(4.5)}) rotate(-90)`)
            .text(players[0]);

        svg.append("text")
            .attr("class", "player-label")
            .attr("transform", `translate(${-margin.left + 15}, ${y(-4.5)}) rotate(-90)`)
            .text(players[1]);

        svg.append("line")
            .attr("class", "center-line")
            .attr("x1", x(0.5))
            .attr("y1", y(0))
            .attr("x2", x(totalPoints + 0.5))
            .attr("y2", y(0));

        setBoundaries.forEach(boundary => {
            svg.append("line")
                .attr("class", "set-boundary")
                .attr("x1", x(boundary + 0.5))
                .attr("y1", 0)
                .attr("x2", x(boundary + 0.5))
                .attr("y2", chartHeight);
        });

        svg.append("g").attr("class", "grid").call(d3.axisLeft(y).tickSize(-actualChartWidth).tickFormat(""));
        svg.append("g").attr("class", "grid").attr("transform", `translate(0, ${chartHeight / 2})`).call(d3.axisBottom(x).tickSize(-chartHeight).tickFormat(""));

        const lineGeneratorA = d3.line().x(d => x(d.x)).y(d => y(d.score));
        const lineGeneratorB = d3.line().x(d => x(d.x)).y(d => y(-d.score));

        svg.append("path").datum(data[players[0]]).attr("class", "line").attr("d", lineGeneratorA).style("stroke", "steelblue");
        svg.append("path").datum(data[players[1]]).attr("class", "line").attr("d", lineGeneratorB).style("stroke", "orange");

        svg.selectAll(".dotA").data(data[players[0]]).enter().append("circle").attr("class", "dotA dot")
            .attr("cx", d => x(d.x))
            .attr("cy", d => y(d.score))
            .attr("r", 5)
            .style("fill", "steelblue");

        svg.selectAll(".dotB").data(data[players[1]]).enter().append("circle").attr("class", "dotB dot")
            .attr("cx", d => x(d.x))
            .attr("cy", d => y(-d.score))
            .attr("r", 5)
            .style("fill", "orange");
    }

    function processStatsData(partidaData) {
        if (!partidaData || !Array.isArray(partidaData.sets)) return null;
        const players = [partidaData.configuracao.playerAName, partidaData.configuracao.playerBName];
        const stats = {};
        players.forEach(p => {
            stats[p] = {
                aces: 0, winners: 0, unforcedErrors: 0, doubleFaults: 0,
                firstServeAttempted: 0, firstServeMade: 0,
                secondServeAttempted: 0, secondServeWon: 0, totalPointsWon: 0
            };
        });

        partidaData.sets.forEach(set => {
            if (!set.games) return;
            set.games.forEach(game => {
                if (!game.pontos) return;
                game.pontos.forEach(ponto => {
                    const modal = ponto.modalRespostas || {};
                    const vencedor = ponto.vencedor;
                    const sacador = ponto.sacador || game.sacador;
                    const perdedor = vencedor === players[0] ? players[1] : players[0];

                    const resultadoArr = getModalArray(modal, 'resultadoPonto');
                    const tipoSaqueArr = getModalArray(modal, 'tipoSaque');

                    if (arrayContainsAny(resultadoArr, ["Ace"]) && vencedor === sacador) stats[vencedor].aces++;
                    if (arrayContainsAny(resultadoArr, ["Winner"])) stats[vencedor].winners++;
                    if (arrayContainsAny(resultadoArr, ["Double Fault", "DoubleFault"])) if (sacador) stats[sacador].doubleFaults++;
                    if (arrayContainsAny(resultadoArr, ["Unforced Error"])) if (perdedor) stats[perdedor].unforcedErrors++;
                    if (vencedor) stats[vencedor].totalPointsWon++;
                    if (arrayContainsAny(tipoSaqueArr, ["First Serve"])) {
                        if (sacador) {
                            stats[sacador].firstServeAttempted++;
                            if (vencedor === sacador) stats[sacador].firstServeMade++;
                        }
                    } else if (arrayContainsAny(tipoSaqueArr, ["Second Serve"])) {
                        if (sacador) {
                            stats[sacador].secondServeAttempted++;
                            if (vencedor === sacador) stats[sacador].secondServeWon++;
                        }
                    }
                });
            });
        });

        players.forEach(p => {
            const s = stats[p];
            s.firstServePct = (s.firstServeAttempted > 0) ? Math.round((s.firstServeMade / s.firstServeAttempted) * 100) : null;
            s.secondServePct = (s.secondServeAttempted > 0) ? Math.round((s.secondServeWon / s.secondServeAttempted) * 100) : null;
        });

        return stats;
    }

    function renderStats(id, partidaData) {
        const stats = processStatsData(partidaData);
        if (!stats) {
            d3.select(id).html('<div>Nenhuma estatística disponível</div>');
            return;
        }

        const players = [partidaData.configuracao.playerAName, partidaData.configuracao.playerBName];
        const container = d3.select(id).html('');
        const table = container.append('table').attr('class', 'stats-table');

        const thead = table.append('thead');
        const headRow = thead.append('tr');
        headRow.append('th').text(players[0]);
        headRow.append('th').text('Estatística');
        headRow.append('th').text(players[1]);

        const tbody = table.append('tbody');

        const rows = [
            { label: 'Aces', key: 'aces' },
            { label: 'Winners', key: 'winners' },
            { label: 'Unforced Errors', key: 'unforcedErrors' },
            { label: 'Double Faults', key: 'doubleFaults' },
            { label: '1º Saque (in/attempt %)', key: 'firstServe' },
            { label: '2º Saque (won/attempt %)', key: 'secondServe' },
            { label: 'Total Points Won', key: 'totalPointsWon' }
        ];

        rows.forEach(rowDef => {
            const tr = tbody.append('tr');
            if (rowDef.key === 'firstServe') {
                const left = stats[players[0]];
                const right = stats[players[1]];
                tr.append('td').text(left.firstServeAttempted ? `${left.firstServeMade}/${left.firstServeAttempted} (${left.firstServePct !== null ? left.firstServePct + '%' : '-'})` : '-');
                tr.append('td').text(rowDef.label);
                tr.append('td').text(right.firstServeAttempted ? `${right.firstServeMade}/${right.firstServeAttempted} (${right.firstServePct !== null ? right.firstServePct + '%' : '-'})` : '-');
            } else if (rowDef.key === 'secondServe') {
                const left = stats[players[0]];
                const right = stats[players[1]];
                tr.append('td').text(left.secondServeAttempted ? `${left.secondServeWon}/${left.secondServeAttempted} (${left.secondServePct !== null ? left.secondServePct + '%' : '-'})` : '-');
                tr.append('td').text(rowDef.label);
                tr.append('td').text(right.secondServeAttempted ? `${right.secondServeWon}/${right.secondServeAttempted} (${right.secondServePct !== null ? right.secondServePct + '%' : '-'})` : '-');
            } else {
                tr.append('td').text(stats[players[0]][rowDef.key] ?? 0);
                tr.append('td').text(rowDef.label);
                tr.append('td').text(stats[players[1]][rowDef.key] ?? 0);
            }
        });
    }

    function renderAllCharts(partidaData) {
        if (!partidaData) {
            console.error('Dados da partida não foram carregados. Não é possível renderizar.');
            return;
        }

        const radarData = processRadarData(partidaData, categorias);
        if (radarData && radarData.length > 0) {
            RadarChart('#radar-chart', radarData);
        } else {
            console.warn('Radar: dados insuficientes');
            d3.select('#radar-chart').html('<div>Dados insuficientes para o gráfico de radar</div>');
        }

        PointsChart('#points-chart', partidaData);
        renderStats('#stats-chart', partidaData);
    }

    const dropdown = document.getElementById('partida-dropdown');
    const loadButton = document.getElementById('load-button');

    fetchPartidasList().then(partidas => {
        if (!partidas || partidas.length === 0) {
            console.warn('Nenhuma partida encontrada ou erro ao carregar.');
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

    function renderSelectedMatch() {
        const selectedPartidaId = dropdown.value;
        if (selectedPartidaId) {
            fetchPartidaData(selectedPartidaId).then(partidaData => {
                renderAllCharts(partidaData);
            });
        }
    }
});