import pandas as pd
from sklearn.metrics import pairwise_distances
from scipy.cluster.hierarchy import linkage, dendrogram
from sklearn.manifold import MDS
import matplotlib.pyplot as plt
import seaborn as sns

# ------------------------------
# Ajustes globales de fuente
# ------------------------------
display_font = 'Times New Roman'
plt.rcParams['font.family'] = display_font

# ------------------------------
# 1. Definir el path al CSV
# ------------------------------
FILE_PATH = "cabrera_22_23_habitat.csv"

# ------------------------------
# 2. Limpiar datos: eliminar especies no deseadas y unificar nombres
# ------------------------------
def clean_data(df):
    df = df[~df['Plant sp'].isin(['Anacamptis pyramidalis', 'Gladiolus communis'])]
    df['Plant sp'] = df['Plant sp'].replace({
        'Daucus carota L. subsp. Majoricus': 'Daucus carota',
        'Rosmarinus officinalis': 'Salvia rosmarinus'
    })
    return df

# ------------------------------
# 3. Guardar checklists de presencia/ausencia
# ------------------------------
def save_checklists(df):
    plant_checklist = pd.crosstab(df['habitat'], df['Plant sp'])
    family_checklist = pd.crosstab(df['habitat'], df['Family'])
    plant_checklist = plant_checklist.applymap(lambda x: "✔️" if x > 0 else "")
    family_checklist = family_checklist.applymap(lambda x: "✔️" if x > 0 else "")
    plant_checklist.to_excel("plant_checklist.xlsx")
    family_checklist.to_excel("family_checklist.xlsx")

# ------------------------------
# 4. Matrices para análisis de distancia
#    - Plantas (binaria y abundancia)
#    - Polinizadores (binaria y abundancia)
# ------------------------------
def compute_distances(df):
    # Plantas
    plant_bin = (pd.crosstab(df['habitat'], df['Plant sp']) > 0).astype(int)
    plant_abund = pd.crosstab(
        df['habitat'], df['Plant sp'], values=df['N open flowers'], aggfunc='sum'
    ).fillna(0)
    # Polinizadores
    poll_bin = (pd.crosstab(df['habitat'], df['Pollinator']) > 0).astype(int)
    poll_abund = pd.crosstab(
        df['habitat'], df['Pollinator'], values=df['N ind'], aggfunc='sum'
    ).fillna(0)

    # Distancias Bray–Curtis para cada matriz
    dists = {
        'plant': {
            'binary': pairwise_distances(plant_bin.values, metric='braycurtis'),
            'abundance': pairwise_distances(plant_abund.values, metric='braycurtis')
        },
        'pollinator': {
            'binary': pairwise_distances(poll_bin.values, metric='braycurtis'),
            'abundance': pairwise_distances(poll_abund.values, metric='braycurtis')
        }
    }
    return plant_bin, plant_abund, poll_bin, poll_abund, dists

# ------------------------------
# 5. Función de visualización (heatmap)
# ------------------------------
def plot_heatmap(dist_matrix, labels, title, filename=None):
    plt.figure(figsize=(8, 6))
    sns.heatmap(
        dist_matrix,
        xticklabels=labels,
        yticklabels=labels,
        cmap='viridis',
        annot=True,
        annot_kws={'fontfamily': display_font}
    )
    plt.title(title, fontfamily=display_font)
    base_fs = plt.rcParams.get('font.size', 10)
    plt.xticks(fontsize=base_fs + 2, fontfamily=display_font)
    plt.yticks(fontsize=base_fs + 2, fontfamily=display_font)
    plt.tight_layout()
    if filename:
        plt.savefig(filename, format='svg')
    plt.show()

# ------------------------------
# 6. Ejecución principal
# ------------------------------
def main():
    # Leer datos y limpiar
    df = pd.read_csv(FILE_PATH, sep=';')
    df = clean_data(df)

    # Generar y guardar checklists
    save_checklists(df)

    # Calcular distancias
    plant_bin, plant_abund, poll_bin, poll_abund, distances = compute_distances(df)
    plant_labels = plant_bin.index.tolist()
    poll_labels  = poll_bin.index.tolist()

    # Heatmaps Bray–Curtis (Plantas)
    plot_heatmap(
        distances['plant']['binary'], plant_labels,
        "Heatmap Bray–Curtis - Plantas (binaria)",
        filename="heatmap_plants_binary.svg"
    )
    plot_heatmap(
        distances['plant']['abundance'], plant_labels,
        "Heatmap Bray–Curtis - Plantas (abundancia)",
        filename="heatmap_plants_abundance.svg"
    )

    # Heatmaps Bray–Curtis (Polinizadores)
    plot_heatmap(
        distances['pollinator']['binary'], poll_labels,
        "Heatmap Bray–Curtis - Polinizadores (binaria)",
        filename="heatmap_poll_binary.svg"
    )
    plot_heatmap(
        distances['pollinator']['abundance'], poll_labels,
        "Heatmap Bray–Curtis - Polinizadores (abundancia)",
        filename="heatmap_poll_abundance.svg"
    )

if __name__ == '__main__':
    main()
