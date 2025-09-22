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
        parseCSVSchoolFormat(text);
    };
    reader.readAsText(file);
}

function handleKMLFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.kmz')) {
        showError('Los archivos KMZ deben ser descomprimidos primero. Extrae el archivo .kml del .kmz y vuelve a intentar.');
        return;
    }

    showLoading();
    showSuccess('Procesando archivo KML...');

    const reader = new FileReader();
    reader.onload = function(e) {
        parseKMLContent(e.target.result, file.name);
    };
    reader.readAsText(file);
}

function parseCSVSchoolFormat(csvText) {
    try {
        const lines = csvText.trim().split('\n');
        let importCount = 0;
        
        showLoading();
        showSuccess('Procesando CSV con formato de escuelas...');
        
        console.log('Total de líneas en CSV:', lines.length);
        
        lines.forEach((line, index) => {
            if (line.trim().length === 0) return;
            
            console.log(`Procesando línea ${index + 1}: ${line}`);
            
            // Dividir por comas, pero respetando las comas dentro de comillas
            const parts = parseCSVLine(line);
            console.log('Partes encontradas:', parts);
            
            if (parts.length >= 2) {
                let schoolName = parts[0].trim();
                let addressPart = parts[1].trim();
                
                // Si hay más partes, combinar como dirección
                if (parts.length > 2) {
                    addressPart = parts.slice(1).join(', ').trim();
                }
                
                // Limpiar el nombre de la escuela
                schoolName = schoolName.replace(/^["']|["']$/g, '');
                
                // Limpiar y mejorar la dirección
                let cleanAddress = cleanSchoolAddress(addressPart);
                
                console.log(`Escuela: ${schoolName}, Dirección limpia: ${cleanAddress}`);
                
                if (cleanAddress && cleanAddress.length > 5) {
                    // Agregar a lista para geocodificar después
                    schoolAddresses.push({
                        name: schoolName,
                        address: cleanAddress,
                        originalLine: line
                    });
                    importCount++;
                }
            }
        });
        
        if (importCount > 0) {
            showSuccess(`${importCount} escuelas encontradas. Comenzando geocodificación...`);
            geocodeSchoolAddresses(schoolAddresses);
        } else {
            hideLoading();
            showError('No se pudieron interpretar las direcciones del CSV. Verifica el formato.');
        }
        
    } catch (error) {
        hideLoading();
        showError('Error al procesar el archivo CSV: ' + error.message);
        console.error('Error CSV:', error);
    }
}

// Variable temporal para almacenar direcciones de escuelas
let schoolAddresses = [];

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
            continue;
        }
        
        current += char;
    }
    
    if (current) {
        result.push(current);
    }
    
    return result;
}

function cleanSchoolAddress(address) {
    // Remover códigos postales y limpiar la dirección
    let cleaned = address
        .replace(/^["']|["']$/g, '') // Quitar comillas
        .replace(/B\d{4}[A-Z]{0,3}\s*/gi, '') // Quitar códigos postales como B1611BXD
        .replace(/\s*AR\s*$/i, '') // Quitar "AR" al final
        .replace(/,\s*PROVINCIA DE BUENOS AIRES\s*$/i, ', Buenos Aires') // Normalizar provincia
        .replace(/\s*BUENOS AIRES\s*AR\s*$/i, ', Buenos Aires') // Normalizar
        .replace(/,\s*,/g, ',') // Remover comas dobles
        .replace(/^\s*,|,\s*$/g, '') // Remover comas al inicio/final
        .trim();
    
    // Si no tiene localidad, agregar Don Torcuato si parece ser de ahí
    if (!cleaned.match(/(don torcuato|tigre|san isidro|vicente lópez|buenos aires)/i)) {
        // Si tiene pinta de ser del gran Buenos Aires, agregar Don Torcuato
        if (cleaned.match(/(av\.|avenida|gral|general)/i)) {
            cleaned += ', Don Torcuato, Buenos Aires';
        }
    }
    
    return cleaned;
}

async function geocodeSchoolAddresses(schools) {
    let successCount = 0;
    let totalSchools = schools.length;
    
    for (let i = 0; i < schools.length; i++) {
        const school = schools[i];
        
        showSuccess(`Geocodificando ${i + 1}/${totalSchools}: ${school.name}`);
        
        console.log(`Geocodificando: ${school.name} - ${school.address}`);
        
        const result = await geocodeAddress(school.address);
        
        if (result) {
            circuits[currentCircuit].push({
                address: `${school.name}: ${result.display_name}`,
                originalInput: school.originalLine,
                lat: result.lat,
                lng: result.lng
            });
            successCount++;
            console.log(`✅ Geocodificado: ${school.name}`);
        } else {
            console.log(`❌ No se pudo geocodificar: ${school.name} - ${school.address}`);
            
            // Intentar con solo el nombre de la escuela + localidad
            const fallbackAddress = `${school.name}, Don Torcuato, Buenos Aires`;
            const fallbackResult = await geocodeAddress(fallbackAddress);
            
            if (fallbackResult) {
                circuits[currentCircuit].push({
                    address: `${school.name}: ${fallbackResult.display_name} (aproximado)`,
                    originalInput: school.originalLine,
                    lat: fallbackResult.lat,
                    lng: fallbackResult.lng
                });
                successCount++;
                console.log(`✅ Geocodificado (aproximado): ${school.name}`);
            }
        }
        
        // Delay para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Limpiar array temporal
    schoolAddresses = [];
    
    if (successCount > 0) {
        updateAddressesList();
        updateCircuitTabs();
        showAddressesOnMap();
        showSuccess(`✅ ${successCount} de ${totalSchools} escuelas importadas correctamente`);
        optimizedRouteData = null;
    } else {
        showError('No se pudieron importar escuelas. Verifica las direcciones en el CSV.');
    }
    
    hideLoading();
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
        console.log('Iniciando parseo de KML:', fileName);
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
        
        // Verificar errores de parsing
        const parserError = xmlDoc.getElementsByTagName('parsererror');
        if (parserError.length > 0) {
            console.error('Error de parsing XML:', parserError[0].textContent);
            throw new Error('Archivo KML no válido o corrupto');
        }

        console.log('XML parseado correctamente');
        
        // Buscar placemarks
        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        console.log('Placemarks encontrados:', placemarks.length);
        
        if (placemarks.length === 0) {
            // Intentar buscar otros elementos
            const points = xmlDoc.getElementsByTagName('Point');
            const coords = xmlDoc.getElementsByTagName('coordinates');
            console.log('Points encontrados:', points.length);
            console.log('Coordinates encontrados:', coords.length);
            
            if (points.length === 0 && coords.length === 0) {
                throw new Error('No se encontraron puntos o coordenadas en el archivo KML');
            }
        }

        let importCount = 0;

        // Procesar cada placemark
        Array.from(placemarks).forEach((placemark, index) => {
            console.log(`Procesando placemark ${index + 1}`);
            
            const name = getKMLElementText(placemark, 'name') || `Punto ${index + 1}`;
            const description = getKMLElementText(placemark, 'description') || '';
            
            console.log(`Nombre: ${name}, Descripción: ${description}`);
            
            // Buscar coordenadas
            const coordsElement = placemark.getElementsByTagName('coordinates')[0];
            if (coordsElement) {
                const coordsText = coordsElement.textContent.trim();
                console.log(`Coordenadas raw: ${coordsText}`);
                
                const coords = parseKMLCoordinates(coordsText);
                console.log(`Coordenadas parseadas:`, coords);
                
                if (coords) {
                    circuits[currentCircuit].push({
                        address: description || name,
                        originalInput: `${name} (desde KML)`,
                        lat: coords.lat,
                        lng: coords.lng
                    });
                    importCount++;
                    console.log(`✅ Importado: ${name}`);
                } else {
                    console.log(`❌ No se pudieron parsear coordenadas para: ${name}`);
                }
            } else {
                console.log(`❌ No se encontraron coordenadas para: ${name}`);
            }
        });

        console.log(`Total importado: ${importCount}`);

        if (importCount > 0) {
            updateAddressesList();
            updateCircuitTabs();
            showAddressesOnMap();
            showSuccess(`✅ ${importCount} ubicaciones importadas desde ${fileName}`);
            optimizedRouteData = null;
        } else {
            showError('No se encontraron ubicaciones válidas en el archivo KML. Verifica que contenga elementos <Placemark> con <coordinates>.');
        }

    } catch (error) {
        showError('Error al procesar archivo KML: ' + error.message);
        console.error('Error parsing KML:', error);
        console.log('Contenido KML (primeros 500 caracteres):', kmlContent.substring(0, 500));
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
        console.log('Parseando coordenadas:', coordsText);
        
        // KML puede tener múltiples coordenadas separadas por espacios o saltos de línea
        const coordLines = coordsText.split(/\s+/).filter(line => line.trim().length > 0);
        
        for (const coordLine of coordLines) {
            const parts = coordLine.split(',');
            if (parts.length >= 2) {
                const lng = parseFloat(parts[0].trim());
                const lat = parseFloat(parts[1].trim());
                
                console.log(`Intentando parsear: lng=${lng}, lat=${lat}`);
                
                if (!isNaN(lat) && !isNaN(lng) && 
                    lat >= -90 && lat <= 90 && 
                    lng >= -180 && lng <= 180) {
                    console.log(`✅ Coordenadas válidas: ${lat}, ${lng}`);
                    return { lat, lng };
                }
            }
        }
        
        console.log('❌ No se encontraron coordenadas válidas');
        return null;
        
    } catch (error) {
        console.error('Error parsing coordinates:', coordsText, error);
        return null;
    }
}