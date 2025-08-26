# Sistema de Gestión de Cobros - Consolidado Bomba

## 🚀 Descripción

Sistema web moderno para la gestión y registro de cobros con interface intuitiva y tema oscuro. Diseñado específicamente para el manejo de planillas y comprobantes de ingreso.

## ✨ Características

- **💰 Gestión de Cobros**: Registro, edición y eliminación de cobros
- **👥 Administración de Usuarios**: Manejo de usuarios con diferentes tipos (solo planilla o planilla + comprobante)
- **📊 Reportes Avanzados**: Filtrado por fechas y usuarios con exportación a Excel/PDF
- **🌙 Tema Oscuro Moderno**: Interface elegante con animaciones y efectos visuales
- **📱 Responsive**: Adaptable a dispositivos móviles y escritorio
- **☁️ Firebase**: Almacenamiento en la nube con respaldo local
- **🔧 Modo Offline**: Funciona sin conexión utilizando localStorage

## 🛠️ Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Framework CSS**: Bootstrap 5
- **Iconos**: Font Awesome
- **Base de Datos**: Firebase Firestore
- **Almacenamiento Local**: localStorage (backup)
- **Hosting**: GitHub Pages

## 🚀 Demo en Vivo

[Ver Aplicación](https://cristian3308.github.io/consolidado-bomba-web)

## 📋 Funcionalidades

### Dashboard
- Resumen de estadísticas
- Cobros recientes
- Totales por período

### Gestión de Cobros
- Formularios dinámicos según tipo de usuario
- Campos para número y fecha de planilla
- Campos para número y fecha de comprobante (cuando aplica)
- Validación de datos

### Reportes
- Filtrado por usuario
- Filtrado por rango de fechas (fecha de planilla/comprobante)
- Exportación a Excel (CSV)
- Exportación a PDF

### Usuarios
- Creación y edición de usuarios
- Tipos: "Solo Planilla" y "Planilla + Comprobante"
- Gestión de información de contacto

## 🔧 Instalación Local

1. Clona el repositorio:
```bash
git clone https://github.com/cristian3308/consolidado-bomba-web.git
cd consolidado-bomba-web
```

2. Configura Firebase (opcional):
   - Edita `firebase-config.js` con tu configuración

3. Ejecuta un servidor local:
```bash
python -m http.server 3000
```

4. Abre http://localhost:3000 en tu navegador

## 📁 Estructura del Proyecto

```
consolidado-bomba-web/
├── index.html           # Página principal
├── app.js              # Lógica de la aplicación
├── styles.css          # Estilos base
├── dark-theme.css      # Tema oscuro
├── firebase-config.js  # Configuración Firebase
├── README.md          # Documentación
└── .nojekyll          # Configuración GitHub Pages
```

## 🎨 Características del Diseño

- **Tema Oscuro**: Colores modernos con excelente contraste
- **Animaciones**: Transiciones suaves y efectos hover
- **Iconografía**: Iconos intuitivos para cada funcionalidad
- **Cards**: Diseño tipo tarjeta con efectos glass
- **Tipografía**: Fuentes legibles y jerárquicas

## 🔐 Credenciales por Defecto

- **Usuario**: admin
- **Contraseña**: admin123

## 📊 Usuarios de Ejemplo

El sistema incluye usuarios de prueba:
- Juan Pérez (Solo Planilla)
- María González (Planilla + Comprobante)
- Carlos López (Solo Planilla)

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu característica
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

## 👨‍💻 Autor

**Cristian** - Desarrollo inicial

## 🐛 Reportar Bugs

Si encuentras algún problema, por favor abre un [issue](https://github.com/cristian3308/consolidado-bomba-web/issues).

---

⭐ Si te gusta este proyecto, dale una estrella en GitHub!
