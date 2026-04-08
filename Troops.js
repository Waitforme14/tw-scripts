Excelente! Usar um script reconhecido pela comunidade (neste caso, o "Troops Counter" do RedAlert/dalesmckay) como base é a melhor forma de garantir que tem uma interface bonita e funcional, além de estar dentro das regras.

Fiz as seguintes alterações ao script que me passou:
1. **Tradução:** Traduzi os nomes das tropas no código para português (Lanças, Espadas, etc.), para que tanto a interface como a mensagem do Discord fiquem na sua língua.
2. **Botão Discord:** Adicionei um botão azul escuro "📤 Enviar para o Discord" no final da aba de visualização.
3. **Lógica de Extração:** Criei uma função que, ao clicar no botão, lê a tabela do jogo e separa as tropas exatamente como pediu: **Totais** (Próprias), **Dentro de casa** (Na aldeia) e **Fora de casa** (Em apoio a outras aldeias).

### O que tem de fazer agora:
Como já tem tudo configurado no GitHub, **não precisa de alterar nada na sua barra de acesso rápido no jogo**. Só precisa de ir ao seu repositório no GitHub, editar o ficheiro `Troops.js`, apagar o código antigo e colar este novo código lá. Graças ao *jsDelivr*, o jogo vai puxar esta nova versão automaticamente!

Aqui tem o código completo atualizado:

javascript
var strVersion = 'v8.6 (Discord Mod)';
var latestUpdated = '2023-12-25';

// Traduzido para PT para o Discord e UI
var unitDesc = {
    spear: 'Lanças',
    sword: 'Espadas',
    axe: 'Bárbaros',
    archer: 'Arqueiros',
    spy: 'Exploradores',
    light: 'Cavalaria Leve',
    marcher: 'Arq. a Cavalo',
    heavy: 'Cavalaria Pesada',
    ram: 'Aríetes',
    catapult: 'Catapultas',
    knight: 'Paladino',
    snob: 'Nobres',
    militia: 'Milícia',
    offense: 'Ofensivas',
    defense: 'Defensivas',
};

if (typeof unitConfig == 'undefined') {
    unitConfig = fnCreateUnitConfig();
}

// User Input
if (typeof DRAGGABLE !== 'boolean') DRAGGABLE = false;

function fnExecuteScript() {
    initDebug();

    var isTroopsOverviewScreen = checkScreen('overview_villages', 'units');

    if (isTroopsOverviewScreen) {
        fnCalculateTroopCount();
    } else {
        UI.ErrorMessage(
            'Script must be run from <a href="/game.php?screen=overview_villages&mode=units" class="btn">Troops Overview</a>',
            5000
        );
    }
}

function fnTranslate(id) {
    var translation = {
        en: [
            'Full Train Nukes',
            'Full Defense Trains',
            'Other Nobles',
            'Full Nukes',
            '3/4 Nukes',
            '1/2 Nukes',
            '1/4 Nukes',
            'Catapult Nukes',
            'Full Defense',
            '3/4 Defense',
            '1/2 Defense',
            '1/4 Defense',
            'Full Scouts',
            '3/4 Scouts',
            '1/2 Scouts',
            '1/4 Scouts',
            'Other',
            'Troops Counter',
            'Noble Armies',
            'Offensive Armies',
            'Defensive Armies',
            'Scout Armies',
            'Other Armies',
            'Offensive Units',
            'Defensive Units',
            'Other Units',
            'Total Units',
            'Co-ordinates',
        ],
    };

    var lang = typeof (translation[game_data.market] == 'undefined')
        ? 'en'
        : game_data.market;
    if (typeof translation[lang][id] == 'undefined') {
        return '';
    }

    return translation[lang][id];
}

function fnAjaxRequest(url, sendMethod, params, type) {
    var payload = null;
    $.ajax({
        async: false,
        url: url,
        data: params,
        dataType: type,
        type: String(sendMethod || 'GET').toUpperCase(),
        error: function (req, status, err) {
            console.error('[Troops Counter] Error: ', err);
        },
        success: function (data, status, req) {
            payload = data;
        },
    });
    return payload;
}

function fnCreateConfig(name) {
    var response = null;
    response = fnAjaxRequest('/interface.php', 'GET', { func: name }, 'xml');
    return $(response).find('config');
}

function fnCreateUnitConfig() {
    return fnCreateConfig('get_unit_info');
}

function fnHasArchers() {
    return game_data.units.includes('archer');
}

function fnHasMilitia() {
    return game_data.units.includes('militia');
}

function fnGetTroopCount() {
    var gameVersion = parseFloat(
        game_data.version.split(' ')[1].replace('release_', '')
    ); 

    var colCount = $('#units_table ' + (gameVersion >= 7.1 ? 'thead' : 'tbody:eq(0)') + ' th').length - 2;
    var villageTroopInfo = [];

    $('#units_table > tbody').each(function (row) {
        $(this).find('tr:last').remove();
    });

    $('#units_table tbody' + (gameVersion < 7.1 ? ':gt(0)' : '')).each(
        function (row, eleRow) {
            var villageData = {
                troops: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            };

            coords = $(eleRow).find('td:eq(0)').text().match(/\d+\|\d+/g);
            coords = coords ? coords[coords.length - 1].match(/(\d+)\|(\d+)/) : null;
            if(coords) {
                villageData.x = parseInt(coords[1], 10);
                villageData.y = parseInt(coords[2], 10);
                villageData.coords = coords[0];
            }

            $(eleRow).find('td:gt(0):not(:has(>a))').each(function (cell, eleCell) {
                if (cell % colCount) {
                    if (Math.floor(cell / colCount) != 1) {
                        villageData.troops[(cell % colCount) - 1] +=
                            parseInt($(eleCell).text() || '0', 10);
                    }
                }
            });
            villageTroopInfo.push(villageData);
        }
    );
    return villageTroopInfo;
}

function fnCriteriaToStr(criteria) {
    var valueStr = '';
    if (criteria && criteria.length > 0) {
        for (var ii = 0; ii < criteria.length; ii++) {
            if (typeof criteria[ii].minpop != 'undefined') {
                valueStr += (valueStr ? ' and ' : '') + '(' + unitDesc[criteria[ii].unit] + '[pop] >= ' + criteria[ii].minpop + ')';
            }
            if (typeof criteria[ii].maxpop != 'undefined') {
                valueStr += (valueStr ? ' and ' : '') + '(' + unitDesc[criteria[ii].unit] + '[pop] < ' + criteria[ii].maxpop + ')';
            }
        }
    }
    return valueStr;
}

// -------------------------------------------------------------------------
// FUNÇÃO EXCLUSIVA PARA EXTRAIR E ENVIAR DADOS PARA O DISCORD
// -------------------------------------------------------------------------
function fnSendToDiscord() {
    const webhookUrl = window.meuWebhookTW;
    if (!webhookUrl) {
        UI.ErrorMessage('Erro: O link do Webhook não foi encontrado na barra de acesso rápido!');
        return;
    }

    let discordData = { total: {}, inside: {}, outside: {} };
    let unitColumns = [];

    // Descobre em que coluna está cada tropa
    jQuery('#units_table thead th').each(function(index) {
        let img = jQuery(this).find('img').attr('src');
        if (img) {
            for (let i = 0; i < game_data.units.length; i++) {
                if (img.includes('unit_' + game_data.units[i])) {
                    unitColumns[index] = game_data.units[i];
                    discordData.total[game_data.units[i]] = 0;
                    discordData.inside[game_data.units[i]] = 0;
                    discordData.outside[game_data.units[i]] = 0;
                    break;
                }
            }
        }
    });

    // Percorre a tabela e soma as tropas de acordo com a linha
    jQuery('#units_table tbody tr').each(function() {
        let text = jQuery(this).text().toLowerCase();
        let isTotal = text.includes('próprias');
        let isInside = text.includes('na aldeia');
        let isOutside = text.includes('fora');

        if (isTotal || isInside || isOutside) {
            jQuery(this).find('td').each(function(index) {
                if (unitColumns[index]) {
                    let val = parseInt(jQuery(this).text().trim().replace(/\./g, ''), 10);
                    if (!isNaN(val)) {
                        let unit = unitColumns[index];
                        if (isTotal) discordData.total[unit] += val;
                        if (isInside) discordData.inside[unit] += val;
                        if (isOutside) discordData.outside[unit] += val;
                    }
                }
            });
        }
    });

    const playerName = game_data.player.name;
    
    // Função auxiliar para formatar a linha do Discord
    const formatRow = (dataObj) => {
        let str = '';
        for (let unit in dataObj) {
            if (dataObj[unit] > 0) {
                 let unitName = unitDesc[unit] || unit;
                 str += `**${unitName}:** ${dataObj[unit].toLocaleString('pt-PT')} | `;
            }
        }
        return str.replace(/ \| $/, '') || 'Nenhuma tropa';
    };

    let msg = `📊 **Relatório Detalhado de Tropas - ${playerName}**\n\n`;
    msg += `🛡️ **TOTAIS (Próprias):**\n${formatRow(discordData.total)}\n\n`;
    msg += `🏠 **DENTRO DE CASA (Na aldeia):**\n${formatRow(discordData.inside)}\n\n`;
    msg += `⛺ **FORA DE CASA (Apoios/Fora):**\n${formatRow(discordData.outside)}`;

    // Interface de carregamento do botão
    jQuery('#btnSendDiscord').text('A enviar...').prop('disabled', true);
    
    fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg, username: 'Tribal Wars Tracker' })
    })
    .then(res => {
        if (res.ok) UI.SuccessMessage('Relatório detalhado enviado para o Discord!', 3000);
        else UI.ErrorMessage('Erro ao enviar para o Discord. Verifique o URL.');
    })
    .catch(err => UI.ErrorMessage('Erro de ligação: ' + err))
    .finally(() => {
        jQuery('#btnSendDiscord').text('📤 Enviar para o Discord').prop('disabled', false);
    });
}
// -------------------------------------------------------------------------

function fnCalculateTroopCount() {
    const playerName = game_data.player.name;
    const playerId = game_data.player.id;
    const playerPoints = game_data.player.points;

    let totalTroops = 0;

    const showPlayer = `<b>Player:</b> <a href="/game.php?screen=info_player&id=${playerId}" target="_blank" rel="noopener noreferrer">${playerName}</a><br>`;
    const showTroopsPointRatio = `<b>Troops/Points Ratio:</b> <span id="troopsPointsRatio"></span><br>`;

    const serverTime = jQuery('#serverTime').text();
    const serverDate = jQuery('#serverDate').text();
    const serverDateTime = `<b>Server Time:</b> ${serverTime} ${serverDate}<br><hr>`;

    const currentGroupValue = jQuery('#paged_view_content .vis_item > strong').text().trim().slice(1, -1);
    const currentGroup = `<b>Current Group:</b> ${currentGroupValue}<br>`;

    var maxGroups = 17;
    var outputSummary = {
        'Full Train Nuke': { group: 'Nobles', criteria: [{ unit: 'snob', minpop: 400 }, { unit: 'offense', minpop: 19600 }], descID: 0 },
        'Full Defense Train': { group: 'Nobles', criteria: [{ unit: 'snob', minpop: 400 }, { unit: 'defense', minpop: 19600 }], descID: 1 },
        'Other Nobles': { group: 'Nobles', criteria: [{ unit: 'snob', minpop: 100 }, { unit: 'defense', maxpop: 19600 }, { unit: 'offense', maxpop: 19600 }], descID: 2 },
        'Full Nuke': { group: 'Offensive', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'offense', minpop: 20000 }], descID: 3 },
        'Semi Nuke': { group: 'Offensive', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'offense', minpop: 15000, maxpop: 20000 }], descID: 4 },
        'Half Nuke': { group: 'Offensive', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'offense', minpop: 10000, maxpop: 15000 }], descID: 5 },
        'Quarter Nuke': { group: 'Offensive', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'offense', minpop: 5000, maxpop: 10000 }], descID: 6 },
        'Cat Nuke': { group: 'Offensive', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'catapult', minpop: 800 }, { unit: 'offense', minpop: 20000 }], descID: 7 },
        'Full Defense': { group: 'Defensive', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'defense', minpop: 20000 }], descID: 8 },
        'Semi Defense': { group: 'Defensive', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'defense', minpop: 15000, maxpop: 20000 }], descID: 9 },
        'Half Defense': { group: 'Defensive', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'defense', minpop: 10000, maxpop: 15000 }], descID: 10 },
        'Quarter Defense': { group: 'Defensive', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'defense', minpop: 5000, maxpop: 10000 }], descID: 11 },
        'Full Scout': { group: 'Scouts', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'spy', minpop: 20000 }], descID: 12 },
        'Semi Scout': { group: 'Scouts', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'spy', minpop: 15000, maxpop: 20000 }], descID: 13 },
        'Half Scout': { group: 'Scouts', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'spy', minpop: 10000, maxpop: 15000 }], descID: 14 },
        'Quarter Scout': { group: 'Scouts', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'spy', minpop: 5000, maxpop: 10000 }], descID: 15 },
        Other: { group: 'Other', criteria: [{ unit: 'snob', maxpop: 100 }, { unit: 'spy', maxpop: 5000 }, { unit: 'defense', maxpop: 5000 }, { unit: 'offense', maxpop: 5000 }], descID: 16 },
    };

    var ii, jj, village, total, index, count, unit, item, key, criteria, condition, isValid;
    var defense = ['spear', 'sword', 'heavy', 'catapult'];
    var offense = ['axe', 'light', 'ram', 'catapult'];

    if (fnHasArchers()) { defense.push('archer'); offense.push('marcher'); }
    if (fnHasMilitia()) { defense.push('militia'); }

    var summary = {
        unitTotal: { tally: 0, population: 0 },
        defense: { tally: 0, count: 0, population: 0, coords: [] },
        offense: { tally: 0, count: 0, population: 0, coords: [] },
    };

    $(unitConfig).children().each(function (i, e) {
        summary[e.nodeName] = { tally: 0, count: 0, population: 0, coords: [] };
    });

    for (item in outputSummary) {
        if (outputSummary.hasOwnProperty(item)) {
            summary[item] = { tally: 0, count: 0, population: 0, coords: [] };
        }
    }

    var villageTroops = fnGetTroopCount();
    for (ii = 0; ii < villageTroops.length; ii++) {
        village = villageTroops[ii];
        total = {
            defense: { tally: 0, count: 0, population: 0, coords: [] },
            offense: { tally: 0, count: 0, population: 0, coords: [] },
        };

        $(unitConfig).children().each(function (i, e) {
            total[e.nodeName] = { tally: 0, count: 0, population: 0, coords: [] };
        });

        index = 0;
        $(unitConfig).children().each(function (i, e) {
            var unit = e.nodeName;
            total[unit].count += village.troops[index];
            total[unit].population += village.troops[index] * parseInt($(e).find('pop').text(), 10);

            if (new RegExp('^(' + defense.join('|') + ')$').test(unit)) {
                total.defense.count += total[unit].count;
                total.defense.population += total[unit].population;
            }

            if (new RegExp('^(' + offense.join('|') + ')$').test(unit)) {
                total.offense.count += total[unit].count;
                total.offense.population += total[unit].population;
            }

            summary[unit].count += total[unit].count;
            summary[unit].population += total[unit].population;
            summary.unitTotal.tally += total[unit].count;
            summary.unitTotal.population += total[unit].population;
            index++;
        });

        summary.defense.count += total.defense.count;
        summary.defense.population += total.defense.population;
        summary.offense.count += total.offense.count;
        summary.offense.population += total.offense.population;

        for (item in outputSummary) {
            if (outputSummary.hasOwnProperty(item)) {
                isValid = true;
                for (jj = 0; jj < outputSummary[item].criteria.length; jj++) {
                    criteria = outputSummary[item].criteria[jj];
                    if (!(typeof criteria.minpop == 'undefined' || !criteria.minpop || total[criteria.unit].population >= criteria.minpop)) isValid = false;
                    if (!(typeof criteria.maxpop == 'undefined' || !criteria.maxpop || total[criteria.unit].population < criteria.maxpop)) isValid = false;
                }
                if (isValid) {
                    summary[item].coords.push(village.coords);
                    summary[item].tally++;
                }
            }
        }
    }

    var groupSummary = {};
    for (item in outputSummary) {
        if (outputSummary.hasOwnProperty(item)) {
            if (typeof groupSummary[outputSummary[item].group] == 'undefined') {
                groupSummary[outputSummary[item].group] = [];
            }
            groupSummary[outputSummary[item].group].push(item);
        }
    }

    var curGroup = maxGroups;
    totalTroops = summary.unitTotal.population;
    const intPlayerPoints = parseInt(playerPoints);
    let troopsToPointsRatio = 0.0;

    if (intPlayerPoints !== 0) {
        troopsToPointsRatio = (totalTroops / intPlayerPoints).toFixed(2);
    }

    setTimeout(function () {
        jQuery('#troopsPointsRatio').text(troopsToPointsRatio);
    }, 100);

    var docSource = '';
    docSource += '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">\n';
    docSource += '<html><head><script type="text/javascript">';
    docSource += 'function fnShowCoords(id,description){ var coords={};';
    for (item in outputSummary) {
        if (outputSummary.hasOwnProperty(item)) {
            if (summary[item].coords.length) {
                docSource += 'coords["' + item + '"] = "' + summary[item].coords.join(' ') + '";\n';
            }
        }
    }
    docSource += 'document.getElementById("coords_group").innerHTML = description;';
    docSource += 'var eleCoords = document.getElementById("coords_container");';
    docSource += 'eleCoords.value = coords[id]?coords[id]:"";';
    docSource += 'eleCoords.focus(); eleCoords.select();}</script></head><body>';
    docSource += '<table class="main" width="100%" align="center"><tr><td>';
    docSource += '<h2>' + fnTranslate(curGroup++) + '<sup><span style="font-size:small;"></span></sup></h2>';
    docSource += `${showPlayer}${showTroopsPointRatio}${currentGroup}${serverDateTime}`;
    docSource += '<table class="not-draggable"><tr><td width="450" valign="top"><table class="vis" width="100%">';
    for (item in groupSummary) {
        if (groupSummary.hasOwnProperty(item)) {
            count = 0;
            docSource += '<tr><th colspan="2">' + fnTranslate(curGroup++) + '</th></tr>';
            for (jj = 0; jj < groupSummary[item].length; jj++) {
                docSource += '<tr class="' + (count++ % 2 ? 'row_b' : 'row_a') + '">';
                docSource += '<td width="240" style="white-space:nowrap;"><a href="#" onclick="fnShowCoords(\'' + groupSummary[item][jj] + "','" + fnTranslate(outputSummary[groupSummary[item][jj]].descID) + '\');" title="' + fnCriteriaToStr(outputSummary[groupSummary[item][jj]].criteria) + '">&raquo;&nbsp; ' + fnTranslate(outputSummary[groupSummary[item][jj]].descID) + '</a></td>\n';
                docSource += '<td width="240"' + (summary[groupSummary[item][jj]].tally > 0 ? '' : ' class="hidden"') + ' style="text-align:right;"><span>' + summary[groupSummary[item][jj]].tally + '</span></td></tr>';
            }
        }
    }
    docSource += '</table><td valign="top"><table class="vis" width="100%"><tr><th colspan="2" style="white-space:nowrap;">' + fnTranslate(curGroup++) + '</th></tr>';
    count = 0;
    for (key in offense) {
        if (offense.hasOwnProperty(key)) {
            docSource += '<tr class="' + (count++ % 2 ? 'row_b' : 'row_a') + '"><td><img src="https://' + location.hostname + '/graphic/unit/unit_' + offense[key] + '.png?1" alt=""/></td><td style="white-space:nowrap;"><span> ' + formatAsNumber(summary[offense[key]].count) + ' ' + unitDesc[offense[key]] + '</span></td></tr>';
        }
    }
    docSource += '</table><table class="vis" width="100%"><tr><th colspan="2" style="white-space:nowrap;">' + fnTranslate(curGroup++) + '</th></tr>';
    count = 0;
    for (key in defense) {
        if (defense.hasOwnProperty(key)) {
            docSource += '<tr class="' + (count++ % 2 ? 'row_b' : 'row_a') + '"><td><img src="https://' + location.hostname + '/graphic/unit/unit_' + defense[key] + '.png?1" alt=""/></td><td style="white-space:nowrap;"><span> ' + formatAsNumber(summary[defense[key]].count) + ' ' + unitDesc[defense[key]] + '</span></td></tr>';
        }
    }
    docSource += '</table><table class="vis" width="100%"><tr><th colspan="2" style="white-space:nowrap;">' + fnTranslate(curGroup++) + '</th></tr>';
    count = 0;
    $(unitConfig).children().each(function (i, e) {
        var unit = e.nodeName;
        if (!new RegExp('^(' + defense.join('|') + '|' + offense.join('|') + ')$').test(unit)) {
            docSource += '<tr class="' + (count++ % 2 ? 'row_b' : 'row_a') + '"><td><img src="https://' + location.hostname + '/graphic/unit/unit_' + unit + '.png?1" alt=""/></td><td style="white-space:nowrap;"><span> ' + formatAsNumber(summary[unit].count) + ' ' + unitDesc[unit] + '</span></td></tr>';
        }
    });
    docSource += '</table><table class="vis" width="100%"><tr><th colspan="2" style="white-space:nowrap;">' + fnTranslate(curGroup++) + '</th></tr>';
    docSource += '<tr class="row_a"><td><span>Count:</span></td><td style="white-space:nowrap;"><span> ' + formatAsNumber(summary.unitTotal.tally) + '</span></td></tr>';
    docSource += '<tr class="row_b"><td><span>Pop:</span></td><td style="white-space:nowrap;"><span> ' + formatAsNumber(summary.unitTotal.population) + '</span></td></tr>';
    docSource += '</table></td></td></tr></table><br>';
    
    docSource += '<table id="coordinate_table" class="vis" style="width:100%;">';
    docSource += '<tr><th>' + fnTranslate(curGroup++) + ': <span id="coords_group" style="font-weight:100;"></span>';
    docSource += '<tr><td style="box-sizing:border-box;width:100%;"><textarea id="coords_container" style="resize:none;width:100%;box-sizing:border-box;height:60px;"></textarea></td></tr>';
    docSource += '</table>';
    
    // BOTÃO PARA O DISCORD ADICIONADO AQUI
    docSource += '<div style="padding: 10px 0;">';
    docSource += '<button id="btnSendDiscord" class="btn btn-default" style="width: 100%; background-color: #5865F2; color: white; padding: 10px; border-radius: 4px; font-weight: bold; border: none; cursor: pointer; transition: 0.2s;">📤 Enviar para o Discord</button>';
    docSource += '</div>';

    docSource += `<small><strong>Troops Counter ${strVersion}</strong> - <a href="https://twscripts.dev/" rel="noopener noreferrer" target="_blank">RedAlert</a> - <a href="https://forum.tribalwars.net/index.php?threads/troops-counter-by-dalesmckay-fixed.285246/" rel="noopener noreferrer" target="_blank">Help</a>`;
    docSource += '</body></html>';

    if (DRAGGABLE) {
        docSource += `
            <a class="popup_box_close custom-close-button" onClick="clickDraggableEl();" href="#">&nbsp;</a>
            <style>
                .troops-counter-content { position: fixed; background-color: #f4e4bc !important; border: 1px solid #603000; padding: 10px; top: 10vh; right: 15vw; z-index: 1000; width: 440px; height: auto; }
                .custom-close-button { right: 0; top: 0; }
                #btnSendDiscord:hover { background-color: #4752C4 !important; }
            </style>
        `;
        if (jQuery('.troops-counter-content').length > 0) {
            UI.ErrorMessage('Troops Counter is already loaded!');
        } else {
            var troopsCounterContent = document.createElement('div');
            troopsCounterContent.classList.add('troops-counter-content');
            troopsCounterContent.innerHTML = docSource;
            jQuery('body').append(troopsCounterContent);
            jQuery('.troops-counter-content').draggable({ cancel: '.not-draggable' });
            
            // Adicionar evento ao botão após ele ser criado na página
            jQuery('#btnSendDiscord').on('click', fnSendToDiscord);
        }
    } else {
        const popupContent = preparePopupContent(docSource, '440px');
        Dialog.show('content', popupContent);
        
        // Adicionar evento ao botão após ele ser criado na página
        jQuery('#btnSendDiscord').on('click', fnSendToDiscord);
        
        // Estilo extra para o botão no popup nativo
        jQuery('head').append('<style>#btnSendDiscord:hover { background-color: #4752C4 !important; }</style>');
    }
}

function clickDraggableEl() {
    jQuery('.troops-counter-content').remove();
}

function initDebug() {
    console.debug(`[Troops Counter] Market:`, game_data.market);
    console.debug(`[Troops Counter] Screen:`, game_data.screen);
}

function formatAsNumber(number) {
    return parseInt(number).toLocaleString('pt-PT');
}

function checkScreen(userScreen, userMode) {
    const currentLocation = window.location.href;
    const url = new URL(currentLocation);
    const gameScreen = url.searchParams.get('screen');
    const gameMode = url.searchParams.get('mode');
    const gameView = url.searchParams.get('view');
    if (gameScreen === userScreen && gameMode === userMode) {
        if (gameView !== null) return false;
        return true;
    }
    return false;
}

function preparePopupContent(popupBody, maxWidth) {
    return `<div class="ra-body" style="max-width: ${maxWidth}">${popupBody}</div>`;
}

(async function () {
    if (!game_data.features.Premium.active) {
        UI.ErrorMessage('A Conta Premium precisa de estar ativa para este script funcionar!', 6000);
    } else {
        fnExecuteScript();
    }
})();
```
