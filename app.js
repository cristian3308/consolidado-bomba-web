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

// === SISTEMA DE NOTIFICACIONES AVANZADO ===
class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notificationContainer');
        this.notifications = [];
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas ${this.getIcon(type)} me-2"></i>
                <div class="flex-grow-1">${message}</div>
                <button class="btn-close btn-close-white ms-2" onclick="notifications.remove('${notification.id}')"></button>
            </div>
        `;
        
        const id = 'notif_' + Date.now();
        notification.id = id;
        
        this.container.appendChild(notification);
        this.notifications.push({ id, element: notification, timeout: null });
        
        // Auto-remove después del tiempo especificado
        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }
        
        return id;
    }

    remove(id) {
        const notificationData = this.notifications.find(n => n.id === id);
        if (notificationData) {
            notificationData.element.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notificationData.element.parentNode) {
                    notificationData.element.parentNode.removeChild(notificationData.element);
                }
                this.notifications = this.notifications.filter(n => n.id !== id);
            }, 300);
        }
    }

    getIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    // Métodos de conveniencia
    success(message, duration) { return this.show(message, 'success', duration); }
    error(message, duration) { return this.show(message, 'error', duration); }
    warning(message, duration) { return this.show(message, 'warning', duration); }
    info(message, duration) { return this.show(message, 'info', duration); }
}

// Instancia global del sistema de notificaciones
const notifications = new NotificationSystem();

// === SISTEMA DE GRÁFICOS CON CHART.JS ===
class ChartManager {
    constructor() {
        this.charts = {};
        this.colors = {
            primary: '#00ff9f',
            secondary: '#4dabf7',
            accent: '#667eea',
            success: '#51cf66',
            warning: '#ffd93d',
            danger: '#ff6b6b'
        };
    }

    createMonthlyChart() {
        const ctx = document.getElementById('monthlyChart');
        if (!ctx) return;

        const monthlyData = this.getMonthlyData();
        
        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }

        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthlyData.labels,
                datasets: [{
                    label: 'Cobros Mensuales',
                    data: monthlyData.values,
                    borderColor: this.colors.primary,
                    backgroundColor: `${this.colors.primary}20`,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: this.colors.primary,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#ffffff' },
                        grid: { color: '#30363d' }
                    },
                    y: {
                        ticks: { 
                            color: '#ffffff',
                            callback: function(value) {
                                return '$' + value.toLocaleString('es-CO');
                            }
                        },
                        grid: { color: '#30363d' }
                    }
                }
            }
        });
    }

    createUserChart() {
        const ctx = document.getElementById('userChart');
        if (!ctx) return;

        const userData = this.getUserData();
        
        if (this.charts.user) {
            this.charts.user.destroy();
        }

        this.charts.user = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: userData.labels,
                datasets: [{
                    data: userData.values,
                    backgroundColor: [
                        this.colors.primary,
                        this.colors.secondary,
                        this.colors.accent,
                        this.colors.success,
                        this.colors.warning,
                        this.colors.danger
                    ],
                    borderWidth: 2,
                    borderColor: '#1a1a2e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ffffff',
                            padding: 20
                        }
                    }
                }
            }
        });
    }

    getMonthlyData() {
        const year = parseInt(document.getElementById('dashboardYear')?.value || new Date().getFullYear());
        const monthlyTotals = Array(12).fill(0);
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        cobros.forEach(cobro => {
            // Determinar qué fecha usar según el tipo de usuario
            let fechaParaFiltro;
            if (cobro.tipo === 'comprobante') {
                fechaParaFiltro = cobro.fechaComprobante || cobro.fechaPlanilla;
            } else {
                fechaParaFiltro = cobro.fechaPlanilla;
            }
            
            if (fechaParaFiltro) {
                const fecha = new Date(fechaParaFiltro);
                if (fecha.getFullYear() === year) {
                    monthlyTotals[fecha.getMonth()] += cobro.monto || 0;
                }
            }
        });

        return {
            labels: monthNames,
            values: monthlyTotals
        };
    }

    getUserData() {
        const userTotals = {};
        
        cobros.forEach(cobro => {
            const userId = cobro.usuarioId;
            const userName = cobro.usuarioNombre || 'Usuario Desconocido';
            
            if (!userTotals[userId]) {
                userTotals[userId] = {
                    name: userName,
                    total: 0
                };
            }
            userTotals[userId].total += cobro.monto || 0;
        });

        const sortedUsers = Object.values(userTotals)
            .sort((a, b) => b.total - a.total)
            .slice(0, 6); // Top 6 usuarios

        return {
            labels: sortedUsers.map(user => user.name),
            values: sortedUsers.map(user => user.total)
        };
    }

    // Método para obtener análisis detallado de usuarios organizados por años y meses
    getDetailedUserAnalysis() {
        const analysis = {};
        
        cobros.forEach(cobro => {
            const userId = cobro.usuarioId;
            const userName = cobro.usuarioNombre || 'Usuario Desconocido';
            
            // Determinar qué fecha usar según el tipo de usuario
            let fechaParaFiltro;
            if (cobro.tipo === 'comprobante') {
                fechaParaFiltro = cobro.fechaComprobante || cobro.fechaPlanilla;
            } else {
                fechaParaFiltro = cobro.fechaPlanilla;
            }
            
            if (!fechaParaFiltro) return; // Saltar si no hay fecha relevante
            
            const fechaPlanilla = new Date(fechaParaFiltro);
            const year = fechaPlanilla.getFullYear();
            const month = fechaPlanilla.getMonth();
            const monto = cobro.monto || 0;
            
            // Inicializar estructura de datos
            if (!analysis[userId]) {
                analysis[userId] = {
                    name: userName,
                    totalGeneral: 0,
                    years: {}
                };
            }
            
            if (!analysis[userId].years[year]) {
                analysis[userId].years[year] = {
                    total: 0,
                    cobros: 0,
                    months: Array(12).fill(0),
                    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                };
            }
            
            // Acumular datos
            analysis[userId].totalGeneral += monto;
            analysis[userId].years[year].total += monto;
            analysis[userId].years[year].cobros += 1;
            analysis[userId].years[year].months[month] += monto;
        });
        
        return analysis;
    }

    // Método para obtener estadísticas por año
    getYearlyStats() {
        const yearlyStats = {};
        
        cobros.forEach(cobro => {
            // Determinar qué fecha usar según el tipo de usuario
            let fechaParaFiltro;
            if (cobro.tipo === 'comprobante') {
                fechaParaFiltro = cobro.fechaComprobante || cobro.fechaPlanilla;
            } else {
                fechaParaFiltro = cobro.fechaPlanilla;
            }
            
            if (!fechaParaFiltro) return; // Saltar si no hay fecha relevante
            
            const fechaPlanilla = new Date(fechaParaFiltro);
            const year = fechaPlanilla.getFullYear();
            const monto = cobro.monto || 0;
            
            if (!yearlyStats[year]) {
                yearlyStats[year] = {
                    total: 0,
                    cobros: 0,
                    usuarios: new Set()
                };
            }
            
            yearlyStats[year].total += monto;
            yearlyStats[year].cobros += 1;
            yearlyStats[year].usuarios.add(cobro.usuarioId);
        });
        
        // Convertir Set a número
        Object.keys(yearlyStats).forEach(year => {
            yearlyStats[year].usuarios = yearlyStats[year].usuarios.size;
        });
        
        return yearlyStats;
    }

    updateCharts() {
        this.createMonthlyChart();
        this.createUserChart();
    }
}

// Instancia global del gestor de gráficos
const chartManager = new ChartManager();

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
            // Hacer estadísticas clickeables y actualizar gráficos
            setTimeout(() => {
                makeStatsClickable();
                chartManager.updateCharts();
            }, 100);
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

// Actualizar dashboard con filtrado mejorado por fechas de planilla y comprobante
function updateDashboard() {
    const yearSelect = document.getElementById('dashboardYear');
    const monthSelect = document.getElementById('dashboardMonth');
    
    if (!yearSelect || !monthSelect) return;
    
    const year = yearSelect.value;
    const month = monthSelect.value;
    
    // Filtrar cobros usando fechas de planilla y comprobante
    let cobrosFiltrados = cobros.filter(cobro => {
        // Determinar qué fecha usar para el filtro según el tipo de usuario
        let fechaParaFiltro;
        if (cobro.tipo === 'comprobante') {
            // Para usuarios con comprobante, usar fecha de comprobante si existe, sino fecha de planilla
            fechaParaFiltro = cobro.fechaComprobante || cobro.fechaPlanilla;
        } else {
            // Para usuarios de solo planilla, usar fecha de planilla
            fechaParaFiltro = cobro.fechaPlanilla;
        }
        
        // Si no hay fecha relevante, usar fecha de registro como fallback
        if (!fechaParaFiltro) {
            fechaParaFiltro = cobro.fecha || cobro.timestamp;
        }
        
        if (!fechaParaFiltro) return false;
        
        const cobroDate = new Date(fechaParaFiltro);
        const cobroYear = cobroDate.getFullYear().toString();
        const cobroMonth = (cobroDate.getMonth() + 1).toString();
        
        if (year && cobroYear !== year) return false;
        if (month && cobroMonth !== month) return false;
        
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
                usuarioId: cobro.usuarioId, // Agregar el ID del usuario
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
    lastResumenUsuarios = resumenUsuarios; // Guardar para uso posterior
    showUserSummary(resumenUsuarios);
    
    // Mostrar usuarios detallados en el dashboard
    showUsuariosDetallados(resumenUsuarios);
    
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

// Función para mostrar usuarios detallados en el dashboard
function showUsuariosDetallados(resumenUsuarios) {
    const container = document.getElementById('usuariosDetallados');
    if (!container) return;
    
    if (Object.keys(resumenUsuarios).length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No hay datos para mostrar</p>';
        return;
    }
    
    let html = '';
    
    Object.values(resumenUsuarios)
        .sort((a, b) => b.total - a.total)
        .slice(0, 8) // Mostrar máximo 8 usuarios en el dashboard
        .forEach(resumen => {
            const promedio = resumen.total / resumen.transacciones;
            
            html += `
                <div class="usuario-card" onclick="showUserDetailModal('${resumen.usuarioId || ''}')">
                    <div class="usuario-header">
                        <div class="avatar-circle">${resumen.nombre.charAt(0).toUpperCase()}</div>
                        <div class="usuario-name">${resumen.nombre}</div>
                    </div>
                    <div class="usuario-stats">
                        <div class="stat">
                            <span class="stat-label">Total</span>
                            <span class="stat-value text-success">$${resumen.total.toLocaleString('es-CO')}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Transacciones</span>
                            <span class="stat-value text-info">${resumen.transacciones}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Promedio</span>
                            <span class="stat-value text-warning">$${Math.round(promedio).toLocaleString('es-CO')}</span>
                        </div>
                    </div>
                    <div class="usuario-action">
                        <i class="fas fa-eye"></i> Ver Detalles
                    </div>
                </div>
            `;
        });
    
    container.innerHTML = html;
}

// Función para alternar vista de usuarios
function toggleUserView() {
    const container = document.getElementById('usuariosDetallados');
    const button = event.target;
    
    if (container.classList.contains('expanded-view')) {
        container.classList.remove('expanded-view');
        button.innerHTML = '<i class="fas fa-expand-alt me-1"></i>Vista Expandida';
        // Mostrar solo los primeros usuarios
        showUsuariosDetallados(getLastResumenUsuarios());
    } else {
        container.classList.add('expanded-view');
        button.innerHTML = '<i class="fas fa-compress-alt me-1"></i>Vista Compacta';
        // Mostrar todos los usuarios
        showAllUsersModal();
    }
}

// Variable global para mantener el último resumen de usuarios
let lastResumenUsuarios = {};

// Función para obtener el último resumen
function getLastResumenUsuarios() {
    return lastResumenUsuarios;
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

// Generar reporte organizado por meses y usuarios
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
    
    // Organizar datos por mes y luego por usuario
    const reporteOrganizado = organizarReportePorMesYUsuario(cobrosFiltrados);
    const total = cobrosFiltrados.reduce((sum, cobro) => sum + (cobro.monto || 0), 0);
    
    let html = `
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card bg-primary text-white">
                    <div class="card-body text-center">
                        <h5><i class="fas fa-dollar-sign me-2"></i>Total del Reporte</h5>
                        <h3>$${total.toLocaleString('es-CO')}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card bg-info text-white">
                    <div class="card-body text-center">
                        <h5><i class="fas fa-receipt me-2"></i>Total Transacciones</h5>
                        <h3>${cobrosFiltrados.length}</h3>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="reporte-detallado">
    `;
    
    // Generar reporte por meses
    Object.keys(reporteOrganizado)
        .sort((a, b) => new Date(b + '-01') - new Date(a + '-01')) // Ordenar por fecha descendente
        .forEach(mesKey => {
            const [year, month] = mesKey.split('-');
            const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-ES', { 
                month: 'long', 
                year: 'numeric' 
            });
            
            const datosDelMes = reporteOrganizado[mesKey];
            const totalMes = Object.values(datosDelMes.usuarios).reduce((sum, userData) => 
                sum + userData.cobros.reduce((userSum, cobro) => userSum + (cobro.monto || 0), 0), 0
            );
            
            html += `
                <div class="mes-section mb-4">
                    <div class="mes-header d-flex justify-content-between align-items-center p-3 bg-secondary rounded mb-3" 
                         style="cursor: pointer;" onclick="toggleMesDetails('${mesKey}')">
                        <h4 class="mb-0 text-white text-capitalize">
                            <i class="fas fa-calendar-alt me-2"></i>${monthName}
                        </h4>
                        <div class="mes-stats d-flex gap-3 align-items-center">
                            <span class="badge bg-light text-dark fs-6">
                                <i class="fas fa-dollar-sign me-1"></i>$${totalMes.toLocaleString('es-CO')}
                            </span>
                            <span class="badge bg-light text-dark fs-6">
                                <i class="fas fa-users me-1"></i>${Object.keys(datosDelMes.usuarios).length} usuarios
                            </span>
                            <span class="badge bg-light text-dark fs-6">
                                <i class="fas fa-receipt me-1"></i>${datosDelMes.totalCobros} cobros
                            </span>
                            <i class="fas fa-chevron-down text-white" id="chevron-${mesKey}"></i>
                        </div>
                    </div>
                    
                    <div class="mes-details" id="details-${mesKey}" style="display: block;">
            `;
            
            // Generar detalles por usuario dentro del mes
            Object.keys(datosDelMes.usuarios)
                .sort((a, b) => {
                    const totalA = datosDelMes.usuarios[a].cobros.reduce((sum, cobro) => sum + (cobro.monto || 0), 0);
                    const totalB = datosDelMes.usuarios[b].cobros.reduce((sum, cobro) => sum + (cobro.monto || 0), 0);
                    return totalB - totalA; // Ordenar por total descendente
                })
                .forEach(userId => {
                    const userData = datosDelMes.usuarios[userId];
                    const totalUsuario = userData.cobros.reduce((sum, cobro) => sum + (cobro.monto || 0), 0);
                    
                    html += `
                        <div class="usuario-section mb-3 ms-4">
                            <div class="usuario-header d-flex justify-content-between align-items-center p-3 bg-dark rounded mb-2" 
                                 style="cursor: pointer;" onclick="toggleUsuarioDetails('${mesKey}-${userId}')">
                                <div class="d-flex align-items-center">
                                    <div class="avatar-circle me-3">${userData.nombre.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <h6 class="mb-0 text-white">${userData.nombre}</h6>
                                        <small class="text-muted">${userData.tipo === 'comprobante' ? 'Planilla + Comprobante' : 'Solo Planilla'}</small>
                                    </div>
                                </div>
                                <div class="usuario-stats d-flex gap-2 align-items-center">
                                    <span class="badge bg-success fs-6">$${totalUsuario.toLocaleString('es-CO')}</span>
                                    <span class="badge bg-info">${userData.cobros.length} cobros</span>
                                    <i class="fas fa-chevron-down text-white" id="chevron-${mesKey}-${userId}"></i>
                                </div>
                            </div>
                            
                            <div class="usuario-cobros" id="details-${mesKey}-${userId}" style="display: block;">
                                <div class="table-responsive ms-3">
                                    <table class="table table-dark table-sm">
                                        <thead>
                                            <tr>
                                                <th><i class="fas fa-calendar me-1"></i>Fecha</th>
                                                <th><i class="fas fa-dollar-sign me-1"></i>Monto</th>
                                                <th><i class="fas fa-clipboard-list me-1"></i>Planilla</th>
                                                <th><i class="fas fa-file-invoice me-1"></i>Comprobante</th>
                                                <th><i class="fas fa-comment me-1"></i>Descripción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                    `;
                    
                    // Mostrar cada cobro del usuario
                    userData.cobros
                        .sort((a, b) => {
                            const fechaA = new Date(a.fechaParaFiltro);
                            const fechaB = new Date(b.fechaParaFiltro);
                            return fechaB - fechaA; // Más reciente primero
                        })
                        .forEach(cobro => {
                            const fechaDisplay = new Date(cobro.fechaParaFiltro).toLocaleDateString('es-CO');
                            
                            html += `
                                <tr>
                                    <td>${fechaDisplay}</td>
                                    <td><span class="badge bg-success">$${(cobro.monto || 0).toLocaleString('es-CO')}</span></td>
                                    <td>
                                        ${cobro.numeroPlanilla ? 
                                            `<span class="badge bg-primary">${cobro.numeroPlanilla}</span><br>
                                             <small class="text-muted">${formatDate(cobro.fechaPlanilla)}</small>` : 
                                            '<span class="text-muted">-</span>'
                                        }
                                    </td>
                                    <td>
                                        ${cobro.numeroComprobante ? 
                                            `<span class="badge bg-warning text-dark">${cobro.numeroComprobante}</span><br>
                                             <small class="text-muted">${formatDate(cobro.fechaComprobante)}</small>` : 
                                            '<span class="text-muted">-</span>'
                                        }
                                    </td>
                                    <td>${cobro.descripcion || '-'}</td>
                                </tr>
                            `;
                        });
                    
                    html += `
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    `;
                });
            
            html += `
                    </div>
                </div>
            `;
        });
    
    html += '</div>';
    
    container.innerHTML = html;
}

// Función para organizar el reporte por mes y usuario
function organizarReportePorMesYUsuario(cobros) {
    const reporte = {};
    
    cobros.forEach(cobro => {
        // Determinar la fecha para el filtro
        let fechaParaFiltro;
        if (cobro.tipo === 'comprobante') {
            fechaParaFiltro = cobro.fechaComprobante || cobro.fechaPlanilla;
        } else {
            fechaParaFiltro = cobro.fechaPlanilla;
        }
        
        if (!fechaParaFiltro) return;
        
        const fecha = new Date(fechaParaFiltro);
        const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        
        // Inicializar mes si no existe
        if (!reporte[mesKey]) {
            reporte[mesKey] = {
                usuarios: {},
                totalCobros: 0
            };
        }
        
        // Inicializar usuario si no existe
        if (!reporte[mesKey].usuarios[cobro.usuarioId]) {
            const usuario = usuarios.find(u => u.id === cobro.usuarioId);
            reporte[mesKey].usuarios[cobro.usuarioId] = {
                nombre: usuario ? usuario.nombre : cobro.usuarioNombre || 'Usuario Desconocido',
                tipo: usuario ? usuario.tipo : (cobro.tipo || 'planilla'),
                cobros: []
            };
        }
        
        // Agregar cobro con fecha para filtro
        reporte[mesKey].usuarios[cobro.usuarioId].cobros.push({
            ...cobro,
            fechaParaFiltro: fechaParaFiltro
        });
        
        reporte[mesKey].totalCobros++;
    });
    
    return reporte;
}

// Funciones para toggle de secciones en el reporte
function toggleMesDetails(mesKey) {
    const details = document.getElementById(`details-${mesKey}`);
    const chevron = document.getElementById(`chevron-${mesKey}`);
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        chevron.classList.remove('fa-chevron-down');
        chevron.classList.add('fa-chevron-up');
    } else {
        details.style.display = 'none';
        chevron.classList.remove('fa-chevron-up');
        chevron.classList.add('fa-chevron-down');
    }
}

function toggleUsuarioDetails(key) {
    const details = document.getElementById(`details-${key}`);
    const chevron = document.getElementById(`chevron-${key}`);
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        chevron.classList.remove('fa-chevron-down');
        chevron.classList.add('fa-chevron-up');
    } else {
        details.style.display = 'none';
        chevron.classList.remove('fa-chevron-up');
        chevron.classList.add('fa-chevron-down');
    }
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
// Mostrar alertas usando el nuevo sistema de notificaciones
function showAlert(message, type = 'info') {
    // Mapear tipos de Bootstrap a tipos de notificación
    const typeMap = {
        'primary': 'info',
        'secondary': 'info',
        'success': 'success',
        'danger': 'error',
        'warning': 'warning',
        'info': 'info',
        'light': 'info',
        'dark': 'info'
    };
    
    const notificationType = typeMap[type] || type;
    return notifications.show(message, notificationType);
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

// Funciones para vista detallada de usuarios con análisis por años y meses
function showUserDetailModal(userId) {
    const userAnalysis = chartManager.getDetailedUserAnalysis();
    const userData = userAnalysis[userId];
    
    if (!userData) {
        notifications.show('Usuario no encontrado', 'error');
        return;
    }
    
    const modalBody = document.getElementById('userDetailModalBody');
    if (!modalBody) return;
    
    // Generar contenido del modal con análisis detallado por años
    let html = `
        <div class="user-detail-header">
            <div class="d-flex align-items-center mb-4">
                <div class="avatar-circle me-3" style="width: 60px; height: 60px; font-size: 24px;">
                    ${userData.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h4 class="mb-1">${userData.name}</h4>
                    <p class="text-muted mb-0">Total General: <span class="text-success fw-bold">$${userData.totalGeneral.toLocaleString('es-CO')}</span></p>
                </div>
            </div>
        </div>
        
        <div class="yearly-analysis">
    `;
    
    // Organizar años en orden descendente
    const years = Object.keys(userData.years).sort((a, b) => b - a);
    
    years.forEach(year => {
        const yearData = userData.years[year];
        html += `
            <div class="year-section mb-4">
                <div class="year-header d-flex justify-content-between align-items-center p-3 bg-primary rounded mb-3" 
                     style="cursor: pointer;" onclick="toggleYearDetails('${year}')">
                    <h5 class="mb-0">
                        <i class="fas fa-calendar-alt me-2"></i>Año ${year}
                    </h5>
                    <div class="year-stats d-flex gap-3">
                        <span class="badge bg-light text-dark">
                            <i class="fas fa-dollar-sign me-1"></i>$${yearData.total.toLocaleString('es-CO')}
                        </span>
                        <span class="badge bg-light text-dark">
                            <i class="fas fa-receipt me-1"></i>${yearData.cobros} cobros
                        </span>
                        <i class="fas fa-chevron-down" id="chevron-${year}"></i>
                    </div>
                </div>
                
                <div class="year-details" id="details-${year}" style="display: none;">
                    <div class="monthly-breakdown">
                        <h6 class="mb-3"><i class="fas fa-chart-line me-2"></i>Desglose Mensual</h6>
                        <div class="row">
        `;
        
        // Mostrar datos mensuales
        yearData.monthNames.forEach((monthName, index) => {
            const monthTotal = yearData.months[index];
            if (monthTotal > 0) {
                html += `
                    <div class="col-md-4 col-sm-6 mb-3">
                        <div class="month-card p-3 border rounded">
                            <div class="month-name fw-bold text-primary">${monthName}</div>
                            <div class="month-amount text-success">$${monthTotal.toLocaleString('es-CO')}</div>
                        </div>
                    </div>
                `;
            }
        });
        
        html += `
                        </div>
                    </div>
                    
                    <div class="monthly-chart-container mt-4">
                        <canvas id="monthlyChart-${year}" height="200"></canvas>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    modalBody.innerHTML = html;
    
    // Mostrar el modal
    const modal = new bootstrap.Modal(document.getElementById('userDetailModal'));
    modal.show();
    
    // Crear gráficos para cada año después de que el modal se muestre
    modal._element.addEventListener('shown.bs.modal', () => {
        years.forEach(year => {
            const yearData = userData.years[year];
            const chartData = {
                labels: yearData.monthNames,
                datasets: [{
                    label: `Cobros ${year}`,
                    data: yearData.months,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            };
            
            chartManager.createMonthlyChart(`monthlyChart-${year}`, chartData);
        });
    });
}

// Función para alternar la visibilidad de los detalles del año
function toggleYearDetails(year) {
    const details = document.getElementById(`details-${year}`);
    const chevron = document.getElementById(`chevron-${year}`);
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        chevron.classList.remove('fa-chevron-down');
        chevron.classList.add('fa-chevron-up');
    } else {
        details.style.display = 'none';
        chevron.classList.remove('fa-chevron-up');
        chevron.classList.add('fa-chevron-down');
    }
}

// Función para mostrar estadísticas generales detalladas
function showGeneralStatsModal() {
    const yearlyStats = chartManager.getYearlyStats();
    const modalBody = document.getElementById('generalStatsModalBody');
    
    if (!modalBody) return;
    
    let html = `
        <div class="general-stats-content">
            <h5 class="mb-4"><i class="fas fa-chart-bar me-2"></i>Estadísticas Generales por Año</h5>
            <div class="yearly-stats">
    `;
    
    // Organizar años en orden descendente
    const years = Object.keys(yearlyStats).sort((a, b) => b - a);
    
    years.forEach(year => {
        const stats = yearlyStats[year];
        const promedio = stats.total / stats.cobros;
        
        html += `
            <div class="year-stat-card mb-4 p-4 border rounded">
                <div class="row">
                    <div class="col-md-2">
                        <h4 class="text-primary">${year}</h4>
                    </div>
                    <div class="col-md-10">
                        <div class="row">
                            <div class="col-sm-3">
                                <div class="stat-item">
                                    <div class="stat-label text-muted">Total Recaudado</div>
                                    <div class="stat-value text-success fw-bold">$${stats.total.toLocaleString('es-CO')}</div>
                                </div>
                            </div>
                            <div class="col-sm-3">
                                <div class="stat-item">
                                    <div class="stat-label text-muted">Total Cobros</div>
                                    <div class="stat-value text-info fw-bold">${stats.cobros}</div>
                                </div>
                            </div>
                            <div class="col-sm-3">
                                <div class="stat-item">
                                    <div class="stat-label text-muted">Usuarios Activos</div>
                                    <div class="stat-value text-warning fw-bold">${stats.usuarios}</div>
                                </div>
                            </div>
                            <div class="col-sm-3">
                                <div class="stat-item">
                                    <div class="stat-label text-muted">Promedio por Cobro</div>
                                    <div class="stat-value text-secondary fw-bold">$${Math.round(promedio).toLocaleString('es-CO')}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
            
            <div class="stats-chart-container mt-4">
                <h6 class="mb-3"><i class="fas fa-chart-line me-2"></i>Evolución Anual</h6>
                <canvas id="yearlyStatsChart" height="300"></canvas>
            </div>
        </div>
    `;
    
    modalBody.innerHTML = html;
    
    // Mostrar el modal
    const modal = new bootstrap.Modal(document.getElementById('generalStatsModal'));
    modal.show();
    
    // Crear gráfico de evolución anual
    modal._element.addEventListener('shown.bs.modal', () => {
        const chartData = {
            labels: years.reverse(), // Orden ascendente para el gráfico
            datasets: [{
                label: 'Total Recaudado',
                data: years.map(year => yearlyStats[year].total),
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }, {
                label: 'Número de Cobros',
                data: years.map(year => yearlyStats[year].cobros),
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderWidth: 3,
                fill: false,
                yAxisID: 'y1'
            }]
        };
        
        const ctx = document.getElementById('yearlyStatsChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#e9ecef'
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#e9ecef' },
                            grid: { color: '#495057' }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            ticks: { 
                                color: '#e9ecef',
                                callback: function(value) {
                                    return '$' + value.toLocaleString('es-CO');
                                }
                            },
                            grid: { color: '#495057' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            ticks: { color: '#e9ecef' },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }
    });
}

// Función para hacer clickeables las estadísticas del dashboard
function makeStatsClickable() {
    // Hacer clickeable el card de usuarios
    const totalUsuariosCard = document.querySelector('.stat-card[data-stat="usuarios"]');
    if (totalUsuariosCard && !totalUsuariosCard.onclick) {
        totalUsuariosCard.style.cursor = 'pointer';
        totalUsuariosCard.onclick = showAllUsersModal;
    }
    
    // Hacer clickeable el card de estadísticas generales
    const totalCobrosCard = document.querySelector('.stat-card[data-stat="total"]');
    if (totalCobrosCard && !totalCobrosCard.onclick) {
        totalCobrosCard.style.cursor = 'pointer';
        totalCobrosCard.onclick = showGeneralStatsModal;
    }
}

// Función para mostrar modal con todos los usuarios
function showAllUsersModal() {
    const userAnalysis = chartManager.getDetailedUserAnalysis();
    const modalBody = document.getElementById('allUsersModalBody');
    
    if (!modalBody) return;
    
    let html = `
        <div class="usuarios-grid">
    `;
    
    // Ordenar usuarios por total general
    const sortedUsers = Object.entries(userAnalysis)
        .sort(([,a], [,b]) => b.totalGeneral - a.totalGeneral);
    
    sortedUsers.forEach(([userId, userData]) => {
        const yearsCount = Object.keys(userData.years).length;
        const currentYear = new Date().getFullYear();
        const currentYearData = userData.years[currentYear];
        
        html += `
            <div class="usuario-card" onclick="showUserDetailModal('${userId}')">
                <div class="usuario-header">
                    <div class="avatar-circle">${userData.name.charAt(0).toUpperCase()}</div>
                    <div class="usuario-name">${userData.name}</div>
                </div>
                <div class="usuario-stats">
                    <div class="stat">
                        <span class="stat-label">Total General</span>
                        <span class="stat-value text-success">$${userData.totalGeneral.toLocaleString('es-CO')}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Años Activos</span>
                        <span class="stat-value text-info">${yearsCount}</span>
                    </div>
                    ${currentYearData ? `
                    <div class="stat">
                        <span class="stat-label">${currentYear}</span>
                        <span class="stat-value text-warning">$${currentYearData.total.toLocaleString('es-CO')}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="usuario-action">
                    <i class="fas fa-eye"></i> Ver Detalles
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    modalBody.innerHTML = html;
    
    // Mostrar el modal
    const modal = new bootstrap.Modal(document.getElementById('allUsersModal'));
    modal.show();
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
window.showUserDetailModal = showUserDetailModal;
window.toggleYearDetails = toggleYearDetails;
window.showGeneralStatsModal = showGeneralStatsModal;
window.showAllUsersModal = showAllUsersModal;
window.makeStatsClickable = makeStatsClickable;
window.toggleMesDetails = toggleMesDetails;
window.toggleUsuarioDetails = toggleUsuarioDetails;
window.toggleUserView = toggleUserView;
