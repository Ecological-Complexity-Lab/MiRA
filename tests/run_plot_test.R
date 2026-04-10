# run_plot_test.R — manual integration test for plot_multilayer()
#
# Usage (from the emln source directory):
#   Rscript run_plot_test.R           # default: loads emln 14, bipartite
#   Rscript run_plot_test.R 17 FALSE  # loads emln 17, unipartite
#
# Requires: devtools, httpuv. This script uses devtools::load_all() so you
# do NOT need to install the package first.

args <- commandArgs(trailingOnly = TRUE)
dataset_id <- if (length(args) >= 1) as.integer(args[1]) else 14L
bipartite  <- if (length(args) >= 2) as.logical(args[2]) else TRUE

if (!requireNamespace("devtools", quietly = TRUE)) {
  stop("Install devtools first: install.packages('devtools')")
}
if (!requireNamespace("httpuv", quietly = TRUE)) {
  stop("Install httpuv first: install.packages('httpuv')")
}

devtools::load_all(".")

message(sprintf("Loading emln dataset %d (bipartite = %s)...",
                dataset_id, bipartite))
net <- load_emln(dataset_id)

srv <- plot_multilayer(net, bipartite = bipartite, port = 8082, browser = 'Chrome')
message("Server started. Press Ctrl+C (or close R) to stop.")

# Keep R alive so the httpuv server keeps serving
while (TRUE) Sys.sleep(1)
