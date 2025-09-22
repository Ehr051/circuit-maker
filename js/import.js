// Funciones de importación

function loadFromText() {
    document.getElementById('textFileInput').click();
}

function loadFromCSV() {
    document.getElementById('csvFileInput').click();
}

function loadFromKML() {
    document.getElementById('kmlFileInput').click();
}

function handleTextFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const addresses = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        if (addresses.length > 40) {
            showError('Máximo 40 direcciones por circuito');
            return;
        }

        showLoading();
        await geocodeAddresses(addresses);
        hideLoading();
    };
    reader.readAsText(file);
}

function handleCSVFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        parseCSVWithCoordinates(text);
    };
    reader.readAsText(file);
}

function handleKMLFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading();
    showSuccess('Procesando archivo KML...');

    const reader = new FileReader();
    reader.onload = function(e) {
        parseKMLContent(e.target.result, file.name);
    };
    reader.readAsText(file);
}

function parseCSVWithCoordinates(csvText) {
    try {
        const lines = csvText.trim().split('\n');
        let importCount = 0;
        
        lines.forEach((line, index) => {
            const parts = line.split(',').map(part => part.trim().replace(/^["']|["']$/g, ''));
            
            if (parts.length >= 3) {
                let name, address, lat, lng;
                
                if (parts.length === 3) {
                    [address, lat, lng] = parts;
                    name = `Punto ${index + 1}`;
                } else {
                    [name, address, lat, lng] = parts;
                }
                
                const latitude = parseFloat(lat);
                const longitude = parseFloat(lng);
                
                if (!isNaN(latitude) && !isNaN(longitude) && 
                    latitude >= -90 && latitude <= 90 && 
                    longitude >= -180 && longitude <= 180) {
                    
                    circuits[currentCircuit].push({
                        address: address || name,
                        originalInput: `${name}: ${address}`,
                        lat: latitude,
                        lng: longitude
                    });
                    importCount++;
                }
            }
        });
        
        if (importCount > 0) {
            updateAddressesList();
            updateCircuitTabs();
            showAddressesOnMap();
            showSuccess(`✅ ${importCount} ubicaciones importadas desde CSV`);
            optimizedRouteData = null;
        } else {
            showError('No se pudieron importar ubicaciones. Verifica el formato del CSV.');
        }
        
    } catch (error) {
        showError('Error al procesar el archivo CSV: ' + error.message);
        console.error('Error CSV:', error);
    }
}

function parseKMLContent(kmlContent, fileName) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
        
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('Archivo KML no válido');
        }

        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        let importCount = 0;

        Array.from(placemarks).forEach((placemark, index) => {
            const name = getKMLElementText(placemark, 'name') || `Punto ${index + 1}`;
            const description = getKMLElementText(placemark, 'description') || '';
            
            const coordsElement = placemark.getElementsByTagName('coordinates')[0];
            if (coordsElement) {
                const coordsText = coordsElement.textContent.trim();
                const coords = parseKMLCoordinates(coordsText);
                
                if (coords) {
                    circuits[currentCircuit].push({
                        address: description || name,
                        originalInput: `${name} (desde KML)`,
                        lat: coords.lat,
                        lng: coords.lng
                    });
                    importCount++;
                }
            }
        });

        if (importCount > 0) {
            updateAddressesList();
            updateCircuitTabs();
            showAddressesOnMap();
            showSuccess(`✅ ${importCount} ubicaciones importadas desde ${fileName}`);
            optimizedRouteData = null;
        } else {
            showError('No se encontraron ubicaciones válidas en el archivo KML.');
        }

    } catch (error) {
        showError('Error al procesar archivo KML: ' + error.message);
        console.error('Error parsing KML:', error);
    } finally {
        hideLoading();
    }
}

function getKMLElementText(parent, tagName) {
    const element = parent.getElementsByTagName(tagName)[0];
    return element ? element.textContent.trim() : '';
}

function parseKMLCoordinates(coordsText) {
    try {
        const parts = coordsText.split(',');
        if (parts.length >= 2) {
            const lng = parseFloat(parts[0].trim());
            const lat = parseFloat(parts[1].trim());
            
            if (!isNaN(lat) && !isNaN(lng) && 
                lat >= -90 && lat <= 90 && 
                lng >= -180 && lng <= 180) {
                return { lat, lng };
            }
        }
    } catch (error) {
        console.error('Error parsing coordinates:', coordsText, error);
    }
    return null;
}