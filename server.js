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
app.use((req, res, next) => {
    if (req.path !== '/') return next();

    res.vary('Accept');
    res.set(
        'Link',
        '<https://luxuriouslodgingecuador.com/index.md>; rel="alternate"; type="text/markdown", ' +
        '<https://luxuriouslodgingecuador.com/llms.txt>; rel="describedby"; type="text/plain"'
    );

    const acceptsMarkdown = (req.get('Accept') || '').split(',').some((mediaRange) => {
        const [mediaType, ...parameters] = mediaRange.split(';');
        return mediaType.trim().toLowerCase() === 'text/markdown' &&
            !parameters.some((parameter) => /^q\s*=\s*0(?:\.0*)?$/i.test(parameter.trim()));
    });

    if (req.method === 'GET' && acceptsMarkdown) {
        return res.type('text/markdown').sendFile(
            path.join(__dirname, 'public', 'index.md'),
            (error) => {
                if (error) next(error);
            }
        );
    }

    next();
});
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
    ]
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
        const { suite, checkIn, checkOut, huespedes, motivo, precioTotal } = req.body;

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

app.post('/api/mcp', (req, res) => {
    const request = req.body;
    if (!request || typeof request !== 'object' || Array.isArray(request) ||
        request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
        return res.status(400).json({
            jsonrpc: '2.0',
            id: request && request.id !== undefined ? request.id : null,
            error: { code: -32600, message: 'Invalid Request' }
        });
    }

    const hasId = Object.prototype.hasOwnProperty.call(request, 'id');
    const respond = (result) => res.json({ jsonrpc: '2.0', id: request.id, result });
    const fail = (code, message) => res.json({
        jsonrpc: '2.0',
        id: hasId ? request.id : null,
        error: { code, message }
    });

    if (request.method === 'notifications/initialized') {
        return res.status(202).end();
    }

    if (!hasId) {
        if (request.method.startsWith('notifications/')) return res.status(202).end();
        return fail(-32600, 'Requests must include an id.');
    }
    if (request.method === 'initialize') {
        return respond({
            protocolVersion: '2025-03-26',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'luxurious-lodging-ecuador', version: '1.0.0' }
        });
    }
    if (request.method === 'ping') return respond({});

    if (request.method === 'tools/list') {
        return respond({
            tools: [
                {
                    name: 'get_business_contact',
                    description: 'Returns the public contact channels for Luxurious Lodging Ecuador.',
                    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
                },
                {
                    name: 'list_lodgings',
                    description: 'Lists the public location pages for Luxurious Lodging Ecuador. This does not report live availability.',
                    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
                }
            ]
        });
    }

    if (request.method === 'tools/call') {
        const params = request.params;
        if (!params || typeof params.name !== 'string') {
            return fail(-32602, 'Tool name is required.');
        }

        const toolResults = Object.create(null);
        Object.assign(toolResults, {
            get_business_contact: {
                name: 'Luxurious Lodging Ecuador',
                email: 'lodginglux@gmail.com',
                telephone: '+593986605398',
                whatsapp: 'https://wa.me/593986605398'
            },
            list_lodgings: {
                locations: [
                    { name: 'Quito', url: 'https://luxuriouslodgingecuador.com/suites/quito' },
                    { name: 'Santo Domingo', url: 'https://luxuriouslodgingecuador.com/suites/santo-domingo' },
                    { name: 'Tonsupa', url: 'https://luxuriouslodgingecuador.com/suites/tonsupa' },
                    { name: 'Baños de Agua Santa', url: 'https://luxuriouslodgingecuador.com/suites/banos' }
                ],
                availabilityUrl: 'https://luxuriouslodgingecuador.com/disponibilidad',
                note: 'La disponibilidad debe confirmarse en el calendario o directamente por los canales de contacto.'
            }
        });
        const result = toolResults[params.name];
        if (!result) return fail(-32602, 'Unknown tool.');
        const args = params.arguments;
        if (args !== undefined &&
            (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length > 0)) {
            return fail(-32602, 'This tool does not accept arguments.');
        }

        return respond({
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
            isError: false
        });
    }

    return fail(-32601, 'Method not found.');
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

// Ruta para la página de Historia
app.get('/historia', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'historia.html'));
});

app.get('/aviso-legal', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'aviso-legal.html'));
});

app.get('/disponibilidad', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'disponibilidad.html'));
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