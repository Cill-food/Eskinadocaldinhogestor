// script.js
// Configurações iniciais
const SENHA_PADRAO = "admin123"; // Senha inicial, pode ser alterada
let senhaAtual = localStorage.getItem("senhaGerente") || SENHA_PADRAO;
let logado = false;

// Ícones para categorias
const icons = {
  Destilados: "fa-glass-whiskey",
  "Petiscos / Porções": "fa-utensils",
  Espetinhos: "fa-drumstick-bite",
  Drinks: "fa-cocktail",
  "Sucos e Refrigerantes": "fa-wine-bottle",
  Cervejas: "fa-beer",
};

// Unidades para ingredientes
const UNITS = ["kg", "lt", "un", "g", "ml"];

// Estado do sistema
let mesas =
  JSON.parse(localStorage.getItem("mesas")) ||
  Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    status: "livre",
    pedidos: [],
  }));
let historicoVendas =
  JSON.parse(localStorage.getItem("historicoVendas")) || [];
let estoque = JSON.parse(localStorage.getItem("estoque")) || [];
let receitas = JSON.parse(localStorage.getItem("receitas")) || {};
let mesaAtual = null;
let itemEditAtual = null;
let prodFichaAtual = null;
let tempFicha = [];
let chartDia = null;
let chartPagDia = null;
let chartsSemanais = {};
let chartsPagSemanais = {};
let chartsMensais = {};
let chartsPagMensais = {};

// Cache para relatórios
let cacheRelatoriosMensais = null;
let cacheRelatoriosSemanais = null;

// Funções de persistência
function salvarEstado() {
  localStorage.setItem("mesas", JSON.stringify(mesas));
  localStorage.setItem(
    "historicoVendas",
    JSON.stringify(historicoVendas)
  );
  localStorage.setItem("estoque", JSON.stringify(estoque));
  localStorage.setItem("receitas", JSON.stringify(receitas));
  localStorage.setItem("CATEGORIES", JSON.stringify(window.CATEGORIES));
  localStorage.setItem("CARDAPIO", JSON.stringify(window.CARDAPIO));
  localStorage.setItem("senhaGerente", senhaAtual);
  // Invalidar cache
  cacheRelatoriosMensais = null;
  cacheRelatoriosSemanais = null;
}

// Função para obter número da semana ISO
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return (
    d.getUTCFullYear() + "-W" + (weekNo < 10 ? "0" + weekNo : weekNo)
  );
}

// Função para mostrar erro de validação
function showError(inputId, message) {
  const input = document.getElementById(inputId);
  input.classList.add('input-error');
  let error = input.nextElementSibling;
  if (!error || !error.classList.contains('error-message')) {
    error = document.createElement('p');
    error.className = 'error-message';
    input.parentNode.insertBefore(error, input.nextSibling);
  }
  error.textContent = message;
}

// Função para remover erro de validação
function removeError(inputId) {
  const input = document.getElementById(inputId);
  input.classList.remove('input-error');
  const error = input.nextElementSibling;
  if (error && error.classList.contains('error-message')) {
    error.remove();
  }
}

// Login
document.getElementById("btn-login").onclick = () => {
  const senha = document.getElementById("senha-login").value;
  if (!senha) {
    showError('senha-login', 'Senha é obrigatória');
    return;
  }
  removeError('senha-login');
  if (senha === senhaAtual) {
    logado = true;
    document.getElementById("modal-login").style.display = "none";
    document
      .getElementById("header-principal")
      .classList.remove("hidden");
    document.getElementById("nav-principal").classList.remove("hidden");
    document.getElementById("main-principal").classList.remove("hidden");
    renderMesas();
    document.getElementById("tab-mesas").click();
  } else {
    document.getElementById("erro-login").classList.remove("hidden");
  }
};

// Renderizar mesas
function renderMesas() {
  const secaoMesas = document.getElementById("secao-mesas");
  secaoMesas.innerHTML = "";
  mesas.forEach((mesa) => {
    const btn = document.createElement("button");
    btn.className = `p-6 rounded text-lg fade-in ${
      mesa.status === "livre" ? "bg-green-600" : "bg-red-600"
    }`;
    btn.textContent = `Mesa ${mesa.id}`;
    btn.onclick = () => abrirModalMesa(mesa);
    secaoMesas.appendChild(btn);
  });
  // Botão adicionar mesa
  const btnAdd = document.createElement("button");
  btnAdd.className = "accent-orange p-6 rounded text-lg fade-in";
  btnAdd.textContent = "+ Adicionar Mesa";
  btnAdd.onclick = () => {
    const novaMesa = {
      id: mesas.length + 1,
      status: "livre",
      pedidos: [],
    };
    mesas.push(novaMesa);
    salvarEstado();
    renderMesas();
  };
  secaoMesas.appendChild(btnAdd);
  // Botão remover última mesa (se >1)
  if (mesas.length > 1) {
    const btnRem = document.createElement("button");
    btnRem.className = "bg-red-600 p-6 rounded text-lg fade-in";
    btnRem.textContent = "- Remover Última Mesa";
    btnRem.onclick = () => {
      mesas.pop();
      salvarEstado();
      renderMesas();
    };
    secaoMesas.appendChild(btnRem);
  }
}

// Abrir modal de mesa
function abrirModalMesa(mesa) {
  mesaAtual = mesa;
  const modal = document.getElementById("modal-mesa");
  document.getElementById("titulo-mesa").textContent = `Mesa ${mesa.id}`;
  document.getElementById("desconto-mesa").value = 0;
  document.getElementById("gorjeta-mesa").value = 0;
  renderPedidos();
  modal.style.display = "block";
  if (mesa.pedidos.length > 0) {
    mesa.status = "ocupada";
  } else {
    mesa.status = "livre";
  }
  salvarEstado();
  renderMesas();
}

// Renderizar pedidos na mesa
function renderPedidos() {
  const lista = document.getElementById("lista-pedidos");
  lista.innerHTML = "";
  let subtotal = 0;
  mesaAtual.pedidos.forEach((pedido, index) => {
    const div = document.createElement("div");
    div.className = "flex justify-between mb-2 items-center fade-in";
    div.innerHTML = `
      <span>${pedido.name}</span>
      <div class="flex items-center">
          <button class="bg-gray-600 px-2 py-1 rounded" onclick="ajustarQty(${index}, -1)">-</button>
          <span class="mx-2">x${pedido.qty}</span>
          <button class="bg-gray-600 px-2 py-1 rounded" onclick="ajustarQty(${index}, 1)">+</button>
      </div>
      <span>R$ ${(pedido.price * pedido.qty).toFixed(2)}</span>
      <button class="bg-red-600 px-2 py-1 rounded ml-2" onclick="removerPedido(${index})">Remover</button>
    `;
    lista.appendChild(div);
    subtotal += pedido.price * pedido.qty;
  });
  const desconto = parseFloat(document.getElementById("desconto-mesa").value) || 0;
  const gorjeta = parseFloat(document.getElementById("gorjeta-mesa").value) || 0;
  const total = subtotal * (1 - desconto / 100) + gorjeta;
  document.getElementById("total-mesa").textContent = `Total: R$ ${total.toFixed(2)}`;
}

// Ajustar quantidade
window.ajustarQty = (index, delta) => {
  const newQty = mesaAtual.pedidos[index].qty + delta;
  if (newQty <= 0) {
    removerPedido(index);
  } else {
    mesaAtual.pedidos[index].qty = newQty;
    salvarEstado();
    renderPedidos();
  }
};

// Remover pedido
window.removerPedido = (index) => {
  mesaAtual.pedidos.splice(index, 1);
  salvarEstado();
  renderPedidos();
};

// Eventos para desconto e gorjeta com validação
document.getElementById("desconto-mesa").oninput = () => {
  let value = parseFloat(document.getElementById("desconto-mesa").value);
  if (isNaN(value) || value < 0 || value > 100) {
    showError('desconto-mesa', 'Desconto deve ser entre 0 e 100');
  } else {
    removeError('desconto-mesa');
    renderPedidos();
  }
};
document.getElementById("gorjeta-mesa").oninput = () => {
  let value = parseFloat(document.getElementById("gorjeta-mesa").value);
  if (isNaN(value) || value < 0) {
    showError('gorjeta-mesa', 'Gorjeta deve ser maior ou igual a 0');
  } else {
    removeError('gorjeta-mesa');
    renderPedidos();
  }
};

// Adicionar item
document.getElementById("btn-adicionar").onclick = () => {
  renderCategorias();
  document.getElementById("modal-adicionar").style.display = "block";
  document.getElementById("lista-itens").innerHTML = "";
};

// Renderizar categorias no adicionar
function renderCategorias() {
  const listaCat = document.getElementById("lista-categorias");
  listaCat.innerHTML = "";
  window.CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className =
      "accent-orange p-4 rounded flex flex-col items-center text-lg fade-in";
    btn.innerHTML = `<i class="fas ${
      icons[cat] || "fa-question"
    } text-3xl mb-2"></i>${cat}`;
    btn.onclick = () => mostrarItens(cat);
    listaCat.appendChild(btn);
  });
}

// Mostrar itens da categoria
function mostrarItens(cat) {
  const listaItens = document.getElementById("lista-itens");
  listaItens.innerHTML = "";
  window.CARDAPIO.filter((item) => item.category === cat).forEach(
    (item) => {
      const card = document.createElement("div");
      card.className = "bg-gray-800 p-4 rounded text-center fade-in";
      card.innerHTML = `
        <img src="${item.image}" alt="${item.name}" class="w-full h-32 object-cover rounded mb-2">
        <h3 class="text-lg">${item.name}</h3>
        <p>R$ ${item.price.toFixed(2)}</p>
        <p class="text-sm">${item.description || ""}</p>
      `;
      card.onclick = () => adicionarPedido(item);
      listaItens.appendChild(card);
    }
  );
}

// Adicionar pedido à mesa
function adicionarPedido(item) {
  const existente = mesaAtual.pedidos.find((p) => p.id === item.id);
  if (existente) {
    existente.qty += 1;
  } else {
    mesaAtual.pedidos.push({ ...item, qty: 1 });
  }
  salvarEstado();
  document.getElementById("modal-adicionar").style.display = "none";
  renderPedidos();
}

// Busca itens
document
  .getElementById("busca-itens")
  .addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const listaItens = document.getElementById("lista-itens");
    listaItens.innerHTML = "";
    if (query) {
      document.getElementById("lista-categorias").classList.add("hidden");
      window.CARDAPIO.filter((item) =>
        item.name.toLowerCase().includes(query)
      ).forEach((item) => {
        const card = document.createElement("div");
        card.className = "bg-gray-800 p-4 rounded text-center fade-in";
        card.innerHTML = `
          <img src="${item.image}" alt="${item.name}" class="w-full h-32 object-cover rounded mb-2">
          <h3 class="text-lg">${item.name}</h3>
          <p>R$ ${item.price.toFixed(2)}</p>
          <p class="text-sm">${item.description || ""}</p>
        `;
        card.onclick = () => adicionarPedido(item);
        listaItens.appendChild(card);
      });
    } else {
      document.getElementById("lista-categorias").classList.remove("hidden");
    }
  });

// Imprimir conta (simulado)
document.getElementById("btn-imprimir").onclick = () => {
  alert("Imprimindo conta... (Funcionalidade simulada)");
};

// Finalizar conta
document.getElementById("btn-finalizar").onclick = () => {
  if (mesaAtual.pedidos.length === 0) {
    alert("Adicione itens antes de finalizar.");
    return;
  }
  const resumo = document.getElementById("resumo-conta");
  resumo.innerHTML = "";
  mesaAtual.pedidos.forEach((pedido) => {
    const div = document.createElement("div");
    div.className = "flex justify-between mb-2";
    div.textContent = `${pedido.name} x${pedido.qty} - R$ ${(pedido.price * pedido.qty).toFixed(2)}`;
    resumo.appendChild(div);
  });
  const desconto = parseFloat(document.getElementById("desconto-mesa").value) || 0;
  const gorjeta = parseFloat(document.getElementById("gorjeta-mesa").value) || 0;
  const subtotal = mesaAtual.pedidos.reduce((sum, p) => sum + p.price * p.qty, 0);
  const total = subtotal * (1 - desconto / 100) + gorjeta;
  document.getElementById("total-final").textContent = `Total: R$ ${total.toFixed(2)}`;
  document.getElementById("modal-finalizar").style.display = "block";
};

// Confirmar finalização
document.getElementById("confirmar-finalizar").onclick = () => {
  const pagamento = document.getElementById("forma-pagamento").value;
  const desconto = parseFloat(document.getElementById("desconto-mesa").value) || 0;
  const gorjeta = parseFloat(document.getElementById("gorjeta-mesa").value) || 0;
  const subtotal = mesaAtual.pedidos.reduce((sum, p) => sum + p.price * p.qty, 0);
  const total = subtotal * (1 - desconto / 100) + gorjeta;
  // Deduzir estoque
  let estoqueSuficiente = true;
  mesaAtual.pedidos.forEach((pedido) => {
    if (receitas[pedido.id]) {
      receitas[pedido.id].forEach((ing) => {
        const estoqueItem = estoque.find((e) => e.id === ing.id_ingrediente);
        if (estoqueItem) {
          const required = ing.qtd * pedido.qty;
          if (estoqueItem.quantidade < required) {
            estoqueSuficiente = false;
            alert(`Estoque insuficiente para ${estoqueItem.nome}`);
          } else {
            estoqueItem.quantidade -= required;
          }
        }
      });
    }
  });
  if (!estoqueSuficiente) return;
  // Registrar venda
  historicoVendas.push({
    data: new Date().toISOString().split("T")[0],
    mesa: mesaAtual.id,
    itens: mesaAtual.pedidos.map((p) => ({ ...p })),
    total,
    desconto,
    gorjeta,
    pagamento,
  });
  // Limpar mesa
  mesaAtual.pedidos = [];
  mesaAtual.status = "livre";
  salvarEstado();
  renderMesas();
  renderEstoque();
  document.getElementById("modal-finalizar").style.display = "none";
  document.getElementById("modal-mesa").style.display = "none";
};

// Cores para gráficos
const chartColors = {
  backgroundColor: [
    "#ff6f00",
    "#ff8f00",
    "#ffb300",
    "#ffd700",
    "#ffeb3b",
    "#fff59d",
  ],
  borderColor: "#121212",
  color: "#ffffff",
};

// Renderizar caixa
function renderCaixa(data = new Date().toISOString().split("T")[0]) {
  const vendasDia = historicoVendas.filter((v) => v.data === data);
  const totalDia = vendasDia.reduce((sum, v) => sum + v.total, 0);
  const descontosDia = vendasDia.reduce(
    (sum, v) =>
      sum +
      (v.itens.reduce((s, i) => s + i.price * i.qty, 0) * v.desconto) / 100,
    0
  );
  const gorjetasDia = vendasDia.reduce((sum, v) => sum + v.gorjeta, 0);
  document.getElementById(
    "total-dia"
  ).textContent = `Total do Dia: R$ ${totalDia.toFixed(
    2
  )} (Descontos: R$ ${descontosDia.toFixed(
    2
  )}, Gorjetas: R$ ${gorjetasDia.toFixed(2)})`;

  // Produtos mais vendidos
  const itensVendidos = {};
  vendasDia.forEach((v) =>
    v.itens.forEach((i) => {
      itensVendidos[i.id] = (itensVendidos[i.id] || 0) + i.qty;
    })
  );
  const sortedItens = Object.entries(itensVendidos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Top 5
  const ulProdutos = document.getElementById("produtos-vendidos");
  ulProdutos.innerHTML = "";
  sortedItens.forEach(([id, qty]) => {
    const item = window.CARDAPIO.find((i) => i.id === id);
    if (item) {
      const li = document.createElement("li");
      li.textContent = `${item.name}: ${qty} unidades`;
      ulProdutos.appendChild(li);
    }
  });

  // Vendas por categoria
  const categoriasDia = {};
  vendasDia.forEach((v) =>
    v.itens.forEach((i) => {
      categoriasDia[i.category] =
        (categoriasDia[i.category] || 0) + i.price * i.qty;
    })
  );
  const sortedCat = Object.entries(categoriasDia).sort(
    (a, b) => b[1] - a[1]
  );
  const ulCategorias = document.getElementById("vendas-categoria-dia");
  ulCategorias.innerHTML = "";
  sortedCat.forEach(([cat, total]) => {
    const li = document.createElement("li");
    li.textContent = `${cat}: R$ ${total.toFixed(2)}`;
    ulCategorias.appendChild(li);
  });

  // Gráfico por categoria
  requestAnimationFrame(() => {
    const ctxDia = document.getElementById("chart-dia").getContext("2d");
    if (chartDia) chartDia.destroy();
    chartDia = new Chart(ctxDia, {
      type: "pie",
      data: {
        labels: sortedCat.map(([cat]) => cat),
        datasets: [
          {
            data: sortedCat.map(([, total]) => total),
            backgroundColor: chartColors.backgroundColor,
            borderColor: chartColors.borderColor,
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "top",
            labels: { color: chartColors.color },
          },
          title: {
            display: true,
            text: "Vendas por Categoria",
            color: chartColors.color,
          },
        },
      },
    });
  });

  // Vendas por pagamento
  const pagamentosDia = {};
  vendasDia.forEach((v) => {
    pagamentosDia[v.pagamento] =
      (pagamentosDia[v.pagamento] || 0) + v.total;
  });
  const sortedPag = Object.entries(pagamentosDia).sort(
    (a, b) => b[1] - a[1]
  );
  const ulPag = document.getElementById("pagamentos-dia");
  ulPag.innerHTML = "";
  sortedPag.forEach(([pag, total]) => {
    const li = document.createElement("li");
    li.textContent = `${pag}: R$ ${total.toFixed(2)}`;
    ulPag.appendChild(li);
  });

  // Gráfico por pagamento
  requestAnimationFrame(() => {
    const ctxPagDia = document
      .getElementById("chart-pagamento-dia")
      .getContext("2d");
    if (chartPagDia) chartPagDia.destroy();
    chartPagDia = new Chart(ctxPagDia, {
      type: "pie",
      data: {
        labels: sortedPag.map(([pag]) => pag),
        datasets: [
          {
            data: sortedPag.map(([, total]) => total),
            backgroundColor: chartColors.backgroundColor,
            borderColor: chartColors.borderColor,
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "top",
            labels: { color: chartColors.color },
          },
          title: {
            display: true,
            text: "Vendas por Método de Pagamento",
            color: chartColors.color,
          },
        },
      },
    });
  });
}

// Obter relatórios semanais
function getRelatoriosSemanais() {
  if (cacheRelatoriosSemanais) return cacheRelatoriosSemanais;
  const semanas = {};
  historicoVendas.forEach((v) => {
    const semana = getWeekNumber(new Date(v.data));
    if (!semanas[semana]) {
      semanas[semana] = {
        total: 0,
        descontos: 0,
        gorjetas: 0,
        itens: {},
        categorias: {},
        pagamentos: {},
      };
    }
    semanas[semana].total += v.total;
    semanas[semana].descontos +=
      (v.itens.reduce((s, i) => s + i.price * i.qty, 0) * v.desconto) / 100;
    semanas[semana].gorjetas += v.gorjeta;
    v.itens.forEach((i) => {
      semanas[semana].itens[i.id] = (semanas[semana].itens[i.id] || 0) + i.qty;
      semanas[semana].categorias[i.category] =
        (semanas[semana].categorias[i.category] || 0) + i.price * i.qty;
    });
    semanas[semana].pagamentos[v.pagamento] =
      (semanas[semana].pagamentos[v.pagamento] || 0) + v.total;
  });
  cacheRelatoriosSemanais = semanas;
  return semanas;
}

// Renderizar relatórios semanais
function renderRelatoriosSemanais() {
  const semanas = getRelatoriosSemanais();
  const listaSemanas = document.getElementById("lista-semanas");
  listaSemanas.innerHTML = "";
  Object.keys(semanas)
    .sort((a, b) => b.localeCompare(a))
    .forEach((semana) => {
      const divSemana = document.createElement("div");
      divSemana.className = "bg-gray-800 p-4 rounded fade-in";
      divSemana.innerHTML = `<h3 class="text-lg mb-2">Semana ${semana}</h3>
            <p>Total: R$ ${semanas[semana].total.toFixed(2)} (Descontos: R$ ${semanas[
        semana
      ].descontos.toFixed(2)}, Gorjetas: R$ ${semanas[semana].gorjetas.toFixed(
        2
      )})</p>
            <h4 class="text-md mb-1 mt-2">Produtos Mais Vendidos</h4>
            <ul class="list-disc pl-5 mb-2"></ul>
            <h4 class="text-md mb-1">Vendas por Categoria</h4>
            <canvas id="chart-semana-${semana}" class="my-4"></canvas>
            <ul class="list-disc pl-5 mb-2"></ul>
            <h4 class="text-md mb-1">Vendas por Método de Pagamento</h4>
            <canvas id="chart-pagamento-semana-${semana}" class="my-4"></canvas>
            <ul class="list-disc pl-5"></ul>`;
      const ulProdutos = divSemana.querySelector("ul:nth-of-type(1)");
      const sortedItens = Object.entries(semanas[semana].itens)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Top 5
      sortedItens.forEach(([id, qty]) => {
        const item = window.CARDAPIO.find((i) => i.id === id);
        if (item) {
          const li = document.createElement("li");
          li.textContent = `${item.name}: ${qty} unidades`;
          ulProdutos.appendChild(li);
        }
      });
      const ulCategorias = divSemana.querySelector("ul:nth-of-type(2)");
      const sortedCat = Object.entries(semanas[semana].categorias).sort(
        (a, b) => b[1] - a[1]
      );
      sortedCat.forEach(([cat, total]) => {
        const li = document.createElement("li");
        li.textContent = `${cat}: R$ ${total.toFixed(2)}`;
        ulCategorias.appendChild(li);
      });

      const ulPagamentos = divSemana.querySelector("ul:nth-of-type(3)");
      const sortedPag = Object.entries(semanas[semana].pagamentos).sort(
        (a, b) => b[1] - a[1]
      );
      sortedPag.forEach(([pag, total]) => {
        const li = document.createElement("li");
        li.textContent = `${pag}: R$ ${total.toFixed(2)}`;
        ulPagamentos.appendChild(li);
      });
      listaSemanas.appendChild(divSemana);

      // Gráfico semanal (categorias)
      requestAnimationFrame(() => {
        const ctxSem = document
          .getElementById(`chart-semana-${semana}`)
          .getContext("2d");
        if (chartsSemanais[semana]) chartsSemanais[semana].destroy();
        chartsSemanais[semana] = new Chart(ctxSem, {
          type: "pie",
          data: {
            labels: sortedCat.map(([cat]) => cat),
            datasets: [
              {
                data: sortedCat.map(([, total]) => total),
                backgroundColor: chartColors.backgroundColor,
                borderColor: chartColors.borderColor,
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                position: "top",
                labels: { color: chartColors.color },
              },
              title: {
                display: true,
                text: `Vendas por Categoria (Semana ${semana})`,
                color: chartColors.color,
              },
            },
          },
        });
      });

      // Gráfico de pagamentos semanal
      requestAnimationFrame(() => {
        const ctxPagSem = document
          .getElementById(`chart-pagamento-semana-${semana}`)
          .getContext("2d");
        if (chartsPagSemanais[semana]) chartsPagSemanais[semana].destroy();
        chartsPagSemanais[semana] = new Chart(ctxPagSem, {
          type: "pie",
          data: {
            labels: sortedPag.map(([pag]) => pag),
            datasets: [
              {
                data: sortedPag.map(([, total]) => total),
                backgroundColor: chartColors.backgroundColor,
                borderColor: chartColors.borderColor,
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                position: "top",
                labels: { color: chartColors.color },
              },
              title: {
                display: true,
                text: `Vendas por Método de Pagamento (Semana ${semana})`,
                color: chartColors.color,
              },
            },
          },
        });
      });
    });
}

// Obter relatórios mensais
function getRelatoriosMensais() {
  if (cacheRelatoriosMensais) return cacheRelatoriosMensais;
  const meses = {};
  historicoVendas.forEach((v) => {
    const mes = v.data.substring(0, 7); // YYYY-MM
    if (!meses[mes]) {
      meses[mes] = {
        total: 0,
        descontos: 0,
        gorjetas: 0,
        itens: {},
        categorias: {},
        pagamentos: {},
      };
    }
    meses[mes].total += v.total;
    meses[mes].descontos +=
      (v.itens.reduce((s, i) => s + i.price * i.qty, 0) * v.desconto) / 100;
    meses[mes].gorjetas += v.gorjeta;
    v.itens.forEach((i) => {
      meses[mes].itens[i.id] = (meses[mes].itens[i.id] || 0) + i.qty;
      meses[mes].categorias[i.category] =
        (meses[mes].categorias[i.category] || 0) + i.price * i.qty;
    });
    meses[mes].pagamentos[v.pagamento] =
      (meses[mes].pagamentos[v.pagamento] || 0) + v.total;
  });
  cacheRelatoriosMensais = meses;
  return meses;
}

// Renderizar relatórios mensais
function renderRelatorios() {
  const meses = getRelatoriosMensais();
  const listaMeses = document.getElementById("lista-meses");
  listaMeses.innerHTML = "";
  Object.keys(meses)
    .sort((a, b) => b.localeCompare(a))
    .forEach((mes) => {
      const divMes = document.createElement("div");
      divMes.className = "bg-gray-800 p-4 rounded fade-in";
      divMes.innerHTML = `<h3 class="text-lg mb-2">Mês ${mes}</h3>
            <p>Total: R$ ${meses[mes].total.toFixed(2)} (Descontos: R$ ${meses[
        mes
      ].descontos.toFixed(2)}, Gorjetas: R$ ${meses[mes].gorjetas.toFixed(
        2
      )})</p>
            <h4 class="text-md mb-1 mt-2">Produtos Mais Vendidos</h4>
            <ul class="list-disc pl-5 mb-2"></ul>
            <h4 class="text-md mb-1">Vendas por Categoria</h4>
            <canvas id="chart-${mes}" class="my-4"></canvas>
            <ul class="list-disc pl-5 mb-2"></ul>
            <h4 class="text-md mb-1">Vendas por Método de Pagamento</h4>
            <canvas id="chart-pagamento-${mes}" class="my-4"></canvas>
            <ul class="list-disc pl-5"></ul>`;
      const ulProdutos = divMes.querySelector("ul:nth-of-type(1)");
      const sortedItens = Object.entries(meses[mes].itens)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Top 5
      sortedItens.forEach(([id, qty]) => {
        const item = window.CARDAPIO.find((i) => i.id === id);
        if (item) {
          const li = document.createElement("li");
          li.textContent = `${item.name}: ${qty} unidades`;
          ulProdutos.appendChild(li);
        }
      });
      const ulCategorias = divMes.querySelector("ul:nth-of-type(2)");
      const sortedCat = Object.entries(meses[mes].categorias).sort(
        (a, b) => b[1] - a[1]
      );
      sortedCat.forEach(([cat, total]) => {
        const li = document.createElement("li");
        li.textContent = `${cat}: R$ ${total.toFixed(2)}`;
        ulCategorias.appendChild(li);
      });

      const ulPagamentos = divMes.querySelector("ul:nth-of-type(3)");
      const sortedPag = Object.entries(meses[mes].pagamentos).sort(
        (a, b) => b[1] - a[1]
      );
      sortedPag.forEach(([pag, total]) => {
        const li = document.createElement("li");
        li.textContent = `${pag}: R$ ${total.toFixed(2)}`;
        ulPagamentos.appendChild(li);
      });
      listaMeses.appendChild(divMes);

      // Gráfico mensal (categorias)
      requestAnimationFrame(() => {
        const ctxMes = document
          .getElementById(`chart-${mes}`)
          .getContext("2d");
        if (chartsMensais[mes]) chartsMensais[mes].destroy();
        chartsMensais[mes] = new Chart(ctxMes, {
          type: "pie",
          data: {
            labels: sortedCat.map(([cat]) => cat),
            datasets: [
              {
                data: sortedCat.map(([, total]) => total),
                backgroundColor: chartColors.backgroundColor,
                borderColor: chartColors.borderColor,
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                position: "top",
                labels: { color: chartColors.color },
              },
              title: {
                display: true,
                text: `Vendas por Categoria (${mes})`,
                color: chartColors.color,
              },
            },
          },
        });
      });

      // Gráfico de pagamentos mensal
      requestAnimationFrame(() => {
        const ctxPagMes = document
          .getElementById(`chart-pagamento-${mes}`)
          .getContext("2d");
        if (chartsPagMensais[mes]) chartsPagMensais[mes].destroy();
        chartsPagMensais[mes] = new Chart(ctxPagMes, {
          type: "pie",
          data: {
            labels: sortedPag.map(([pag]) => pag),
            datasets: [
              {
                data: sortedPag.map(([, total]) => total),
                backgroundColor: chartColors.backgroundColor,
                borderColor: chartColors.borderColor,
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                position: "top",
                labels: { color: chartColors.color },
              },
              title: {
                display: true,
                text: `Vendas por Método de Pagamento (${mes})`,
                color: chartColors.color,
              },
            },
          },
        });
      });
    });
}

// Renderizar histórico de vendas
function renderHistorico(query = "") {
  const listaHistorico = document.getElementById("lista-historico");
  listaHistorico.innerHTML = "";
  const filtered = historicoVendas.filter((venda) => {
    const searchStr = `${venda.data} Mesa ${venda.mesa} ${
      venda.pagamento
    } ${venda.itens.map((i) => i.name).join(" ")}`.toLowerCase();
    return searchStr.includes(query.toLowerCase());
  });
  filtered
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .forEach((venda) => {
      const divVenda = document.createElement("div");
      divVenda.className = "bg-gray-800 p-4 rounded fade-in";
      divVenda.innerHTML = `<h3 class="text-lg mb-2">Venda em ${
        venda.data
      } - Mesa ${venda.mesa}</h3>
            <p>Total: R$ ${venda.total.toFixed(2)} (Desconto: ${
        venda.desconto
      }%, Gorjeta: R$ ${venda.gorjeta.toFixed(2)}, Pagamento: ${
        venda.pagamento
      })</p>
            <ul class="list-disc pl-5 mt-2"></ul>`;
      const ulItens = divVenda.querySelector("ul");
      venda.itens.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = `${item.name} x${item.qty} - R$ ${(
          item.price * item.qty
        ).toFixed(2)}`;
        ulItens.appendChild(li);
      });
      listaHistorico.appendChild(divVenda);
    });
}

// Busca no histórico
document
  .getElementById("busca-historico")
  .addEventListener("input", (e) => renderHistorico(e.target.value));

// Renderizar estoque
function renderEstoque() {
  const tabela = document.getElementById("tabela-estoque");
  tabela.innerHTML = "";
  estoque.forEach((ing, index) => {
    const tr = document.createElement("tr");
    tr.className =
      ing.quantidade < ing.min_quantidade ? "bg-red-800" : "";
    tr.innerHTML = `
      <td class="p-2">${ing.nome}</td>
      <td class="p-2">${ing.quantidade}</td>
      <td class="p-2">${ing.unidade}</td>
      <td class="p-2">${ing.min_quantidade}</td>
      <td class="p-2">
        <button class="bg-blue-600 px-2 py-1 rounded" onclick="abrirModalIngrediente(true, ${index})">Editar</button>
        <button class="bg-red-600 px-2 py-1 rounded ml-2" onclick="removerIngrediente(${index})">Excluir</button>
      </td>
    `;
    tabela.appendChild(tr);
  });
}

// Abrir modal ingrediente
window.abrirModalIngrediente = (edit = false, index = null) => {
  const modal = document.getElementById("modal-ingrediente");
  const titulo = document.getElementById("titulo-ingrediente");
  titulo.textContent = edit
    ? "Editar Ingrediente"
    : "Adicionar Ingrediente";
  document.getElementById("id-ing").value = edit ? index : "";
  document.getElementById("name-ing").value = edit
    ? estoque[index].nome
    : "";
  document.getElementById("quantidade-ing").value = edit
    ? estoque[index].quantidade
    : "";
  document.getElementById("unit-ing").value = edit
    ? estoque[index].unidade
    : "un";
  document.getElementById("min-qty-ing").value = edit
    ? estoque[index].min_quantidade
    : "";
  modal.style.display = "block";
};

// Salvar ingrediente com validação
document.getElementById("salvar-ingrediente").onclick = () => {
  const idIndex = document.getElementById("id-ing").value;
  const nome = document.getElementById("name-ing").value.trim();
  const quantidade = parseFloat(document.getElementById("quantidade-ing").value) || 0;
  const unidade = document.getElementById("unit-ing").value;
  const min_quantidade = parseFloat(document.getElementById("min-qty-ing").value) || 0;
  let valid = true;
  if (!nome) {
    showError('name-ing', 'Nome é obrigatório');
    valid = false;
  } else {
    const existing = estoque.find((i, idx) => i.nome === nome && (idIndex === "" || idx !== parseInt(idIndex)));
    if (existing) {
      showError('name-ing', 'Nome já existe');
      valid = false;
    } else {
      removeError('name-ing');
    }
  }
  if (quantidade < 0) {
    showError('quantidade-ing', 'Quantidade deve ser maior ou igual a 0');
    valid = false;
  } else {
    removeError('quantidade-ing');
  }
  if (min_quantidade < 0) {
    showError('min-qty-ing', 'Quantidade mínima deve ser maior ou igual a 0');
    valid = false;
  } else {
    removeError('min-qty-ing');
  }
  if (quantidade < min_quantidade) {
    showError('quantidade-ing', 'Quantidade atual deve ser maior ou igual à mínima');
    valid = false;
  }
  if (valid) {
    if (idIndex !== "") {
      const index = parseInt(idIndex);
      estoque[index] = {
        ...estoque[index],
        nome,
        quantidade,
        unidade,
        min_quantidade,
      };
    } else {
      const newId = "ing_" + Math.random().toString(36).substr(2, 9);
      estoque.push({
        id: newId,
        nome,
        quantidade,
        unidade,
        min_quantidade,
      });
    }
    salvarEstado();
    document.getElementById("modal-ingrediente").style.display = "none";
    renderEstoque();
  }
};

// Remover ingrediente
window.removerIngrediente = (index) => {
  if (confirm("Excluir este ingrediente?")) {
    estoque.splice(index, 1);
    salvarEstado();
    renderEstoque();
  }
};

// Adicionar ingrediente button
document.getElementById("add-ingrediente").onclick = () =>
  abrirModalIngrediente();

// Configurações - Editar cardápio
function renderConfig() {
  const listaCat = document.getElementById("lista-edit-categorias");
  listaCat.innerHTML = "";
  window.CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className =
      "accent-orange p-4 rounded flex flex-col items-center text-lg fade-in";
    btn.innerHTML = `<i class="fas ${
      icons[cat] || "fa-question"
    } text-3xl mb-2"></i>${cat}`;
    btn.onclick = () => mostrarEditItens(cat);
    listaCat.appendChild(btn);
  });
}

function mostrarEditItens(cat) {
  const editItens = document.getElementById("edit-itens");
  editItens.innerHTML = `<h3 class="text-lg mb-2">Itens em ${cat}</h3>`;
  editItens.classList.remove("hidden");
  const ul = document.createElement("ul");
  ul.className = "list-disc pl-5";
  window.CARDAPIO.filter((item) => item.category === cat).forEach(
    (item) => {
      const li = document.createElement("li");
      li.className = "flex justify-between mb-2";
      li.innerHTML = `
      ${item.name} - R$ ${item.price.toFixed(2)}
      <div>
        <button class="bg-blue-600 px-2 py-1 rounded ml-2" onclick="editarItem('${
          item.id
        }')">Editar</button>
        <button class="bg-green-600 px-2 py-1 rounded ml-2" onclick="editarFichaTecnica('${
          item.id
        }')">Ficha Técnica</button>
        <button class="bg-red-600 px-2 py-1 rounded ml-2" onclick="removerItemCardapio('${
          item.id
        }')">Remover</button>
      </div>
    `;
      ul.appendChild(li);
    }
  );
  editItens.appendChild(ul);
}

window.editarItem = (id) => {
  itemEditAtual = window.CARDAPIO.find((i) => i.id === id);
  document.getElementById("edit-name").value = itemEditAtual.name;
  document.getElementById("edit-price").value = itemEditAtual.price;
  document.getElementById("edit-description").value =
    itemEditAtual.description || "";
  document.getElementById("edit-image").value = itemEditAtual.image;
  const selectCat = document.getElementById("edit-category");
  selectCat.innerHTML = "";
  window.CATEGORIES.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    if (cat === itemEditAtual.category) option.selected = true;
    selectCat.appendChild(option);
  });
  document.getElementById("modal-edit-item").style.display = "block";
};

document.getElementById("salvar-edit-item").onclick = () => {
  const name = document.getElementById("edit-name").value.trim();
  const price = parseFloat(document.getElementById("edit-price").value);
  const description = document.getElementById("edit-description").value;
  const image = document.getElementById("edit-image").value.trim();
  const category = document.getElementById("edit-category").value;
  let valid = true;
  if (!name) {
    showError('edit-name', 'Nome é obrigatório');
    valid = false;
  } else {
    removeError('edit-name');
  }
  if (isNaN(price) || price <= 0) {
    showError('edit-price', 'Preço deve ser um número positivo');
    valid = false;
  } else {
    removeError('edit-price');
  }
  if (!image) {
    showError('edit-image', 'URL da imagem é obrigatória');
    valid = false;
  } else {
    removeError('edit-image');
  }
  if (valid) {
    itemEditAtual.name = name;
    itemEditAtual.price = price;
    itemEditAtual.description = description;
    itemEditAtual.image = image;
    itemEditAtual.category = category;
    salvarEstado();
    document.getElementById("modal-edit-item").style.display = "none";
    renderConfig();
  }
};

window.removerItemCardapio = (id) => {
  if (confirm("Remover este item?")) {
    window.CARDAPIO = window.CARDAPIO.filter((i) => i.id !== id);
    delete receitas[id];
    salvarEstado();
    renderConfig();
  }
};

// Editar ficha tecnica
window.editarFichaTecnica = (prodId) => {
  prodFichaAtual = prodId;
  tempFicha = receitas[prodId] ? [...receitas[prodId]] : [];
  const modal = document.getElementById("modal-ficha");
  document.getElementById(
    "titulo-ficha"
  ).textContent = `Ficha Técnica - ${
    window.CARDAPIO.find((i) => i.id === prodId).name
  }`;
  const selectIng = document.getElementById("select-ing");
  selectIng.innerHTML = "";
  estoque.forEach((ing) => {
    const option = document.createElement("option");
    option.value = ing.id;
    option.textContent = `${ing.nome} (${ing.unidade})`;
    selectIng.appendChild(option);
  });
  renderListaFicha();
  modal.style.display = "block";
};

function renderListaFicha() {
  const lista = document.getElementById("lista-ficha");
  lista.innerHTML = "";
  tempFicha.forEach((ing, index) => {
    const div = document.createElement("div");
    div.className = "flex justify-between mb-2";
    const ingName =
      estoque.find((e) => e.id === ing.id_ingrediente)?.nome ||
      "Desconhecido";
    div.innerHTML = `
      ${ingName}: ${ing.qtd}
      <button class="bg-red-600 px-2 py-1 rounded" onclick="removerIngFicha(${index})">Remover</button>
    `;
    lista.appendChild(div);
  });
}

document.getElementById("add-ing-ficha").onclick = () => {
  const id_ingrediente = document.getElementById("select-ing").value;
  const qtd = parseFloat(document.getElementById("qtd-ing").value) || 0;
  if (!id_ingrediente) {
    alert('Selecione um ingrediente');
    return;
  }
  if (qtd <= 0) {
    showError('qtd-ing', 'Quantidade deve ser positiva');
    return;
  }
  if (tempFicha.find((i) => i.id_ingrediente === id_ingrediente)) {
    showError('qtd-ing', 'Ingrediente já adicionado');
    return;
  }
  removeError('qtd-ing');
  tempFicha.push({ id_ingrediente, qtd });
  document.getElementById("qtd-ing").value = "";
  renderListaFicha();
};

window.removerIngFicha = (index) => {
  tempFicha.splice(index, 1);
  renderListaFicha();
};

document.getElementById("salvar-ficha").onclick = () => {
  if (tempFicha.length === 0) {
    alert('Adicione pelo menos um ingrediente à ficha técnica');
    return;
  }
  receitas[prodFichaAtual] = tempFicha;
  salvarEstado();
  document.getElementById("modal-ficha").style.display = "none";
};

// Adicionar categoria
document.getElementById("add-categoria").onclick = () => {
  document.getElementById("nova-categoria").value = "";
  document.getElementById("modal-add-categoria").style.display = "block";
};

document.getElementById("salvar-categoria").onclick = () => {
  const novaCat = document.getElementById("nova-categoria").value.trim();
  if (!novaCat) {
    showError('nova-categoria', 'Nome da categoria é obrigatório');
    return;
  }
  removeError('nova-categoria');
  if (window.CATEGORIES.includes(novaCat)) {
    showError('nova-categoria', 'Categoria já existe');
    return;
  }
  window.CATEGORIES.push(novaCat);
  salvarEstado();
  renderConfig();
  document.getElementById("modal-add-categoria").style.display = "none";
};

// Adicionar item
document.getElementById("add-item").onclick = () => {
  document.getElementById("add-name").value = "";
  document.getElementById("add-price").value = "";
  document.getElementById("add-description").value = "";
  document.getElementById("add-image").value = "";
  const selectCat = document.getElementById("add-category");
  selectCat.innerHTML = "";
  window.CATEGORIES.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    selectCat.appendChild(option);
  });
  document.getElementById("modal-add-item").style.display = "block";
};

document.getElementById("salvar-add-item").onclick = () => {
  const name = document.getElementById("add-name").value.trim();
  const price = parseFloat(document.getElementById("add-price").value);
  const description = document.getElementById("add-description").value;
  const image = document.getElementById("add-image").value.trim();
  const category = document.getElementById("add-category").value;
  let valid = true;
  if (!name) {
    showError('add-name', 'Nome é obrigatório');
    valid = false;
  } else {
    removeError('add-name');
  }
  if (isNaN(price) || price <= 0) {
    showError('add-price', 'Preço deve ser um número positivo');
    valid = false;
  } else {
    removeError('add-price');
  }
  if (!image) {
    showError('add-image', 'URL da imagem é obrigatória');
    valid = false;
  } else {
    removeError('add-image');
  }
  if (valid) {
    const novoItem = {
      id: "item_" + Date.now(),
      name,
      price,
      category,
      description,
      image,
    };
    window.CARDAPIO.push(novoItem);
    salvarEstado();
    document.getElementById("modal-add-item").style.display = "none";
    renderConfig();
  }
};

// Alterar senha
document.getElementById("salvar-senha").onclick = () => {
  const novaSenha = document.getElementById("nova-senha").value;
  if (!novaSenha) {
    showError('nova-senha', 'Nova senha é obrigatória');
    return;
  }
  removeError('nova-senha');
  senhaAtual = novaSenha;
  salvarEstado();
  alert("Senha alterada com sucesso!");
};

// Exportar CSV genérico
function exportarCSV(data, filename) {
  const csv = data.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// Exportar PDF genérico
async function exportarPDF(elementId, filename) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const element = document.getElementById(elementId);
  const canvas = await html2canvas(element, {
    backgroundColor: "#121212",
    scale: 2,
  });
  const imgData = canvas.toDataURL("image/png");
  const imgWidth = 190;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  doc.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
  doc.save(filename);
}

// Exportar dia CSV
document.getElementById("export-csv-dia").onclick = () => {
  const dataSelecionada =
    document.getElementById("data-selecionada").value;
  if (!dataSelecionada) {
    alert('Selecione uma data');
    return;
  }
  const vendasDia = historicoVendas.filter(
    (v) => v.data === dataSelecionada
  );
  const rows = [
    [
      "Data",
      "Mesa",
      "Item",
      "Qty",
      "Preço",
      "Total",
      "Pagamento",
      "Desconto",
      "Gorjeta",
    ],
  ];
  vendasDia.forEach((v) => {
    v.itens.forEach((i) => {
      rows.push([
        v.data,
        v.mesa,
        i.name,
        i.qty,
        i.price,
        i.price * i.qty,
        v.pagamento,
        v.desconto,
        v.gorjeta,
      ]);
    });
  });
  exportarCSV(rows, `caixa_${dataSelecionada}.csv`);
};

// Exportar dia PDF
document.getElementById("export-pdf-dia").onclick = async () => {
  const dataSelecionada =
    document.getElementById("data-selecionada").value;
  if (!dataSelecionada) {
    alert('Selecione uma data');
    return;
  }
  await exportarPDF("secao-caixa", `caixa_${dataSelecionada}.pdf`);
};

// Exportar todos semanais CSV
document.getElementById("export-all-semanais").onclick = () => {
  const semanas = getRelatoriosSemanais();
  const rows = [["Semana", "Total", "Descontos", "Gorjetas"]];
  Object.keys(semanas).forEach((semana) => {
    rows.push([
      semana,
      semanas[semana].total,
      semanas[semana].descontos,
      semanas[semana].gorjetas,
    ]);
  });
  exportarCSV(rows, "relatorios_semanais.csv");
};

// Exportar todos mensais CSV
document.getElementById("export-all-mensais").onclick = () => {
  const meses = getRelatoriosMensais();
  const rows = [["Mês", "Total", "Descontos", "Gorjetas"]];
  Object.keys(meses).forEach((mes) => {
    rows.push([
      mes,
      meses[mes].total,
      meses[mes].descontos,
      meses[mes].gorjetas,
    ]);
  });
  exportarCSV(rows, "relatorios_mensais.csv");
};

// Tabs
function ativarTab(tabId, secaoId) {
  const tabs = [
    "tab-mesas",
    "tab-caixa",
    "tab-relatorios-semanais",
    "tab-relatorios",
    "tab-config",
    "tab-historico",
    "tab-estoque",
  ];
  const secoes = [
    "secao-mesas",
    "secao-caixa",
    "secao-relatorios-semanais",
    "secao-relatorios",
    "secao-config",
    "secao-historico",
    "secao-estoque",
  ];
  tabs.forEach((t) => {
    document.getElementById(t).classList.remove("accent-orange");
    document.getElementById(t).classList.add("bg-gray-700");
  });
  secoes.forEach((s) =>
    document.getElementById(s).classList.add("hidden")
  );
  document.getElementById(tabId).classList.add("accent-orange");
  document.getElementById(tabId).classList.remove("bg-gray-700");
  document.getElementById(secaoId).classList.remove("hidden");
}

document.getElementById("tab-mesas").onclick = () =>
  ativarTab("tab-mesas", "secao-mesas");
document.getElementById("tab-caixa").onclick = () => {
  ativarTab("tab-caixa", "secao-caixa");
  renderCaixa();
};
document.getElementById("tab-relatorios-semanais").onclick = () => {
  ativarTab("tab-relatorios-semanais", "secao-relatorios-semanais");
  renderRelatoriosSemanais();
};
document.getElementById("tab-relatorios").onclick = () => {
  ativarTab("tab-relatorios", "secao-relatorios");
  renderRelatorios();
};
document.getElementById("tab-config").onclick = () => {
  ativarTab("tab-config", "secao-config");
  renderConfig();
};
document.getElementById("tab-historico").onclick = () => {
  ativarTab("tab-historico", "secao-historico");
  renderHistorico();
};
document.getElementById("tab-estoque").onclick = () => {
  ativarTab("tab-estoque", "secao-estoque");
  renderEstoque();
};

// Evento para mudança de data na caixa
document
  .getElementById("data-selecionada")
  .addEventListener("change", (e) => {
    const data = e.target.value;
    if (data) {
      renderCaixa(data);
    }
  });

// Fechar modals
document.getElementById("close-modal").onclick = () =>
  (document.getElementById("modal-mesa").style.display = "none");
document.getElementById("close-adicionar").onclick = () =>
  (document.getElementById("modal-adicionar").style.display = "none");
document.getElementById("close-finalizar").onclick = () =>
  (document.getElementById("modal-finalizar").style.display = "none");
document.getElementById("close-edit-item").onclick = () =>
  (document.getElementById("modal-edit-item").style.display = "none");
document.getElementById("close-add-categoria").onclick = () =>
  (document.getElementById("modal-add-categoria").style.display = "none");
document.getElementById("close-add-item").onclick = () =>
  (document.getElementById("modal-add-item").style.display = "none");
document.getElementById("close-ingrediente").onclick = () =>
  (document.getElementById("modal-ingrediente").style.display = "none");
document.getElementById("close-ficha").onclick = () =>
  (document.getElementById("modal-ficha").style.display = "none");

// Inicializar
const hoje = new Date().toISOString().split("T")[0];
document.getElementById("data-selecionada").value = hoje;
