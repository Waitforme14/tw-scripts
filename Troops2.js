(function () {
    var webhookURL = window.meuWebhookTW;
    // Nomes alterados para forçar a limpeza da cache do Githack/Navegador
    var SCRIPT_NS = 'militar_neon_gamer_v3';
    var DIALOG_ID = 'militar_dialog_neon_v3';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}
    // Limpa a instância antiga
    try { delete window.militarNeonCore; } catch (e) { window.militarNeonCore = undefined; }

    class MilitarNeonCore {
        static translations() {
            return {
                pt_PT: {
                    title: 'NÚCLEO :: RESUMO MILITAR',
                    subtitle: 'Análise de Poder Total (Casa + Busca)',
                    home: 'EM CASA',
                    scavenging: 'EM BUSCA',
                    total: 'TOTAL SISTEMA',
                    defensiveTotal: '🛡️ NÚCLEO DEFENSIVO',
                    offensiveTotal: '⚔️ NÚCLEO OFENSIVO',
                    group: 'GRUPO',
                    player: 'OPERADOR',
                    server: 'MUNDO',
                    refresh: 'ATUALIZAR',
                    sendDiscord: 'TRANSMITIR DISCORD',
                    noGroup: 'TODOS',
                    copy: 'COPIAR BB',
                    bbCopied: 'BBCode copiado!',
                    summaryTotal: 'RESUMO UNIDADES',
                    credits: 'Script Engine: JDi4s | UI Mod: Gamer Neon'
                }
            };
        }

        constructor() {
            const allTranslations = MilitarNeonCore.translations();
            this.UserTranslation = allTranslations[game_data.locale] || allTranslations.pt_PT;
            // Filtro de arqueiros e milícia
            const forbidden = ['militia', 'archer', 'marcher'];
            this.availableUnits = Array.isArray(game_data.units) ? [...game_data.units] : [];
            this.availableUnits = this.availableUnits.filter(u => !forbidden.includes(u));
            this.isScavengingWorld = false;
        }

        async init() {
            if (!game_data.features.Premium.active) { UI.ErrorMessage("Conta Premium necessária!"); return; }
            await this.#initWorldConfig();
            await this.#createUI();
        }

        async #initWorldConfig() {
            const xml = $.ajax({ async: false, url: '/interface.php?func=get_config', type: 'GET' }).responseText;
            try { this.isScavengingWorld = $($.parseXML(xml)).find('scavenging').text() === '1'; } catch (e) { throw e; }
        }

        #generateUrl(screen, mode = null, extraParams = {}) {
            let url = `/game.php?village=${game_data.village.id}&screen=${screen}`;
            if (mode !== null) url += `&mode=${mode}`;
            $.each(extraParams, function (key, value) { url += `&${key}=${value}`; });
            return url;
        }

        #fetchHtmlPage(url) {
            let tempData = null;
            $.ajax({ async: false, url: url, type: 'GET', success: data => { tempData = data; } });
            return tempData;
        }

        #formatNumber(value) { return new Intl.NumberFormat('pt-PT').format(Number(value || 0)); }

        async #getTroopsData() {
            const troopsObj = { villages: {}, scavenging: {} };
            this.availableUnits.forEach(u => { troopsObj.villages[u] = 0; troopsObj.scavenging[u] = 0; });

            const html = $.ajax({ async: false, url: this.#generateUrl('overview_villages', 'units'), type: 'GET' }).responseText;
            const rows = $($.parseHTML(html)).find('#units_table tbody tr');
            
            rows.each((_, row) => {
                const text = $(row).text().toLowerCase();
                const isHome = text.includes('próprias');
                const isScav = text.includes('buscas');
                if (!isHome && !isScav) return;

                $(row).find('td:gt(1)').each((idx, td) => {
                    const unitName = game_data.units[idx];
                    if (this.availableUnits.includes(unitName)) {
                        const val = parseInt($(td).text().trim().replace(/\./g, ''), 10) || 0;
                        if (isHome) troopsObj.villages[unitName] += val;
                        if (isScav) troopsObj.scavenging[unitName] += val;
                    }
                });
            });
            return troopsObj;
        }

        #sendToDiscordEnhanced(total) {
            if (!webhookURL) { alert("CONFIGURA O WEBHOOK!"); return; }
            const payload = {
                content: `📊 **RESUMO MILITAR GAMER - ${game_data.player.name}** (Mundo: ${game_data.world})`,
                embeds: [
                    {
                        title: "🛡️ TROPAS DEFENSIVAS",
                        color: 3447003, // Azul para o Discord
                        fields: [{ name: "STATUS", value: `🛡️ **Lanças:** ${this.#formatNumber(total.spear)}\n⚔️ **Espadas:** ${this.#formatNumber(total.sword)}\n🏇 **Pesada:** ${this.#formatNumber(total.heavy)}\n☄️ **Catas:** ${this.#formatNumber(total.catapult)}\n👑 **Paladino:** ${this.#formatNumber(total.knight || 0)}`, inline: true }]
                    },
                    {
                        title: "⚔️ TROPAS OFENSIVAS",
                        color: 15158332, // Vermelho para o Discord
                        fields: [{ name: "STATUS", value: `🪓 **Vikings:** ${this.#formatNumber(total.axe)}\n👁️ **Batedor:** ${this.#formatNumber(total.spy)}\n🐎 **Leve:** ${this.#formatNumber(total.light)}\n🪵 **Aríetes:** ${this.#formatNumber(total.ram)}\n☄️ **Catas:** ${this.#formatNumber(total.catapult)}\n👑 **Paladino:** ${this.#formatNumber(total.knight || 0)}`, inline: true }],
                        footer: { text: `Grupo: ${$('.vis_item strong').text() || 'Todos'} | Data: ${$('#serverTime').text()}` }
                    }
                ]
            };
            $.post(webhookURL, JSON.stringify(payload)).done(() => alert("DADOS TRANSMITIDOS!"));
        }

        async #createUI() {
            const data = await this.#getTroopsData();
            const total = {};
            this.availableUnits.forEach(u => total[u] = data.villages[u] + data.scavenging[u]);
            const t = this.UserTranslation;

            const renderCard = (unit, val, label) => `
                <div class="neon-unit-card">
                    <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${unit}.png">
                    <div class="neon-unit-value">${this.#formatNumber(val)}</div>
                    <div class="neon-unit-name">${label}</div>
                </div>`;

            const html = `
<div id="neon-root">
    <div class="neon-shell">
        <div class="neon-header">
            <h3>${t.title}</h3>
            <div class="neon-stamp">[ ${$('#serverDate').text()} ${$('#serverTime').text()} ]</div>
        </div>
        <div class="neon-topbar">
            <span>${t.player}: <strong>${game_data.player.name}</strong> | ${t.server}: <strong>${game_data.world}</strong></span>
            <div class="neon-actions">
                <button id="neon-refresh" class="neon-btn neon-btn-sec">_ ${t.refresh}</button>
                <button id="neon-send-discord" class="neon-btn neon-btn-pri">_ ${t.sendDiscord}</button>
            </div>
        </div>
        <div class="neon-grid">
            <div class="neon-panel neon-panel-large">
                <div class="neon-panel-head"><h4>> ${t.summaryTotal}</h4></div>
                <div class="neon-table-wrap"><table class="neon-table modern" width="100%"><thead>
                    <tr><th></th>${this.availableUnits.map(v => `<th class="center"><img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${v}.png"></th>`).join('')}</tr>
                </thead><tbody>
                    ${this.isScavengingWorld ? `<tr><td class="neon-label">${t.home}</td>${this.availableUnits.map(u => `<td class="center">${this.#formatNumber(data.villages[u])}</td>`).join('')}</tr>` : ''}
                    ${this.isScavengingWorld ? `<tr><td class="neon-label">${t.scavenging}</td>${this.availableUnits.map(u => `<td class="center">${this.#formatNumber(data.scavenging[u])}</td>`).join('')}</tr>` : ''}
                    <tr><td class="neon-label neon-total">${t.total}</td>${this.availableUnits.map(u => `<td class="center neon-total">${this.#formatNumber(total[u])}</td>`).join('')}</tr>
                </tbody></table></div>
            </div>
            <div class="neon-panel neon-panel-small">
                <div class="neon-panel-head"><h4>${t.defensiveTotal}</h4></div>
                <div class="neon-def-grid">
                    ${renderCard('spear', total.spear, 'LANÇAS')} ${renderCard('sword', total.sword, 'ESPADAS')}
                    ${renderCard('heavy', total.heavy, 'PESADA')} ${renderCard('catapult', total.catapult, 'CATAS')}
                    ${total.knight !== undefined ? renderCard('knight', total.knight, 'PALADINO') : ''}
                </div>
                <div class="neon-panel-head" style="margin-top:20px;"><h4>${t.offensiveTotal}</h4></div>
                <div class="neon-def-grid">
                    ${renderCard('axe', total.axe, 'VIKINGS')} ${renderCard('spy', total.spy, 'BATEDOR')}
                    ${renderCard('light', total.light, 'LEVE')} ${renderCard('ram', total.ram, 'ARÍETE')}
                    ${renderCard('catapult', total.catapult, 'CATAS')} ${total.knight !== undefined ? renderCard('knight', total.knight, 'PALADINO') : ''}
                </div>
            </div>
        </div>
        <div class="neon-bbcode-wrap"><button id="neon-copy-bbcode" class="neon-btn neon-btn-sec">_ ${t.copy}</button><textarea id="neon-textarea" readonly></textarea></div>
        <div class="neon-footer">${t.credits}</div>
        </div>
</div>
<style>
/* Reset Global do Popup e Estilo Arredondado Neon */
.popup_box_content { min-width: 950px !important; background: transparent !important; padding: 0 !important; border: none !important; }
.popup_box_close { background-color: #00ff88 !important; border-radius: 50% !important; margin: 10px !important; }

/* Visual Futurista Arredondado */
#neon-root { color: #a0ffcc; font-family: 'Segoe UI', 'Roboto', 'Verdana', sans-serif; font-size: 13px; background-color: #080808; padding: 10px; border-radius: 12px; }
.neon-shell { border: 2px solid #00ff88; border-radius: 12px; box-shadow: 0 0 20px rgba(0, 255, 136, 0.5); overflow: hidden; }
.neon-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #121212; border-bottom: 2px solid #00ff88; }
.neon-header h3 { margin: 0; font-size: 20px; color: #00ff88; font-weight: 800; text-transform: uppercase; text-shadow: 0 0 8px #00ff88; }
.neon-stamp { color: #008855; font-size: 11px; font-family: 'Consolas', monospace; }
.neon-topbar { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: #000; border-bottom: 1px solid #006644; color: #00bb66; }
.neon-topbar strong { color: #00ff88; text-shadow: 0 0 3px #00ff88; }

/* Botões Arredondados */
.neon-btn { height: 32px; padding: 0 16px; border: 1px solid #00ff88; cursor: pointer; font-weight: 800; border-radius: 16px; background: #000; color: #00ff88; font-family: inherit; font-size: 11px; text-transform: uppercase; transition: all 0.2s; }
.neon-btn:hover { background: #003311; box-shadow: 0 0 12px #00ff88; }
.neon-btn-pri { background: #00ff88; color: #000; }
.neon-btn-pri:hover { background: #00cc66; color: #fff; box-shadow: 0 0 15px #00ff88; }
.neon-btn-sec { border-color: #00ff88; color: #00ff88; }
.neon-actions select { height: 32px; border-radius: 16px; border: 1px solid #00ff88; background: #121212; color: #a0ffcc; padding: 0 10px; font-family: inherit; }

/* Grelha e Painéis Arredondados */
.neon-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 15px; padding: 15px; }
.neon-panel { background: #121212; border: 1px solid #006644; padding: 15px; border-radius: 12px; transition: border-color 0.2s; }
.neon-panel:hover { border-color: #00ff88; box-shadow: 0 0 10px rgba(0, 255, 136, 0.2); }
.neon-panel-head { border-bottom: 1px solid #006644; margin-bottom: 12px; padding-bottom: 5px; }
.neon-panel-head h4 { margin: 0; color: #00ff88; font-size: 14px; text-transform: uppercase; text-shadow: 0 0 5px #00ff88; }

/* Tabela Neon Arredondada */
.neon-table-wrap { border-radius: 8px; overflow: hidden; border: 1px solid #006644; }
.neon-table { border-collapse: collapse; background: #000; border: none; }
.neon-table th { background: #161616 !important; border: 1px solid #006644; padding: 8px; color: #00ff88; }
.neon-table td { border: 1px solid #003322; padding: 8px; text-align: center; color: #a0ffcc; }
.neon-table img { width: 18px; height: 18px; }
.neon-label { text-align: left !important; color: #00bb66; font-weight: bold; }
.neon-total { color: #00ff88 !important; font-weight: bold; background: #001100; text-shadow: 0 0 3px #00ff88; border-color: #006644; }

/* Cartas de Unidade Arredondadas */
.neon-def-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.neon-unit-card { background: #000; border: 1px solid #006644; padding: 8px 5px; text-align: center; border-radius: 10px; transition: all 0.2s; }
.neon-unit-card:hover { border-color: #00ff88; box-shadow: 0 0 8px #00ff88; background: #001100; }
.neon-unit-card img { width: 22px; height: 22px; margin-bottom: 5px; filter: sepia(0%) !important; /* Remove o filtro verde antigo */ }
.neon-unit-value { font-size: 14px; font-weight: bold; color: #fff; text-shadow: 0 0 3px #00ff88; }
.neon-unit-name { font-size: 9px; color: #00bb66; font-weight: bold; text-transform: uppercase; margin-top: 2px; }

/* BBCode */
.neon-bbcode-wrap { padding: 0 15px 15px; display: flex; flex-direction: column; gap: 8px; }
.neon-bbcode-wrap textarea { background: #000; border: 1px solid #006644; color: #a0ffcc; font-family: 'Consolas', monospace; font-size: 11px; height: 50px; padding: 8px; resize: none; border-radius: 8px; }
.neon-bbcode-wrap textarea:focus { border-color: #00ff88; outline: none; box-shadow: 0 0 8px #00ff88; }

.neon-footer { padding: 8px 20px; text-align: right; font-size: 10px; font-weight: bold; color: #006644; border-top: 1px solid #004400; background: #121212; border-radius: 0 0 12px 12px; }
</style>`;

            Dialog.show(DIALOG_ID, html);
            $('#popup_box_' + DIALOG_ID).css('width', 'unset');

            // Gerar BBCode Filtrado (Apenas unidades ativas > 0)
            let bbCode = `[b]NÚCLEO::RELATÓRIO_MILITAR [${$('#serverTime').text()}]
[b]OPERADOR:[/b] ${game_data.player.name}
[b]MUNDO:[/b] ${game_data.world}
----------------------------------
`;
            const labels = { spear: 'Lanças', sword: 'Espadas', axe: 'Vikings', spy: 'Batedor', light: 'Leve', heavy: 'Pesada', ram: 'Aríete', catapult: 'Catas', knight: 'Paladino', snob: 'Nobres' };
            Object.entries(total).forEach(([k, v]) => { if(this.availableUnits.includes(k) && v > 0) bbCode += `[unit]${k}[/unit] [b]${this.#formatNumber(v)}[/b] ${labels[k] || k}\n`; });
            $('#neon-textarea').val(bbCode);

            // Eventos
            $('#neon-send-discord').on('click', () => this.#sendToDiscordEnhanced(total));
            $('#neon-refresh').on('click', () => { Dialog.close(); this.init(); });
            $('#neon-copy-bbcode').on('click', () => { $('#neon-textarea').select(); document.execCommand('copy'); UI.SuccessMessage("BBCODE COPIADO!"); });
        }
    }

    // Instancia a nova classe para garantir que carrega o código novo
    window.militarNeonCore = new MilitarNeonCore();
    window.militarNeonCore.init();
})();
