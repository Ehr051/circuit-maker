// Variables globales y configuración
let map;
let circuits = { 'Circuito 1': [] };
let currentCircuit = 'Circuito 1';
let markers = [];
let routeLayer = null;
let optimizedRouteData = null;

// Configuración de APIs
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Configuración de velocidades por tipo de transporte
const TRANSPORT_SPEEDS = {
    'driving-car': 30,
    'driving-hgv': 25,
    'cycling-regular': 15,
    'foot-walking': 5
};

// Configuración de factores de corrección urbana
const URBAN_FACTORS = {
    MICROCENTRO: 1.6,
    URBAN: 1.4,
    SUBURBAN: 1.3,
    RURAL: 1.2
};

// Coordenadas del centro de Buenos Aires
const BUENOS_AIRES_CENTER = { lat: -34.6037, lng: -58.3816 };