// Algoritmos de optimización

function nearestNeighborTSP(points) {
    if (points.length <= 1) return points;
    
    const visited = new Array(points.length).fill(false);
    const route = [0];
    visited[0] = true;
    let current = 0;
    
    for (let i = 1; i < points.length; i++) {
        let nearest = -1;
        let minDistance = Infinity;
        
        for (let j = 0; j < points.length; j++) {
            if (!visited[j]) {
                const straight = calculateDistance(points[current], points[j]);
                const factor = getUrbanRoadFactor(points[current], points[j]);
                const distance = straight * factor;
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = j;
                }
            }
        }
        
        if (nearest !== -1) {
            route.push(nearest);
            visited[nearest] = true;
            current = nearest;
        }
    }
    
    return route.map(index => points[index]);
}

function tspSolver(points) {
    if (points.length <= 1) return points;
    if (points.length <= 8) return bruteForceTSP(points);
    return twoOptImprove(nearestNeighborTSP(points));
}

function bruteForceTSP(points) {
    const n = points.length;
    let minDistance = Infinity;
    let bestRoute = [];
    
    function permute(arr, l, r) {
        if (l === r) {
            const distance = calculateRouteDistance(arr);
            if (distance < minDistance) {
                minDistance = distance;
                bestRoute = [...arr];
            }
        } else {
            for (let i = l; i <= r; i++) {
                [arr[l], arr[i]] = [arr[i], arr[l]];
                permute(arr, l + 1, r);
                [arr[l], arr[i]] = [arr[i], arr[l]];
            }
        }
    }
    
    function calculateRouteDistance(route) {
        let total = 0;
        for (let i = 0; i < route.length - 1; i++) {
            const straight = calculateDistance(route[i], route[i + 1]);
            const factor = getUrbanRoadFactor(route[i], route[i + 1]);
            total += straight * factor;
        }
        return total;
    }
    
    const indices = Array.from({ length: n }, (_, i) => i);
    permute(indices, 1, n - 1);
    
    return bestRoute.map(index => points[index]);
}

function twoOptImprove(route) {
    let improved = true;
    let bestRoute = [...route];
    let bestDistance = calculateTotalDistance(bestRoute);
    
    while (improved) {
        improved = false;
        
        for (let i = 1; i < route.length - 2; i++) {
            for (let j = i + 1; j < route.length; j++) {
                if (j - i === 1) continue;
                
                const newRoute = twoOptSwap(route, i, j);
                const newDistance = calculateTotalDistance(newRoute);
                
                if (newDistance < bestDistance) {
                    bestRoute = newRoute;
                    bestDistance = newDistance;
                    improved = true;
                }
            }
        }
        route = bestRoute;
    }
    
    return bestRoute;
}

function twoOptSwap(route, i, j) {
    const newRoute = [...route];
    while (i < j) {
        [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
        i++;
        j--;
    }
    return newRoute;
}

function geneticAlgorithm(points) {
    if (points.length <= 1) return points;
    
    const populationSize = Math.min(100, points.length * 4);
    const generations = Math.min(500, points.length * 10);
    const mutationRate = 0.1;
    
    function createRandomRoute() {
        const route = [...points];
        for (let i = route.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [route[i], route[j]] = [route[j], route[i]];
        }
        return route;
    }
    
    function calculateFitness(route) {
        const distance = calculateTotalDistance(route);
        return 1 / (1 + distance);
    }
    
    // Generar población inicial
    let population = [];
    for (let i = 0; i < populationSize; i++) {
        population.push(createRandomRoute());
    }
    
    // Evolución básica
    for (let gen = 0; gen < Math.min(generations, 50); gen++) {
        const fitness = population.map(calculateFitness);
        const bestIndex = fitness.indexOf(Math.max(...fitness));
        
        // Mantener el mejor
        const newPopulation = [population[bestIndex]];
        
        // Llenar resto con mutaciones del mejor
        while (newPopulation.length < populationSize) {
            const mutated = [...population[bestIndex]];
            if (Math.random() < mutationRate) {
                const i = Math.floor(Math.random() * mutated.length);
                const j = Math.floor(Math.random() * mutated.length);
                [mutated[i], mutated[j]] = [mutated[j], mutated[i]];
            }
            newPopulation.push(mutated);
        }
        
        population = newPopulation;
    }
    
    const finalFitness = population.map(calculateFitness);
    const bestIndex = finalFitness.indexOf(Math.max(...finalFitness));
    return population[bestIndex];
}

// Función principal de optimización
function optimizeRoute() {
    const addresses = circuits[currentCircuit];
    
    if (addresses.length < 2) {
        showError('Necesitas al menos 2 direcciones para optimizar la ruta');
        return;
    }

    showLoading();
    hideError();
    showSuccess('Calculando rutas reales por calles...');

    const algorithm = document.getElementById('algorithmSelect').value;
    let optimizedRoute;

    try {
        if (algorithm === 'nearestNeighbor') {
            optimizedRoute = nearestNeighborTSP(addresses);
        } else if (algorithm === 'genetic') {
            optimizedRoute = geneticAlgorithm(addresses);
        } else {
            optimizedRoute = tspSolver(addresses);
        }

        optimizedRouteData = {
            route: optimizedRoute,
            algorithm: document.getElementById('algorithmSelect').selectedOptions[0].text,
            transport: document.getElementById('transportSelect').selectedOptions[0].text,
            circuitName: currentCircuit,
            optimizationDate: new Date().toISOString()
        };

        showOptimizedRoute(optimizedRoute);
        calculateRouteStats(optimizedRoute);
        
    } catch (error) {
        hideLoading();
        showError('Error al optimizar la ruta: ' + error.message);
        console.error('Error detallado:', error);
    }
}

function calculateRouteStats(route) {
    const resultsDiv = document.getElementById('results');
    
    let totalDistance = 0;
    let totalTime = 0;
    const avgSpeed = getAverageSpeed();
    
    for (let i = 0; i < route.length - 1; i++) {
        const straight = calculateDistance(route[i], route[i + 1]);
        const factor = getUrbanRoadFactor(route[i], route[i + 1]);
        const realDistance = straight * factor;
        const time = (realDistance / avgSpeed) * 60;
        
        totalDistance += realDistance;
        totalTime += time;
    }
    
    let html = `
        <div class="route-info">
            <h4>🎯 Ruta Optimizada para "${currentCircuit}" (Rutas Reales)</h4>
            <p><strong>Algoritmo:</strong> ${document.getElementById('algorithmSelect').selectedOptions[0].text}</p>
            <p><strong>Transporte:</strong> ${document.getElementById('transportSelect').selectedOptions[0].text}</p>
            <p><strong>Total de paradas:</strong> ${route.length}</p>
            <p><strong>🛣️ Cálculo:</strong> Por calles y caminos reales</p>
        </div>
    `;

    html += '<h4>📍 Secuencia Optimizada:</h4>';
    
    let accDistance = 0;
    let accTime = 0;
    
    route.forEach((location, index) => {
        let segmentInfo = '';
        
        if (index < route.length - 1) {
            const straight = calculateDistance(location, route[index + 1]);
            const factor = getUrbanRoadFactor(location, route[index + 1]);
            const distance = straight * factor;
            const time = (distance / avgSpeed) * 60;
            
            accDistance += distance;
            accTime += time;
            
            segmentInfo = `<small style="color: #2d7d32;">
                🛣️ → Siguiente: ${distance.toFixed(2)} km, ${Math.round(time)} min
                <br>📊 Acumulado: ${accDistance.toFixed(2)} km, ${Math.round(accTime)} min
            </small>`;
        }
        
        html += `
            <div class="route-info">
                <strong>Parada ${index + 1}${index === 0 ? ' (🚀 INICIO)' : index === route.length - 1 ? ' (🏁 FIN)' : ''}:</strong><br>
                <span style="font-size: 13px;">${location.address}</span><br>
                ${segmentInfo}
            </div>
        `;
    });

    html += `
        <div class="route-info" style="border-left-color: #48bb78; background: #f0fff4;">
            <h4>📊 Resumen Total (Rutas Reales)</h4>
            <p><strong>🛣️ Distancia Total:</strong> ${totalDistance.toFixed(2)} km (por calles)</p>
            <p><strong>⏱️ Tiempo Total:</strong> ${Math.floor(totalTime / 60)}h ${Math.round(totalTime % 60)}m</p>
            <p><strong>📍 Paradas:</strong> ${route.length} direcciones</p>
            <p><strong>🚗 Velocidad Promedio:</strong> ${avgSpeed} km/h</p>
        </div>
    `;

    resultsDiv.innerHTML = html;
    showSuccess('✅ Ruta optimizada calculada con distancias reales');
}