// public/js/medicos-cadastro.js

// --- Definição de Variáveis Globais ---
const medicoForm = document.getElementById('medico-form');
const unidadesContainer = document.getElementById('unidades-checkbox-container'); 
const messageArea = document.getElementById('message-area');
const submitButton = document.getElementById('submit-button');
const cpfInput = document.getElementById('cpf');
const btnBuscaCpf = document.getElementById('btn-busca-cpf'); 
const telInput = document.getElementById('telefone'); 

// Elementos da seção de Agendamento
const trainingTitle = document.getElementById('training-title');
const trainingFields = document.getElementById('training-fields');

// Variável para armazenar o ID do médico em edição
let editingMedicoId = null; 
let initialHospitaisIds = []; // Armazena os hospitais que o médico já tinha para detectar novos

// --- SEÇÃO DE PADRONIZAÇÃO E MÁSCARAS ---

// 1. Forçar Maiúsculas em todos os inputs de texto e textareas
document.addEventListener('input', (e) => {
    if ((e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'email')) || e.target.tagName === 'TEXTAREA') {
        if (e.target.id !== 'cpf' && e.target.id !== 'telefone') {
            e.target.value = e.target.value.toUpperCase();
        }
    }
});

// 2. Máscara de CPF (000.000.000-00)
cpfInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, ''); 
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    e.target.value = value;
});

// 3. Máscara de Telefone ((00) 00000-0000)
telInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
    value = value.replace(/(\d{5})(\d)/, '$1-$2');
    e.target.value = value;
});

// --- Funções de Utilitário ---

function getToken() {
    const token = localStorage.getItem('userToken');
    const userName = localStorage.getItem('userName');

    if (!token || !userName) {
        console.error("ERRO: Token ou Nome de usuário não encontrados no localStorage.");
        alert('Sessão inválida ou expirada. Faça o login novamente.');
        window.location.href = '/login.html';
        return null;
    }
    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg) welcomeMsg.textContent = `Olá, ${userName}`;
    return token;
}

function showMessage(message, type = 'success') {
    if (!messageArea) return;
    messageArea.textContent = message;
    messageArea.className = `message-area message-${type}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setTimeout(() => {
        messageArea.textContent = '';
        messageArea.className = 'message-area';
    }, 5000);
}

function getMedicoIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// --- 1. Carregar Unidades (Checkboxes) ---

async function loadUnits(token, selectedIds = []) {
    const container = document.querySelector('.units-list-container');
    if (!container) return;
    
    try {
        const response = await fetch('/api/unidades', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) return getToken(); 

        const data = await response.json();
        const unidades = Array.isArray(data) ? data : (data.unidades || []);

        container.innerHTML = ''; 

        if (unidades.length > 0) {
            unidades.forEach(unit => {
                const isChecked = selectedIds.some(id => String(id) === String(unit.id));
                
                const nomeExibicao = unit.nome.toUpperCase()
                    .replace(/^HOSPITAL\s+/i, 'H. ')
                    .replace(/^H\s+/i, 'H. ');

                const label = document.createElement('label');
                label.className = 'checkbox-container';
                label.innerHTML = `
                    <input type="checkbox" name="hospitais" class="unidade-checkbox" value="${unit.id}" ${isChecked ? 'checked' : ''}>
                    ${nomeExibicao}
                    <span class="checkmark"></span>
                `;
                container.appendChild(label);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar unidades:', error);
    }
}

// --- 2. PESQUISA ATIVA ---

if (btnBuscaCpf) {
    btnBuscaCpf.addEventListener('click', async () => {
        const cpfLimpo = cpfInput.value.replace(/\D/g, ''); 
        
        if (cpfLimpo.length !== 11) {
            alert("Por favor, digite um CPF válido com 11 dígitos.");
            return;
        }

        const token = getToken();
        if (!token) return;

        btnBuscaCpf.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const response = await fetch(`/api/medicos/busca-cpf/${cpfLimpo}`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const medico = await response.json();
                if (confirm(`O médico "${medico.nome}" já possui cadastro. Deseja carregar os dados dele para edição?`)) {
                    editingMedicoId = medico.id; 
                    populateForm(medico);
                }
            } else if (response.status === 404) {
                alert(`Médico não encontrado com o CPF ${cpfLimpo}.`);
            } else {
                const erro = await response.json();
                alert("Erro na busca: " + (erro.erro || "Falha desconhecida"));
            }
        } catch (err) {
            console.error("Erro na busca:", err);
            alert("Erro de conexão com o servidor.");
        } finally {
            btnBuscaCpf.innerHTML = '<i class="fas fa-search"></i>';
        }
    });
}

// --- 3. Lógica de Edição e Preenchimento ---

async function loadMedicoForEditing(medicoId, token) {
    try {
        const response = await fetch(`/api/medicos/${medicoId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) return null;
        return await response.json(); 
    } catch (error) {
        console.error('Erro ao buscar dados do médico:', error);
        return null;
    }
}

async function populateForm(medico) {
    console.log("======= [DEBUG] DIAGNÓSTICO DE DADOS =======");
    console.log("1. Objeto Completo:", medico);
    console.log("2. Chaves disponíveis:", Object.keys(medico));
    console.log("3. Teste de Datas:");
    console.log("   - data_pals:", medico.data_pals);
    console.log("   - dt_pals:", medico.dt_pals);
    console.log("   - data_acls:", medico.data_acls);
    console.log("   - dt_acls:", medico.dt_acls);
    console.log("============================================");

    const setFieldValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = (value || '').toUpperCase();
        } else {
            console.warn(`[DEBUG] Elemento '${id}' não encontrado.`);
        }
    };

    // Dados Pessoais
    setFieldValue('nome', medico.nome);
    
    if (document.getElementById('data_nasc')) {
        const dNasc = medico.data_nasc || medico.data_nascimento || medico.dt_nasc || '';
        document.getElementById('data_nasc').value = dNasc ? dNasc.split('T')[0] : '';
    }
    
    const cpfRaw = medico.cpf || '';
    if (document.getElementById('cpf')) {
        document.getElementById('cpf').value = cpfRaw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    
    setFieldValue('email', medico.email);
    
    const telRaw = medico.telefone || '';
    if (document.getElementById('telefone')) {
        document.getElementById('telefone').value = telRaw.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    // Profissional
    setFieldValue('crm', medico.crm);
    setFieldValue('especialidade', medico.especialidade);
    setFieldValue('rqe', medico.rqe);
    setFieldValue('empresa', medico.empresa);
    setFieldValue('observacao', medico.observacao);

    // Sincronização dos Hospitais
    const token = localStorage.getItem('userToken');
    initialHospitaisIds = medico.hospitais_ids ? medico.hospitais_ids.map(id => String(id)) : [];
    await loadUnits(token, initialHospitaisIds);

    // Checkboxes (Lógica Reforçada)
    const areas = ['porta', 'emergencia', 'enfermaria', 'ambulatorio', 'uti', 'pals', 'acls', 'integracao', 'ativacao_senha'];
    areas.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.checked = (medico[id] === true || medico[id] === 1 || medico[id] === "1" || medico[id] === "true");
            console.log(`[DEBUG] Checkbox ${id} -> ${el.checked}`);
        }
    });

    // DATAS ACLS / PALS (Lógica Blindada contra nomes de chaves diferentes)
    const elPals = document.getElementById('data_pals');
    if (elPals) {
        const valPals = medico.data_pals || medico.dt_pals || '';
        elPals.value = (valPals && valPals !== "") ? valPals.split('T')[0] : '';
        console.log(`[DEBUG] Final data_pals: "${elPals.value}"`);
    }

    const elAcls = document.getElementById('data_acls');
    if (elAcls) {
        const valAcls = medico.data_acls || medico.dt_acls || '';
        elAcls.value = (valAcls && valAcls !== "") ? valAcls.split('T')[0] : '';
        console.log(`[DEBUG] Final data_acls: "${elAcls.value}"`);
    }

    // Interface
    const titleElement = document.getElementById('page-title'); 
    if (titleElement) titleElement.innerHTML = '<i class="fas fa-edit"></i> Editando Médico';
    
    if (trainingTitle) trainingTitle.style.display = 'block'; 
    if (trainingFields) trainingFields.style.display = 'flex';
    
    submitButton.innerHTML = '<i class="fas fa-save"></i> Atualizar Dados';
    submitButton.className = 'btn-success';
    
    console.log("--- POPULATE FORM FINALIZADO ---");
}

// --- 4. Submissão do Formulário ---

medicoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    const checkboxesMarcados = document.querySelectorAll('input[name="hospitais"]:checked');
    const selectedHospitais = Array.from(checkboxesMarcados).map(cb => cb.value);

    if (selectedHospitais.length === 0) {
        alert("Por favor, selecione ao menos um hospital/unidade.");
        return;
    }

    const isEditing = editingMedicoId !== null;
    const method = isEditing ? 'PUT' : 'POST';
    const endpoint = isEditing ? `/api/medicos/${editingMedicoId}` : '/api/medicos';

    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

    const formData = new FormData(medicoForm);
    const rawData = Object.fromEntries(formData.entries());
    
    const medicoData = {
        ...rawData,
        cpf: rawData.cpf.replace(/\D/g, ''),
        telefone: rawData.telefone.replace(/\D/g, ''),
        hospitais_ids: selectedHospitais,
        unidade_id: selectedHospitais[0], 
        porta: !!document.getElementById('porta')?.checked,
        emergencia: !!document.getElementById('emergencia')?.checked,
        enfermaria: !!document.getElementById('enfermaria')?.checked,
        ambulatorio: !!document.getElementById('ambulatorio')?.checked,
        uti: !!document.getElementById('uti')?.checked,
        pals: !!document.getElementById('pals')?.checked,
        acls: !!document.getElementById('acls')?.checked,
        integracao: !!document.getElementById('integracao')?.checked,
        ativacao_senha: !!document.getElementById('ativacao_senha')?.checked,
        data_pals: document.getElementById('data_pals')?.value || null,
        data_acls: document.getElementById('data_acls')?.value || null
    };
    
    try {
        const response = await fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(medicoData)
        });

        const result = await response.json();

        if (response.ok) {
            if (!medicoData.integracao) {
                const novosHospitais = selectedHospitais.filter(id => !initialHospitaisIds.includes(String(id)));
                if (novosHospitais.length > 0) {
                    if (confirm(`Deseja gerar agendamentos automáticos?`)) {
                        await fetch('/api/agendamentos/gerar-pendentes', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ 
                                medico_id: editingMedicoId || result.id, 
                                unidades: novosHospitais 
                            })
                        });
                    }
                }
            }
            alert('✅ Médico salvo com sucesso!');
            window.location.href = '/medicos-lista.html';
        } else {
            alert('❌ Erro: ' + (result.erro || 'Falha ao salvar.'));
        }
    } catch (error) {
        console.error(error);
        alert('❌ Erro de conexão.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = isEditing ? '<i class="fas fa-save"></i> Atualizar Dados' : '<i class="fas fa-save"></i> Concluir Cadastro';
    }
});

// --- 5. Inicialização ---

document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (!token) return;

    ['porta', 'emergencia', 'enfermaria', 'ambulatorio', 'uti', 'pals', 'acls', 'integracao', 'ativacao_senha'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('name', id);
    });

    editingMedicoId = getMedicoIdFromUrl();

    if (editingMedicoId) {
        const response = await fetch(`/api/medicos/${editingMedicoId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const medico = await response.json();
            await populateForm(medico);
        } else {
            alert("Erro ao carregar dados.");
            await loadUnits(token);
        }
    } else {
        await loadUnits(token); 
    }
});

// Logout
const logoutBtn = document.getElementById('logout-button');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });
}