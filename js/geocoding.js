// Funciones de geocodificación

async function geocodeAddress(address) {
    const headers = {
        'User-Agent': 'RouteOptimizer/1.0',
        'Accept': 'application/json'
    };

    try {
        console.log('Geocodificando dirección:', address);
        
        const cleanAddress = cleanAddressInput(address);
        console.log('Dirección limpia:', cleanAddress);
        
        let response = await fetch(`${NOMINATIM_URL}?format=json&q=${encodeURIComponent(cleanAddress)}&limit=3&countrycodes=ar&addressdetails=1`, {
            headers: headers
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Respuesta Nominatim:', data);
            
            if (data && data.length > 0) {
                const bestMatch = findBestMatch(data, address);
                if (bestMatch) {
                    return {
                        lat: parseFloat(bestMatch.lat),
                        lng: parseFloat(bestMatch.lon),
                        display_name: bestMatch.display_name
                    };
                }
            }
        }

        const variations = getAddressVariations(address);
        console.log('Probando variaciones:', variations);
        
        for (const variation of variations) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            response = await fetch(`${NOMINATIM_URL}?format=json&q=${encodeURIComponent(variation)}&limit=2&countrycodes=ar&addressdetails=1`, {
                headers: headers
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`Respuesta para "${variation}":`, data);
                
                if (data && data.length > 0) {
                    return {
                        lat: parseFloat(data[0].lat),
                        lng: parseFloat(data[0].lon),
                        display_name: data[0].display_name
                    };
                }
            }
        }

        console.error('No se pudo geocodificar la dirección:', address);
        return null;
        
    } catch (error) {
        console.error('Error en geocodificación:', error);
        return null;
    }
}

function cleanAddressInput(address) {
    return address
        .replace(/,\s*provincia de buenos aires/i, ', Buenos Aires')
        .replace(/,\s*buenos aires\s*,/i, ', Buenos Aires,')
        .replace(/\bgral\b/gi, 'General')
        .replace(/\bav\b/gi, 'Avenida')
        .replace(/\bcalle\b/gi, '')
        .trim();
}

function findBestMatch(results, originalAddress) {
    const lowerOriginal = originalAddress.toLowerCase();
    
    for (const result of results) {
        const displayName = result.display_name.toLowerCase();
        
        if (lowerOriginal.includes('don torcuato') && displayName.includes('don torcuato')) {
            return result;
        }
        if (lowerOriginal.includes('tigre') && displayName.includes('tigre')) {
            return result;
        }
        if (lowerOriginal.includes('san isidro') && displayName.includes('san isidro')) {
            return result;
        }
        if (lowerOriginal.includes('vicente lópez') && displayName.includes('vicente lópez')) {
            return result;
        }
    }
    
    return results[0];
}

function getAddressVariations(address) {
    const variations = [];
    const lowerAddress = address.toLowerCase();
    
    const streetMatch = address.match(/^([^,]+)/);
    if (streetMatch) {
        const street = streetMatch[1].trim();
        
        if (lowerAddress.includes('don torcuato')) {
            variations.push(`${street}, Don Torcuato, Buenos Aires, Argentina`);
            variations.push(`${street}, Don Torcuato, Tigre, Buenos Aires`);
            variations.push(`${street}, Don Torcuato`);
        }
        
        if (lowerAddress.includes('tigre')) {
            variations.push(`${street}, Tigre, Buenos Aires`);
        }
        if (lowerAddress.includes('san isidro')) {
            variations.push(`${street}, San Isidro, Buenos Aires`);
        }
        if (lowerAddress.includes('vicente lópez')) {
            variations.push(`${street}, Vicente López, Buenos Aires`);
        }
    }
    
    const withoutNumber = address.replace(/\d+/g, '').replace(/,\s*,/g, ',').trim();
    if (withoutNumber !== address) {
        variations.push(withoutNumber);
    }
    
    if (lowerAddress.includes('don torcuato')) {
        variations.push('Don Torcuato, Buenos Aires');
        variations.push('Don Torcuato, Tigre, Buenos Aires');
    }
    
    return variations;
}

async function geocodeAddresses(addresses) {
    let successCount = 0;
    
    for (let i = 0; i < addresses.length; i++) {
        const result = await geocodeAddress(addresses[i]);
        
        if (result) {
            circuits[currentCircuit].push({
                address: result.display_name,
                lat: result.lat,
                lng: result.lng
            });
            successCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    updateAddressesList();
    updateCircuitTabs();
    showAddressesOnMap();
    showSuccess(`${successCount} de ${addresses.length} direcciones cargadas correctamente`);
    optimizedRouteData = null;
}