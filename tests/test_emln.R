setwd('~/GitHub/Ecological-Complexity-Lab/emln/')
devtools::document()
devtools::check()
devtools::load_all()
?plot_multilayer
?multilayer_to_json
?multilayer_to_csv
net <- load_emln(28)               # load a built-in dataset
net$references
# Open directly in the browser
srv <- plot_multilayer(net, bipartite = TRUE)
httpuv::stopServer(srv)            # stop server when done

# Or export to JSON / CSV for manual upload
multilayer_to_json(net, file = "net60.json", bipartite = TRUE)
multilayer_to_csv(net, dir = "out/", prefix = "net60", bipartite = TRUE)
