const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CONFIGURACIÓN DE SEGURIDAD Y MIDDLEWARES
// ==========================================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Función helper para limpiar y sanitizar texto (Protección anti-XSS)
const sanitizeText = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/[<>]/g, '').trim();
};

// ==========================================
// 2. BASE DE DATOS EN MEMORIA (LUXURIOUS)
// ==========================================
const database = {
    reservas: [
        {
            id: "LUX-1001",
            suite: "Suite Cueva De Lujo",
            checkIn: "2026-11-01",
            checkOut: "2026-11-03",
            huespedes: "2 Huéspedes (Pareja)",
            motivo: "Escapada Romántica",
            precioTotal: 138.00,
            estado: "Confirmada",
            fechaCreacion: new Date()
        }
    ],
    reseñas: [
        {
            id: "REV-101",
            nombre: "Sofía Arboleda",
            calificacion: 5,
            suite: "Suite Cueva De Lujo",
            comentario: "Una experiencia inigualable en Luxurious. El jacuzzi tipo cueva y la privacidad son excelentes.",
            fecha: "2026-10-15"
        },
        {
            id: "REV-102",
            nombre: "Mateo Torres",
            calificacion: 5,
            suite: "Suite Premium Jacuzzi Piedra",
            comentario: "Atención impecable. La iluminación cálida y la cascada crean una atmósfera de desconexión total.",
            fecha: "2026-10-20"
        }
    ],
    cupones: {
        "LUXURIOUS10": 0.10, // 10% de descuento
        "BIENVENIDO15": 0.15  // 15% de descuento
    }
};

// ==========================================
// 3. ENDPOINTS API (RUTAS DEL BACKEND)
// ==========================================

// A. Verificar estado del servidor
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', proyecto: 'Luxurious', timestamp: new Date() });
});

// B. Obtener todas las reservas (para calendario y administración)
app.get('/api/bookings', (req, res) => {
    res.json({
        success: true,
        count: database.reservas.length,
        reservas: database.reservas
    });
});

// C. Crear una nueva reserva
app.post('/api/bookings', (req, res) => {
    try {
        const { suite, checkIn, checkOut, huespedes, motivo, precioTotal, cupon } = req.body;

        // Validaciones básicas de backend
        if (!suite || !checkIn || !checkOut || !precioTotal) {
            return res.status(400).json({ 
                success: false, 
                mensaje: 'Por favor completa todos los campos requeridos.' 
            });
        }

        // Generar ID único de reserva
        const nuevaReserva = {
            id: `LUX-${Math.floor(1000 + Math.random() * 9000)}`,
            suite: sanitizeText(suite),
            checkIn: sanitizeText(checkIn),
            checkOut: sanitizeText(checkOut),
            huespedes: sanitizeText(huespedes || '2 Huéspedes'),
            motivo: sanitizeText(motivo || 'Escapada'),
            precioTotal: parseFloat(precioTotal),
            cuponAplicado: sanitizeText(cupon || 'Ninguno'),
            estado: 'Pendiente',
            fechaCreacion: new Date()
        };

        database.reservas.push(nuevaReserva);

        console.log(`📌 [NUEVA RESERVA REGISTRADA]: ID ${nuevaReserva.id} para ${nuevaReserva.suite}`);

        res.status(201).json({
            success: true,
            mensaje: 'Reserva registrada exitosamente en el servidor de Luxurious',
            reserva: nuevaReserva
        });

    } catch (error) {
        res.status(500).json({ success: false, mensaje: 'Error interno del servidor al procesar la reserva.' });
    }
});

// D. Obtener reseñas públicas
app.get('/api/reviews', (req, res) => {
    res.json({
        success: true,
        count: database.reseñas.length,
        reseñas: database.reseñas
    });
});

// E. Publicar una nueva reseña (con seguridad anti-XSS)
app.post('/api/reviews', (req, res) => {
    try {
        const { nombre, calificacion, suite, comentario } = req.body;

        if (!nombre || !comentario || !calificacion) {
            return res.status(400).json({ 
                success: false, 
                mensaje: 'Por favor completa tu nombre, calificación y opinión.' 
            });
        }

        const nuevaReseña = {
            id: `REV-${Math.floor(100 + Math.random() * 900)}`,
            nombre: sanitizeText(nombre),
            calificacion: parseInt(calificacion) || 5,
            suite: sanitizeText(suite || 'Suite General'),
            comentario: sanitizeText(comentario),
            fecha: new Date().toISOString().split('T')[0]
        };

        database.reseñas.unshift(nuevaReseña); // Agregar al principio

        res.status(201).json({
            success: true,
            mensaje: 'Reseña publicada con éxito.',
            reseña: nuevaReseña
        });

    } catch (error) {
        res.status(500).json({ success: false, mensaje: 'Error al publicar la reseña.' });
    }
});

// F. Validar cupón de descuento
app.post('/api/coupons/validate', (req, res) => {
    const { cupon } = req.body;
    const codigoSanitizado = sanitizeText(cupon).toUpperCase();

    if (database.cupones[codigoSanitizado]) {
        res.json({
            valid: true,
            descuento: database.cupones[codigoSanitizado],
            mensaje: `¡Cupón ${codigoSanitizado} aplicado con éxito!`
        });
    } else {
        res.json({
            valid: false,
            descuento: 0,
            mensaje: 'El cupón ingresado no es válido o ya ha expirado.'
        });
    }
});

// Ruta para la página de Historia
app.get('/historia', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'historia.html'));
});

// Rutas para las 4 sedes
app.get('/suites/quito', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'suites', 'quito.html'));
});

app.get('/suites/santo-domingo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'suites', 'santo-domingo.html'));
});

app.get('/suites/tonsupa', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'suites', 'tonsupa.html'));
});

app.get('/suites/banos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'suites', 'banos.html'));
});

// Arrancar el servidor
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`Luxurious API activa en: http://localhost:${PORT}`);
    console.log(`=================================`);
});