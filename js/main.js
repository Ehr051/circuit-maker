// Archivo principal de inicialización

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    updateCircuitTabs();
    updateAddressesList();
    showAddressSuggestions();
    
    // Event listeners
    document.getElementById('addressInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addAddress();
        }
    });

    document.getElementById('textFileInput').addEventListener('change', handleTextFileUpload);
    document.getElementById('csvFileInput').addEventListener('change', handleCSVFileUpload);
    document.getElementById('kmlFileInput').addEventListener('change', handleKMLFileUpload);
    
    console.log('Aplicación inicializada correctamente');
});

// Función para mostrar sugerencias de direcciones
function showAddressSuggestions() {
    const suggestions = [
        'Avenida María 1450, Don Torcuato',
        'General Avalos 189, Don Torcuato', 
        'Av. Libertador 1000, San Isidro',
        'Av. Corrientes 1000, Buenos Aires',
        'Palermo, Buenos Aires',
        'Obelisco, Buenos Aires'
    ];

    let suggestionHtml = '<div style="margin-top: 10px; padding: 15px; background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-radius: 8px; font-size: 12px; border-left: 4px solid #2196f3;">';
    suggestionHtml += '<strong>💡 Ejemplos que funcionan bien:</strong><br><br>';
    
    suggestionHtml += '<strong>📍 Gran Buenos Aires:</strong><br>';
    suggestions.slice(0, 3).forEach(suggestion => {
        suggestionHtml += `<button onclick="document.getElementById('addressInput').value='${suggestion}'" style="background: linear-gradient(45deg, #2196f3, #21cbf3); color: white; border: none; margin: 2px; padding: 6px 10px; cursor: pointer; border-radius: 5px; font-size: 11px;">${suggestion}</button><br>`;
    });
    
    suggestionHtml += '<br><strong>🏢 Capital Federal:</strong><br>';
    suggestions.slice(3).forEach(suggestion => {
        suggestionHtml += `<button onclick="document.getElementById('addressInput').value='${suggestion}'" style="background: linear-gradient(45deg, #4caf50, #81c784); color: white; border: none; margin: 2px; padding: 6px 10px; cursor: pointer; border-radius: 5px; font-size: 11px;">${suggestion}</button><br>`;
    });
    
    suggestionHtml += '<br><div style="background: rgba(255, 193, 7, 0.1); padding: 8px; border-radius: 5px; margin-top: 10px;">';
    suggestionHtml += '<strong>⚡ Consejos:</strong><br>';
    suggestionHtml += '• Incluye el nombre de la localidad (Don Torcuato, Tigre, etc.)<br>';
    suggestionHtml += '• Usa "Avenida" o "Av." completo en lugar de abreviaturas<br>';
    suggestionHtml += '• La altura (número) es opcional pero ayuda a la precisión<br>';
    suggestionHtml += '• Si no funciona, prueba sin el número de altura</div>';
    suggestionHtml += '</div>';

    const addressSection = document.querySelector('.section:nth-child(2)');
    const existingSuggestions = addressSection.querySelector('.suggestions');
    
    if (!existingSuggestions) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'suggestions';
        suggestionsDiv.innerHTML = suggestionHtml;
        addressSection.appendChild(suggestionsDiv);
    }
}