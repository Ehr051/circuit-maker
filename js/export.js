// Funciones de exportación

function exportToExcel() {
    if (!optimizedRouteData || !optimizedRouteData.route || optimizedRouteData.route.length === 0) {
        showError('Primero debes optimizar una ruta antes de exportar');
        return;
    }

    const route = optimizedRouteData.route;
    const avgSpeed = getAverageSpeed();
    
    const excelData = [];
    let totalDistance = 0;
    let totalTime = 0;

    // Encabezados
    excelData.push([
        'Orden',
        'Dirección',
        'Latitud',
        'Longitud',
        'Distancia al Siguiente (km)',
        'Tiempo al Siguiente (min)',
        'Distancia Acumulada (km)',
        'Tiempo Acumulado (min)'
    ]);

    // Datos de cada parada
    route.forEach((location, index) => {
        let distanceToNext = 0;
        let timeToNext = 0;
        
        if (index < route.length - 1) {
            const straight = calculateDistance(location, route[index + 1]);
            const factor = getUrbanRoadFactor(location, route[index + 1]);
            distanceToNext = straight * factor;
            timeToNext = (distanceToNext / avgSpeed) * 60;
            totalDistance += distanceToNext;
            totalTime += timeToNext;
        }

        excelData.push([
            index + 1,
            location.address,
            location.lat.toFixed(6),
            location.lng.toFixed(6),
            distanceToNext.toFixed(2),
            timeToNext.toFixed(0),
            totalDistance.toFixed(2),
            totalTime.toFixed(0)
        ]);
    });

    // Agregar filas de resumen
    excelData.push([]);
    excelData.push(['RESUMEN DEL CIRCUITO']);
    excelData.push(['Circuito:', currentCircuit]);
    excelData.push(['Algoritmo:', optimizedRouteData.algorithm]);
    excelData.push(['Tipo de Transporte:', optimizedRouteData.transport]);
    excelData.push(['Total de Paradas:', route.length]);
    excelData.push(['Distancia Total (km):', totalDistance.toFixed(2)]);
    excelData.push(['Tiempo Total (horas):', (totalTime / 60).toFixed(2)]);
    excelData.push(['Velocidad Promedio (km/h):', avgSpeed]);
    excelData.push(['Fecha de Optimización:', new Date(optimizedRouteData.optimizationDate).toLocaleString()]);

    // Crear libro de Excel
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);

    // Configurar ancho de columnas
    const columnWidths = [
        { wch: 8 },  // Orden
        { wch: 50 }, // Dirección
        { wch: 12 }, // Latitud
        { wch: 12 }, // Longitud
        { wch: 20 }, // Distancia al Siguiente
        { wch: 20 }, // Tiempo al Siguiente
        { wch: 20 }, // Distancia Acumulada
        { wch: 20 }  // Tiempo Acumulado
    ];
    worksheet['!cols'] = columnWidths;

    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ruta Optimizada');

    // Crear hoja adicional con coordenadas para GPS
    const gpsData = [
        ['Orden', 'Nombre', 'Latitud', 'Longitud'],
        ...route.map((location, index) => [
            index + 1,
            `Parada ${index + 1}`,
            location.lat.toFixed(6),
            location.lng.toFixed(6)
        ])
    ];
    
    const gpsWorksheet = XLSX.utils.aoa_to_sheet(gpsData);
    XLSX.utils.book_append_sheet(workbook, gpsWorksheet, 'Coordenadas GPS');

    // Generar y descargar archivo
    const fileName = `Circuito_${currentCircuit.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    showSuccess('Archivo Excel exportado correctamente');
}

function exportToJSON() {
    const route = optimizedRouteData?.route || circuits[currentCircuit];
    
    if (route.length === 0) {
        showError('No hay datos para exportar');
        return;
    }

    const exportData = {
        circuitInfo: {
            name: currentCircuit,
            totalStops: route.length,
            optimizationDate: new Date().toISOString()
        },
        route: route.map((location, index) => ({
            order: index + 1,
            address: location.address,
            coordinates: {
                lat: location.lat,
                lng: location.lng
            }
        }))
    };

    downloadFile(JSON.stringify(exportData, null, 2), 
                 `Circuito_${currentCircuit.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`, 
                 'application/json');
    
    showSuccess('Archivo JSON exportado correctamente');
}

function exportToCSV() {
    const route = optimizedRouteData?.route || circuits[currentCircuit];
    
    if (route.length === 0) {
        showError('No hay datos para exportar');
        return;
    }

    let csvContent = 'Orden,Nombre,Dirección,Latitud,Longitud,Distancia_Siguiente_km,Tiempo_Siguiente_min\n';
    
    route.forEach((location, index) => {
        const name = `Parada_${index + 1}`;
        const cleanAddress = location.address.replace(/"/g, '""');
        
        let distanceToNext = 0;
        let timeToNext = 0;
        
        if (index < route.length - 1) {
            const straight = calculateDistance(location, route[index + 1]);
            const factor = getUrbanRoadFactor(location, route[index + 1]);
            distanceToNext = straight * factor;
            timeToNext = (distanceToNext / getAverageSpeed()) * 60;
        }

        csvContent += `${index + 1},"${name}","${cleanAddress}",${location.lat.toFixed(6)},${location.lng.toFixed(6)},${distanceToNext.toFixed(2)},${timeToNext.toFixed(0)}\n`;
    });

    downloadFile(csvContent, 
                 `Circuito_${currentCircuit.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`, 
                 'text/csv');
    
    showSuccess('Archivo CSV con coordenadas y distancias exportado correctamente');
}

function exportToKML() {
    const route = optimizedRouteData?.route || circuits[currentCircuit];
    
    if (route.length === 0) {
        showError('No hay datos para exportar');
        return;
    }

    const isOptimized = optimizedRouteData && optimizedRouteData.route;
    const kmlContent = generateKMLContent(route, isOptimized);
    
    const fileName = `${currentCircuit.replace(/\s+/g, '_')}_${isOptimized ? 'optimizado' : 'direcciones'}_${new Date().toISOString().split('T')[0]}.kml`;
    downloadFile(kmlContent, fileName, 'application/vnd.google-earth.kml+xml');
    showSuccess('Archivo KML exportado correctamente. Se puede abrir en Google Earth.');
}

function generateKMLContent(route, isOptimized) {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>${currentCircuit}${isOptimized ? ' - Ruta Optimizada' : ' - Direcciones'}</name>
        <description>Exportado desde Optimizador de Rutas Escolares el ${new Date().toLocaleDateString()}</description>
        
        <!-- Estilos -->
        <Style id="startPoint">
            <IconStyle>
                <color>ff00ff00</color>
                <scale>1.2</scale>
                <Icon>
                    <href>http://maps.google.com/mapfiles/kml/pushpin/grn-pushpin.png</href>
                </Icon>
            </IconStyle>
        </Style>
        
        <Style id="endPoint">
            <IconStyle>
                <color>ff0000ff</color>
                <scale>1.2</scale>
                <Icon>
                    <href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href>
                </Icon>
            </IconStyle>
        </Style>
        
        <Style id="waypoint">
            <IconStyle>
                <color>ffff0000</color>
                <scale>1.0</scale>
                <Icon>
                    <href>http://maps.google.com/mapfiles/kml/pushpin/blue-pushpin.png</href>
                </Icon>
            </IconStyle>
        </Style>
        
        <Style id="routeLine">
            <LineStyle>
                <color>ff0066cc</color>
                <width>3</width>
            </LineStyle>
        </Style>

        <Folder>
            <name>Puntos de Parada</name>
            <description>Ubicaciones del circuito ${isOptimized ? 'en orden optimizado' : ''}</description>
`;

    // Agregar puntos
    route.forEach((location, index) => {
        let styleId = 'waypoint';
        let pointType = 'Parada';
        
        if (isOptimized) {
            if (index === 0) {
                styleId = 'startPoint';
                pointType = 'INICIO';
            } else if (index === route.length - 1) {
                styleId = 'endPoint';
                pointType = 'FIN';
            }
        }

        let description = `Tipo: ${pointType}\\nDirección: ${location.address}`;
        
        if (isOptimized && index < route.length - 1) {
            const straight = calculateDistance(location, route[index + 1]);
            const factor = getUrbanRoadFactor(location, route[index + 1]);
            const distance = (straight * factor).toFixed(2);
            const time = ((straight * factor / getAverageSpeed()) * 60).toFixed(0);
            description += `\\nHasta siguiente: ${distance} km, ${time} min`;
        }

        kml += `            <Placemark>
                <name>${pointType} ${index + 1}</name>
                <description><![CDATA[${description}]]></description>
                <styleUrl>#${styleId}</styleUrl>
                <Point>
                    <coordinates>${location.lng.toFixed(6)},${location.lat.toFixed(6)},0</coordinates>
                </Point>
            </Placemark>
`;
    });

    kml += `        </Folder>
`;

    // Si es ruta optimizada, agregar línea de ruta
    if (isOptimized && route.length > 1) {
        kml += `        <Placemark>
            <name>Ruta Optimizada</name>
            <description>Recorrido optimizado del circuito</description>
            <styleUrl>#routeLine</styleUrl>
            <LineString>
                <tessellate>1</tessellate>
                <coordinates>
`;
        route.forEach(location => {
            kml += `                    ${location.lng.toFixed(6)},${location.lat.toFixed(6)},0\n`;
        });

        kml += `                </coordinates>
            </LineString>
        </Placemark>
`;
    }

    kml += `    </Document>
</kml>`;

    return kml;
}