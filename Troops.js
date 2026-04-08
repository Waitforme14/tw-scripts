(function() {
    // Lê o webhook que vamos definir na barra de acesso rápido
    const webhookUrl = window.meuWebhookTW;

    if (!webhookUrl) {
        alert('Erro: O link do Webhook não foi encontrado na barra de acesso rápido!');
        return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('screen') !== 'overview_villages' || params.get('mode') !== 'units') {
        alert('Por favor, vá para a página: "Visualização Geral" -> "Tropas" antes de usar o script.');
        return;
    }

    let totalProprias = 0;
    let totalNaAldeia = 0;
    const table = document.getElementById('units_table');
    
    if (!table) {
        alert('Erro: Tabela de tropas não encontrada.');
        return;
    }

    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        let isProprias = text.includes('próprias');
        let isNaAldeia = text.includes('na aldeia');

        if (isProprias || isNaAldeia) {
            let somaLinha = 0;
            const cells = row.querySelectorAll('td');
            for (let i = 1; i < cells.length; i++) {
                const cellText = cells[i].innerText.trim().replace(/\./g, '');
                const valor = parseInt(cellText, 10);
                if (!isNaN(valor)) somaLinha += valor;
            }
            if (isProprias) totalProprias += somaLinha;
            if (isNaAldeia) totalNaAldeia += somaLinha;
        }
    });

    const jogador = window.game_data && window.game_data.player ? window.game_data.player.name : 'Jogador Desconhecido';
    const msg = `📊 **Relatório Geral de Tropas - ${jogador}**\n\n🛡️ **Tropas Totais (Próprias):** ${totalProprias}\n🏠 **Tropas em Casa (Na aldeia):** ${totalNaAldeia}`;

    fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg, username: 'Tribal Wars Tracker' })
    })
    .then(res => {
        if (res.ok) alert('Sucesso! O relatório foi enviado para o seu Discord.');
        else alert('Erro ao enviar. Verifique o link do Webhook.');
    })
    .catch(err => alert('Erro de ligação: ' + err));
})();
