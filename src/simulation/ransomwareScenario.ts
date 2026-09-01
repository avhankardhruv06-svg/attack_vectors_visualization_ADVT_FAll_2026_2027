// Deterministic Multi-Stage Ransomware Incident Scenario
// Incident ID: INC-2026-0901-RANSOMWARE-ALPHA
// Target Impacted Asset: FILE-SERVER-01
import { RawSecurityEvent } from './types';

// Base timestamp: 2026-09-01 10:00:00 UTC (in seconds)
const T0 = 1756720800; // 10:00:00

export const DETERMINISTIC_RANSOMWARE_EVENTS: RawSecurityEvent[] = [
  // -------------------------------------------------------------
  // STAGE 1: INITIAL ACCESS (Branch A: Spearphishing - High Conf)
  // -------------------------------------------------------------
  {
    id: 'EVT-001',
    timestamp: T0 + 120, // 10:02:00
    timestampStr: '10:02:00',
    sourceEntity: {
      id: 'THREAT-ACTOR-FIN7',
      label: 'APT-FinOps (External)',
      type: 'ATTACKER',
      zone: 'EXTERNAL_INTERNET',
      state: 'COMPROMISED',
      properties: { ip: '185.220.101.5', country: 'RU', c2Infrastructure: 'CobaltStrike-4.9' },
    },
    targetEntity: {
      id: 'USER-BOB-MARKETING',
      label: 'bob.marketing (User)',
      type: 'USER',
      zone: 'CORP_WORKSTATION',
      state: 'SUSPICIOUS',
      properties: { email: 'bob.m@megacorp.internal', role: 'Marketing Lead', department: 'Marketing' },
    },
    relationshipType: 'PHISHED',
    stage: 'INITIAL_ACCESS',
    confidence: 0.92,
    severity: 'HIGH',
    sourceSystem: 'Email Gateway Proofpoint',
    description: 'Spearphishing email with malicious attachment Invoice_Q3_9941.pdf.iso delivered to mailbox',
    mitreTactic: 'Initial Access',
    mitreTechnique: 'T1566.001 (Spearphishing Attachment)',
  },

  // STAGE 1: INITIAL ACCESS (Branch B: External VPN Gateway Exploit - Alternative Vector)
  {
    id: 'EVT-002',
    timestamp: T0 + 240, // 10:04:00
    timestampStr: '10:04:00',
    sourceEntity: {
      id: 'THREAT-ACTOR-FIN7',
      label: 'APT-FinOps (External)',
      type: 'ATTACKER',
      zone: 'EXTERNAL_INTERNET',
      state: 'COMPROMISED',
      properties: { ip: '185.220.101.5' },
    },
    targetEntity: {
      id: 'GW-SSL-VPN-01',
      label: 'GATEWAY-01 (VPN)',
      type: 'HOST',
      zone: 'DMZ',
      state: 'SUSPICIOUS',
      properties: { ip: '198.51.100.25', model: 'Ivanti Connect Secure', cveId: 'CVE-2024-21887' },
    },
    relationshipType: 'EXPLOITED',
    stage: 'INITIAL_ACCESS',
    confidence: 0.65,
    severity: 'HIGH',
    sourceSystem: 'Palo Alto Perimeter FW',
    description: 'Anomalous POST request targeting vulnerable VPN management endpoint bypass',
    mitreTactic: 'Initial Access',
    mitreTechnique: 'T1190 (Exploit Public-Facing Application)',
  },

  // STAGE 1: INITIAL ACCESS (Branch C: Stolen AWS Developer Token - Speculative Vector)
  {
    id: 'EVT-003',
    timestamp: T0 + 300, // 10:05:00
    timestampStr: '10:05:00',
    sourceEntity: {
      id: 'THREAT-ACTOR-FIN7',
      label: 'APT-FinOps (External)',
      type: 'ATTACKER',
      zone: 'EXTERNAL_INTERNET',
      state: 'COMPROMISED',
      properties: { ip: '185.220.101.5' },
    },
    targetEntity: {
      id: 'CLOUD-AWS-S3-DEV',
      label: 'S3-Dev-Bucket (Cloud)',
      type: 'NETWORK_ENDPOINT',
      zone: 'DMZ',
      state: 'SUSPICIOUS',
      properties: { uri: 's3://megacorp-ci-builds', leakedKey: 'AKIA...99XJ' },
    },
    relationshipType: 'ACCESSED',
    stage: 'INITIAL_ACCESS',
    confidence: 0.38,
    severity: 'MEDIUM',
    sourceSystem: 'AWS CloudTrail',
    description: 'Unusual S3 GetObject request using orphaned CI/CD developer token',
    mitreTactic: 'Initial Access',
    mitreTechnique: 'T1078.004 (Cloud Accounts)',
  },

  // -------------------------------------------------------------
  // STAGE 2: EXECUTION & WORKSTATION COMPROMISE
  // -------------------------------------------------------------
  {
    id: 'EVT-004',
    timestamp: T0 + 360, // 10:06:00
    timestampStr: '10:06:00',
    sourceEntity: {
      id: 'USER-BOB-MARKETING',
      label: 'bob.marketing (User)',
      type: 'USER',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: { username: 'bob.marketing' },
    },
    targetEntity: {
      id: 'HOST-WS-FIN-02',
      label: 'WS-FIN-02 (Workstation)',
      type: 'HOST',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: { ip: '10.20.4.52', hostname: 'WS-FIN-02.megacorp.internal', os: 'Windows 11 Pro 23H2' },
    },
    relationshipType: 'AUTHENTICATED_AS',
    stage: 'EXECUTION',
    confidence: 0.95,
    severity: 'HIGH',
    sourceSystem: 'Active Directory Kerberos Log',
    description: 'User logged in interactively and mounted phishing ISO payload',
    mitreTactic: 'Execution',
    mitreTechnique: 'T1204.002 (Malicious File)',
  },
  {
    id: 'EVT-005',
    timestamp: T0 + 420, // 10:07:00
    timestampStr: '10:07:00',
    sourceEntity: {
      id: 'HOST-WS-FIN-02',
      label: 'WS-FIN-02 (Workstation)',
      type: 'HOST',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: { ip: '10.20.4.52' },
    },
    targetEntity: {
      id: 'PROC-POWERSHELL-9104',
      label: 'powershell.exe (PID: 9104)',
      type: 'PROCESS',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: {
        pid: 9104,
        commandLine: 'powershell.exe -nop -w hidden -enc JABzAD0ATgBlAHcALQBPAGIAagBlAGMAdAA...',
        parentPid: 4210,
        parentProcess: 'explorer.exe',
      },
    },
    relationshipType: 'SPAWNED',
    stage: 'EXECUTION',
    confidence: 0.94,
    severity: 'HIGH',
    sourceSystem: 'CrowdStrike Falcon EDR',
    description: 'Obfuscated PowerShell spawned from explorer after archive extraction',
    mitreTactic: 'Execution',
    mitreTechnique: 'T1059.001 (PowerShell)',
  },
  {
    id: 'EVT-006',
    timestamp: T0 + 500, // 10:08:20
    timestampStr: '10:08:20',
    sourceEntity: {
      id: 'PROC-POWERSHELL-9104',
      label: 'powershell.exe (PID: 9104)',
      type: 'PROCESS',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: { pid: 9104 },
    },
    targetEntity: {
      id: 'FILE-BEACON-EXE',
      label: 'svchost_update.exe (Beacon)',
      type: 'FILE',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: {
        filePath: 'C:\\Users\\bob.m\\AppData\\Local\\Temp\\svchost_update.exe',
        fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        fileSize: '412 KB',
      },
    },
    relationshipType: 'FILE_MODIFICATION',
    stage: 'EXECUTION',
    confidence: 0.91,
    severity: 'HIGH',
    sourceSystem: 'CrowdStrike Falcon EDR',
    description: 'Dropped second-stage payload binary in AppData temp directory',
    mitreTactic: 'Execution',
    mitreTechnique: 'T1105 (Ingress Tool Transfer)',
  },

  // -------------------------------------------------------------
  // STAGE 3: CREDENTIAL ACCESS & PRIVILEGE ESCALATION
  // -------------------------------------------------------------
  {
    id: 'EVT-007',
    timestamp: T0 + 660, // 10:11:00
    timestampStr: '10:11:00',
    sourceEntity: {
      id: 'FILE-BEACON-EXE',
      label: 'svchost_update.exe (Beacon)',
      type: 'FILE',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: { filePath: 'C:\\Users\\bob.m\\AppData\\Local\\Temp\\svchost_update.exe' },
    },
    targetEntity: {
      id: 'PROC-LSASS-INJECTION',
      label: 'lsass.exe (Injected PID: 680)',
      type: 'PROCESS',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: { pid: 680, injectedBy: 9104, memoryProtection: 'PAGE_EXECUTE_READWRITE' },
    },
    relationshipType: 'INJECTED',
    stage: 'CREDENTIAL_ACCESS',
    confidence: 0.90,
    severity: 'CRITICAL',
    sourceSystem: 'CrowdStrike Falcon EDR',
    description: 'Process injection into LSASS memory space via OpenProcess / VirtualAllocEx',
    mitreTactic: 'Credential Access',
    mitreTechnique: 'T1055 (Process Injection)',
  },
  {
    id: 'EVT-008',
    timestamp: T0 + 780, // 10:13:00
    timestampStr: '10:13:00',
    sourceEntity: {
      id: 'PROC-LSASS-INJECTION',
      label: 'lsass.exe (Injected PID: 680)',
      type: 'PROCESS',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: { pid: 680 },
    },
    targetEntity: {
      id: 'CRED-ADMIN-HELPDESK',
      label: 'admin_helpdesk (NTLM Hash)',
      type: 'CREDENTIAL',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: {
        username: 'admin_helpdesk',
        domain: 'MEGACORP',
        hashType: 'NTLM',
        privilege: 'ELEVATED',
      },
    },
    relationshipType: 'DUMPED_CREDENTIAL',
    stage: 'CREDENTIAL_ACCESS',
    confidence: 0.93,
    severity: 'CRITICAL',
    sourceSystem: 'Windows Security Event Log 4624/4672',
    description: 'Extracted cached NTLM hash of Tier-2 Helpdesk Administrator from memory',
    mitreTactic: 'Credential Access',
    mitreTechnique: 'T1003.001 (LSASS Memory)',
  },
  {
    id: 'EVT-009',
    timestamp: T0 + 840, // 10:14:00
    timestampStr: '10:14:00',
    sourceEntity: {
      id: 'PROC-LSASS-INJECTION',
      label: 'lsass.exe (Injected PID: 680)',
      type: 'PROCESS',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: { pid: 680 },
    },
    targetEntity: {
      id: 'CRED-SVC-BACKUP',
      label: 'svc_backup (Kerberos TGT)',
      type: 'CREDENTIAL',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: {
        username: 'svc_backup',
        domain: 'MEGACORP',
        privilege: 'DOMAIN_ADMIN',
        spn: 'MSSQLSvc/FILE-SERVER-01',
      },
    },
    relationshipType: 'DUMPED_CREDENTIAL',
    stage: 'CREDENTIAL_ACCESS',
    confidence: 0.88,
    severity: 'CRITICAL',
    sourceSystem: 'Kerberos KDC Log 4768',
    description: 'Extracted service account Kerberos ticket granting Domain Backup operator privileges',
    mitreTactic: 'Credential Access',
    mitreTechnique: 'T1558.003 (Kerberoasting / Ticket Extraction)',
  },

  // -------------------------------------------------------------
  // STAGE 4: LATERAL MOVEMENT (Pivoting through Admin Workstation & DC)
  // -------------------------------------------------------------
  {
    id: 'EVT-010',
    timestamp: T0 + 1020, // 10:17:00
    timestampStr: '10:17:00',
    sourceEntity: {
      id: 'CRED-ADMIN-HELPDESK',
      label: 'admin_helpdesk (NTLM Hash)',
      type: 'CREDENTIAL',
      zone: 'CORP_WORKSTATION',
      state: 'LATERAL_MOVEMENT_SOURCE',
      properties: { username: 'admin_helpdesk' },
    },
    targetEntity: {
      id: 'HOST-WS-ADMIN-01',
      label: 'WS-ADMIN-01 (IT Workstation)',
      type: 'HOST',
      zone: 'CORP_WORKSTATION',
      state: 'COMPROMISED',
      properties: { ip: '10.20.1.15', hostname: 'WS-ADMIN-01.megacorp.internal' },
    },
    relationshipType: 'REMOTE_EXECUTION',
    stage: 'LATERAL_MOVEMENT',
    confidence: 0.89,
    severity: 'CRITICAL',
    sourceSystem: 'Sysmon Event ID 1 (PsExec Service)',
    description: 'Pass-the-Hash execution via PsExec service spawning remote cmd session',
    mitreTactic: 'Lateral Movement',
    mitreTechnique: 'T1570 (Lateral Tool Transfer) / T1021.002 (SMB/Windows Admin Shares)',
  },
  {
    id: 'EVT-011',
    timestamp: T0 + 1200, // 10:20:00
    timestampStr: '10:20:00',
    sourceEntity: {
      id: 'HOST-WS-ADMIN-01',
      label: 'WS-ADMIN-01 (IT Workstation)',
      type: 'HOST',
      zone: 'CORP_WORKSTATION',
      state: 'LATERAL_MOVEMENT_SOURCE',
      properties: { ip: '10.20.1.15' },
    },
    targetEntity: {
      id: 'HOST-DC-CORP-01',
      label: 'DC-CORP-01 (Domain Controller)',
      type: 'HOST',
      zone: 'INTERNAL_SERVERS',
      state: 'COMPROMISED',
      properties: { ip: '10.10.1.5', role: 'Primary Domain Controller', domain: 'MEGACORP.INTERNAL' },
    },
    relationshipType: 'LATERAL_PIVOT',
    stage: 'LATERAL_MOVEMENT',
    confidence: 0.87,
    severity: 'CRITICAL',
    sourceSystem: 'Active Directory Event 4624 (Type 10 RDP)',
    description: 'Network logon to Domain Controller using stolen helpdesk session token',
    mitreTactic: 'Lateral Movement',
    mitreTechnique: 'T1021.001 (Remote Desktop Protocol)',
  },

  // Alternative Lateral Path: Direct SSH / RDP from VPN Gateway (Lower Confidence)
  {
    id: 'EVT-012',
    timestamp: T0 + 1300, // 10:21:40
    timestampStr: '10:21:40',
    sourceEntity: {
      id: 'GW-SSL-VPN-01',
      label: 'GATEWAY-01 (VPN)',
      type: 'HOST',
      zone: 'DMZ',
      state: 'SUSPICIOUS',
      properties: { ip: '198.51.100.25' },
    },
    targetEntity: {
      id: 'HOST-DC-CORP-01',
      label: 'DC-CORP-01 (Domain Controller)',
      type: 'HOST',
      zone: 'INTERNAL_SERVERS',
      state: 'COMPROMISED',
      properties: { ip: '10.10.1.5' },
    },
    relationshipType: 'REMOTE_EXECUTION',
    stage: 'LATERAL_MOVEMENT',
    confidence: 0.52,
    severity: 'MEDIUM',
    sourceSystem: 'Internal Firewall Log',
    description: 'Tunnelled TCP 3389 session from VPN Gateway DMZ to Domain Controller',
    mitreTactic: 'Lateral Movement',
    mitreTechnique: 'T1021.001 (Remote Services)',
  },

  // -------------------------------------------------------------
  // STAGE 5: FILE SERVER ACCESS & PREPARATION
  // -------------------------------------------------------------
  {
    id: 'EVT-013',
    timestamp: T0 + 1500, // 10:25:00
    timestampStr: '10:25:00',
    sourceEntity: {
      id: 'CRED-SVC-BACKUP',
      label: 'svc_backup (Kerberos TGT)',
      type: 'CREDENTIAL',
      zone: 'CORP_WORKSTATION',
      state: 'LATERAL_MOVEMENT_SOURCE',
      properties: { username: 'svc_backup' },
    },
    targetEntity: {
      id: 'HOST-FILE-SERVER-01',
      label: 'FILE-SERVER-01 (Enterprise NAS/SAN)',
      type: 'HOST',
      zone: 'CRITICAL_DATA_CENTER',
      state: 'COMPROMISED',
      properties: {
        ip: '10.10.5.20',
        hostname: 'FILE-SERVER-01.megacorp.internal',
        os: 'Windows Server 2022 Datacenter',
        totalStorage: '48 TB',
        criticalData: true,
      },
    },
    relationshipType: 'AUTHENTICATED_AS',
    stage: 'LATERAL_MOVEMENT',
    confidence: 0.94,
    severity: 'CRITICAL',
    sourceSystem: 'Security Event Log 4624 (Type 3 Network Auth)',
    description: 'Privileged authentication as svc_backup to File Server IPC$ and C$ shares',
    mitreTactic: 'Lateral Movement',
    mitreTechnique: 'T1078.002 (Domain Accounts)',
  },
  {
    id: 'EVT-014',
    timestamp: T0 + 1620, // 10:27:00
    timestampStr: '10:27:00',
    sourceEntity: {
      id: 'HOST-DC-CORP-01',
      label: 'DC-CORP-01 (Domain Controller)',
      type: 'HOST',
      zone: 'INTERNAL_SERVERS',
      state: 'COMPROMISED',
      properties: { ip: '10.10.1.5' },
    },
    targetEntity: {
      id: 'HOST-FILE-SERVER-01',
      label: 'FILE-SERVER-01 (Enterprise NAS/SAN)',
      type: 'HOST',
      zone: 'CRITICAL_DATA_CENTER',
      state: 'COMPROMISED',
      properties: { ip: '10.10.5.20' },
    },
    relationshipType: 'REMOTE_EXECUTION',
    stage: 'LATERAL_MOVEMENT',
    confidence: 0.88,
    severity: 'HIGH',
    sourceSystem: 'WMI Activity Event 5861',
    description: 'Remote WMI process creation targeting Win32_Process on FILE-SERVER-01',
    mitreTactic: 'Execution',
    mitreTechnique: 'T1047 (Windows Management Instrumentation)',
  },

  // -------------------------------------------------------------
  // STAGE 6: INHIBIT DEFENSES & FILE MODIFICATION
  // -------------------------------------------------------------
  {
    id: 'EVT-015',
    timestamp: T0 + 1800, // 10:30:00
    timestampStr: '10:30:00',
    sourceEntity: {
      id: 'HOST-FILE-SERVER-01',
      label: 'FILE-SERVER-01 (Enterprise NAS/SAN)',
      type: 'HOST',
      zone: 'CRITICAL_DATA_CENTER',
      state: 'COMPROMISED',
      properties: { ip: '10.10.5.20' },
    },
    targetEntity: {
      id: 'PROC-VSSADMIN-DELETE',
      label: 'vssadmin.exe (Shadow Copy Deletion)',
      type: 'PROCESS',
      zone: 'CRITICAL_DATA_CENTER',
      state: 'IMPACTED',
      properties: {
        pid: 8820,
        commandLine: 'vssadmin.exe delete shadows /all /quiet',
        exitCode: 0,
      },
    },
    relationshipType: 'SPAWNED',
    stage: 'IMPACT',
    confidence: 0.96,
    severity: 'CRITICAL',
    sourceSystem: 'Microsoft Defender for Endpoint',
    description: 'Execution of vssadmin to permanently destroy Volume Shadow Copies and backups',
    mitreTactic: 'Impact',
    mitreTechnique: 'T1490 (Inhibit System Recovery)',
  },
  {
    id: 'EVT-016',
    timestamp: T0 + 1950, // 10:32:30
    timestampStr: '10:32:30',
    sourceEntity: {
      id: 'PROC-VSSADMIN-DELETE',
      label: 'vssadmin.exe (Shadow Copy Deletion)',
      type: 'PROCESS',
      zone: 'CRITICAL_DATA_CENTER',
      state: 'IMPACTED',
      properties: { pid: 8820 },
    },
    targetEntity: {
      id: 'PROC-LOCKBIT-PAYLOAD',
      label: 'lockbit3_x64.exe (Ransomware Executable)',
      type: 'PROCESS',
      zone: 'CRITICAL_DATA_CENTER',
      state: 'IMPACTED',
      properties: {
        pid: 10444,
        threads: 32,
        encryptionAlgorithm: 'ChaCha20-Poly1305 + RSA-4096',
        commandLine: 'C:\\Windows\\Temp\\lockbit3_x64.exe -pass 99a8f2',
      },
    },
    relationshipType: 'SPAWNED',
    stage: 'IMPACT',
    confidence: 0.98,
    severity: 'CRITICAL',
    sourceSystem: 'EDR Anti-Ransomware Behavioral Shield',
    description: 'High-throughput multi-threaded ransomware binary process spawned',
    mitreTactic: 'Impact',
    mitreTechnique: 'T1486 (Data Encrypted for Impact)',
  },

  // -------------------------------------------------------------
  // STAGE 7: FINAL IMPACT (Target File Server Shares Encrypted)
  // -------------------------------------------------------------
  {
    id: 'EVT-017',
    timestamp: T0 + 2100, // 10:35:00
    timestampStr: '10:35:00',
    sourceEntity: {
      id: 'PROC-LOCKBIT-PAYLOAD',
      label: 'lockbit3_x64.exe (Ransomware Executable)',
      type: 'PROCESS',
      zone: 'CRITICAL_DATA_CENTER',
      state: 'IMPACTED',
      properties: { pid: 10444 },
    },
    targetEntity: {
      id: 'SHARE-FINANCE-DATA',
      label: 'SHARE_FINANCE (*.LOCKED)',
      type: 'FILE',
      zone: 'CRITICAL_DATA_CENTER',
      state: 'IMPACTED',
      properties: {
        sharePath: '\\\\FILE-SERVER-01\\SHARE_FINANCE\\',
        filesEncrypted: 184502,
        ransomNotePath: '\\\\FILE-SERVER-01\\SHARE_FINANCE\\HOW_TO_DECRYPT_MY_FILES.txt',
        lockedExtension: '.LOCKED_99A8',
      },
    },
    relationshipType: 'RANSOMWARE_ENCRYPT',
    stage: 'IMPACT',
    confidence: 0.99,
    severity: 'CRITICAL',
    sourceSystem: 'File Server FSRM & SIEM Alert',
    description: 'Mass file renaming and cryptographic destruction across corporate finance network shares',
    mitreTactic: 'Impact',
    mitreTechnique: 'T1486 (Data Encrypted for Impact)',
  },
  {
    id: 'EVT-018',
    timestamp: T0 + 2160, // 10:36:00
    timestampStr: '10:36:00',
    sourceEntity: {
      id: 'PROC-LOCKBIT-PAYLOAD',
      label: 'lockbit3_x64.exe (Ransomware Executable)',
      type: 'PROCESS',
      zone: 'CRITICAL_DATA_CENTER',
      state: 'IMPACTED',
      properties: { pid: 10444 },
    },
    targetEntity: {
      id: 'DB-SQL-CUSTOMER-RECORDS',
      label: 'SQL_CUSTOMER_DB (Database)',
      type: 'FILE',
      zone: 'CRITICAL_DATA_CENTER',
      state: 'IMPACTED',
      properties: {
        databaseName: 'CUSTOMER_MASTER_DB',
        instance: 'MSSQLSERVER',
        state: 'OFFLINE_CORRUPTED',
      },
    },
    relationshipType: 'RANSOMWARE_ENCRYPT',
    stage: 'IMPACT',
    confidence: 0.97,
    severity: 'CRITICAL',
    sourceSystem: 'SQL Server Error Log',
    description: 'Database MDF and LDF transaction files locked and header encrypted',
    mitreTactic: 'Impact',
    mitreTechnique: 'T1486 (Data Encrypted for Impact)',
  },
  {
    id: 'EVT-019',
    timestamp: T0 + 2280, // 10:38:00
    timestampStr: '10:38:00',
    sourceEntity: {
      id: 'PROC-LOCKBIT-PAYLOAD',
      label: 'lockbit3_x64.exe (Ransomware Executable)',
      type: 'PROCESS',
      zone: 'CRITICAL_DATA_CENTER',
      state: 'IMPACTED',
      properties: { pid: 10444 },
    },
    targetEntity: {
      id: 'EP-C2-EXFIL-TOR',
      label: 'C2-Exfil-Node (Tor Relay)',
      type: 'NETWORK_ENDPOINT',
      zone: 'EXTERNAL_INTERNET',
      state: 'COMPROMISED',
      properties: { ip: '185.165.170.82', protocol: 'HTTPS / TLS 1.3', port: 443, dataExfiltrated: '12.4 GB' },
    },
    relationshipType: 'C2_BEACON',
    stage: 'COLLECTION_EXFIL',
    confidence: 0.81,
    severity: 'HIGH',
    sourceSystem: 'Zscaler Cloud Proxy Alert',
    description: 'Double extortion payload exfiltration of encryption keys and sensitive documents to C2 server',
    mitreTactic: 'Exfiltration',
    mitreTechnique: 'T1048 (Exfiltration Over Alternative Protocol)',
  },
];
