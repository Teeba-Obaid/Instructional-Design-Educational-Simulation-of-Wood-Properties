document.addEventListener("DOMContentLoaded", function () {
    // Drag-and-Drop Functionality (unchanged)
    const tools = document.querySelectorAll('.tool');
    const woods = document.querySelectorAll('.wood-type');
    const measuredData = {};

    tools.forEach(tool => {
        tool.addEventListener('dragstart', dragStart);
    });

    woods.forEach(wood => {
        wood.addEventListener('dragover', dragOver);
        wood.addEventListener('drop', dropTool);
    });

    function dragStart(event) {
        event.dataTransfer.setData('text/plain', event.target.id);
    }

    function dragOver(event) {
        event.preventDefault(); // Allow dropping
        event.currentTarget.classList.add('highlight');
    }

    function dropTool(event) {
        event.preventDefault();
        const toolId = event.dataTransfer.getData('text/plain');
        const woodType = event.currentTarget.getAttribute('data-wood');
        event.currentTarget.classList.remove('highlight');

        fetch('/get_measurement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool_id: toolId, wood_type: woodType })
        })
        .then(response => response.json())
        .then(data => {
            if (data.measurement) {
                addMeasurementToTable(toolId, woodType, data.measurement);
                updateCalculationTable(toolId, woodType, data.measurement);
            }
        });
    }

    function addMeasurementToTable(toolId, woodType, measurement) {
        const tableBody = document.querySelector('#combined-table tbody');
        let row = tableBody.querySelector(`tr[data-wood="${woodType}"]`);

        if (!row) {
            // Create a new row if it doesn't exist for the wood type
            row = document.createElement('tr');
            row.setAttribute('data-wood', woodType);
            row.innerHTML = `
                <td>${woodType}</td>
                <td class="density-cell">-</td>
                <td class="porosity-cell">-</td>
                <td class="moisture-cell">-</td>
            `;
            tableBody.appendChild(row);
        }

        // Update the appropriate cell based on the tool used
        if (toolId === 'density_meter') {
            row.querySelector('.density-cell').textContent = measurement;
        } else if (toolId === 'porosity_meter') {
            row.querySelector('.porosity-cell').textContent = measurement;
        } else if (toolId === 'moisture_meter') {
            row.querySelector('.moisture-cell').textContent = measurement;
        }
    }

    function updateCalculationTable(toolId, woodType, measurement) {
        if (!measuredData[woodType]) {
            measuredData[woodType] = {};
        }

        if (toolId === 'density_meter') {
            const densityValue = parseFloat(measurement.match(/[\d.]+/));
            measuredData[woodType].density = densityValue;
            const densityInput = document.querySelector(`.density-input[data-wood="${woodType}"]`);
            densityInput.value = densityValue.toFixed(2);
            densityInput.disabled = false;
        } else if (toolId === 'porosity_meter') {
            const porosityValue = parseFloat(measurement.match(/[\d.]+/)) / 100;
            measuredData[woodType].porosity = porosityValue;
            const porosityInput = document.querySelector(`.porosity-input[data-wood="${woodType}"]`);
            porosityInput.value = porosityValue.toFixed(2);
            porosityInput.disabled = false;
        } else if (toolId === 'moisture_meter') {
            const moistureValue = parseFloat(measurement.match(/[\d.]+/)) / 100;
            measuredData[woodType].moisture = moistureValue;
            const moistureInput = document.querySelector(`.moisture-input[data-wood="${woodType}"]`);
            moistureInput.value = moistureValue.toFixed(2);
            moistureInput.disabled = false;
        }
    }

    // Event listeners for calculation buttons
    document.getElementById('calculate-hardness').addEventListener('click', () => calculateProperty('hardness'));
    document.getElementById('calculate-moisture-resistance').addEventListener('click', () => calculateProperty('moisture_resistance'));
    document.getElementById('calculate-tensile-strength').addEventListener('click', () => calculateProperty('tensile_strength'));

    function calculateProperty(property) {
        const rows = document.querySelectorAll('#calculation-table tbody tr');
        let measurementsMissing = false;

        const hardnessResults = {};
        const moistureResistanceResults = {};
        const tensileStrengthResults = {};

        const fetchPromises = [];

        rows.forEach(row => {
            const woodType = row.querySelector('td').textContent.trim();
            const densityInput = row.querySelector(`.density-input[data-wood="${woodType}"]`);
            const porosityInput = row.querySelector(`.porosity-input[data-wood="${woodType}"]`);
            const moistureInput = row.querySelector(`.moisture-input[data-wood="${woodType}"]`);

            const density = parseFloat(densityInput.value);
            const porosity = parseFloat(porosityInput.value);
            const moisture = parseFloat(moistureInput.value);

            if (isNaN(density) || isNaN(porosity) || isNaN(moisture)) {
                alert(`Please ensure all measurements are entered for ${woodType}.`);
                measurementsMissing = true;
                return;
            }

            const fetchPromise = fetch('/calculate_properties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wood_type: woodType, density, porosity, moisture })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (property === 'hardness') {
                        row.querySelector('.hardness-output').textContent = data.hardness.toFixed(2);
                        hardnessResults[woodType] = data.hardness;
                    } else if (property === 'moisture_resistance') {
                        row.querySelector('.moisture-resistance-output').textContent = data.moisture_resistance.toFixed(2);
                        moistureResistanceResults[woodType] = data.moisture_resistance;
                    } else if (property === 'tensile_strength') {
                        row.querySelector('.tensile-strength-output').textContent = data.tensile_strength.toFixed(2);
                        tensileStrengthResults[woodType] = data.tensile_strength;
                    }
                }
            });

            fetchPromises.push(fetchPromise);
        });

        if (measurementsMissing) {
            return;
        }

        // Wait for all fetch requests to complete
        Promise.all(fetchPromises).then(() => {
            // Update plots when all values are ready
            if (property === 'hardness') {
                updatePlot(hardnessResults, {}, {});
            } else if (property === 'moisture_resistance') {
                updatePlot({}, moistureResistanceResults, {});
            } else if (property === 'tensile_strength') {
                updatePlot({}, {}, tensileStrengthResults);
            }
        });
    }

    function updatePlot(hardnessResults, moistureResistanceResults, tensileStrengthResults) {
        fetch('/update_plot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hardness: hardnessResults,
                moisture_resistance: moistureResistanceResults,
                tensile_strength: tensileStrengthResults
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const plotUrls = data.plot_urls;

                // Update Hardness Plot
                if (plotUrls.hardness) {
                    document.getElementById('hardness-plot').src = plotUrls.hardness + '?v=' + new Date().getTime();
                }

                // Update Moisture Resistance Plot
                if (plotUrls.moisture_resistance) {
                    document.getElementById('moisture-resistance-plot').src = plotUrls.moisture_resistance + '?v=' + new Date().getTime();
                }

                // Update Tensile Strength Plot
                if (plotUrls.tensile_strength) {
                    document.getElementById('tensile-strength-plot').src = plotUrls.tensile_strength + '?v=' + new Date().getTime();
                }
            }
        });
    }
});
