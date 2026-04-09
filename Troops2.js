(function () {
    var webhookURL = window.meuWebhookTW;
    var DIALOG_ID = 'militar_neon_premium_v2';

    // Limpeza de instâncias anteriores
    try { Dialog.close(); } catch (e) {}

    class MilitarNeonGamer {
        constructor() {
            const forbidden = ['militia', 'archer', 'marcher'];
            this.availableUnits = (game_data.units || []).filter(u => !forbidden.includes(u));
        }

        async init() {
            // Carregamento de dados (Aldeias + Buscas)
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
                <div class="n-card">
                    <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${u}.png">
                    <div class="n-card-val">${this.#format(v)}</div>
                    <div class="n-card-name">${l}</div>
                </div>`;

            const html = `
<div id="neon-wrapper">
    <div class="neon-shell">
        <div class="neon-header">
            <div class="n-title-group">
                <span class="n-pulse-dot"></span>
                <h3>SISTEMA MILITAR HUD</h3>
                <p>ANÁLISE DE PODER E LOGÍSTICA</p>
            </div>
            <div class="n-timer">[ ${$('#serverTime').text()} ]</div>
        </div>

        <div class="neon-top-nav">
            <span>OPERADOR: <strong style="color:#00ff88;">${game_data.player.name}</strong></span>
            <div class="n-btns">
                <button id="n-ref" class="n-btn-neon">🔄 REATUALIZAR</button>
                <button id="n-disc" class="n-btn-neon n-btn-discord">📡 TRANSMITIR DISCORD</button>
            </div>
        </div>

        <div class="neon-grid">
            <div class="neon-pane">
                <div class="n-pane-title">🛡️ NÚCLEO DEFENSIVO</div>
                <div class="n-unit-grid">
                    ${renderCard('spear', total.spear, 'LANÇAS')}
                    ${renderCard('sword', total.sword, 'ESPADAS')}
                    ${renderCard('heavy', total.heavy, 'PESADA')}
                    ${renderCard('catapult', total.catapult, 'CATAS')}
                    ${total.knight !== undefined ? renderCard('knight', total.knight, 'PALADINO') : ''}
                </div>
            </div>
            <div class="neon-pane">
                <div class="n-pane-title">⚔️ NÚCLEO OFENSIVO</div>
                <div class="n-unit-grid">
                    ${renderCard('axe', total.axe, 'VIKINGS')}
                    ${renderCard('spy', total.spy, 'BATEDOR')}
                    ${renderCard('light', total.light, 'LEVE')}
                    ${renderCard('ram', total.ram, 'ARÍETE')}
                    ${renderCard('catapult', total.catapult, 'CATAS')}
                </div>
            </div>
        </div>

        <div class="neon-table-wrap">
            <div class="n-pane-title" style="margin-left:10px;">📊 ESTATÍSTICA DE ORIGEM</div>
            <table class="n-table">
                <thead>
                    <tr>
                        <th style="border-top-left-radius:15px;">TIPO</th>
                        ${this.availableUnits.map(u => `<th><img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${u}.png"></th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr><td class="n-row-label">ALDEIAS</td>${this.availableUnits.map(u => `<td>${this.#format(troops.v[u])}</td>`).join('')}</tr>
                    <tr><td class="n-row-label">BUSCAS</td>${this.availableUnits.map(u => `<td>${this.#format(troops.s[u])}</td>`).join('')}</tr>
                    <tr class="n-total-row"><td class="n-row-label">SOMA TOTAL</td>${this.availableUnits.map(u => `<td>${this.#format(total[u])}</td>`).join('')}</tr>
                </tbody>
            </table>
        </div>

        <div class="neon-footer">
            <span>GAMER_CORE_V2 // TW_SCRIPTS</span>
            <button id="n-exit" class="n-btn-exit">ENCERRAR HUD</button>
        </div>
    </div>
</div>
<style>
/* CSS HUD FUTURISTA ARREDONDADO */
#neon-wrapper { background: #050505; color: #ccffeb; font-family: 'Segoe UI', Roboto, sans-serif; padding: 10px; border-radius: 25px; min-width: 850px; }
.neon-shell { border: 2px solid #00ff88; border-radius: 25px; background: #0a0a0a; overflow: hidden; box-shadow: 0 0 30px rgba(0, 255, 136, 0.2); }

.neon-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; background: #111; border-bottom: 2px solid #00ff88; }
.n-title-group h3 { margin: 0; color: #00ff88; font-size: 20px; font-weight: 900; letter-spacing: 2px; }
.n-title-group p { margin: 0; font-size: 10px; color: #008855; font-weight: bold; }
.n-pulse-dot { display: inline-block; width: 10px; height: 10px; background: #00ff88; border-radius: 50%; margin-right: 10px; box-shadow: 0 0 10px #00ff88; animation: n-pulse 1.5s infinite; }

.neon-top-nav { display: flex; justify-content: space-between; align-items: center; padding: 12px 30px; background: #000; border-bottom: 1px solid #1a3a2a; font-size: 12px; }
.n-btn-neon { background: #000; border: 1px solid #00ff88; color: #00ff88; padding: 7px 18px; border-radius: 20px; cursor: pointer; font-weight: bold; font-size: 10px; transition: 0.3s; margin-left: 8px; }
.n-btn-neon:hover { background: #00ff88; color: #000; box-shadow: 0 0 15px #00ff88; }
.n-btn-discord { border-color: #00d9ff; color: #00d9ff; }
.n-btn-discord:hover { background: #00d9ff; box-shadow: 0 0 15px #00d9ff; }

.neon-grid { display: grid; grid-template-columns: 1fr 1.1fr; gap: 20px; padding: 20px; }
.neon-pane { background: #121212; border: 1px solid #1a3a2a; border-radius: 20px; padding: 15px; }
.n-pane-title { color: #00ff88; font-weight: 900; font-size: 13px; margin-bottom: 15px; text-transform: uppercase; }

.n-unit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.n-card { background: #1a1a1a; border: 1px solid #222; border-radius: 15px; padding: 12px 5px; text-align: center; transition: 0.3s; }
.n-card:hover { border-color: #00ff88; background: #002211; transform: translateY(-3px); }
.n-card img { width: 22px; height: 22px; margin-bottom: 5px; }
.n-card-val { font-size: 14px; font-weight: bold; color: #fff; }
.n-card-name { font-size: 8px; color: #008855; font-weight: bold; }

.neon-table-wrap { padding: 0 20px 20px; }
.n-table { width: 100%; border-collapse: collapse; background: #000; border-radius: 15px; overflow: hidden; border: 1px solid #1a3a2a; }
.n-table th { background: #111; padding: 10px; color: #00ff88; font-size: 11px; }
.n-table td { padding: 10px; border: 1px solid #1a3a2a; text-align: center; font-size: 12px; }
.n-row-label { text-align: left !important; font-weight: bold; color: #008855; padding-left: 15px !important; }
.n-total-row { background: #001a0d; color: #00ff88; font-weight: bold; }

.neon-footer { padding: 15px 30px; background: #111; border-top: 1px solid #1a3a2a; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #004422; }
.n-btn-exit { background: transparent; border: 1px solid #ff0055; color: #ff0055; padding: 5px 15px; border-radius: 20px; cursor: pointer; font-weight: bold; }

@keyframes n-pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
</style>`;

            Dialog.show(DIALOG_ID, html);

            $('#n-ref').on('click', () => { Dialog.close(); this.init(); });
            $('#n-exit').on('click', () => Dialog.close());
            $('#n-disc').on('click', () => {
                const payload = {
                    content: `📶 **STATUS MILITAR HUD - ${game_data.player.name}**`,
                    embeds: [
                        { title: "🛡️ SETOR DEFENSIVO", color: 3447003, fields: [{ name: "UNIDADES", value: `🛡️ **Lanças:** ${this.#format(total.spear)}\n⚔️ **Espadas:** ${this.#format(total.sword)}\n🏇 **Pesada:** ${this.#format(total.heavy)}\n☄️ **Catas:** ${this.#format(total.catapult)}\n👑 **Paladino:** ${this.#format(total.knight || 0)}`, inline: true }] },
                        { title: "⚔️ SETOR OFENSIVO", color: 15158332, fields: [{ name: "UNIDADES", value: `🪓 **Vikings:** ${this.#format(total.axe)}\n👁️ **Batedor:** ${this.#format(total.spy)}\n🐎 **Leve:** ${this.#format(total.light)}\n🪵 **Aríetes:** ${this.#format(total.ram)}\n☄️ **Catas:** ${this.#format(total.catapult)}\n👑 **Paladino:** ${this.#format(total.knight || 0)}`, inline: true }], footer: { text: `Mundo: ${game_data.world} | ${$('#serverTime').text()}` } }
                    ]
                };
                $.post(webhookURL, JSON.stringify(payload)).done(() => UI.SuccessMessage("DADOS TRANSMITIDOS"));
            });
        }
    }

    new MilitarNeonGamer().init();
})();
