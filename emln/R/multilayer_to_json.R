#' Export a multilayer network to JSON
#'
#' Converts an EMLN \code{multilayer} object to JSON format compatible with the
#' Multilayer Network Visualizer web app.
#'
#' @param multilayer A multilayer object (created by \code{create_multilayer_network}
#'   or \code{load_emln}).
#' @param file Optional file path to write the JSON to. If NULL, returns the JSON
#'   string.
#' @param bipartite Logical or NULL. Whether the network is bipartite. If NULL
#'   (default), auto-detected from the presence of a \code{node_group} column in
#'   the nodes table.
#' @param directed Logical or NULL. Whether the network is directed. If NULL
#'   (default), auto-detected by checking edge list symmetry.
#'
#' @return If \code{file} is NULL, returns the JSON string invisibly.
#'   If \code{file} is specified, writes JSON to disk and returns the file path
#'   invisibly.
#'
#' @details
#' The JSON output contains four arrays matching the visualizer's expected format:
#' \itemize{
#'   \item \code{nodes}: Physical nodes with \code{node_id}, \code{node_name}, and
#'     any extra attributes. For bipartite networks, \code{node_group} is mapped to
#'     \code{node_type}.
#'   \item \code{layers}: Layer metadata with \code{layer_id}, \code{layer_name},
#'     and extra attributes. For bipartite networks, a \code{bipartite: true} flag
#'     is added.
#'   \item \code{extended}: The extended edge list with \code{layer_from},
#'     \code{node_from}, \code{layer_to}, \code{node_to}, \code{weight}, and any
#'     link attributes. For directed networks, a \code{directed: true} flag is
#'     added to each link.
#'   \item \code{state_nodes}: State node map with \code{layer_id}, \code{node_id},
#'     \code{layer_name}, \code{node_name}.
#' }
#'
#' @seealso \code{plot_multilayer, create_multilayer_network, load_emln}
#'
#' @export
#' @import dplyr
#' @import tibble
#'
#' @examples
#' \dontrun{
#' # Export to file
#' net <- load_emln(14)
#' multilayer_to_json(net, file = "my_network.json", bipartite = TRUE)
#'
#' # Get JSON string
#' json_str <- multilayer_to_json(net)
#' }

multilayer_to_json <- function(multilayer, file = NULL, bipartite = NULL, directed = NULL) {

  if (!inherits(multilayer, "multilayer")) {
    stop("Input must be a multilayer object (class 'multilayer').")
  }

  # ---- Auto-detect bipartite ----
  if (is.null(bipartite)) {
    bipartite <- "node_group" %in% names(multilayer$nodes)
    if (bipartite) message("Auto-detected bipartite network (node_group column found).")
  }

  # ---- Auto-detect directed ----
  if (is.null(directed)) {
    # Check intralayer edge symmetry: if every (a->b) has a matching (b->a), it's undirected
    intra <- multilayer$extended %>%
      dplyr::filter(layer_from == layer_to)
    if (nrow(intra) > 0) {
      # Create a set of "layer|from|to" keys
      fwd_keys <- paste(intra$layer_from, intra$node_from, intra$node_to, sep = "|")
      rev_keys <- paste(intra$layer_from, intra$node_to, intra$node_from, sep = "|")
      directed <- !all(fwd_keys %in% rev_keys)
    } else {
      directed <- FALSE
    }
    message(sprintf("Auto-detected %s network.", ifelse(directed, "directed", "undirected")))
  }

  # ---- Build nodes array ----
  nodes_df <- as.data.frame(multilayer$nodes)
  # Rename node_group -> node_type for bipartite networks
  if (bipartite && "node_group" %in% names(nodes_df)) {
    names(nodes_df)[names(nodes_df) == "node_group"] <- "node_type"
  }

  # ---- Build layers array ----
  layers_df <- as.data.frame(multilayer$layers)
  # Add bipartite flag
  if (bipartite) {
    layers_df$bipartite <- TRUE
  }

  # ---- Build extended edge list ----
  extended_df <- as.data.frame(multilayer$extended)
  # Ensure layer_from/layer_to use layer names (not IDs)
  # The extended edge list from create_multilayer_network already uses names.
  # From load_emln it also uses names (layer_1, layer_2, etc.)

  # Add directed flag to each link
  if (directed) {
    extended_df$directed <- TRUE
  }

  # ---- Build state_nodes array ----
  state_nodes_df <- as.data.frame(multilayer$state_nodes)
  # Keep only the 4 core columns (layer_id, node_id, layer_name, node_name)
  core_cols <- c("layer_id", "node_id", "layer_name", "node_name")
  available_cols <- intersect(core_cols, names(state_nodes_df))
  state_nodes_df <- state_nodes_df[, available_cols, drop = FALSE]

  # ---- Assemble JSON ----
  json_list <- list(
    nodes = .df_to_list_of_rows(nodes_df),
    layers = .df_to_list_of_rows(layers_df),
    extended = .df_to_list_of_rows(extended_df),
    state_nodes = .df_to_list_of_rows(state_nodes_df)
  )

  json_str <- .to_json(json_list)

  # ---- Output ----
  if (!is.null(file)) {
    writeLines(json_str, con = file)
    message(sprintf("JSON written to: %s", file))
    return(invisible(file))
  }

  return(invisible(json_str))
}


# ---- Internal helpers (no external JSON dependency) ----

#' Convert a data.frame to a list of named lists (one per row)
#' @keywords internal
.df_to_list_of_rows <- function(df) {
  lapply(seq_len(nrow(df)), function(i) {
    row <- as.list(df[i, , drop = FALSE])
    # Remove NA values to keep JSON clean
    row <- row[!sapply(row, function(x) is.na(x) || length(x) == 0)]
    row
  })
}

#' Minimal JSON serializer (no dependency on jsonlite)
#'
#' Converts an R list structure to a JSON string.
#' Supports: lists, vectors, strings, numbers, logicals, NULL.
#' @keywords internal
.to_json <- function(x, indent = 0) {
  pad <- function(n) paste(rep("  ", n), collapse = "")

  if (is.null(x)) {
    return("null")
  }

  if (is.logical(x) && length(x) == 1) {
    return(ifelse(x, "true", "false"))
  }

  if (is.numeric(x) && length(x) == 1) {
    # Use integer format when possible
    if (x == floor(x) && abs(x) < 1e15) {
      return(format(x, scientific = FALSE))
    }
    return(as.character(x))
  }

  if (is.character(x) && length(x) == 1) {
    # Escape special characters
    escaped <- gsub("\\\\", "\\\\\\\\", x)
    escaped <- gsub('"', '\\\\"', escaped)
    escaped <- gsub("\n", "\\\\n", escaped)
    escaped <- gsub("\r", "\\\\r", escaped)
    escaped <- gsub("\t", "\\\\t", escaped)
    return(paste0('"', escaped, '"'))
  }

  # Named list -> JSON object
  if (is.list(x) && !is.null(names(x))) {
    entries <- mapply(function(key, val) {
      paste0(pad(indent + 1), .to_json(key), ": ", .to_json(val, indent + 1))
    }, names(x), x, SIMPLIFY = FALSE, USE.NAMES = FALSE)
    return(paste0("{\n", paste(entries, collapse = ",\n"), "\n", pad(indent), "}"))
  }

  # Unnamed list -> JSON array
  if (is.list(x)) {
    entries <- lapply(x, function(item) {
      paste0(pad(indent + 1), .to_json(item, indent + 1))
    })
    return(paste0("[\n", paste(entries, collapse = ",\n"), "\n", pad(indent), "]"))
  }

  # Fallback: convert to string
  return(.to_json(as.character(x), indent))
}
