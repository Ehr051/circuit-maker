// Funciones de utilidad

// Cálculo de distancia entre dos puntos (fórmula de Haversine)
function calculateDistance(point1, point2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Factor de corrección urbana para rutas reales
function getUrbanRoadFactor(point1, point2) {
    const dist1 = calculateDistance(point1, BUENOS_AIRES_CENTER);
    const dist2 = calculateDistance(point2, BUENOS_AIRES_CENTER);
    const avgDistToCenter = (dist1 + dist2) / 2;
    
    if (avgDistToCenter < 5) {
        return URBAN_FACTORS.MICROCENTRO;
    } else if (avgDistToCenter < 15) {
        return URBAN_FACTORS.URBAN;
    } else if (avgDistToCenter < 30) {
        return URBAN_FACTORS.SUBURBAN;
    } else {
        return URBAN_FACTORS.RURAL;
    }
}

// Obtener velocidad promedio según tipo de transporte
function getAverageSpeed() {
    const transport = document.getElementById('transportSelect').value;
    return TRANSPORT_SPEEDS[transport] || 30;
}

// Calcular distancia total de una ruta
function calculateTotalDistance(route) {
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
        const straight = calculateDistance(route[i], route[i + 1]);
        const factor = getUrbanRoadFactor(route[i], route[i + 1]);
        total += straight * factor;
    }
    return total;
}

// Funciones de UI
function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    hideSuccess();
}

function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    hideError();
    setTimeout(hideSuccess, 3000);
}

function hideSuccess() {
    document.getElementById('successMessage').style.display = 'none';
}

// Función para descargar archivos
function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}