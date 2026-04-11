All files are plain ASCII text files, with the exception of chilean_metadata.xls.

1. README.txt - This file. Including a description of the other data files.

2. chilean-TI.txt - Adjacency matrix for the trophic layer. The file is TAB-delimited and contains 107 lines and 108 columns. The first line is composed by two TAB-keys followed by the numerical IDs of the 106 species. The 106 following lines are composed as follows. The first and second columns display the numerical ID and the name of the species respectively. The species name can include whitespace characters. The remaining columns are the adjancency matrix values, i.e. 1/0 for presence/absence of a link. A link between species i and j means species i is eaten by species j.

3. chilean-NTIpos.txt - Adjacency matrix for the positive non-trophic layer. Same format as chilean-TI.txt. A link between species i and j means that species i is the target of a positive interaction and species j is the source.

4. chilean-NTIneg.txt - Adjacency matrix for the negative non-trophic layer. Same format as chilean-TI.txt. A link between species i and j means that species i is the target of a negative interaction and species j is the source.

5. chilean_metadata.xls -  Species properties and information, in Excel format. 
Variable names and descriptions :
Spec				species ID
Species names			species name
BodyMass			body mass	
sessile/mobile			mobility category	
Cluster				cluster retrieved by the multiplex probabilistic clustering algorithm
Phyllum				phyllum
subphyllum			subphyllum	
trophic				trophic level
Shore Height 1 conservative	category created in the regression tree analysis displayed in Figure S12
ShoreHt_C_Ordinal		idem
ShoreHt_C_Breadth		idem
Shore Height 2 restrictive	idem
ShoreHt_R_Ordinal		idem
ShortHt_R_Breadth		idem

