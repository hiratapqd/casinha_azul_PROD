const Livro = require('../models/Livro');
const Venda = require('../models/Venda');

const getDataBrasilia = () => {
    const agora = new Date();
    return new Date(agora.getTime() - (3 * 60 * 60 * 1000));
};

exports.getCadastroLivro = (req, res) => {
    res.render('livraria/cadastro_livro');
};

const formatarTexto = (texto) => {
    if (!texto) return '';
    const excecoes = ['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'com', 'um', 'uma', 'por'];
    return texto.toLowerCase().trim().split(' ').map((palavra, index) => {
        if (index === 0 || !excecoes.includes(palavra)) {
            return palavra.charAt(0).toUpperCase() + palavra.slice(1);
        }
        return palavra;
    }).join(' ');
};


exports.salvarLivro = async (req, res) => {
    try {
        const { isbn, titulo, autor, ditadoPor, editora, preco_custo, preco_venda, estoque_inicial, estoque_minimo } = req.body;

        const novoLivro = new Livro({
            _id: isbn.replace(/\D/g, ''), 
            titulo: formatarTexto(titulo),
            autor: formatarTexto(autor),
            ditadoPor: formatarTexto(ditadoPor),
            editora: formatarTexto(editora),
            preco_custo: parseFloat(preco_custo) || 0,
            preco_venda: parseFloat(preco_venda) || 0,
            estoque_atual: parseInt(estoque_inicial) || 2,
            estoque_minimo: parseInt(estoque_minimo) || 2,
            data_cadastro: getDataBrasilia()
        });

        await novoLivro.save();
        res.redirect('/livraria/estoque?sucesso=true');
    } catch (err) {
        console.error("ERRO AO SALVAR:", err);
        if (err.code === 11000) {
            return res.status(400).send("Erro: Este ISBN já está cadastrado.");
        }
        console.error("Erro ao cadastrar:", err);
        res.status(500).send("Erro interno ao salvar o livro.");
    }
};

exports.getEstoque = async (req, res) => {
    try {
        const livros = await Livro.find().sort({ titulo: 1 }).lean();
        const vendasGerais = await Venda.find().lean();

        const hoje = new Date();
        const inicioDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        
        // Datas de corte para o Giro
        const data90 = new Date(hoje.getTime() - (90 * 24 * 60 * 60 * 1000));
        const data180 = new Date(hoje.getTime() - (180 * 24 * 60 * 60 * 1000));
        const data365 = new Date(hoje.getTime() - (365 * 24 * 60 * 60 * 1000));

        let totalVendidoMes = 0;
        let contagemTopMes = {}; 

        const livrosComGiro = livros.map(livro => {
            const vendasLivro = vendasGerais.filter(v => v.livro_id === livro._id);

            // 1. Cálculo para os Cards (Mês Atual)
            vendasLivro.forEach(v => {
                if (v.data_venda >= inicioDoMes) {
                    totalVendidoMes += v.valor_total || 0;
                    contagemTopMes[livro.titulo] = (contagemTopMes[livro.titulo] || 0) + v.quantidade;
                }
            });

            // 2. Cálculo para as Colunas de Giro (Histórico)
            livro.vendas90 = vendasLivro.filter(v => v.data_venda >= data90).reduce((acc, v) => acc + v.quantidade, 0);
            livro.vendas180 = vendasLivro.filter(v => v.data_venda >= data180).reduce((acc, v) => acc + v.quantidade, 0);
            livro.vendas365 = vendasLivro.filter(v => v.data_venda >= data365).reduce((acc, v) => acc + v.quantidade, 0);
            
            // 3. Alerta de Reposição (Estoque < Média mensal dos últimos 90 dias)
            livro.mediaMensal = (livro.vendas90 / 3);
            livro.alertaReposicao = livro.estoque_atual < (livro.estoque_minimo || 2) || livro.estoque_atual < livro.mediaMensal;

            return livro;
        });

        // Ordenar o Top 5 do Mês
        const top5 = Object.entries(contagemTopMes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const totalAlertas = livrosComGiro.filter(l => l.alertaReposicao).length;

        res.render('livraria/estoque', { 
            livros: livrosComGiro, 
            totalVendidoMes, 
            top5, 
            totalAlertas 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao carregar estoque.");
    }
};

exports.getEditarLivro = async (req, res) => {
    try {
        const livro = await Livro.findById(req.params.id);
        
        res.render('livraria/editar_livro', { livro });
    } catch (err) {
        res.status(500).send("Erro ao carregar dados do livro.");
    }
};

exports.atualizarLivro = async (req, res) => {
    try {
        const { titulo, autor, ditadoPor, editora, preco_custo, preco_venda, estoque_atual, estoque_minimo } = req.body;
        
        await Livro.findByIdAndUpdate(req.params.id, {
            titulo: formatarTexto(titulo),
            autor: formatarTexto(autor),
            ditadoPor: formatarTexto(ditadoPor),
            editora: formatarTexto(editora),
            preco_custo: Number(preco_custo) || 0,
            preco_venda: Number(preco_venda) || 0,
            estoque_atual: Number(estoque_atual) || 0,
            estoque_minimo: parseInt(estoque_minimo) || 2
        });

        res.redirect('/livraria/estoque?atualizado=true');
    } catch (err) {
        console.error("Erro ao atualizar:", err);
        res.status(500).send("Erro ao atualizar o livro.");
    }
};

exports.registrarVenda = async (req, res) => {
    try {
        const { isbn, quantidade } = req.body;
        const livro = await Livro.findById(isbn);

        if (!livro || livro.estoque_atual < quantidade) {
            return res.status(400).send("Estoque insuficiente ou livro não encontrado.");
        }

        // 1. Registra o histórico na nova collection 'vendas'
        const novaVenda = new Venda({
            livro_id: isbn,
            titulo_livro: livro.titulo,
            quantidade: parseInt(quantidade),
            valor_unitario: livro.preco_venda,
            valor_total: livro.preco_venda * quantidade,
            data_venda: new Date() // Data exata da venda
        });

        // 2. Atualiza o estoque real do livro
        livro.estoque_atual -= parseInt(quantidade);

        await novaVenda.save();
        await livro.save();

        res.redirect('/livraria/estoque?venda_sucesso=true');
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao processar venda.");
    }
};

exports.registrarVendaRapida = async (req, res) => {
    try {
        const { isbn, qtd } = req.body;
        const livro = await Livro.findById(isbn);

        if (!livro || livro.estoque_atual < qtd) {
            return res.status(400).json({ erro: "Estoque insuficiente" });
        }

        const novaVenda = new Venda({
            livro_id: isbn,
            titulo_livro: livro.titulo,
            quantidade: parseInt(qtd),
            valor_unitario: livro.preco_venda,
            valor_total: livro.preco_venda * parseInt(qtd)
        });

        livro.estoque_atual -= parseInt(qtd);

        await novaVenda.save();
        await livro.save();

        res.json({ sucesso: true, novoEstoque: livro.estoque_atual });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao processar venda" });
    }
};