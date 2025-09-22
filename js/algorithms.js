/* algorithms.js - TSP y ruteo por calles con OpenRouteService
   Incluye heurísticos (Nearest Neighbor, Two-Opt) y fallback si no hay API key.
*/

// =======================
// Distancias y factores
// =======================

// Haversine (distancia en línea recta, km)
function calculateDistance(a, b) {
    const R = 6371; // km
    const toRad = v => v * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat/2);
    const sinDLon = Math.sin(dLon/2);
    const c = 2 * Math.asin(Math.sqrt(sinDLat*sinDLat + Math.cos(lat1)*Math.cos(lat2)*sinDLon*sinDLon));
    return R * c;
}

// Factor heurístico (cuando no hay ruteo real)
function getUrbanRoadFactor(a, b) {
    const straight = calculateDistance(a,b);
    if (straight < 0.5) return 1.35;
    if (straight < 2) return 1.25;
    if (straight < 10) return 1.15;
    return 1.05;
}

// =======================
// Algoritmos TSP
// =======================

// Nearest Neighbor
function nearestNeighborTSP(points) {
    if (!points || points.length <= 1) return points.slice();
    const used = new Array(points.length).fill(false);
    let route = [points[0]];
    used[0] = true;
    let currentIndex = 0;
    for (let k = 1; k < points.length; k++) {
        let best = -1, bestDist = Infinity;
        for (let j = 0; j < points.length; j++) {
            if (used[j]) continue;
            const d = calculateDistance(points[currentIndex], points[j]) *
                      getUrbanRoadFactor(points[currentIndex], points[j]);
            if (d < bestDist) { bestDist = d; best = j; }
        }
        if (best >= 0) {
            route.push(points[best]);
            used[best] = true;
            currentIndex = best;
        }
    }
    return route;
}

// Two-Opt (mejora rutas)
function twoOptImprove(route) {
    if (!route || route.length <= 2) return route;
    let improved = true;
    let bestRoute = route.slice();
    let bestDist = calculateTotalDistance(bestRoute);
    while (improved) {
        improved = false;
        for (let i = 1; i < bestRoute.length - 1; i++) {
            for (let j = i+1; j < bestRoute.length; j++) {
                const newRoute = bestRoute.slice(0,i)
                    .concat(bestRoute.slice(i,j+1).reverse(), bestRoute.slice(j+1));
                const newDist = calculateTotalDistance(newRoute);
                if (newDist < bestDist) {
                    bestRoute = newRoute;
                    bestDist = newDist;
                    improved = true;
                }
            }
        }
    }
    return bestRoute;
}

function calculateTotalDistance(route) {
    let total = 0;
    for (let i=0; i<route.length-1; i++) {
        total += calculateDistance(route[i], route[i+1]) *
                 getUrbanRoadFactor(route[i], route[i+1]);
    }
    return total;
}

// Solver TSP simple
function tspSolver(points) {
    if (!points || points.length <= 1) return points.slice();
    if (points.length <= 8) return twoOptImprove(nearestNeighborTSP(points));
    return twoOptImprove(nearestNeighborTSP(points));
}

// =======================
// Ruteo real con ORS
// =======================

async function getRouteByStreets(from, to, profile='driving-car') {
    const apiKey = document.getElementById('orsApiKey')?.value?.trim();
    if (!apiKey) return null; // fallback
    const url = `https://api.openrouteservice.org/v2/directions/${encodeURIComponent(profile)}?api_key=${encodeURIComponent(apiKey)}&start=${from.lng},${from.lat}&end=${to.lng},${to.lat}`;
    try {
        const resp = await fetch(url);
        if (!resp.ok) {
            console.warn('ORS no ok', resp.status);
            return null;
        }
        const body = await resp.json();
        if (body && body.features && body.features.length > 0) {
            const s = body.features[0].properties.summary;
            return { distance: s.distance/1000, duration: s.duration/60 };
        }
    } catch (err) {
        console.error('Error ORS', err);
    }
    return null;
}

// =======================
// Optimización de ruta
// =======================

async function optimizeRoute() {
    const addresses = circuits[currentCircuit];
    if (!addresses || addresses.length < 2) {
        showError('Necesitas al menos 2 direcciones para optimizar la ruta');
        return;
    }
    showLoading(); hideError(); showSuccess('Calculando rutas...');
    const algorithm = document.getElementById('algorithmSelect').value;
    let route = [];
    try {
        if (algorithm === 'nearestNeighbor') route = nearestNeighborTSP(addresses);
        else if (algorithm === 'genetic') route = nearestNeighborTSP(addresses); // placeholder
        else route = tspSolver(addresses);

        // guardar resultado
        optimizedRouteData = {
            route: route,
            algorithm: document.getElementById('algorithmSelect').selectedOptions[0].text,
            transport: document.getElementById('transportSelect').value,
            circuitName: currentCircuit,
            optimizationDate: new Date().toISOString()
        };
        showOptimizedRoute(route);
        await calculateRouteStats(route);
    } catch (err) {
        console.error(err);
        showError('Error al optimizar la ruta: ' + err.message);
    } finally {
        hideLoading();
    }
}

async function calculateRouteStats(route) {
    const resultsDiv = document.getElementById('results');
    let totalDistance = 0, totalTime = 0;
    const profile = document.getElementById('transportSelect').value || 'driving-car';
    const apiKey = document.getElementById('orsApiKey')?.value?.trim();

    for (let i=0; i<route.length-1; i++) {
        let real = null;
        if (apiKey) {
            real = await getRouteByStreets(route[i], route[i+1], profile);
        }
        if (real) {
            totalDistance += real.distance;
            totalTime += real.duration;
        } else {
            const straight = calculateDistance(route[i], route[i+1]);
            const factor = getUrbanRoadFactor(route[i], route[i+1]);
            const d = straight * factor;
            totalDistance += d;
            totalTime += (d / getAverageSpeed()) * 60;
        }
    }

    optimizedRouteData.stats = { distance_km: totalDistance, time_min: totalTime };

    // render resumen
    let html = `<div class="route-info">
        <h4>🎯 Ruta Optimizada para "${currentCircuit}"</h4>
        <p><strong>Algoritmo:</strong> ${optimizedRouteData.algorithm}</p>
        <p><strong>Transporte:</strong> ${document.getElementById('transportSelect').selectedOptions[0].text}</p>
        <p><strong>Total de paradas:</strong> ${route.length}</p>
    </div>`;
    html += `<div class="route-info" style="border-left-color:#48bb78;background:#f0fff4;">
        <h4>📊 Resumen Total</h4>
        <p><strong>🛣️ Distancia Total:</strong> ${totalDistance.toFixed(2)} km</p>
        <p><strong>⏱️ Tiempo Total:</strong> ${Math.floor(totalTime/60)}h ${Math.round(totalTime%60)}m</p>
    </div>`;
    resultsDiv.innerHTML = html;
    showSuccess('✅ Ruta optimizada calculada con distancias reales (cuando ORS disponible)');
}

// =======================
// Velocidades promedio
// =======================

function getAverageSpeed() {
    const t = document.getElementById('transportSelect')?.value || 'driving-car';
    if (t.startsWith('driving')) return 40;
    if (t.startsWith('cycling')) return 18;
    if (t.startsWith('foot')) return 5;
    return 40;
}
