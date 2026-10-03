(() => {
    const opcao = document.getElementById('para_terceiro');
    if (!opcao) return;
    const painel = document.getElementById('dados_beneficiario');
    const nome = document.getElementById('beneficiario_nome');
    const cpf = document.getElementById('beneficiario_cpf');
    const id = document.getElementById('beneficiario_id');
    const resultados = document.getElementById('resultados_beneficiario');
    const feedback = document.getElementById('feedback_beneficiario');
    opcao.addEventListener('change', () => {
        painel.hidden = !opcao.checked;
        nome.required = opcao.checked;
        for (const campo of painel.querySelectorAll('input, select, button')) campo.disabled = !opcao.checked;
    });
    function limparCadastro() {
        id.value = '';
        resultados.replaceChildren();
        feedback.textContent = '';
    }
    nome.addEventListener('input', limparCadastro);
    cpf.addEventListener('input', limparCadastro);
    document.getElementById('buscar_beneficiario').addEventListener('click', async function () {
        limparCadastro();
        const busca = cpf.value.replace(/\D/g, '') || nome.value.trim();
        if (busca.length < 2) { feedback.textContent = 'Informe o nome ou CPF para buscar.'; return; }
        this.disabled = true;
        try {
            const res = await fetch('/api/gappus/participantes?busca=' + encodeURIComponent(busca), { headers: { Accept: 'application/json' } });
            if (!res.ok) throw new Error('Não foi possível buscar as pessoas cadastradas.');
            const pessoas = await res.json();
            for (const pessoa of pessoas) {
                const botao = document.createElement('button');
                botao.type = 'button';
                botao.className = 'btn-atender';
                botao.textContent = 'Usar cadastro: ' + pessoa.nome + (pessoa.cpf ? ' — ' + pessoa.cpf : ' — sem CPF');
                botao.addEventListener('click', () => {
                    id.value = pessoa.id;
                    nome.value = pessoa.nome;
                    cpf.value = pessoa.cpf || '';
                    resultados.replaceChildren();
                    feedback.textContent = 'Cadastro selecionado: ' + pessoa.nome + '.';
                });
                resultados.appendChild(botao);
            }
            feedback.textContent = pessoas.length ? 'Clique no cadastro correto para reutilizá-lo.' : 'Nenhum cadastro encontrado. O assistido será identificado pelo nome informado.';
        } catch (e) { feedback.textContent = e.message; }
        finally { this.disabled = false; }
    });
})();
