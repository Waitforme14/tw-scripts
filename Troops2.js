(function () {
    var webhookURL = window.meuWebhookTW;
    var DIALOG_ID = 'militar_neon_premium_v1';

    try { Dialog.close(); } catch (e) {}

    class MilitarNeonPremium {
        constructor() {
            const forbidden = ['militia', 'archer', 'marcher'];
            this.availableUnits = (game_data.units || []).filter(u => !forbidden.includes(u));
        }

        async init() {
            const html = await $.get(`/game.php?village=${game_data.village.id}&screen=overview_villages&mode=units`);
            const rows = $($.parseHTML(html)).find('#units_table tbody tr');
            
            const troops = { v: {}, s: {} };
            this.availableUnits.forEach(u => { troops.v[u] = 0; troops.s[u] = 0; });

            rows.each((_, row) => {
                const text = $(row).text().toLowerCase();
                const isHome = text.includes('próprias');
                const isScav = text.includes('buscas');
                if (!isHome && !isScav) return;

                $(row).find('td:gt(1)').each((idx, td) => {
                    const unit = game_data.units[idx];
                    if (this.availableUnits.includes(unit)) {
                        const val = parseInt($(td).text().trim().replace(/\./g, ''), 10) || 0;
                        if (isHome) troops.v[unit] += val;
                        if (isScav) troops.s[unit] += val;
                    }
                });
            });

            this.#createUI(troops);
        }

        #format(v) { return new Intl.NumberFormat('pt-PT').format(v || 0); }

        #createUI(troops) {
            const total = {};
            this.availableUnits.forEach(u => total[u] = troops.v[u] + troops.s[u]);

            const renderCard = (u, v, l) => `
                <div class="neon-card">
                    <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${u}.png">
                    <div class="neon-card-val">${this.#format(v)}</div>
                    <div class="neon-card-name">${l}</div>
                </div>`;

            const html = `
<div id="neon-wrapper">
    <div class="neon-container">
        <div class="neon-header">
            <div class="neon-title-box">
                <span class="neon-status-dot"></span>
                <h3>SISTEMA MILITAR :: HUD</h3>
                <p>ANÁLISE DE PODER TÁTICO</p>
            </div>
            <div class="neon-info-box">
                <div class="neon-info-item"><span>MUNDO</span><strong>${game_data.world}</strong></div>
                <div class="neon-info-item"><span>TIME</span><strong>${$('#serverTime').text()}</strong></div>
            </div>
        </div>

        <div class="neon-stats-bar">
            <span>OPERADOR: <strong>${game_data.player.name}</strong></span>
            <div class="neon-main-actions">
                <button id="neon-btn-refresh" class="neon-btn">🔄 ATUALIZAR</button>
                <button id="neon-btn-discord" class="neon-btn neon-btn-blue">📡 TRANSMITIR DISCORD</button>
            </div>
        </div>

        <div class="neon-content-grid">
            <div class="neon-section">
                <div class="neon-section-header">🛡️ NÚCLEO DEFENSIVO</div>
                <div class="neon-units-grid">
                    ${renderCard('spear', total.spear, 'Lanças')}
                    ${renderCard('sword', total.sword, 'Espadas')}
                    ${renderCard('heavy', total.heavy, 'Pesada')}
                    ${renderCard('catapult', total.catapult, 'Catas')}
                    ${total.knight !== undefined ? renderCard('knight', total.knight, 'Paladino') : ''}
                </div>
            </div>

            <div class="neon-section">
                <div class="neon-section-header">⚔️ NÚCLEO OFENSIVO</div>
                <div class="neon-units-grid">
                    ${renderCard('axe', total.axe, 'Vikings')}
                    ${renderCard('spy', total.spy, 'Batedores')}
                    ${renderCard('light', total.light, 'Leves')}
                    ${renderCard('ram', total.ram, 'Aríetes')}
                    ${renderCard('catapult', total.catapult, 'Catas')}
                </div>
            </div>
        </div>

        <div class="neon-table-section">
            <div class="neon-section-header">📊 RESUMO DE LOGÍSTICA</div>
            <table class="neon-table">
                <thead>
                    <tr>
                        <th>ORIGEM</th>
                        ${this.availableUnits.map(u => `<th><img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${u}.png"></th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr><td class="n-lbl">ALDEIAS</td>${this.availableUnits.map(u => `<td>${this.#format(troops.v[u])}</td>`).join('')}</tr>
                    <tr><td class="n-lbl">BUSCAS</td>${this.availableUnits.map(u => `<td>${this.#format(troops.s[u])}</td>`).join('')}</tr>
                    <tr class="n-total-row"><td class="n-lbl">TOTAL</td>${this.availableUnits.map(u => `<td>${this.#format(total[u])}</td>`).join('')}</tr>
                </tbody>
            </table>
        </div>

        <div class="neon-footer">
            <span>MOD V1.0 // ARREDONDADO NEON</span>
            <button id="neon-close" class="neon-btn-close">FECHAR SISTEMA</button>
        </div>
    </div>
</div>

<style>
/* CSS Futurista Arredondado */
#neon-wrapper { background: #050505; color: #ccffeb; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 15px; border-radius: 25px; min-width: 900px; }
.neon-container { border: 2px solid #00ff88; border-radius: 25px; overflow: hidden; box-shadow: 0 0 35px rgba(0, 255, 136, 0.15); background: #0a0a0a; }

.neon-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; background: #111; border-bottom: 2px solid #00ff88; }
.neon-title-box h3 { margin: 0; color: #00ff88; font-size: 22px; font-weight: 900; letter-spacing: 2px; }
.neon-title-box p { margin: 0; font-size: 10px; color: #008855; font-weight: bold; }
.neon-status-dot { display: inline-block; width: 10px; height: 10px; background: #00ff88; border-radius: 50%; margin-right: 10px; box-shadow: 0 0 10px #00ff88; animation: neon-pulse 1.5s infinite; }

.neon-stats-bar { display: flex; justify-content: space-between; align-items: center; padding: 12px 30px; background: #000; border-bottom: 1px solid #004422; font-size: 12px; }
.neon-info-box { display: flex; gap: 20px; }
.neon-info-item { text-align: center; }
.neon-info-item span { display: block; font-size: 9px; color: #008855; }

.neon-btn { background: #000; border: 1px solid #00ff88; color: #00ff88; padding: 8px 20px; border-radius: 30px; cursor: pointer; font-weight: bold; font-size: 11px; transition: 0.3s; margin-left: 10px; }
.neon-btn:hover { background: #00ff88; color: #000; box-shadow: 0 0 15px #00ff88; }
.neon-btn-blue { border-color: #00d9ff; color: #00d9ff; }
.neon-btn-blue:hover { background: #00d9ff; color: #000; box-shadow: 0 0 15px #00d9ff; }

.neon-content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; padding: 25px; }
.neon-section { background: #121212; border: 1px solid #1a3a2a; border-radius: 20px; padding: 20px; }
.neon-section-header { color: #00ff88; font-weight: 900; font-size: 14px; margin-bottom: 20px; text-transform: uppercase; border-bottom: 1px solid #1a3a2a; padding-bottom: 10px; }

.neon-units-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.neon-card { background: #1a1a1a; border: 1px solid #222; border-radius: 15px; padding: 15px 5px; text-align: center; transition: 0.3s; }
.neon-card:hover { border-color: #00ff88; background: #002211; transform: translateY(-5px); }
.neon-card img { width: 24px; height: 24px; margin-bottom: 8px; }
.neon-card-val { font-size: 16px; font-weight: bold; color: #fff; }
.neon-card-name { font-size: 9px; color: #008855; font-weight: bold; }

.neon-table-section { padding: 0 25px 25px; }
.neon-table { width: 100%; border-collapse: collapse; background: #000; border-radius: 15px; overflow: hidden; }
.neon-table th { background: #111; padding: 12px; border: 1px solid #1a3a2a; color: #00ff88; }
.neon-table td { padding: 12px; border: 1px solid #1a3a2a; text-align: center; font-size: 12px; }
.n-lbl { text-align: left !important; font-weight: bold; color: #008855; padding-left: 20px !important; }
.n-total-row { background: #001a0d; color: #00ff88; font-weight: bold; }

.neon-footer { padding: 15px 30px; background: #111; border-top: 1px solid #1a3a2a; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #004422; }
.neon-btn-close { background: transparent; border: 1px solid #ff0055; color: #ff0055; padding: 5px 15px; border-radius: 20px; cursor: pointer; font-weight: bold; }
.neon-btn-close:hover { background: #ff0055; color: #fff; }

@keyframes neon-pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
</style>`;

            Dialog.show(DIALOG_ID, html);

            $('#neon-btn-refresh').on('click', () => { Dialog.close(); this.init(); });
            $('#neon-close').on('click', () => Dialog.close());
            $('#neon-btn-discord').on('click', () => {
                const payload = {
                    content: `📶 **STATUS MILITAR HUD - ${game_data.player.name}**`,
                    embeds: [
                        { title: "🛡️ SETOR DEFENSIVO", color: 3447003, fields: [{ name: "UNIDADES", value: `🛡️ **Lanças:** ${total.spear}\n⚔️ **Espadas:** ${total.sword}\n🏇 **Pesada:** ${total.heavy}\n☄️ **Catas:** ${total.catapult}\n👑 **Paladino:** ${total.knight || 0}`, inline: true }] },
                        { title: "⚔️ SETOR OFENSIVO", color: 15158332, fields: [{ name: "UNIDADES", value: `🪓 **Vikings:** ${total.axe}\n👁️ **Batedor:** ${total.spy}\n🐎 **Leve:** ${total.light}\n🪵 **Aríete:** ${total.ram}\n☄️ **Catas:** ${total.catapult}\n👑 **Paladino:** ${total.knight || 0}`, inline: true }], footer: { text: `World: ${game_data.world} | ${$('#serverTime').text()}` } }
                    ]
                };
                $.post(webhookURL, JSON.stringify(payload)).done(() => UI.SuccessMessage("TRANSMISSÃO COMPLETA"));
            });
        }
    }

    new MilitarNeonPremium().init();
})();
