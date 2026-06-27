
import pandas as pd
import matplotlib.pyplot as plt
import os

# ------------------------------
# 1. Cargar y preparar el dataset
# ------------------------------

file_path = "cabrera_22_23_habitat.csv"
df = pd.read_csv(file_path, sep=';')

# Eliminar filas sin valor de visita
df_clean = df.dropna(subset=['visita'])
df_clean['visita'] = df_clean['visita'].astype(int)

# Crear carpeta para guardar figuras
output_dir = "figures_output"
os.makedirs(output_dir, exist_ok=True)

# ------------------------------
# 2. Función para graficar curvas acumuladas
# ------------------------------

colors = {'obs': 'blue', 'rpi': 'orange', 'Combined': 'black'}

def plot_cumulative(df, title_suffix="Whole dataset", save_name="plot"):
    methods = ['obs', 'rpi']
    cumulative_richness = {}

    for method in methods:
        subset = df[df['Method'] == method]
        richness = []
        cumulative_species = set()
        for v in range(1, 14):
            current_species = subset[subset['visita'] == v]['Pollinator'].dropna().unique()
            cumulative_species.update(current_species)
            richness.append(len(cumulative_species))
        cumulative_richness[method] = richness

    # Combinado
    richness_combined = []
    cumulative_species_combined = set()
    for v in range(1, 14):
        current_species = df[df['visita'] == v]['Pollinator'].dropna().unique()
        cumulative_species_combined.update(current_species)
        richness_combined.append(len(cumulative_species_combined))
    cumulative_richness['Combined'] = richness_combined

    # Graficar
    plt.figure(figsize=(14, 6))
    for method in ['obs', 'rpi', 'Combined']:
        plt.plot(range(1, 14), cumulative_richness[method], label=method, color=colors[method])
    plt.xlabel("Visit")
    plt.ylabel("Cumulative species richness")
    plt.title(f"Cumulative species richness per visit ({title_suffix})")
    plt.legend(title="Método")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, f"{save_name}.png"))
    plt.close()

# ------------------------------
# 3. Generar figuras
# ------------------------------

# Figura general
plot_cumulative(df_clean, "Whole dataset", "whole_dataset")

# Comunidades principales
plot_cumulative(df_clean[df_clean['habitat'].str.contains("Pine forest", case=False, na=False)], "Pine forest", "pine_forest")
plot_cumulative(df_clean[df_clean['habitat'].str.contains("Dune system", case=False, na=False)], "Dune system", "dune_system")
plot_cumulative(df_clean[df_clean['habitat'].str.contains("Rocky coastal", case=False, na=False)], "Rocky coastal", "rocky_coastal")

# ------------------------------
# 4. Subcomunidades (opcional)
# ------------------------------

subcommunities = [
    "Pine forest 1", "Pine forest 2",
    "Dune system 1", "Dune system 2",
    "Rocky coastal 1", "Rocky coastal 2"
]

for sub in subcommunities:
    subset = df_clean[df_clean['habitat'] == sub]
    save_id = sub.lower().replace(" ", "_")
    plot_cumulative(subset, sub, save_id)
