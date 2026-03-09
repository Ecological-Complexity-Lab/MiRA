setwd('~/GitHub/ecomplab/multilayer_viz/emln/')
devtools::load_all()
net <- load_emln(17)
plot_multilayer(net, directed = F, bipartite = T, browser = "Chrome")
?create_multilayer_network