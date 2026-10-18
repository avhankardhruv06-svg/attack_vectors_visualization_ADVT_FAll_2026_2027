library(shiny)
library(bslib)
library(jsonlite)
library(DT)

# Increase maximum file upload limit to 1000MB (1 GB) for large PCAP files
options(shiny.maxRequestSize = 1000 * 1024^2)

# Attempt to load scenarios
scenario_dir <- "data/scenarios"
scenario_files <- list.files(scenario_dir, full.names = TRUE, pattern = "*.json")

scenarios <- list()
if(length(scenario_files) > 0) {
  scenarios <- lapply(scenario_files, fromJSON)
  names(scenarios) <- sapply(scenarios, function(s) s$name)
}

ui <- page_navbar(
  title = "Attack Path Viz (R Shiny)",
  theme = bs_theme(version = 5, preset = "flatly", bg = "#f8f9fa", fg = "#212529", primary = "#0d6efd"),
  
  tags$head(
    tags$link(rel = "stylesheet", type = "text/css", href = "css/style.css"),
    tags$script(type = "importmap", 
      '{"imports": {"three": "https://unpkg.com/three@0.160.0/build/three.module.js", "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"}}'
    ),
    tags$script(type = "module", src = "js/app.js")
  ),
  
  sidebar = sidebar(
    title = "Controls",
    selectInput("scenario", "Select Scenario:", choices = if(length(scenarios) > 0) names(scenarios) else c("No Data")),
    fileInput("log_upload", "Upload File (.pcap, .pcapng, .json)", accept = c(".pcap", ".pcapng", ".cap", ".json")),
    hr(),
    selectInput("layout_2d", 
      label = tags$span(
        "2D Layout Mode:",
        popover(
          shiny::icon("info-circle", class = "ms-2 text-primary", style = "cursor: pointer;"),
          title = "About 2D Layout Modes",
          tags$div(
            tags$strong("Vector Map (Constellation View):"), " A free-floating map showing organic relationships. Nodes pull together if they interact often.", tags$br(), tags$br(),
            tags$strong("Stage Flow (Storyboard View):"), " Lines up the attack step-by-step from left to right so you can easily follow the sequence of events.", tags$br(), tags$br(),
            tags$strong("Zone Matrix (Blueprint View):"), " Organizes the network by physical or logical 'rooms' (e.g., Internet, DMZ, Internal) to show lateral movement."
          )
        )
      ),
      choices = c(
        "Vector Map (Force-Directed)" = "force",
        "Stage Flow (Non-Overlapping)" = "hierarchical",
        "Zone Matrix (Non-Overlapping)" = "zone"
      )
    ),
    hr(),
    h5("Simulation Playback"),
    actionButton("btn_play", "▶ Play", class = "btn-success w-100 mb-2"),
    actionButton("btn_pause", "⏸ Pause", class = "btn-warning w-100 mb-2"),
    actionButton("btn_step", "⏭ Step", class = "btn-info w-100 mb-2"),
    actionButton("btn_stop", "⏹ Reset", class = "btn-danger w-100 mb-2"),
    sliderInput("speed", "Simulation Speed", min = 0.1, max = 3, value = 1, step = 0.1),
    hr(),
    div(id = "sim_status", "Status: Ready"),
    hr(),
    h5("Scenario Intelligence"),
    uiOutput("scenario_intel_panel")
  ),
  
  nav_panel("Simulation Views", 
    layout_columns(
      col_widths = c(6, 6),
      card(
        full_screen = TRUE,
        card_header("2D Analytical Baseline"),
        tags$div(id = "view-2d", class = "view-surface", style = "height: 600px; width: 100%; position: relative; background: white; border: 1px solid #ddd;",
          tags$div(style = "position: absolute; bottom: 15px; right: 15px; background: rgba(255, 255, 255, 0.95); border: 1px solid #dee2e6; border-radius: 6px; padding: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-size: 12px; z-index: 10; pointer-events: none; display: flex; flex-direction: column; gap: 6px;",
            tags$strong("Node Types", style = "margin-bottom: 4px; color: #212529;"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><polygon points="0,-7 7,7 -7,7" fill="#ef4444" stroke="#fff" stroke-width="1.5"></polygon></svg>'), "Attacker"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><rect x="-6" y="-6" width="12" height="12" rx="2" fill="#3b82f6" stroke="#fff" stroke-width="1.5"></rect></svg>'), "Host"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><circle r="6" fill="#06b6d4" stroke="#fff" stroke-width="1.5"></circle></svg>'), "User"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><polygon points="0,-7 7,0 0,7 -7,0" fill="#f97316" stroke="#fff" stroke-width="1.5"></polygon></svg>'), "Process"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><circle r="6" fill="#d946ef" stroke="#fff" stroke-width="1.5"></circle></svg>'), "Credential"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><rect x="-6" y="-6" width="12" height="12" rx="2" fill="#10b981" stroke="#fff" stroke-width="1.5"></rect></svg>'), "File"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><polygon points="0,-7 6,-3.5 6,3.5 0,7 -6,3.5 -6,-3.5" fill="#8b5cf6" stroke="#fff" stroke-width="1.5"></polygon></svg>'), "Network Endpoint")
          )
        )
      ),
      card(
        full_screen = TRUE,
        card_header("3D Environment (X:Zone Y:Stage Z:Time)"),
        tags$div(id = "view-3d", class = "view-surface", style = "height: 600px; width: 100%; position: relative; background: #eef2f5; border: 1px solid #ddd;",
          tags$div(style = "position: absolute; bottom: 15px; right: 15px; background: rgba(255, 255, 255, 0.95); border: 1px solid #dee2e6; border-radius: 6px; padding: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-size: 12px; z-index: 10; pointer-events: none; display: flex; flex-direction: column; gap: 6px;",
            tags$strong("Node Types", style = "margin-bottom: 4px; color: #212529;"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><polygon points="0,-7 7,7 -7,7" fill="#ef4444" stroke="#fff" stroke-width="1.5"></polygon></svg>'), "Attacker"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><rect x="-6" y="-6" width="12" height="12" rx="2" fill="#3b82f6" stroke="#fff" stroke-width="1.5"></rect></svg>'), "Host"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><circle r="6" fill="#06b6d4" stroke="#fff" stroke-width="1.5"></circle></svg>'), "User"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><polygon points="0,-7 7,0 0,7 -7,0" fill="#f97316" stroke="#fff" stroke-width="1.5"></polygon></svg>'), "Process"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><circle r="6" fill="#d946ef" stroke="#fff" stroke-width="1.5"></circle></svg>'), "Credential"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><rect x="-6" y="-6" width="12" height="12" rx="2" fill="#10b981" stroke="#fff" stroke-width="1.5"></rect></svg>'), "File"),
            tags$div(style = "display: flex; align-items: center; gap: 8px;", HTML('<svg width="16" height="16" viewBox="-8 -8 16 16"><polygon points="0,-7 6,-3.5 6,3.5 0,7 -6,3.5 -6,-3.5" fill="#8b5cf6" stroke="#fff" stroke-width="1.5"></polygon></svg>'), "Network Endpoint")
          )
        )
      )
    ),
    layout_columns(
      col_widths = c(6, 6),
      card(
        card_header(
          tags$span(
            "Device / Node List",
            popover(
              shiny::icon("info-circle", class = "ms-2 text-primary", style = "cursor: pointer;"),
              title = "What is a Device/Node?",
              "This list shows all the computers, users, and files in the network. It tells you their current status, like whether they are safe or have been compromised."
            )
          )
        ),
        DTOutput("device_table")
      ),
      card(
        card_header(
          tags$span(
            "Process / Activity List",
            popover(
              shiny::icon("info-circle", class = "ms-2 text-primary", style = "cursor: pointer;"),
              title = "What is a Process/Activity?",
              "This list shows the step-by-step actions taking place. It tracks what the attacker is doing, like moving between computers or accessing files, in the order it happens."
            )
          )
        ),
        DTOutput("process_table")
      )
    )
  )
)

server <- function(input, output, session) {
  
  current_scenario <- reactiveVal()
  active_nodes <- reactiveVal(character(0))
  active_edges <- reactiveVal(list())
  
  observeEvent(input$scenario, {
    req(input$scenario)
    if(input$scenario %in% names(scenarios)) {
      scen <- scenarios[[input$scenario]]
      current_scenario(scen)
      session$sendCustomMessage("load_scenario_json", toJSON(scen, auto_unbox = TRUE))
      active_nodes(character(0))
      active_edges(list())
    }
  })
  
  observeEvent(input$log_upload, {
    req(input$log_upload)
    filepath <- input$log_upload$datapath
    filename <- tolower(input$log_upload$name)
    
    data <- NULL
    
    # Check if the uploaded file is a PCAP / packet capture
    if (grepl("\\.(pcap|pcapng|cap)$", filename)) {
      showNotification("Processing PCAP network traffic...", type = "message", duration = 3)
      tmp_json <- tempfile(fileext = ".json")
      
      # Execute Python pcap processor
      cmd <- sprintf('python "pcap_processor.py" "%s" "%s"', filepath, tmp_json)
      exit_code <- system(cmd)
      
      if (exit_code == 0 && file.exists(tmp_json)) {
        tryCatch({
          data <- fromJSON(tmp_json)
          showNotification(paste("PCAP processed successfully:", length(data$nodes), "nodes,", length(data$edges), "flows."), type = "message", duration = 5)
        }, error = function(e) {
          showNotification(paste("Error reading parsed PCAP JSON:", e$message), type = "error")
        })
      } else {
        showNotification("Failed to parse PCAP file. Please ensure Python and Scapy are installed.", type = "error", duration = 6)
      }
    } else {
      # Direct JSON upload
      tryCatch({
        data <- fromJSON(filepath)
      }, error = function(e) {
        showNotification(paste("Invalid JSON file:", e$message), type = "error")
      })
    }
    
    if(!is.null(data) && !is.null(data$nodes) && !is.null(data$edges)) {
      current_scenario(data)
      session$sendCustomMessage("load_scenario_json", toJSON(data, auto_unbox = TRUE))
      active_nodes(character(0))
      active_edges(list())
    }
  })
  
  observeEvent(input$btn_play, { session$sendCustomMessage("sim_control", "play") })
  observeEvent(input$btn_pause, { session$sendCustomMessage("sim_control", "pause") })
  observeEvent(input$btn_stop, { session$sendCustomMessage("sim_control", "reset") })
  observeEvent(input$btn_step, { session$sendCustomMessage("sim_control", "step") })
  observeEvent(input$speed, { session$sendCustomMessage("sim_speed", input$speed) })
  observeEvent(input$layout_2d, { session$sendCustomMessage("set_layout_2d", input$layout_2d) })
  
  observeEvent(input$js_active_nodes, {
    active_nodes(input$js_active_nodes)
  })
  
  observeEvent(input$js_active_edges_json, {
    if (is.character(input$js_active_edges_json) && input$js_active_edges_json != "") {
      active_edges(fromJSON(input$js_active_edges_json))
    } else {
      active_edges(data.frame())
    }
  })
  
  output$device_table <- renderDT({
    req(current_scenario())
    nodes_raw <- current_scenario()$nodes
    if (is.data.frame(nodes_raw)) {
      nodes_df <- nodes_raw
    } else {
      nodes_df <- as.data.frame(do.call(rbind, lapply(nodes_raw, as.data.frame)))
    }
    
    if (nrow(nodes_df) > 0) {
      for(i in 1:ncol(nodes_df)) nodes_df[[i]] <- as.character(nodes_df[[i]])
      if (length(active_nodes()) > 0) {
        nodes_df$Status <- ifelse(nodes_df$id %in% active_nodes(), "Active/Compromised", nodes_df$state)
      } else {
        nodes_df$Status <- nodes_df$state
      }
      datatable(nodes_df[, c("id", "type", "zone", "Status")], options = list(pageLength = 5))
    }
  })
  
  output$process_table <- renderDT({
    req(current_scenario())
    edges_raw <- current_scenario()$edges
    if (is.data.frame(edges_raw)) {
      edges_df <- edges_raw
    } else {
      edges_df <- as.data.frame(do.call(rbind, lapply(edges_raw, as.data.frame)))
    }
    
    if (nrow(edges_df) > 0) {
      for(i in 1:ncol(edges_df)) edges_df[[i]] <- as.character(edges_df[[i]])
      played_edges <- active_edges()
      if (is.data.frame(played_edges) && nrow(played_edges) > 0) {
        edges_df <- played_edges
      }
      datatable(edges_df[, c("source", "target", "type", "stage", "timestamp")], options = list(pageLength = 5, order = list(list(4, 'desc'))))
    }
  })
  
  output$scenario_intel_panel <- renderUI({
    scen <- current_scenario()
    if (is.null(scen)) {
      return(tags$div(class = "text-muted small", "No active scenario loaded. Select one above or upload a PCAP."))
    }
    
    desc <- scen$description
    if (is.null(desc) || desc == "") {
      # Fallback generate summary from nodes and edges
      nodes_count <- if(is.data.frame(scen$nodes)) nrow(scen$nodes) else length(scen$nodes)
      edges_count <- if(is.data.frame(scen$edges)) nrow(scen$edges) else length(scen$edges)
      desc <- paste("Scenario:", scen$name, sprintf("(%d devices, %d interactions)", nodes_count, edges_count))
    }
    
    # Split description lines if bullet formatted
    lines <- strsplit(desc, "\n")[[1]]
    
    tags$div(
      style = "background: #ffffff; border: 1px solid #ced4da; border-radius: 6px; padding: 10px; font-size: 12px; line-height: 1.45;",
      tags$strong(style = "color: #0d6efd; display: block; margin-bottom: 6px;", scen$name),
      lapply(lines, function(line) {
        tags$div(style = "margin-bottom: 4px; color: #333;", line)
      })
    )
  })
}

shinyApp(ui, server)
