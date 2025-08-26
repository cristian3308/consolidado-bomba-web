// Initialize Firebase with compat version
let db;
let isFirebaseAvailable = false;

// Estado global de la aplicación
let currentUser = null;
let usuarios = [];
let cobros = [];

// Función helper para formatear fechas correctamente (evita problemas de zona horaria)
function formatDate(dateString) {
    if (!dateString) return '';
    
    // Si ya es una fecha formateada, devolverla tal como está
    if (dateString.includes('/')) return dateString;
    
    // Para fechas en formato YYYY-MM-DD, crear la fecha en hora local
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day); // month - 1 porque los meses van de 0-11
    
    return date.toLocaleDateString('es-CO');
}

// Función helper para convertir fecha local a formato YYYY-MM-DD
function dateToInputFormat(date) {
    if (!date) return '';
    
    let dateObj;
    if (typeof date === 'string') {
        if (date.includes('/')) {
            // Si está en formato DD/MM/YYYY, convertir
            const parts = date.split('/');
            dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
            // Si está en formato YYYY-MM-DD, mantener
            return date;
        }
    } else {
        dateObj = date;
    }
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// Credenciales de administrador (en producción esto debería estar en el backend)
const adminCredentials = {
    username: "admin",
    password: "admin123"
};

// Initialize Firebase when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Initialize Firebase
        firebase.initializeApp(window.firebaseConfig);
        db = firebase.firestore();
        isFirebaseAvailable = true;
        
        console.log('Firebase inicializado correctamente');
        
        checkAuthStatus();
        initializeEventListeners();
        loadInitialData();
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        isFirebaseAvailable = false;
        
        // Inicializar en modo offline
        checkAuthStatus();
        initializeEventListeners();
        initializeOfflineMode();
    }
});

// Verificar estado de autenticación
function checkAuthStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        currentUser = localStorage.getItem('currentUser');
        showMainApp();
    } else {
        showLoginModal();
    }
}

// Mostrar modal de login
function showLoginModal() {
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModal.show();
}

// Mostrar aplicación principal
function showMainApp() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('mainNavbar').style.display = 'block';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('userWelcome').textContent = `Bienvenido, ${currentUser}`;
    
    // Mostrar estado de conexión
    const connectionStatus = document.getElementById('connectionStatus');
    if (isFirebaseAvailable) {
        connectionStatus.innerHTML = '<i class="fas fa-cloud text-success me-1"></i>Online';
        connectionStatus.className = 'navbar-text me-3 text-success';
    } else {
        connectionStatus.innerHTML = '<i class="fas fa-cloud-slash text-warning me-1"></i>Offline';
        connectionStatus.className = 'navbar-text me-3 text-warning';
    }
    
    // Cargar datos iniciales
    loadInitialData();
    showSection('dashboard');
}

// Inicializar event listeners
function initializeEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Cobro form
    document.getElementById('cobroForm').addEventListener('submit', handleCobroSubmit);
    
    // Listener para cambio de usuario en cobros
    document.getElementById('cobroUsuario').addEventListener('change', handleUsuarioChange);
}

// Manejar login
function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    // Validar credenciales
    if (username === adminCredentials.username && password === adminCredentials.password) {
        currentUser = username;
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('currentUser', username);
        
        // Ocultar modal y mostrar app
        const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (modal) {
            modal.hide();
        }
        showMainApp();
        
        errorDiv.classList.add('d-none');
    } else {
        errorDiv.textContent = 'Usuario o contraseña incorrectos';
        errorDiv.classList.remove('d-none');
    }
}

// Cerrar sesión
function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    currentUser = null;
    
    document.getElementById('mainNavbar').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    showLoginModal();
}

// Mostrar sección
function showSection(sectionName, targetElement = null) {
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => section.style.display = 'none');
    
    // Mostrar la sección seleccionada
    const targetSection = document.getElementById(sectionName + 'Section');
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Actualizar navegación
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
    
    // Si se pasa un elemento target, activarlo; si no, buscar por contenido
    if (targetElement) {
        targetElement.classList.add('active');
    } else {
        // Buscar el enlace correspondiente
        const targetLink = Array.from(document.querySelectorAll('.nav-link')).find(link => 
            link.getAttribute('onclick') && link.getAttribute('onclick').includes(`'${sectionName}'`)
        );
        if (targetLink) {
            targetLink.classList.add('active');
        }
    }
    
    // Cargar datos específicos de la sección
    switch(sectionName) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'cobros':
            loadCobrosRecientes();
            break;
        case 'usuarios':
            loadUsuariosList();
            break;
        case 'reportes':
            loadReportes();
            break;
    }
}

// Cargar datos iniciales
async function loadInitialData() {
    if (isFirebaseAvailable) {
        await loadUsuarios();
        await loadCobros();
    } else {
        loadUsuariosFromLocal();
        loadCobrosFromLocal();
    }
}

// Inicializar modo offline
function initializeOfflineMode() {
    loadUsuariosFromLocal();
    loadCobrosFromLocal();
    console.log('Trabajando en modo offline');
}

// Funciones para modo offline - LocalStorage
function loadUsuariosFromLocal() {
    const stored = localStorage.getItem('usuarios');
    if (stored) {
        try {
            usuarios = JSON.parse(stored);
        } catch (error) {
            console.error('Error parsing usuarios from localStorage:', error);
            usuarios = [];
        }
    } else {
        usuarios = [];
    }
    
    // Si no hay usuarios, crear algunos de ejemplo
    if (usuarios.length === 0) {
        usuarios = [
            {
                id: 'user1',
                nombre: 'Juan Pérez',
                tipo: 'planilla',
                telefono: '123-456-7890',
                email: 'juan@example.com'
            },
            {
                id: 'user2',
                nombre: 'María González',
                tipo: 'comprobante',
                telefono: '098-765-4321',
                email: 'maria@example.com'
            },
            {
                id: 'user3',
                nombre: 'Carlos López',
                tipo: 'planilla',
                telefono: '555-123-4567',
                email: 'carlos@example.com'
            }
        ];
        
        // Guardar usuarios de ejemplo en localStorage
        localStorage.setItem('usuarios', JSON.stringify(usuarios));
        console.log('Usuarios de ejemplo creados');
    }
    
    updateUsuarioSelects();
}

function loadCobrosFromLocal() {
    const stored = localStorage.getItem('cobros');
    if (stored) {
        try {
            cobros = JSON.parse(stored);
        } catch (error) {
            console.error('Error parsing cobros from localStorage:', error);
            cobros = [];
        }
    } else {
        cobros = [];
    }
}

function saveUsuariosToLocal() {
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
}

function saveCobrosToLocal() {
    localStorage.setItem('cobros', JSON.stringify(cobros));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Actualizar selects de usuario
function updateUsuarioSelects() {
    const selects = ['cobroUsuario', 'reporteUsuario'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        
        // Limpiar options excepto el primero
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        // Agregar usuarios
        usuarios.forEach(usuario => {
            const option = document.createElement('option');
            option.value = usuario.id;
            option.textContent = usuario.nombre;
            select.appendChild(option);
        });
        
        // Restaurar valor seleccionado
        select.value = currentValue;
    });
}

// Cargar usuarios desde Firebase
async function loadUsuarios() {
    if (!isFirebaseAvailable) {
        loadUsuariosFromLocal();
        return;
    }
    
    try {
        const querySnapshot = await db.collection("usuarios").get();
        usuarios = [];
        querySnapshot.forEach((doc) => {
            usuarios.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Guardar en localStorage como backup
        localStorage.setItem('usuarios', JSON.stringify(usuarios));
        
        // Actualizar selects
        updateUsuarioSelects();
        console.log('Usuarios cargados:', usuarios.length);
    } catch (error) {
        console.error("Error cargando usuarios:", error);
        loadUsuariosFromLocal();
    }
}

// Cargar cobros desde Firebase
async function loadCobros() {
    if (!isFirebaseAvailable) {
        loadCobrosFromLocal();
        return;
    }
    
    try {
        const querySnapshot = await db.collection("cobros").orderBy("fecha", "desc").get();
        cobros = [];
        querySnapshot.forEach((doc) => {
            cobros.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Guardar en localStorage como backup
        localStorage.setItem('cobros', JSON.stringify(cobros));
        console.log('Cobros cargados:', cobros.length);
    } catch (error) {
        console.error("Error cargando cobros:", error);
        loadCobrosFromLocal();
    }
}

// Manejar cambio de usuario en cobros
function handleUsuarioChange() {
    const usuarioId = document.getElementById('cobroUsuario').value;
    const planillaFields = document.getElementById('planillaFields');
    const comprobanteFields = document.getElementById('comprobanteFields');
    
    // Ocultar todos los campos primero
    planillaFields.style.display = 'none';
    comprobanteFields.style.display = 'none';
    
    // Limpiar todos los campos
    clearFormFields();
    
    if (usuarioId) {
        const usuario = usuarios.find(u => u.id === usuarioId);
        if (usuario) {
            if (usuario.tipo === 'comprobante') {
                // Usuario de planilla y comprobante
                comprobanteFields.style.display = 'block';
                setRequiredFields(['numeroPlanillaComp', 'fechaPlanillaComp', 'numeroComprobante', 'fechaComprobante']);
                
                // Añadir animación
                comprobanteFields.classList.add('slide-in-up');
            } else {
                // Usuario de solo planilla
                planillaFields.style.display = 'block';
                setRequiredFields(['numeroPlanilla', 'fechaPlanilla']);
                
                // Añadir animación
                planillaFields.classList.add('slide-in-up');
            }
        }
    } else {
        // Limpiar campos requeridos
        setRequiredFields([]);
    }
}

// Función para limpiar campos del formulario
function clearFormFields() {
    const fieldIds = [
        'numeroPlanilla', 'fechaPlanilla', 
        'numeroPlanillaComp', 'fechaPlanillaComp', 
        'numeroComprobante', 'fechaComprobante'
    ];
    
    fieldIds.forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.value = '';
            field.required = false;
        }
    });
}

// Función para establecer campos requeridos
function setRequiredFields(fieldIds) {
    // Primero quitar required de todos los campos
    clearFormFields();
    
    // Luego añadir required a los campos especificados
    fieldIds.forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.required = true;
        }
    });
}

// Manejar envío de cobro
async function handleCobroSubmit(e) {
    e.preventDefault();
    console.log('handleCobroSubmit: Iniciando proceso de guardado');
    
    const usuarioId = document.getElementById('cobroUsuario').value;
    const monto = parseFloat(document.getElementById('cobroMonto').value);
    const descripcion = document.getElementById('cobroDescripcion').value;
    
    console.log('handleCobroSubmit: Datos básicos', { usuarioId, monto, descripcion });
    
    if (!usuarioId || !monto) {
        showAlert('Por favor complete todos los campos requeridos', 'warning');
        return;
    }
    
    const usuario = usuarios.find(u => u.id === usuarioId);
    if (!usuario) {
        showAlert('Usuario no encontrado', 'danger');
        return;
    }
    
    console.log('handleCobroSubmit: Usuario encontrado', usuario);
    
    // Recopilar datos según el tipo de usuario
    const cobroData = {
        usuarioId: usuarioId,
        usuarioNombre: usuario.nombre,
        monto: monto,
        descripcion: descripcion || '',
        fecha: new Date().toISOString(),
        tipo: usuario.tipo
    };
    
    // Añadir campos específicos según el tipo
    if (usuario.tipo === 'comprobante') {
        // Usuario de planilla y comprobante
        cobroData.numeroPlanilla = document.getElementById('numeroPlanillaComp').value;
        cobroData.fechaPlanilla = document.getElementById('fechaPlanillaComp').value;
        cobroData.numeroComprobante = document.getElementById('numeroComprobante').value;
        cobroData.fechaComprobante = document.getElementById('fechaComprobante').value;
        
        console.log('handleCobroSubmit: Datos de comprobante', {
            numeroPlanilla: cobroData.numeroPlanilla,
            fechaPlanilla: cobroData.fechaPlanilla,
            numeroComprobante: cobroData.numeroComprobante,
            fechaComprobante: cobroData.fechaComprobante
        });
        
        if (!cobroData.numeroPlanilla || !cobroData.fechaPlanilla || 
            !cobroData.numeroComprobante || !cobroData.fechaComprobante) {
            showAlert('Por favor complete todos los campos de planilla y comprobante', 'warning');
            return;
        }
    } else {
        // Usuario de solo planilla
        cobroData.numeroPlanilla = document.getElementById('numeroPlanilla').value;
        cobroData.fechaPlanilla = document.getElementById('fechaPlanilla').value;
        
        console.log('handleCobroSubmit: Datos de planilla', {
            numeroPlanilla: cobroData.numeroPlanilla,
            fechaPlanilla: cobroData.fechaPlanilla
        });
        
        if (!cobroData.numeroPlanilla || !cobroData.fechaPlanilla) {
            showAlert('Por favor complete todos los campos de planilla', 'warning');
            return;
        }
    }
    
    console.log('handleCobroSubmit: Datos completos del cobro', cobroData);
    
    try {
        // Mostrar loading
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="loading-spinner me-2"></span>Guardando...';
        submitBtn.disabled = true;
        
        console.log('handleCobroSubmit: Firebase disponible?', isFirebaseAvailable);
        
        if (isFirebaseAvailable) {
            // Guardar en Firebase
            cobroData.timestamp = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection("cobros").add(cobroData);
            cobroData.id = docRef.id;
            console.log('handleCobroSubmit: Guardado en Firebase con ID', docRef.id);
            showAlert('Cobro registrado exitosamente', 'success');
        } else {
            // Guardar en localStorage
            cobroData.id = generateId();
            console.log('handleCobroSubmit: Array cobros antes de agregar', cobros.length);
            cobros.unshift(cobroData);
            console.log('handleCobroSubmit: Array cobros después de agregar', cobros.length);
            saveCobrosToLocal();
            console.log('handleCobroSubmit: Guardado en localStorage');
            showAlert('Cobro registrado exitosamente (modo offline)', 'success');
        }
        
        // Limpiar formulario
        document.getElementById('cobroForm').reset();
        handleUsuarioChange(); // Resetear campos dinámicos
        
        // Recargar datos
        if (isFirebaseAvailable) {
            await loadCobros();
        }
        updateDashboard();
        loadCobrosRecientes();
        console.log('handleCobroSubmit: Datos actualizados');
        
        // Restaurar botón
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error("Error registrando cobro:", error);
        showAlert('Error registrando cobro', 'danger');
        
        // Restaurar botón
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>Registrar Cobro';
        submitBtn.disabled = false;
    }
}

// Guardar usuario
async function guardarUsuario() {
    const nombre = document.getElementById('userName').value;
    const tipo = document.querySelector('input[name="userType"]:checked')?.value;
    
    if (!nombre || !tipo) {
        showAlert('Por favor complete todos los campos', 'warning');
        return;
    }
    
    const userData = {
        nombre: nombre,
        tipo: tipo,
        fechaCreacion: new Date().toISOString()
    };
    
    try {
        if (isFirebaseAvailable) {
            // Guardar en Firebase
            userData.fechaCreacion = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection("usuarios").add(userData);
            userData.id = docRef.id;
            showAlert('Usuario creado exitosamente', 'success');
        } else {
            // Guardar en localStorage
            userData.id = generateId();
            usuarios.push(userData);
            saveUsuariosToLocal();
            showAlert('Usuario creado exitosamente (modo offline)', 'success');
        }
        
        // Cerrar modal y limpiar formulario
        const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
        if (modal) {
            modal.hide();
        }
        document.getElementById('userForm').reset();
        
        // Recargar datos
        if (isFirebaseAvailable) {
            await loadUsuarios();
        } else {
            updateUsuarioSelects();
        }
        loadUsuariosList();
        
    } catch (error) {
        console.error("Error creando usuario:", error);
        showAlert('Error creando usuario', 'danger');
    }
}

// Cargar lista de usuarios
function loadUsuariosList() {
    const container = document.getElementById('usuariosList');
    if (!container) return;
    
    if (usuarios.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay usuarios registrados</p>';
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-dark table-hover">
                <thead>
                    <tr>
                        <th><i class="fas fa-user me-1"></i>Nombre</th>
                        <th><i class="fas fa-tag me-1"></i>Tipo</th>
                        <th><i class="fas fa-dollar-sign me-1"></i>Total Cobros</th>
                        <th><i class="fas fa-cog me-1"></i>Acciones</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    usuarios.forEach(usuario => {
        const totalCobros = cobros
            .filter(c => c.usuarioId === usuario.id)
            .reduce((sum, c) => sum + (c.monto || 0), 0);
        
        const tipoText = usuario.tipo === 'comprobante' ? 
            'Planilla y Comprobante' : 'Solo Planilla';
        
        html += `
            <tr class="interactive-element">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle me-2">${usuario.nombre.charAt(0).toUpperCase()}</div>
                        <strong style="color: var(--text-primary);">${usuario.nombre}</strong>
                    </div>
                </td>
                <td>
                    <span class="badge ${usuario.tipo === 'comprobante' ? 'bg-primary' : 'bg-info'}">
                        ${tipoText}
                    </span>
                </td>
                <td><span class="badge bg-success fs-6">$${totalCobros.toLocaleString('es-CO')}</span></td>
                <td>
                    <button class="btn btn-sm btn-danger interactive-element" onclick="eliminarUsuario('${usuario.id}')" title="Eliminar usuario">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
        </div>
    `;
    container.innerHTML = html;
}

// Eliminar usuario
async function eliminarUsuario(usuarioId) {
    if (!confirm('¿Está seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        if (isFirebaseAvailable) {
            // Eliminar de Firebase
            await db.collection("usuarios").doc(usuarioId).delete();
            showAlert('Usuario eliminado exitosamente', 'success');
        } else {
            // Eliminar de localStorage
            usuarios = usuarios.filter(u => u.id !== usuarioId);
            saveUsuariosToLocal();
            showAlert('Usuario eliminado exitosamente (modo offline)', 'success');
        }
        
        // Recargar datos
        if (isFirebaseAvailable) {
            await loadUsuarios();
        } else {
            updateUsuarioSelects();
        }
        loadUsuariosList();
        
    } catch (error) {
        console.error("Error eliminando usuario:", error);
        showAlert('Error eliminando usuario', 'danger');
    }
}

// Actualizar dashboard
function updateDashboard() {
    const yearSelect = document.getElementById('dashboardYear');
    const monthSelect = document.getElementById('dashboardMonth');
    
    if (!yearSelect || !monthSelect) return;
    
    const year = yearSelect.value;
    const month = monthSelect.value;
    
    // Filtrar cobros por fecha
    let cobrosFiltrados = cobros.filter(cobro => {
        const cobroDate = new Date(cobro.fecha || cobro.timestamp || Date.now());
        const cobroYear = cobroDate.getFullYear().toString();
        
        if (year && cobroYear !== year) return false;
        if (month && (cobroDate.getMonth() + 1).toString() !== month) return false;
        
        return true;
    });
    
    // Calcular totales
    const totalCobros = cobrosFiltrados.reduce((sum, cobro) => sum + (cobro.monto || 0), 0);
    const totalTransacciones = cobrosFiltrados.length;
    const usuariosActivos = new Set(cobrosFiltrados.map(c => c.usuarioId)).size;
    const promedioCobro = totalTransacciones > 0 ? totalCobros / totalTransacciones : 0;
    
    // Actualizar estadísticas con animación
    updateStatCard('totalCobros', `$${totalCobros.toLocaleString('es-CO')}`);
    updateStatCard('totalTransacciones', totalTransacciones);
    updateStatCard('totalUsuarios', usuariosActivos);
    updateStatCard('promedioCobro', `$${Math.round(promedioCobro).toLocaleString('es-CO')}`);
    
    // Actualizar tendencias (calculando comparación con período anterior)
    updateTrends(year, month, cobrosFiltrados);
    
    // Crear resumen por usuario
    const resumenUsuarios = {};
    cobrosFiltrados.forEach(cobro => {
        if (!resumenUsuarios[cobro.usuarioId]) {
            const usuario = usuarios.find(u => u.id === cobro.usuarioId);
            resumenUsuarios[cobro.usuarioId] = {
                nombre: usuario ? usuario.nombre : 'Usuario eliminado',
                tipo: usuario ? usuario.tipo : 'desconocido',
                total: 0,
                transacciones: 0,
                planillas: new Set(),
                comprobantes: new Set()
            };
        }
        const resumen = resumenUsuarios[cobro.usuarioId];
        resumen.total += (cobro.monto || 0);
        resumen.transacciones++;
        
        if (cobro.numeroPlanilla) resumen.planillas.add(cobro.numeroPlanilla);
        if (cobro.numeroComprobante) resumen.comprobantes.add(cobro.numeroComprobante);
    });
    
    // Mostrar resumen por usuario
    showUserSummary(resumenUsuarios);
    
    // Mostrar actividad reciente
    showRecentActivity(cobrosFiltrados.slice(0, 5));
}

// Función auxiliar para actualizar cards con animación
function updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.transform = 'scale(1.1)';
        element.textContent = value;
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 200);
    }
}

// Función para actualizar tendencias
function updateTrends(year, month, currentData) {
    // Calcular período anterior para comparación
    const totalCurrent = currentData.reduce((sum, cobro) => sum + (cobro.monto || 0), 0);
    const transaccionesCurrent = currentData.length;
    
    // Por simplicidad, mostraremos valores estáticos
    // En una implementación real, calcularíamos el período anterior
    
    const cobrosTrendEl = document.getElementById('cobrosTrend');
    const transaccionesTrendEl = document.getElementById('transaccionesTrend');
    const usuariosTrendEl = document.getElementById('usuariosTrend');
    const promedioTrendEl = document.getElementById('promedioTrend');
    
    if (cobrosTrendEl) {
        const trend = totalCurrent > 0 ? 'positive' : 'neutral';
        cobrosTrendEl.className = `stat-change ${trend}`;
        cobrosTrendEl.innerHTML = totalCurrent > 0 ? 
            '<i class="fas fa-arrow-up me-1"></i>Crecimiento activo' : 
            '<i class="fas fa-minus me-1"></i>Sin cambios';
    }
    
    if (transaccionesTrendEl) {
        transaccionesTrendEl.innerHTML = `<i class="fas fa-plus me-1"></i>${transaccionesCurrent} total`;
    }
    
    if (usuariosTrendEl) {
        const usuariosActivos = new Set(currentData.map(c => c.usuarioId)).size;
        usuariosTrendEl.innerHTML = `<i class="fas fa-users me-1"></i>${usuariosActivos} activos`;
    }
    
    if (promedioTrendEl) {
        const promedio = transaccionesCurrent > 0 ? totalCurrent / transaccionesCurrent : 0;
        promedioTrendEl.innerHTML = promedio > 0 ? 
            '<i class="fas fa-chart-line me-1"></i>Calculado' : 
            '<i class="fas fa-equals me-1"></i>Sin datos';
    }
}

// Función para mostrar resumen de usuarios
function showUserSummary(resumenUsuarios) {
    const userSummaryContainer = document.getElementById('userSummary');
    if (!userSummaryContainer) return;
    
    if (Object.keys(resumenUsuarios).length === 0) {
        userSummaryContainer.innerHTML = '<p class="text-muted">No hay datos para mostrar</p>';
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-dark table-hover">
                <thead>
                    <tr>
                        <th><i class="fas fa-user me-1"></i>Usuario</th>
                        <th><i class="fas fa-receipt me-1"></i>Transacciones</th>
                        <th><i class="fas fa-clipboard-list me-1"></i>Planillas</th>
                        <th><i class="fas fa-file-invoice me-1"></i>Comprobantes</th>
                        <th><i class="fas fa-dollar-sign me-1"></i>Total</th>
                        <th><i class="fas fa-calculator me-1"></i>Promedio</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    Object.values(resumenUsuarios)
        .sort((a, b) => b.total - a.total)
        .forEach(resumen => {
            const promedio = resumen.total / resumen.transacciones;
            const tipoText = resumen.tipo === 'comprobante' ? 'Planilla + Comprobante' : 'Solo Planilla';
            
            html += `
                <tr class="interactive-element">
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="avatar-circle me-2">${resumen.nombre.charAt(0).toUpperCase()}</div>
                            <div>
                                ${resumen.nombre}
                                <br><small class="text-muted">${tipoText}</small>
                            </div>
                        </div>
                    </td>
                    <td><span class="badge bg-info">${resumen.transacciones}</span></td>
                    <td><span class="badge bg-secondary">${resumen.planillas.size}</span></td>
                    <td><span class="badge bg-warning">${resumen.comprobantes.size}</span></td>
                    <td><span class="badge bg-success fs-6">$${resumen.total.toLocaleString('es-CO')}</span></td>
                    <td>$${Math.round(promedio).toLocaleString('es-CO')}</td>
                </tr>
            `;
        });
    
    html += `
            </tbody>
        </table>
        </div>
    `;
    userSummaryContainer.innerHTML = html;
}

// Función para mostrar actividad reciente
function showRecentActivity(recentCobros) {
    const actividadContainer = document.getElementById('actividadReciente');
    if (!actividadContainer) return;
    
    if (recentCobros.length === 0) {
        actividadContainer.innerHTML = '<p class="text-muted">No hay actividad reciente</p>';
        return;
    }
    
    let html = '<div class="list-group list-group-flush">';
    
    recentCobros.forEach(cobro => {
        const fecha = new Date(cobro.fecha || cobro.timestamp || Date.now());
        const usuario = usuarios.find(u => u.id === cobro.usuarioId);
        const tipoText = cobro.tipo === 'comprobante' ? 'Planilla + Comprobante' : 'Solo Planilla';
        
        html += `
            <div class="list-group-item bg-transparent border-0 px-0">
                <div class="d-flex w-100 justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle me-3">${(cobro.usuarioNombre || 'U').charAt(0).toUpperCase()}</div>
                        <div>
                            <h6 class="mb-1">${cobro.usuarioNombre || 'Usuario desconocido'}</h6>
                            <p class="mb-1 text-muted small">${tipoText}</p>
                            <small class="text-muted">${fecha.toLocaleString('es-CO')}</small>
                        </div>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-success fs-6">$${(cobro.monto || 0).toLocaleString('es-CO')}</span>
                        ${cobro.numeroPlanilla ? `<br><small class="text-muted">Planilla: ${cobro.numeroPlanilla}</small>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    actividadContainer.innerHTML = html;
}

// Cargar cobros recientes
function loadCobrosRecientes() {
    const container = document.getElementById('cobrosRecientes');
    if (!container) return;
    
    const cobrosRecientes = cobros.slice(0, 10); // Últimos 10 cobros
    
    if (cobrosRecientes.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay cobros registrados</p>';
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-dark table-hover">
                <thead>
                    <tr>
                        <th><i class="fas fa-calendar me-1"></i>Fecha</th>
                        <th><i class="fas fa-user me-1"></i>Usuario</th>
                        <th><i class="fas fa-dollar-sign me-1"></i>Monto</th>
                        <th><i class="fas fa-clipboard-list me-1"></i>Planilla</th>
                        <th><i class="fas fa-receipt me-1"></i>Comprobante</th>
                        <th><i class="fas fa-comment me-1"></i>Descripción</th>
                        <th><i class="fas fa-cogs me-1"></i>Acciones</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    cobrosRecientes.forEach(cobro => {
        const fechaCobro = new Date(cobro.fecha || cobro.timestamp || Date.now());
        const planillaInfo = cobro.numeroPlanilla ? 
            `${cobro.numeroPlanilla}<br><small class="text-muted">${formatDate(cobro.fechaPlanilla)}</small>` : 
            '-';
        const comprobanteInfo = cobro.numeroComprobante ? 
            `${cobro.numeroComprobante}<br><small class="text-muted">${formatDate(cobro.fechaComprobante)}</small>` : 
            '-';
        
        html += `
            <tr class="interactive-element">
                <td>${fechaCobro.toLocaleDateString('es-CO')}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle me-2">${(cobro.usuarioNombre || 'U').charAt(0).toUpperCase()}</div>
                        <div>
                            ${cobro.usuarioNombre || 'Sin nombre'}
                            <br><small class="text-muted">${cobro.tipo === 'comprobante' ? 'Planilla + Comprobante' : 'Solo Planilla'}</small>
                        </div>
                    </div>
                </td>
                <td><span class="badge bg-success fs-6">$${(cobro.monto || 0).toLocaleString('es-CO')}</span></td>
                <td>${planillaInfo}</td>
                <td>${comprobanteInfo}</td>
                <td>${cobro.descripcion || '-'}</td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-primary" onclick="editarCobro('${cobro.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger" onclick="eliminarCobro('${cobro.id}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
        </div>
    `;
    container.innerHTML = html;
}

// Cargar reportes
function loadReportes() {
    // Establecer fecha por defecto (mes actual)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const fechaInicio = document.getElementById('reporteFechaInicio');
    const fechaFin = document.getElementById('reporteFechaFin');
    
    if (fechaInicio) {
        fechaInicio.value = firstDay.toISOString().split('T')[0];
    }
    if (fechaFin) {
        fechaFin.value = lastDay.toISOString().split('T')[0];
    }
}

// Generar reporte
function generarReporte() {
    const usuarioId = document.getElementById('reporteUsuario')?.value || '';
    const fechaInicio = document.getElementById('reporteFechaInicio')?.value || '';
    const fechaFin = document.getElementById('reporteFechaFin')?.value || '';
    
    // Filtrar cobros
    let cobrosFiltrados = cobros.filter(cobro => {
        // Filtro por usuario
        if (usuarioId && cobro.usuarioId !== usuarioId) return false;
        
        // Determinar qué fecha usar para el filtro según el tipo de usuario
        let fechaParaFiltro;
        if (cobro.tipo === 'comprobante') {
            // Para usuarios con comprobante, usar fecha de comprobante si existe, sino fecha de planilla
            fechaParaFiltro = cobro.fechaComprobante || cobro.fechaPlanilla;
        } else {
            // Para usuarios de solo planilla, usar fecha de planilla
            fechaParaFiltro = cobro.fechaPlanilla;
        }
        
        // Filtro por fecha
        if (fechaInicio && fechaParaFiltro && fechaParaFiltro < fechaInicio) return false;
        if (fechaFin && fechaParaFiltro && fechaParaFiltro > fechaFin) return false;
        
        // Si no hay fecha relevante, excluir del reporte
        if (!fechaParaFiltro && (fechaInicio || fechaFin)) return false;
        
        return true;
    });
    
    // Mostrar resultados
    const container = document.getElementById('reporteResultados');
    if (!container) return;
    
    if (cobrosFiltrados.length === 0) {
        container.innerHTML = '<p class="text-muted">No se encontraron resultados para los filtros seleccionados</p>';
        return;
    }
    
    const total = cobrosFiltrados.reduce((sum, cobro) => sum + (cobro.monto || 0), 0);
    
    let html = `
        <div class="row mb-3">
            <div class="col-md-6">
                <div class="card bg-primary text-white">
                    <div class="card-body">
                        <h5>Total del Reporte</h5>
                        <h3>$${total.toLocaleString('es-CO')}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card bg-info text-white">
                    <div class="card-body">
                        <h5>Transacciones</h5>
                        <h3>${cobrosFiltrados.length}</h3>
                    </div>
                </div>
            </div>
        </div>
        
        <table class="table table-hover table-dark">
            <thead>
                <tr>
                    <th><i class="fas fa-calendar me-1"></i>Fecha Planilla/Comprobante</th>
                    <th><i class="fas fa-user me-1"></i>Usuario</th>
                    <th><i class="fas fa-dollar-sign me-1"></i>Monto</th>
                    <th><i class="fas fa-clipboard-list me-1"></i>Número Planilla</th>
                    <th><i class="fas fa-calendar me-1"></i>Fecha Planilla</th>
                    <th><i class="fas fa-receipt me-1"></i>Número Comprobante</th>
                    <th><i class="fas fa-calendar me-1"></i>Fecha Comprobante</th>
                    <th><i class="fas fa-comment me-1"></i>Descripción</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    cobrosFiltrados.forEach(cobro => {
        // Determinar qué fecha mostrar como principal según el tipo
        const fechaPrincipal = cobro.tipo === 'comprobante' 
            ? formatDate(cobro.fechaComprobante) || formatDate(cobro.fechaPlanilla)
            : formatDate(cobro.fechaPlanilla);
            
        html += `
            <tr>
                <td>${fechaPrincipal || '-'}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle me-2">${(cobro.usuarioNombre || 'U').charAt(0).toUpperCase()}</div>
                        <div>
                            ${cobro.usuarioNombre || 'Sin nombre'}
                            <br><small class="text-muted">${cobro.tipo === 'comprobante' ? 'Planilla + Comprobante' : 'Solo Planilla'}</small>
                        </div>
                    </div>
                </td>
                <td><span class="badge bg-success fs-6">$${(cobro.monto || 0).toLocaleString('es-CO')}</span></td>
                <td>${cobro.numeroPlanilla || '-'}</td>
                <td>${formatDate(cobro.fechaPlanilla) || '-'}</td>
                <td>${cobro.numeroComprobante || '-'}</td>
                <td>${formatDate(cobro.fechaComprobante) || '-'}</td>
                <td>${cobro.descripcion || '-'}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Obtener cobros filtrados según los criterios del reporte
function getCobrosFilterados() {
    const usuarioId = document.getElementById('reporteUsuario')?.value || '';
    const fechaInicio = document.getElementById('reporteFechaInicio')?.value || '';
    const fechaFin = document.getElementById('reporteFechaFin')?.value || '';
    
    // Si no hay filtros activos, devolver todos los cobros
    if (!usuarioId && !fechaInicio && !fechaFin) {
        return cobros;
    }
    
    return cobros.filter(cobro => {
        // Filtro por usuario
        if (usuarioId && cobro.usuarioId !== usuarioId) return false;
        
        // Determinar qué fecha usar para el filtro según el tipo de usuario
        let fechaParaFiltro;
        if (cobro.tipo === 'comprobante') {
            // Para usuarios con comprobante, usar fecha de comprobante si existe, sino fecha de planilla
            fechaParaFiltro = cobro.fechaComprobante || cobro.fechaPlanilla;
        } else {
            // Para usuarios de solo planilla, usar fecha de planilla
            fechaParaFiltro = cobro.fechaPlanilla;
        }
        
        // Filtro por fecha
        if (fechaInicio && fechaParaFiltro && fechaParaFiltro < fechaInicio) return false;
        if (fechaFin && fechaParaFiltro && fechaParaFiltro > fechaFin) return false;
        
        // Si no hay fecha relevante, excluir del reporte cuando hay filtros de fecha
        if (!fechaParaFiltro && (fechaInicio || fechaFin)) return false;
        
        return true;
    });
}

// Exportar a Excel
function exportarExcel() {
    const cobrosParaExportar = getCobrosFilterados();
    
    if (cobrosParaExportar.length === 0) {
        showAlert('No hay cobros para exportar', 'warning');
        return;
    }

    // Crear datos para CSV (compatible con Excel)
    const headers = ['Fecha', 'Usuario', 'Tipo', 'Monto', 'Descripción', 'N° Planilla', 'Fecha Planilla', 'N° Comprobante', 'Fecha Comprobante'];
    const csvData = [headers];
    
    cobrosParaExportar.forEach(cobro => {
        const fecha = new Date(cobro.fecha).toLocaleDateString('es-CO');
        const fechaPlanilla = formatDate(cobro.fechaPlanilla);
        const fechaComprobante = formatDate(cobro.fechaComprobante);
        
        csvData.push([
            fecha,
            cobro.usuarioNombre,
            cobro.tipo === 'comprobante' ? 'Planilla y Comprobante' : 'Solo Planilla',
            `$${cobro.monto.toLocaleString('es-CO')}`,
            cobro.descripcion || '',
            cobro.numeroPlanilla || '',
            fechaPlanilla,
            cobro.numeroComprobante || '',
            fechaComprobante
        ]);
    });
    
    // Convertir a CSV
    const csvContent = csvData.map(row => 
        row.map(field => `"${field}"`).join(',')
    ).join('\n');
    
    // Descargar archivo
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `cobros_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('Archivo Excel exportado exitosamente', 'success');
}

// Exportar a PDF
function exportarPDF() {
    const cobrosParaExportar = getCobrosFilterados();
    
    if (cobrosParaExportar.length === 0) {
        showAlert('No hay cobros para exportar', 'warning');
        return;
    }

    // Crear contenido HTML para imprimir
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Reporte de Cobros</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px;
                    font-size: 12px;
                }
                h1 { 
                    color: #2c3e50; 
                    text-align: center;
                    margin-bottom: 30px;
                }
                .info {
                    text-align: center;
                    margin-bottom: 20px;
                    color: #7f8c8d;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 20px;
                }
                th, td { 
                    border: 1px solid #ddd; 
                    padding: 8px; 
                    text-align: left;
                }
                th { 
                    background-color: #3498db; 
                    color: white;
                    font-weight: bold;
                }
                tr:nth-child(even) { 
                    background-color: #f2f2f2; 
                }
                .total {
                    margin-top: 20px;
                    text-align: right;
                    font-weight: bold;
                    font-size: 14px;
                }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>Reporte de Cobros</h1>
            <div class="info">
                Generado el: ${new Date().toLocaleDateString('es-CO')} a las ${new Date().toLocaleTimeString('es-CO')}
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Usuario</th>
                        <th>Tipo</th>
                        <th>Monto</th>
                        <th>Descripción</th>
                        <th>N° Planilla</th>
                        <th>Fecha Planilla</th>
                        <th>N° Comprobante</th>
                        <th>Fecha Comprobante</th>
                    </tr>
                </thead>
                <tbody>
                    ${cobrosParaExportar.map(cobro => {
                        const fecha = new Date(cobro.fecha).toLocaleDateString('es-CO');
                        const fechaPlanilla = formatDate(cobro.fechaPlanilla);
                        const fechaComprobante = formatDate(cobro.fechaComprobante);
                        
                        return `
                            <tr>
                                <td>${fecha}</td>
                                <td>${cobro.usuarioNombre}</td>
                                <td>${cobro.tipo === 'comprobante' ? 'Planilla y Comprobante' : 'Solo Planilla'}</td>
                                <td>$${cobro.monto.toLocaleString('es-CO')}</td>
                                <td>${cobro.descripcion || ''}</td>
                                <td>${cobro.numeroPlanilla || ''}</td>
                                <td>${fechaPlanilla}</td>
                                <td>${cobro.numeroComprobante || ''}</td>
                                <td>${fechaComprobante}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            <div class="total">
                Total de registros: ${cobrosParaExportar.length}<br>
                Monto total: $${cobrosParaExportar.reduce((sum, cobro) => sum + cobro.monto, 0).toLocaleString('es-CO')}
            </div>
        </body>
        </html>
    `;
    
    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Esperar a que se cargue y luego imprimir
    setTimeout(() => {
        printWindow.print();
        showAlert('PDF generado. Use la opción "Guardar como PDF" en la ventana de impresión', 'success');
    }, 500);
}

// Mostrar alertas
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

// Editar cobro
function editarCobro(cobroId) {
    console.log('editarCobro: Editando cobro con ID', cobroId);
    
    const cobro = cobros.find(c => c.id === cobroId);
    if (!cobro) {
        showAlert('Cobro no encontrado', 'danger');
        return;
    }
    
    console.log('editarCobro: Datos del cobro a editar', cobro);
    
    // Llenar el formulario de edición
    document.getElementById('editCobroId').value = cobro.id;
    document.getElementById('editCobroMonto').value = cobro.monto;
    document.getElementById('editCobroDescripcion').value = cobro.descripcion || '';
    
    // Llenar select de usuarios
    const editUsuarioSelect = document.getElementById('editCobroUsuario');
    editUsuarioSelect.innerHTML = '<option value="">Seleccionar usuario...</option>';
    usuarios.forEach(usuario => {
        const option = document.createElement('option');
        option.value = usuario.id;
        option.textContent = usuario.nombre;
        if (usuario.id === cobro.usuarioId) {
            option.selected = true;
        }
        editUsuarioSelect.appendChild(option);
    });
    
    // Manejar campos específicos según el tipo
    if (cobro.tipo === 'comprobante') {
        // Mostrar campos de comprobante
        document.getElementById('editPlanillaFields').style.display = 'none';
        document.getElementById('editComprobanteFields').style.display = 'block';
        
        document.getElementById('editNumeroPlanillaComp').value = cobro.numeroPlanilla || '';
        document.getElementById('editFechaPlanillaComp').value = dateToInputFormat(cobro.fechaPlanilla) || '';
        document.getElementById('editNumeroComprobante').value = cobro.numeroComprobante || '';
        document.getElementById('editFechaComprobante').value = dateToInputFormat(cobro.fechaComprobante) || '';
    } else {
        // Mostrar campos de solo planilla
        document.getElementById('editPlanillaFields').style.display = 'block';
        document.getElementById('editComprobanteFields').style.display = 'none';
        
        document.getElementById('editNumeroPlanilla').value = cobro.numeroPlanilla || '';
        document.getElementById('editFechaPlanilla').value = dateToInputFormat(cobro.fechaPlanilla) || '';
    }
    
    // Configurar el evento de cambio de usuario para el modal de edición
    document.getElementById('editCobroUsuario').onchange = handleEditUsuarioChange;
    
    // Mostrar el modal
    const modal = new bootstrap.Modal(document.getElementById('editCobroModal'));
    modal.show();
}

// Manejar cambio de usuario en el modal de edición
function handleEditUsuarioChange() {
    const usuarioId = document.getElementById('editCobroUsuario').value;
    const usuario = usuarios.find(u => u.id === usuarioId);
    
    if (usuario) {
        if (usuario.tipo === 'comprobante') {
            document.getElementById('editPlanillaFields').style.display = 'none';
            document.getElementById('editComprobanteFields').style.display = 'block';
            
            // Hacer campos requeridos
            setRequiredFields(['editNumeroPlanillaComp', 'editFechaPlanillaComp', 'editNumeroComprobante', 'editFechaComprobante']);
        } else {
            document.getElementById('editPlanillaFields').style.display = 'block';
            document.getElementById('editComprobanteFields').style.display = 'none';
            
            // Hacer campos requeridos
            setRequiredFields(['editNumeroPlanilla', 'editFechaPlanilla']);
        }
    } else {
        // Ocultar todos los campos dinámicos
        document.getElementById('editPlanillaFields').style.display = 'none';
        document.getElementById('editComprobanteFields').style.display = 'none';
    }
}

// Guardar cobro editado
async function guardarCobroEditado() {
    const cobroId = document.getElementById('editCobroId').value;
    const usuarioId = document.getElementById('editCobroUsuario').value;
    const monto = parseFloat(document.getElementById('editCobroMonto').value);
    const descripcion = document.getElementById('editCobroDescripcion').value;
    
    console.log('guardarCobroEditado: Datos básicos', { cobroId, usuarioId, monto, descripcion });
    
    if (!usuarioId || !monto || !cobroId) {
        showAlert('Por favor complete todos los campos requeridos', 'warning');
        return;
    }
    
    const usuario = usuarios.find(u => u.id === usuarioId);
    if (!usuario) {
        showAlert('Usuario no encontrado', 'danger');
        return;
    }
    
    // Encontrar el cobro a editar
    const cobroIndex = cobros.findIndex(c => c.id === cobroId);
    if (cobroIndex === -1) {
        showAlert('Cobro no encontrado', 'danger');
        return;
    }
    
    // Preparar datos actualizados
    const cobroActualizado = {
        ...cobros[cobroIndex], // Mantener datos existentes
        usuarioId: usuarioId,
        usuarioNombre: usuario.nombre,
        monto: monto,
        descripcion: descripcion || '',
        tipo: usuario.tipo,
        fechaActualizacion: new Date().toISOString()
    };
    
    // Recopilar campos específicos según el tipo
    if (usuario.tipo === 'comprobante') {
        cobroActualizado.numeroPlanilla = document.getElementById('editNumeroPlanillaComp').value;
        cobroActualizado.fechaPlanilla = document.getElementById('editFechaPlanillaComp').value;
        cobroActualizado.numeroComprobante = document.getElementById('editNumeroComprobante').value;
        cobroActualizado.fechaComprobante = document.getElementById('editFechaComprobante').value;
        
        if (!cobroActualizado.numeroPlanilla || !cobroActualizado.fechaPlanilla || 
            !cobroActualizado.numeroComprobante || !cobroActualizado.fechaComprobante) {
            showAlert('Por favor complete todos los campos de planilla y comprobante', 'warning');
            return;
        }
    } else {
        cobroActualizado.numeroPlanilla = document.getElementById('editNumeroPlanilla').value;
        cobroActualizado.fechaPlanilla = document.getElementById('editFechaPlanilla').value;
        
        // Limpiar campos de comprobante si cambió de tipo
        cobroActualizado.numeroComprobante = '';
        cobroActualizado.fechaComprobante = '';
        
        if (!cobroActualizado.numeroPlanilla || !cobroActualizado.fechaPlanilla) {
            showAlert('Por favor complete todos los campos de planilla', 'warning');
            return;
        }
    }
    
    console.log('guardarCobroEditado: Datos actualizados', cobroActualizado);
    
    try {
        if (isFirebaseAvailable) {
            // Actualizar en Firebase
            await db.collection("cobros").doc(cobroId).update(cobroActualizado);
            console.log('guardarCobroEditado: Actualizado en Firebase');
        }
        
        // Actualizar en array local
        cobros[cobroIndex] = cobroActualizado;
        saveCobrosToLocal();
        
        showAlert('Cobro actualizado exitosamente', 'success');
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editCobroModal'));
        modal.hide();
        
        // Recargar datos
        updateDashboard();
        loadCobrosRecientes();
        
        console.log('guardarCobroEditado: Proceso completado');
        
    } catch (error) {
        console.error("Error actualizando cobro:", error);
        showAlert('Error actualizando cobro', 'danger');
    }
}

// Eliminar cobro
function eliminarCobro(cobroId) {
    console.log('eliminarCobro: Eliminando cobro con ID', cobroId);
    
    const cobro = cobros.find(c => c.id === cobroId);
    if (!cobro) {
        showAlert('Cobro no encontrado', 'danger');
        return;
    }
    
    // Confirmar eliminación
    const confirmar = confirm(`¿Está seguro de que desea eliminar el cobro de ${cobro.usuarioNombre} por $${cobro.monto.toLocaleString('es-CO')}?`);
    
    if (!confirmar) {
        return;
    }
    
    eliminarCobroConfirmado(cobroId);
}

// Eliminar cobro confirmado
async function eliminarCobroConfirmado(cobroId) {
    try {
        if (isFirebaseAvailable) {
            // Eliminar de Firebase
            await db.collection("cobros").doc(cobroId).delete();
            console.log('eliminarCobroConfirmado: Eliminado de Firebase');
        }
        
        // Eliminar del array local
        const cobroIndex = cobros.findIndex(c => c.id === cobroId);
        if (cobroIndex !== -1) {
            cobros.splice(cobroIndex, 1);
            saveCobrosToLocal();
        }
        
        showAlert('Cobro eliminado exitosamente', 'success');
        
        // Recargar datos
        updateDashboard();
        loadCobrosRecientes();
        
        console.log('eliminarCobroConfirmado: Proceso completado');
        
    } catch (error) {
        console.error("Error eliminando cobro:", error);
        showAlert('Error eliminando cobro', 'danger');
    }
}

// Funciones globales para eventos onclick
window.showSection = showSection;
window.logout = logout;
window.guardarUsuario = guardarUsuario;
window.eliminarUsuario = eliminarUsuario;
window.updateDashboard = updateDashboard;
window.generarReporte = generarReporte;
window.exportarExcel = exportarExcel;
window.exportarPDF = exportarPDF;
window.editarCobro = editarCobro;
window.eliminarCobro = eliminarCobro;
window.guardarCobroEditado = guardarCobroEditado;
