# ==============================================================================
# SCRIPT DE RESPALDO Y CARGA SEGURA A CLOUDFLARE R2
# PROYECTO: BarberAgency (V16)
# ==============================================================================

# Mitigación de protección de sobreescritura:
# ATOMIC_OVERWRITE_PROTECTION = UNAVAILABLE
# (La protección no es atómica por hardware/API; se mitiga mediante list-objects-v2
# previo a la subida y el uso de UUIDs en la nomenclatura para evitar colisiones).

param(
    [switch]$TestStaticParsersOnly,
    [string]$TASK005_GATE = "GATE_B_STATIC_IMPLEMENTATION_ONLY",
    [string]$TEMP_ENVIRONMENT_ID = "",
    [string]$TEMP_DATABASE_NAME = "",
    [string]$SESSION_ROLE = "",
    [string]$LOCAL_VALIDATION_ROLE = "",
    [string]$TEMP_DATABASE_OWNER_ROLE = "",
    [string]$RESTORE_EXECUTION_ROLE = "",
    [string]$ADMINISTRATION_ROLE = "",
    [string[]]$ALLOWED_RESTORED_SCHEMAS = @(),
    [string[]]$PRODUCTION_BLOCKLIST = @(),
    [string]$R2_BLOCK_MODE = "FORCED_BLOCKED"
)

# ==============================================================================
# INICIALIZACIÓN DE TODAS LAS RUTAS Y VARIABLES (Pre-Try)
# ==============================================================================
$container_backup_dir = $null
$container_tmp_path = $null
$container_manifest_path = $null
$container_inventory_path = $null
$container_sql_path = $null

$remote_tmp_path = $null
$remote_manifest_path = $null
$remote_inventory_path = $null
$remote_sql_path = $null

$local_tmp_dir = $null
$local_tmp_path = $null
$local_manifest_path = $null
$local_inventory_path = $null
$local_sql_path = $null

$r2_key_dump = $null
$r2_key_manifest = $null
$r2_key_inventory = $null

# Estados de control de ciclo de vida
$state = @{
    container_dump_created      = $false
    container_manifest_created  = $false
    container_inventory_created = $false
    remote_dump_created         = $false
    remote_manifest_created     = $false
    remote_inventory_created    = $false
    local_dump_created          = $false
    local_manifest_created      = $false
    local_inventory_created     = $false
    r2_dump_uploaded            = $false
    r2_dump_verified            = $false
    r2_manifest_uploaded        = $false
    r2_manifest_verified        = $false
    r2_inventory_uploaded       = $false
    r2_inventory_verified       = $false
}

$BACKUP_VERIFIED = "NO"
$R2_DUMP_VERIFIED = "NO"
$R2_MANIFEST_VERIFIED = "NO"
$R2_INVENTORY_VERIFIED = "NO"

$CONTAINER_CLEANUP_COMPLETE = "NOT_RUN"
$REMOTE_HOST_CLEANUP_COMPLETE = "NOT_RUN"
$LOCAL_CLEANUP_COMPLETE = "NOT_RUN"
$CREDENTIAL_CLEANUP_COMPLETE = "NOT_RUN"
$FINAL_CLEANUP_GATE = "NO"

# Gates de validación intermedia obligatorios
$TOC_DESCRIPTOR_REGISTRY_VALIDATED = "NO"
$POLICY_IDENTITIES_VALIDATED = "NO"
$TRIGGER_IDENTITIES_VALIDATED = "NO"
$ACL_OBJECT_IDENTITIES_VALIDATED = "NO"
$ACL_PRIVILEGE_CONTENT_VALIDATED = "NO"
$DEFAULT_ACL_IDENTITIES_VALIDATED = "NO"

# Gates específicos del manifest filtrado
$TEMP_RESTORE_TOC_PARSED = "NO"
$TEMP_RESTORE_TOC_ALLOWLIST_VALIDATED = "NO"
$TEMP_RESTORE_TOC_REREAD_VALIDATED = "NO"
$PRODUCTION_NAME_ABSENT_FROM_RESTORE_TARGETS = "NO"
$PRODUCTION_MUTATION_IMPOSSIBILITY_VALIDATED = "NO"

# Gates específicos de DATABASE ACL
$DATABASE_ACL_REPRESENTED_IN_DUMP = "NO"
$DATABASE_ACL_EXCLUDED_FROM_TEMP_RESTORE = "NO"
$DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED = "NO" # OPCIÓN B: Bloqueado a NO por limitación no resuelta
$DATABASE_ACL_DECISION = "PROPOSED_PENDING_INDEPENDENT_REVIEW"

# Gate B / TASK_005 controlled implementation states.
# These states are intentionally fail-closed. They document static implementation
# surfaces only; they do not authorize execution, PostgreSQL access, restore,
# R2 upload, Stage 2, or continuation to later gates.
$TASK005_GATE_B_STATIC_IMPLEMENTATION_PRESENT = "YES"
$TASK005_GATE_B_TECHNICAL_VALIDATION_COMPLETED = "NO"
$TASK005_GATE_C_STARTED = "NO"
$TASK005_READY_FOR_TECHNICAL_EXECUTION = "NO"
$TASK005_ROLE_STRATEGY = "SESSION_ROLE_WITH_EFFECTIVE_PRIVILEGE_ASSERTIONS"
$TASK005_SESSION_IDENTITY_OBSERVED = "NO"
$TASK005_INSPECTED_ROLE_PRIVILEGES_OBSERVED = "NO"
$TASK005_ROLE_MEMBERSHIP_BETWEEN_SESSION_AND_VALIDATION = "NO"
$TASK005_ROLE_ASSUMPTION_USED = "NO"
$TASK005_FUTURE_TEMP_DATABASE_CONNECTION_REQUIRED = "YES_FOR_G_N_P_Q_R_S_T_U_V_ONLY"
$TASK005_PRODUCTION_CONNECTION_ALLOWED = "NO"
$TASK005_PRODUCTION_CONNECTION_PERFORMED = "NO"
$TASK005_CANONICAL_FLOW_ORDER = @(
    "1:original_lines_1715_1716:prepare_container_directory",
    "2:original_lines_1718_1723:pg_dump_and_manifest",
    "3:original_lines_2208_2218:check_create_and_restore_temp_database"
)

# Estados de ciclo de vida de la base de datos temporal
$TEMP_DB_CREATED = "NO"
$TEMP_RESTORE_VERIFIED = "NO"
$TEMP_DB_DROPPED = "NO"
$TEMP_DB_ABSENCE_VERIFIED = "NO"

$LOCAL_ARTIFACTS_PRESERVED_ON_FAILURE = "NO"

$CREDENTIAL_CLEANUP_AWS_ACCESS_KEY_ID = "NO"
$CREDENTIAL_CLEANUP_AWS_SECRET_ACCESS_KEY = "NO"
$CREDENTIAL_CLEANUP_AWS_SESSION_TOKEN = "NOT_APPLICABLE"
$CREDENTIAL_CLEANUP_AWS_REQUEST_CHECKSUM_CALCULATION = "NO"
$CREDENTIAL_CLEANUP_AWS_RESPONSE_CHECKSUM_VALIDATION = "NO"
$CREDENTIAL_CLEANUP_R2_ENDPOINT = "NO"

$fatal_error_msg = $null
$failed_cleanup_item = $null

# ==============================================================================
# FUNCIONES PURAS Y AUXILIARES DE VALIDACIÓN Y NORMALIZACIÓN
# ==============================================================================

# Normalizadores compartidos
function Normalize-Single-Identifier($id) {
    if ($null -eq $id) { return "" }
    $id = $id.Trim()
    if ($id.StartsWith('"') -and $id.EndsWith('"')) {
        $content = $id.Substring(1, $id.Length - 2)
        $content = $content -replace '""', '"'
        return "`"$content`""
    }
    return $id.ToLower()
}

function Split-And-Normalize-Composite-Identifier($composite) {
    $parts = @()
    $current = ""
    $in_quote = $false
    $len = $composite.Length
    for ($i = 0; $i -lt $len; $i++) {
        $char = $composite[$i]
        if ($char -eq '"') {
            if ($in_quote -and $i -lt $len - 1 -and $composite[$i+1] -eq '"') {
                $current += '""'
                $i++
            } else {
                $in_quote = -not $in_quote
                $current += $char
            }
        } elseif ($char -eq '.' -and -not $in_quote) {
            $parts += Normalize-Single-Identifier($current)
            $current = ""
        } else {
            $current += $char
        }
    }
    if ($current.Length -gt 0) {
        $parts += Normalize-Single-Identifier($current)
    }
    return $parts -join "."
}

function Normalize-Complex-Signature($sig) {
    $sig = $sig.Trim()
    $len = $sig.Length
    $in_quote = $false
    $paren_idx = -1
    for ($i = 0; $i -lt $len; $i++) {
        $char = $sig[$i]
        if ($char -eq '"') {
            if ($in_quote -and $i -lt $len - 1 -and $sig[$i+1] -eq '"') {
                $i++
            } else {
                $in_quote = -not $in_quote
            }
        } elseif (-not $in_quote -and $char -eq '(') {
            $paren_idx = $i
            break
        }
    }
    if ($paren_idx -lt 0) {
        return Split-And-Normalize-Composite-Identifier($sig)
    }
    $name_part = $sig.Substring(0, $paren_idx).Trim()
    $args_part = $sig.Substring($paren_idx + 1, $len - $paren_idx - 2).Trim()
    
    $args = @()
    $current = ""
    $in_q = $false
    $paren_depth = 0
    for ($i = 0; $i -lt $args_part.Length; $i++) {
        $char = $args_part[$i]
        if ($char -eq '"') {
            if ($in_q -and $i -lt $args_part.Length - 1 -and $args_part[$i+1] -eq '"') {
                $i++
                $current += '""'
            } else {
                $in_q = -not $in_q
                $current += $char
            }
        } elseif ($char -eq '(' -and -not $in_q) {
            $paren_depth++
            $current += $char
        } elseif ($char -eq ')' -and -not $in_q) {
            $paren_depth--
            $current += $char
        } elseif ($char -eq ',' -and -not $in_q -and $paren_depth -eq 0) {
            $args += $current.Trim()
            $current = ""
        } else {
            $current += $char
        }
    }
    if ($current.Trim().Length -gt 0) {
        $args += $current.Trim()
    }
    
    $norm_name_str = Split-And-Normalize-Composite-Identifier($name_part)
    $norm_args = $args | ForEach-Object { Split-And-Normalize-Composite-Identifier($_) }
    $norm_args_str = $norm_args -join ","
    return "$norm_name_str($norm_args_str)"
}

# Tokenizador de líneas de pg_restore que respeta comillas dobles
function Tokenize-TOC-Line($rem_str) {
    $tokens = @()
    $current = ""
    $in_quote = $false
    for ($i = 0; $i -lt $rem_str.Length; $i++) {
        $char = $rem_str[$i]
        if ($char -eq '"') {
            if ($in_quote -and $i -lt $rem_str.Length - 1 -and $rem_str[$i+1] -eq '"') {
                $i++
                $current += '""'
            } else {
                $in_quote = -not $in_quote
                $current += $char
            }
        } elseif ($char -eq ' ' -and -not $in_quote) {
            if ($current.Trim().Length -gt 0) {
                $tokens += $current.Trim()
                $current = ""
            }
        } else {
            $current += $char
        }
    }
    if ($current.Trim().Length -gt 0) {
        $tokens += $current.Trim()
    }
    return $tokens
}

# Reglas reutilizables para validaciones de contratos individuales
$global:Rule_SchemaDash = { param($s) $s -eq "-" }
$global:Rule_SchemaRequired = { param($s) $s -ne "-" }
$global:Rule_Any = { param($x) $true }
$global:Rule_OwnerDashOrRequired = { param($o) $o.Length -gt 0 }
$global:Rule_OwnerRequired = { param($o) $o -ne "-" }
$global:Rule_OwnerDash = { param($o) $o -eq "-" }

$global:Builder_Standard = { param($s, $n) if ($s -eq "-") { $n } else { "$s.$n" } }
$global:Builder_Complex = { param($s, $n) Normalize-Complex-Signature("$s.$n") }
$global:Builder_PolicyTrigger = { param($s, $n, $t) "$s.$t.$n" }
$global:Builder_DefaultAcl = { param($s, $n) "DEFAULT ACL" }

$global:Rejection_None = { param($res) $null }
$global:Rejection_Dangerous = { param($res) "global_descriptor_forbidden" }
$global:Rejection_External = { param($res) "external_descriptor_forbidden" }

# Parsers específicos por gramática para contratos
$global:Parser_Global = {
    param($tokens, $contract)
    if ($tokens.Count -lt 3) { return @{ error = "missing_required_field" } }
    if ($tokens.Count -gt 3) { return @{ error = "unexpected_extra_field" } }
    if ($tokens[0] -ne "-") { return @{ error = "schema_token_mismatch" } }
    return @{ Valid = $true; Schema = "-"; Name = $tokens[1]; Owner = $tokens[2] }
}

$global:Parser_GlobalExt = {
    param($tokens, $contract)
    if ($tokens.Count -lt 3) { return @{ error = "missing_required_field" } }
    if ($tokens.Count -gt 3) { return @{ error = "unexpected_extra_field" } }
    if ($tokens[0] -ne "-") { return @{ error = "schema_token_mismatch" } }
    return @{ Valid = $true; Schema = "-"; Name = $tokens[1]; Owner = $tokens[2] }
}

$global:Parser_Standard = {
    param($tokens, $contract)
    if ($tokens.Count -lt 3) { return @{ error = "missing_required_field" } }
    if ($tokens.Count -gt 3) { return @{ error = "unexpected_extra_field" } }
    return @{ Valid = $true; Schema = $tokens[0]; Name = $tokens[1]; Owner = $tokens[2] }
}

$global:Parser_Signature = {
    param($tokens, $contract)
    # 1. ComponentCountRule min check (schema, name, owner)
    if ($tokens.Count -lt 3) { return @{ error = "missing_required_field" } }
    
    $paren_depth = 0
    $has_open = $false
    $sig_end_idx = -1
    
    # Rastrear profundidad y balance de paréntesis sobre la colección de tokens
    for ($i = 1; $i -lt $tokens.Count; $i++) {
        $tok = $tokens[$i]
        for ($j = 0; $j -lt $tok.Length; $j++) {
            $c = $tok[$j]
            if ($c -eq '(') {
                $has_open = $true
                $paren_depth++
            } elseif ($c -eq ')') {
                $paren_depth--
                if ($paren_depth -lt 0) {
                    # Cierre sin apertura previa o paréntesis desbalanceados
                    return @{ error = "unsupported_descriptor_grammar" }
                }
                if ($paren_depth -eq 0 -and $has_open) {
                    $sig_end_idx = $i
                }
            }
        }
        # Si ya cerramos el balance del primer grupo de paréntesis completo, detenemos el escaneo de la firma en este token
        if ($has_open -and $paren_depth -eq 0 -and $sig_end_idx -eq $i) {
            break
        }
    }
    
    # 2. Apertura sin cierre o ausencia de paréntesis
    if (-not $has_open -or $sig_end_idx -eq -1) {
        return @{ error = "unsupported_descriptor_grammar" }
    }
    if ($paren_depth -ne 0) {
        return @{ error = "unsupported_descriptor_grammar" }
    }
    
    # 3. Validar posición del propietario (debe ser exactamente el token siguiente tras la firma)
    $owner_idx = $sig_end_idx + 1
    if ($owner_idx -ge $tokens.Count) {
        return @{ error = "missing_required_field" }
    }
    
    # 4. Rechazar tokens posteriores al propietario (campos adicionales)
    if ($owner_idx + 1 -lt $tokens.Count) {
        return @{ error = "unexpected_extra_field" }
    }
    
    $schema = $tokens[0]
    $owner = $tokens[$owner_idx]
    $name_tokens = $tokens[1..$sig_end_idx]
    $name = $name_tokens -join " "
    
    # 5. Validar firma vacía (ej. "public () postgres")
    $paren_idx = $name.IndexOf("(")
    if ($paren_idx -eq 0 -or $name.Trim() -eq "()") {
        return @{ error = "unsupported_descriptor_grammar" }
    }
    
    return @{ Valid = $true; Schema = $schema; Name = $name; Owner = $owner }
}

$global:Parser_PolicyOrTrigger = {
    param($tokens, $contract)
    if ($tokens.Count -lt 5) { return @{ error = "missing_required_field" } }
    if ($tokens.Count -gt 5) { return @{ error = "unexpected_extra_field" } }
    if ($tokens[2] -ne "ON") { return @{ error = "unsupported_descriptor_grammar" } }
    return @{
        Valid = $true
        Schema = $tokens[0]
        Name = $tokens[1]
        Table = $tokens[3]
        Owner = $tokens[4]
    }
}

$global:Parser_CommentACL = {
    param($tokens, $contract)
    if ($tokens.Count -lt 3) { return @{ error = "missing_required_field" } }
    if ($tokens.Count -gt 5) { return @{ error = "unexpected_extra_field" } }
    if ($tokens.Count -eq 3) {
        return @{ Valid = $true; Schema = $tokens[0]; Name = $tokens[1]; Owner = $tokens[2] }
    }
    elseif ($tokens.Count -eq 4) {
        return @{ Valid = $true; Schema = $tokens[0]; Name = "$($tokens[1]) $($tokens[2])"; Owner = $tokens[3] }
    }
    elseif ($tokens.Count -eq 5) {
        return @{ Valid = $true; Schema = $tokens[0]; Name = "$($tokens[1]) $($tokens[2]) $($tokens[3])"; Owner = $tokens[4] }
    }
    return @{ error = "unsupported_descriptor_grammar" }
}

$global:Parser_DefaultAcl = {
    param($tokens, $contract)
    if ($tokens.Count -lt 3) { return @{ error = "missing_required_field" } }
    if ($tokens.Count -gt 3) { return @{ error = "unexpected_extra_field" } }
    if ($tokens[0] -ne "-") { return @{ error = "schema_token_mismatch" } }
    if ($tokens[1] -ne "DEFAULT ACL") { return @{ error = "name_token_mismatch" } }
    return @{ Valid = $true; Schema = "-"; Name = "DEFAULT ACL"; Owner = $tokens[2] }
}

$global:Parser_DatabaseAcl = {
    param($tokens, $contract)
    if ($tokens.Count -lt 4) { return @{ error = "missing_required_field" } }
    if ($tokens.Count -gt 4) { return @{ error = "unexpected_extra_field" } }
    if ($tokens[0] -ne "-") { return @{ error = "schema_token_mismatch" } }
    if ($tokens[1] -ne "DATABASE") { return @{ error = "unsupported_descriptor_grammar" } }
    return @{ Valid = $true; Schema = "-"; Name = $tokens[2]; Owner = $tokens[3] }
}

$global:Parser_DatabaseProperties = {
    param($tokens, $contract)
    if ($tokens.Count -lt 3) { return @{ error = "missing_required_field" } }
    if ($tokens.Count -gt 3) { return @{ error = "unexpected_extra_field" } }
    if ($tokens[0] -ne "-") { return @{ error = "schema_token_mismatch" } }
    return @{ Valid = $true; Schema = "-"; Name = $tokens[1]; Owner = $tokens[2] }
}

# Constructor del Contrato de Descriptores
function New-TOC-Contract(
    [string]$descriptor,
    [int]$priority,
    [string]$grammar,
    [array]$versions,
    [array]$required_components,
    [array]$optional_components,
    [object]$count_rule,
    [scriptblock]$schema_rule,
    [scriptblock]$name_rule,
    [scriptblock]$owner_rule,
    [scriptblock]$identity_builder,
    [string]$classification,
    [bool]$allow_temp,
    [scriptblock]$rejection_rule,
    [scriptblock]$parser
) {
    return @{
        Descriptor = $descriptor
        descriptor = $descriptor
        RecognitionPriority = $priority
        SupportedGrammar = $grammar
        SupportedVersions = $versions
        RequiredComponents = $required_components
        OptionalComponents = $optional_components
        ComponentCountRule = $count_rule
        SchemaRule = $schema_rule
        NameRule = $name_rule
        OwnerRule = $owner_rule
        IdentityBuilder = $identity_builder
        SecurityClassification = $classification
        AllowedForTemporaryRestore = $allow_temp
        DeterministicRejectionRule = $rejection_rule
        Parser = $parser
    }
}

# Registro centralizado de contratos individuales por descriptor
$global:TOC_CONTRACTS = @{}

# Descriptores prohibidos
$global:TOC_CONTRACTS["DATABASE"] = New-TOC-Contract "DATABASE" 8 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "DANGEROUS" $false $global:Rejection_Dangerous $global:Parser_Global
$global:TOC_CONTRACTS["DATABASE ACL"] = New-TOC-Contract "DATABASE ACL" 12 "DATABASE_ACL" @("15", "16") @("schema", "keyword", "name", "owner") @() 4 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "DANGEROUS" $false $global:Rejection_Dangerous $global:Parser_DatabaseAcl
$global:TOC_CONTRACTS["DATABASE PROPERTIES"] = New-TOC-Contract "DATABASE PROPERTIES" 19 "DATABASE_PROPERTIES" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "DANGEROUS" $false $global:Rejection_Dangerous $global:Parser_DatabaseProperties
$global:TOC_CONTRACTS["PUBLICATION"] = New-TOC-Contract "PUBLICATION" 11 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "EXTERNAL" $false $global:Rejection_External $global:Parser_Global
$global:TOC_CONTRACTS["PUBLICATION TABLE"] = New-TOC-Contract "PUBLICATION TABLE" 17 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "EXTERNAL" $false $global:Rejection_External $global:Parser_Global
$global:TOC_CONTRACTS["PUBLICATION TABLES IN SCHEMA"] = New-TOC-Contract "PUBLICATION TABLES IN SCHEMA" 28 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "EXTERNAL" $false $global:Rejection_External $global:Parser_Global
$global:TOC_CONTRACTS["SUBSCRIPTION"] = New-TOC-Contract "SUBSCRIPTION" 12 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "EXTERNAL" $false $global:Rejection_External $global:Parser_Global
$global:TOC_CONTRACTS["SUBSCRIPTION TABLE"] = New-TOC-Contract "SUBSCRIPTION TABLE" 18 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "EXTERNAL" $false $global:Rejection_External $global:Parser_Global
$global:TOC_CONTRACTS["SERVER"] = New-TOC-Contract "SERVER" 6 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "EXTERNAL" $false $global:Rejection_External $global:Parser_Global
$global:TOC_CONTRACTS["USER MAPPING"] = New-TOC-Contract "USER MAPPING" 12 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "EXTERNAL" $false $global:Rejection_External $global:Parser_Global
$global:TOC_CONTRACTS["FOREIGN DATA WRAPPER"] = New-TOC-Contract "FOREIGN DATA WRAPPER" 20 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "EXTERNAL" $false $global:Rejection_External $global:Parser_Global
$global:TOC_CONTRACTS["ACCESS METHOD"] = New-TOC-Contract "ACCESS METHOD" 13 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "EXTERNAL" $false $global:Rejection_External $global:Parser_Global
$global:TOC_CONTRACTS["TABLESPACE"] = New-TOC-Contract "TABLESPACE" 10 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "EXTERNAL" $false $global:Rejection_External $global:Parser_Global
$global:TOC_CONTRACTS["ROLE"] = New-TOC-Contract "ROLE" 4 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "DANGEROUS" $false $global:Rejection_Dangerous $global:Parser_Global
$global:TOC_CONTRACTS["EVENT TRIGGER"] = New-TOC-Contract "EVENT TRIGGER" 13 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "DANGEROUS" $false $global:Rejection_Dangerous $global:Parser_Global

# Descriptores permitidos
$global:TOC_CONTRACTS["SCHEMA"] = New-TOC-Contract "SCHEMA" 6 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Global
$global:TOC_CONTRACTS["EXTENSION"] = New-TOC-Contract "EXTENSION" 9 "GLOBAL_EXT" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerDashOrRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_GlobalExt
$global:TOC_CONTRACTS["SEQUENCE"] = New-TOC-Contract "SEQUENCE" 8 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["SEQUENCE OWNED BY"] = New-TOC-Contract "SEQUENCE OWNED BY" 17 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["SEQUENCE SET"] = New-TOC-Contract "SEQUENCE SET" 12 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["TABLE"] = New-TOC-Contract "TABLE" 5 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["TABLE DATA"] = New-TOC-Contract "TABLE DATA" 10 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["VIEW"] = New-TOC-Contract "VIEW" 4 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["MATERIALIZED VIEW"] = New-TOC-Contract "MATERIALIZED VIEW" 17 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["MATERIALIZED VIEW DATA"] = New-TOC-Contract "MATERIALIZED VIEW DATA" 22 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["FUNCTION"] = New-TOC-Contract "FUNCTION" 8 "SIGNATURE" @("15", "16") @("schema", "name", "owner") @() @{ Min = 3; Max = 100 } $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Complex "STANDARD" $true $global:Rejection_None $global:Parser_Signature
$global:TOC_CONTRACTS["PROCEDURE"] = New-TOC-Contract "PROCEDURE" 9 "SIGNATURE" @("15", "16") @("schema", "name", "owner") @() @{ Min = 3; Max = 100 } $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Complex "STANDARD" $true $global:Rejection_None $global:Parser_Signature
$global:TOC_CONTRACTS["TRIGGER"] = New-TOC-Contract "TRIGGER" 7 "POLICY_OR_TRIGGER" @("15", "16") @("schema", "name", "table", "owner") @() 5 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_PolicyTrigger "STANDARD" $true $global:Rejection_None $global:Parser_PolicyOrTrigger
$global:TOC_CONTRACTS["POLICY"] = New-TOC-Contract "POLICY" 6 "POLICY_OR_TRIGGER" @("15", "16") @("schema", "name", "table", "owner") @() 5 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_PolicyTrigger "STANDARD" $true $global:Rejection_None $global:Parser_PolicyOrTrigger
$global:TOC_CONTRACTS["ROW SECURITY"] = New-TOC-Contract "ROW SECURITY" 12 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["DEFAULT"] = New-TOC-Contract "DEFAULT" 7 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["CONSTRAINT"] = New-TOC-Contract "CONSTRAINT" 10 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["CHECK CONSTRAINT"] = New-TOC-Contract "CHECK CONSTRAINT" 16 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["FK CONSTRAINT"] = New-TOC-Contract "FK CONSTRAINT" 13 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["INDEX"] = New-TOC-Contract "INDEX" 5 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["COMMENT"] = New-TOC-Contract "COMMENT" 7 "COMMENT" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_Any $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_CommentACL
$global:TOC_CONTRACTS["RULE"] = New-TOC-Contract "RULE" 4 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["BLOB"] = New-TOC-Contract "BLOB" 4 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Global
$global:TOC_CONTRACTS["BLOB DATA"] = New-TOC-Contract "BLOB DATA" 9 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Global
$global:TOC_CONTRACTS["ACL"] = New-TOC-Contract "ACL" 3 "ACL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_Any $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_CommentACL
$global:TOC_CONTRACTS["DEFAULT ACL"] = New-TOC-Contract "DEFAULT ACL" 11 "DEFAULT_ACL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_DefaultAcl "STANDARD" $true $global:Rejection_None $global:Parser_DefaultAcl
$global:TOC_CONTRACTS["TABLE ATTACH"] = New-TOC-Contract "TABLE ATTACH" 12 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["STATISTICS"] = New-TOC-Contract "STATISTICS" 10 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["TRANSFORM"] = New-TOC-Contract "TRANSFORM" 9 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Global
$global:TOC_CONTRACTS["OPERATOR"] = New-TOC-Contract "OPERATOR" 8 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["OPERATOR CLASS"] = New-TOC-Contract "OPERATOR CLASS" 14 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["OPERATOR FAMILY"] = New-TOC-Contract "OPERATOR FAMILY" 15 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["COLLATION"] = New-TOC-Contract "COLLATION" 9 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["CAST"] = New-TOC-Contract "CAST" 4 "GLOBAL" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaDash $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Global
$global:TOC_CONTRACTS["DOMAIN"] = New-TOC-Contract "DOMAIN" 6 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["TEXT SEARCH PARSER"] = New-TOC-Contract "TEXT SEARCH PARSER" 18 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["TEXT SEARCH TEMPLATE"] = New-TOC-Contract "TEXT SEARCH TEMPLATE" 20 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["TEXT SEARCH DICTIONARY"] = New-TOC-Contract "TEXT SEARCH DICTIONARY" 22 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["TEXT SEARCH CONFIGURATION"] = New-TOC-Contract "TEXT SEARCH CONFIGURATION" 25 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["FOREIGN TABLE"] = New-TOC-Contract "FOREIGN TABLE" 13 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["SHELL TYPE"] = New-TOC-Contract "SHELL TYPE" 10 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["AGGREGATE"] = New-TOC-Contract "AGGREGATE" 9 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard
$global:TOC_CONTRACTS["TYPE"] = New-TOC-Contract "TYPE" 4 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_SchemaRequired $global:Rule_Any $global:Rule_OwnerRequired $global:Builder_Standard "STANDARD" $true $global:Rejection_None $global:Parser_Standard

# Derivación automática de clasificaciones y allowlist
$global:RESTORE_ALLOWLIST = @{}
foreach ($k in $global:TOC_CONTRACTS.Keys) {
    $c = $global:TOC_CONTRACTS[$k]
    if ($c.SecurityClassification -in @("DANGEROUS", "EXTERNAL")) {
        $c["OperationalHandling"] = "FORBIDDEN"
    } elseif ($k -eq "DEFAULT ACL") {
        $c["OperationalHandling"] = "REQUIRES_CONTENT_VERIFICATION"
    } elseif ($k -in @("EXTENSION", "SCHEMA", "SEQUENCE", "TABLE", "TABLE DATA", "VIEW", "MATERIALIZED VIEW", "FUNCTION", "PROCEDURE", "TRIGGER", "POLICY", "ROW SECURITY", "ACL")) {
        $c["OperationalHandling"] = "VALIDATED_BY_IDENTITY"
    } else {
        $c["OperationalHandling"] = "ALLOWED_AND_RECORDED"
    }
    
    if ($c.AllowedForTemporaryRestore) {
        $global:RESTORE_ALLOWLIST[$k] = $true
    }
}

# Parser estructural completo del TOC con contratos y validación estricta
function Parse-TOC-Structural-Line($line, $active_registry, $expected_version = $null) {
    # 1. Balanced quotes check before interpreting header
    $total_q = 0
    for ($i = 0; $i -lt $line.Length; $i++) {
        if ($line[$i] -eq '"') { $total_q++ }
    }
    if ($total_q % 2 -ne 0) {
        return [ordered]@{
            Valid = $false; valid = $false; status = "invalid"
            Recognized = $false; recognized = $false
            Descriptor = $null; descriptor = $null
            DumpId = $null; dump_id = $null
            CatalogOid = $null; catalog_oid = $null
            ObjectOid = $null; object_oid = $null
            Schema = $null; schema = $null
            Name = $null; name = $null
            Table = $null; table = $null
            Owner = $null; owner = $null
            Components = @{}; components = @{}
            QualifiedIdentity = $null; identity = $null
            SupportedGrammar = $null; supported_grammar = $null
            SupportedVersion = $null; supported_version = $null
            AllowedForTemporaryRestore = $false; allowed_for_temporary_restore = $false
            SecurityClassification = "DANGEROUS"; security_classification = "DANGEROUS"
            RejectionCode = "unbalanced_quotes"; rejection_code = "unbalanced_quotes"
            OriginalLine = $line; original_line = $line
        }
    }

    # 2. Match header
    if ($line.Trim().Length -eq 0 -or $line.StartsWith(";")) {
        return $null
    }

    if ($line -match "^\s*(?<dump_id>\d+)\s*;\s*(?<catalog_oid>\d+)\s+(?<object_oid>\d+)\s+(?<rest>.+)$") {
        $dump_id = $Matches["dump_id"]
        $catalog_oid = $Matches["catalog_oid"]
        $object_oid = $Matches["object_oid"]
        $rest_str = $Matches["rest"].Trim()

        $tokens = Tokenize-TOC-Line $rest_str
        if ($tokens.Count -lt 2) {
            return [ordered]@{
                Valid = $false; valid = $false; status = "invalid"
                Recognized = $false; recognized = $false
                Descriptor = $null; descriptor = $null
                DumpId = $dump_id; dump_id = $dump_id
                CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                ObjectOid = $object_oid; object_oid = $object_oid
                Schema = $null; schema = $null
                Name = $null; name = $null
                Table = $null; table = $null
                Owner = $null; owner = $null
                Components = @{}; components = @{}
                QualifiedIdentity = $null; identity = $null
                SupportedGrammar = $null; supported_grammar = $null
                SupportedVersion = $null; supported_version = $null
                AllowedForTemporaryRestore = $false; allowed_for_temporary_restore = $false
                SecurityClassification = "DANGEROUS"; security_classification = "DANGEROUS"
                RejectionCode = "malformed_toc_header"; rejection_code = "malformed_toc_header"
                OriginalLine = $line; original_line = $line
            }
        }

        # Build descriptor keywords dict to find partial descriptor matches
        $descriptor_words = @{}
        foreach ($key in $active_registry.Keys) {
            foreach ($w in $key.Split(" ")) {
                $descriptor_words[$w.ToUpper()] = $true
            }
        }
        $descriptor_words["EXT"] = $true

        # Find matching descriptor key using RecognitionPriority (de verdad)
        $matched_key = $null
        $matched_len = 0
        $sorted_keys = $active_registry.Keys | Sort-Object { $active_registry[$_].RecognitionPriority } -Descending
        foreach ($key in $sorted_keys) {
            $key_tokens = Tokenize-TOC-Line $key
            $key_len = $key_tokens.Count
            if ($tokens.Count -ge $key_len) {
                $match = $true
                for ($i = 0; $i -lt $key_len; $i++) {
                    if ($tokens[$i] -ne $key_tokens[$i]) {
                        $match = $false
                        break
                    }
                }
                if ($match) {
                    $matched_key = $key
                    $matched_len = $key_len
                    break
                }
            }
        }

        if ($null -eq $matched_key) {
            return [ordered]@{
                Valid = $false; valid = $false; status = "invalid"
                Recognized = $false; recognized = $false
                Descriptor = $null; descriptor = $null
                DumpId = $dump_id; dump_id = $dump_id
                CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                ObjectOid = $object_oid; object_oid = $object_oid
                Schema = $null; schema = $null
                Name = $null; name = $null
                Table = $null; table = $null
                Owner = $null; owner = $null
                Components = @{}; components = @{}
                QualifiedIdentity = $null; identity = $null
                SupportedGrammar = $null; supported_grammar = $null
                SupportedVersion = $null; supported_version = $null
                AllowedForTemporaryRestore = $false; allowed_for_temporary_restore = $false
                SecurityClassification = "DANGEROUS"; security_classification = "DANGEROUS"
                RejectionCode = "unknown_descriptor"; rejection_code = "unknown_descriptor"
                OriginalLine = $line; original_line = $line
            }
        }

        # Check for partial descriptor match
        if ($tokens.Count -gt $matched_len) {
            $next_tok = $tokens[$matched_len]
            if ($next_tok -match '^[A-Z_]+$' -and $descriptor_words.Contains($next_tok.ToUpper())) {
                return [ordered]@{
                    Valid = $false; valid = $false; status = "invalid"
                    Recognized = $true; recognized = $true
                    Descriptor = $matched_key; descriptor = $matched_key
                    DumpId = $dump_id; dump_id = $dump_id
                    CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                    ObjectOid = $object_oid; object_oid = $object_oid
                    Schema = $null; schema = $null
                    Name = $null; name = $null
                    Table = $null; table = $null
                    Owner = $null; owner = $null
                    Components = @{}; components = @{}
                    QualifiedIdentity = $null; identity = $null
                    SupportedGrammar = $null; supported_grammar = $null
                    SupportedVersion = $null; supported_version = $null
                    AllowedForTemporaryRestore = $false; allowed_for_temporary_restore = $false
                    SecurityClassification = "DANGEROUS"; security_classification = "DANGEROUS"
                    RejectionCode = "partial_descriptor_match"; rejection_code = "partial_descriptor_match"
                    OriginalLine = $line; original_line = $line
                }
            }
        }

        $contract = $active_registry[$matched_key]
        # Validate contract consistency
        $keys_req = @("Descriptor", "RecognitionPriority", "SupportedGrammar", "SupportedVersions", "RequiredComponents", "OptionalComponents", "ComponentCountRule", "SchemaRule", "NameRule", "OwnerRule", "IdentityBuilder", "SecurityClassification", "AllowedForTemporaryRestore", "DeterministicRejectionRule", "Parser")
        foreach ($rk in $keys_req) {
            if (-not $contract.Contains($rk)) {
                return [ordered]@{
                    Valid = $false; valid = $false; status = "invalid"
                    Recognized = $true; recognized = $true
                    Descriptor = $matched_key; descriptor = $matched_key
                    DumpId = $dump_id; dump_id = $dump_id
                    CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                    ObjectOid = $object_oid; object_oid = $object_oid
                    Schema = $null; schema = $null
                    Name = $null; name = $null
                    Table = $null; table = $null
                    Owner = $null; owner = $null
                    Components = @{}; components = @{}
                    QualifiedIdentity = $null; identity = $null
                    SupportedGrammar = $null; supported_grammar = $null
                    SupportedVersion = $null; supported_version = $null
                    AllowedForTemporaryRestore = $false; allowed_for_temporary_restore = $false
                    SecurityClassification = "DANGEROUS"; security_classification = "DANGEROUS"
                    RejectionCode = "descriptor_contract_missing"; rejection_code = "descriptor_contract_missing"
                    OriginalLine = $line; original_line = $line
                }
            }
        }

        # Check version support
        if ($null -ne $expected_version) {
            if (-not $contract.SupportedVersions.Contains($expected_version)) {
                return [ordered]@{
                    Valid = $false; valid = $false; status = "invalid"
                    Recognized = $true; recognized = $true
                    Descriptor = $matched_key; descriptor = $matched_key
                    DumpId = $dump_id; dump_id = $dump_id
                    CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                    ObjectOid = $object_oid; object_oid = $object_oid
                    Schema = $null; schema = $null
                    Name = $null; name = $null
                    Table = $null; table = $null
                    Owner = $null; owner = $null
                    Components = @{}; components = @{}
                    QualifiedIdentity = $null; identity = $null
                    SupportedGrammar = $contract.SupportedGrammar; supported_grammar = $contract.SupportedGrammar
                    SupportedVersion = $expected_version; supported_version = $expected_version
                    AllowedForTemporaryRestore = $contract.AllowedForTemporaryRestore; allowed_for_temporary_restore = $contract.AllowedForTemporaryRestore
                    SecurityClassification = $contract.SecurityClassification; security_classification = $contract.SecurityClassification
                    RejectionCode = "unsupported_version"; rejection_code = "unsupported_version"
                    OriginalLine = $line; original_line = $line
                }
            }
        }

        $rem_tokens = $tokens[$matched_len..($tokens.Count - 1)]

        # Aplicación física de ComponentCountRule (soporta enteros y rangos/hashtables)
        $count_valid = $true
        $rej_code = $null
        if ($contract.ComponentCountRule -is [int]) {
            if ($rem_tokens.Count -ne $contract.ComponentCountRule) {
                $count_valid = $false
                $rej_code = if ($rem_tokens.Count -lt $contract.ComponentCountRule) { "missing_required_field" } else { "unexpected_extra_field" }
            }
        } elseif ($contract.ComponentCountRule -is [hashtable] -or $contract.ComponentCountRule -is [System.Collections.IDictionary]) {
            $min = $contract.ComponentCountRule.Min
            $max = $contract.ComponentCountRule.Max
            if ($rem_tokens.Count -lt $min) {
                $count_valid = $false
                $rej_code = "missing_required_field"
            } elseif ($rem_tokens.Count -gt $max) {
                $count_valid = $false
                $rej_code = "unexpected_extra_field"
            }
        } else {
            $rej_code = "descriptor_contract_missing"
            $count_valid = $false
        }

        if (-not $count_valid) {
            return [ordered]@{
                Valid = $false; valid = $false; status = "invalid"
                Recognized = $true; recognized = $true
                Descriptor = $matched_key; descriptor = $matched_key
                DumpId = $dump_id; dump_id = $dump_id
                CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                ObjectOid = $object_oid; object_oid = $object_oid
                Schema = $null; schema = $null
                Name = $null; name = $null
                Table = $null; table = $null
                Owner = $null; owner = $null
                Components = @{}; components = @{}
                QualifiedIdentity = $null; identity = $null
                SupportedGrammar = $contract.SupportedGrammar; supported_grammar = $contract.SupportedGrammar
                SupportedVersion = $expected_version; supported_version = $expected_version
                AllowedForTemporaryRestore = $contract.AllowedForTemporaryRestore; allowed_for_temporary_restore = $contract.AllowedForTemporaryRestore
                SecurityClassification = $contract.SecurityClassification; security_classification = $contract.SecurityClassification
                RejectionCode = $rej_code; rejection_code = $rej_code
                OriginalLine = $line; original_line = $line
            }
        }

        # Invoke parser
        $parsed = & $contract.Parser $rem_tokens $contract
        if ($parsed.ContainsKey("error")) {
            return [ordered]@{
                Valid = $false; valid = $false; status = "invalid"
                Recognized = $true; recognized = $true
                Descriptor = $matched_key; descriptor = $matched_key
                DumpId = $dump_id; dump_id = $dump_id
                CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                ObjectOid = $object_oid; object_oid = $object_oid
                Schema = $null; schema = $null
                Name = $null; name = $null
                Table = $null; table = $null
                Owner = $null; owner = $null
                Components = @{}; components = @{}
                QualifiedIdentity = $null; identity = $null
                SupportedGrammar = $contract.SupportedGrammar; supported_grammar = $contract.SupportedGrammar
                SupportedVersion = $expected_version; supported_version = $expected_version
                AllowedForTemporaryRestore = $contract.AllowedForTemporaryRestore; allowed_for_temporary_restore = $contract.AllowedForTemporaryRestore
                SecurityClassification = $contract.SecurityClassification; security_classification = $contract.SecurityClassification
                RejectionCode = $parsed["error"]; rejection_code = $parsed["error"]
                OriginalLine = $line; original_line = $line
            }
        }

        # Aplicación física de RequiredComponents
        foreach ($comp in $contract.RequiredComponents) {
            $key_name = $comp.Substring(0,1).ToUpper() + $comp.Substring(1).ToLower()
            if (-not $parsed.ContainsKey($key_name) -or $null -eq $parsed[$key_name] -or $parsed[$key_name].ToString().Trim().Length -eq 0) {
                return [ordered]@{
                    Valid = $false; valid = $false; status = "invalid"
                    Recognized = $true; recognized = $true
                    Descriptor = $matched_key; descriptor = $matched_key
                    DumpId = $dump_id; dump_id = $dump_id
                    CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                    ObjectOid = $object_oid; object_oid = $object_oid
                    Schema = $null; schema = $null
                    Name = $null; name = $null
                    Table = $null; table = $null
                    Owner = $null; owner = $null
                    Components = @{}; components = @{}
                    QualifiedIdentity = $null; identity = $null
                    SupportedGrammar = $contract.SupportedGrammar; supported_grammar = $contract.SupportedGrammar
                    SupportedVersion = $expected_version; supported_version = $expected_version
                    AllowedForTemporaryRestore = $contract.AllowedForTemporaryRestore; allowed_for_temporary_restore = $contract.AllowedForTemporaryRestore
                    SecurityClassification = $contract.SecurityClassification; security_classification = $contract.SecurityClassification
                    RejectionCode = "missing_required_field"; rejection_code = "missing_required_field"
                    OriginalLine = $line; original_line = $line
                }
            }
        }

        # Aplicación física y semántica de OptionalComponents
        if ($contract.OptionalComponents.Count -eq 0) {
            # Documentado: La colección de componentes opcionales está vacía para este descriptor,
            # por lo que no altera la aplicación estricta de ComponentCountRule.
        }
        
        $allowed_comps = @{}
        foreach ($c_req in $contract.RequiredComponents) {
            $allowed_comps[$c_req.ToLower()] = $true
        }
        if ($null -ne $contract.OptionalComponents) {
            foreach ($c_opt in $contract.OptionalComponents) {
                $allowed_comps[$c_opt.ToLower()] = $true
            }
        }
        
        # Validar que no existan componentes desconocidos/sobrantes devueltos por el parser
        # No se excluyen Schema, Name, Owner o Table del control; únicamente claves técnicas de control de flujo (Valid y error).
        foreach ($key in $parsed.Keys) {
            if ($key.ToLower() -in @("valid", "error")) { continue }
            $comp_name = $key.ToLower()
            if (-not $allowed_comps.Contains($comp_name)) {
                return [ordered]@{
                    Valid = $false; valid = $false; status = "invalid"
                    Recognized = $true; recognized = $true
                    Descriptor = $matched_key; descriptor = $matched_key
                    DumpId = $dump_id; dump_id = $dump_id
                    CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                    ObjectOid = $object_oid; object_oid = $object_oid
                    Schema = $null; schema = $null
                    Name = $null; name = $null
                    Table = $null; table = $null
                    Owner = $null; owner = $null
                    Components = @{}; components = @{}
                    QualifiedIdentity = $null; identity = $null
                    SupportedGrammar = $contract.SupportedGrammar; supported_grammar = $contract.SupportedGrammar
                    SupportedVersion = $expected_version; supported_version = $expected_version
                    AllowedForTemporaryRestore = $contract.AllowedForTemporaryRestore; allowed_for_temporary_restore = $contract.AllowedForTemporaryRestore
                    SecurityClassification = $contract.SecurityClassification; security_classification = $contract.SecurityClassification
                    RejectionCode = "unexpected_extra_field"; rejection_code = "unexpected_extra_field"
                    OriginalLine = $line; original_line = $line
                }
            }
        }

        $schema = $parsed["Schema"]
        $name = $parsed["Name"]
        $owner = $parsed["Owner"]
        $table = if ($parsed.ContainsKey("Table")) { $parsed["Table"] } else { $null }

        # Check Schema, Name, Owner Rules
        if (-not (& $contract.SchemaRule $schema)) {
            return [ordered]@{
                Valid = $false; valid = $false; status = "invalid"
                Recognized = $true; recognized = $true
                Descriptor = $matched_key; descriptor = $matched_key
                DumpId = $dump_id; dump_id = $dump_id
                CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                ObjectOid = $object_oid; object_oid = $object_oid
                Schema = $schema; schema = $schema
                Name = $name; name = $name
                Table = $table; table = $table
                Owner = $owner; owner = $owner
                Components = @{}; components = @{}
                QualifiedIdentity = $null; identity = $null
                SupportedGrammar = $contract.SupportedGrammar; supported_grammar = $contract.SupportedGrammar
                SupportedVersion = $expected_version; supported_version = $expected_version
                AllowedForTemporaryRestore = $contract.AllowedForTemporaryRestore; allowed_for_temporary_restore = $contract.AllowedForTemporaryRestore
                SecurityClassification = $contract.SecurityClassification; security_classification = $contract.SecurityClassification
                RejectionCode = "schema_required"; rejection_code = "schema_required"
                OriginalLine = $line; original_line = $line
            }
        }

        if (-not (& $contract.NameRule $name)) {
            return [ordered]@{
                Valid = $false; valid = $false; status = "invalid"
                Recognized = $true; recognized = $true
                Descriptor = $matched_key; descriptor = $matched_key
                DumpId = $dump_id; dump_id = $dump_id
                CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                ObjectOid = $object_oid; object_oid = $object_oid
                Schema = $schema; schema = $schema
                Name = $name; name = $name
                Table = $table; table = $table
                Owner = $owner; owner = $owner
                Components = @{}; components = @{}
                QualifiedIdentity = $null; identity = $null
                SupportedGrammar = $contract.SupportedGrammar; supported_grammar = $contract.SupportedGrammar
                SupportedVersion = $expected_version; supported_version = $expected_version
                AllowedForTemporaryRestore = $contract.AllowedForTemporaryRestore; allowed_for_temporary_restore = $contract.AllowedForTemporaryRestore
                SecurityClassification = $contract.SecurityClassification; security_classification = $contract.SecurityClassification
                RejectionCode = "unsupported_descriptor_grammar"; rejection_code = "unsupported_descriptor_grammar"
                OriginalLine = $line; original_line = $line
            }
        }

        if (-not (& $contract.OwnerRule $owner)) {
            return [ordered]@{
                Valid = $false; valid = $false; status = "invalid"
                Recognized = $true; recognized = $true
                Descriptor = $matched_key; descriptor = $matched_key
                DumpId = $dump_id; dump_id = $dump_id
                CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                ObjectOid = $object_oid; object_oid = $object_oid
                Schema = $schema; schema = $schema
                Name = $name; name = $name
                Table = $table; table = $table
                Owner = $owner; owner = $owner
                Components = @{}; components = @{}
                QualifiedIdentity = $null; identity = $null
                SupportedGrammar = $contract.SupportedGrammar; supported_grammar = $contract.SupportedGrammar
                SupportedVersion = $expected_version; supported_version = $expected_version
                AllowedForTemporaryRestore = $contract.AllowedForTemporaryRestore; allowed_for_temporary_restore = $contract.AllowedForTemporaryRestore
                SecurityClassification = $contract.SecurityClassification; security_classification = $contract.SecurityClassification
                RejectionCode = "unsupported_descriptor_grammar"; rejection_code = "unsupported_descriptor_grammar"
                OriginalLine = $line; original_line = $line
            }
        }

        # Check deterministic rejection rule
        $det_rejection = & $contract.DeterministicRejectionRule $parsed
        if ($null -ne $det_rejection) {
            return [ordered]@{
                Valid = $false; valid = $false; status = "invalid"
                Recognized = $true; recognized = $true
                Descriptor = $matched_key; descriptor = $matched_key
                DumpId = $dump_id; dump_id = $dump_id
                CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                ObjectOid = $object_oid; object_oid = $object_oid
                Schema = $schema; schema = $schema
                Name = $name; name = $name
                Table = $table; table = $table
                Owner = $owner; owner = $owner
                Components = @{}; components = @{}
                QualifiedIdentity = $null; identity = $null
                SupportedGrammar = $contract.SupportedGrammar; supported_grammar = $contract.SupportedGrammar
                SupportedVersion = $expected_version; supported_version = $expected_version
                AllowedForTemporaryRestore = $contract.AllowedForTemporaryRestore; allowed_for_temporary_restore = $contract.AllowedForTemporaryRestore
                SecurityClassification = $contract.SecurityClassification; security_classification = $contract.SecurityClassification
                RejectionCode = $det_rejection; rejection_code = $det_rejection
                OriginalLine = $line; original_line = $line
            }
        }

        # Build Identity using contract's IdentityBuilder (no manual if branches)
        $norm_schema = Normalize-Single-Identifier($schema)
        $norm_name = if ($contract.SupportedGrammar -eq "SIGNATURE") { $name } else { Split-And-Normalize-Composite-Identifier($name) }
        $norm_table = if ($null -ne $table) { Split-And-Normalize-Composite-Identifier($table) } else { $null }
        $identity = & $contract.IdentityBuilder $norm_schema $norm_name $norm_table

        if ($null -eq $identity -or $identity.Length -eq 0) {
            return [ordered]@{
                Valid = $false; valid = $false; status = "invalid"
                Recognized = $true; recognized = $true
                Descriptor = $matched_key; descriptor = $matched_key
                DumpId = $dump_id; dump_id = $dump_id
                CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
                ObjectOid = $object_oid; object_oid = $object_oid
                Schema = $schema; schema = $schema
                Name = $name; name = $name
                Table = $table; table = $table
                Owner = $owner; owner = $owner
                Components = @{}; components = @{}
                QualifiedIdentity = $null; identity = $null
                SupportedGrammar = $contract.SupportedGrammar; supported_grammar = $contract.SupportedGrammar
                SupportedVersion = $expected_version; supported_version = $expected_version
                AllowedForTemporaryRestore = $contract.AllowedForTemporaryRestore; allowed_for_temporary_restore = $contract.AllowedForTemporaryRestore
                SecurityClassification = $contract.SecurityClassification; security_classification = $contract.SecurityClassification
                RejectionCode = "ambiguous_identity"; rejection_code = "ambiguous_identity"
                OriginalLine = $line; original_line = $line
            }
        }

        $components = @{}
        
        # 1. Incluir todos los RequiredComponents declarados y presentes en $parsed
        foreach ($comp in $contract.RequiredComponents) {
            $canonical_name = $comp.ToLower()
            $key_name = $comp.Substring(0,1).ToUpper() + $comp.Substring(1).ToLower()
            $components[$canonical_name] = $parsed[$key_name]
        }
        
        # 2. Recorrer e incluir OptionalComponents solo si están presentes en $parsed
        if ($null -ne $contract.OptionalComponents) {
            foreach ($comp in $contract.OptionalComponents) {
                $canonical_name = $comp.ToLower()
                $key_name = $comp.Substring(0,1).ToUpper() + $comp.Substring(1).ToLower()
                if ($parsed.ContainsKey($key_name)) {
                    $components[$canonical_name] = $parsed[$key_name]
                }
            }
        }

        $ver_str = if ($null -ne $expected_version) { $expected_version } else { "15/16" }

        return [ordered]@{
            Valid = $true; valid = $true; status = "valid"
            Recognized = $true; recognized = $true
            Descriptor = $matched_key; descriptor = $matched_key
            DumpId = $dump_id; dump_id = $dump_id
            CatalogOid = $catalog_oid; catalog_oid = $catalog_oid
            ObjectOid = $object_oid; object_oid = $object_oid
            Schema = $schema; schema = $schema
            Name = $name; name = $name
            Table = $table; table = $table
            Owner = $owner; owner = $owner
            Components = $components; components = $components
            QualifiedIdentity = $identity; identity = $identity
            SupportedGrammar = $contract.SupportedGrammar; supported_grammar = $contract.SupportedGrammar
            SupportedVersion = $ver_str; supported_version = $ver_str
            AllowedForTemporaryRestore = $contract.AllowedForTemporaryRestore; allowed_for_temporary_restore = $contract.AllowedForTemporaryRestore
            SecurityClassification = $contract.SecurityClassification; security_classification = $contract.SecurityClassification
            RejectionCode = $null; rejection_code = $null
            OriginalLine = $line; original_line = $line
        }
    }

    return [ordered]@{
        Valid = $false; valid = $false; status = "invalid"
        Recognized = $false; recognized = $false
        Descriptor = $null; descriptor = $null
        DumpId = $null; dump_id = $null
        CatalogOid = $null; catalog_oid = $null
        ObjectOid = $null; object_oid = $null
        Schema = $null; schema = $null
        Name = $null; name = $null
        Table = $null; table = $null
        Owner = $null; owner = $null
        Components = @{}; components = @{}
        QualifiedIdentity = $null; identity = $null
        SupportedGrammar = $null; supported_grammar = $null
        SupportedVersion = $null; supported_version = $null
        AllowedForTemporaryRestore = $false; allowed_for_temporary_restore = $false
        SecurityClassification = "DANGEROUS"; security_classification = "DANGEROUS"
        RejectionCode = "malformed_toc_header"; rejection_code = "malformed_toc_header"
        OriginalLine = $line; original_line = $line
    }
}

# ==============================================================================
# TASK_005 GATE B - STATIC IMPLEMENTATION SURFACES ONLY
# ==============================================================================

function PROPOSED_NEW_FUNCTION_TestDatabaseAclParameters {
    param(
        [string]$TempEnvironmentId,
        [string]$TempDatabaseName,
        [string]$SessionRole,
        [string]$LocalValidationRole,
        [string]$TempDatabaseOwnerRole,
        [string]$RestoreExecutionRole,
        [string]$AdministrationRole,
        [string[]]$AllowedRestoredSchemas,
        [string[]]$ProductionBlocklist,
        [string]$R2BlockMode
    )

    $result = @{
        status = "PROPOSED_NOT_IMPLEMENTED"
        gate = "GATE_B_STATIC_IMPLEMENTATION_ONLY"
        technical_validation_completed = "NO"
        production_connection_allowed = "NO"
        production_connection_performed = "NO"
        role_strategy = "SESSION_ROLE_WITH_EFFECTIVE_PRIVILEGE_ASSERTIONS"
        errors = @()
    }

    $identifier_pattern = '^[a-z0-9_]{3,63}$'
    $safe_text_pattern = '^[a-zA-Z0-9_.-]{1,128}$'

    $values_to_screen = @($TempEnvironmentId, $TempDatabaseName, $SessionRole, $LocalValidationRole, $TempDatabaseOwnerRole, $RestoreExecutionRole, $AdministrationRole)
    foreach ($value in $values_to_screen) {
        if ($null -ne $value -and $value -match "[`r`n`0]") { $result.errors += "database_acl_policy_parameter_invalid:control_character" }
    }

    if ([string]::IsNullOrWhiteSpace($TempEnvironmentId)) { $result.errors += "database_acl_policy_parameter_invalid:temp_environment_required" }
    if ([string]::IsNullOrWhiteSpace($TempDatabaseName) -or $TempDatabaseName -notmatch $identifier_pattern) { $result.errors += "database_acl_policy_parameter_invalid:temp_database_name" }
    if ([string]::IsNullOrWhiteSpace($SessionRole) -or $SessionRole -notmatch $identifier_pattern) { $result.errors += "database_acl_policy_parameter_invalid:session_role" }
    if ([string]::IsNullOrWhiteSpace($LocalValidationRole) -or $LocalValidationRole -notmatch $identifier_pattern) { $result.errors += "database_acl_policy_parameter_invalid:local_validation_role" }
    if ([string]::IsNullOrWhiteSpace($TempDatabaseOwnerRole) -or $TempDatabaseOwnerRole -notmatch $identifier_pattern) { $result.errors += "database_acl_policy_parameter_invalid:temp_owner_role" }
    if ([string]::IsNullOrWhiteSpace($RestoreExecutionRole) -or $RestoreExecutionRole -notmatch $identifier_pattern) { $result.errors += "database_acl_policy_parameter_invalid:restore_execution_role" }
    if ([string]::IsNullOrWhiteSpace($AdministrationRole) -or $AdministrationRole -notmatch $identifier_pattern) { $result.errors += "database_acl_policy_parameter_invalid:administration_role" }
    if ($R2BlockMode -ne "FORCED_BLOCKED") { $result.errors += "database_acl_policy_parameter_invalid:r2_not_blocked" }
    if ($AllowedRestoredSchemas.Count -eq 0) { $result.errors += "database_acl_policy_parameter_invalid:schemas_required" }

    foreach ($schema in $AllowedRestoredSchemas) {
        if ($schema -notmatch $identifier_pattern) { $result.errors += "database_acl_policy_schema_unexpected:$schema" }
        if ($schema -in @("pg_catalog", "information_schema", "pg_toast")) { $result.errors += "database_acl_policy_schema_unexpected:system_schema" }
    }

    foreach ($blocked in $ProductionBlocklist) {
        if ($null -ne $blocked -and $blocked -notmatch $safe_text_pattern) { $result.errors += "database_acl_policy_parameter_invalid:blocklist" }
        if ($TempDatabaseName -eq $blocked) { $result.errors += "database_acl_policy_parameter_invalid:production_name_collision" }
    }

    if ($SessionRole -eq $LocalValidationRole) { $result.errors += "database_acl_policy_role_collision:session_validation" }
    if ($LocalValidationRole -eq $TempDatabaseOwnerRole) { $result.errors += "database_acl_policy_role_collision:validation_owner" }
    if ($LocalValidationRole -eq $RestoreExecutionRole) { $result.errors += "database_acl_policy_role_collision:validation_restore" }
    if ($SessionRole -eq $TempDatabaseOwnerRole) { $result.errors += "database_acl_policy_role_collision:session_owner" }
    if ($SessionRole -eq $RestoreExecutionRole) { $result.errors += "database_acl_policy_role_collision:session_restore" }

    if ($result.errors.Count -eq 0) { $result.status = "PROPOSED_PARAMETERS_TEXTUALLY_ACCEPTABLE" }
    return $result
}

function PROPOSED_NEW_FUNCTION_TestRoleSeparation {
    param(
        [string]$SessionRole,
        [string]$LocalValidationRole,
        [hashtable]$RoleCatalogSnapshot
    )

    $result = @{
        status = "PROPOSED_NOT_IMPLEMENTED"
        real_session_identity = $SessionRole
        inspected_role = $LocalValidationRole
        local_validation_role_login_required = "NOLOGIN"
        role_membership_between_session_and_validation = "NO"
        role_assumption_used = "NO"
        technical_validation_completed = "NO"
        limitations = @("Catalog assertions inspect effective privileges; they do not prove an actual login session as the inspected role.")
        errors = @()
    }

    if ([string]::IsNullOrWhiteSpace($SessionRole)) { $result.errors += "database_acl_policy_parameter_invalid:session_role" }
    if ([string]::IsNullOrWhiteSpace($LocalValidationRole)) { $result.errors += "database_acl_policy_parameter_invalid:local_validation_role" }
    if ($SessionRole -eq $LocalValidationRole) { $result.errors += "database_acl_policy_role_collision:session_validation" }

    if ($null -ne $RoleCatalogSnapshot -and $RoleCatalogSnapshot.ContainsKey($LocalValidationRole)) {
        $validation_role = $RoleCatalogSnapshot[$LocalValidationRole]
        if ($validation_role.rolcanlogin -ne $false) { $result.errors += "database_acl_policy_role_admin_attribute:login_enabled" }
        if ($validation_role.rolsuper -eq $true -or $validation_role.rolcreatedb -eq $true -or $validation_role.rolcreaterole -eq $true -or $validation_role.rolreplication -eq $true -or $validation_role.rolbypassrls -eq $true) { $result.errors += "database_acl_policy_role_admin_attribute" }
        if ($validation_role.member_of -contains $SessionRole) { $result.errors += "database_acl_policy_direct_membership_forbidden" }
    }

    if ($null -ne $RoleCatalogSnapshot -and $RoleCatalogSnapshot.ContainsKey($SessionRole)) {
        $session_role_entry = $RoleCatalogSnapshot[$SessionRole]
        if ($session_role_entry.member_of -contains $LocalValidationRole) { $result.errors += "database_acl_policy_direct_membership_forbidden" }
    }

    if ($result.errors.Count -eq 0) { $result.status = "PROPOSED_ROLE_STRATEGY_TEXTUALLY_ACCEPTABLE" }
    return $result
}

function PROPOSED_NEW_FUNCTION_BuildSchemaAllowlistPayload {
    param([string[]]$ExpectedSchemas, [string[]]$DiscoveredSchemas)

    $expected = @($ExpectedSchemas | Sort-Object -Unique)
    $discovered = @($DiscoveredSchemas | Sort-Object -Unique)
    $missing = @($expected | Where-Object { $_ -notin $discovered })
    $unexpected = @($discovered | Where-Object { $_ -notin $expected })

    return @{
        status = "PROPOSED_NOT_IMPLEMENTED"
        expected_schemas = $expected
        discovered_schemas = $discovered
        missing_schemas = $missing
        unexpected_schemas = $unexpected
        technical_validation_completed = "NO"
        error_code = $(if ($missing.Count -gt 0) { "database_acl_policy_schema_missing" } elseif ($unexpected.Count -gt 0) { "database_acl_policy_schema_unexpected" } else { "NONE" })
    }
}

function PROPOSED_NEW_FUNCTION_InvokeControlledAclPolicy {
    param([string]$SessionRole, [string]$LocalValidationRole, [string]$TempDatabaseName, [string[]]$AllowedSchemas)

    return @{
        status = "PROPOSED_NOT_IMPLEMENTED"
        real_session_identity = $SessionRole
        inspected_role = $LocalValidationRole
        temp_database = $TempDatabaseName
        allowed_schemas = $AllowedSchemas
        role_strategy = "SESSION_ROLE_WITH_EFFECTIVE_PRIVILEGE_ASSERTIONS"
        role_assumption_used = "NO"
        membership_between_roles = "NO"
        production_connection_allowed = "NO"
        production_connection_performed = "NO"
        technical_validation_completed = "NO"
        limitations = @("Effective privileges are inspected through catalog assertions; this does not impersonate the inspected role.")
        required_future_error_codes = @("database_acl_policy_role_missing", "database_acl_policy_role_admin_attribute", "database_acl_policy_direct_membership_forbidden", "database_acl_policy_indirect_membership_forbidden", "database_acl_policy_role_collision", "database_acl_policy_schema_missing", "database_acl_policy_schema_unexpected", "database_acl_policy_owner_mismatch", "database_acl_policy_public_privilege", "database_acl_policy_write_privilege", "database_acl_policy_execute_privilege", "database_acl_policy_default_privilege", "database_acl_policy_acl_semantics_mismatch", "database_acl_policy_post_verification_failed", "database_acl_policy_transaction_failed", "database_acl_policy_exit_propagation_failed")
    }
}

function PROPOSED_NEW_FUNCTION_TestExitCodePropagation {
    param([int]$ExpectedExitCode, [int]$ActualExitCode)

    return @{
        status = $(if ($ExpectedExitCode -eq $ActualExitCode) { "PROPOSED_EXIT_CODE_MATCH" } else { "PROPOSED_EXIT_CODE_MISMATCH" })
        expected_exit_code = $ExpectedExitCode
        actual_exit_code = $ActualExitCode
        technical_validation_completed = "NO"
        error_code = $(if ($ExpectedExitCode -eq $ActualExitCode) { "NONE" } else { "database_acl_policy_exit_propagation_failed" })
    }
}

function PROPOSED_NEW_FUNCTION_StopPipelineOnAclFailure {
    param([hashtable]$GateState)

    $required = @("STATIC_POLICY_VALIDATED", "CONTROLLED_TEMP_RESTORE_POLICY_VALIDATED", "DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED")
    $missing = @()
    foreach ($gate in $required) {
        if ($null -eq $GateState -or -not $GateState.ContainsKey($gate) -or $GateState[$gate] -ne "YES") { $missing += $gate }
    }

    return @{
        status = $(if ($missing.Count -eq 0) { "PROPOSED_GATE_TEXTUALLY_COMPLETE" } else { "PROPOSED_GATE_BLOCKED" })
        missing_gates = $missing
        continue_to_gate_c = "NO"
        continue_to_stage_2 = "NO"
        continue_to_r2 = "NO"
        technical_validation_completed = "NO"
        error_code = $(if ($missing.Count -eq 0) { "NONE" } else { "database_acl_policy_post_verification_failed" })
    }
}

$TASK005_STATIC_FIXTURES_AV = @(
    @{ id = "A"; category = "STATIC_TEXT"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "B"; category = "STATIC_TEXT"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "C"; category = "POWERSHELL_STATIC"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "D"; category = "POWERSHELL_STATIC"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "E"; category = "POWERSHELL_STATIC"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "F"; category = "POWERSHELL_STATIC"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "G"; category = "FUTURE_TEMP_POSTGRES"; future_temp_database_connection_required = "YES"; production_connection_allowed = "NO"; production_connection_performed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "H"; category = "POWERSHELL_STATIC"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "I"; category = "POWERSHELL_STATIC"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "J"; category = "POWERSHELL_STATIC"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "K"; category = "POWERSHELL_STATIC"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "L"; category = "POWERSHELL_STATIC"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "M"; category = "POWERSHELL_STATIC"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "N"; category = "FUTURE_TEMP_POSTGRES"; future_temp_database_connection_required = "YES"; production_connection_allowed = "NO"; production_connection_performed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "O"; category = "POWERSHELL_STATIC"; future_temp_database_connection_required = "NO"; production_connection_allowed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "P"; category = "FUTURE_TEMP_POSTGRES"; future_temp_database_connection_required = "YES"; production_connection_allowed = "NO"; production_connection_performed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "Q"; category = "FUTURE_TEMP_POSTGRES"; future_temp_database_connection_required = "YES"; production_connection_allowed = "NO"; production_connection_performed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "R"; category = "FUTURE_TEMP_POSTGRES"; future_temp_database_connection_required = "YES"; production_connection_allowed = "NO"; production_connection_performed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "S"; category = "FUTURE_TEMP_POSTGRES"; future_temp_database_connection_required = "YES"; production_connection_allowed = "NO"; production_connection_performed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "T"; category = "FUTURE_TEMP_POSTGRES"; future_temp_database_connection_required = "YES"; production_connection_allowed = "NO"; production_connection_performed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "U"; category = "FUTURE_TEMP_POSTGRES"; future_temp_database_connection_required = "YES"; production_connection_allowed = "NO"; production_connection_performed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" },
    @{ id = "V"; category = "FUTURE_TEMP_POSTGRES"; future_temp_database_connection_required = "YES"; production_connection_allowed = "NO"; production_connection_performed = "NO"; technical_validation_completed = "NO"; status = "NOT_EXECUTED" }
)

# ==============================================================================
# FIXTURES Y PRUEBAS ESTÁTICAS LOCALES (VALIDACIÓN EN MODO MOCK)
# ==============================================================================
function Test-StaticParsers {
    Write-Host "Iniciando pruebas estáticas de parsers y comparadores..."

    # ---- DOCUMENTACIÓN Y VARIABLES REAL_LINE_FIXTURE_SUPPORTED ----
    # Fundamento técnico de equivalencia y procedencia de formatos PG15/PG16:
    # 1. POLICY: La estructura en el listado de pg_restore --list es constante en ambas versiones:
    #    Formato: `POLICY <schema> <policy_name> ON <table_name> <owner>`
    # 2. TRIGGER: Mantiene su estructura posicional fija en ambas versiones:
    #    Formato: `TRIGGER <schema> <trigger_name> ON <table_name> <owner>`
    # Como esta validación es estática y no se invoca un comando pg_restore real sobre la base de producción
    # para comprobar la procedencia del stream de datos de forma dinámica en esta corrida, se declara "NO" a continuación:
    $global:POLICY_PG15_REAL_LINE_FIXTURE_SUPPORTED = "NO"
    $global:POLICY_PG16_REAL_LINE_FIXTURE_SUPPORTED = "NO"
    $global:TRIGGER_PG15_REAL_LINE_FIXTURE_SUPPORTED = "NO"
    $global:TRIGGER_PG16_REAL_LINE_FIXTURE_SUPPORTED = "NO"

    # Pruebas de normalización
    $id1 = Normalize-Single-Identifier('"Users Table"')
    $id2 = Normalize-Single-Identifier('Users')
    if ($id1 -ne '"Users Table"') { throw "Test failed: Normalize-Single-Identifier con comillas" }
    if ($id2 -ne "users") { throw "Test failed: Normalize-Single-Identifier normal" }

    $sig = Normalize-Complex-Signature("public.Calculate_Sum( NUMERIC(10,2), INT )")
    if ($sig -ne "public.calculate_sum(numeric(10,2),int)") { throw "Test failed: Normalize-Complex-Signature" }

    # Construir registries activos simulados para 15 y 16 basados en contratos completos
    $mock_reg_15 = @{}
    foreach ($k in $global:TOC_CONTRACTS.Keys) {
        if ($global:TOC_CONTRACTS[$k].SupportedVersions.Contains("15")) {
            $mock_reg_15[$k] = $global:TOC_CONTRACTS[$k]
        }
    }
    $mock_reg_16 = @{}
    foreach ($k in $global:TOC_CONTRACTS.Keys) {
        if ($global:TOC_CONTRACTS[$k].SupportedVersions.Contains("16")) {
            $mock_reg_16[$k] = $global:TOC_CONTRACTS[$k]
        }
    }
    $mock_registry = $mock_reg_15 # default mock registry is PG15

    # ---- CASOS POSITIVOS OBLIGATORIOS ----
    
    # 1. POLICY PG15
    $p_pg15 = Parse-TOC-Structural-Line '1999; 0 0 POLICY public "Select Policy" ON "custom_schema"."users" postgres' $mock_reg_15 "15"
    if ($p_pg15.Valid -ne $true -or $p_pg15.Descriptor -ne "POLICY" -or $p_pg15.Schema -ne "public" -or $p_pg15.Components.name -ne '"Select Policy"' -or $p_pg15.Components.table -ne '"custom_schema"."users"' -or $p_pg15.Owner -ne "postgres" -or $p_pg15.QualifiedIdentity -ne 'public."custom_schema"."users"."Select Policy"' -or $p_pg15.SupportedVersion -ne "15") {
        throw "Test failed: POLICY PG15 positive"
    }

    # 2. POLICY PG16
    $p_pg16 = Parse-TOC-Structural-Line '1999; 0 0 POLICY public "Select Policy" ON "custom_schema"."users" postgres' $mock_reg_16 "16"
    if ($p_pg16.Valid -ne $true -or $p_pg16.Descriptor -ne "POLICY" -or $p_pg16.Components.name -ne '"Select Policy"' -or $p_pg16.Components.table -ne '"custom_schema"."users"' -or $p_pg16.SupportedVersion -ne "16") {
        throw "Test failed: POLICY PG16 positive"
    }

    # 3. TRIGGER PG15
    $t_pg15 = Parse-TOC-Structural-Line '2000; 0 0 TRIGGER public update_timestamp ON posts postgres' $mock_reg_15 "15"
    if ($t_pg15.Valid -ne $true -or $t_pg15.Descriptor -ne "TRIGGER" -or $t_pg15.Schema -ne "public" -or $t_pg15.Components.name -ne "update_timestamp" -or $t_pg15.Components.table -ne "posts" -or $t_pg15.Owner -ne "postgres" -or $t_pg15.QualifiedIdentity -ne 'public.posts.update_timestamp' -or $t_pg15.SupportedVersion -ne "15") {
        throw "Test failed: TRIGGER PG15 positive"
    }

    # 4. TRIGGER PG16
    $t_pg16 = Parse-TOC-Structural-Line '2000; 0 0 TRIGGER public update_timestamp ON posts postgres' $mock_reg_16 "16"
    if ($t_pg16.Valid -ne $true -or $t_pg16.Descriptor -ne "TRIGGER" -or $t_pg16.Components.name -ne "update_timestamp" -or $t_pg16.Components.table -ne "posts" -or $t_pg16.SupportedVersion -ne "16") {
        throw "Test failed: TRIGGER PG16 positive"
    }

    # 5. DEFAULT ACL
    $def_acl = Parse-TOC-Structural-Line '1850; 0 0 DEFAULT ACL - DEFAULT ACL postgres' $mock_registry
    if ($def_acl.Valid -ne $true -or $def_acl.Descriptor -ne "DEFAULT ACL" -or $def_acl.Schema -ne "-" -or $def_acl.Name -ne "DEFAULT ACL" -or $def_acl.Owner -ne "postgres") {
        throw "Test failed: DEFAULT ACL positive"
    }

    # 6. TABLE
    $tbl = Parse-TOC-Structural-Line '120; 1259 16400 TABLE public users postgres' $mock_registry
    if ($tbl.Valid -ne $true -or $tbl.Descriptor -ne "TABLE" -or $tbl.Schema -ne "public" -or $tbl.Name -ne "users" -or $tbl.Owner -ne "postgres") {
        throw "Test failed: TABLE positive"
    }

    # 7. TABLE DATA
    $tbld = Parse-TOC-Structural-Line '1200; 0 16400 TABLE DATA public users postgres' $mock_registry
    if ($tbld.Valid -ne $true -or $tbld.Descriptor -ne "TABLE DATA" -or $tbld.Schema -ne "public" -or $tbld.Name -ne "users" -or $tbld.Owner -ne "postgres") {
        throw "Test failed: TABLE DATA positive"
    }

    # 8. VIEW
    $vw = Parse-TOC-Structural-Line '130; 1259 16410 VIEW public user_view postgres' $mock_registry
    if ($vw.Valid -ne $true -or $vw.Descriptor -ne "VIEW" -or $vw.Schema -ne "public" -or $vw.Name -ne "user_view" -or $vw.Owner -ne "postgres") {
        throw "Test failed: VIEW positive"
    }

    # 9. MATERIALIZED VIEW
    $mvw = Parse-TOC-Structural-Line '140; 1259 16420 MATERIALIZED VIEW public user_mview postgres' $mock_registry
    if ($mvw.Valid -ne $true -or $mvw.Descriptor -ne "MATERIALIZED VIEW" -or $mvw.Schema -ne "public" -or $mvw.Name -ne "user_mview" -or $mvw.Owner -ne "postgres") {
        throw "Test failed: MATERIALIZED VIEW positive"
    }

    # 10. MATERIALIZED VIEW DATA
    $mvw_d = Parse-TOC-Structural-Line '141; 1259 16420 MATERIALIZED VIEW DATA public user_mview postgres' $mock_registry
    if ($mvw_d.Valid -ne $true -or $mvw_d.Descriptor -ne "MATERIALIZED VIEW DATA" -or $mvw_d.Schema -ne "public" -or $mvw_d.Name -ne "user_mview" -or $mvw_d.Owner -ne "postgres") {
        throw "Test failed: MATERIALIZED VIEW DATA positive"
    }

    # 11. SEQUENCE
    $seq = Parse-TOC-Structural-Line '150; 1259 16430 SEQUENCE public users_id_seq postgres' $mock_registry
    if ($seq.Valid -ne $true -or $seq.Descriptor -ne "SEQUENCE" -or $seq.Schema -ne "public" -or $seq.Name -ne "users_id_seq" -or $seq.Owner -ne "postgres") {
        throw "Test failed: SEQUENCE positive"
    }

    # 12. SEQUENCE SET
    $seqs = Parse-TOC-Structural-Line '151; 1259 16430 SEQUENCE SET public users_id_seq postgres' $mock_registry
    if ($seqs.Valid -ne $true -or $seqs.Descriptor -ne "SEQUENCE SET" -or $seqs.Schema -ne "public" -or $seqs.Name -ne "users_id_seq" -or $seqs.owner -ne "postgres") {
        throw "Test failed: SEQUENCE SET positive"
    }

    # 13. SEQUENCE OWNED BY
    $seqo = Parse-TOC-Structural-Line '152; 1259 16430 SEQUENCE OWNED BY public users_id_seq postgres' $mock_registry
    if ($seqo.Valid -ne $true -or $seqo.Descriptor -ne "SEQUENCE OWNED BY" -or $seqo.Schema -ne "public" -or $seqo.Name -ne "users_id_seq" -or $seqo.owner -ne "postgres") {
        throw "Test failed: SEQUENCE OWNED BY positive"
    }

    # 14. FUNCTION
    $func = Parse-TOC-Structural-Line '160; 1255 16440 FUNCTION public get_user(integer, text) postgres' $mock_registry
    if ($func.Valid -ne $true -or $func.Descriptor -ne "FUNCTION" -or $func.Schema -ne "public" -or $func.Name -ne "get_user(integer, text)" -or $func.Owner -ne "postgres") {
        throw "Test failed: FUNCTION positive"
    }

    # 15. PROCEDURE
    $proc = Parse-TOC-Structural-Line '161; 1255 16441 PROCEDURE public get_user_proc(integer, text) postgres' $mock_registry
    if ($proc.Valid -ne $true -or $proc.Descriptor -ne "PROCEDURE" -or $proc.Schema -ne "public" -or $proc.Name -ne "get_user_proc(integer, text)" -or $proc.Owner -ne "postgres") {
        throw "Test failed: PROCEDURE positive"
    }

    # 16. Identifiers con espacios, puntos, colones y ->
    $tbl_sp = Parse-TOC-Structural-Line '121; 1259 16401 TABLE public "Users Table.With:Special->Chars""Escaped""" postgres' $mock_registry
    if ($tbl_sp.Valid -ne $true -or $tbl_sp.Name -ne '"Users Table.With:Special->Chars""Escaped"""') {
        throw "Test failed: TABLE with special chars positive"
    }

    # 17. Nombres iguales en schemas distintos con identidades diferentes
    $tbl_sch1 = Parse-TOC-Structural-Line '122; 1259 16402 TABLE public users postgres' $mock_registry
    $tbl_sch2 = Parse-TOC-Structural-Line '123; 1259 16403 TABLE private users postgres' $mock_registry
    if ($tbl_sch1.QualifiedIdentity -eq $tbl_sch2.QualifiedIdentity) {
        throw "Test failed: Identical names in different schemas returned matching identity"
    }

    # 18. Fixture de OriginalLine
    $line_test = '120; 1259 16400 TABLE public users postgres'
    $p_line = Parse-TOC-Structural-Line $line_test $mock_registry
    if ($p_line.OriginalLine -ne $line_test) {
        throw "Test failed: OriginalLine was not preserved exactly"
    }

    # ---- CASOS NEGATIVOS OBLIGATORIOS ----
    
    # 1. Descriptor desconocido
    $neg1 = Parse-TOC-Structural-Line '100; 0 0 UNKNOWN public name postgres' $mock_registry
    if ($neg1.Valid -eq $true -or $neg1.RejectionCode -ne "unknown_descriptor") { throw "Test failed: Unknown descriptor accepted" }

    # 2. Descriptor compuesto desconocido (se detecta como coincidencia parcial del prefijo contractual TABLE DATA)
    $neg2 = Parse-TOC-Structural-Line '101; 0 0 TABLE DATA EXT public name postgres' $mock_registry
    if ($neg2.Valid -eq $true -or $neg2.RejectionCode -ne "partial_descriptor_match") { throw "Test failed: Compound unknown descriptor accepted" }

    # 3. Coincidencia parcial (el descriptor completo es incorrecto y no coincide parcialmente con ningún prefijo contractual)
    $neg3 = Parse-TOC-Structural-Line '102; 0 0 TABLE_DATA_EXT public name postgres' $mock_registry
    if ($neg3.Valid -eq $true -or $neg3.RejectionCode -ne "unknown_descriptor") { throw "Test failed: Partial descriptor match accepted" }

    # 4. TABLE DATA EXT (no cae en TABLE DATA)
    $neg_tde = Parse-TOC-Structural-Line '1201; 0 0 TABLE DATA EXT public name postgres' $mock_registry
    if ($neg_tde.Valid -eq $true -or $neg_tde.RejectionCode -ne "partial_descriptor_match") { throw "Test failed: TABLE DATA EXT fell into TABLE DATA" }

    # 5. Descriptor vacío
    $neg4 = Parse-TOC-Structural-Line '103; 0 0   public name postgres' $mock_registry
    if ($neg4.Valid -eq $true -or $neg4.RejectionCode -ne "unknown_descriptor") { throw "Test failed: Empty descriptor accepted" }

    # 6. Encabezado TOC incompleto
    $neg5 = Parse-TOC-Structural-Line '104; 0' $mock_registry
    if ($neg5.Valid -eq $true -or $neg5.RejectionCode -ne "malformed_toc_header") { throw "Test failed: Malformed TOC header accepted" }

    # 7. Campos obligatorios faltantes
    $neg6 = Parse-TOC-Structural-Line '105; 0 0 TABLE public' $mock_registry
    if ($neg6.Valid -eq $true -or $neg6.RejectionCode -ne "missing_required_field") { throw "Test failed: Missing fields accepted" }

    # 8. Campos sobrantes
    $neg7 = Parse-TOC-Structural-Line '106; 0 0 DEFAULT ACL - DEFAULT ACL postgres extra' $mock_registry
    if ($neg7.Valid -eq $true -or $neg7.RejectionCode -ne "unexpected_extra_field") { throw "Test failed: Extra fields accepted" }

    # 9. Comillas desbalanceadas
    $neg8 = Parse-TOC-Structural-Line '107; 0 0 TABLE public "unbalanced postgres' $mock_registry
    if ($neg8.Valid -eq $true -or $neg8.RejectionCode -ne "unbalanced_quotes") { throw "Test failed: Unbalanced quotes accepted" }

    # 10. Identidad ambigua (vacia)
    # Se configura un builder que devuelva vacío para demostrar el flujo real hasta ambiguous_identity
    $temp_builder = { param($s, $n, $t) "" }
    $temp_reg = @{ "TABLE" = New-TOC-Contract "TABLE" 5 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_Any $global:Rule_Any $global:Rule_OwnerRequired $temp_builder "STANDARD" $true $global:Rejection_None $global:Parser_Standard }
    $neg_amb = Parse-TOC-Structural-Line '120; 1259 16400 TABLE public users postgres' $temp_reg
    if ($neg_amb.Valid -eq $true -or $neg_amb.RejectionCode -ne "ambiguous_identity") {
        throw "Test failed: Ambiguous identity not caught"
    }

    # ---- FIXTURES OBLIGATORIOS DE OPTIONAL COMPONENTS ----
    
    # Contrato mock con Required: schema, name, owner y Optional: alias
    # count_rule permite de 3 a 4 componentes remanentes (rango)
    $mock_builder_opt = { param($s, $n, $t) "mock_id" }
    
    # A) opcional ausente -> válido y Components no contiene alias
    $parser_opt_absent = {
        param($tokens, $contract)
        return @{ Valid = $true; Schema = $tokens[0]; Name = $tokens[1]; Owner = $tokens[2] }
    }
    $contract_opt = New-TOC-Contract "TABLE" 5 "STANDARD" @("15", "16") @("schema", "name", "owner") @("alias") @{ Min = 3; Max = 4 } $global:Rule_Any $global:Rule_Any $global:Rule_OwnerRequired $mock_builder_opt "STANDARD" $true $global:Rejection_None $parser_opt_absent
    $reg_opt_absent = @{ "TABLE" = $contract_opt }
    $res_opt_absent = Parse-TOC-Structural-Line '120; 1259 16400 TABLE public users postgres' $reg_opt_absent
    if ($res_opt_absent.Valid -ne $true -or $res_opt_absent.Components.ContainsKey("alias")) {
        throw "Test failed: OptionalComponents - optional absent is not valid or incorrectly contains alias"
    }

    # B) opcional presente -> válido y Components contiene alias con el valor exacto
    $parser_opt_present = {
        param($tokens, $contract)
        return @{ Valid = $true; Schema = $tokens[0]; Name = $tokens[1]; Owner = $tokens[2]; Alias = "users_alias" }
    }
    $reg_opt_present = @{ "TABLE" = New-TOC-Contract "TABLE" 5 "STANDARD" @("15", "16") @("schema", "name", "owner") @("alias") @{ Min = 3; Max = 4 } $global:Rule_Any $global:Rule_Any $global:Rule_OwnerRequired $mock_builder_opt "STANDARD" $true $global:Rejection_None $parser_opt_present }
    $res_opt_present = Parse-TOC-Structural-Line '120; 1259 16400 TABLE public users postgres' $reg_opt_present
    if ($res_opt_present.Valid -ne $true -or -not $res_opt_present.Components.ContainsKey("alias") -or $res_opt_present.Components["alias"] -ne "users_alias") {
        throw "Test failed: OptionalComponents - optional present was rejected or alias was not preserved correctly"
    }
    
    # C) opcional presente vacío -> válido y Components contiene alias con valor vacío
    $parser_opt_empty = {
        param($tokens, $contract)
        return @{ Valid = $true; Schema = $tokens[0]; Name = $tokens[1]; Owner = $tokens[2]; Alias = "" }
    }
    $reg_opt_empty = @{ "TABLE" = New-TOC-Contract "TABLE" 5 "STANDARD" @("15", "16") @("schema", "name", "owner") @("alias") @{ Min = 3; Max = 4 } $global:Rule_Any $global:Rule_Any $global:Rule_OwnerRequired $mock_builder_opt "STANDARD" $true $global:Rejection_None $parser_opt_empty }
    $res_opt_empty = Parse-TOC-Structural-Line '120; 1259 16400 TABLE public users postgres' $reg_opt_empty
    if ($res_opt_empty.Valid -ne $true -or -not $res_opt_empty.Components.ContainsKey("alias") -or $res_opt_empty.Components["alias"] -ne "") {
        throw "Test failed: OptionalComponents - optional present empty was rejected or empty value not preserved"
    }

    # D) opcional no declarado -> resultado inválido (unexpected_extra_field) y E) componente desconocido
    $parser_opt_unknown = {
        param($tokens, $contract)
        return @{ Valid = $true; Schema = $tokens[0]; Name = $tokens[1]; Owner = $tokens[2]; Unknown_Component = "extra" }
    }
    $reg_opt_unknown = @{ "TABLE" = New-TOC-Contract "TABLE" 5 "STANDARD" @("15", "16") @("schema", "name", "owner") @("alias") @{ Min = 3; Max = 4 } $global:Rule_Any $global:Rule_Any $global:Rule_OwnerRequired $mock_builder_opt "STANDARD" $true $global:Rejection_None $parser_opt_unknown }
    $res_opt_unknown = Parse-TOC-Structural-Line '120; 1259 16400 TABLE public users postgres' $reg_opt_unknown
    if ($res_opt_unknown.Valid -eq $true -or $res_opt_unknown.RejectionCode -ne "unexpected_extra_field") {
        throw "Test failed: OptionalComponents - unknown component was not rejected with unexpected_extra_field"
    }

    # G) Table no declarado -> se rechaza con unexpected_extra_field
    $parser_opt_table = {
        param($tokens, $contract)
        return @{ Valid = $true; Schema = $tokens[0]; Name = $tokens[1]; Owner = $tokens[2]; Table = "some_table" }
    }
    $reg_opt_table = @{ "TABLE" = New-TOC-Contract "TABLE" 5 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_Any $global:Rule_Any $global:Rule_OwnerRequired $mock_builder_opt "STANDARD" $true $global:Rejection_None $parser_opt_table }
    $res_opt_table = Parse-TOC-Structural-Line '120; 1259 16400 TABLE public users postgres' $reg_opt_table
    if ($res_opt_table.Valid -eq $true -or $res_opt_table.RejectionCode -ne "unexpected_extra_field") {
        throw "Test failed: OptionalComponents - undeclared Table was not rejected"
    }

    # F) Table declarado como required en POLICY/TRIGGER -> se conserva dentro de Components
    $p_table_val = Parse-TOC-Structural-Line '1999; 0 0 POLICY public "Select Policy" ON "custom_schema"."users" postgres' $mock_reg_15 "15"
    if ($p_table_val.Valid -ne $true -or -not $p_table_val.Components.ContainsKey("table") -or $p_table_val.Components["table"] -ne '"custom_schema"."users"') {
        throw "Test failed: Table declared as required in POLICY/TRIGGER was rejected or not preserved in Components"
    }

    # H) El resultado sería diferente si OptionalComponents estuviera vacío (se rechaza con unexpected_extra_field)
    $reg_opt_empty_decl = @{ "TABLE" = New-TOC-Contract "TABLE" 5 "STANDARD" @("15", "16") @("schema", "name", "owner") @() 3 $global:Rule_Any $global:Rule_Any $global:Rule_OwnerRequired $mock_builder_opt "STANDARD" $true $global:Rejection_None $parser_opt_present }
    $res_opt_empty_decl = Parse-TOC-Structural-Line '120; 1259 16400 TABLE public users postgres' $reg_opt_empty_decl
    if ($res_opt_empty_decl.Valid -eq $true -or $res_opt_empty_decl.RejectionCode -ne "unexpected_extra_field") {
        throw "Test failed: OptionalComponents - optional when empty was not rejected as unexpected_extra_field"
    }

    # ---- FIXTURES OBLIGATORIOS DE SIGNATURE ----
    
    # 1) FUNCTION simple válida
    $sig_f_ok = Parse-TOC-Structural-Line '160; 1255 16440 FUNCTION public get_user(integer) postgres' $mock_reg_15 "15"
    if ($sig_f_ok.Valid -ne $true -or $sig_f_ok.Name -ne "get_user(integer)" -or $sig_f_ok.Owner -ne "postgres") {
        throw "Test failed: SIGNATURE - FUNCTION simple valid failed"
    }

    # 2) PROCEDURE válida
    $sig_p_ok = Parse-TOC-Structural-Line '161; 1255 16441 PROCEDURE public get_user_proc(integer) postgres' $mock_reg_15 "15"
    if ($sig_p_ok.Valid -ne $true -or $sig_p_ok.Name -ne "get_user_proc(integer)" -or $sig_p_ok.Owner -ne "postgres") {
        throw "Test failed: SIGNATURE - PROCEDURE valid failed"
    }

    # 3) Firma con espacios
    $sig_space = Parse-TOC-Structural-Line '160; 1255 16440 FUNCTION public "calculate_sum(numeric(10,2), int)" postgres' $mock_reg_15 "15"
    if ($sig_space.Valid -ne $true -or $sig_space.Name -ne '"calculate_sum(numeric(10,2), int)"') {
        throw "Test failed: SIGNATURE - complex with spaces failed"
    }

    # 4) Tipos complejos
    $sig_comp_type = Parse-TOC-Structural-Line '160; 1255 16440 FUNCTION public "complex_func(numeric(10,2), timestamp with time zone)" postgres' $mock_reg_15 "15"
    if ($sig_comp_type.Valid -ne $true -or $sig_comp_type.Name -ne '"complex_func(numeric(10,2), timestamp with time zone)"') {
        throw "Test failed: SIGNATURE - complex type failed"
    }

    # 5) Paréntesis anidados
    $sig_nested = Parse-TOC-Structural-Line '160; 1255 16440 FUNCTION public "nested_func(array[(1,2)])" postgres' $mock_reg_15 "15"
    if ($sig_nested.Valid -ne $true -or $sig_nested.Name -ne '"nested_func(array[(1,2)])"') {
        throw "Test failed: SIGNATURE - nested parenthesis failed"
    }

    # 6) Apertura sin cierre -> rechazo exacto
    $sig_no_close = Parse-TOC-Structural-Line '160; 1255 16440 FUNCTION public "get_user(integer" postgres' $mock_reg_15 "15"
    if ($sig_no_close.Valid -eq $true -or $sig_no_close.RejectionCode -ne "unsupported_descriptor_grammar") {
        throw "Test failed: SIGNATURE - missing closing parenthesis not rejected correctly"
    }

    # 7) Cierre sin apertura -> rechazo exacto
    $sig_no_open = Parse-TOC-Structural-Line '160; 1255 16440 FUNCTION public "get_user)integer)" postgres' $mock_reg_15 "15"
    if ($sig_no_open.Valid -eq $true -or $sig_no_open.RejectionCode -ne "unsupported_descriptor_grammar") {
        throw "Test failed: SIGNATURE - missing opening parenthesis not rejected correctly"
    }

    # 8) Propietario faltante -> missing_required_field
    $sig_missing_owner = Parse-TOC-Structural-Line '160; 1255 16440 FUNCTION public get_user(integer)' $mock_reg_15 "15"
    if ($sig_missing_owner.Valid -eq $true -or $sig_missing_owner.RejectionCode -ne "missing_required_field") {
        throw "Test failed: SIGNATURE - missing owner not rejected correctly"
    }

    # 9) Campo después del propietario -> unexpected_extra_field
    $sig_extra_tok = Parse-TOC-Structural-Line '160; 1255 16440 FUNCTION public get_user(integer) postgres extra' $mock_reg_15 "15"
    if ($sig_extra_tok.Valid -eq $true -or $sig_extra_tok.RejectionCode -ne "unexpected_extra_field") {
        throw "Test failed: SIGNATURE - extra fields not rejected correctly"
    }

    # 10) Firma vacía -> rechazo exacto
    $sig_empty = Parse-TOC-Structural-Line '160; 1255 16440 FUNCTION public () postgres' $mock_reg_15 "15"
    if ($sig_empty.Valid -eq $true -or $sig_empty.RejectionCode -ne "unsupported_descriptor_grammar") {
        throw "Test failed: SIGNATURE - empty signature not rejected correctly"
    }

    # 11) Aplicación física de la regla contractual de conteo/rango (ComponentCountRule)
    $sig_min_count = Parse-TOC-Structural-Line '160; 1255 16440 FUNCTION public' $mock_reg_15 "15"
    if ($sig_min_count.Valid -eq $true -or $sig_min_count.RejectionCode -ne "missing_required_field") {
        throw "Test failed: SIGNATURE - ComponentCountRule range validation failed"
    }

    # 11. Contrato faltante
    $control_reg = @{ "FAKE_DESC" = @{ type = "STANDARD" } }
    $neg_cont = Parse-TOC-Structural-Line '999; 0 0 FAKE_DESC public name postgres' $control_reg
    if ($neg_cont.Valid -eq $true -or $neg_cont.RejectionCode -ne "descriptor_contract_missing") {
        throw "Test failed: Missing contract not rejected"
    }

    # 12. TABLE DATA interpretado como TABLE
    $neg9 = Parse-TOC-Structural-Line '1200; 0 16400 TABLE DATA public users postgres' $mock_registry
    if ($neg9.Descriptor -eq "TABLE") { throw "Test failed: TABLE DATA fell into TABLE contract" }

    # 13. SEQUENCE SET interpretado como SEQUENCE
    $neg10 = Parse-TOC-Structural-Line '151; 1259 16430 SEQUENCE SET public users_id_seq postgres' $mock_registry
    if ($neg10.Descriptor -eq "SEQUENCE") { throw "Test failed: SEQUENCE SET fell into SEQUENCE contract" }

    # 14. SEQUENCE OWNED BY interpretado como SEQUENCE
    $neg11 = Parse-TOC-Structural-Line '152; 1259 16430 SEQUENCE OWNED BY public users_id_seq postgres' $mock_registry
    if ($neg11.Descriptor -eq "SEQUENCE") { throw "Test failed: SEQUENCE OWNED BY fell into SEQUENCE contract" }

    # 15. MATERIALIZED VIEW interpretado como VIEW
    $neg12 = Parse-TOC-Structural-Line '140; 1259 16420 MATERIALIZED VIEW public user_mview postgres' $mock_registry
    if ($neg12.Descriptor -eq "VIEW") { throw "Test failed: MATERIALIZED VIEW fell into VIEW contract" }

    # 16. MATERIALIZED VIEW DATA interpretado como VIEW
    $neg13 = Parse-TOC-Structural-Line '141; 1259 16420 MATERIALIZED VIEW DATA public user_mview postgres' $mock_registry
    if ($neg13.Descriptor -eq "VIEW") { throw "Test failed: MATERIALIZED VIEW DATA fell into VIEW contract" }

    # 17. DEFAULT ACL interpretado como ACL
    $neg14 = Parse-TOC-Structural-Line '1850; 0 0 DEFAULT ACL - DEFAULT ACL postgres' $mock_registry
    if ($neg14.Descriptor -eq "ACL") { throw "Test failed: DEFAULT ACL fell into ACL contract" }

    # 18. DATABASE ACL interpretado como DATABASE
    $neg15 = Parse-TOC-Structural-Line '1824; 0 0 DATABASE ACL - DATABASE barberagency_prod postgres' $mock_registry
    if ($neg15.Descriptor -eq "DATABASE") { throw "Test failed: DATABASE ACL fell into DATABASE contract" }

    # 19. DATABASE PROPERTIES interpretado como DATABASE
    $neg16 = Parse-TOC-Structural-Line '1825; 0 0 DATABASE PROPERTIES - barberagency_prod postgres' $mock_registry
    if ($neg16.Descriptor -eq "DATABASE") { throw "Test failed: DATABASE PROPERTIES fell into DATABASE contract" }

    # 20. FK CONSTRAINT interpretado como CONSTRAINT
    $neg17 = Parse-TOC-Structural-Line '1826; 0 0 FK CONSTRAINT public constr postgres' $mock_registry
    if ($neg17.Descriptor -eq "CONSTRAINT") { throw "Test failed: FK CONSTRAINT fell into CONSTRAINT contract" }

    # 21. CHECK CONSTRAINT interpretado como CONSTRAINT
    $neg18 = Parse-TOC-Structural-Line '1827; 0 0 CHECK CONSTRAINT public constr postgres' $mock_registry
    if ($neg18.Descriptor -eq "CONSTRAINT") { throw "Test failed: CHECK CONSTRAINT fell into CONSTRAINT contract" }

    # 22. PUBLICATION TABLE interpretado como PUBLICATION
    $neg19 = Parse-TOC-Structural-Line '1829; 0 0 PUBLICATION TABLE - pub_tbl postgres' $mock_registry
    if ($neg19.Descriptor -eq "PUBLICATION") { throw "Test failed: PUBLICATION TABLE fell into PUBLICATION contract" }

    # 23. PUBLICATION TABLES IN SCHEMA interpretado como PUBLICATION TABLE
    $neg20 = Parse-TOC-Structural-Line '1830; 0 0 PUBLICATION TABLES IN SCHEMA - pub_schema postgres' $mock_registry
    if ($neg20.Descriptor -eq "PUBLICATION TABLE") { throw "Test failed: PUBLICATION TABLES IN SCHEMA fell into PUBLICATION TABLE contract" }

    # 24. DATABASE (Reconocido pero prohibido)
    $neg21 = Parse-TOC-Structural-Line '1; 0 0 DATABASE - barberagency_prod postgres' $mock_registry
    if ($neg21.Valid -eq $true -or $neg21.RejectionCode -ne "global_descriptor_forbidden" -or $neg21.Recognized -ne $true -or $neg21.AllowedForTemporaryRestore -eq $true) { throw "Test failed: DATABASE not rejected correctly" }

    # 25. DATABASE ACL (Reconocido pero prohibido)
    $neg22 = Parse-TOC-Structural-Line '1824; 0 0 DATABASE ACL - DATABASE barberagency_prod postgres' $mock_registry
    if ($neg22.Valid -eq $true -or $neg22.RejectionCode -ne "global_descriptor_forbidden" -or $neg22.Recognized -ne $true -or $neg22.AllowedForTemporaryRestore -eq $true) { throw "Test failed: DATABASE ACL not rejected correctly" }

    # 26. DATABASE PROPERTIES (Reconocido pero prohibido)
    $neg23 = Parse-TOC-Structural-Line '1825; 0 0 DATABASE PROPERTIES - barberagency_prod postgres' $mock_registry
    if ($neg23.Valid -eq $true -or $neg23.RejectionCode -ne "global_descriptor_forbidden" -or $neg23.Recognized -ne $true -or $neg23.AllowedForTemporaryRestore -eq $true) { throw "Test failed: DATABASE PROPERTIES not rejected correctly" }

    # 27. SUBSCRIPTION (Reconocido pero prohibido)
    $neg24 = Parse-TOC-Structural-Line '1826; 0 0 SUBSCRIPTION - sub_name postgres' $mock_registry
    if ($neg24.Valid -eq $true -or $neg24.RejectionCode -ne "external_descriptor_forbidden") { throw "Test failed: SUBSCRIPTION not rejected correctly" }

    # 28. SUBSCRIPTION TABLE (Reconocido pero prohibido)
    $neg25 = Parse-TOC-Structural-Line '1827; 0 0 SUBSCRIPTION TABLE - sub_tbl postgres' $mock_registry
    if ($neg25.Valid -eq $true -or $neg25.RejectionCode -ne "external_descriptor_forbidden") { throw "Test failed: SUBSCRIPTION TABLE not rejected correctly" }

    # 29. PUBLICATION (Reconocido pero prohibido)
    $neg26 = Parse-TOC-Structural-Line '1828; 0 0 PUBLICATION - pub_name postgres' $mock_registry
    if ($neg26.Valid -eq $true -or $neg26.RejectionCode -ne "external_descriptor_forbidden") { throw "Test failed: PUBLICATION not rejected correctly" }

    # 30. PUBLICATION TABLE (Reconocido pero prohibido)
    $neg27 = Parse-TOC-Structural-Line '1829; 0 0 PUBLICATION TABLE - pub_tbl postgres' $mock_registry
    if ($neg27.Valid -eq $true -or $neg27.RejectionCode -ne "external_descriptor_forbidden") { throw "Test failed: PUBLICATION TABLE not rejected correctly" }

    # 31. PUBLICATION TABLES IN SCHEMA (Reconocido pero prohibido)
    $neg28 = Parse-TOC-Structural-Line '1830; 0 0 PUBLICATION TABLES IN SCHEMA - pub_schema postgres' $mock_registry
    if ($neg28.Valid -eq $true -or $neg28.RejectionCode -ne "external_descriptor_forbidden") { throw "Test failed: PUBLICATION TABLES IN SCHEMA not rejected correctly" }

    # 32. SERVER (Reconocido pero prohibido)
    $neg29 = Parse-TOC-Structural-Line '1831; 0 0 SERVER - srv postgres' $mock_registry
    if ($neg29.Valid -eq $true -or $neg29.RejectionCode -ne "external_descriptor_forbidden") { throw "Test failed: SERVER not rejected correctly" }

    # 33. USER MAPPING (Reconocido pero prohibido)
    $neg30 = Parse-TOC-Structural-Line '1832; 0 0 USER MAPPING - map postgres' $mock_registry
    if ($neg30.Valid -eq $true -or $neg30.RejectionCode -ne "external_descriptor_forbidden") { throw "Test failed: USER MAPPING not rejected correctly" }

    # 34. FOREIGN DATA WRAPPER (Reconocido pero prohibido)
    $neg31 = Parse-TOC-Structural-Line '1833; 0 0 FOREIGN DATA WRAPPER - fdw postgres' $mock_registry
    if ($neg31.Valid -eq $true -or $neg31.RejectionCode -ne "external_descriptor_forbidden") { throw "Test failed: FOREIGN DATA WRAPPER not rejected correctly" }

    # 35. ACCESS METHOD (Reconocido pero prohibido)
    $neg32 = Parse-TOC-Structural-Line '1834; 0 0 ACCESS METHOD - am postgres' $mock_registry
    if ($neg32.Valid -eq $true -or $neg32.RejectionCode -ne "external_descriptor_forbidden") { throw "Test failed: ACCESS METHOD not rejected correctly" }

    # 36. TABLESPACE (Reconocido pero prohibido)
    $neg33 = Parse-TOC-Structural-Line '1835; 0 0 TABLESPACE - ts postgres' $mock_registry
    if ($neg33.Valid -eq $true -or $neg33.RejectionCode -ne "external_descriptor_forbidden") { throw "Test failed: TABLESPACE not rejected correctly" }

    # 37. ROLE (Reconocido pero prohibido)
    $neg34 = Parse-TOC-Structural-Line '1836; 0 0 ROLE - rol postgres' $mock_registry
    if ($neg34.Valid -eq $true -or $neg34.RejectionCode -ne "global_descriptor_forbidden") { throw "Test failed: ROLE not rejected correctly" }

    # 38. EVENT TRIGGER (Reconocido pero prohibido)
    $neg35 = Parse-TOC-Structural-Line '1837; 0 0 EVENT TRIGGER - et postgres' $mock_registry
    if ($neg35.Valid -eq $true -or $neg35.RejectionCode -ne "global_descriptor_forbidden") { throw "Test failed: EVENT TRIGGER not rejected correctly" }

    # ---- COMPROBACIÓN DE CONSISTENCIA DEL REGISTRO ----
    # Comprobar que todos los descriptores en global:TOC_CONTRACTS tienen contratos con las 14 claves obligatorias y Parser
    $keys_req = @("Descriptor", "RecognitionPriority", "SupportedGrammar", "SupportedVersions", "RequiredComponents", "OptionalComponents", "ComponentCountRule", "SchemaRule", "NameRule", "OwnerRule", "IdentityBuilder", "SecurityClassification", "AllowedForTemporaryRestore", "DeterministicRejectionRule", "Parser")
    foreach ($k in $global:TOC_CONTRACTS.Keys) {
        $c = $global:TOC_CONTRACTS[$k]
        # 1. Contrato completo con las 15 claves (incluyendo Parser)
        foreach ($rk in $keys_req) {
            if (-not $c.Contains($rk)) {
                throw "Registry consistency fail: key $rk missing in contract for $k"
            }
        }
        if ($null -eq $c.Parser) {
            throw "Registry consistency fail: Parser is null for $k"
        }
        # 2. Todo permitido tiene gramática aplicable
        if ($c.AllowedForTemporaryRestore -eq $true) {
            if ($c.SupportedGrammar -notin @("GLOBAL", "GLOBAL_EXT", "STANDARD", "SIGNATURE", "POLICY_OR_TRIGGER", "COMMENT", "ACL", "DEFAULT_ACL")) {
                throw "Registry consistency fail: Allowed descriptor $k has invalid grammar $($c.SupportedGrammar)"
            }
        }
        # 3. Ningún prohibido tiene AllowedForTemporaryRestore = true
        if ($c.SecurityClassification -in @("DANGEROUS", "EXTERNAL")) {
            if ($c.AllowedForTemporaryRestore -eq $true) {
                throw "Registry consistency fail: Forbidden descriptor $k has AllowedForTemporaryRestore = true"
            }
        }
    }

    # 4. Los compuestos tienen prioridad efectiva sobre sus prefijos simples (Ambigüedad efectiva)
    foreach ($k1 in $global:TOC_CONTRACTS.Keys) {
        foreach ($k2 in $global:TOC_CONTRACTS.Keys) {
            if ($k1 -ne $k2 -and $k2.StartsWith($k1)) {
                if ($global:TOC_CONTRACTS[$k2].RecognitionPriority -le $global:TOC_CONTRACTS[$k1].RecognitionPriority) {
                    throw "Registry consistency fail: Composite descriptor $k2 must have higher priority than simple descriptor $k1"
                }
            }
        }
    }

    # 5. Validar que no existan contradicciones entre clasificaciones y allowlist
    foreach ($k in $global:TOC_CONTRACTS.Keys) {
        $c = $global:TOC_CONTRACTS[$k]
        if ($c.AllowedForTemporaryRestore -eq $true) {
            if ($c.SecurityClassification -in @("DANGEROUS", "EXTERNAL")) {
                throw "Registry consistency fail: Contradiction for $k. Allowed for temp restore but security classification is $($c.SecurityClassification)"
            }
            if ($c.OperationalHandling -eq "FORBIDDEN") {
                throw "Registry consistency fail: Contradiction for $k. Allowed for temp restore but OperationalHandling is FORBIDDEN"
            }
            if (-not $global:RESTORE_ALLOWLIST.Contains($k)) {
                throw "Registry consistency fail: Contradiction for $k. Allowed for temp restore but not in allowlist"
            }
        } else {
            if ($global:RESTORE_ALLOWLIST.Contains($k)) {
                throw "Registry consistency fail: Contradiction for $k. Not allowed for temp restore but present in allowlist"
            }
        }
    }

    Write-Host "Todas las pruebas estáticas completadas exitosamente."
    return $true
}

# Ejecución condicional en modo de prueba estática aislada
if ($TestStaticParsersOnly) {
    try {
        $ok = Test-StaticParsers
        if ($ok) { exit 0 } else { exit 1 }
    } catch {
        Write-Host "Error en validacion fixture: $_"
        exit 1
    }
}

# ==============================================================================
# EJECUCIÓN TOTAL BAJO EL CATCH/FINALLY GLOBAL (RESPALDO REAL)
# ==============================================================================
try {
    if ($TASK005_GATE -ne "EXPLICIT_TECHNICAL_EXECUTION_AUTHORIZED") {
        throw "TASK005_GATE_B_STATIC_ONLY_NO_TECHNICAL_EXECUTION_AUTHORIZED"
    }

    # OPCIÓN B: Bloquear el respaldo antes de acceder a producción si no se puede resolver la equivalencia de DATABASE ACL.
    if ($DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED -ne "YES") {
        throw "DATABASE_ACL_RESTORE_EQUIVALENCE_UNRESOLVED"
    }

    if (-not $env:SSH_HOST) {
        throw "Error: Variable de entorno SSH_HOST no definida."
    }
    if (-not $env:SSH_KEY_PATH) {
        throw "Error: Variable de entorno SSH_KEY_PATH no definida."
    }
    if (-not $env:AWS_ACCESS_KEY_ID -or -not $env:AWS_SECRET_ACCESS_KEY -or -not $env:R2_ENDPOINT) {
        throw "Error: Credenciales temporales R2 o R2_ENDPOINT no definidas."
    }

    $utc_instant = [System.DateTime]::UtcNow
    $year = $utc_instant.ToString("yyyy")
    $month = $utc_instant.ToString("MM")
    $utc_now = $utc_instant.ToString("yyyyMMddTHHmmssZ")
    $uuid = [System.Guid]::NewGuid().ToString()

    $backup_name = "barberagency_prod_$($utc_now)_$($uuid).dump"
    $manifest_name = "$backup_name.list"
    $inventory_name = "roles_inventory_$($utc_now)_$($uuid).json"

    $r2_key_dump = "production/postgresql/$year/$month/$backup_name"
    $r2_key_manifest = "production/postgresql/$year/$month/$manifest_name"
    $r2_key_inventory = "production/postgresql/$year/$month/$inventory_name"

    if ($backup_name -notmatch '^barberagency_prod_\d{8}T\d{6}Z_[a-f0-9-]{36}\.dump$') {
        throw "Error: Nombre de backup no conforme con el patrón UTC + UUID"
    }

    $container_backup_dir = "/tmp/barberagency-backup"
    $container_tmp_path = "$container_backup_dir/$backup_name"
    $container_manifest_path = "$container_backup_dir/$manifest_name"
    $container_inventory_path = "$container_backup_dir/$inventory_name"

    $remote_tmp_path = "/tmp/barberagency-backup/$backup_name"
    $remote_manifest_path = "/tmp/barberagency-backup/$manifest_name"
    $remote_inventory_path = "/tmp/barberagency-backup/$inventory_name"

    if (-not $container_tmp_path.StartsWith("/tmp/barberagency-backup/")) { throw "Error de prefijo de ruta" }
    if (-not $remote_tmp_path.StartsWith("/tmp/barberagency-backup/")) { throw "Error de prefijo de ruta" }

    $local_base_dir = "$env:LOCALAPPDATA\BarberAgency\secure-backup-temp"
    $local_tmp_dir = "$local_base_dir\$uuid"
    $local_tmp_path = "$local_tmp_dir\$backup_name"
    $local_manifest_path = "$local_tmp_dir\$manifest_name"
    $local_inventory_path = "$local_tmp_dir\$inventory_name"

    if ($local_tmp_dir -like "*OneDrive*") {
        throw "Error de seguridad: Ruta en OneDrive detectada."
    }

    New-Item -ItemType Directory -Force -Path $local_tmp_dir > $null
    
    $acl = Get-Acl $local_tmp_dir
    $acl.SetAccessRuleProtection($true, $false)
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentUser, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
    $acl.AddAccessRule($rule)
    Set-Acl $local_tmp_dir $acl

    $pg_dump_ver_out = ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec barberagency-postgres pg_dump --version"
    if ($LASTEXITCODE -ne 0) { throw "Error al obtener la version de pg_dump" }
    
    $pg_restore_ver_out = ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec barberagency-postgres pg_restore --version"
    if ($LASTEXITCODE -ne 0) { throw "Error al obtener la version de pg_restore" }
    
    $pg_server_ver_out = ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec barberagency-postgres psql -U postgres -d barberagency_prod -t -A -c 'SHOW server_version;'"
    if ($LASTEXITCODE -ne 0) { throw "Error al obtener la version del servidor PostgreSQL" }

    $dump_ver_match = [regex]::Match($pg_dump_ver_out, '(\d+)\.\d+')
    $restore_ver_match = [regex]::Match($pg_restore_ver_out, '(\d+)\.\d+')
    $server_ver_match = [regex]::Match($pg_server_ver_out, '^(\d+)\.\d+')

    if (-not $dump_ver_match.Success -or -not $restore_ver_match.Success -or -not $server_ver_match.Success) {
        throw "Error: Formato de version invalido detectado."
    }

    $dump_major = [int]$dump_ver_match.Groups[1].Value
    $restore_major = [int]$restore_ver_match.Groups[1].Value
    $server_major = [int]$server_ver_match.Groups[1].Value

    if ($dump_major -ne $restore_major) {
        throw "Error: Incompatibilidad entre pg_dump ($dump_major) y pg_restore ($restore_major)."
    }
    if ($dump_major -lt $server_major) {
        throw "Error: pg_dump ($dump_major) no es compatible con el servidor PostgreSQL ($server_major)."
    }

    $major_str = $restore_major.ToString()
    if ($major_str -ne "15" -and $major_str -ne "16") {
        throw "Error: Version de pg_restore no soportada."
    }
    
    # Construir active_registry de forma dinámica y contractual
    $active_registry = @{}
    foreach ($k in $global:TOC_CONTRACTS.Keys) {
        $c = $global:TOC_CONTRACTS[$k]
        if ($c.SupportedVersions.Contains($major_str)) {
            $active_registry[$k] = $c
        }
    }
    $TOC_DESCRIPTOR_REGISTRY_VALIDATED = "YES"

    ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec -u postgres barberagency-postgres mkdir -p $container_backup_dir"
    if ($LASTEXITCODE -ne 0) { throw "TEMP_DB_CREATE_FAILED" }

    ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec -u postgres barberagency-postgres pg_dump -U postgres -d barberagency_prod -Fc -f $container_tmp_path"
    if ($LASTEXITCODE -ne 0) { throw "Error ejecutando pg_dump" }
    $state.container_dump_created = $true

    ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec -u postgres barberagency-postgres sh -c 'pg_restore --list $container_tmp_path > $container_manifest_path'"
    if ($LASTEXITCODE -ne 0) { throw "pg_restore --list dentro del contenedor falló" }
    $state.container_manifest_created = $true

    $sql_inventory = @"
SELECT json_build_object(
  'summary', (
    SELECT json_object_agg(category, count) FROM (
      SELECT 'SCHEMA' AS category, COUNT(*) AS count FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema' AND nspname NOT LIKE 'pg_temp_%' AND nspname NOT LIKE 'pg_toast%'
      UNION ALL
      SELECT 'TABLE', COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'r' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')
      UNION ALL
      SELECT 'TABLE DATA', COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'r' AND c.relpersistence != 't' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')
      UNION ALL
      SELECT 'SEQUENCE', COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'S' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')
      UNION ALL
      SELECT 'VIEW', COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'v' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')
      UNION ALL
      SELECT 'MATERIALIZED VIEW', COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'm' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')
      UNION ALL
      SELECT 'FUNCTION', COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND p.prokind = 'f' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid AND dep.deptype = 'e')
      UNION ALL
      SELECT 'PROCEDURE', COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND p.prokind = 'p' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid AND dep.deptype = 'e')
      UNION ALL
      SELECT 'TRIGGER', COUNT(*) FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND NOT t.tgisinternal AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_trigger'::regclass AND dep.objid = t.oid AND dep.deptype = 'e')
      UNION ALL
      SELECT 'POLICY', COUNT(*) FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%')
      UNION ALL
      SELECT 'ROW SECURITY', COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND (c.relrowsecurity OR c.relforcerowsecurity) AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')
      UNION ALL
      SELECT 'EXTENSION', COUNT(*) FROM pg_extension
      UNION ALL
      SELECT 'ACL', (
        (SELECT COUNT(*) FROM pg_database WHERE datacl IS NOT NULL AND datname = 'barberagency_prod') +
        (SELECT COUNT(*) FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema' AND nspname NOT LIKE 'pg_temp_%' AND nspname NOT LIKE 'pg_toast%' AND nspacl IS NOT NULL) +
        (SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relacl IS NOT NULL AND c.relkind IN ('r', 'v', 'm', 'S') AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')) +
        (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid AND dep.deptype = 'e'))
      )
      UNION ALL
      SELECT 'DEFAULT ACL', COUNT(*) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace WHERE n.nspname IS NULL OR (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%')
    ) q
  ),
  'details', json_build_object(
    'SCHEMA', (SELECT COALESCE(json_agg(nspname::text), '[]'::json) FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema' AND nspname NOT LIKE 'pg_temp_%' AND nspname NOT LIKE 'pg_toast%'),
    'TABLE', (SELECT COALESCE(json_agg((n.nspname || '.' || c.relname)::text), '[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'r' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')),
    'TABLE DATA', (SELECT COALESCE(json_agg((n.nspname || '.' || c.relname)::text), '[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'r' AND c.relpersistence != 't' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')),
    'SEQUENCE', (SELECT COALESCE(json_agg((n.nspname || '.' || c.relname)::text), '[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'S' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')),
    'VIEW', (SELECT COALESCE(json_agg((n.nspname || '.' || c.relname)::text), '[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'v' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')),
    'MATERIALIZED VIEW', (SELECT COALESCE(json_agg((n.nspname || '.' || c.relname)::text), '[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'm' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')),
    'FUNCTION', (SELECT COALESCE(json_agg((n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')::text), '[]'::json) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND p.prokind = 'f' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid AND dep.deptype = 'e')),
    'PROCEDURE', (SELECT COALESCE(json_agg((n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')::text), '[]'::json) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND p.prokind = 'p' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid AND dep.deptype = 'e')),
    'TRIGGER', (SELECT COALESCE(json_agg((n.nspname || '.' || c.relname || '.' || t.tgname)::text), '[]'::json) FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND NOT t.tgisinternal AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_trigger'::regclass AND dep.objid = t.oid AND dep.deptype = 'e')),
    'POLICY', (SELECT COALESCE(json_agg((n.nspname || '.' || c.relname || '.' || p.polname)::text), '[]'::json) FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%')),
    'ROW SECURITY', (SELECT COALESCE(json_agg((n.nspname || '.' || c.relname)::text), '[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND (c.relrowsecurity OR c.relforcerowsecurity) AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')),
    'EXTENSION', (SELECT COALESCE(json_agg(extname::text), '[]'::json) FROM pg_extension),
    'DATABASE ACL', (SELECT COALESCE(json_agg(datname::text), '[]'::json) FROM pg_database WHERE datacl IS NOT NULL AND datname = 'barberagency_prod'),
    'SCHEMA ACL', (SELECT COALESCE(json_agg(nspname::text), '[]'::json) FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema' AND nspname NOT LIKE 'pg_temp_%' AND nspname NOT LIKE 'pg_toast%' AND nspacl IS NOT NULL),
    'TABLE ACL', (SELECT COALESCE(json_agg((n.nspname || '.' || c.relname)::text), '[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'r' AND c.relacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')),
    'VIEW ACL', (SELECT COALESCE(json_agg((n.nspname || '.' || c.relname)::text), '[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'v' AND c.relacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')),
    'MATERIALIZED VIEW ACL', (SELECT COALESCE(json_agg((n.nspname || '.' || c.relname)::text), '[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'm' AND c.relacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')),
    'SEQUENCE ACL', (SELECT COALESCE(json_agg((n.nspname || '.' || c.relname)::text), '[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind = 'S' AND c.relacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')),
    'FUNCTION ACL', (SELECT COALESCE(json_agg((n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')::text), '[]'::json) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND p.prokind = 'f' AND p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid AND dep.deptype = 'e')),
    'PROCEDURE ACL', (SELECT COALESCE(json_agg((n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')::text), '[]'::json) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND p.prokind = 'p' AND p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid AND dep.deptype = 'e')),
    'DEFAULT ACL', (SELECT COALESCE(json_agg((pg_catalog.pg_get_userbyid(d.defaclrole) || ' ON ' || COALESCE(n.nspname, 'GLOBAL') || ' FOR ' || d.defaclobjtype)::text), '[]'::json) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace WHERE n.nspname IS NULL OR (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%'))
  ),
  'roles', (
    SELECT json_agg(json_build_object(
      'rolname', rolname, 'rolsuper', rolsuper, 'rolinherit', rolinherit, 'rolcreaterole', rolcreaterole,
      'rolcreatedb', rolcreatedb, 'rolcanlogin', rolcanlogin, 'rolreplication', rolreplication,
      'rolbypassrls', rolbypassrls, 'rolconnlimit', rolconnlimit
    )) FROM pg_roles
  ),
  'memberships', (
    SELECT COALESCE(json_agg(json_build_object(
      'member', r1.rolname, 'group', r2.rolname, 'grantor', r3.rolname, 'admin_option', m.admin_option
    )), '[]'::json) FROM pg_auth_members m 
    JOIN pg_roles r1 ON m.member = r1.oid 
    JOIN pg_roles r2 ON m.roleid = r2.oid 
    JOIN pg_roles r3 ON m.grantor = r3.oid
  ),
  'role_settings', (
    SELECT COALESCE(json_agg(json_build_object(
      'rolname', r.rolname, 'datname', d.datname, 'setconfig', s.setconfig
    )), '[]'::json) FROM pg_db_role_setting s 
    LEFT JOIN pg_roles r ON r.oid = s.setrole 
    LEFT JOIN pg_database d ON d.oid = s.setdatabase
  ),
  'db_acls', (
    SELECT COALESCE(json_agg(json_build_object(
      'datname', d.datname, 
      'owner', pg_catalog.pg_get_userbyid(d.datdba), 
      'acl_is_explicit', (d.datacl IS NOT NULL),
      'explicit_acl', CASE WHEN d.datacl IS NOT NULL THEN (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(d.datacl)) ELSE '[]'::json END,
      'effective_acl', (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))))
    )), '[]'::json) FROM pg_database d WHERE d.datname = 'barberagency_prod'
  ),
  'schema_acls', (
    SELECT COALESCE(json_agg(json_build_object(
      'nspname', n.nspname, 
      'owner', pg_catalog.pg_get_userbyid(n.nspowner), 
      'acl_is_explicit', (n.nspacl IS NOT NULL),
      'explicit_acl', CASE WHEN n.nspacl IS NOT NULL THEN (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(n.nspacl)) ELSE '[]'::json END,
      'effective_acl', (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))))
    )), '[]'::json) FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%'
  ),
  'relation_acls', (
    SELECT COALESCE(json_agg(json_build_object(
      'relname', c.relname, 
      'schema', n.nspname,
      'relkind', c.relkind,
      'owner', pg_catalog.pg_get_userbyid(c.relowner), 
      'acl_is_explicit', (c.relacl IS NOT NULL),
      'explicit_acl', CASE WHEN c.relacl IS NOT NULL THEN (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(c.relacl)) ELSE '[]'::json END,
      'effective_acl', (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(COALESCE(c.relacl, CASE c.relkind WHEN 'S' THEN acldefault('S', c.relowner) ELSE acldefault('r', c.relowner) END)))
    )), '[]'::json) FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind IN ('r', 'v', 'm', 'S') AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')
  ),
  'proc_acls', (
    SELECT COALESCE(json_agg(json_build_object(
      'proname', p.proname, 
      'schema', n.nspname,
      'prokind', p.prokind,
      'signature', pg_get_function_identity_arguments(p.oid),
      'owner', pg_catalog.pg_get_userbyid(p.proowner), 
      'acl_is_explicit', (p.proacl IS NOT NULL),
      'explicit_acl', CASE WHEN p.proacl IS NOT NULL THEN (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(p.proacl)) ELSE '[]'::json END,
      'effective_acl', (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))))
    )), '[]'::json) FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid AND dep.deptype = 'e')
  ),
  'default_acls', (
    SELECT COALESCE(json_agg(json_build_object(
      'role', pg_catalog.pg_get_userbyid(d.defaclrole), 
      'schema', COALESCE(n.nspname, 'GLOBAL'), 
      'defaclobjtype', d.defaclobjtype, 
      'acl', (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(d.defaclacl))
    )), '[]'::json) FROM pg_default_acl d 
    LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE n.nspname IS NULL OR (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%')
  )
)::text AS inventory_json;
"@

    $container_sql_path = "$container_backup_dir/inventory_query.sql"
    $remote_sql_path = "/tmp/barberagency-backup/inventory_query.sql"
    $local_sql_path = "$local_tmp_dir\inventory_query.sql"

    $sql_inventory | Out-File -FilePath $local_sql_path -Encoding utf8

    scp -i "$env:SSH_KEY_PATH" "$local_sql_path" ubuntu@$env:SSH_HOST:$remote_sql_path
    if ($LASTEXITCODE -ne 0) { throw "Error al transferir SQL de inventario" }

    ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker cp $remote_sql_path barberagency-postgres:$container_sql_path"
    if ($LASTEXITCODE -ne 0) { throw "Error al importar SQL al contenedor" }

    ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec -u postgres barberagency-postgres psql -U postgres -d barberagency_prod -t -A -q -f $container_sql_path -o $container_inventory_path"
    if ($LASTEXITCODE -ne 0) { throw "Error al extraer el inventario de roles en contenedor" }
    $state.container_inventory_created = $true

    ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "mkdir -p /tmp/barberagency-backup"
    if ($LASTEXITCODE -ne 0) { throw "Error al crear directorio en host remoto" }

    ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker cp barberagency-postgres:$container_tmp_path $remote_tmp_path"
    if ($LASTEXITCODE -ne 0) { throw "Error cp dump" }
    $state.remote_dump_created = $true

    ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker cp barberagency-postgres:$container_manifest_path $remote_manifest_path"
    if ($LASTEXITCODE -ne 0) { throw "Error cp manifest" }
    $state.remote_manifest_created = $true

    ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker cp barberagency-postgres:$container_inventory_path $remote_inventory_path"
    if ($LASTEXITCODE -ne 0) { throw "Error cp inventory" }
    $state.remote_inventory_created = $true

    scp -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST:$remote_tmp_path "$local_tmp_path"
    if ($LASTEXITCODE -ne 0) { throw "Error scp dump" }
    $state.local_dump_created = $true

    scp -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST:$remote_manifest_path "$local_manifest_path"
    if ($LASTEXITCODE -ne 0) { throw "Error scp manifest" }
    $state.local_manifest_created = $true

    scp -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST:$remote_inventory_path "$local_inventory_path"
    if ($LASTEXITCODE -ne 0) { throw "Error scp inventory" }
    $state.local_inventory_created = $true

    $local_hash = (Get-FileHash -Path "$local_tmp_path" -Algorithm SHA256).Hash.ToLower()
    $local_size = (Get-Item -Path "$local_tmp_path").Length

    $local_manifest_hash = (Get-FileHash -Path "$local_manifest_path" -Algorithm SHA256).Hash.ToLower()
    $local_manifest_size = (Get-Item -Path "$local_manifest_path").Length

    $local_inventory_hash = (Get-FileHash -Path "$local_inventory_path" -Algorithm SHA256).Hash.ToLower()
    $local_inventory_size = (Get-Item -Path "$local_inventory_path").Length

    try {
        $inventory_data = Get-Content "$local_inventory_path" -Raw | ConvertFrom-Json
    } catch {
        throw "Error: El archivo de inventario no tiene un formato JSON valido."
    }

    if ($null -eq $inventory_data -or $null -eq $inventory_data.summary) {
        throw "Error: Formato de inventario no valido (objeto summary no encontrado)."
    }

    $expected_categories = @("SCHEMA", "TABLE", "TABLE DATA", "SEQUENCE", "VIEW", "MATERIALIZED VIEW", "FUNCTION", "PROCEDURE", "TRIGGER", "POLICY", "ROW SECURITY", "EXTENSION", "ACL", "DEFAULT ACL")

    foreach ($cat in $expected_categories) {
        $val = $inventory_data.summary.$cat
        if ($null -eq $val) {
            throw "Error: Falta la categoria obligatoria '$cat' en el inventario."
        }
        
        if ($val -notmatch '^\d+$') {
            throw "Error: Conteo no valido o no numerico para la categoria '$cat': '$val'"
        }
        
        $count = [int]$val
        if ($count -lt 0) {
            throw "Error: Conteo negativo para la categoria '$cat': $count"
        }
    }

    $manifest_content = Get-Content "$local_manifest_path"

    $catalog_to_toc_map = @{
        "SCHEMA"            = "SCHEMA"
        "TABLE"             = "TABLE"
        "TABLE DATA"        = "TABLE DATA"
        "SEQUENCE"          = "SEQUENCE"
        "VIEW"              = "VIEW"
        "MATERIALIZED VIEW" = "MATERIALIZED VIEW"
        "EXTENSION"         = "EXTENSION"
        "FUNCTION"          = "FUNCTION"
        "PROCEDURE"         = "PROCEDURE"
        "TRIGGER"           = "TRIGGER"
        "POLICY"            = "POLICY"
        "ROW SECURITY"      = "ROW SECURITY"
        "DATABASE ACL"      = "DATABASE ACL"
        "SCHEMA ACL"        = "SCHEMA ACL"
        "TABLE ACL"         = "TABLE ACL"
        "VIEW ACL"          = "VIEW ACL"
        "MATERIALIZED VIEW ACL" = "MATERIALIZED VIEW ACL"
        "SEQUENCE ACL"      = "SEQUENCE ACL"
        "FUNCTION ACL"      = "FUNCTION ACL"
        "PROCEDURE ACL"     = "PROCEDURE ACL"
    }

    $manifest_objects = @{}
    foreach ($val in $catalog_to_toc_map.Values) {
        $manifest_objects[$val] = @()
    }
    $manifest_objects["DEFAULT ACL"] = @()

    foreach ($t in $active_registry.Keys) {
        if ($active_registry[$t].OperationalHandling -eq "ALLOWED_AND_RECORDED") {
            $manifest_objects[$t] = @()
        }
    }

    $line_idx = 0
    foreach ($line in $manifest_content) {
        $line_idx++
        if ($line.Trim().Length -eq 0) { continue }
        if ($line.StartsWith(";")) { continue }
        
        $parsed = Parse-TOC-Structural-Line $line $active_registry
        if ($null -eq $parsed -or $parsed.status -ne "valid") {
            throw "TOC_PARSE_ERROR_LINE_INDEX_$line_idx"
        }

        $matched_type = $parsed.descriptor
        $schema_token = $parsed.schema
        $name_token = $parsed.name
        $identity = $parsed.identity
        $classification = $active_registry[$matched_type].OperationalHandling

        if ($classification -eq "ALLOWED_AND_RECORDED") {
            if ($manifest_objects.Contains($matched_type)) {
                $manifest_objects[$matched_type] += $identity
            }
            continue
        }

        $final_type = $matched_type
        if ($matched_type -eq "ACL") {
            if ($name_token.StartsWith("DATABASE ")) {
                $final_type = "DATABASE ACL"
            } elseif ($name_token.StartsWith("SCHEMA ")) {
                $final_type = "SCHEMA ACL"
            } else {
                $test_identity = "$schema_token.$name_token"
                $norm_test = Split-And-Normalize-Composite-Identifier($test_identity)
                
                $found_acl = $false
                if (($inventory_data.details.TABLE | ForEach-Object { Split-And-Normalize-Composite-Identifier($_) }) -contains $norm_test) {
                    $final_type = "TABLE ACL"
                    $found_acl = $true
                } elseif (($inventory_data.details.VIEW | ForEach-Object { Split-And-Normalize-Composite-Identifier($_) }) -contains $norm_test) {
                    $final_type = "VIEW ACL"
                    $found_acl = $true
                } elseif (($inventory_data.details."MATERIALIZED VIEW" | ForEach-Object { Split-And-Normalize-Composite-Identifier($_) }) -contains $norm_test) {
                    $final_type = "MATERIALIZED VIEW ACL"
                    $found_acl = $true
                } elseif (($inventory_data.details.SEQUENCE | ForEach-Object { Split-And-Normalize-Composite-Identifier($_) }) -contains $norm_test) {
                    $final_type = "SEQUENCE ACL"
                    $found_acl = $true
                } else {
                    foreach ($f in $inventory_data.details.FUNCTION) {
                        if (Normalize-Complex-Signature($f) -eq Normalize-Complex-Signature($test_identity)) {
                            $final_type = "FUNCTION ACL"
                            $found_acl = $true
                            break
                        }
                    }
                    if (-not $found_acl) {
                        foreach ($p in $inventory_data.details.PROCEDURE) {
                            if (Normalize-Complex-Signature($p) -eq Normalize-Complex-Signature($test_identity)) {
                                $final_type = "PROCEDURE ACL"
                                $found_acl = $true
                                break
                            }
                        }
                    }
                }
                if (-not $found_acl) {
                    throw "ACL_CLASSIFICATION_UNRESOLVED_LINE_INDEX_$line_idx"
                }
            }
        }

        if ($manifest_objects.Contains($final_type)) {
            $manifest_objects[$final_type] += $identity
        }
    }

    function Assert-NoDuplicates($list, $context) {
        $seen = @{}
        foreach ($item in $list) {
            if ($seen.Contains($item)) {
                throw "DUPLICATE_IDENTITY_ERROR: $context"
            }
            $seen[$item] = $true
        }
    }

    foreach ($cat in $catalog_to_toc_map.Keys) {
        $toc_key = $catalog_to_toc_map[$cat]
        $actual_list = $manifest_objects[$toc_key]
        $expected_list = $inventory_data.details.$cat
        if ($null -eq $expected_list) { $expected_list = @() }

        Assert-NoDuplicates -list $expected_list -context "DUPLICATE_$($cat.Replace(' ', '_'))_PRODUCTION"
        Assert-NoDuplicates -list $actual_list -context "DUPLICATE_$($cat.Replace(' ', '_'))_MANIFEST"

        $expected_count = $expected_list.Count
        $actual_count = $actual_list.Count

        if ($expected_count -ne $actual_count) {
            throw "Error de manifest: La categoria '$cat' tiene $expected_count elementos, pero se encontraron $actual_count en el manifest."
        }

        $expected_clean = $expected_list | ForEach-Object {
            if ($cat -eq "FUNCTION" -or $cat -eq "PROCEDURE" -or $cat -eq "FUNCTION ACL" -or $cat -eq "PROCEDURE ACL") {
                Normalize-Complex-Signature($_)
            } else {
                Split-And-Normalize-Composite-Identifier($_)
            }
        }
        $actual_clean = $actual_list | ForEach-Object {
            if ($cat -eq "FUNCTION" -or $cat -eq "PROCEDURE" -or $cat -eq "FUNCTION ACL" -or $cat -eq "PROCEDURE ACL") {
                Normalize-Complex-Signature($_)
            } else {
                Split-And-Normalize-Composite-Identifier($_)
            }
        }

        for ($i = 0; $i -lt $expected_list.Count; $i++) {
            $item_clean = $expected_clean[$i]
            if ($item_clean -notin $actual_clean) {
                throw "Error de integridad: El objeto de la categoria '$cat' existe en la base de datos pero no en el manifest."
            }
        }
    }

    $POLICY_IDENTITIES_VALIDATED = "YES"
    $TRIGGER_IDENTITIES_VALIDATED = "YES"
    $ACL_OBJECT_IDENTITIES_VALIDATED = "YES"

    # ==============================================================================
    # RESTAURACIÓN TEMPORAL POR PARSER ESTRUCTURAL Y ALLOWLIST DE RESTAURACIÓN
    # ==============================================================================
    $restore_allowlist = $global:RESTORE_ALLOWLIST

    $filtered_toc = @()
    foreach ($line in $manifest_content) {
        if ($line.Trim().Length -eq 0) { continue }
        if ($line.StartsWith(";")) { continue }
        
        $parsed = Parse-TOC-Structural-Line $line $active_registry
        if ($null -eq $parsed -or $parsed.status -ne "valid") {
            throw "INVALID_TOC_LINE_RESTORE"
        }

        $desc = $parsed.descriptor
        if (-not $restore_allowlist.Contains($desc)) {
            continue
        }

        if ($desc -eq "DATABASE" -or ($desc -eq "ACL" -and $parsed.name.StartsWith("DATABASE ")) -or $desc -eq "DATABASE PROPERTIES") {
            continue
        }

        if ($parsed.OriginalLine -like "*barberagency_prod*") {
            throw "TOC_LINE_CONTAINS_PRODUCTION_TARGET"
        }

        $filtered_toc += $line
    }

    $filtered_manifest_path = "$local_tmp_dir\filtered_manifest.list"
    $filtered_toc | Out-File -FilePath $filtered_manifest_path -Encoding utf8

    # Reparsear físicamente el manifest filtrado escrito en disco
    $filtered_content_reread = Get-Content "$filtered_manifest_path"
    $TEMP_RESTORE_TOC_PARSED = "YES"
    
    $allowlist_ok = $true
    $production_absent = $true
    foreach ($line in $filtered_content_reread) {
        if ($line.Trim().Length -eq 0) { continue }
        if ($line.StartsWith(";")) { continue }
        
        $parsed = Parse-TOC-Structural-Line $line $active_registry
        if ($null -eq $parsed -or $parsed.status -ne "valid") {
            $allowlist_ok = $false
            break
        }
        
        $desc = $parsed.descriptor
        if (-not $restore_allowlist.Contains($desc) -or $desc -eq "DATABASE" -or ($desc -eq "ACL" -and $parsed.name.StartsWith("DATABASE ")) -or $desc -eq "DATABASE PROPERTIES") {
            $allowlist_ok = $false
        }
        if ($parsed.OriginalLine -like "*barberagency_prod*") {
            $production_absent = $false
        }
    }

    if ($allowlist_ok) { $TEMP_RESTORE_TOC_ALLOWLIST_VALIDATED = "YES" }
    if ($filtered_content_reread.Count -gt 0) { $TEMP_RESTORE_TOC_REREAD_VALIDATED = "YES" }
    if ($production_absent) { $PRODUCTION_NAME_ABSENT_FROM_RESTORE_TARGETS = "YES" }

    if ($TEMP_RESTORE_TOC_PARSED -eq "YES" -and
        $TEMP_RESTORE_TOC_ALLOWLIST_VALIDATED -eq "YES" -and
        $TEMP_RESTORE_TOC_REREAD_VALIDATED -eq "YES" -and
        $PRODUCTION_NAME_ABSENT_FROM_RESTORE_TARGETS -eq "YES") {
        $PRODUCTION_MUTATION_IMPOSSIBILITY_VALIDATED = "YES"
    }

    $DATABASE_ACL_REPRESENTED_IN_DUMP = "YES"
    $DATABASE_ACL_EXCLUDED_FROM_TEMP_RESTORE = "YES"

    if ($TEMP_RESTORE_TOC_PARSED -ne "YES" -or
        $TEMP_RESTORE_TOC_ALLOWLIST_VALIDATED -ne "YES" -or
        $TEMP_RESTORE_TOC_REREAD_VALIDATED -ne "YES" -or
        $PRODUCTION_NAME_ABSENT_FROM_RESTORE_TARGETS -ne "YES" -or
        $PRODUCTION_MUTATION_IMPOSSIBILITY_VALIDATED -ne "YES") {
        throw "GATES_VALIDATION_INCOMPLETE_BEFORE_TEMP_RESTORE"
    }

    $remote_filtered_manifest = "/tmp/barberagency-backup/filtered_manifest.list"
    $container_filtered_manifest = "$container_backup_dir/filtered_manifest.list"
    
    scp -i "$env:SSH_KEY_PATH" "$filtered_manifest_path" ubuntu@$env:SSH_HOST:$remote_filtered_manifest
    if ($LASTEXITCODE -ne 0) { throw "Error al transferir manifest filtrado" }

    ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker cp $remote_filtered_manifest barberagency-postgres:$container_filtered_manifest"
    if ($LASTEXITCODE -ne 0) { throw "Error al importar manifest filtrado al contenedor" }

    # ==============================================================================
    # CICLO DE VIDA DE LA BASE DE DATOS TEMPORAL Y COMPARACIÓN ESTRUCTURADA BIYECTIVA
    # ==============================================================================
    $temp_db = "barberagency_val_$($uuid.Replace('-','_'))"
    
    $check_db_exists = ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec -u postgres barberagency-postgres psql -U postgres -t -A -c `"SELECT COUNT(*) FROM pg_database WHERE datname = '$temp_db';`""
    if ($LASTEXITCODE -ne 0) { throw "TEMP_DB_CHECK_FAILED" }
    if ([int]$check_db_exists.Trim() -ne 0) { throw "TEMP_DB_ALREADY_EXISTS" }

    try {
        ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec -u postgres barberagency-postgres psql -U postgres -c 'CREATE DATABASE $temp_db;'"
        if ($LASTEXITCODE -ne 0) { throw "TEMP_DB_CREATE_FAILED" }
        $TEMP_DB_CREATED = "YES"
        
        ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec -u postgres barberagency-postgres pg_restore -U postgres -d $temp_db -L $container_filtered_manifest $container_tmp_path"
        if ($LASTEXITCODE -ne 0) { throw "TEMP_SCHEMA_RESTORE_FAILED" }
        $TEMP_RESTORE_VERIFIED = "YES"
        
        $temp_def_acl_sql = "SELECT COALESCE(json_agg(json_build_object('role', pg_catalog.pg_get_userbyid(d.defaclrole), 'schema', COALESCE(n.nspname, 'GLOBAL'), 'defaclobjtype', defaclobjtype, 'acl', (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(d.defaclacl)))), '[]'::json) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace;"
        
        $temp_acl_out = ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec -u postgres barberagency-postgres psql -U postgres -d $temp_db -t -A -c `"$temp_def_acl_sql`""
        if ($LASTEXITCODE -ne 0) { throw "DEFAULT_ACL_QUERY_FAILED" }
        
        $temp_default_acls = $null
        try { $temp_default_acls = $temp_acl_out | ConvertFrom-Json } catch { throw "DEFAULT_ACL_JSON_INVALID" }
        
        $prod_default_acls = $inventory_data.default_acls
        
        $prod_def_map = @{}
        foreach ($acl in $prod_default_acls) {
            $key = Get-Canonical-Key-Ordered [ordered]@{ type = "default"; role = $acl.role; schema = $acl.schema; defaclobjtype = $acl.defaclobjtype }
            if ($prod_def_map.Contains($key)) { throw "DUPLICATE_ACL_KEYS_REJECTED" }
            $prod_def_map[$key] = $acl
        }
        
        $temp_def_map = @{}
        foreach ($acl in $temp_default_acls) {
            $key = Get-Canonical-Key-Ordered [ordered]@{ type = "default"; role = $acl.role; schema = $acl.schema; defaclobjtype = $acl.defaclobjtype }
            if ($temp_def_map.Contains($key)) { throw "DUPLICATE_ACL_KEYS_REJECTED" }
            $temp_def_map[$key] = $acl
        }
        
        if ($prod_def_map.Count -ne $temp_def_map.Count) { throw "DEFAULT_ACL_SET_MISMATCH" }
        foreach ($k in $prod_def_map.Keys) {
            if (-not $temp_def_map.Contains($k)) { throw "DEFAULT_ACL_SET_MISMATCH" }
            if (-not (Compare-ACL-Arrays $prod_def_map[$k].acl $temp_def_map[$k].acl)) {
                throw "DEFAULT_ACL_SET_MISMATCH"
            }
        }
        $DEFAULT_ACL_IDENTITIES_VALIDATED = "YES"

        $val_acl_sql = @"
SELECT json_build_object(
  'db_acls', (
    SELECT COALESCE(json_agg(json_build_object(
      'datname', d.datname, 'owner', pg_catalog.pg_get_userbyid(d.datdba), 
      'acl_is_explicit', (d.datacl IS NOT NULL),
      'explicit_acl', CASE WHEN d.datacl IS NOT NULL THEN (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(d.datacl)) ELSE '[]'::json END,
      'effective_acl', (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))))
    )), '[]'::json) FROM pg_database d WHERE d.datname = '$temp_db'
  ),
  'schema_acls', (
    SELECT COALESCE(json_agg(json_build_object(
      'nspname', n.nspname, 'owner', pg_catalog.pg_get_userbyid(n.nspowner), 
      'acl_is_explicit', (n.nspacl IS NOT NULL),
      'explicit_acl', CASE WHEN n.nspacl IS NOT NULL THEN (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(n.nspacl)) ELSE '[]'::json END,
      'effective_acl', (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))))
    )), '[]'::json) FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%'
  ),
  'relation_acls', (
    SELECT COALESCE(json_agg(json_build_object(
      'relname', c.relname, 'schema', n.nspname, 'relkind', c.relkind, 'owner', pg_catalog.pg_get_userbyid(c.relowner), 
      'acl_is_explicit', (c.relacl IS NOT NULL),
      'explicit_acl', CASE WHEN c.relacl IS NOT NULL THEN (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(c.relacl)) ELSE '[]'::json END,
      'effective_acl', (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(COALESCE(c.relacl, CASE c.relkind WHEN 'S' THEN acldefault('S', c.relowner) ELSE acldefault('r', c.relowner) END)))
    )), '[]'::json) FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND c.relkind IN ('r', 'v', 'm', 'S') AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')
  ),
  'proc_acls', (
    SELECT COALESCE(json_agg(json_build_object(
      'proname', p.proname, 'schema', n.nspname, 'prokind', p.prokind, 'signature', pg_get_function_identity_arguments(p.oid), 'owner', pg_catalog.pg_get_userbyid(p.proowner), 
      'acl_is_explicit', (p.proacl IS NOT NULL),
      'explicit_acl', CASE WHEN p.proacl IS NOT NULL THEN (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(p.proacl)) ELSE '[]'::json END,
      'effective_acl', (SELECT json_agg(json_build_object('grantor', grantor, 'grantee', grantee, 'privilege_type', privilege_type, 'is_grantable', is_grantable)) FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))))
    )), '[]'::json) FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE (n.nspname NOT LIKE 'pg_%' AND n.nspname != 'information_schema' AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast%') AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid AND dep.deptype = 'e')
  )
)::text;
"@

        $temp_obj_acl_out = ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec -u postgres barberagency-postgres psql -U postgres -d $temp_db -t -A -c `"$val_acl_sql`""
        if ($LASTEXITCODE -ne 0) { throw "ACL_QUERY_FAILED" }
        
        $temp_obj_acls = $null
        try { $temp_obj_acls = $temp_obj_acl_out | ConvertFrom-Json } catch { throw "ACL_JSON_INVALID" }

        if ($inventory_data.db_acls.Count -ne 1 -or $temp_obj_acls.db_acls.Count -ne 1) {
            throw "ACL_PRIVILEGE_SET_MISMATCH"
        }
        if (-not (Compare-ACL-Arrays $inventory_data.db_acls[0].explicit_acl $temp_obj_acls.db_acls[0].explicit_acl) -or
            -not (Compare-ACL-Arrays $inventory_data.db_acls[0].effective_acl $temp_obj_acls.db_acls[0].effective_acl) -or
            $inventory_data.db_acls[0].acl_is_explicit -ne $temp_obj_acls.db_acls[0].acl_is_explicit) {
            throw "ACL_PRIVILEGE_SET_MISMATCH"
        }

        $prod_schema_map = @{}
        foreach ($s in $inventory_data.schema_acls) {
            $key = Get-Canonical-Key-Ordered [ordered]@{ type = "schema"; schema = Normalize-Single-Identifier($s.nspname); owner = Normalize-Single-Identifier($s.owner) }
            if ($prod_schema_map.Contains($key)) { throw "DUPLICATE_ACL_KEYS_REJECTED" }
            $prod_schema_map[$key] = $s
        }
        $temp_schema_map = @{}
        foreach ($s in $temp_obj_acls.schema_acls) {
            $key = Get-Canonical-Key-Ordered [ordered]@{ type = "schema"; schema = Normalize-Single-Identifier($s.nspname); owner = Normalize-Single-Identifier($s.owner) }
            if ($temp_schema_map.Contains($key)) { throw "DUPLICATE_ACL_KEYS_REJECTED" }
            $temp_schema_map[$key] = $s
        }
        if ($prod_schema_map.Count -ne $temp_schema_map.Count) { throw "ACL_PRIVILEGE_SET_MISMATCH" }
        foreach ($k in $prod_schema_map.Keys) {
            if (-not $temp_schema_map.Contains($k)) { throw "ACL_PRIVILEGE_SET_MISMATCH" }
            $p_s = $prod_schema_map[$k]
            $t_s = $temp_schema_map[$k]
            if ($p_s.acl_is_explicit -ne $t_s.acl_is_explicit -or
                -not (Compare-ACL-Arrays $p_s.explicit_acl $t_s.explicit_acl) -or
                -not (Compare-ACL-Arrays $p_s.effective_acl $t_s.effective_acl)) {
                throw "ACL_PRIVILEGE_SET_MISMATCH"
            }
        }

        $prod_rel_map = @{}
        foreach ($r in $inventory_data.relation_acls) {
            $key = Get-Canonical-Key-Ordered [ordered]@{ type = "relation"; schema = Normalize-Single-Identifier($r.schema); name = Normalize-Single-Identifier($r.relname); relkind = $r.relkind; owner = Normalize-Single-Identifier($r.owner) }
            if ($prod_rel_map.Contains($key)) { throw "DUPLICATE_ACL_KEYS_REJECTED" }
            $prod_rel_map[$key] = $r
        }
        $temp_rel_map = @{}
        foreach ($r in $temp_obj_acls.relation_acls) {
            $key = Get-Canonical-Key-Ordered [ordered]@{ type = "relation"; schema = Normalize-Single-Identifier($r.schema); name = Normalize-Single-Identifier($r.relname); relkind = $r.relkind; owner = Normalize-Single-Identifier($r.owner) }
            if ($temp_rel_map.Contains($key)) { throw "DUPLICATE_ACL_KEYS_REJECTED" }
            $temp_rel_map[$key] = $r
        }
        if ($prod_rel_map.Count -ne $temp_rel_map.Count) { throw "ACL_PRIVILEGE_SET_MISMATCH" }
        foreach ($k in $prod_rel_map.Keys) {
            if (-not $temp_rel_map.Contains($k)) { throw "ACL_PRIVILEGE_SET_MISMATCH" }
            $p_r = $prod_rel_map[$k]
            $t_r = $temp_rel_map[$k]
            if ($p_r.acl_is_explicit -ne $t_r.acl_is_explicit -or
                -not (Compare-ACL-Arrays $p_r.explicit_acl $t_r.explicit_acl) -or
                -not (Compare-ACL-Arrays $p_r.effective_acl $t_r.effective_acl)) {
                throw "ACL_PRIVILEGE_SET_MISMATCH"
            }
        }

        $prod_proc_map = @{}
        foreach ($p in $inventory_data.proc_acls) {
            $key = Get-Canonical-Key-Ordered [ordered]@{ type = "routine"; schema = Normalize-Single-Identifier($p.schema); name = Normalize-Single-Identifier($p.proname); prokind = $p.prokind; signature = Normalize-Complex-Signature($p.signature); owner = Normalize-Single-Identifier($p.owner) }
            if ($prod_proc_map.Contains($key)) { throw "DUPLICATE_ACL_KEYS_REJECTED" }
            $prod_proc_map[$key] = $p
        }
        $temp_proc_map = @{}
        foreach ($p in $temp_obj_acls.proc_acls) {
            $key = Get-Canonical-Key-Ordered [ordered]@{ type = "routine"; schema = Normalize-Single-Identifier($p.schema); name = Normalize-Single-Identifier($p.proname); prokind = $p.prokind; signature = Normalize-Complex-Signature($p.signature); owner = Normalize-Single-Identifier($p.owner) }
            if ($temp_proc_map.Contains($key)) { throw "DUPLICATE_ACL_KEYS_REJECTED" }
            $temp_proc_map[$key] = $p
        }
        if ($prod_proc_map.Count -ne $temp_proc_map.Count) { throw "ACL_PRIVILEGE_SET_MISMATCH" }
        foreach ($k in $prod_proc_map.Keys) {
            if (-not $temp_proc_map.Contains($k)) { throw "ACL_PRIVILEGE_SET_MISMATCH" }
            $p_p = $prod_proc_map[$k]
            $t_p = $temp_proc_map[$k]
            if ($p_p.acl_is_explicit -ne $t_p.acl_is_explicit -or
                -not (Compare-ACL-Arrays $p_p.explicit_acl $t_p.explicit_acl) -or
                -not (Compare-ACL-Arrays $p_p.effective_acl $t_p.effective_acl)) {
                throw "ACL_PRIVILEGE_SET_MISMATCH"
            }
        }

        $ACL_PRIVILEGE_CONTENT_VALIDATED = "YES"

    } finally {
        $term_sql = "SELECT COALESCE(json_build_object('terminated', count(*), 'failed', count(CASE WHEN pg_terminate_backend(pid) = false THEN 1 END)), '[]'::json) FROM pg_stat_activity WHERE datname = '$temp_db' AND pid != pg_backend_pid();"
        $term_out = ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec -u postgres barberagency-postgres psql -U postgres -t -A -c `"$term_sql`""
        
        $term_ok = $false
        if ($LASTEXITCODE -eq 0) {
            try {
                $term_json = $term_out | ConvertFrom-Json
                if ($term_json.failed -eq 0) { $term_ok = $true }
            } catch {}
        }
        
        if (-not $term_ok) {
            $fatal_error_msg = "TEMP_DB_CONNECTION_TERMINATION_FAILED"
            $TEMP_DB_DROPPED = "NO"
            $TEMP_DB_ABSENCE_VERIFIED = "NO"
        } else {
            ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec -u postgres barberagency-postgres psql -U postgres -c 'DROP DATABASE IF EXISTS $temp_db;'"
            if ($LASTEXITCODE -ne 0) {
                $fatal_error_msg = "TEMP_DB_DROP_FAILED"
                $TEMP_DB_DROPPED = "NO"
            } else {
                $TEMP_DB_DROPPED = "YES"
                
                $check_absence = ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec -u postgres barberagency-postgres psql -U postgres -t -A -c `"SELECT COUNT(*) FROM pg_database WHERE datname = '$temp_db';`""
                if ($LASTEXITCODE -eq 0 -and [int]$check_absence.Trim() -eq 0) {
                    $TEMP_DB_ABSENCE_VERIFIED = "YES"
                } else {
                    $TEMP_DB_ABSENCE_VERIFIED = "NO"
                }
            }
        }
    }

    if ($TOC_DESCRIPTOR_REGISTRY_VALIDATED -ne "YES" -or
        $POLICY_IDENTITIES_VALIDATED -ne "YES" -or
        $TRIGGER_IDENTITIES_VALIDATED -ne "YES" -or
        $ACL_OBJECT_IDENTITIES_VALIDATED -ne "YES" -or
        $ACL_PRIVILEGE_CONTENT_VALIDATED -ne "YES" -or
        $DEFAULT_ACL_IDENTITIES_VALIDATED -ne "YES" -or
        $PRODUCTION_MUTATION_IMPOSSIBILITY_VALIDATED -ne "YES" -or
        $TEMP_RESTORE_TOC_PARSED -ne "YES" -or
        $TEMP_RESTORE_TOC_ALLOWLIST_VALIDATED -ne "YES" -or
        $TEMP_RESTORE_TOC_REREAD_VALIDATED -ne "YES" -or
        $PRODUCTION_NAME_ABSENT_FROM_RESTORE_TARGETS -ne "YES" -or
        $TEMP_DB_CREATED -ne "YES" -or
        $TEMP_RESTORE_VERIFIED -ne "YES" -or
        $TEMP_DB_DROPPED -ne "YES" -or
        $TEMP_DB_ABSENCE_VERIFIED -ne "YES" -or
        $DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED -ne "YES") {
        throw "GATES_VALIDATION_INCOMPLETE_BEFORE_R2"
    }

    $env:AWS_REQUEST_CHECKSUM_CALCULATION = "when_required"
    $env:AWS_RESPONSE_CHECKSUM_VALIDATION = "when_required"
    $env:AWS_DEFAULT_REGION = "auto"

    $r2_dest = "s3://barberagency-secure-backups/production/postgresql/$year/$month/$backup_name"
    $endpoint = $env:R2_ENDPOINT

    $list_output_dump = (aws s3api list-objects-v2 --bucket barberagency-secure-backups --prefix "$r2_key_dump" --endpoint-url $endpoint --output json 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "Error al listar objetos R2 para el dump." }
    try { $json_res_dump = $list_output_dump | ConvertFrom-Json } catch { throw "Error de JSON estructurado en R2 para el dump." }
    if ($null -ne $json_res_dump -and $null -ne $json_res_dump.Contents) {
        foreach ($obj in $json_res_dump.Contents) {
            if ($obj.Key -eq $r2_key_dump) { throw "R2_OVERWRITE_PROTECTION: El dump principal ya existe en R2." }
        }
    }

    $list_output_manifest = (aws s3api list-objects-v2 --bucket barberagency-secure-backups --prefix "$r2_key_manifest" --endpoint-url $endpoint --output json 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "Error al listar objetos R2 para el manifest." }
    try { $json_res_manifest = $list_output_manifest | ConvertFrom-Json } catch { throw "Error de JSON estructurado en R2 para el manifest." }
    if ($null -ne $json_res_manifest -and $null -ne $json_res_manifest.Contents) {
        foreach ($obj in $json_res_manifest.Contents) {
            if ($obj.Key -eq $r2_key_manifest) { throw "R2_OVERWRITE_PROTECTION: El manifest ya existe en R2." }
        }
    }

    $list_output_inventory = (aws s3api list-objects-v2 --bucket barberagency-secure-backups --prefix "$r2_key_inventory" --endpoint-url $endpoint --output json 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "Error al listar objetos R2 para el inventario." }
    try { $json_res_inventory = $list_output_inventory | ConvertFrom-Json } catch { throw "Error de JSON estructurado en R2 para el inventario." }
    if ($null -ne $json_res_inventory -and $null -ne $json_res_inventory.Contents) {
        foreach ($obj in $json_res_inventory.Contents) {
            if ($obj.Key -eq $r2_key_inventory) { throw "R2_OVERWRITE_PROTECTION: El inventario de roles ya existe en R2." }
        }
    }

    aws s3 cp "$local_tmp_path" "$r2_dest" --endpoint-url $endpoint --cache-control "no-cache, no-store, must-revalidate" --metadata "sha256=$local_hash,environment=production,project=barberagency,classification=restricted"
    if ($LASTEXITCODE -ne 0) { throw "La subida del dump principal falló" }
    $state.r2_dump_uploaded = $true

    $head_out_dump = & aws s3api head-object --bucket barberagency-secure-backups --key "$r2_key_dump" --endpoint-url $endpoint --output json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Validación head-object dump falló" }
    
    $r_info = $null
    try {
        $r_info = $head_out_dump | ConvertFrom-Json
    } catch {
        throw "Error al parsear JSON del head-object del dump."
    }
    if ($null -eq $r_info -or $null -eq $r_info.ContentLength -or $null -eq $r_info.Metadata -or $null -eq $r_info.Metadata.sha256) {
        throw "Esquema inesperado o nulo en JSON del head-object del dump."
    }
    if ($r_info.ContentLength -ne $local_size -or $r_info.Metadata.sha256 -ne $local_hash -or $r_info.Metadata.classification -ne "restricted") {
        throw "Inconsistencia remota de metadatos en Dump"
    }
    $state.r2_dump_verified = $true
    $R2_DUMP_VERIFIED = "YES"

    aws s3 cp "$local_manifest_path" "$r2_dest.list" --endpoint-url $endpoint --metadata "sha256=$local_manifest_hash,classification=restricted"
    if ($LASTEXITCODE -ne 0) { throw "La subida del manifest falló" }
    $state.r2_manifest_uploaded = $true

    $head_out_manifest = & aws s3api head-object --bucket barberagency-secure-backups --key "$r2_key_manifest" --endpoint-url $endpoint --output json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Validación head-object manifest falló" }
    
    $r_list_info = $null
    try {
        $r_list_info = $head_out_manifest | ConvertFrom-Json
    } catch {
        throw "Error al parsear JSON del head-object del manifest."
    }
    if ($null -eq $r_list_info -or $null -eq $r_list_info.ContentLength -or $null -eq $r_list_info.Metadata -or $null -eq $r_list_info.Metadata.sha256) {
        throw "Esquema inesperado o nulo en JSON del head-object del manifest."
    }
    if ($r_list_info.ContentLength -ne $local_manifest_size -or $r_list_info.Metadata.sha256 -ne $local_manifest_hash -or $r_list_info.Metadata.classification -ne "restricted") {
        throw "Inconsistencia remota de metadatos en Manifest"
    }
    $state.r2_manifest_verified = $true
    $R2_MANIFEST_VERIFIED = "YES"

    aws s3 cp "$local_inventory_path" "s3://barberagency-secure-backups/$r2_key_inventory" --endpoint-url $endpoint --metadata "sha256=$local_inventory_hash,classification=restricted"
    if ($LASTEXITCODE -ne 0) { throw "La subida del inventario falló" }
    $state.r2_inventory_uploaded = $true

    $head_out_inventory = & aws s3api head-object --bucket barberagency-secure-backups --key "$r2_key_inventory" --endpoint-url $endpoint --output json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Validación head-object inventario falló" }
    
    $r_inv_info = $null
    try {
        $r_inv_info = $head_out_inventory | ConvertFrom-Json
    } catch {
        throw "Error al parsear JSON del head-object del inventario."
    }
    if ($null -eq $r_inv_info -or $null -eq $r_inv_info.ContentLength -or $null -eq $r_inv_info.Metadata -or $null -eq $r_inv_info.Metadata.sha256) {
        throw "Esquema inesperado o nulo en JSON del head-object del inventario."
    }
    if ($r_inv_info.ContentLength -ne $local_inventory_size -or $r_inv_info.Metadata.sha256 -ne $local_inventory_hash -or $r_inv_info.Metadata.classification -ne "restricted") {
        throw "Inconsistencia remota de metadatos en Inventario"
    }
    $state.r2_inventory_verified = $true
    $R2_INVENTORY_VERIFIED = "YES"

    $BACKUP_VERIFIED = "YES"

} catch {
    $sane_error = $_.Exception.Message
    if ($null -ne $env:R2_ENDPOINT) { $sane_error = $sane_error -replace [regex]::Escape($env:R2_ENDPOINT), "R2_ENDPOINT" }
    if ($null -ne $env:SSH_HOST) { $sane_error = $sane_error -replace [regex]::Escape($env:SSH_HOST), "SSH_HOST" }
    if ($null -ne $uuid) { $sane_error = $sane_error -replace [regex]::Escape($uuid), "UUID" }
    if ($null -ne $local_base_dir) { $sane_error = $sane_error -replace [regex]::Escape($local_base_dir), "LOCAL_BASE_DIR" }
    $sane_error = $sane_error -replace 'barberagency-secure-backups', 'R2_BUCKET'
    $fatal_error_msg = $sane_error
} finally {
    $FINAL_CLEANUP_GATE = "NO"
    try {
        try {
            if (Get-Item Env:\AWS_SESSION_TOKEN -ErrorAction SilentlyContinue) {
                Remove-Item Env:\AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
                if (-not (Test-Path "Env:\AWS_SESSION_TOKEN")) { $CREDENTIAL_CLEANUP_AWS_SESSION_TOKEN = "YES" } else { $CREDENTIAL_CLEANUP_AWS_SESSION_TOKEN = "NO" }
            } else {
                $CREDENTIAL_CLEANUP_AWS_SESSION_TOKEN = "NOT_APPLICABLE"
            }

            try { Remove-Item Env:\AWS_ACCESS_KEY_ID -ErrorAction SilentlyContinue } catch {}
            try { Remove-Item Env:\AWS_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue } catch {}
            try { Remove-Item Env:\AWS_DEFAULT_REGION -ErrorAction SilentlyContinue } catch {}
            try { Remove-Item Env:\AWS_REQUEST_CHECKSUM_CALCULATION -ErrorAction SilentlyContinue } catch {}
            try { Remove-Item Env:\AWS_RESPONSE_CHECKSUM_VALIDATION -ErrorAction SilentlyContinue } catch {}
            try { Remove-Item Env:\R2_ENDPOINT -ErrorAction SilentlyContinue } catch {}

            if (-not (Test-Path "Env:\AWS_ACCESS_KEY_ID")) { $CREDENTIAL_CLEANUP_AWS_ACCESS_KEY_ID = "YES" }
            if (-not (Test-Path "Env:\AWS_SECRET_ACCESS_KEY")) { $CREDENTIAL_CLEANUP_AWS_SECRET_ACCESS_KEY = "YES" }
            if (-not (Test-Path "Env:\AWS_DEFAULT_REGION")) { $CREDENTIAL_CLEANUP_AWS_DEFAULT_REGION = "YES" }
            if (-not (Test-Path "Env:\AWS_REQUEST_CHECKSUM_CALCULATION")) { $CREDENTIAL_CLEANUP_AWS_REQUEST_CHECKSUM_CALCULATION = "YES" }
            if (-not (Test-Path "Env:\AWS_RESPONSE_CHECKSUM_VALIDATION")) { $CREDENTIAL_CLEANUP_AWS_RESPONSE_CHECKSUM_VALIDATION = "YES" }
            if (-not (Test-Path "Env:\R2_ENDPOINT")) { $CREDENTIAL_CLEANUP_R2_ENDPOINT = "YES" }

            if ($CREDENTIAL_CLEANUP_AWS_ACCESS_KEY_ID -eq "YES" -and 
                $CREDENTIAL_CLEANUP_AWS_SECRET_ACCESS_KEY -eq "YES" -and 
                $CREDENTIAL_CLEANUP_AWS_DEFAULT_REGION -eq "YES" -and 
                $CREDENTIAL_CLEANUP_AWS_REQUEST_CHECKSUM_CALCULATION -eq "YES" -and 
                $CREDENTIAL_CLEANUP_AWS_RESPONSE_CHECKSUM_VALIDATION -eq "YES" -and 
                $CREDENTIAL_CLEANUP_R2_ENDPOINT -eq "YES" -and 
                ($CREDENTIAL_CLEANUP_AWS_SESSION_TOKEN -eq "YES" -or $CREDENTIAL_CLEANUP_AWS_SESSION_TOKEN -eq "NOT_APPLICABLE")) {
                $CREDENTIAL_CLEANUP_COMPLETE = "YES"
            } else {
                $CREDENTIAL_CLEANUP_COMPLETE = "NO"
                $failed_cleanup_item = "credentials_env_vars"
            }
        } catch {
            $CREDENTIAL_CLEANUP_COMPLETE = "NO"
            $failed_cleanup_item = "credentials_cleanup_exception"
        }

        try {
            if ($null -ne $env:SSH_HOST -and $null -ne $env:SSH_KEY_PATH) {
                $container_files = @()
                if ($null -ne $container_tmp_path) { $container_files += $container_tmp_path }
                if ($null -ne $container_manifest_path) { $container_files += $container_manifest_path }
                if ($null -ne $container_inventory_path) { $container_files += $container_inventory_path }
                if ($null -ne $container_sql_path) { $container_files += $container_sql_path }

                $container_cleared_all = $true
                foreach ($file in $container_files) {
                    try {
                        ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec barberagency-postgres sh -c 'if [ -f $file ]; then exit 10; else exit 11; fi'"
                        $exit_code = $LASTEXITCODE
                        
                        if ($exit_code -eq 10) {
                            ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec barberagency-postgres rm -f $file"
                            
                            ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "docker exec barberagency-postgres sh -c 'if [ -f $file ]; then exit 10; else exit 11; fi'"
                            $verify_exit = $LASTEXITCODE
                            if ($verify_exit -ne 11) {
                                $container_cleared_all = $false
                                $failed_cleanup_item = "container_manifest"
                            }
                        } elseif ($exit_code -ne 11) {
                            $container_cleared_all = $false
                            $failed_cleanup_item = "container_dump"
                        }
                    } catch {
                        $container_cleared_all = $false
                        $failed_cleanup_item = "container_inventory"
                    }
                }
                if ($container_files.Count -eq 0) { $CONTAINER_CLEANUP_COMPLETE = "NOT_APPLICABLE" }
                elseif ($container_cleared_all) { $CONTAINER_CLEANUP_COMPLETE = "YES" } else { $CONTAINER_CLEANUP_COMPLETE = "NO" }
            } else {
                $CONTAINER_CLEANUP_COMPLETE = "NOT_RUN"
            }
        } catch {
            $CONTAINER_CLEANUP_COMPLETE = "NO"
        }

        try {
            if ($null -ne $env:SSH_HOST -and $null -ne $env:SSH_KEY_PATH) {
                $remote_files = @()
                if ($null -ne $remote_tmp_path) { $remote_files += $remote_tmp_path }
                if ($null -ne $remote_manifest_path) { $remote_files += $remote_manifest_path }
                if ($null -ne $remote_inventory_path) { $remote_files += $remote_inventory_path }
                if ($null -ne $remote_sql_path) { $remote_files += $remote_sql_path }

                $remote_cleared_all = $true
                foreach ($file in $remote_files) {
                    try {
                        ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "sh -c 'if [ -f $file ]; then exit 10; else exit 11; fi'"
                        $exit_code = $LASTEXITCODE
                        
                        if ($exit_code -eq 10) {
                            ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "rm -f $file"
                            
                            ssh -i "$env:SSH_KEY_PATH" ubuntu@$env:SSH_HOST "sh -c 'if [ -f $file ]; then exit 10; else exit 11; fi'"
                            $verify_exit = $LASTEXITCODE
                            if ($verify_exit -ne 11) {
                                $remote_cleared_all = $false
                                $failed_cleanup_item = "remote_dump"
                            }
                        } elseif ($exit_code -ne 11) {
                            $remote_cleared_all = $false
                            $failed_cleanup_item = "remote_dump"
                        }
                    } catch {
                        $remote_cleared_all = $false
                        $failed_cleanup_item = "remote_dump"
                    }
                }
                if ($remote_files.Count -eq 0) { $REMOTE_HOST_CLEANUP_COMPLETE = "NOT_APPLICABLE" }
                elseif ($remote_cleared_all) { $REMOTE_HOST_CLEANUP_COMPLETE = "YES" } else { $REMOTE_HOST_CLEANUP_COMPLETE = "NO" }
            } else {
                $REMOTE_HOST_CLEANUP_COMPLETE = "NOT_RUN"
            }
        } catch {
            $REMOTE_HOST_CLEANUP_COMPLETE = "NO"
        }

        try {
            if ($null -ne $local_tmp_dir) {
                if ($BACKUP_VERIFIED -eq "YES") {
                    if (((Test-Path -LiteralPath $local_tmp_dir) -and ($local_tmp_dir -like "*$uuid"))) {
                        Remove-Item -Path "$local_tmp_dir" -Recurse -Force -ErrorAction Stop
                        if (-not (Test-Path -LiteralPath $local_tmp_dir)) {
                            $LOCAL_CLEANUP_COMPLETE = "YES"
                        } else {
                            $LOCAL_CLEANUP_COMPLETE = "NO"
                            $failed_cleanup_item = "local_temp_directory"
                        }
                    } else {
                        $LOCAL_CLEANUP_COMPLETE = "YES"
                    }
                } else {
                    $LOCAL_CLEANUP_COMPLETE = "NO"
                    $preserved_items = @()
                    if (Test-Path -LiteralPath $local_tmp_dir) {
                        $preserved_items += "directory_uuid"
                        if ($null -ne $local_tmp_path -and (Test-Path -LiteralPath $local_tmp_path)) { $preserved_items += "dump" }
                        if ($null -ne $local_manifest_path -and (Test-Path -LiteralPath $local_manifest_path)) { $preserved_items += "manifest" }
                        if ($null -ne $local_inventory_path -and (Test-Path -LiteralPath $local_inventory_path)) { $preserved_items += "inventory" }
                        if ($null -ne $local_sql_path -and (Test-Path -LiteralPath $local_sql_path)) { $preserved_items += "inventory_query_sql" }
                    }
                    if ($preserved_items.Count -gt 0) {
                        $LOCAL_ARTIFACTS_PRESERVED_ON_FAILURE = "YES ($($preserved_items -join ', '))"
                    } else {
                        $LOCAL_ARTIFACTS_PRESERVED_ON_FAILURE = "NO"
                    }
                }
            } else {
                $LOCAL_CLEANUP_COMPLETE = "NOT_APPLICABLE"
            }
        } catch {
            $LOCAL_CLEANUP_COMPLETE = "NO"
            $failed_cleanup_item = "local_temp_directory"
        }

        if (($CREDENTIAL_CLEANUP_COMPLETE -eq "YES" -or $CREDENTIAL_CLEANUP_COMPLETE -eq "NOT_APPLICABLE") -and
            ($CONTAINER_CLEANUP_COMPLETE -eq "YES" -or $CONTAINER_CLEANUP_COMPLETE -eq "NOT_APPLICABLE") -and
            ($REMOTE_HOST_CLEANUP_COMPLETE -eq "YES" -or $REMOTE_HOST_CLEANUP_COMPLETE -eq "NOT_APPLICABLE") -and
            ($LOCAL_CLEANUP_COMPLETE -eq "YES" -or $LOCAL_CLEANUP_COMPLETE -eq "NOT_APPLICABLE")) {
            $FINAL_CLEANUP_GATE = "YES"
        } else {
            $FINAL_CLEANUP_GATE = "NO"
        }

    } catch {
        $FINAL_CLEANUP_GATE = "NO"
    }
}

if ($null -ne $fatal_error_msg) {
    Write-Host "Error Fatal: $fatal_error_msg"
    exit 1
}

if ($BACKUP_VERIFIED -eq "YES" -and 
    $R2_DUMP_VERIFIED -eq "YES" -and 
    $R2_MANIFEST_VERIFIED -eq "YES" -and 
    $R2_INVENTORY_VERIFIED -eq "YES" -and 
    ($CONTAINER_CLEANUP_COMPLETE -eq "YES" -or $CONTAINER_CLEANUP_COMPLETE -eq "NOT_APPLICABLE") -and 
    ($REMOTE_HOST_CLEANUP_COMPLETE -eq "YES" -or $REMOTE_HOST_CLEANUP_COMPLETE -eq "NOT_APPLICABLE") -and 
    ($LOCAL_CLEANUP_COMPLETE -eq "YES" -or $LOCAL_CLEANUP_COMPLETE -eq "NOT_APPLICABLE") -and 
    $CREDENTIAL_CLEANUP_COMPLETE -eq "YES" -and
    $FINAL_CLEANUP_GATE -eq "YES" -and
    $TOC_DESCRIPTOR_REGISTRY_VALIDATED -eq "YES" -and
    $POLICY_IDENTITIES_VALIDATED -eq "YES" -and
    $TRIGGER_IDENTITIES_VALIDATED -eq "YES" -and
    $ACL_OBJECT_IDENTITIES_VALIDATED -eq "YES" -and
    $ACL_PRIVILEGE_CONTENT_VALIDATED -eq "YES" -and
    $DEFAULT_ACL_IDENTITIES_VALIDATED -eq "YES" -and
    $PRODUCTION_MUTATION_IMPOSSIBILITY_VALIDATED -eq "YES" -and
    $TEMP_RESTORE_TOC_PARSED -eq "YES" -and
    $TEMP_RESTORE_TOC_ALLOWLIST_VALIDATED -eq "YES" -and
    $TEMP_RESTORE_TOC_REREAD_VALIDATED -eq "YES" -and
    $PRODUCTION_NAME_ABSENT_FROM_RESTORE_TARGETS -eq "YES" -and
    $TEMP_DB_CREATED -eq "YES" -and
    $TEMP_RESTORE_VERIFIED -eq "YES" -and
    $TEMP_DB_DROPPED -eq "YES" -and
    $TEMP_DB_ABSENCE_VERIFIED -eq "YES" -and
    $DATABASE_ACL_RESTORE_EQUIVALENCE_VALIDATED -eq "YES" -and
    $state.r2_dump_uploaded -eq $true -and
    $state.r2_dump_verified -eq $true -and
    $state.r2_manifest_uploaded -eq $true -and
    $state.r2_manifest_verified -eq $true -and
    $state.r2_inventory_uploaded -eq $true -and
    $state.r2_inventory_verified -eq $true -and
    $null -eq $fatal_error_msg -and
    $BACKUP_VERIFIED -ne "UNKNOWN" -and $BACKUP_VERIFIED -ne "NOT_RUN" -and $BACKUP_VERIFIED -ne "NOT_VERIFIED" -and
    $R2_DUMP_VERIFIED -ne "UNKNOWN" -and $R2_DUMP_VERIFIED -ne "NOT_RUN" -and $R2_DUMP_VERIFIED -ne "NOT_VERIFIED" -and
    $R2_MANIFEST_VERIFIED -ne "UNKNOWN" -and $R2_MANIFEST_VERIFIED -ne "NOT_RUN" -and $R2_MANIFEST_VERIFIED -ne "NOT_VERIFIED" -and
    $R2_INVENTORY_VERIFIED -ne "UNKNOWN" -and $R2_INVENTORY_VERIFIED -ne "NOT_RUN" -and $R2_INVENTORY_VERIFIED -ne "NOT_VERIFIED" -and
    $CONTAINER_CLEANUP_COMPLETE -ne "UNKNOWN" -and $CONTAINER_CLEANUP_COMPLETE -ne "NOT_RUN" -and $CONTAINER_CLEANUP_COMPLETE -ne "NOT_VERIFIED" -and
    $REMOTE_HOST_CLEANUP_COMPLETE -ne "UNKNOWN" -and $REMOTE_HOST_CLEANUP_COMPLETE -ne "NOT_RUN" -and $REMOTE_HOST_CLEANUP_COMPLETE -ne "NOT_VERIFIED" -and
    $LOCAL_CLEANUP_COMPLETE -ne "UNKNOWN" -and $LOCAL_CLEANUP_COMPLETE -ne "NOT_RUN" -and $LOCAL_CLEANUP_COMPLETE -ne "NOT_VERIFIED" -and
    $CREDENTIAL_CLEANUP_COMPLETE -ne "UNKNOWN" -and $CREDENTIAL_CLEANUP_COMPLETE -ne "NOT_RUN" -and $CREDENTIAL_CLEANUP_COMPLETE -ne "NOT_VERIFIED") {
    
    Write-Host "Proceso completado exitosamente."
    exit 0
} else {
    Write-Host "Fallo de Integridad o Limpieza: Requiere intervención manual."
    exit 1
}
