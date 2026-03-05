import csv
import json

input_csv = 'data/1_Bartomeus_multilayer_modified.csv'
output_json = 'data/demo_bipartite_bartomeus.json'

layers_dict = {}
nodes_dict = {}
state_nodes_dict = {}
links_list = []

with open(input_csv, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # 1. LAYER
        layer_id_str = row['Network_id']
        
        if layer_id_str not in layers_dict:
            layers_dict[layer_id_str] = {
                "layer_id": layer_id_str, # Using string ID as it maps directly 
                "layer_name": layer_id_str,
                "bipartite": True,
                "Network_id": row.get('Network_id'),
                "Study_id": row.get('Study_id'),
                "Month": row.get('Month'),
                "Year": row.get('Year'),
                "Authors_habitat": row.get('Authors_habitat'),
                "EuPPollNet_habitat": row.get('EuPPollNet_habitat'),
                "Bioregion": row.get('Bioregion'),
                "Country": row.get('Country'),
                "Locality": row.get('Locality'),
                "Latitude": row.get('Latitude'),
                "Longitude": row.get('Longitude')
            }
        
        # 2. NODES
        plant_id = row['Plant_accepted_name']
        if plant_id not in nodes_dict:
            nodes_dict[plant_id] = {
                "node_id": plant_id,
                "node_name": plant_id,
                "node_type": "Plant",
                "Plant_original_name": row.get('Plant_original_name'),
                "Plant_rank": row.get('Plant_rank'),
                "Plant_order": row.get('Plant_order'),
                "Plant_family": row.get('Plant_family'),
                "Plant_genus": row.get('Plant_genus'),
                "Plant_abundance": row.get('Plant_abundance'),
                "Plant_module": row.get('Plant_module')
            }
            
        pollinator_id = row['Pollinator_accepted_name']
        if pollinator_id not in nodes_dict:
            nodes_dict[pollinator_id] = {
                "node_id": pollinator_id,
                "node_name": pollinator_id,
                "node_type": "Pollinator",
                "Pollinator_original_name": row.get('Pollinator_original_name'),
                "Pollinator_rank": row.get('Pollinator_rank'),
                "Pollinator_order": row.get('Pollinator_order'),
                "Pollinator_family": row.get('Pollinator_family'),
                "Pollinator_genus": row.get('Pollinator_genus'),
                "Pollinator_abundance": row.get('Pollinator_abundance'),
                "Pollinator_module": row.get('Pollinator_module')
            }
            
        # 3. STATE NODES (Implicitly defined within layers)
        state_plant_key = (layer_id_str, plant_id)
        if state_plant_key not in state_nodes_dict:
            state_nodes_dict[state_plant_key] = {
                "layer_id": layer_id_str,
                "layer_name": layer_id_str,
                "node_id": plant_id,
                "node_name": plant_id,
                "local_abundance": row.get('Plant_abundance'),
                "local_module": row.get('Plant_module')
            }
            
        state_poll_key = (layer_id_str, pollinator_id)
        if state_poll_key not in state_nodes_dict:
            state_nodes_dict[state_poll_key] = {
                "layer_id": layer_id_str,
                "layer_name": layer_id_str,
                "node_id": pollinator_id,
                "node_name": pollinator_id,
                "local_abundance": row.get('Pollinator_abundance'),
                "local_module": row.get('Pollinator_module')
            }
            
        # 4. LINKS (Intralayer bipartite)
        try:
            w = float(row.get('weight', 1.0))
        except ValueError:
            w = 1.0
            
        link = {
            "layer_from": layer_id_str,
            "node_from": pollinator_id, # Pollinators typically link to plants
            "layer_to": layer_id_str,
            "node_to": plant_id,
            "weight": w,
            "directed": False,
            "Interaction": row.get('Interaction'),
            "Date": row.get('Date'),
            "Day": row.get('Day'),
            "Sampling_method": row.get('Sampling_method')
        }
        links_list.append(link)

final_json = {
    "layers": list(layers_dict.values()),
    "nodes": list(nodes_dict.values()),
    "state_nodes": list(state_nodes_dict.values()),
    "extended": links_list
}

with open(output_json, 'w', encoding='utf-8') as f:
    json.dump(final_json, f, indent=2)

print(f"Successfully wrote {len(layers_dict)} layers, {len(nodes_dict)} nodes, {len(state_nodes_dict)} state_nodes, and {len(links_list)} links to {output_json}")
