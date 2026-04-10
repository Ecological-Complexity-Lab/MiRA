# run_integration_test.R — integration tests for multilayer_to_json,
# multilayer_to_csv, and plot_multilayer.
#
# Usage (from the emln source directory):
#   Rscript run_integration_test.R
#
# Tests two datasets: 14 (bipartite, 2 layers) and 1 (unipartite, 3 layers).
# Reports PASS / FAIL for each check. Exits with code 1 if any test fails.
# Does NOT open the browser — the plot test just starts and stops the server.

if (!requireNamespace("devtools", quietly = TRUE))
  stop("Install devtools: install.packages('devtools')")
if (!requireNamespace("httpuv", quietly = TRUE))
  stop("Install httpuv: install.packages('httpuv')")

devtools::load_all(".", quiet = TRUE)

# Kill any stale httpuv servers on ports 8080-8130 from previous sessions
message("Cleaning up any stale servers on ports 8080-8130...")
suppressWarnings(
  system("lsof -ti TCP:8080-8130 | xargs kill -9 2>/dev/null", ignore.stdout = TRUE)
)
Sys.sleep(0.5)

pass <- 0L
fail <- 0L

check <- function(label, expr) {
  result <- tryCatch(
    { force(expr); TRUE },
    error = function(e) { message("  ERROR: ", conditionMessage(e)); FALSE }
  )
  if (isTRUE(result)) {
    message(sprintf("  PASS  %s", label))
    pass <<- pass + 1L
  } else {
    message(sprintf("  FAIL  %s", label))
    fail <<- fail + 1L
  }
}

expect_true <- function(cond, msg = "condition is FALSE") {
  if (!isTRUE(cond)) stop(msg)
  TRUE
}

tmp <- tempdir()
cat("\n=== loading datasets ===\n")
net14 <- load_emln(14)   # bipartite, 2 layers
net1  <- load_emln(1)    # unipartite, 3 layers

# ── multilayer_to_json ─────────────────────────────────────────────────────
cat("\n=== multilayer_to_json ===\n")

check("bipartite net returns JSON string", {
  j <- multilayer_to_json(net14, bipartite = TRUE, directed = FALSE)
  expect_true(is.character(j) && nzchar(j))
})

check("JSON contains all four required arrays", {
  j <- multilayer_to_json(net14, bipartite = TRUE, directed = FALSE)
  for (key in c('"nodes"', '"layers"', '"extended"', '"state_nodes"')) {
    expect_true(grepl(key, j, fixed = TRUE),
                paste("missing key:", key))
  }
})

check("JSON top-level directed field present", {
  j <- multilayer_to_json(net14, bipartite = TRUE, directed = FALSE)
  expect_true(grepl('"directed"', j, fixed = TRUE))
})

check("JSON contains bipartite:true in layers", {
  j <- multilayer_to_json(net14, bipartite = TRUE, directed = FALSE)
  expect_true(grepl('"bipartite": true', j, fixed = TRUE))
})

check("node_type present (renamed from legacy 'type')", {
  j <- multilayer_to_json(net14, bipartite = TRUE, directed = FALSE)
  expect_true(grepl('"node_type"', j, fixed = TRUE))
})

check("nodes are deduplicated", {
  j <- multilayer_to_json(net14, bipartite = TRUE, directed = FALSE)
  # Split before "state_nodes" to count only the nodes array
  nodes_section <- strsplit(j, '"state_nodes"', fixed = TRUE)[[1]][1]
  n_json  <- lengths(regmatches(nodes_section,
                    gregexpr('"node_name"', nodes_section, fixed = TRUE)))
  n_nodes <- length(unique(net14$nodes$node_name))
  expect_true(n_json == n_nodes,
              sprintf("JSON has %d node rows but %d unique nodes", n_json, n_nodes))
})

check("unipartite net: no bipartite flag, directed auto-detected", {
  j <- multilayer_to_json(net1, bipartite = FALSE)
  expect_true(!grepl('"bipartite": true', j, fixed = TRUE))
})

check("writes JSON file to disk", {
  f <- file.path(tmp, "test_net14.json")
  multilayer_to_json(net14, file = f, bipartite = TRUE, directed = FALSE)
  expect_true(file.exists(f) && file.info(f)$size > 100)
})

# ── multilayer_to_csv ──────────────────────────────────────────────────────
cat("\n=== multilayer_to_csv ===\n")

check("writes three CSV files", {
  out <- multilayer_to_csv(net14, dir = tmp, prefix = "net14_bp",
                           bipartite = TRUE, directed = FALSE)
  for (p in out) expect_true(file.exists(p), paste("missing:", p))
})

check("edges CSV has required columns", {
  multilayer_to_csv(net14, dir = tmp, prefix = "net14_chk",
                   bipartite = TRUE, directed = FALSE)
  edges <- read.csv(file.path(tmp, "net14_chk_edges.csv"))
  for (col in c("layer_from", "node_from", "layer_to", "node_to", "weight")) {
    expect_true(col %in% names(edges), paste("missing column:", col))
  }
})

check("layers CSV has bipartite column when bipartite=TRUE", {
  multilayer_to_csv(net14, dir = tmp, prefix = "net14_bpchk",
                   bipartite = TRUE, directed = FALSE)
  layers <- read.csv(file.path(tmp, "net14_bpchk_layers.csv"))
  expect_true("bipartite" %in% names(layers))
  expect_true(all(layers$bipartite == TRUE))
})

check("nodes CSV has node_type column (renamed from 'type')", {
  multilayer_to_csv(net14, dir = tmp, prefix = "net14_ntchk",
                   bipartite = TRUE, directed = FALSE)
  nodes <- read.csv(file.path(tmp, "net14_ntchk_nodes.csv"))
  expect_true("node_type" %in% names(nodes), "node_type column missing")
  n_types <- length(unique(nodes$node_type))
  expect_true(n_types == 2,
              sprintf("expected 2 distinct node_type values, got %d", n_types))
})

check("nodes CSV rows == unique physical nodes", {
  multilayer_to_csv(net14, dir = tmp, prefix = "net14_ded",
                   bipartite = TRUE, directed = FALSE)
  nodes <- read.csv(file.path(tmp, "net14_ded_nodes.csv"))
  n_unique <- length(unique(net14$nodes$node_name))
  expect_true(nrow(nodes) == n_unique,
              sprintf("CSV has %d rows but %d unique nodes", nrow(nodes), n_unique))
})

check("unipartite: layers CSV has no bipartite column", {
  multilayer_to_csv(net1, dir = tmp, prefix = "net1_uni",
                   bipartite = FALSE)
  layers <- read.csv(file.path(tmp, "net1_uni_layers.csv"))
  expect_true(!"bipartite" %in% names(layers))
})

# ── plot_multilayer ────────────────────────────────────────────────────────
cat("\n=== plot_multilayer ===\n")

check("starts server and returns handle", {
  srv <- plot_multilayer(net14, bipartite = TRUE, directed = FALSE)
  on.exit(try(httpuv::stopServer(srv), silent = TRUE), add = TRUE)
  expect_true(!is.null(srv))
})

check("server is running and reports a valid port", {
  srv <- plot_multilayer(net14, bipartite = TRUE, directed = FALSE)
  on.exit(try(httpuv::stopServer(srv), silent = TRUE), add = TRUE)
  expect_true(srv$isRunning())
  port <- srv$getPort()
  expect_true(is.numeric(port) && port >= 1024 && port <= 65535,
              sprintf("unexpected port: %s", port))
})

check("index.html exists in the served viz_path", {
  srv <- plot_multilayer(net14, bipartite = TRUE, directed = FALSE)
  on.exit(try(httpuv::stopServer(srv), silent = TRUE), add = TRUE)
  viz <- system.file("multilayer_viz", package = "emln")
  expect_true(file.exists(file.path(viz, "index.html")))
  expect_true(file.exists(file.path(viz, "js", "app.js")))
})

check("bad viz_path gives clear error", {
  expect_true(tryCatch(
    { plot_multilayer(net14, viz_path = "/nonexistent/path"); FALSE },
    error = function(e) grepl("index.html", conditionMessage(e))
  ))
})

# ── summary ────────────────────────────────────────────────────────────────
cat(sprintf("\n=== Results: %d passed, %d failed ===\n", pass, fail))
if (fail > 0) quit(status = 1L)
