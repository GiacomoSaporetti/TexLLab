var MODBUSTCP_MASTER_ADDRESSING_MODE_MODBUS = 0
var MODBUSTCP_MASTER_ADDRESSING_MODE_JBUS = 1
var MODBUSTCP_MASTER_DYNAMICSLAVEADDRESS_SUPPORTED = true

// Modbus master configuration must be passed to sysMbMTcp_InitNetConfiguration() must always be passed as jbus addresses!
var MODBUSTCP_MASTER_ADDRESSING_MODE = MODBUSTCP_MASTER_ADDRESSING_MODE_JBUS

var MODBUSTCP_MASTER_TARGET_ARM = 0
var MODBUSTCP_MASTER_TARGET_x86 = 1
var MODBUSTCP_MASTER_TARGET_ARCHITECTURE = MODBUSTCP_MASTER_TARGET_ARM

// modalità alternativa di gestione slaves: viene creata una istanza di struttura per ogni slave, non ci sono var mappate
var MODBUSTCP_MASTER_STRUCT_SLAVES = false;

var MODBUSTCP_SYSMBTCPSLAVESTATE_BASETYPE = "MbTcpSlaveState"
var MODBUSTCP_SYSMBTCPSLAVESTATE_BASENAME = "sysMbTcpSlaveState"

/*	Eventualmente ridefinisce i default specificati qui sopra */

#include ../AlModbusTCP_settings.js

var MODBUSTCP_MASTER_ADDRESS_MIN = ( MODBUSTCP_MASTER_ADDRESSING_MODE == MODBUSTCP_MASTER_ADDRESSING_MODE_MODBUS ) ? 1 : 0
var MODBUSTCP_MASTER_ADDRESS_MAX = ( MODBUSTCP_MASTER_ADDRESSING_MODE == MODBUSTCP_MASTER_ADDRESSING_MODE_MODBUS ) ? 65536 : 65535

// ---------------------------------------------------------- GESTIONE MODBUS MASTER TCP ---------------------------------------------------
// analisi della configurazione di uno singolo slave: di fatto non genera niente ma verifica cfg e aggiunge solo alcuni campi
function BuildCfg_ModbusMaster_slaveCfg(slave, cfg, mappedVars, usedNodeNumbers, usedModbusAddresses)
{
	function CheckUniqueFieldName(curVar, namesMap)
	{
		var ris = {}
		var fieldName = curVar.label ? curVar.label : app.CallFunction("common.NormalizeName", curVar.objectName);
		ris.fieldName = fieldName
		if (namesMap[fieldName])
		{
			ris.isDuplicated = true
		}
		else
		{
			namesMap[fieldName] = true
			ris.isDuplicated = false
		}
		
		return ris
	}
	
	var FUNCNAME = "BuildCfg_ModbusMaster_slaveCfg"
	
	var result = { totVars:0, totMsg:0 }
	
	var errNodeNumber = app.CallFunction("common.SplitFieldPath", slave.selectSingleNode("*/nodeNumber"))
	var errModbusAddress = app.CallFunction("common.SplitFieldPath", slave.selectSingleNode("*/modbusAddress"))
	
	var extname = slave.getAttribute("ExtensionName")
	if (!extname)
	{
		var msg = genfuncs.FormatMsg(app.Translate("Invalid modbus device"))
		throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
	}

	// -1 per nodeNumber e modbusAddress è valore speciale per identificare broadcast
	if (cfg.nodeNumber == -1 && cfg.modbusAddress == -1)
	{
		throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, "Modbus TCP does not support broadcast messages", errNodeNumber)
	}
	else
	{
		// verifica validità modbusAddress (0 e 255 indicano lo slave stesso senza bridge, 1..247 un RTU in bridge)
		if (! ((cfg.modbusAddress >= 1 && cfg.modbusAddress <= 247) || cfg.modbusAddress == 0 || cfg.modbusAddress == 255))
		{
			var msg = genfuncs.FormatMsg(app.Translate("Invalid Modbus TCP address: %1 (must be 0,255 or 1..247 for bridge)"), cfg.modbusAddress)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
		}
		
		//	definizione modalita  di configurazione indirizzo slave
		var SLAVEADDRESSCONFIGMODE = app.CallFunction(extname + ".GetSlaveAddressConfigMode");
		
		if (cfg.slaveAddressConfigMode == SLAVEADDRESSCONFIGMODE.STATIC)
		{
			// verifica validità indirizzo IP
			if (!cfg.IPAddress || !genfuncs.IsValidIPAddress(cfg.IPAddress))
			{
				var err = app.CallFunction("common.SplitFieldPath", slave.selectSingleNode("*/ip"))
				var msg = genfuncs.FormatMsg(app.Translate("Invalid IP Address"))
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, err)
			}
		
			var addressKey = cfg.IPAddress + "," + cfg.modbusAddress
			
			// verifica univocità indirizzo modbus (rtu o tcp)
			if (usedModbusAddresses[addressKey] != undefined)
			{
				var msg = genfuncs.FormatMsg(app.Translate("Duplicate Modbus address: %1"), addressKey)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
			}
			else
				usedModbusAddresses[addressKey] = true
		}
		else
		{
			var errModbusAddress = app.CallFunction("common.SplitFieldPath", slave.selectSingleNode("*/dynamicSlaveAddress"))
			
			// verifica validita' ipAddress
			if (cfg.dynamicSlaveAddress == "")
			{
				var msg = genfuncs.FormatMsg(app.Translate("IP address not specified"))
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
			}
			
			var addressKey = cfg.slaveAddressConfigMode + "," + cfg.dynamicSlaveAddress + "," + cfg.modbusAddress
			
			// verifica univocità indirizzo modbus (rtu o tcp)
			if (usedModbusAddresses[addressKey] != undefined)
			{
				var msg = genfuncs.FormatMsg(app.Translate("Duplicate Modbus address: %1"), addressKey)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
			}
			else
				usedModbusAddresses[addressKey] = true
			
			//	reset static ip address field
			cfg.IPAddress = ""
		}
		
		// verifica validità e unicità nodeNumber
		if (! (cfg.nodeNumber >= 1 && cfg.nodeNumber <= 247))
		{
			var msg = genfuncs.FormatMsg(app.Translate("Invalid node number: %1 (must be in 1..247)"), cfg.nodeNumber)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errNodeNumber)
		}
		
		if (usedNodeNumbers[cfg.nodeNumber] != undefined)
		{
			var msg = genfuncs.FormatMsg(app.Translate("Duplicate node number: %1"), cfg.nodeNumber)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errNodeNumber)
		}
		else
			usedNodeNumbers[cfg.nodeNumber] = true
	}
	
	cfg.device = slave
	cfg.slaveName = slave.getAttribute("caption");
	
	var fieldNamesMap = {}
	
	// iterazione sulla lista dei messaggi
	for (var i = 0; i < cfg.images.length; i++)
	{
		var msg = cfg.images[i]
		
		if (msg.vars.length != 0)
			var errnode = msg.vars[0].node
		else
			var errnode = null
			
		if ((msg.vars.length == 0 || msg.vars[0].label == "") && !MODBUSTCP_MASTER_STRUCT_SLAVES)
		{
			var errmsg = app.Translate("Invalid or missing variabile in Modbus message")
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", errnode))
		}
		
		if (msg.funcode == undefined || msg.funcode == null)
		{
			var errmsg = app.Translate("Invalid Modbus function code")
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", errnode))
		}
		
		// partendo dalla funzione modbus ricava la direzione (input/output) e il tipo (bit/word)
		var block
		if ( msg.isInOut )
			block = "input_outputonchange"
		else
			block = app.CallFunction("parameters.GetModbusFuncIODirection", msg.funcode)
		
		if( msg.oneshot )
		{
			var isComplex = app.CallFunction("script.IsComplexVar", msg.oneshot)
			if (!isComplex)
				var PLCvar = mappedVars[msg.oneshot]
			else
				var PLCvar = app.CallFunction("logiclab.FindSymbol", msg.oneshot, "")
		
			if (!PLCvar || !PLCvar.IsDataBlock )
			{
				var msg = genfuncs.FormatMsg(app.Translate("The variable %1 does not exist, or it is not mapped on a datablock"), msg.oneshot )
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, app.CallFunction("common.SplitFieldPath", errnode))
			}
			
			msg.oneshot_db = PLCvar.DataBlock;
			
			if (isComplex)
				msg.oneshot_dbByteOffset = GetComplexVarOffset(PLCvar, errnode);
			else
				msg.oneshot_dbByteOffset = 0
		}
		
		if (block == "inputoutput")
		{
			// funzione di lettura/scrittura simultanea
			if (! (msg.addrwr >= MODBUSTCP_MASTER_ADDRESS_MIN && msg.addrwr <= MODBUSTCP_MASTER_ADDRESS_MAX) || ! (msg.addrrd >= MODBUSTCP_MASTER_ADDRESS_MIN && msg.addrrd <= MODBUSTCP_MASTER_ADDRESS_MAX))
			{
				// tutti i valori sono relativi all'indirizzamento del master: per il msg li riporta in quello dello slave (se info presente)
				var offs = (cfg.addressType !== undefined) ? (MODBUSTCP_MASTER_ADDRESSING_MODE - cfg.addressType) : 0;
				var errmsg = genfuncs.FormatMsg(app.Translate("Invalid Modbus start address (must be %1..%2): %3"), MODBUSTCP_MASTER_ADDRESS_MIN+offs, MODBUSTCP_MASTER_ADDRESS_MAX+offs, msg.addr+offs)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", errnode))
			}
		}
		else
		{
			// funzione semplice di lettura o scrittura singola
			if (! (msg.addr >= MODBUSTCP_MASTER_ADDRESS_MIN && msg.addr <= MODBUSTCP_MASTER_ADDRESS_MAX))
			{
				// tutti i valori sono relativi all'indirizzamento del master: per il msg li riporta in quello dello slave (se info presente)
				var offs = (cfg.addressType !== undefined) ? (MODBUSTCP_MASTER_ADDRESSING_MODE - cfg.addressType) : 0;
				var errmsg = genfuncs.FormatMsg(app.Translate("Invalid Modbus start address (must be %1..%2): %3"), MODBUSTCP_MASTER_ADDRESS_MIN+offs, MODBUSTCP_MASTER_ADDRESS_MAX+offs, msg.addr+offs)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", errnode))
			}
		}
	
		// iterazione sulla lista delle variabili di questo messaggio
		for (var v = 0, totv = msg.vars.length; v < totv; v++)
		{
			var curVar = msg.vars[v]
			
			if (!curVar.label && !MODBUSTCP_MASTER_STRUCT_SLAVES)
			{
				// la variabile deve essere per forza mappata
				var errmsg = genfuncs.FormatMsg(app.Translate("No variable mapped for address %1"), curVar.addr)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
			}
			
			if (curVar.addr < msg.addr || curVar.addr + curVar.size > msg.addr + msg.size)
			{
				// indirizzo o dimensione della variabile fuori dal messaggio
				var errmsg = genfuncs.FormatMsg(app.Translate("Invalid address or size specified: %1, %2"), curVar.addr, curVar.size)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
			}
			
			var typeSize;
			if (!MODBUSTCP_MASTER_STRUCT_SLAVES)
			{
				var isComplex = app.CallFunction("script.IsComplexVar", curVar.label)
				if (!isComplex)
					var PLCvar = mappedVars[curVar.label]
				else
					var PLCvar = app.CallFunction("logiclab.FindSymbol", curVar.label, "")

				if (!PLCvar)
				{
					// variabile PLC cancellata
					var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has been deleted or changed to 'Auto' allocation"), curVar.label)
					throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
				}
				else if (PLCvar.type != curVar.dbt)
				{
					// variabile PLC modificata nel tipo
					var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has been modified in type"), curVar.label)
					throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
				}
				else if (!app.CallFunction("common.CompareDatablocks", PLCvar.DataBlock, curVar.db))
				{
					// variabile PLC modificata nell'allocazione
					var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has been modified in datablock allocation"), curVar.label)
					throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
				}
				
				if (PLCvar.type == "STRING")
				{
					typeSize = PLCvar.GetStrDimensions()
					typeSize = parseInt(typeSize.substr( 1, typeSize.length - 2 ))	//	remove "[" and "]"
					typeSize++	//	terminator
				}
				else
				{
					typeSize = app.CallFunction("common.GetIECTypeSize", curVar.dbt)
				}
				
				if (isComplex)
					curVar.dbByteOffset = GetComplexVarOffset(PLCvar, curVar.node);
				else
					curVar.dbByteOffset = 0;
			}
			else
			{
				typeSize = app.CallFunction("common.GetIECTypeSize", curVar.objectType);
				// al momento nel ModbusCustomEditor mancano molti tipi (stringhe comprese), quindi qui non compaiono gestioni particolari per STRING
				
				var ris
				ris = CheckUniqueFieldName(curVar, fieldNamesMap)
				if (ris.isDuplicated)
				{
					// fieldName già presente
					var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Field '%1' already defined"), ris.fieldName)
					throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
				}
			}
			
			curVar.lenBytes = typeSize;
			
			result.totVars++
		}
		
		result.totMsg++
	}
	
	// parametri di configurazione
	for (var i = 0; i < cfg.params.length; i++)
	{
		var param = cfg.params[i]
		
		if (isNaN(param.addr) || !param.type || isNaN(param.value) || isNaN(param.tmo))
		{
			var errmsg = genfuncs.FormatMsg(app.Translate("Invalid parametrization record"))
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", param.node))
		}
	}
	
	return result
}

// determina se l'oggetto specificato è un array
// vedi http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/ per una dettagliata spiegazione...
function IsArray(obj)
{
	return Object.prototype.toString.call(obj) === '[object Array]';
}

function Validate_MBTCPMaster(device, port, mappedVars)
{
	try
	{
		//	this function generate only data structures, does not generate code
		BuildCfg_MBTCPMaster(device, port, mappedVars)
		
		return enuLogLevels.LEV_OK
	}
	catch (err)
	{
		if (typeof err == "number")
			// se numerico codice di uscita
			return err
		else if (typeof err == "string")
			app.PrintMessage("!!! CRITICAL ERROR: " + err)
		else if (typeof err == "object")
			app.PrintMessage("!!! CRITICAL ERROR: " + err.message)
		
		return enuLogLevels.LEV_CRITICAL
	}
}

function BuildCfg_MBTCPMaster(device, port, mappedVars)
{
	var FUNCNAME = "BuildCfg_MBTCPMaster"
	
	var usedNodeNumbers = {}
	var usedModbusAddresses = {}
	
	var result = {
		totSlaves: 0, 
		totMsg: 0, 
		totVars: 0,
		slaves: []
	}
	
	var slaves = port.selectNodes("*[@insertable]")
	var slave
	while (slave = slaves.nextNode())
	{
		var extname = slave.getAttribute("ExtensionName")
		if (!extname)
			continue   // slave senza estensione definita?
		
		var enabled = slave.getAttribute("enabled")
		if (enabled !== null)
			enabled = genfuncs.ParseBoolean(enabled)
		else
			enabled = true
		
		if(!enabled)
			continue
		
		// richiesta struttura per ModbusRTU allo slave tramite funzione apposita
		// NB: anche se nel nome compare 'RTU' i dati sono gli stessi anche per il TCP!
		var cfg = app.CallFunction(extname + ".GetModbusRTUCfg", slave, MODBUSTCP_MASTER_ADDRESSING_MODE, MODBUSTCP_MASTER_STRUCT_SLAVES);
		if (!cfg)
		{
			var err = app.CallFunction("common.SplitFieldPath", slave)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, app.Translate("Invalid Modbus data"), err)
		}
		
		if (IsArray(cfg))
			// la GetModbusRTUCfg ha ritornato un array di configurazione (slave multiplo, es. multi-zona)
			var cfglist = cfg
		else
			// configurazione singola semplice, crea un array con un solo elemento
			var cfglist = [ cfg ]
		
		for (var i = 0; i < cfglist.length; i++)
		{
			var cfg = cfglist[i];
			var slaveResult = BuildCfg_ModbusMaster_slaveCfg(slave, cfg, mappedVars, usedNodeNumbers, usedModbusAddresses)
			if (slaveResult)
			{
				result.slaves.push(cfg);
				result.totMsg += slaveResult.totMsg
				result.totVars += slaveResult.totVars
				result.totSlaves++
			}
		}
	}
	
	var msg = app.Translate("%1: created Modbus TCP Master cfg (%2 slaves, %3 messages, %4 variables)")
	app.PrintMessage(genfuncs.FormatMsg(msg, device.getAttribute("caption"), result.totSlaves, result.totMsg, result.totVars))
	return result
}

var m_typeDToValue = { 	"MBMTCP_DATA_T_SINT" : 0, 
						"MBMTCP_DATA_T_USINT" : 1, 
						"MBMTCP_DATA_T_BYTE" : 2,
						"MBMTCP_DATA_T_INT" : 3,
						"MBMTCP_DATA_T_UINT" : 4,
						"MBMTCP_DATA_T_WORD" : 5,
						"MBMTCP_DATA_T_DINT" : 6,
						"MBMTCP_DATA_T_UDINT" : 7,
						"MBMTCP_DATA_T_DWORD" : 8,
						"MBMTCP_DATA_T_REAL" : 9,
						"MBMTCP_DATA_T_BOOL" : 10, 
						"MBMTCP_DATA_T_LINT" : 11,
						"MBMTCP_DATA_T_ULINT" : 12,
						"MBMTCP_DATA_T_LWORD" : 13,
						"MBMTCP_DATA_T_LREAL" : 14,
						"MBMTCP_DATA_T_NULL" : 255 }
var m_blockToValue = { "MBMTCP_IMG_BLOCK_INPUT" : 0, "MBMTCP_IMG_BLOCK_OUTPUT" : 1, "MBMTCP_IMG_BLOCK_INPOUT" : 2,  "MBMTCP_IMG_BLOCK_INPOUTONCHANGE" : 3 }

if ( MODBUSTCP_MASTER_TARGET_ARCHITECTURE == MODBUSTCP_MASTER_TARGET_ARM )
{
	//	size ARM32/Thumb2
	var MB_PARAM_INFO_SIZE = 12
	var MB_IMAGE_INFO_SIZE = 20
	var MB_PLC_INFO_SIZE = 20
	var MB_QUEUE_MSG_SIZE = 92
	var MB_INPOUT_CMD_SIZE = 32
	var MBADU_SIZE = 260
}
else if ( MODBUSTCP_MASTER_TARGET_ARCHITECTURE == MODBUSTCP_MASTER_TARGET_x86 )
{
	//	size x86
	var MB_PARAM_INFO_SIZE = 12
	var MB_IMAGE_INFO_SIZE = 20
	var MB_PLC_INFO_SIZE = 20
	var MB_QUEUE_MSG_SIZE = 92
	var MB_INPOUT_CMD_SIZE = 32
	var MBADU_SIZE = 260		
}

// generazione codice IEC a partire da struttura di configurazione
function GenerateModbusTCPMasterCode( masterCfg )
{
	function GetUniqueFieldName(curVar, namesMap)
	{
		var baseName = curVar.label ? curVar.label : app.CallFunction("common.NormalizeName", curVar.objectName);
		var fieldName = baseName;
		var i = 0;
		while (fieldName in namesMap)
		{
			i++;
			fieldName = baseName + "_" + i;
		}
		namesMap[fieldName] = true;
		return fieldName;
	}
	
	
	if ( !(MODBUSTCP_MASTER_TARGET_ARCHITECTURE == MODBUSTCP_MASTER_TARGET_ARM ||  MODBUSTCP_MASTER_TARGET_ARCHITECTURE == MODBUSTCP_MASTER_TARGET_x86 ))
	{
		app.PrintMessage(app.Translate("Modbus TCP master architecture not managed"))
		return ""
	}

	if (masterCfg.slaves.length == 0)
		return "";
	
	var content = ""
	var cfg = {}
	cfg.slaveNum = masterCfg.slaves.length

	cfg.paramNum = 0;
	cfg.imageNum = 0;
	cfg.paramStructConfigCode = ""
	cfg.imageStructConfigCode = ""
	
	cfg.imageNumInput = 0
	cfg.imageNumOutputNotOnVariation = 0
	cfg.imageNumOutputOnVariation = 0
	cfg.imageNumInpOut = 0
	cfg.imageNumInpOutOnChange = 0
	
	cfg.processInputNum = 0;
	cfg.processOutputNum = 0;
	cfg.processInputStructConfigCode = "";
	cfg.sysInfoInpImgPlcMemory = "";
	cfg.processOutputStructConfigCode = "";
	cfg.sysInfoOutImgPlcMemory = "";
	
	cfg.numImgDiscInputStatus = 0;
	cfg.numImgCoilStatus = 0;
	cfg.numImgRegInputStatus = 0;
	cfg.numImgHoldRegStatus = 0;
	cfg.numImgCoilStatusAuxIn = 0;
	cfg.numImgHoldRegStatusAuxIn = 0;
	cfg.numImgCoilStatusAuxOut = 0;
	cfg.numImgHoldRegStatusAuxOut = 0;
	
	cfg.swapBufferCodeConstants = ""
	cfg.swapBufferCodeVars = ""
	var swapBufferRegTypeInfoMap = {}
	
	cfg.typesCode = "";
	cfg.globalVarCode = "";
	cfg.masterCode = "";
	cfg.initDiagCode = "";
	
	var arrSlaves = [];  // array di sysMbMTcpSlave
	var arrSlavesDynInit = [];  // codice di inizializzazione
	var arrParams = [];  // array di sysMbMTcpSlaveParam
	var arrImages = [];  // array di sysMbMTcpSlaveImage
	var arrInputs = [];  // array di sysMbMTcpPlcImage
	var arrOutputs = []; // array di sysMbMTcpPlcImage
	var imageId = 0;
	
	var slaveAddressConfigModeEnum = { 	"0" : "MB_TCP_CONFIG_MODE_STATIC", 
										"1" : "MB_TCP_CONFIG_MODE_BY_VAR_ADDRESS",
										"2" : "MB_TCP_CONFIG_MODE_BY_16BIT_KEY",
										"4" : "MB_TCP_CONFIG_MODE_BY_32BIT_KEY" }

	for (var i = 0; i < masterCfg.slaves.length; i++)
	{
		// struttura di configurazione slave
		var slave = masterCfg.slaves[i];
		var s = "\t\t( node := " + slave.nodeNumber + ", address := " + slave.modbusAddress + ", TCPport := 502, Ip := '" + slave.IPAddress + "', swapWordsMode := " + slave.swapWordsMode + ", reserved1 := 0, reserved2 := 0, reserved3 := 0 )";
		arrSlaves.push(s);
		
		if (MODBUSTCP_MASTER_DYNAMICSLAVEADDRESS_SUPPORTED)
		{
			//	definizione modalita  di configurazione indirizzo slave
			var extname = slave.device.getAttribute("ExtensionName")
			var SLAVEADDRESSCONFIGMODE = app.CallFunction(extname + ".GetSlaveAddressConfigMode");
			
			if (slave.slaveAddressConfigMode > 0)
			{
				var keyComment
				var keyValue
				var setKeyValue = ""
				switch (slave.slaveAddressConfigMode)
				{
				case SLAVEADDRESSCONFIGMODE.BY_VARIABLE_NAME:
					keyComment = "(* Slave address configured by variable *)\n"
					keyValue = "ADR(" + slave.dynamicSlaveAddress + ")"
					break;
				case SLAVEADDRESSCONFIGMODE.BY_16BIT_KEY:
					keyComment = "(* Slave address configured by 16bit identifier *)\n"
					setKeyValue = "dynamicSlaveAddressKeyU16 := " + slave.dynamicSlaveAddress + ";\n"
					keyValue = "ADR(dynamicSlaveAddressKeyU16)"
					break;
				case SLAVEADDRESSCONFIGMODE.BY_32BIT_KEY:
					keyComment = "(* Slave address configured by 32bit identifier *)\n"
					setKeyValue = "dynamicSlaveAddressKeyU32 := " + slave.dynamicSlaveAddress + ";\n"
					keyValue = "ADR(dynamicSlaveAddressKeyU32)"
					break;
				default:
					var msg = genfuncs.FormatMsg(app.Translate("Specified dynamic addressing mode not specified"))
					throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
					break;
				}

				var s = ""
				s += keyComment
				if (setKeyValue != "")
					s += setKeyValue
				s += "init := sysMbMTcp_SetIpAddress(ADR($$sysMbMTcpSlaveList[" + i + "]), " + slaveAddressConfigModeEnum[slave.slaveAddressConfigMode] + ", " + keyValue + ");\n" 
				arrSlavesDynInit.push(s)
			}
		}

		// array di strutture di configurazione slaves
		cfg.paramNum += slave.params.length;
		for (var j = 0; j < slave.params.length; j++)
		{
			var param = slave.params[j];
			var typeString = "MBMTCP_DATA_T_" + param.type;
			//	non è possibile valorizzare con enumerativo senza warning, devo mettere numero semplice usando m_typeDToValue
			var s = "\t\t( node := " + slave.nodeNumber + ", type_d := " + m_typeDToValue[typeString] + ", address := " + param.addr + ", tmo := " + param.tmo + ", data := " + param.value + " )";
			arrParams.push(s);
		}

		var instanceName;
		var structName;
		var fieldNamesMap = {};
		if (MODBUSTCP_MASTER_STRUCT_SLAVES)
		{
			instanceName = app.CallFunction("common.NormalizeName", slave.slaveName);
			structName = instanceName + "_STRUCT";
			cfg.typesCode += "\t" + structName + " : STRUCT\n";
		}

		// loop messaggi
		cfg.imageNum += slave.images.length;
		for (var j = 0; j < slave.images.length; j++)
		{
			var msg = slave.images[j];
			
			var isBit = app.CallFunction("parameters.IsModbusBitFunc", msg.funcode);
			var typeImage = isBit ? 0 : 1;
			var poll_time = msg.pollTime !== undefined ? msg.pollTime : 0;
			
			var block = ""
			var RdAddress = ""
			var WrAddress = ""
			// partendo dalla funzione modbus ricava la direzione (input/output) e il tipo (bit/word)
			var blockAttr
			if ( msg.isInOut )
				blockAttr = "input_outputonchange"
			else
				blockAttr = app.CallFunction("parameters.GetModbusFuncIODirection", msg.funcode)
			
			switch ( blockAttr )
			{
				case "input":
					block = "MBMTCP_IMG_BLOCK_INPUT"
					RdAddress = msg.addr
					WrAddress = 0
					dimRd =  msg.size
					dimWr = 0
					cfg.imageNumInput++
					
					if (isBit)
						cfg.numImgDiscInputStatus += dimRd
					else	//	word
						cfg.numImgRegInputStatus += dimRd
					break;
					
				case "output":
					block = "MBMTCP_IMG_BLOCK_OUTPUT"
					RdAddress = 0
					WrAddress = msg.addr
					dimRd = 0
					dimWr = msg.size
					
					if ( poll_time == 0 )
						cfg.imageNumOutputOnVariation++
					else
						cfg.imageNumOutputNotOnVariation++
					
					if (isBit)
						cfg.numImgCoilStatus += dimWr;
					else	//	word
						cfg.numImgHoldRegStatus += dimWr;
					break;
					
				case "inputoutput":
					block = "MBMTCP_IMG_BLOCK_INPOUT"
					RdAddress = msg.addrrd;
					WrAddress = msg.addrwr;
					dimRd = msg.sizerd;
					dimWr = msg.sizewr;
					cfg.imageNumInpOut++
					
					cfg.numImgHoldRegStatus += dimWr;
					cfg.numImgRegInputStatus += dimRd;
					break;
					
				case "input_outputonchange":
					block = "MBMTCP_IMG_BLOCK_INPOUTONCHANGE"
					RdAddress = msg.addr
					WrAddress = msg.addr
					dimRd = msg.size
					dimWr = msg.size
					cfg.imageNumInpOutOnChange++
					
					if (isBit)
					{
						cfg.numImgCoilStatus += dimWr;
						cfg.numImgCoilStatusAuxIn += dimWr;
						cfg.numImgCoilStatusAuxOut += dimWr;
					}
					else	//	word
					{
						cfg.numImgHoldRegStatus += dimWr;
						cfg.numImgHoldRegStatusAuxIn += dimWr;
						cfg.numImgHoldRegStatusAuxOut += dimWr;
					}
					break;
			}
			
			//	non è possibile valorizzare con enumerativo senza warning, devo mettere numero semplice
			block = m_blockToValue[ block ]

			var tmo = msg.tmo !== undefined ? msg.tmo : 1000;
			var waitBeforeSend = msg.turnAround !== undefined ? msg.turnAround : 0;
			
			var hasOneShotVar = 0
			var db_oneshot = 0
			var db_off_oneshot = 0
			var dbType_oneshot = 0
			var dbByteOffset_oneshot = 0
			if ( msg.oneshot )
			{
				hasOneShotVar = 1
								
				var db = app.CallFunction("common.ParseDataBlock", msg.oneshot_db);
				db_oneshot = db.datablock
				db_off_oneshot = db.offset
				switch ( db.area )
				{
					case "M":	dbType_oneshot = 0; 	break;
					case "I":	dbType_oneshot = 1;		break;
					case "Q":	dbType_oneshot = 2;		break;
				}
				
				dbByteOffset_oneshot = msg.oneshot_dbByteOffset;
			}
			
			var writeFirst = (msg.isInOut && msg.writeFirst) ? 1 : 0;
			
			var s = "( node := " + slave.nodeNumber + ", " +
					"funcode := " + msg.funcode + ", " +
					"block := " + block + ", " +
					"type := " + typeImage + ", " +
					"RdAddress := " + RdAddress + ", " +
					"dimRd := " + dimRd + ", " +
					"WrAddress := " + WrAddress + ", " +
					"dimWr := " + dimWr + ", " +
					"poll_time := " + poll_time + ", " +
					"tmo := " + tmo + ", " +
					"waitBeforeSend := " + waitBeforeSend + ", " +
					"db_oneshot := " + db_oneshot + ", " +
					"db_off_oneshot := " + db_off_oneshot + ", " +
					"dbByteOffset_oneshot := " + dbByteOffset_oneshot + ", " +
					"hasOneShotVar := " + hasOneShotVar + ", " +
					"dbType_oneshot := " + dbType_oneshot + ", " +
					"writeFirst := " + writeFirst + ", " +
					"reserved := 0 )";
			arrImages.push(s);
			
			var swapBufferRegTypeInfo = {}
			swapBufferRegTypeInfo.name = "$$tcpmsg_reg_types_info_" + imageId;
			swapBufferRegTypeInfo.size = msg.size
			swapBufferRegTypeInfo.varInfoMap = {}
			swapBufferRegTypeInfoMap[ imageId ] = swapBufferRegTypeInfo
			
			// iterazione sulla lista delle variabili di questo messaggio
			for (var v = 0, totv = msg.vars.length; v < totv; v++)
			{
				var curVar = msg.vars[v];
				if (!(blockAttr == "input" || blockAttr == "output" || blockAttr == "input_outputonchange"))
					continue;
				
				var varName;
				if (MODBUSTCP_MASTER_STRUCT_SLAVES)
				{
					var fieldName = GetUniqueFieldName(curVar, fieldNamesMap);
					cfg.typesCode += "\t\t" + fieldName + " : " + curVar.objectType + ";\n";
					varName = instanceName + "." + fieldName;
				}
				else
					varName = curVar.label;
				
				var s = ModbusTCPProcessVar(slave.nodeNumber, blockAttr, typeImage, imageId, curVar, varName, swapBufferRegTypeInfoMap);
				if (blockAttr == "input")
					arrInputs.push(s);
				else
					arrOutputs.push(s);
			} // for vars
			
			imageId++;
		} // for msg
		
		if (MODBUSTCP_MASTER_STRUCT_SLAVES)
		{
			cfg.typesCode += "\t\tdiag: @" + MODBUSTCP_SYSMBTCPSLAVESTATE_BASETYPE + ";\n\tEND_STRUCT;\n"
			cfg.globalVarCode += "\t\t" + instanceName + ": " + structName + ";\n";
			cfg.initDiagCode += instanceName + ".diag := ADR(" + MODBUSTCP_SYSMBTCPSLAVESTATE_BASENAME + "[" + slave.nodeNumber + "]);\n";
		}
	} // for slave
	
	
	/*	dichiarazione e inizializzazione struttura images */
	if ( cfg.imageNum > 0 )
	{
		cfg.imageStructConfigCode = "\t$$sysMbMTcpSlaveImage : ARRAY [ 0.." + (cfg.imageNum - 1) + " ] OF sysMbMTcpSlaveImage := [\n" + arrImages.join(",\n") + "\n\t]; {HIDDEN:ON} \n\n"
			/*	memoria immagini */
		cfg.sysInfoImgModbusMemory = "	$$sysInfoImgModbusMemory : ARRAY [ 0.." + ( cfg.imageNum * MB_IMAGE_INFO_SIZE - 1) + " ] OF BYTE; {HIDDEN:ON} \n"
	}
	
	/*	dichiarazione e inizializzazione struttura processes */
	cfg.processInputNum = arrInputs.length;
	if (cfg.processInputNum != 0)
	{
		cfg.processInputStructConfigCode = "\t$$sysMbMTcpPlcImageInput : ARRAY [ 0.." + (cfg.processInputNum - 1) + " ] OF sysMbMTcpPlcImage := [\n" + arrInputs.join(",\n") + "\n\t]; {HIDDEN:ON} \n\n"
		/*	memoria immagini */
		cfg.sysInfoInpImgPlcMemory = "	$$sysInfoInpImgPlcMemory : ARRAY [ 0.." + ( cfg.processInputNum * MB_PLC_INFO_SIZE - 1) + " ] OF BYTE; {HIDDEN:ON} \n"
	}
	
	cfg.processOutputNum = arrOutputs.length;
	if (cfg.processOutputNum != 0)
	{
		cfg.processOutputStructConfigCode = "\t$$sysMbMTcpPlcImageOutput : ARRAY [ 0.." + (cfg.processOutputNum - 1) + " ] OF sysMbMTcpPlcImage := [\n" + arrOutputs.join(",\n") + "\n\t]; {HIDDEN:ON} \n\n"
		/*	memoria immagini */
		cfg.sysInfoOutImgPlcMemory = "	$$sysInfoOutImgPlcMemory : ARRAY [ 0.." + ( cfg.processOutputNum * MB_PLC_INFO_SIZE - 1) + " ] OF BYTE; {HIDDEN:ON} \n"
	}
	
	// struttura di configurazione slaves
	cfg.slaveStructConfigCode = "\t$$sysMbMTcpSlaveList : ARRAY [ 0.." + (cfg.slaveNum - 1) + " ] OF sysMbMTcpSlave := [\n" + arrSlaves.join(",\n") + "\n\t]; {HIDDEN:ON}\n";

	// struttura di inizializzazione configurazione slaves dinamica
	cfg.slaveStructConfigDynSlaveAddressInitCode = ""
	if (MODBUSTCP_MASTER_DYNAMICSLAVEADDRESS_SUPPORTED)
	{
		for (var i = 0; i < arrSlavesDynInit.length; i++)
		{
			cfg.slaveStructConfigDynSlaveAddressInitCode += arrSlavesDynInit[i]
		}
	}
	
	/*	dichiarazione e inizializzazione struttura configurazione parametri */
	if ( cfg.paramNum > 0 )
	{		
		cfg.paramStructConfigCode = "\t$$sysMbMTcpSlaveParam : ARRAY [ 0.." + (cfg.paramNum - 1) + " ] OF sysMbMTcpSlaveParam := [\n" + arrParams.join(",\n") + "\n\t]; {HIDDEN:ON}\n\n";
		/*	memoria parametri */
		cfg.sysInfoParModbusMemory = "	$$sysInfoParModbusMemory : ARRAY [ 0.." + (cfg.paramNum * MB_PARAM_INFO_SIZE - 1) + " ] OF BYTE; {HIDDEN:ON} \n"
	}
	
	var numSwapBufferInfo = 0
	for ( var id in swapBufferRegTypeInfoMap )
	{
		var info = swapBufferRegTypeInfoMap[ id ]
		
		//	fill reg types info basing on known positions and filling holes
		var regTypesInfoArray = []
		for (var j = 0; j < info.size; )
		{
			var regInfo = info.varInfoMap[j]
			if (!regInfo)
			{
				//	push simple word reg
				regTypesInfoArray.push( 1 )
				j++
			}
			else
			{
				regTypesInfoArray.push( regInfo.value )
				j += regInfo.numRegs
			}
		}
		
		cfg.swapBufferCodeConstants += "\t" + info.name + " : ARRAY [ 0.." + regTypesInfoArray.length + " ] OF BYTE := [" + regTypesInfoArray.length
		
		for (var j = 0; j < regTypesInfoArray.length; j++)
			cfg.swapBufferCodeConstants += ", 16#" + regTypesInfoArray[j].toString(16)
			
		cfg.swapBufferCodeConstants += "]; {HIDDEN:ON}\n"
		numSwapBufferInfo++
	}
		
	if (numSwapBufferInfo > 0)
		cfg.swapBufferCodeVars = "\t$$tcpmsg_reg_types_info_array : ARRAY [ 0.." + (numSwapBufferInfo - 1) + " ] OF PVOID; {HIDDEN:ON} \n"
	
	var content = GenerateModbusTCPMasterPLCCode(cfg, numSwapBufferInfo, swapBufferRegTypeInfoMap);
	return content;
}

// genera in output una stringa di inizializzazione per una struct sysMbMTcpPlcImage, partendo da una var
function ModbusTCPProcessVar(slaveNode, blockAttr, typeProcess, imageId, curVar, varName, swapBufferRegTypeInfoMap)
{
	var block = ""
	switch ( blockAttr )
	{
		case "input": 					block = "MBMTCP_IMG_BLOCK_INPUT"; 			break;
		case "output":					block = "MBMTCP_IMG_BLOCK_OUTPUT";			break;
		case "inputoutput":				block = "MBMTCP_IMG_BLOCK_INPOUT";			break;
		case "input_outputonchange":	block = "MBMTCP_IMG_BLOCK_INPOUTONCHANGE";	break;
	}
	
	//	non è possibile valorizzare con enumerativo senza warning, devo mettere numero semplice
	block = m_blockToValue[ block ]
	
	var address = curVar.addr;
	var bitn = curVar.bit !== undefined ? curVar.bit : 0;
	
	var type = MODBUSTCP_MASTER_STRUCT_SLAVES ? curVar.objectType : curVar.dbt;
	
	var type_v = "MBMTCP_DATA_T_" + type;
	//	non è possibile valorizzare con enumerativo senza warning, devo mettere numero semplice
	type_v = m_typeDToValue[ type_v ]
				
	var result = "( node := " + slaveNode + ", " +
			"block := " + block + ", " +
			"type := " + typeProcess + ", " +
			"address := " + address + ", " +
			"bitn := " + bitn + ", " +
			"type_v := " + type_v + ", " +
			"ptr := ?" + varName + " )";
	
	var typeSize = curVar.lenBytes;
	var infoValue
	var numRegs
	
	// push info for swap buffer
	if ( type == "REAL" || type == "LREAL" )
	{
		numRegs = (typeSize / 2)
		// push info for swap buffer
		infoValue = 0x40 | ( numRegs & 0x3F )		//	flag isReal + numRegs
	}
	else if ( type == "STRING" )
	{
		numRegs = ( (typeSize + 1) / 2)
		infoValue = 0x80 | ( numRegs & 0x7F )		//	flag isString + numRegs
	}
	else if ( typeSize < 2 )
	{
		numRegs = 1
		infoValue = 1								// 	numRegs
	}
	else
	{
		numRegs = ( typeSize / 2)
		infoValue = numRegs & 0x3F					//	num regs
	}
		
	var regInfo = {numRegs: numRegs, value: infoValue};
	swapBufferRegTypeInfoMap[ imageId ].varInfoMap[ curVar.pos ] = regInfo

	return result;
}

function GenerateModbusTCPMasterPLCCode(cfg, numSwapBufferInfo, swapBufferRegTypeInfoMap)
{
	var content = "";
	
	if (cfg.typesCode != "")
		content += "TYPE\n" + cfg.typesCode + "END_TYPE\n\n";
	
	content += "VAR_GLOBAL CONSTANT\n";
	content += cfg.swapBufferCodeConstants
	if (!MODBUSTCP_MASTER_DYNAMICSLAVEADDRESS_SUPPORTED)
		content += cfg.slaveStructConfigCode	//	declare as constant
	content += cfg.paramStructConfigCode
	content += cfg.imageStructConfigCode
	content += "END_VAR\n\n"
	content += "VAR_GLOBAL\n"
	if (MODBUSTCP_MASTER_DYNAMICSLAVEADDRESS_SUPPORTED)
		content += cfg.slaveStructConfigCode	//	declare as variable		

	// al momento non è possibile specificare ADR() negli init value nelle costanti!
	content += cfg.processInputStructConfigCode	
	content += cfg.processOutputStructConfigCode
	content += "END_VAR\n\n"

	if ( ( cfg.paramNum > 0 ) || ( cfg.imageNum > 0 ) || ( cfg.processInputNum > 0 ) || ( cfg.processOutputNum > 0 ) )
	{
		content += "VAR_GLOBAL\n"
		if ( cfg.paramNum > 0 ) 
			content += cfg.sysInfoParModbusMemory	//	cfg.paramNum * MB_PARAM_INFO_SIZE
		if ( cfg.imageNum > 0 )
			content += cfg.sysInfoImgModbusMemory	//	cfg.imageNum * MB_IMAGE_INFO_SIZE
		if ( cfg.processInputNum > 0 )
			content += cfg.sysInfoInpImgPlcMemory	//	cfg.processInputNum * MB_PLC_INFO_SIZE
		if ( cfg.processOutputNum > 0 )
			content += cfg.sysInfoOutImgPlcMemory	//	cfg.processOutputNum * MB_PLC_INFO_SIZE
		if ( cfg.imageNum > 0 )
		{
			if ( cfg.numImgDiscInputStatus > 0 )
				content += "	$$sysImgDiscInputStatusMemory : ARRAY [ 0.." + (cfg.numImgDiscInputStatus - 1) + "] OF BOOL; {HIDDEN:ON}\n"
			if ( cfg.numImgCoilStatus > 0 )
				content += "	$$sysImgCoilStatusMemory : ARRAY [ 0.." + (cfg.numImgCoilStatus - 1) + "] OF BOOL; {HIDDEN:ON} \n"
			if ( cfg.numImgRegInputStatus > 0 )
				content += "	$$sysImgRegInputStatusMemory : ARRAY [ 0.." + (cfg.numImgRegInputStatus - 1) + "] OF WORD; {HIDDEN:ON} \n"
			if ( cfg.numImgHoldRegStatus > 0 )
				content += "	$$sysImgHoldRegStatusMemory : ARRAY [ 0.." + (cfg.numImgHoldRegStatus - 1) + "] OF WORD; {HIDDEN:ON} \n"
			if ( cfg.numImgCoilStatusAuxIn > 0 )
				content += "	$$sysImgCoilStatusAuxInMemory : ARRAY [ 0.." + (cfg.numImgCoilStatusAuxIn - 1) + "] OF BOOL; {HIDDEN:ON} \n"
			if ( cfg.numImgHoldRegStatusAuxIn > 0 )
				content += "	$$sysImgHoldRegStatusAuxInMemory : ARRAY [ 0.." + (cfg.numImgHoldRegStatusAuxIn - 1) + "] OF WORD; {HIDDEN:ON} \n"
			if ( cfg.numImgCoilStatusAuxOut > 0 )
				content += "	$$sysImgCoilStatusAuxOutMemory : ARRAY [ 0.." + (cfg.numImgCoilStatusAuxOut - 1) + "] OF BOOL; {HIDDEN:ON} \n"
			if ( cfg.numImgHoldRegStatusAuxOut > 0 )
				content += "	$$sysImgHoldRegStatusAuxOutMemory : ARRAY [ 0.." + (cfg.numImgHoldRegStatusAuxOut - 1) + "] OF WORD; {HIDDEN:ON} \n"
			if ( numSwapBufferInfo )
				content += cfg.swapBufferCodeVars
		}
		content += "END_VAR\n"
	}
	
	//	1 messaggio di servizio per ciascuno slave + 1 messaggio per ciascuna image
	var msgNum = cfg.slaveNum + cfg.imageNum
	//	i messaggi di servizio e i comandi di input non hanno bisogno della copia del pacchetto spedito
	cfg.mbaduNum = cfg.slaveNum + cfg.imageNumInput + cfg.imageNumInpOut + cfg.imageNumOutputNotOnVariation + 2 * ( cfg.imageNumOutputOnVariation + cfg.imageNumInpOutOnChange )
	if (msgNum > 0)
	{
		content += "VAR_GLOBAL\n"
		//	numero di messaggi
		content += "	$$sysMbQueueMsgMemory : ARRAY [ 0.." + (msgNum * MB_QUEUE_MSG_SIZE - 1) + " ] OF BYTE; {HIDDEN:ON} \n"
		content += "	$$sysMbQueueMsgNum : UDINT := " + msgNum + "; {HIDDEN:ON} \n"
		//	buffer di appoggio pacchetti
		content += "	$$sysMbADUMemory : ARRAY [ 0.." + (cfg.mbaduNum * MBADU_SIZE - 1) + " ] OF BYTE; {HIDDEN:ON} \n"
		content += "	$$sysMbADUMemoryNum : UDINT := " + cfg.mbaduNum  + "; {HIDDEN:ON} \n"
		if ( cfg.imageNumInpOutOnChange > 0 )
		{
			content += "	$$sysMbInpOutMsgMemory : ARRAY [ 0.." + (cfg.imageNumInpOutOnChange * MB_INPOUT_CMD_SIZE - 1) + " ] OF BYTE; {HIDDEN:ON} \n"
			content += "	$$sysMbInpOutMsgNum : UDINT := " + cfg.imageNumInpOutOnChange + "; {HIDDEN:ON} \n"
		}
		content += "END_VAR\n"
	}
	
	if (cfg.globalVarCode != "")
		content += "VAR_GLOBAL\n" + cfg.globalVarCode + "END_VAR\n";
	
	content += "PROGRAM MbMTCP WITH Init;\n\
	PROGRAM MbMTCP\n\
	{ HIDDEN:ON }\n\n\
	VAR\n\
		init : BOOL;\n\
		dummyCRC32 : UDINT;\n"
	if (MODBUSTCP_MASTER_DYNAMICSLAVEADDRESS_SUPPORTED)
	{
		content += "\t\tdynamicSlaveAddressKeyU16 : UINT;\n"
		content += "\t\tdynamicSlaveAddressKeyU32 : UDINT;\n"
	}
	content +="\tEND_VAR\n\n\
	{ CODE:ST }\n"
	content += cfg.initDiagCode
	content += "\n"
	content += "init := sysMbMTcp_CheckMemorySize( " + MB_PARAM_INFO_SIZE + "," + MB_IMAGE_INFO_SIZE + "," + MB_PLC_INFO_SIZE + "," + MB_QUEUE_MSG_SIZE + "," + MB_INPOUT_CMD_SIZE + "," + MBADU_SIZE + ");\n"
	content += "IF NOT init THEN\n"
	content += "	RETURN;\n"
	content += "END_IF;\n"
	if ( msgNum > 0 )
	{
		content += "init := sysMbMTcp_InitMemory( ?$$sysMbQueueMsgMemory, $$sysMbQueueMsgNum, ?$$sysMbADUMemory, $$sysMbADUMemoryNum, " + ( cfg.imageNumInpOutOnChange > 0 ? "?$$sysMbInpOutMsgMemory, $$sysMbInpOutMsgNum, " : "NULL, 0, " )
		content += ( cfg.paramNum > 0 ) ? "?$$sysInfoParModbusMemory, " : "NULL, "
		content += ( cfg.imageNum > 0 ) ? "?$$sysInfoImgModbusMemory, " : "NULL, "
		content += ( cfg.processInputNum > 0 ) ? "?$$sysInfoInpImgPlcMemory, " : "NULL, "
		content += ( cfg.processOutputNum > 0 ) ? "?$$sysInfoOutImgPlcMemory" : "NULL"
		content += ");\n"
	}
	else
	{
		content += "init := sysMbMTcp_InitMemory( NULL, 0, NULL, 0, NULL, 0, NULL, NULL, NULL, NULL);\n"
	}
	if ( cfg.imageNum > 0 )
	{
		if ( numSwapBufferInfo > 0 )
		{
			var j = 0
			for ( var id in swapBufferRegTypeInfoMap )
			{
				content += "$$tcpmsg_reg_types_info_array[" + j + "] := ?" + swapBufferRegTypeInfoMap[id].name + ";\n"
				j++
			}
		}
		content += "init := sysMbMTcp_InitProcessImages("
		content += cfg.numImgDiscInputStatus > 0 ? "?$$sysImgDiscInputStatusMemory, " : "NULL, "
		content += cfg.numImgCoilStatus > 0 ? "?$$sysImgCoilStatusMemory, " : "NULL, "
		content += cfg.numImgRegInputStatus > 0 ? "?$$sysImgRegInputStatusMemory, " : "NULL, "
		content += cfg.numImgHoldRegStatus > 0 ? "?$$sysImgHoldRegStatusMemory, " : "NULL, "
		content += cfg.numImgCoilStatusAuxIn > 0 ? "?$$sysImgCoilStatusAuxInMemory, " : "NULL, "
		content += cfg.numImgHoldRegStatusAuxIn > 0 ? "?$$sysImgHoldRegStatusAuxInMemory, " : "NULL, "
		content += cfg.numImgCoilStatusAuxOut > 0 ? "?$$sysImgCoilStatusAuxOutMemory, " : "NULL, "
		content += cfg.numImgHoldRegStatusAuxOut > 0 ? "?$$sysImgHoldRegStatusAuxOutMemory, " : "NULL, "
		content += cfg.numImgDiscInputStatus + ", "
		content += cfg.numImgCoilStatus + ", "
		content += cfg.numImgRegInputStatus + ", "
		content += cfg.numImgHoldRegStatus + ", "
		content += cfg.numImgCoilStatusAuxIn + ", "
		content += cfg.numImgHoldRegStatusAuxIn + ", "
		content += cfg.numImgCoilStatusAuxOut + ", "
		content += cfg.numImgHoldRegStatusAuxOut + ");\n"
	}
	content += cfg.slaveStructConfigDynSlaveAddressInitCode
	content += "init := sysMbMTcp_InitNetConfiguration3( 1, " + cfg.slaveNum + ", " + cfg.paramNum + ", " + cfg.imageNum + ", " + cfg.processInputNum + ", " + cfg.processOutputNum + ", " + numSwapBufferInfo + ", "
	content += ( cfg.slaveNum > 0 ) ? "?$$sysMbMTcpSlaveList, " : "NULL, "
	content += ( cfg.paramNum > 0 ) ? "?$$sysMbMTcpSlaveParam, " : "NULL, "
	content += ( cfg.imageNum > 0 ) ? "?$$sysMbMTcpSlaveImage, " : "NULL, "
	content += ( cfg.processInputNum > 0 ) ? "?$$sysMbMTcpPlcImageInput, " : "NULL, "
	content += ( cfg.processOutputNum > 0 ) ? "?$$sysMbMTcpPlcImageOutput, " : "NULL, "
	content += ( numSwapBufferInfo > 0 ) ? "?$$tcpmsg_reg_types_info_array" : "NULL"
	content += ");\n"

	if (cfg.masterCode != "")
		content += cfg.masterCode;
	
	// il calcolo del crc di questa parte serve a vedere se ci sono state modifiche sulla configurazione dello stack.
	// nel caso di modifiche il crc diverso, assegnato alla variabile plc dummyCrc32 causa la notifica dello status di modifica del task di init.
	// in caso di modifica della configurazione modbus, bisogna triggerare un warm restart per i target hotswap
	var dummyCrc32 = app.CallFunction("commonDLL.CalcCRC32ForData", content, 0)		
	if ( dummyCrc32 < 0 )
		dummyCrc32 = 0x100000000 + dummyCrc32		//	per avere valore UDINT: altrimenti mettendolo DINT esce un warning in preproc
			
	content += "dummyCRC32 := " + dummyCrc32 + ";\n"
	content += "END_PROGRAM\n"
	
	return content
}

function Validate_Ethernet(device, mappedVars, modbusSlaveCfg)
{
	var FUNCNAME = "Validate_Ethernet";
	
	var portList = device.selectNodes("Ethernet")
	var port
	var masterCfg;
	while (port = portList.nextNode())
	{
		var enableMaster = genfuncs.ParseBoolean(port.getAttribute("enableMaster"))
		var enableSlave = genfuncs.ParseBoolean(port.getAttribute("enableSlave"))
		
		if (enableMaster)
		{
			if (masterCfg !== undefined)
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, "Modbus TCP only allows one master")
			
			// validazione configurazione per ModbusTCP master
			var result = Validate_MBTCPMaster(device, port, mappedVars)
			if (result != enuLogLevels.LEV_OK)
				return result
		}
	}
	
	return enuLogLevels.LEV_OK
}

function BuildCfg_Ethernet(device, mappedVars, modbusSlaveCfg)
{
	var FUNCNAME = "BuildCfg_Ethernet";
	
	var portList = device.selectNodes("Ethernet")
	var port
	var masterCfg;
	while (port = portList.nextNode())
	{
		var enableMaster = genfuncs.ParseBoolean(port.getAttribute("enableMaster"))
		var enableSlave = genfuncs.ParseBoolean(port.getAttribute("enableSlave"))
		
		if (enableMaster)
		{
			if (masterCfg !== undefined)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, "Modbus TCP only allows one master")
			
			// generazione configurazione per ModbusTCP master
			masterCfg = BuildCfg_MBTCPMaster(device, port, mappedVars)
		}
		
		if (enableSlave)
			// restituisce in output il nodo xml della porta con la cfg
			modbusSlaveCfg.TCPports.push(port)
	}

	var content = ""
	if ( masterCfg !== undefined )
		content = GenerateModbusTCPMasterCode( masterCfg )
	
	//	inserimento sorgente ausiliario nel progetto PLC
	var filename = "ModbusTCP_cfg.plc"
	if (content === null)
		// errore di generazione
		throw enuLogLevels.LEV_CRITICAL
	else if (content === "")
		// nessun codice generato, rimuove il codice aux eventualmente presente
		app.CallFunction( "compiler.LogicLab_RemovePLC", app.CallFunction("logiclab.get_ProjectPath"), filename )
	else
		app.CallFunction( "compiler.LogicLab_UpdatePLC", app.CallFunction("logiclab.get_ProjectPath"), filename, content )
	
	return true
}