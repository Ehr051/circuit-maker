/* export.js - export completo: XLSX (sheetjs), JSON, CSV, KML, KMZ */

function exportToExcel() {
    if (!optimizedRouteData || !optimizedRouteData.route || optimizedRouteData.route.length === 0) {
        showError('Primero debes optimizar una ruta antes de exportar');
        return;
    }
    const route = optimizedRouteData.route;
    const avgSpeed = getAverageSpeed();
    const excelData = [[
        'Orden','Dirección','Latitud','Longitud',
        'Distancia al Siguiente (km)','Tiempo al Siguiente (min)',
        'Distancia Acumulada (km)','Tiempo Acumulado (min)'
    ]];
    let totalDistance = 0, totalTime = 0;
    route.forEach((location, index) => {
        let distanceToNext = 0, timeToNext = 0;
        if (index < route.length-1) {
            const straight = calculateDistance(location, route[index+1]);
            const factor = getUrbanRoadFactor(location, route[index+1]);
            distanceToNext = straight * factor;
            timeToNext = (distanceToNext/avgSpeed)*60;
            totalDistance += distanceToNext; totalTime += timeToNext;
        }
        excelData.push([
            index+1, location.address,
            location.lat.toFixed(6), location.lng.toFixed(6),
            distanceToNext.toFixed(2), timeToNext.toFixed(0),
            totalDistance.toFixed(2), totalTime.toFixed(0)
        ]);
    });
    // resumen
    excelData.push([]);
    excelData.push(['RESUMEN DEL CIRCUITO']);
    excelData.push(['Circuito:', currentCircuit]);
    excelData.push(['Algoritmo:', optimizedRouteData.algorithm]);
    excelData.push(['Total de Paradas:', route.length]);
    excelData.push(['Distancia Total (km):', totalDistance.toFixed(2)]);
    excelData.push(['Tiempo Total (horas):', (totalTime/60).toFixed(2)]);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    worksheet['!cols'] = [
        {wch:8},{wch:50},{wch:12},{wch:12},
        {wch:20},{wch:20},{wch:20},{wch:20}
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ruta Optimizada');
    // hoja GPS
    const gpsData = [['Orden','Nombre','Latitud','Longitud'],
        ...route.map((loc,i)=>[i+1,'Parada '+(i+1),loc.lat.toFixed(6),loc.lng.toFixed(6)])];
    const gpsWs = XLSX.utils.aoa_to_sheet(gpsData);
    XLSX.utils.book_append_sheet(workbook, gpsWs, 'Coordenadas GPS');

    const fileName = `Circuito_${currentCircuit.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    showSuccess('Archivo Excel exportado correctamente');
}

function exportToJSON() {
    const route = optimizedRouteData?.route || circuits[currentCircuit];
    if (!route || route.length===0) { showError('No hay datos para exportar'); return; }
    const exportData = {
        circuitInfo:{
            name: currentCircuit,
            totalStops: route.length,
            optimizationDate: new Date().toISOString()
        },
        route: route.map((location,index)=>({
            order:index+1,
            address:location.address,
            coordinates:{ lat: location.lat, lng: location.lng }
        }))
    };
    downloadFile(JSON.stringify(exportData, null, 2),
        `Circuito_${currentCircuit.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.json`,
        'application/json');
    showSuccess('Archivo JSON exportado correctamente');
}

function exportToCSV() {
    const route = optimizedRouteData?.route || circuits[currentCircuit];
    if (!route || route.length===0) { showError('No hay datos para exportar'); return; }
    let csv = 'Orden,Nombre,Dirección,Latitud,Longitud,Distancia_Siguiente_km,Tiempo_Siguiente_min\n';
    route.forEach((location,index)=>{
        const name = `Parada_${index+1}`;
        const addr = (location.address || '').replace(/"/g,'""');
        let distanceToNext = 0, timeToNext = 0;
        if (index<route.length-1) {
            const straight = calculateDistance(location, route[index+1]);
            const factor = getUrbanRoadFactor(location, route[index+1]);
            distanceToNext = straight*factor;
            timeToNext = (distanceToNext/getAverageSpeed())*60;
        }
        csv += `${index+1},"${name}","${addr}",${location.lat.toFixed(6)},${location.lng.toFixed(6)},${distanceToNext.toFixed(2)},${timeToNext.toFixed(0)}\n`;
    });
    downloadFile(csv,
        `Circuito_${currentCircuit.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.csv`,
        'text/csv');
    showSuccess('Archivo CSV con coordenadas y distancias exportado correctamente');
}

function exportToKML() {
    const route = optimizedRouteData?.route || circuits[currentCircuit];
    if (!route || route.length===0) { showError('No hay datos para exportar'); return; }
    const isOpt = !!optimizedRouteData;
    const kmlContent = generateKMLContent(route, isOpt);
    const fileName = `${currentCircuit.replace(/\s+/g,'_')}_${isOpt?'optimizado':'direcciones'}_${new Date().toISOString().split('T')[0]}.kml`;
    downloadFile(kmlContent, fileName, 'application/vnd.google-earth.kml+xml');
    showSuccess('Archivo KML exportado correctamente. Se puede abrir en Google Earth.');
}

async function exportToKMZ() {
    const route = optimizedRouteData?.route || circuits[currentCircuit];
    if (!route || route.length===0) { showError('No hay datos para exportar'); return; }
    const kmlContent = generateKMLContent(route, !!optimizedRouteData);
    const zip = new JSZip();
    zip.file('doc.kml', kmlContent);
    const blob = await zip.generateAsync({ type: 'blob' });
    const fileName = `${currentCircuit.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.kmz`;
    downloadFile(blob, fileName, 'application/vnd.google-earth.kmz');
    showSuccess('Archivo KMZ exportado correctamente.');
}

// helper: download blob/text
function downloadFile(content, fileName, mime='text/plain') {
    if (content instanceof Blob) {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
    } else {
        const blob = new Blob([content], { type: mime });
        downloadFile(blob, fileName, mime);
    }
}

// generateKMLContent
function generateKMLContent(route, isOptimized) {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
    <name>${escapeXml(currentCircuit)}${isOptimized?' - Ruta Optimizada':''}</name>
    <description>Exportado desde Optimizador de Rutas - ${new Date().toLocaleDateString()}</description>
    <Style id="startPoint"><IconStyle><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/pushpin/grn-pushpin.png</href></Icon></IconStyle></Style>
    <Style id="endPoint"><IconStyle><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href></Icon></IconStyle></Style>
    <Style id="waypoint"><IconStyle><scale>1</scale><Icon><href>http://maps.google.com/mapfiles/kml/pushpin/blue-pushpin.png</href></Icon></IconStyle></Style>
    <Style id="routeLine"><LineStyle><width>3</width></LineStyle></Style>
    <Folder><name>Puntos de Parada</name><description>Ubicaciones del circuito ${isOptimized?'en orden optimizado':''}</description>
`;
    route.forEach((location, index)=>{
        let style = 'waypoint'; let pt = 'Parada';
        if (isOptimized) {
            if (index===0) { style='startPoint'; pt='INICIO'; }
            else if (index===route.length-1) { style='endPoint'; pt='FIN'; }
        }
        let desc = `Tipo: ${pt}\nDirección: ${escapeXml(location.address || '')}`;
        kml += `<Placemark><name>${pt} ${index+1}</name><description><![CDATA[${desc}]]></description><styleUrl>#${style}</styleUrl><Point><coordinates>${location.lng.toFixed(6)},${location.lat.toFixed(6)},0</coordinates></Point></Placemark>\n`;
    });
    if (isOptimized && route.length>1) {
        kml += `<Placemark><name>Ruta Optimizada</name><styleUrl>#routeLine</styleUrl><LineString><tessellate>1</tessellate><coordinates>\n`;
        route.forEach(loc => { kml += `${loc.lng.toFixed(6)},${loc.lat.toFixed(6)},0\n`; });
        kml += `</coordinates></LineString></Placemark>\n`;
    }
    kml += `</Folder></Document></kml>`;
    return kml;
}

function escapeXml(unsafe) {
    return (unsafe||'').replace(/[<>&'"]/g, function(c){
        return {'<':'&lt;','>':'&gt;','&':'&amp;','\'':'&apos;','"':'&quot;'}[c];
    });
}
