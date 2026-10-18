library(jsonlite)

dir.create("data/scenarios", recursive = TRUE, showWarnings = FALSE)

# Helper function to generate a scenario
generate_scenario <- function(name, branches, complexity) {
  nodes <- list()
  edges <- list()
  
  t <- 0
  
  node_count <- 0
  add_node <- function(type, zone, label, state = "Normal", desc = NULL) {
    id <- paste0(type, "-", node_count)
    node_count <<- node_count + 1
    
    if (is.null(desc)) {
      if (type == "attacker") {
        desc <- paste("External threat actor (", label, ") initiating malicious infiltration from the Internet zone.")
      } else if (type == "network_endpoint") {
        desc <- paste("Perimeter gateway (", label, ") in DMZ targeted for initial exploitation and network entry.")
      } else if (type == "host") {
        desc <- paste("Target endpoint (", label, ") compromised to execute unauthorized payloads and pivot laterally.")
      } else if (type == "credential") {
        desc <- paste("Harvested authentication artifact (", label, ") extracted to bypass security boundaries.")
      } else if (type == "process") {
        desc <- paste("Malicious binary execution (", label, ") performing credential dumping and stealth activities.")
      } else if (type == "file") {
        desc <- paste("Data artifact (", label, ") targeted for unauthorized modification, staging, or encryption.")
      } else if (type == "user") {
        desc <- paste("Compromised identity (", label, ") hijacked for domain privilege escalation.")
      } else {
        desc <- paste(label, "serves as a critical node in the incident kill chain.")
      }
    }
    
    nodes[[length(nodes) + 1]] <<- list(
      id = id, type = type, zone = zone, label = label, state = state, description = desc
    )
    return(id)
  }
  
  add_edge <- function(source, target, type, stage, confidence, dt = sample(20:240, 1)) {
    t <<- t + dt
    edges[[length(edges) + 1]] <<- list(
      source = source, target = target, type = type, stage = stage, 
      timestamp = t, confidence = confidence
    )
  }
  
  # Base chain based on complexity
  attacker <- add_node("attacker", "Internet", paste("Attacker", name))
  endpoint <- add_node("network_endpoint", "DMZ", "Gateway")
  
  add_edge(attacker, endpoint, "phishing", "Initial Access", 0.7)
  
  current_node <- endpoint
  
  if (complexity == "High") {
    ws <- add_node("host", "Corp-LAN", "Workstation")
    add_edge(current_node, ws, "exploit", "Initial Access", 0.8)
    current_node <- ws
  }
  
  cred <- add_node("credential", "Corp-LAN", "Stolen Hash")
  add_edge(current_node, cred, "credential-dump", "Credential Theft", 0.9)
  
  server <- add_node("host", "Server-VLAN", "Critical Server", state = "Impacted")
  add_edge(cred, server, "smb-logon", "Lateral Movement", 0.85)
  
  # Decoy branches
  for (b in 1:branches) {
    alt_attacker <- add_node("attacker", "Internet", paste("Suspicious", b))
    alt_ep <- add_node("network_endpoint", "DMZ", paste("FW-0", b))
    add_edge(alt_attacker, alt_ep, "port-scan", "Initial Access", 0.4)
    add_edge(alt_ep, cred, "credential-spray", "Credential Theft", 0.3)
  }
  
  list(name = name, nodes = nodes, edges = edges)
}

# Generate 10 scenarios
scenarios <- list(
  generate_scenario("Ransomware Spread", 2, "High"),
  generate_scenario("DDoS Attempt", 0, "Low"),
  generate_scenario("Insider Exfiltration", 1, "Medium"),
  generate_scenario("Lateral Movement", 3, "High"),
  generate_scenario("Phishing Campaign", 4, "Medium"),
  generate_scenario("Zero-Day Exploit", 1, "High"),
  generate_scenario("Brute Force Attack", 5, "Low"),
  generate_scenario("Data Breach", 2, "High"),
  generate_scenario("Supply Chain Compromise", 1, "Medium"),
  generate_scenario("Malware Infection", 0, "Low")
)

for (i in 1:10) {
  filename <- sprintf("data/scenarios/scenario_%02d.json", i)
  write_json(scenarios[[i]], filename, auto_unbox = TRUE, pretty = TRUE)
}
print("10 scenarios generated.")
