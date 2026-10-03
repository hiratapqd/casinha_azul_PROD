(() => {
    const formulario = document.getElementById('gappusForm');
    const tbody = document.getElementById('participantes_gappus');
    const feedback = document.getElementById('feedback_lista');
    const data = formulario?.querySelector('input[name="data"]').value || CasinhaDatas.hojeLocal();
    function mensagem(texto) { if (feedback) feedback.textContent = texto; }
    async function api(url, dados) {
        const resposta = await fetch(url, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(dados || {}) });
        const resultado = await resposta.json();
        if (!resposta.ok) throw new Error(resultado.mensagem || 'Não foi possível concluir a operação.');
        return resultado;
    }
    function linha(p, marcarPresenca) {
        const existente = tbody.querySelector('[data-id="' + p.id + '"]');
        if (existente) { if (marcarPresenca) existente.querySelector('input').checked = true; return; }
        const tr = document.createElement('tr'); tr.dataset.id = p.id; tr.dataset.presencaSalva = 'false';
        const tdPresenca = document.createElement('td'), label = document.createElement('label');
        const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'participantes'; input.value = p.id; input.checked = Boolean(marcarPresenca); input.setAttribute('aria-label', 'Presença de ' + p.nome);
        label.append(input, document.createTextNode('Presente')); tdPresenca.append(label);
        const tdNome = document.createElement('td'), link = document.createElement('a'); link.href = '/gappus/participantes/' + encodeURIComponent(p.id); link.textContent = p.nome;
        const cpf = document.createElement('small'); cpf.textContent = p.cpf || 'Sem CPF informado'; tdNome.append(link, document.createElement('br'), cpf);
        const tdTipo = document.createElement('td'); tdTipo.textContent = p.papel;
        if (p.vinculo_nome) { const vinculo = document.createElement('small'); vinculo.textContent = p.vinculo_nome; tdTipo.append(document.createElement('br'), vinculo); }
        const tdAcoes = document.createElement('td'), consulta = document.createElement('a'); consulta.href = link.href; consulta.textContent = 'Ver presenças';
        const desistir = document.createElement('button'); desistir.type = 'button'; desistir.className = 'btn-atender'; desistir.dataset.desistir = p.id; desistir.textContent = 'Registrar desistência'; tdAcoes.append(consulta, desistir);
        tr.append(tdPresenca, tdNome, tdTipo, tdAcoes); tbody.append(tr); document.getElementById('lista_vazia')?.remove();
    }
    document.getElementById('buscar_participante')?.addEventListener('click', async function () {
        const busca = document.getElementById('busca_participante').value.trim();
        if (busca.length < 2) { mensagem('Informe ao menos dois caracteres do nome ou CPF.'); return; }
        this.disabled = true;
        try {
            const resposta = await fetch('/api/gappus/participantes?busca=' + encodeURIComponent(busca), { headers: { Accept: 'application/json' } });
            const encontrados = await resposta.json();
            if (!resposta.ok) throw new Error(encontrados.mensagem);
            const select = document.getElementById('participante_existente'); select.replaceChildren(new Option('Selecionar pessoa existente', ''));
            for (const p of encontrados) select.add(new Option(p.nome + ' — ' + (p.cpf || 'sem CPF') + ' — ' + p.papel + (p.status === 'Desistiu' ? ' (desistiu)' : ''), p.id));
            mensagem(encontrados.length ? 'Selecione a pessoa correta e clique em Adicionar ao acompanhamento.' : 'Nenhum cadastro encontrado. Inclua o participante pelo nome.');
        } catch (e) { mensagem(e.message); } finally { this.disabled = false; }
    });
    document.getElementById('adicionar_participante')?.addEventListener('click', async function () {
        this.disabled = true;
        try {
            const id = document.getElementById('participante_existente').value;
            const p = id ? await api('/api/gappus/participantes/' + encodeURIComponent(id) + '/incluir', { data }) : await api('/api/gappus/participantes', {
                nome: document.getElementById('adicionar_nome').value, cpf: document.getElementById('adicionar_cpf').value,
                papel: document.getElementById('adicionar_papel').value, vinculo_nome: document.getElementById('adicionar_vinculo').value, data
            });
            linha(p, true);
            document.getElementById('adicionar_vinculo').value = '';
            if (!id) { document.getElementById('adicionar_nome').value = ''; document.getElementById('adicionar_cpf').value = ''; }
            mensagem('Participante incluído no acompanhamento. Salve as presenças para confirmar a participação neste encontro.');
        } catch (e) { mensagem(e.message); } finally { this.disabled = false; }
    });
    document.addEventListener('click', async event => {
        const button = event.target.closest('button[data-desistir], button[data-retomar]');
        if (!button) return;
        const desistir = Boolean(button.dataset.desistir);
        const id = button.dataset.desistir || button.dataset.retomar;
        if (desistir && !window.confirm('Registrar desistência do GAPPUS? O nome sairá das próximas listas e as presenças anteriores serão preservadas.')) return;
        button.disabled = true;
        try {
            const resultado = await api('/api/gappus/participantes/' + encodeURIComponent(id) + (desistir ? '/desistir' : '/retomar'));
            if (!formulario) { window.location.reload(); return; }
            if (desistir) {
                const tr = tbody.querySelector('[data-id="' + id + '"]');
                if (tr?.dataset.presencaSalva === 'true') { button.replaceWith(document.createTextNode('Desistiu do acompanhamento')); }
                else tr?.remove();
                mensagem('Desistência registrada. As presenças salvas foram preservadas. Para retomar, abra Ver presenças do participante ou reabra a lista.');
            } else {
                document.querySelector('[data-desistente="' + id + '"]')?.remove();
                if (data >= CasinhaDatas.hojeLocal()) linha(resultado, false);
                mensagem('Acompanhamento retomado. Marque a presença quando a pessoa comparecer.');
            }
        } catch (e) { mensagem(e.message); button.disabled = false; }
    });
})();
