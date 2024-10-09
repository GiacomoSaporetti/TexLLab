var MODBUSRTU_MASTER_ADDRESSING_MODE_MODBUS = 0
var MODBUSRTU_MASTER_ADDRESSING_MODE_JBUS = 1

var MODBUSRTU_MASTER_ADDRESSING_MODE = MODBUSRTU_MASTER_ADDRESSING_MODE_MODBUS
var MODBUSRTU_MASTER_DYNAMIC_ALLOCATION_LEV2 = true
var MODBUSRTU_MASTER_SWAP_SUPPORTED = true
var MODBUSRTU_MASTER_INCREMENTAL_MSG_CONFIGURATION = true
var MODBUSRTU_MASTER_ONESHOT_SUPPORTED = true
var MODBUSRTU_MASTER_EXTERNALDISABLE = "";
var MODBUSRTU_MASTER_DYNAMICSLAVEADDRESS_SUPPORTED = true
var MODBUSRTU_MASTER_INPUTOUTPUTCMD_SUPPORTED = true
// modalità alternativa di gestione slaves: viene creata una istanza di struttura per ogni slave, non ci sono var mappate
var MODBUSRTU_MASTER_STRUCT_SLAVES = false;

//	Architetture supportate (AlModbusRTU_target.js)
var MODBUSRTU_MASTER_TARGET_x86	= 1
var MODBUSRTU_MASTER_TARGET_ARM	= 2	//	TODO

//	In base all'architettura cambia come vengono allocate le strutture
var MODBUSRTU_MASTER_TARGET_ARCHITECTURE = MODBUSRTU_MASTER_TARGET_ARM

//	Define per AddApplicationDB
var MODBUSRTU_NETLIST_DB_INDEX = "60011"
var MODBUSRTU_NETLIST_DB_TYPE = 'I'
var MODBUSRTU_NETLIST_DB_ELEMTYPE = 'B'

var MODBUSRTU_RO_MODE = 1
var MODBUSRTU_WO_MODE = 2
var MODBUSRTU_RW_MODE = 3

// se true, sysMbMRtuNetList è allocata su datablock applicativo (preferibile in quanto in questo modo diventa readonly) altrimenti come var automatica
// si potrà rimettere true una volta risolti i problemi di riallocazione di db applicativi presenti su LogicLab...
var MODBUSRTU_USE_APPLICATION_DB = false

var MODBUSRTU_SYSMBMRTUNETLIST_BASENAME = "sysMbMRtuNetList"
var MODBUSRTU_SYSMBMRTUNETLIST_TYPENAME = "MbMRtuNetList"

/*	Eventualmente ridefinisce i default specificati qui sopra */

#include ../AlModbusRTU_settings.js

////////////////////////////////////////////////////////////////////////////////////////////////////

/*	Se la configurazione è supportata il resto non dovrebbe essere modificato! */

//	File con la definizione delle size e delle caratteristiche delle diverse architetture supportate
#include AlModbusRTU_target.js

//	struttura di configurazione in base a CANOPEN_MASTER_TARGET_ARCHITECTURE settata
var MODBUSRTU_MASTER_CONST = {}

var MODBUSRTU_MASTER_ADDRESS_MIN = ( MODBUSRTU_MASTER_ADDRESSING_MODE == MODBUSRTU_MASTER_ADDRESSING_MODE_MODBUS ) ? 1 : 0
var MODBUSRTU_MASTER_ADDRESS_MAX = ( MODBUSRTU_MASTER_ADDRESSING_MODE == MODBUSRTU_MASTER_ADDRESSING_MODE_MODBUS ) ? 65536 : 65535

var RS485_MODE_OFF = 0
var RS485_MODE_MASTER = 1
var RS485_MODE_SLAVE = 2

var RSMODE_AUTO = 0	//	not specified
var RSMODE_RS485 = 1
var RSMODE_RS422 = 2
var RSMODE_RS232 = 3

var m_SerialModeIndex = { 	"none,8,1" : "MbMode_8N1", 
							"even,8,1" : "MbMode_8E1", 
							"odd,8,1" : "MbMode_8O1", 
							"space,8,1" : "MbMode_8S1", 
							"mark,8,1" : "MbMode_8M1",
							"none,8,2" : "MbMode_8N2", 	
							"even,8,2" : "MbMode_8E2", 
							"odd,8,2" : "MbMode_8O2", 
							"space,8,2" : "MbMode_8S2", 
							"mark,8,2" : "MbMode_8M2"}
							
var m_InpOutStartupCmdMode = {	0 : "MbInpOutCmdMode_Read",
								1 : "MbInpOutCmdMode_Write" }

//  SerCfg serial configuration mode
//  Serial is configured with parameters read from database
var SERCFG_BY_DATABASE      = 0;
//  Serial is configured with open channel function parameters (by PLC code, default)
var SERCFG_BY_FUNCTION_CALL = 1;

var MODBUSFUNC =  {
	READCOIL: 1,
	READINPUTSTATUS: 2,
	READHOLDINGREG: 3,
	READINPUTREG: 4,
	WRITESINGLECOIL: 5,
	WRITESINGLEREG: 6,
	WRITEMULTIPLECOILS: 15,
	WRITEMULTIPLEREGS: 16
};

var MBMRTUNETLIST_ARRAY_UPPER_BOUND_NAME 	= "MBMRTUNETLISTBOUND"
var MBMRTUNETLIST_ARRAY_COUNT_NAME 			= "MBMRTUNETLISTCOUNT"

function AlModbusRTU_HasJbusAddressingMode()
{
	return MODBUSRTU_MASTER_ADDRESSING_MODE == MODBUSRTU_MASTER_ADDRESSING_MODE_JBUS
}

function AlModbusRTU_HasModbusAddressingMode()
{
	return MODBUSRTU_MASTER_ADDRESSING_MODE == MODBUSRTU_MASTER_ADDRESSING_MODE_MODBUS
}

// ---------------------------------------------------------- GESTIONE MODBUS RTU ---------------------------------------------------

// validazione configurazione per tutte le porte RS485 e RS232
function Validate_RS485(device, mappedVars, modbusSlaveCfg)
{	
	// estrae elenco di porte RS485 per ModbusMaster
	var portList = device.selectNodes("RS485 | RS232" )
	var port
	var masterPortList = []
	while (port = portList.nextNode())
	{
		var mode = parseInt(port.getAttribute("mode"))		
		
		if (mode == RS485_MODE_MASTER)
		{
			masterPortList.push( port )
		}
	}
	
	if ( masterPortList.length > 0 )
	{
		// valida configurazione per ModbusRTU master
		var result
		result = Validate_ModbusRTUMaster(device, masterPortList, mappedVars)
		if (result != enuLogLevels.LEV_OK)
			return result
	}
	
	return enuLogLevels.LEV_OK
}

// generazione configurazione per tutte le porte RS485 e RS232
function BuildCfg_RS485(device, mappedVars, modbusSlaveCfg)
{
	if (MODBUSRTU_MASTER_DYNAMIC_ALLOCATION_LEV2 && MODBUSRTU_USE_APPLICATION_DB)
		//	rimuovo il datablock applicativo su cui viene messa la diagnostica della rete ModbusRTU master
		app.CallFunction( "logiclab.RemoveApplicationDB", MODBUSRTU_NETLIST_DB_INDEX, MODBUSRTU_NETLIST_DB_TYPE )
	
	var alreadyMaster = false;
	
	// estrae elenco di porte RS485 per ModbusMaster
	var portList = device.selectNodes("RS485 | RS232" )
	var port
	var masterPortList = []
	var masterNetworksUsed = {}
	var content = ""
	while (port = portList.nextNode())
	{
		var mode = parseInt(port.getAttribute("mode"))		
		var network = parseInt(port.getAttribute("masterNetId"));
		
		masterNetworksUsed[network] = false
		
		if (mode == RS485_MODE_MASTER)
		{
			masterPortList.push( port )
			masterNetworksUsed[network] = true
		}
		else if(mode == RS485_MODE_SLAVE)
		{
			// restituisce in output il nodo xml della porta con la cfg
			modbusSlaveCfg.RTUport = port
			content += "(* Automatically generated code, do not edit! *)\n\n"
			content += "	(* MODBUS SLAVE CONFIGURATION *)\n"
			content += BuildCfg_ModbusRTUSlave(device, port)
		}
	}
	
	if ( masterPortList.length > 0 )
	{
		// generazione configurazione per ModbusRTU master
		content += "(* Automatically generated code, do not edit! *)\n\n"
		content += "	(* MODBUS MASTER CONFIGURATION *)\n"
		content += BuildCfg_ModbusRTUMaster(device, masterPortList, mappedVars)
	}
	
	// genero sempre un array unitario per le reti non configurate
	for (var network in masterNetworksUsed)
	{
		if (!masterNetworksUsed[network])
		{
			var networkId = parseInt(network)
			var sysMbMRtuNetListVarName = MODBUSRTU_SYSMBMRTUNETLIST_BASENAME + (networkId > 0 ? networkId : "");
			var diagnoVar = GenerateDianosticVarsModbus(parseInt(network), sysMbMRtuNetListVarName, 0, 0)
			content += "\n\tVAR_GLOBAL \n" + diagnoVar.globalVarCode + "\tEND_VAR\n\n";
			content += "\n\tVAR_GLOBAL CONSTANT\n" + diagnoVar.globalConstCode + "\tEND_VAR\n\n";
		}
	}
	
	// estrae elenco di porte RS485 per ModbusSlave
	var portList = device.selectNodes("RS485_MBS")
	var port
	while (port = portList.nextNode())
	{
		var mode = parseInt(port.getAttribute("mode"))		
				
		if (mode == RS485_MODE_SLAVE)
		{
			// restituisce in output il nodo xml della porta con la cfg
			modbusSlaveCfg.RTUport = port
			content += "(* Automatically generated code, do not edit! *)\n\n"
			content += "	(* MODBUS SLAVE CONFIGURATION *)\n"
			content += BuildCfg_ModbusRTUSlave(device, port)
		}
	}
				
	//	inserimento sorgente ausiliario nel progetto PLC
	var filename = "Modbus_cfg.plc"
	if (content === null)
		// errore di generazione
		throw enuLogLevels.LEV_CRITICAL
	else if (content === "")
		// nessun codice generato, rimuove il codice aux eventualmente presente
		app.CallFunction( "compiler.LogicLab_RemovePLC", app.CallFunction("logiclab.get_ProjectPath"), filename )
	else
	{
		app.CallFunction( "compiler.LogicLab_UpdatePLC", app.CallFunction("logiclab.get_ProjectPath"), filename, content )
	}
	
	return true
}

/*  chiede ad ogni slave tramite la funzione GetModbusRTUCfg un oggetto cos? strutturato:
{
	modbusAddress (int)
	IPAddress (string)
	minPollTime (int)
	swapWordsMode (int)
	
	params
	[
		{
			addr (int)
			type (string)
			value (float)
			tmo (int)
			node (object)
		}
	]
	
	images
	[
		{
			pollTime (int)
			turnAround (int)
			tmo (int)
			oneshot (string)
			funcode (int)
			addr (int)
			size (int)
			
			vars
			[
				{
					addr (int)
					size (int)
					db (string)
					dbt (string)
					label (string)
					pos (int)
					node (object)
				}
			]
		}
	]
}    */

var MODBUS_MASTER_RTU = "modbus_rtu"

function Validate_SingleModbusMaster(device, port, mappedVars)
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
	
	var FUNCNAME = "Validate_SingleModbusMaster"
	
	if (!MODBUSRTU_MASTER_SWAP_SUPPORTED)
		return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, "SWAP MUST BE SUPPORTED!");
		
	var usedModbusAddresses = {}
	
	var slaves = port.selectNodes("*[@insertable]")
	var slave
		
	while (slave = slaves.nextNode())
	{
		var extname = slave.getAttribute("ExtensionName")
		if (!extname)
			continue   // slave senza estensione definita?
		
		var enabled = genfuncs.ParseBoolean( slave.getAttribute("enabled") )
		if (!enabled)
			continue	// disabilitato
			
		// richiesta struttura per ModbusRTU allo slave tramite funzione apposita
		// NB: anche se nel nome compare 'RTU' i dati sono gli stessi anche per il TCP!
		var cfg = app.CallFunction(extname + ".GetModbusRTUCfg", slave, MODBUSRTU_MASTER_ADDRESSING_MODE, MODBUSRTU_MASTER_STRUCT_SLAVES);

		if (!cfg)
		{
			var err = app.CallFunction("common.SplitFieldPath", slave)
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, app.Translate("Invalid Modbus data"), err)
		}
		
			//	definizione modalita  di configurazione indirizzo slave
		var SLAVEADDRESSCONFIGMODE = app.CallFunction(extname + ".GetSlaveAddressConfigMode");
		
		if (cfg.slaveAddressConfigMode == SLAVEADDRESSCONFIGMODE.STATIC)
		{
			var errModbusAddress = app.CallFunction("common.SplitFieldPath", slave.selectSingleNode("*/modbusAddress"))
					
			// -1 per modbusAddress e' valore speciale per identificare broadcast
			if (cfg.modbusAddress != -1)
			{
				// verifica validita' modbusAddress 1..247
				if (! (cfg.modbusAddress >= 1 && cfg.modbusAddress <= 247))
				{
					var msg = genfuncs.FormatMsg(app.Translate("Invalid Modbus RTU address: %1 (must be in 1..247)"), cfg.modbusAddress)
					return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
				}
			
				var addressKey = cfg.modbusAddress
			
				// verifica univocita' indirizzo modbus (rtu o tcp)
				if (usedModbusAddresses[addressKey] != undefined)
				{
					var msg = genfuncs.FormatMsg(app.Translate("Duplicate Modbus address: %1"), addressKey)
					return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
				}
				else
					usedModbusAddresses[addressKey] = true
			}
		}
		else
		{
			var errModbusAddress = app.CallFunction("common.SplitFieldPath", slave.selectSingleNode("*/dynamicSlaveAddress"))
			
			// verifica validita' modbusAddress 1..247
			if (cfg.dynamicSlaveAddress == "")
			{
				var msg = genfuncs.FormatMsg(app.Translate("Modbus RTU address not specified"), cfg.dynamicSlaveAddress)
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
			}
			
			var addressKey = cfg.slaveAddressConfigMode + "," + cfg.dynamicSlaveAddress
			
			// verifica univocita' indirizzo modbus (rtu o tcp)
			if (usedModbusAddresses[addressKey] != undefined)
			{
				var msg = genfuncs.FormatMsg(app.Translate("Duplicate Modbus address: %1"), addressKey)
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
			}
			else
				usedModbusAddresses[addressKey] = true
			
			//	this function must be specified in custom porting
			if (!CustomValidate_ModbusRTUSlaveAddress(device, cfg.slaveAddressConfigMode, cfg.dynamicSlaveAddress))
			{
				var msg = genfuncs.FormatMsg(app.Translate("Invalid Modbus RTU address: %1"), cfg.dynamicSlaveAddress)
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
			}
		}
		
		var fieldNamesMap = {}
		
		// iterazione sulla lista dei messaggi
		for (var i = 0; i < cfg.images.length; i++)
		{
			var msg = cfg.images[i]
			
			if (msg.vars.length != 0)
				var errnode = msg.vars[0].node
			else
				var errnode = null
				
			if ((msg.vars.length == 0 || msg.vars[0].label == "") && !MODBUSRTU_MASTER_STRUCT_SLAVES)
			{
				var errmsg = app.Translate("Invalid or missing field variabile in Modbus message")
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", errnode))
			}
			
			if (msg.funcode == undefined || msg.funcode == null)
			{
				var errmsg = app.Translate("Invalid Modbus function code")
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", errnode))
			}
			
			// partendo dalla funzione modbus ricava la direzione (input/output) e il tipo (bit/word)
			var block = app.CallFunction("parameters.GetModbusFuncIODirection", msg.funcode)
			
			if (block == "inputoutput")
			{
				var errmsg = genfuncs.FormatMsg(app.Translate("Not supported by Modbus RTU configurator"))
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", errnode))
			}
			else
			{
				// funzione semplice di lettura o scrittura singola
				if (! (msg.addr >= MODBUSRTU_MASTER_ADDRESS_MIN && msg.addr <= MODBUSRTU_MASTER_ADDRESS_MAX))
				{
					// tutti i valori sono relativi all'indirizzamento del master: per il msg li riporta in quello dello slave (se info presente)
					var offs = (cfg.addressType !== undefined) ? (MODBUSRTU_MASTER_ADDRESSING_MODE - cfg.addressType) : 0;
					var errmsg = genfuncs.FormatMsg(app.Translate("Invalid Modbus start address (must be %1..%2): %3"), MODBUSRTU_MASTER_ADDRESS_MIN+offs, MODBUSRTU_MASTER_ADDRESS_MAX+offs, msg.addr+offs)
					return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", errnode))
				}
			}
			
			if ( MODBUSRTU_MASTER_ONESHOT_SUPPORTED )
			{
				if( msg.oneshot )
				{
					var isComplex = app.CallFunction("script.IsComplexVar", msg.oneshot)
					if (isComplex)
					{
						var msg = genfuncs.FormatMsg(app.Translate("The variable %1 is part of a complex variable and cannot be assigned"), msg.oneshot )
						return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, app.CallFunction("common.SplitFieldPath", errnode))
					}
				
					var OneShotVar = mappedVars[msg.oneshot];
					if (!OneShotVar)
					{
						var msg = genfuncs.FormatMsg(app.Translate("The variable %1 does not exist, or it is not mapped on a datablock"), msg.oneshot )
						return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, app.CallFunction("common.SplitFieldPath", errnode))
					}
				}
			}
		
			// iterazione sulla lista delle variabili di questo messaggio
			for (var v = 0, totv = msg.vars.length; v < totv; v++)
			{
				var curVar = msg.vars[v]
							
				if (!curVar.label && !MODBUSRTU_MASTER_STRUCT_SLAVES)
				{
					// la variabile deve essere per forza mappata
					var errmsg = genfuncs.FormatMsg(app.Translate("No variable mapped for address %1"), curVar.addr)
					return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
				}
				
				if (curVar.addr < msg.addr || curVar.addr + curVar.size > msg.addr + msg.size)
				{
					// indirizzo o dimensione della variabile fuori dal messaggio
					var errmsg = genfuncs.FormatMsg(app.Translate("Invalid address or size specified: %1, %2"), curVar.addr, curVar.size)
					return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
				}
				
				if (!MODBUSRTU_MASTER_STRUCT_SLAVES)
				{
					var PLCvar = mappedVars[curVar.label]
					if (!PLCvar)
					{
						// variabile PLC cancellata
						var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has been deleted or changed to 'Auto' allocation"), curVar.label)
						return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
					}
					else if (PLCvar.type != curVar.dbt)
					{
						// variabile PLC modificata nel tipo
						var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has been modified in type"), curVar.label)
						return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
					}
				}
				else
				{
					var ris
					ris = CheckUniqueFieldName(curVar, fieldNamesMap)
					if (ris.isDuplicated)
					{
						// fieldName già presente
						var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Field '%1' already defined"), ris.fieldName)
						return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
					}
				}
			}  // for curVar
		} // for msg
		
		// parametri di configurazione
		for (var i = 0; i < cfg.params.length; i++)
		{
			var param = cfg.params[i]
			
			if (isNaN(param.addr) || !param.type || isNaN(param.value) || isNaN(param.tmo))
			{
				var errmsg = genfuncs.FormatMsg(app.Translate("Invalid parametrization record"))
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", param.node))
			}
		}
	}

	return enuLogLevels.LEV_OK;
}

function Validate_ModbusRTUMaster(device, masterPortList, mappedVars)
{
	var typesCode = "";
	var globalVarCode = "";
	var code = "";
	var result = enuLogLevels.LEV_OK
	
	for ( var portItem = 0; portItem < masterPortList.length; portItem++ )
	{
		var port = masterPortList[portItem]
		var network = parseInt(port.getAttribute("masterNetId"));
		result = Validate_SingleModbusMaster(device, port, mappedVars);
		if ( result != enuLogLevels.LEV_OK)
			break;
	}
	
	return result
}

// generazione configurazione RS485 e RS232 Modbus RTU Master (field)
function BuildCfg_ModbusRTUMaster(device, masterPortList, mappedVars)
{
	if ( MODBUSRTU_MASTER_TARGET_ARCHITECTURE == MODBUSRTU_MASTER_TARGET_x86 )
	{
		MODBUSRTU_MASTER_CONST.SIZEOF_MSG_QUEUE = m_ModbusRTUMasterConst.x86.SIZEOF_MSG_QUEUE
		MODBUSRTU_MASTER_CONST.SIZEOF_NETLIST = m_ModbusRTUMasterConst.x86.SIZEOF_NETLIST
	}
	else if ( MODBUSRTU_MASTER_TARGET_ARCHITECTURE == MODBUSRTU_MASTER_TARGET_ARM )
	{
		MODBUSRTU_MASTER_CONST.SIZEOF_MSG_QUEUE = m_ModbusRTUMasterConst.ARM.SIZEOF_MSG_QUEUE
		MODBUSRTU_MASTER_CONST.SIZEOF_NETLIST = m_ModbusRTUMasterConst.ARM.SIZEOF_NETLIST
	}
	else
	{
		debugger
		/*	TODO */
	}
	
	var typesCode = "";
	var globalVarCode = "";
	var code = "";
	var globalConstCode = "";
	
	for ( var portItem = 0; portItem < masterPortList.length; portItem++ )
	{
		var port = masterPortList[portItem]
		var network = parseInt(port.getAttribute("masterNetId"));
		var result = BuildCfg_SingleModbusMaster(device, port, mappedVars);
	
		if ( MODBUSRTU_MASTER_DYNAMIC_ALLOCATION_LEV2 && ( result.pduTxBufferInfo.length > 0 || result.totSlaves > 0 || result.totMsg > 0 ) )
		{		
			if ( result.totSlaves > 0 )
			{
				if (MODBUSRTU_USE_APPLICATION_DB)
				{
					//	Add application DB for network diagnostic		
					var dbSize = result.totSlaves * MODBUSRTU_MASTER_CONST.SIZEOF_NETLIST
					var dbOK = app.CallFunction( "logiclab.AddApplicationDB", MODBUSRTU_NETLIST_DB_INDEX, MODBUSRTU_NETLIST_DB_TYPE, MODBUSRTU_NETLIST_DB_ELEMTYPE, dbSize, MODBUSRTU_RO_MODE )	
					if( ! dbOK )
					{
						var errmsg = genfuncs.FormatMsg(app.Translate("Cannot add application datablock %%1%2%3 for %4 diagno"), MODBUSRTU_NETLIST_DB_TYPE, MODBUSRTU_NETLIST_DB_ELEMTYPE, MODBUSRTU_NETLIST_DB_INDEX, MODBUSRTU_SYSMBMRTUNETLIST_BASENAME)
						return false
					}
				}
			}
			
			//	alloco array di byte per coda messaggi
			if ( result.totMsg > 0 )
				globalVarCode += "		$$mbm" + network + "_msg_queue : ARRAY [ 0.." + (result.totMsg * MODBUSRTU_MASTER_CONST.SIZEOF_MSG_QUEUE - 1) + " ] OF BYTE; {HIDDEN:ON}\n"
			
			//	alloco struttura per gestione input output messages
			if ( result.totInpOutMsg > 0 )
				globalVarCode += "		$$mbm" + network + "_msg_inpout : ARRAY [ 0.." + (result.totInpOutMsg - 1) + " ] OF MbInpOutCmdStruct; {HIDDEN:ON}\n"
			
			for ( var i = 0; i < result.pduTxBufferInfo.length; i++ )
				globalVarCode += "		" + result.pduTxBufferInfo[ i ].name + " : ARRAY [ 0.." + ( result.pduTxBufferInfo[ i ].size - 1 ) + " ] OF BYTE; {HIDDEN:ON}\n"
		}
		else if ( !MODBUSRTU_MASTER_DYNAMIC_ALLOCATION_LEV2 && result.pduTxBufferInfo.length > 0 )
		{		
			for ( var i = 0; i < result.pduTxBufferInfo.length; i++ )
				globalVarCode += "		" + result.pduTxBufferInfo[ i ].name + " : ARRAY [ 0.." + ( result.pduTxBufferInfo[ i ].size - 1 ) + " ] OF BYTE; {HIDDEN:ON}\n"
		}
		
		// genero sempre l'array (anche unitario) di diagnostica e relative costanti
		var arrayBound = result.totSlaves - 1
		if(arrayBound == -1)
			arrayBound = 0;
		
		var loc = MODBUSRTU_USE_APPLICATION_DB ? ("AT %" + MODBUSRTU_NETLIST_DB_TYPE + MODBUSRTU_NETLIST_DB_ELEMTYPE + MODBUSRTU_NETLIST_DB_INDEX + ".0 "): "";
		var diagnoVar = GenerateDianosticVarsModbus(network, result.sysMbMRtuNetListVarName + " " + loc, arrayBound, result.totSlaves)
		globalVarCode += diagnoVar.globalVarCode;
		globalConstCode += diagnoVar.globalConstCode;
		
		var programName = "MbMBoot_" + network
		code +=	"	PROGRAM " + programName + " WITH MbBoot;\n\
	PROGRAM " + programName + "\n\
	{ HIDDEN:ON }\n\n\
	VAR\n\
		ris_return : BOOL;\n\
		chn_return : USINT;\n\
		slave_return : USINT;\n\
		slaveBool_return : BOOL;\n\
		memory_return : BOOL;\n\
		slave_address : USINT;\n\
		dynamicSlaveAddressKeyU16 : UINT;\n\
		dynamicSlaveAddressKeyU32 : UDINT;\n\
	END_VAR\n\n"
	
		code += result.declarations;
	
		code +="\t{ CODE:ST }\n"
		
		code += result.initDiagCode
		code += "\n"
	
		// verifica condizione esterna di abilitazione del master. se disabilitato parte invece come slave
		if (MODBUSRTU_MASTER_EXTERNALDISABLE != "")
		{
			code += "IF " + MODBUSRTU_MASTER_EXTERNALDISABLE + " THEN\n" + 
					GenerateModbusRTUSlaveCode(port) +
					"\tRETURN;\n" + 
					"END_IF;\n";
		}
		
		if ( MODBUSRTU_MASTER_DYNAMIC_ALLOCATION_LEV2 )
		{
			var pMbMNetList
			if ( result.totSlaves > 0 )
				pMbMNetList = "TO_DWORD(ADR(" + result.sysMbMRtuNetListVarName + "[0]))"
			else
				pMbMNetList = "0"
			
			var pMbMMsgQueue;
			if ( result.totMsg > 0 )
				pMbMMsgQueue = "TO_DWORD(ADR($$mbm" + network + "_msg_queue[0]))"
			else
				pMbMMsgQueue = "0"
			
			var memoryAllocated = result.totSlaves * MODBUSRTU_MASTER_CONST.SIZEOF_NETLIST + result.totMsg * MODBUSRTU_MASTER_CONST.SIZEOF_MSG_QUEUE  
			
			code += "	memory_return := sysMbMRtu_MemoryMapping2( " + network + ", " + pMbMNetList + ", " + result.totSlaves + ", " + pMbMMsgQueue + ", " + result.totMsg + ", " + memoryAllocated + ");\n"
			
			//	check result and abort in case of error
			code += "	IF NOT memory_return THEN\n"
			code += "		RETURN;\n"
			code += "	END_IF;\n"
			code += "\n"
		}
	
		var serCfg = port.getAttribute("serCfg");
		var serCfgMaster = port.getAttribute("serCfgMaster");
		if (!serCfgMaster)
			serCfgMaster = serCfg;
		
		var params = [ network ];
		params.push( port.getAttribute("netId") )
		if (serCfgMaster == SERCFG_BY_FUNCTION_CALL)
		{
			var serialMode = port.getAttribute("serialMode").split(",")	
			params.push("MbBaudrate#MbBaud_" + port.getAttribute("baudRate"), "MbMode#" + m_SerialModeIndex[serialMode]);
		}
		else
			params.push("MbBaudrate#MbBaud_Auto, MbMode#MbMode_Auto");
		
		params.push(serCfgMaster, port.getAttribute("COMnumber"));
		
		if (genfuncs.ParseBoolean(port.getAttribute("rsmodeEditable")))
			params.push(port.getAttribute("rsmode"));
		else
			params.push(RSMODE_AUTO);
		
		code += "	chn_return := sysMbMRtu_OpenChn3( " + params.join(", ") + ");\n"
		
		//	check result and abort in case of error
		code += "	IF chn_return = 16#FF THEN\n\
		RETURN;\n\
	END_IF;\n\n"
		
		typesCode += result.typesCode;
		globalVarCode += result.globalVarCode;
		code += result.masterCode;
		
		var msg = app.Translate("%1: created Modbus RTU configuration (%2 devices, %3 messages, %4 variables)")
		app.PrintMessage(genfuncs.FormatMsg(msg, device.getAttribute("caption"), result.totSlaves, result.totMsg, result.totVars))
	}	
	
	var resultCode = "";
	if ( typesCode != "" )
		resultCode += "TYPE\n" + typesCode + "END_TYPE\n\n";
	if ( globalVarCode != "" )
		resultCode += "\n\tVAR_GLOBAL\n" + globalVarCode + "\tEND_VAR\n\n";	
	if ( globalConstCode != "" )
		resultCode += "\n\tVAR_GLOBAL CONSTANT\n" + globalConstCode + "\tEND_VAR\n\n";
	
	resultCode += code;
	return resultCode;
}

// generazione configurazione RS485 e RS232 Modbus RTU Slave (field)
function BuildCfg_ModbusRTUSlave(device, port)
{
	var programName = "$$MbSBoot_" + port.getAttribute("netId")
	var code = "\n\
	PROGRAM " + programName + " WITH MbBoot;\n\
	PROGRAM " + programName + "\n\
	{ HIDDEN:ON }\n\n\
	VAR\n\
		ris_return : BOOL;\n\
		chn_return : USINT;\n\
	END_VAR\n\n\
	{ CODE:ST }\n"
	
	code += GenerateModbusRTUSlaveCode(port);
	code += "\n	END_PROGRAM\n\n"	
			
	var msg = app.Translate("%1: created Modbus RTU device configuration")
	app.PrintMessage(genfuncs.FormatMsg(msg, device.getAttribute("caption")))
	return code
}

function GenerateModbusRTUSlaveCode(port)
{
	var serCfg = port.getAttribute("serCfg");
	var serCfgSlave = port.getAttribute("serCfgSlave");
	if (!serCfgSlave)
		serCfgSlave = serCfg;

	var serialMode = port.getAttribute("serialMode").split(",")
	var slaveAddress = parseInt(port.getAttribute("slaveAddress"))
	
	var params = [slaveAddress, port.getAttribute("netId")];
	if (serCfgSlave == SERCFG_BY_FUNCTION_CALL)
		params.push("MbBaudrate#MbBaud_" + port.getAttribute("baudRate"), "MbMode#" + m_SerialModeIndex[serialMode]);
	else
		params.push("MbBaudrate#MbBaud_Auto", "MbMode#MbMode_Auto");
	
	params.push(serCfgSlave, port.getAttribute("COMnumber"), "FALSE");
	
	if (genfuncs.ParseBoolean(port.getAttribute("rsmodeEditable")))
		params.push(port.getAttribute("rsmode"));
	else
		params.push(RSMODE_AUTO);
	
	var code = "\tchn_return := sysMbSRtu_OpenChn2( " + params.join(", ") + ");\n";
	return code;
}


function BuildCfg_SingleModbusMaster(device, port, mappedVars)
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
	
	var FUNCNAME = "BuildCfg_SingleModbusMaster"
	
	if (!MODBUSRTU_MASTER_SWAP_SUPPORTED)
		throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, "SWAP MUST BE SUPPORTED!");
	
	var masterCode = ""
	var constantsDecl = "";
	var varsDecl = "";
	var typesCode = "";
	var globalVarCode = "";
	var initDiagCode = "";
	
	var usedModbusAddresses = {}
	
	var totSlaves = 0
	var totVars = 0
	var totMsg = 0
	var totInpOutMsg = 0
	var totModbusPduTxBuffer = 0
	var pduTxBufferInfo = []
	var slaves = port.selectNodes("*[@insertable]")
	var slave
	var m_DataBlockAreaIndex = { "M":0, "I":1, "Q":2 }
	var slaveCode = ""
	
	var network = port.getAttribute( "masterNetId" )
	var chn = port.getAttribute("netId")	//	open channel returns channel as handler
	var sysMbMRtuNetListVarName = MODBUSRTU_SYSMBMRTUNETLIST_BASENAME + (network > 0 ? network : "");
	
	var slaveAddressConfigModeEnum = { 	"0" : "MbSlaveAddressConfigMode_Static", 
										"1" : "MbSlaveAddressConfigMode_ByVariableAddress",
										"2" : "MbSlaveAddressConfigMode_By16BitKeyValue",
										"4" : "MbSlaveAddressConfigMode_By32BitKeyValue" }
	
	while (slave = slaves.nextNode())
	{
		var extname = slave.getAttribute("ExtensionName")
		if (!extname)
			continue   // slave senza estensione definita?
		
		var enabled = genfuncs.ParseBoolean( slave.getAttribute("enabled") )
		if (!enabled)
			continue	// disabilitato
			
		// richiesta struttura per ModbusRTU allo slave tramite funzione apposita
		// NB: anche se nel nome compare 'RTU' i dati sono gli stessi anche per il TCP!
		var cfg = app.CallFunction(extname + ".GetModbusRTUCfg", slave, MODBUSRTU_MASTER_ADDRESSING_MODE, MODBUSRTU_MASTER_STRUCT_SLAVES);

		if (!cfg)
		{
			var err = app.CallFunction("common.SplitFieldPath", slave)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, app.Translate("Invalid Modbus data"), err)
		}
		
		//	definizione modalità di configurazione indirizzo slave
		var SLAVEADDRESSCONFIGMODE = app.CallFunction(extname + ".GetSlaveAddressConfigMode");
		
		// -1 per modbusAddress e' valore speciale per identificare broadcast
		var isBroadcast = (cfg.modbusAddress == -1)
		
		var errModbusAddress = app.CallFunction("common.SplitFieldPath", slave.selectSingleNode("*/modbusAddress"))

		if (cfg.slaveAddressConfigMode == SLAVEADDRESSCONFIGMODE.STATIC)
		{
			if (!isBroadcast)
			{
				// verifica validita' modbusAddress 1..247
				if (! (cfg.modbusAddress >= 1 && cfg.modbusAddress <= 247))
				{
					var msg = genfuncs.FormatMsg(app.Translate("Invalid Modbus RTU address: %1 (must be in 1..247)"), cfg.modbusAddress)
					throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
				}
				
				var addressKey = cfg.modbusAddress
				
				// verifica univocit? indirizzo modbus (rtu o tcp)
				if (usedModbusAddresses[addressKey] != undefined)
				{
					var msg = genfuncs.FormatMsg(app.Translate("Duplicate Modbus address: %1"), addressKey)
					throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
				}
				else
					usedModbusAddresses[addressKey] = true
				
				masterCode += "\n\t(* Slave address configured statically *)\n"
				masterCode += "\tslave_address := " + cfg.modbusAddress + ";\n"
			}
		}
		else if (!MODBUSRTU_MASTER_DYNAMICSLAVEADDRESS_SUPPORTED)
		{
			var msg = genfuncs.FormatMsg(app.Translate("Dynamic addressing not supported: %1"), addressKey)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
		}
		else
		{
			var keyComment
			var keyValue
			var setKeyValue = ""
			switch (cfg.slaveAddressConfigMode)
			{
			case SLAVEADDRESSCONFIGMODE.BY_VARIABLE_NAME:
				keyComment = "\n\t(* Slave address configured by variable *)\n"
				keyValue = "ADR(" + cfg.dynamicSlaveAddress + ")"
				break;
			case SLAVEADDRESSCONFIGMODE.BY_16BIT_KEY:
				keyComment = "\n\t(* Slave address configured by 16bit identifier *)\n"
				setKeyValue = "\tdynamicSlaveAddressKeyU16 := " + cfg.dynamicSlaveAddress + ";\n"
				keyValue = "ADR(dynamicSlaveAddressKeyU16)"
				break;
			case SLAVEADDRESSCONFIGMODE.BY_32BIT_KEY:
				keyComment = "\n\t(* Slave address configured by 32bit identifier *)\n"
				setKeyValue = "\tdynamicSlaveAddressKeyU32 := " + cfg.dynamicSlaveAddress + ";\n"
				keyValue = "ADR(dynamicSlaveAddressKeyU32)"
				break;
			default:
				var msg = genfuncs.FormatMsg(app.Translate("Specified dynamic addressing mode not specified"))
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errModbusAddress)
				break;
			}

			masterCode += keyComment
			if (setKeyValue != "")
				masterCode += setKeyValue
			masterCode += "\tslaveBool_return := sysMbMRtu_SlaveGetDynamicAddr(chn_return, ADR(slave_address), " + (slaveAddressConfigModeEnum[cfg.slaveAddressConfigMode]) + ", " + keyValue + ");\n"
			masterCode += "\tIF NOT slaveBool_return THEN\n"
			masterCode += "\t\tRETURN;\n"
			masterCode += "\tEND_IF;\n"
		}
		masterCode += "\tslave_return := sysMbMRtu_SlaveAddToNetList2(chn_return, slave_address, "+cfg.minPollTime+", "+cfg.params.length+", "+cfg.swapWordsMode+");\n"
		masterCode += "\tIF slave_return = 255 THEN\n"
		masterCode += "\t\tRETURN;\n"
		masterCode += "\tEND_IF;\n"

		var instanceName;
		var structName;
		var fieldNamesMap = {};
		if (MODBUSRTU_MASTER_STRUCT_SLAVES)
		{
			instanceName = app.CallFunction("common.NormalizeName", slave.getAttribute("caption"));
			structName = instanceName + "_STRUCT";
			typesCode += "\t" + structName + " : STRUCT\n";
		}
		
		// iterazione sulla lista dei messaggi
		for (var i = 0; i < cfg.images.length; i++)
		{
			var msg = cfg.images[i]
			
			if (msg.vars.length != 0)
				var errnode = msg.vars[0].node
			else
				var errnode = null
				
			if ((msg.vars.length == 0 || msg.vars[0].label == "") && !MODBUSRTU_MASTER_STRUCT_SLAVES)
			{
				var errmsg = app.Translate("Invalid or missing field variabile in Modbus message")
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", errnode))
			}
			
			if (msg.funcode == undefined || msg.funcode == null)
			{
				var errmsg = app.Translate("Invalid Modbus function code")
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", errnode))
			}
			
			// partendo dalla funzione modbus ricava la direzione (input/output) e il tipo (bit/word)
			var block = app.CallFunction("parameters.GetModbusFuncIODirection", msg.funcode)
			var modbusType = app.CallFunction("parameters.IsModbusBitFunc", msg.funcode) ? "bit" : "word"
			var regTypesInfoName = "msg_reg_types_info_" + totMsg;
			var regTypesInfoMap = {}
			var oneShotMsg = ""
			var inputOutputMsg = ""
			var dbElemsArrName = "dbElemsArr_" + totMsg;
			var dbElemsArr = [];
			var dbAddrArrName = "dbAddrArr_" + totMsg;
			var fieldAdrNames = [];
			
			if (block == "inputoutput")
			{
				var errmsg = genfuncs.FormatMsg(app.Translate("Not supported by Modbus RTU configurator"))
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", errnode))
			}
			else
			{
				// funzione semplice di lettura o scrittura singola
				if (! (msg.addr >= MODBUSRTU_MASTER_ADDRESS_MIN && msg.addr <= MODBUSRTU_MASTER_ADDRESS_MAX))
				{
					// tutti i valori sono relativi all'indirizzamento del master: per il msg li riporta in quello dello slave (se info presente)
					var offs = (cfg.addressType !== undefined) ? (MODBUSRTU_MASTER_ADDRESSING_MODE - cfg.addressType) : 0;
					var errmsg = genfuncs.FormatMsg(app.Translate("Invalid Modbus start address (must be %1..%2): %3"), MODBUSRTU_MASTER_ADDRESS_MIN+offs, MODBUSRTU_MASTER_ADDRESS_MAX+offs, msg.addr+offs)
					throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", errnode))
				}
			}
			
			if ( MODBUSRTU_MASTER_INPUTOUTPUTCMD_SUPPORTED )
			{
				if( msg.isInOut )
				{					
					var startupCmd = m_InpOutStartupCmdMode[ msg.writeFirst ]
					var inpOutCmdStructName = "$$mbm" + network + "_msg_inpout[" + totInpOutMsg + "]"
					inputOutputMsg = "\t\t" + inpOutCmdStructName + ".StartupCmd := " + startupCmd + ";\n"
					inputOutputMsg += "\t\tslaveBool_return := sysMbMRtu_SetCurMsgInpOutMode(chn_return, ADR(" + inpOutCmdStructName + "));\n"
					inputOutputMsg += "\t\tIF NOT slaveBool_return THEN\n"
					inputOutputMsg += "\t\t\tRETURN;\n"
					inputOutputMsg += "\t\tEND_IF;\n"
					totInpOutMsg++
				}
				else
				{
					inputOutputMsg = ""
				}
			}
			
			if ( MODBUSRTU_MASTER_ONESHOT_SUPPORTED )
			{
				if( msg.oneshot )
				{
					var isComplex = app.CallFunction("script.IsComplexVar", msg.oneshot)
					if (isComplex)
					{
						var msg = genfuncs.FormatMsg(app.Translate("The variable %1 is part of a complex variable and cannot be assigned"), msg.oneshot )
						throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, app.CallFunction("common.SplitFieldPath", errnode))
					}
				
					var OneShotVar = mappedVars[msg.oneshot];
					if (!OneShotVar)
					{
						var msg = genfuncs.FormatMsg(app.Translate("The variable %1 does not exist, or it is not mapped on a datablock"), msg.oneshot )
						throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, app.CallFunction("common.SplitFieldPath", errnode))
					}
					
					var oneshot_db = app.CallFunction("common.ParseDataBlock", OneShotVar.DataBlock)
					oneShotMsg = "\t\tslaveBool_return := sysMbMRtu_SetCurrMsgOneShotVar2(chn_return, " + oneshot_db.datablock + ", " + oneshot_db.offset + ", " + m_DataBlockAreaIndex[oneshot_db.area] + ");\n"
					oneShotMsg += "\t\tIF NOT slaveBool_return THEN\n"
					oneShotMsg += "\t\t\tRETURN;\n"
					oneShotMsg += "\t\tEND_IF;\n"
				}
				else
				{
					oneShotMsg = ""
				}
			}
		
			// iterazione sulla lista delle variabili di questo messaggio
			for (var v = 0, totv = msg.vars.length; v < totv; v++)
			{
				var curVar = msg.vars[v]
							
				if (!curVar.label && !MODBUSRTU_MASTER_STRUCT_SLAVES)
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
				
				var type;
				var typeSize;
				if (!MODBUSRTU_MASTER_STRUCT_SLAVES)
				{
					var PLCvar = mappedVars[curVar.label]
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
					
					if (PLCvar.type == "STRING")
					{
						typeSize = PLCvar.GetStrDimensions()
						typeSize = parseInt(typeSize.substr( 1, typeSize.length - 2 ))	//	remove "[" and "]"
						typeSize++	//	terminator
					}
					else
						typeSize = app.CallFunction("common.GetIECTypeSize", curVar.dbt)
					
					type = PLCvar.type;
				}
				else
				{
					type = curVar.objectType;
					typeSize = app.CallFunction("common.GetIECTypeSize", curVar.objectType);
					// al momento nel ModbusCustomEditor mancano molti tipi (stringhe comprese), quindi qui non compaiono gestioni particolari per STRING
				}
				
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
					infoValue = 0								// 	numRegs
				}
				else
				{
					numRegs = ( typeSize / 2)
					infoValue = numRegs & 0x3F					//	num regs
				}
				
				regTypesInfoMap[ curVar.pos ] = { numRegs: numRegs, value: infoValue };
				
				if (!MODBUSRTU_MASTER_STRUCT_SLAVES)
					var db = app.CallFunction("common.ParseDataBlock", PLCvar.DataBlock);
				
				totVars++
				if (v == 0)
				{
					//	i messaggi on event di tipo output oppure broadcast necessitano di un buffer dedicato
					var adr_buffer;
					if ( msg.pollTime == 0 && ( block == "output" || isBroadcast ) )
					{				
						var pdu_tx = {}
						pdu_tx.name = "$$mbm" + network + "_pdu_tx_buffer_" + totModbusPduTxBuffer

						if ( msg.funcode == MODBUSFUNC.WRITESINGLECOIL )
							pdu_tx.size	= 5
						else if ( msg.funcode == MODBUSFUNC.WRITESINGLEREG )
							pdu_tx.size	= 5
						else if ( msg.funcode == MODBUSFUNC.WRITEMULTIPLECOILS )
							pdu_tx.size	= 6 + parseInt( msg.size / 8 ) + 1
						else if ( msg.funcode == MODBUSFUNC.WRITEMULTIPLEREGS )
							pdu_tx.size	= 6 + msg.size * 2
						
						pduTxBufferInfo.push( pdu_tx )						
						totModbusPduTxBuffer++
						
						adr_buffer = "ADR(" + pdu_tx.name + ")"
					}
					else
						adr_buffer = "NULL";
					
					if (isBroadcast)
					{
						// comando broadcast
						if (IsModbusReadFunc(msg.funcode))
						{
							var errmsg = genfuncs.FormatMsg(app.Translate("Modbus read functions can not be used as broadcast"), curVar.label);
							throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node));
						}
						
						var adr_dbElemsArr = !MODBUSRTU_MASTER_STRUCT_SLAVES ? "ADR("+dbElemsArrName+")" : "NULL";
						var adr_regTypes = IsModbusMultipleRegsFunc(msg.funcode) ? "ADR("+regTypesInfoName+")" : "NULL";
						var params = ["chn_return", msg.funcode, msg.addr, msg.size, adr_dbElemsArr, "ADR("+dbAddrArrName+")", msg.turnAround, msg.pollTime, adr_buffer, adr_regTypes];
						masterCode += "	slaveBool_return := sysMbMRtu_NewBroadcastMessage3(" + params.join(", ") + ");\n"
						
						// cfg incrementale e oneshot non implementati
					}
					else 
					{
						// comando normale non broadcast
						var adr_dbElemsArr = !MODBUSRTU_MASTER_STRUCT_SLAVES ? "ADR("+dbElemsArrName+")" : "NULL";
						var adr_regTypes = IsModbusMultipleRegsFunc(msg.funcode) ? "ADR("+regTypesInfoName+")" : "NULL";
						var params = ["chn_return", "slave_address", msg.funcode, msg.addr, msg.size, adr_dbElemsArr, "ADR("+dbAddrArrName+")", msg.pollTime, msg.tmo, adr_buffer, adr_regTypes, msg.turnAround];
						masterCode += "\tslaveBool_return := sysMbMRtu_NewSlaveMessage4(" + params.join(", ") + ");\n"
						
						if ( MODBUSRTU_MASTER_INCREMENTAL_MSG_CONFIGURATION )
						{
							masterCode += "\tIF slaveBool_return THEN\n"
							if ( MODBUSRTU_MASTER_INPUTOUTPUTCMD_SUPPORTED )
							{
								masterCode += inputOutputMsg
							}
							if ( MODBUSRTU_MASTER_ONESHOT_SUPPORTED )
							{
								masterCode += oneShotMsg
							}
							masterCode += "\t\tslaveBool_return := sysMbMRtu_MsgConfigCompleted2(chn_return, TRUE);\n"
							masterCode += "\tEND_IF;\n"
						}
					}
				}
				
				if (!MODBUSRTU_MASTER_STRUCT_SLAVES)
				{
					dbElemsArr.push(db.datablock, db.offset, m_DataBlockAreaIndex[db.area]);
				}
				else
				{
					var fieldName = GetUniqueFieldName(curVar, fieldNamesMap);
					typesCode += "\t\t" + fieldName + " : " + curVar.objectType + ";\n";
					fieldAdrNames.push("ADR(" +  instanceName + "." + fieldName + ")");
				}
			}  // for curVar
			
			if ( msg.size > 0 && IsModbusMultipleRegsFunc(msg.funcode) )
			{										
				//	fill reg types info basing on known positions and filling holes
				var regTypesInfoArray = []
				for (var j = 0; j < msg.size; )
				{
					var regInfo = regTypesInfoMap[ j ]
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
				
				constantsDecl += "\t\t" + regTypesInfoName + " : ARRAY [ 0.." + regTypesInfoArray.length + " ] OF BYTE := [" + regTypesInfoArray.length + ", " + regTypesInfoArray.join(", ") + "];\n"
			}
			
			var initVal = "";
			if (!MODBUSRTU_MASTER_STRUCT_SLAVES)
				constantsDecl += "\t\t" + dbElemsArrName + " : ARRAY[0.." + (dbElemsArr.length - 1) + "] OF UINT := [" + dbElemsArr.join(", ") + "];\n"
			else
				initVal = " := [" + fieldAdrNames.join(",") + "]";
			
			varsDecl += "\t\t" + dbAddrArrName + " : ARRAY[0.." + (msg.vars.length - 1) + "] OF PVOID" + initVal + ";\n";
			
			totMsg++
		} // for msg
		
		// parametri di configurazione
		for (var i = 0; i < cfg.params.length; i++)
		{
			var param = cfg.params[i]
			
			if (isNaN(param.addr) || !param.type || isNaN(param.value) || isNaN(param.tmo))
			{
				var errmsg = genfuncs.FormatMsg(app.Translate("Invalid parametrization record"))
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", param.node))
			}
			
			var tipo = param.type
			var dim = app.CallFunction("common.GetIECTypeSize", param.type)
			
			
			if (param.type === "REAL")
			{
				slaveCode += "	slaveparam_return := sysMbMRtu_SlavePrmReal( " + chn + ", " + sysMbMRtuNetListVarName + "[" + totSlaves + "].adr" + ", " + i + ", " + param.addr + ", " + param.value + ", " + param.tmo + " );\n"
			}	
			else 
			{
				if ((dim % 4) == 0 ) // se sono double
				{
					slaveCode += "	slaveparam_return := sysMbMRtu_SlavePrmInteger( " + chn + ", " + sysMbMRtuNetListVarName + "[" + totSlaves + "].adr" + ", " + i + ", " + param.addr + ", 2, " + param.value + ", " + param.tmo + " );\n"
				}
				else							
					slaveCode += "	slaveparam_return := sysMbMRtu_SlavePrmInteger( " + chn + ", " + sysMbMRtuNetListVarName + "[" + totSlaves + "].adr" + ", " + i + ", " + param.addr + ", 1, " + param.value + ", " + param.tmo + " );\n"
			}	
				
		}
		
		if (MODBUSRTU_MASTER_STRUCT_SLAVES)
		{
			typesCode += "\t\tdiag: @" + MODBUSRTU_SYSMBMRTUNETLIST_TYPENAME + ";\n\tEND_STRUCT;\n"
			globalVarCode += "\t\t{G:\"Devices\"}\n"
			globalVarCode += "\t\t" + instanceName + ": " + structName + ";\n";
			initDiagCode += "\t" + instanceName + ".diag := ADR(" + sysMbMRtuNetListVarName + "[" + totSlaves + "]);\n";
		}
		
		// se non broadcast incrementa numero di slaves reali per allocazione netlist
		if (!isBroadcast)
			totSlaves++;
	}
	
	if ( constantsDecl != "" )
		constantsDecl = "\tVAR CONSTANT\n" + constantsDecl + "\tEND_VAR\n\n"
	if ( varsDecl != "" )
		varsDecl = "\tVAR\n" + varsDecl + "\tEND_VAR\n\n"
	
	masterCode += "\n	END_PROGRAM\n\n"
	masterCode += "\n	PROGRAM MbMPrm_" + network + " WITH MbMPrm;\n\
	PROGRAM MbMPrm_" + network + "\n\
	{ HIDDEN:ON }\n\n\
	VAR\n\
		slaveparam_return : BOOL;\n\
	END_VAR\n\n\
	{ CODE:ST }\n\ "
	masterCode += slaveCode
	masterCode += "\n	END_PROGRAM\n\n"
	
	var result = {
		totSlaves: totSlaves, 
		totMsg: totMsg, 
		totInpOutMsg : totInpOutMsg,
		totVars: totVars,
		pduTxBufferInfo : pduTxBufferInfo,
		masterCode: masterCode,
		declarations: constantsDecl + varsDecl,
		typesCode: typesCode,
		globalVarCode: globalVarCode,
		initDiagCode: initDiagCode,
		sysMbMRtuNetListVarName: sysMbMRtuNetListVarName
	};
	return result;
}

function IsModbusMultipleRegsFunc(func)
{
	return func == MODBUSFUNC.READHOLDINGREG || func == MODBUSFUNC.READINPUTREG || func == MODBUSFUNC.WRITEMULTIPLEREGS;
}

function IsModbusReadFunc(func)
{
	return func == MODBUSFUNC.READHOLDINGREG || func == MODBUSFUNC.READINPUTREG || func == MODBUSFUNC.READCOIL || func == MODBUSFUNC.READINPUTSTATUS;
}


// ---------------------------------------------------------- GESTIONE MODBUS SLAVE ---------------------------------------------------
function GetModbusSlaveFilename()
{
	var filename = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath")) + "\\ModbusSlave.conf"
	return filename
}

function BuildCfg_ModbusSlave(device, cfg)
{
	var FUNCNAME = "BuildCfg_ModbusSlave"
	
	var filename = GetModbusSlaveFilename()
	
	if (!cfg.RTUport && !cfg.TCPport)
	{
		// sia RTU che TCP disabilitato, scrive file vuoto
		CreateEmptyFile(filename)
		return
	}
	
	
	// configurazione Modbus Slave RTU
	if (cfg.RTUport)
	{
		var addr = cfg.RTUport.getAttribute("slaveAddress")
		if (addr < 1 || addr > 247)
		{
			var err = app.CallFunction("common.SplitFieldPath", cfg.RTUport, "slaveAddress")
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, app.Translate("Invalid Modbus device address"), err)
		}
					
	}
	
	// configurazione Modbus Slave TCP
	if (cfg.TCPport)
	{
		
	}
	
	var msg = app.Translate("%1: created Modbus device configuration (%2 %3)")
	app.PrintMessage(genfuncs.FormatMsg(msg, device.getAttribute("caption"), (cfg.RTUport ? "RTU" : ""), (cfg.TCPport ? "TCP" : "")))
	
}

/*	ESPORTAZIONE MODBUSCUSTOM SLAVE A CATALOGO */

function ModbusSlaveExportConfiguration( xmldoc )
{
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var device = app.SelectNodesXML("/" + targetID)[0]
	
	var ModbusRTUSlaveNode = device.selectSingleNode( "RS485[ @mode = '" + RS485_MODE_SLAVE + "' ]" )
	var ModbusTCPSlaveNode = device.selectSingleNode( "Ethernet[ @enableSlave = '1' ]" )
	if ( !ModbusTCPSlaveNode && !ModbusRTUSlaveNode )
	{
		app.MessageBox( app.Translate( "Cannot export Modbus slave device.\nCurrent target is not configured for Modbus RTU or Modbus TCP slave." ), "Export Modbus slave", gentypes.MSGBOX.MB_ICONEXCLAMATION|gentypes.MSGBOX.MB_CANCEL )
		return false
	}
	
	//	questo è il template in cui dovranno essere settate queste impostazioni
	var ModbusRTU_masterNode = xmldoc.selectSingleNode( "devicetemplate/deviceinfo/protocols/protocol[text()='ModbusRTU_master']" )
	if ( ModbusRTU_masterNode && !ModbusRTUSlaveNode )
		ModbusRTU_masterNode.parentNode.removeChild( ModbusRTU_masterNode )
	var ModbusTCP_masterNode = xmldoc.selectSingleNode( "devicetemplate/deviceinfo/protocols/protocol[text()='ModbusTCP_master']" )
	if ( ModbusTCP_masterNode && !ModbusTCPSlaveNode )
		ModbusTCP_masterNode.parentNode.removeChild( ModbusTCP_masterNode )
	
	return true
}

function GenerateDianosticVarsModbus(network, arrName, arrBound, arrCount)
{
	var postfix = network == 0 ? "" : network
	var groupPragma = "\t\t{G:\"Diagnostics\"}\n"
	
	var globalVarCode = groupPragma
	globalVarCode += "\t\t" + arrName + " : ARRAY[ 0.." + MBMRTUNETLIST_ARRAY_UPPER_BOUND_NAME + postfix + " ] OF " + MODBUSRTU_SYSMBMRTUNETLIST_TYPENAME + "; { DE:\"Status of ModbusRTU Master Net list\" }\n"
	
	var globalConstCode = groupPragma
	globalConstCode += "\t\t" + MBMRTUNETLIST_ARRAY_UPPER_BOUND_NAME + postfix + " : USINT := " + arrBound + "; { DE:\"Upper bound of ModbusRTU Master Net list array\" }\n"
	globalConstCode += "\t\t" + MBMRTUNETLIST_ARRAY_COUNT_NAME + postfix + " : USINT := " + arrCount + "; { DE:\"Number of Modbus slaves on net\" }\n"
	
	return {globalVarCode:globalVarCode, globalConstCode:globalConstCode}
}