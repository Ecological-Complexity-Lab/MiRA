# Ant social network structure is highly conserved

[https://doi.org/10.5061/dryad.dfn2z358r](https://doi.org/10.5061/dryad.dfn2z358r)

The data here are collected via automated tracking of 25 ant colonies (5 of each of 5 species). The tracking time-calibrated outputs coordinated and orientations for each individual.

## Description of the data and file structure

'Edgelist' files contain interaction counts for each pair of individuals

'Forage' files count the number of visits each individual paid to each hexagon in the foraging arena

'Nest' files count the number of visits each individual paid to each hexagon in the nest

'Interaction' files contain all pairwise interactions (each interaction is a row). The identities of the involved ants ('id1' and 'id2'), the start and end times of the interaction, the box in which the interaction occured ('space' - 1 = nest box; 2 = foraging box), and the types of contact between the ants that occured (1 = head, 2 = body. So '1-2' implies that the head of ant one contacted the body of ant two, and '2-1' implies that the body of ant one contacted the head of ant two).

'Md' files contain information for each ant - the corresponding tag identity at multiple time-points, body length (measured in pixels - 'head_tail_px'), and number of times detected

'RandMod' files contain soft modularity scores for each network for each iteration in which the networks were randomly reshuffled

'SoftModularity.csv' contains soft modularity scores for each network for community numbers 2, 3, 4 and 5

Corrseponding code is provided in this repository and on Github at: [https://github.com/MO-Katy/AntSocialNetworkComparative](https://github.com/MO-Katy/AntSocialNetworkComparative)
