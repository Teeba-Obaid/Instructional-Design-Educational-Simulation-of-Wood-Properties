from flask import Flask, render_template, request, jsonify
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import os
import time

app = Flask(__name__,
            template_folder='templates_simulation',
            static_folder='static_simulation')

# Wood data for Pine, Oak, Plywood, MDF
wood_data = {
    'Pine': {'density': 500, 'grain_angle': 15, 'porosity': 0.60, 'humidity_level': 0.15, 'fiber_length': 2.0, 'image': 'pine_wood.png'},
    'Oak': {'density': 700, 'grain_angle': 15, 'porosity': 0.45, 'humidity_level': 0.12, 'fiber_length': 2.5, 'image': 'oak_wood.png'},
    'Plywood': {'density': 550, 'grain_angle': 15, 'porosity': 0.50, 'humidity_level': 0.18, 'fiber_length': 1.5, 'image': 'plywood_wood.png'},
    'MDF': {'density': 800, 'grain_angle': 15, 'porosity': 0.55, 'humidity_level': 0.20, 'fiber_length': 1.0, 'image': 'MDF_wood.png'}
}

# Constants for simulation models
K1, K2, K3 = 1.0, 1.0, 1.0

def simulate_hardness(density, grain_angle):
    return K1 * density * np.cos(np.radians(grain_angle))

def simulate_moisture_resistance(porosity, humidity_level):
    return K2 * (1 - porosity) * (1 - humidity_level) * 100

def simulate_tensile_strength(fiber_length, density):
    return K3 * fiber_length * density

@app.route('/')
def home_simulation():
    return render_template('workspace.html', wood_data=wood_data)

@app.route('/get_measurement', methods=['POST'])
def get_measurement():
    data = request.json
    wood_type = data.get('wood_type')
    tool_id = data.get('tool_id')

    if wood_type not in wood_data:
        return jsonify({"error": "Invalid wood type"}), 400

    wood = wood_data[wood_type]
    measurement = ""

    if tool_id == 'density_meter':
        measurement = f"{wood['density']} kg/m³"
    elif tool_id == 'porosity_meter':
        measurement = f"{wood['porosity'] * 100}%"
    elif tool_id == 'moisture_meter':
        measurement = f"{wood['humidity_level'] * 100}%"
    else:
        return jsonify({"error": "Invalid tool"}), 400

    return jsonify({"measurement": measurement, "tool_id": tool_id, "wood_type": wood_type})

@app.route('/calculate_properties', methods=['POST'])
def calculate_properties():
    data = request.json
    wood_type = data.get('wood_type')
    density = data.get('density')
    porosity = data.get('porosity')
    moisture = data.get('moisture')

    # Validate the input values
    try:
        density = float(density)
        porosity = float(porosity)
        moisture = float(moisture)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid input values"}), 400

    grain_angle = wood_data[wood_type]['grain_angle']  # Fixed grain angle for all wood types
    fiber_length = wood_data[wood_type]['fiber_length']  # Fiber length based on wood type

    # Calculate properties using the simulation functions
    hardness = simulate_hardness(density, grain_angle)
    moisture_resistance = simulate_moisture_resistance(porosity, moisture)
    tensile_strength = simulate_tensile_strength(fiber_length, density)

    return jsonify({
        "success": True,
        "hardness": hardness,
        "moisture_resistance": moisture_resistance,
        "tensile_strength": tensile_strength
    })

@app.route('/update_plot', methods=['POST'])
def update_plot():
    data = request.json

    hardness_results = data.get('hardness', {})
    moisture_resistance_results = data.get('moisture_resistance', {})
    tensile_strength_results = data.get('tensile_strength', {})

    # Use a unique timestamp to prevent caching issues
    timestamp = int(time.time())

    # Initialize a dict to store plot URLs
    plot_urls = {}

    # Generate a plot for Hardness
    if hardness_results:
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.bar(hardness_results.keys(), hardness_results.values(), color='skyblue')
        ax.set_title('Simulated Hardness')
        ax.set_ylabel('Hardness Value')
        plt.tight_layout()
        plot_filename = f'hardness_plot_{timestamp}.png'
        plot_path = os.path.join(app.static_folder, plot_filename)
        plt.savefig(plot_path)
        plt.close(fig)
        plot_urls['hardness'] = f'/static_simulation/{plot_filename}'

    # Generate a plot for Moisture Resistance
    if moisture_resistance_results:
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.bar(moisture_resistance_results.keys(), moisture_resistance_results.values(), color='lightgreen')
        ax.set_title('Simulated Moisture Resistance (%)')
        ax.set_ylabel('Moisture Resistance (%)')
        plt.tight_layout()
        plot_filename = f'moisture_resistance_plot_{timestamp}.png'
        plot_path = os.path.join(app.static_folder, plot_filename)
        plt.savefig(plot_path)
        plt.close(fig)
        plot_urls['moisture_resistance'] = f'/static_simulation/{plot_filename}'

    # Generate a plot for Tensile Strength
    if tensile_strength_results:
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.bar(tensile_strength_results.keys(), tensile_strength_results.values(), color='salmon')
        ax.set_title('Simulated Tensile Strength (MPa)')
        ax.set_ylabel('Tensile Strength (MPa)')
        plt.tight_layout()
        plot_filename = f'tensile_strength_plot_{timestamp}.png'
        plot_path = os.path.join(app.static_folder, plot_filename)
        plt.savefig(plot_path)
        plt.close(fig)
        plot_urls['tensile_strength'] = f'/static_simulation/{plot_filename}'

    return jsonify({"success": True, "plot_urls": plot_urls})

if __name__ == '__main__':
    app.run(debug=True, port=5005)
