#' Plot a multilayer network in the browser
#'
#' Converts an EMLN \code{multilayer} object to JSON and opens the Multilayer
#' Network Visualizer in the default web browser.
#'
#' @param multilayer A multilayer object (created by \code{create_multilayer_network}
#'   or \code{load_emln}).
#' @param bipartite Logical or NULL. Whether the network is bipartite. If NULL
#'   (default), auto-detected from the presence of a \code{node_group} column.
#' @param directed Logical or NULL. Whether the network is directed. If NULL
#'   (default), auto-detected by checking edge list symmetry.
#' @param port Integer. Port for the local HTTP server. Default is 8080.
#' @param viz_path Character. Path to the multilayer_viz directory. If NULL
#'   (default), uses the \code{viz} directory bundled with the package.
#'
#' @return Invisibly returns the server handle. Use
#'   \code{httpuv::stopServer(handle)} to stop the server when done.
#'
#' @details
#' The function:
#' \enumerate{
#'   \item Converts the multilayer object to JSON via \code{multilayer_to_json}
#'   \item Starts a local HTTP server (using \code{httpuv}) that serves the
#'     visualizer app and the network JSON
#'   \item Opens the browser with auto-load enabled
#' }
#'
#' The server runs in the background. Call \code{httpuv::stopServer(handle)} or
#' close R to stop it. The JSON data is kept in memory and never written to disk.
#'
#' @seealso \code{multilayer_to_json, create_multilayer_network, load_emln}
#'
#' @export
#'
#' @examples
#' \dontrun{
#' net <- load_emln(14)
#' srv <- plot_multilayer(net, bipartite = TRUE)
#'
#' # When done:
#' httpuv::stopServer(srv)
#' }
plot_multilayer <- function(multilayer, bipartite = NULL, directed = NULL,
                            port = 8080, viz_path = NULL, browser = getOption("browser")) {
  if (!requireNamespace("httpuv", quietly = TRUE)) {
    stop("Package 'httpuv' is required. Install it with: install.packages('httpuv')")
  }

  # Convert to JSON
  json_str <- multilayer_to_json(multilayer, bipartite = bipartite, directed = directed)

  # Resolve visualizer path
  if (is.null(viz_path)) {
    # Default: look for the viz directory bundled with the package
    viz_path <- system.file("multilayer_viz", package = "emln")

    # Fallback to relative paths if not found (for development)
    if (viz_path == "") {
      pkg_path <- system.file(package = "emln")
      candidates <- c(
        file.path(pkg_path, "..", "multilayer_viz"), # sibling directory
        file.path(dirname(pkg_path), "multilayer_viz"),
        file.path(getwd(), "multilayer_viz"),
        # When running from the emln source directory
        file.path(dirname(getwd()), "multilayer_viz"),
        file.path(getwd(), "..")
      )
      # Check each candidate for the index.html file
      for (cand in candidates) {
        if (file.exists(file.path(cand, "index.html"))) {
          viz_path <- normalizePath(cand)
          break
        }
      }
      if (is.null(viz_path) || viz_path == "") {
        stop("Could not find the multilayer_viz directory bundled with the package.")
      }
    }
  }

  viz_path <- normalizePath(viz_path, mustWork = TRUE)
  message(sprintf("Serving visualizer from: %s", viz_path))

  # Create the httpuv app
  app <- list(
    call = function(req) {
      # Serve the network JSON at a special endpoint
      if (req$PATH_INFO == "/api/network.json") {
        return(list(
          status = 200L,
          headers = list(
            "Content-Type" = "application/json",
            "Access-Control-Allow-Origin" = "*",
            "Cache-Control" = "no-cache"
          ),
          body = json_str
        ))
      }

      # Serve static files from the visualizer directory
      # Map URL path to file system
      url_path <- req$PATH_INFO
      if (url_path == "/" || url_path == "") url_path <- "/index.html"

      file_path <- file.path(viz_path, gsub("^/", "", url_path))
      file_path <- normalizePath(file_path, mustWork = FALSE)

      # Security: ensure the path is within viz_path
      if (!startsWith(file_path, viz_path)) {
        return(list(status = 403L, headers = list(), body = "Forbidden"))
      }

      if (!file.exists(file_path) || dir.exists(file_path)) {
        return(list(status = 404L, headers = list(), body = "Not Found"))
      }

      # Determine content type
      ext <- tolower(tools::file_ext(file_path))
      content_types <- c(
        html = "text/html; charset=utf-8",
        htm = "text/html; charset=utf-8",
        js = "application/javascript; charset=utf-8",
        mjs = "application/javascript; charset=utf-8",
        css = "text/css; charset=utf-8",
        json = "application/json; charset=utf-8",
        png = "image/png",
        jpg = "image/jpeg",
        jpeg = "image/jpeg",
        svg = "image/svg+xml",
        gif = "image/gif",
        ico = "image/x-icon",
        woff = "font/woff",
        woff2 = "font/woff2"
      )
      ctype <- if (ext %in% names(content_types)) content_types[[ext]] else "application/octet-stream"

      # Read file
      if (ext %in% c("png", "jpg", "jpeg", "gif", "ico", "woff", "woff2")) {
        body <- readBin(file_path, "raw", file.info(file_path)$size)
      } else {
        body <- paste(readLines(file_path, warn = FALSE), collapse = "\n")
      }

      list(
        status = 200L,
        headers = list("Content-Type" = ctype, "Cache-Control" = "no-cache"),
        body = body
      )
    },
    onWSOpen = function(ws) {
      ws$close()
    } # No WebSocket support needed
  )

  # Start server on an available port
  max_attempts <- 50
  attempts <- 0
  server <- NULL

  while (is.null(server) && attempts < max_attempts) {
    tryCatch(
      {
        server <- httpuv::startServer("127.0.0.1", port, app)
      },
      error = function(e) {
        # Port in use, silently continue to the next one
      }
    )
    if (is.null(server)) {
      port <- port + 1
      attempts <- attempts + 1
    }
  }

  if (is.null(server)) {
    stop("Could not find an available port to start the server after ", max_attempts, " attempts.")
  }

  url <- sprintf("http://localhost:%d?autoload=true", port)
  message(sprintf("Server running at: %s", url))
  message("Call httpuv::stopServer(handle) to stop the server when done.")

  # Handle special case for Chrome on Mac
  if (!is.null(browser) && tolower(browser) %in% c("chrome", "google chrome") && Sys.info()["sysname"] == "Darwin") {
    browser <- "open -a 'Google Chrome'"
  }

  # Open browser
  utils::browseURL(url, browser = browser)

  invisible(server)
}
