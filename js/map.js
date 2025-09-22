// Funciones de manejo del mapa

function initMap() {
    map = L.map('map').setView([BUENOS_AIRES_CENTER.lat, BUENOS_AIRES_CENTER.lng], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

function showAddressesOnMap() {
    clearMarkers();
    

    circuits[currentCircuit].forEach((location, index) => {
        const marker = L.marker([location.lat, location.lng], { draggable: true })
            .addTo(map)
            .bindPopup(`${index + 1}. ${location.address}`);

        const icon = L.divIcon({
            html: `<div style="background: #667eea; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${index + 1}</div>`,
            className: 'custom-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        marker.setIcon(icon);
        markers.push(marker);

        // Hacer el marcador editable/arrastrable
        marker.on('dragend', function(e) {
            const newLatLng = e.target.getLatLng();
            location.lat = newLatLng.lat;
            location.lng = newLatLng.lng;
            updateAddressesList();
            showAddressesOnMap();
            showSuccess("📍 Punto actualizado manualmente en el mapa");
        });
    });

    if (circuits[currentCircuit].length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

function showOptimizedRoute(route) {
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }

    const coordinates = route.map(point => [point.lat, point.lng]);
    
    routeLayer = L.polyline(coordinates, {
        color: '#667eea',
        weight: 4,
        opacity: 0.8
    }).addTo(map);

    clearMarkers();
    
    route.forEach((location, index) => {
        const marker = L.marker([location.lat, location.lng])
            .addTo(map)
            .bindPopup(`${index + 1}. ${location.address}`);
        
        const icon = L.divIcon({
            html: `<div style="background: ${index === 0 ? '#48bb78' : index === route.length - 1 ? '#f56565' : '#667eea'}; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${index + 1}</div>`,
            className: 'custom-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        marker.setIcon(icon);
        markers.push(marker);
    });

    if (route.length > 0) {
        const group = new L.featureGroup([routeLayer, ...markers]);
        map.fitBounds(group.getBounds().pad(0.1));
    }

    hideLoading();
}

function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function clearMap() {
    clearMarkers();
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
}

