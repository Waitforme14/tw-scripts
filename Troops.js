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
            'Erro: Vá a "Visualização Geral" -> "Tropas" (O script não detetou a página correta).',
            5000
        );
    }
}

function fnTranslate(id) {
    var translation = {
        en: [
            'Full Train Nukes', 'Full Defense Trains', 'Other Nobles', 'Full Nukes',
            '3/4 Nukes', '1/2 Nukes', '1/4 Nukes', 'Catapult Nukes', 'Full Defense',
            '3/4 Defense', '1/2 Defense', '1/4 Defense', 'Full Scouts', '3/4 Scouts',
            '1/2 Scouts', '1/4 Scouts', 'Other', 'Troops Counter', 'Noble Armies',
            'Offensive Armies', 'Defensive Armies', 'Scout Armies', 'Other Armies',
            'Offensive Units', 'Defensive Units', 'Other Units', 'Total Units', 'Co-ordinates',
        ],
    };

    var lang = typeof (translation[game_data.market] == 'undefined') ? 'en' : game_data.market;
    if (typeof translation[lang][id] == 'undefined') return '';
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
        error: function (req, status, err) { console.error('[Troops Counter] Error: ', err); },
        success: function (data, status, req) { payload = data; },
    });
    return payload;
}

function fnCreateConfig(name) {
    var response = fnAjaxRequest('/interface.php', 'GET', { func: name }, 'xml');
    return $(response).find('config');
}

function fnCreateUnitConfig() {
    return fnCreateConfig('get_unit_info');
}

function fnHasArchers() { return game_data.units.includes('archer'); }
function fnHasMilitia() { return game_data.units.includes('militia'); }

function fnGetTroopCount() {
    var gameVersion = parseFloat(game_data.version.split(' ')[1].replace('release_', '')); 
    var colCount = $('#units_table ' + (gameVersion >= 7.1 ? 'thead' : 'tbody:eq(0)') + ' th').length - 2;
    var villageTroopInfo = [];

    $('#units_table > tbody').each(function (row) { $(this).find('tr:last').remove(); });

    $('#units_table tbody' + (gameVersion < 7.1 ? ':gt(0)' : '')).each(function (row, eleRow) {
        var villageData = { troops: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
        var coords = $(eleRow).find('td:eq(0)').text().match(/\d+\|\d+/g);
        coords = coords ? coords[coords.length - 1].match(/(\d+)\|(\d+)/) : null;
        
        if(coords) {
            villageData.x = parseInt(coords[1], 10);
            villageData.y = parseInt(coords[2], 10);
            villageData.coords = coords[0];
        }

        $(eleRow).find('td:gt(0):not(:has(>a))').each(function (cell, eleCell) {
            if (cell % colCount) {
                if (Math.floor(cell / colCount) != 1) {
                    villageData.troops[(cell % colCount) - 1] += parseInt($(eleCell).text() || '0', 10);
                }
            }
        });
        villageTroopInfo.push(villageData);
    });
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
// EXTRAÇÃO E ENVIO PARA O DISCORD
// -------------------------------------------------------------------------
function fnSendToDiscord() {
    const webhookUrl = window.meuWebhookTW;
    if (!webhookUrl) {
        UI.ErrorMessage('Erro: O link do Webhook não foi encontrado na barra de acesso rápido!');
        return;
    }

    let discordData = { total: {}, inside: {}, outside: {} };
    let unitColumns = [];

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

    const showPlayer = `<b>Player:</b> <a href="/game.php?screen=info_player&id=${playerId}" target="_blank">${playerName}</a><br>`;
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

    var ii, jj, village, total, index, count, unit, item, key, criteria, isValid;
    var defense = ['spear', 'sword', 'heavy', 'catapult'];
    var offense = ['axe', 'light', 'ram', 'catapult'];

    if (fnHasArchers()) { defense.push('archer'); offense.push('marcher'); }
    if (fnHasMilitia()) { defense.push('militia'); }

    var summary = {
        unitTotal: { tally: 0, population: 0 },
        defense: { tally: 0, count: 0, population: 0, coords: [] },
        offense: { tally: 0, count: 0, population: 0,
