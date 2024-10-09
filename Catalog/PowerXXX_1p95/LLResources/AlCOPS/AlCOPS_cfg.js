var CAN_MODE_OFF = 0
var CAN_MODE_MASTER = 1
var CAN_MODE_SLAVE = 2

//	Il canale di comunicazione slave SDO server è supportato lato firmware
var CANOPEN_SLAVE_CHANNEL_SUPPORTED = 0
var CANOPEN_SLAVE_DYNAMIC_ALLOCATION = 0

////////////////////////////////////////////////////////////////////////////////////////////////////

/*	Ridefinisce i default specificati qui sopra */

#include ../AlCOPS_settings.js

#include AlCOPSObjDict/ObjectDictionary_cfg.js

var m_copsCfg = {}
var m_copsDBase = {}

function BuildCfg_CANSlave(device, mappedVars)
{
	//	genero un unico file per le due reti CAN (almeno una linea deve essere attiva)
	var generateSlaveConf = false
	var portList = device.selectNodes( "CANopen" )
	var port
	var portCount = 0
	while (port = portList.nextNode())
	{
		if (parseInt(port.getAttribute("mode")) == CAN_MODE_SLAVE)
		{
			generateSlaveConf = true
		}
		portCount++
	}
	
	var content
	if ( generateSlaveConf )
	{
		//	generazione configurazione per CANopen slave
		portList.reset()
		content = BuildCfg_CANopenSlaveMulti(device, portList, mappedVars, true)
	}
	else
	{
		//	reset contents
		content = ""
	}

	if ( content == "" && CANOPEN_SLAVE_CHANNEL_SUPPORTED )
	{
		//	se il master non è configurato genera comunque una configurazione per aprire il canale slave di comunicazione
		portList.reset()
		var port = portList.nextNode()
		content = BuildCfg_CANopenSlaveOpenPort( port )
	}

	CANopenSlave_filename = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath")) + "\\CANopenSlave_cfg.plc"
	
	//	inserimento sorgente ausiliario nel progetto PLC	
	if (content === null)
		// errore di generazione
		throw enuLogLevels.LEV_CRITICAL
	else if (content === "")
		// nessun codice generato, rimuove il codice aux eventualmente presente
		app.CallFunction( "compiler.LogicLab_RemovePLC", app.CallFunction("logiclab.get_ProjectPath"), CANopenSlave_filename )
	else
	{
		app.CallFunction( "compiler.LogicLab_UpdatePLC", app.CallFunction("logiclab.get_ProjectPath"), CANopenSlave_filename, content )
		app.PrintMessage( "Created CANopen Slave configuration", enuLogLevels.LEV_INFO )
	}
}

//	controlla che lo slave sia abilitato su al più una porta e genera la configurazione
//	non è possibile avere più slave attivi allo stesso momento
function BuildCfg_CANopenSlaveMulti(device, portList, mappedVars)
{
	var FUNCNAME = "BuildCfg_CANopenSlaveMulti"
	var cops_configured = false
	var content = ""
	var port
	while ( port = portList.nextNode() )
	{
		var mode = parseInt(port.getAttribute("mode"))
		
		if (mode == CAN_MODE_SLAVE && !cops_configured)
		{
			content = BuildCfg_CANopenSlave(device, port, mappedVars)
			cops_configured = true
		}
		else if (mode == CAN_MODE_SLAVE && cops_configured)
		{			
			//	COPS può essere attivato solo su uno slave!
			var err = app.CallFunction("common.SplitFieldPath", port)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, app.Translate("CANopen slave can be enabled only on one channel"), err)
		}
	}
	
	return content
}

//	database mandatorio oggetti canopen
function MandatoryDatabaseDefinition()
{
	m_copsDBase = {

		"0x0001.0": { description: "Dummy object BOOLEAN", 			index: 0x0001, subindex: 0, type: "unsignedChar", len: 1 },
		"0x0002.0": { description: "Dummy object INTEGER8", 		index: 0x0002, subindex: 0, type: "signedChar", len: 1 },
		"0x0003.0": { description: "Dummy object INTEGER16", 		index: 0x0003, subindex: 0, type: "signedShort", len: 2 },
		"0x0004.0": { description: "Dummy object INTEGER32", 		index: 0x0004, subindex: 0, type: "signedInt", len: 4 },
		"0x0005.0": { description: "Dummy object UNSIGNED8", 		index: 0x0005, subindex: 0, type: "unsignedChar", len: 1 },
		"0x0006.0": { description: "Dummy object UNSIGNED16", 		index: 0x0006, subindex: 0, type: "unsignedShort", len: 2 },
		"0x0007.0": { description: "Dummy object UNSIGNED32", 		index: 0x0007, subindex: 0, type: "unsignedInt", len: 4 },
		
		"0x1000.0": { description: "Device Type", 					index: 0x1000, subindex: 0, type: "unsignedInt", len: 4 },
		"0x1005.0": { description: "COB-ID SYNC message", 			index: 0x1005, subindex: 0, type: "unsignedInt", len: 4 },
		"0x1006.0": { description: "Communication Cycle Period", 	index: 0x1006, subindex: 0, type: "unsignedInt", len: 4 },
		"0x1008.0": { description: "Manufacturer Device Name", 		index: 0x1008, subindex: 0, type: "string", len: undefined },
		"0x1009.0": { description: "Manufacturer Hardware Version", index: 0x1009, subindex: 0, type: "string", len: undefined },
		"0x100A.0": { description: "Manufacturer Software Version", index: 0x100A, subindex: 0, type: "string", len: undefined },
		"0x100C.0": { description: "Guard Time", 					index: 0x100C, subindex: 0, type: "unsignedShort", len: 2 },
		"0x100D.0": { description: "Life Time Factor",			 	index: 0x100D, subindex: 0, type: "unsignedChar", len: 1 },
		"0x1016.1": { description: "Consumer Heartbeat Time", 		index: 0x1016, subindex: 1, type: "unsignedInt", len: 4 },
		"0x1017.0": { description: "Producer Heartbeat Time", 		index: 0x1017, subindex: 0, type: "unsignedShort", len: 2 },
		"0x1018.1": { description: "Vendor ID", 					index: 0x1018, subindex: 1, type: "unsignedInt", len: 4 },
		"0x1018.2": { description: "Product code", 					index: 0x1018, subindex: 2, type: "unsignedInt", len: 4 },
		"0x1018.3": { description: "Revision number", 				index: 0x1018, subindex: 3, type: "unsignedInt", len: 4 },
		"0x1018.4": { description: "Serial number", 				index: 0x1018, subindex: 4, type: "unsignedInt", len: 4 }
	}

	/* RPDO */
	for ( i = 0; i < m_copsCfg.max_rpdo_num; i++)
	{
		/*	PDO transmission */
		
		var object = {}
		object.description = "COB-ID used by PDO"
		object.index = 0x1400 + i
		object.subindex = 1
		object.type = "unsignedInt"
		object.len = 4
		m_copsDBase[ "0x" + object.index.toString(16).toUpperCase() + "." + object.subindex ] = object
		
		var object = {}
		object.description = "transmission type"
		object.index = 0x1400 + i
		object.subindex = 2
		object.type = "unsignedChar"
		object.len = 1
		m_copsDBase[ "0x" + object.index.toString(16).toUpperCase() + "." + object.subindex ] = object
		
		/*	PDO mapping */
		
		var object = {}
		object.description = "number of mapped application objects in PDO"
		object.index = 0x1600 + i
		object.subindex = 0
		object.type = "unsignedChar"
		object.len = 1
		object.min = 0
		object.max = m_copsCfg.max_entries
		m_copsDBase[ "0x" + object.index.toString(16).toUpperCase() + "." + object.subindex ] = object
		
		for ( var j = 1; j <= m_copsCfg.max_entries; j++ )
		{
			var object = {}
			object.description = "number of mapped application objects in PDO"
			object.index = 0x1600 + i
			object.subindex = j
			object.type = "unsignedInt"
			object.len = 4
			m_copsDBase[ "0x" + object.index.toString(16).toUpperCase() + "." + object.subindex ] = object
		}
	}
	
	/* TPDO */
	for ( i = 0; i < m_copsCfg.max_tpdo_num; i++)
	{
		var object = {}
		object.description = "COB-ID used by PDO"
		object.index = 0x1800 + i
		object.subindex = 1
		object.type = "unsignedInt"
		object.len = 4
		m_copsDBase[ "0x" + object.index.toString(16).toUpperCase() + "." + object.subindex ] = object
		
		var object = {}
		object.description = "transmission type"
		object.index = 0x1800 + i
		object.subindex = 2
		object.type = "unsignedChar"
		object.len = 1
		m_copsDBase[ "0x" + object.index.toString(16).toUpperCase() + "." + object.subindex ] = object
		
		var object = {}
		object.description = "inhibit time"
		object.index = 0x1800 + i
		object.subindex = 3
		object.type = "unsignedShort"
		object.len = 2
		m_copsDBase[ "0x" + object.index.toString(16).toUpperCase() + "." + object.subindex ] = object
		
		var object = {}
		object.description = "event timer"
		object.index = 0x1800 + i
		object.subindex = 5
		object.type = "unsignedShort"
		object.len = 2
		m_copsDBase[ "0x" + object.index.toString(16).toUpperCase() + "." + object.subindex ] = object
		
		/*	PDO mapping */
		
		var object = {}
		object.description = "number of mapped application objects in PDO"
		object.index = 0x1A00 + i
		object.subindex = 0
		object.type = "unsignedChar"
		object.len = 1
		object.min = 0
		object.max = m_copsCfg.max_entries
		m_copsDBase[ "0x" + object.index.toString(16).toUpperCase() + "." + object.subindex ] = object
		
		for ( var j = 1; j <= m_copsCfg.max_entries; j++ )
		{
			var object = {}
			object.description = "number of mapped application objects in PDO"
			object.index = 0x1A00 + i
			object.subindex = j
			object.type = "unsignedInt"
			object.len = 4
			m_copsDBase[ "0x" + object.index.toString(16).toUpperCase() + "." + object.subindex ] = object
		}
	}
}

//	imposta il parametro e lo aggiunge alla configurazione
function SlaveSetParam( xmldoc, root, objectID, value )
{
	var object = m_copsDBase[ objectID ]
	
	//	oggetto non definito nel database
	if ( !object )
		return false
	
	if (object.type == "string")
		object.len = value.length
	
	var parNode = root.appendChild( xmldoc.createElement("par") )
	parNode.setAttribute( "index" ) = "0x" + object.index.toString(16).toUpperCase()
	parNode.setAttribute( "subindex" ) = object.subindex
	parNode.setAttribute( "type" ) = object.type
	parNode.setAttribute( "len" ) = object.len
	parNode.setAttribute( "value" ) = value
	
	return true
}

//	alloca dinamicamente la memoria necessaria a gestire la configurazione dei PDO
//	genera i record relativi alla configurazione pdo di base
function CANopenSlaveDynamicAllocation( net )
{
	var code = ""
	if ( !CANOPEN_SLAVE_DYNAMIC_ALLOCATION )
		return code
	
	var TPDONum = parseInt( net.getAttribute( "slaveCfgMaxTPDONum" ) )
	var RPDONum = parseInt( net.getAttribute( "slaveCfgMaxRPDONum" ) )
	
	code += "\n"
	code += "	TYPE\n"
	code += "		PDO_REC_CFG_STRUCT_TYPE : STRUCT\n"
	code +=	"			NUM_PDO_REC_OBJ : USINT;\n"
	code += "			PDO_REC_CHANGE : @BYTE;\n"
	code += "			PDO_REC_COBID : @DWORD;\n"
	code += "			PDO_REC_T_TYPE : @BYTE;\n"
	code += "			PDO_REC_MAP_ELEM : @USINT;\n"
	code += "			PDO_REC_MAP_OBJ : @DWORD;\n"
	code += "		END_STRUCT;\n"
	code += "		PDO_TRS_CFG_STRUCT_TYPE : STRUCT\n"
	code +=	"			NUM_PDO_TRS_OBJ : USINT;\n"
	code += "			PDO_TRS_CHANGE : @BYTE;\n"
	code += "			PDO_TRS_COBID : @DWORD;\n"
	code += "			PDO_TRS_T_TYPE : @BYTE;\n"
	code += "			PDO_TRS_INH : @UINT;\n"
	code += "			PDO_TRS_EVENT : @UINT;\n"
	code += "			PDO_TRS_MAP_ELEM : @USINT;\n"
	code += "			PDO_TRS_MAP_OBJ : @DWORD;\n"
	code += "		END_STRUCT;\n"
	code += "		OBJDICTIONARY_T : STRUCT\n"
	code += "			index : WORD;\n"
	code += "			subi : UINT;\n"
	code += "			odtype : UINT;\n"
	code += "			addr : DWORD;\n"
	code += "			nelem : UINT;\n"
	code += "			len : UINT;\n"
	code += "			attr : UINT;\n"
	code += "			fnz_id : UINT;\n"
	code += "		END_STRUCT;\n"
	code += "	END_TYPE\n\n"
	
	//	allocazione strutture dati come VAR_GLOBAL\n
	if ( RPDONum + TPDONum > 0 )
	{
		code += "	VAR_GLOBAL\n"
	}
		
	if ( RPDONum == 1 )
	{
		code += "		$$PDO_REC_CHANGE : BYTE;\n"
		code += "		$$PDO_REC_COBID : DWORD;\n"
		code += "		$$PDO_REC_T_TYPE : BYTE;\n"
		code += "		$$PDO_REC_MAP_ELEM : USINT;\n"
		code += "		$$PDO_REC_MAP_OBJ : ARRAY[ 0..7 ] OF DWORD;\n"
	}
	else if ( RPDONum > 1 )
	{
		var RPDONum_ArrayLimit = RPDONum - 1
		code += "		$$PDO_REC_CHANGE : ARRAY[ 0.." + RPDONum_ArrayLimit + " ] OF BYTE;\n"
		code += "		$$PDO_REC_COBID : ARRAY[ 0.." + RPDONum_ArrayLimit + " ] OF DWORD;\n"
		code += "		$$PDO_REC_T_TYPE : ARRAY[ 0.." + RPDONum_ArrayLimit + " ] OF BYTE;\n"
		code += "		$$PDO_REC_MAP_ELEM : ARRAY[ 0.." + RPDONum_ArrayLimit + " ] OF USINT;\n"
		code += "		$$PDO_REC_MAP_OBJ : ARRAY[ 0.." + ( ( RPDONum * 8 )- 1 ) + " ] OF DWORD;\n"
	}	
	if ( TPDONum == 1 )
	{
		code += "		$$PDO_TRS_CHANGE : BYTE;\n"
		code += "		$$PDO_TRS_COBID : DWORD;\n"
		code += "		$$PDO_TRS_T_TYPE : BYTE;\n"
		code += "		$$PDO_TRS_INH : UINT;\n"
		code += "		$$PDO_TRS_EVENT : UINT;\n"		
		code += "		$$PDO_TRS_MAP_ELEM : USINT;\n"
		code += "		$$PDO_TRS_MAP_OBJ : ARRAY[ 0..7 ] OF DWORD;\n"
	}
	else if ( TPDONum > 1 )
	{
		var TPDONum_ArrayLimit = TPDONum - 1
		code += "		$$PDO_TRS_CHANGE : ARRAY[ 0.." + TPDONum_ArrayLimit + " ] OF BYTE;\n"
		code += "		$$PDO_TRS_COBID : ARRAY[ 0.." + TPDONum_ArrayLimit + " ] OF DWORD;\n"
		code += "		$$PDO_TRS_T_TYPE : ARRAY[ 0.." + TPDONum_ArrayLimit + " ] OF BYTE;\n"
		code += "		$$PDO_TRS_INH : ARRAY[ 0.." + TPDONum_ArrayLimit + " ] OF UINT;\n"
		code += "		$$PDO_TRS_EVENT : ARRAY[ 0.." + TPDONum_ArrayLimit + " ] OF UINT;\n"		
		code += "		$$PDO_TRS_MAP_ELEM : ARRAY[ 0.." + TPDONum_ArrayLimit + " ] OF USINT;\n"
		code += "		$$PDO_TRS_MAP_OBJ : ARRAY[ 0.." + ( ( TPDONum * 8 )- 1 ) + " ] OF DWORD;\n"
	}
	
	if ( RPDONum + TPDONum > 0 )
	{
		code += "	END_VAR\n"
	}
	code += "\n"
	code += "	VAR_GLOBAL CONSTANT\n"

	if ( RPDONum > 0 )
		code += "		$$PDO_REC_CFG_STRUCT : PDO_REC_CFG_STRUCT_TYPE := ( NUM_PDO_REC_OBJ := " + RPDONum + ", PDO_REC_CHANGE := ?$$PDO_REC_CHANGE, PDO_REC_COBID := ?$$PDO_REC_COBID, PDO_REC_T_TYPE := ?$$PDO_REC_T_TYPE, PDO_REC_MAP_ELEM := ?$$PDO_REC_MAP_ELEM, PDO_REC_MAP_OBJ := ?$$PDO_REC_MAP_OBJ );\n"
	else
		code += "		$$PDO_REC_CFG_STRUCT : PDO_REC_CFG_STRUCT_TYPE := ( NUM_PDO_REC_OBJ := 0, PDO_REC_CHANGE := 0, PDO_REC_COBID := 0, PDO_REC_T_TYPE := 0, PDO_REC_MAP_ELEM := 0, PDO_REC_MAP_OBJ := 0 );\n"
	
	if ( TPDONum > 0 )
		code += "		$$PDO_TRS_CFG_STRUCT : PDO_TRS_CFG_STRUCT_TYPE := ( NUM_PDO_TRS_OBJ := " + TPDONum + ", PDO_TRS_CHANGE := ?$$PDO_TRS_CHANGE, PDO_TRS_COBID := ?$$PDO_TRS_COBID, PDO_TRS_T_TYPE := ?$$PDO_TRS_T_TYPE, PDO_TRS_INH := ?$$PDO_TRS_INH, PDO_TRS_T_EVENT := ?$$PDO_TRS_EVENT, PDO_TRS_MAP_ELEM := ?$$PDO_TRS_MAP_ELEM, PDO_TRS_MAP_OBJ := ?$$PDO_TRS_MAP_OBJ );\n"
	else
		code += "		$$PDO_TRS_CFG_STRUCT : PDO_TRS_CFG_STRUCT_TYPE := ( NUM_PDO_TRS_OBJ := 0, PDO_TRS_CHANGE := 0, PDO_TRS_COBID := 0, PDO_TRS_T_TYPE := 0, PDO_TRS_INH := 0, PDO_TRS_T_EVENT := 0, PDO_TRS_MAP_ELEM := 0, PDO_TRS_MAP_OBJ := 0 );\n"
	
	if ( RPDONum > 0 || TPDONum > 0 )
	{
		var nRec = RPDONum * 5 + TPDONum * 7 + 1 // riga vuota alla fine
		if ( nRec == 1 ) nRec = 2	//	forza a 2 per avere comunque un array dichiarato
		code += "		$$COPS_KVAL_2 : USINT := 2;\n"
		code += "		$$COPS_KVAL_5 : USINT := 5;\n"
		code += "		$$OD_TABLED_DYN_EXT : ARRAY[ 0.. " + (nRec - 1) + "] OF OBJDICTIONARY_T := [\n"
		
		//	RPDO
		for ( var i = 0; i < RPDONum; i++ )
		{
			var index = 0x1400 + i
			var indexStr = app.CallFunction("common.sprintf", "16#%04X", index )
			code += "			( index := " + indexStr + ", subi := 0, odtype := 2, addr := ?$$COPS_KVAL_2, 					nelem := 1, len := 1, attr := 16#01, fnz_id := 0 ),\n"
			if ( RPDONum == 1 )
			{
				code += "			( index := " + indexStr + ", subi := 1, odtype := 6, addr := ?$$PDO_REC_COBID, 				nelem := 1, len := 4, attr := 16#0B, fnz_id := 6 ),\n"
				code += "			( index := " + indexStr + ", subi := 2, odtype := 2, addr := ?$$PDO_REC_T_TYPE, 			nelem := 1, len := 1, attr := 16#0B, fnz_id := 6 ),\n"
			}
			else
			{
				code += "			( index := " + indexStr + ", subi := 1, odtype := 6, addr := ?$$PDO_REC_COBID[ " + i + " ], 				nelem := 1, len := 4, attr := 16#0B, fnz_id := 6 ),\n"
				code += "			( index := " + indexStr + ", subi := 2, odtype := 2, addr := ?$$PDO_REC_T_TYPE[ " + i + " ], 			nelem := 1, len := 1, attr := 16#0B, fnz_id := 6 ),\n"
			}
			var index = 0x1600 + i
			var indexStr = app.CallFunction("common.sprintf", "16#%04X", index )
			if ( RPDONum == 1 )
			{
				code += "			( index := " + indexStr + ", subi := 0, odtype := 2, addr := ?$$PDO_REC_MAP_ELEM, 			nelem := 1, len := 1, attr := 16#0B, fnz_id := 7 ),\n"
			}
			else
			{
				code += "			( index := " + indexStr + ", subi := 0, odtype := 2, addr := ?$$PDO_REC_MAP_ELEM[ " + i + " ], 			nelem := 1, len := 1, attr := 16#0B, fnz_id := 7 ),\n"
			}
			code += "			( index := " + indexStr + ", subi := 1, odtype := 6, addr := ?$$PDO_REC_MAP_OBJ[ " + ( i * 8 ) + " ],			nelem := 8, len := 4, attr := 16#0B, fnz_id := 7 ),\n\n"
		}
		
		//	TPDO
		for ( var i = 0; i < TPDONum; i++ )
		{
			var index = 0x1800 + i
			var indexStr = app.CallFunction("common.sprintf", "16#%04X", index )
			code += "			( index := " + indexStr + ", subi := 0, odtype := 2, addr := ?$$COPS_KVAL_5, 					nelem := 1, len := 1, attr := 16#01, fnz_id := 0 ),\n"
			if ( TPDONum == 1 )
			{
				code += "			( index := " + indexStr + ", subi := 5, odtype := 4, addr := ?$$PDO_TRS_EVENT, 				nelem := 1, len := 2, attr := 16#0B, fnz_id := 6 ),\n"
				code += "			( index := " + indexStr + ", subi := 1, odtype := 6, addr := ?$$PDO_TRS_COBID, 				nelem := 1, len := 4, attr := 16#0B, fnz_id := 6 ),\n"
				code += "			( index := " + indexStr + ", subi := 2, odtype := 2, addr := ?$$PDO_TRS_T_TYPE, 			nelem := 1, len := 1, attr := 16#0B, fnz_id := 6 ),\n"
				code += "			( index := " + indexStr + ", subi := 3, odtype := 4, addr := ?$$PDO_TRS_INH, 				nelem := 1, len := 2, attr := 16#0B, fnz_id := 6 ),\n"
			}
			else
			{
				code += "			( index := " + indexStr + ", subi := 5, odtype := 4, addr := ?$$PDO_TRS_EVENT[ " + i + " ], 				nelem := 1, len := 2, attr := 16#0B, fnz_id := 6 ),\n"
				code += "			( index := " + indexStr + ", subi := 1, odtype := 6, addr := ?$$PDO_TRS_COBID[ " + i + " ], 				nelem := 1, len := 4, attr := 16#0B, fnz_id := 6 ),\n"
				code += "			( index := " + indexStr + ", subi := 2, odtype := 2, addr := ?$$PDO_TRS_T_TYPE[ " + i + " ], 			nelem := 1, len := 1, attr := 16#0B, fnz_id := 6 ),\n"
				code += "			( index := " + indexStr + ", subi := 3, odtype := 4, addr := ?$$PDO_TRS_INH[ " + i + " ], 				nelem := 1, len := 2, attr := 16#0B, fnz_id := 6 ),\n"
			}
			var index = 0x1A00 + i
			var indexStr = app.CallFunction("common.sprintf", "16#%04X", index )
			if ( TPDONum == 1 )
			{
				code += "			( index := " + indexStr + ", subi := 0, odtype := 2, addr := ?$$PDO_TRS_MAP_ELEM, 			nelem := 1, len := 1, attr := 16#0B, fnz_id := 7 ),\n"
			}
			else
			{
				code += "			( index := " + indexStr + ", subi := 0, odtype := 2, addr := ?$$PDO_TRS_MAP_ELEM[ " + i + " ], 			nelem := 1, len := 1, attr := 16#0B, fnz_id := 7 ),\n"
			}
			code += "			( index := " + indexStr + ", subi := 1, odtype := 6, addr := ?$$PDO_TRS_MAP_OBJ[ " + ( i * 8 ) + " ], 			nelem := 8, len := 4, attr := 16#0B, fnz_id := 7 ),\n\n"
		}
		
		//	record di terminazione
		code += "			( index := 0, subi := 0, odtype := 0, addr := 0, 			nelem := 0, len := 0, attr := 16#00, fnz_id := 0 ) ];\n"
	}
	else
	{
		code += "		$$OD_TABLED_DYN_EXT : OBJDICTIONARY_T := ( index := 0, subi := 0, odtype := 0, addr := 0, nelem := 0, len := 0, attr := 16#00, fnz_id := 0 );\n"
	}
	code += "	END_VAR\n"
	code += "\n"
	code += "	PROGRAM $$sysCopsSetDynamicConfiguration WITH Boot;\n"
	code += "	PROGRAM $$sysCopsSetDynamicConfiguration\n"
	code += "		{ HIDDEN:ON }\n"
	code += "		{ CODE:ST }\n"
	code += "		VAR\n"
	code += "			dummy : BOOL;\n"
	code += "		END_VAR\n"
	code += "		dummy := sysCopsSetDynamicConfiguration( ?$$PDO_REC_CFG_STRUCT, ?$$PDO_TRS_CFG_STRUCT, ?$$OD_TABLED_DYN_EXT );\n"
	code += "	END_PROGRAM\n"
	code += "\n"
	
	return code
}

//  generazione configurazione CANopen Slave
function BuildCfg_CANopenSlaveOpenPort( net )
{		
	var FUNCNAME = "BuildCfg_CANopenSlaveOpenPort"

	var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0")
	xmldoc.appendChild(xmldoc.createProcessingInstruction("xml", "version='1.0' encoding='UTF-8'"))
	var rootNode = xmldoc.appendChild(xmldoc.createElement("copsconfig"))
	
	var mode = parseInt(net.getAttribute("mode"))
	var netID = parseInt(net.getAttribute("id"))
	
	if (mode != CAN_MODE_OFF)
		return
	
	var code = ""

/* 	da testare in caso di utilizzo */
//	if ( CANOPEN_SLAVE_DYNAMIC_ALLOCATION )
//		code = CANopenSlaveDynamicAllocation( net )
	
	COPS_CHN_ENUM = {}
	COPS_CHN_ENUM[ 0 ] = "COPS_CHN_CAN0"
	COPS_CHN_ENUM[ 1 ] = "COPS_CHN_CAN1"
	COPS_CHN_ENUM[ 2 ] = "COPS_CHN_CAN2"
	
	code += "	(* Automatically generated code, do not edit! *)\n\n"
	code += "\tPROGRAM $$sysCopsSetConfigurationOpenPort WITH Init;\n"
	code += "\tPROGRAM $$sysCopsSetConfigurationOpenPort\n"
	code += "\t\t{ HIDDEN:ON }\n"
	code += "\t\t{ CODE:ST }\n"
	code += "\t\tVAR\n"
	code += "\t\tdummy : BOOL;\n"
	code += "\t\tEND_VAR\n"	
	var channel = COPS_CHN_ENUM[ netID ]
	code += "\t\tdummy := sysCopsSetConfiguration( " + channel + ", 0, COPS_BAUD_NOT_USED, 0, 0 );\n"
	code += "\tEND_PROGRAM\n"
	
	return code
}

//  generazione configurazione CANopen Slave
function BuildCfg_CANopenSlave(device, net, mappedVars)
{
	var FUNCNAME = "BuildCfg_CANopenSlave"

	var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0")
	xmldoc.appendChild(xmldoc.createProcessingInstruction("xml", "version='1.0' encoding='UTF-8'"))
	var rootNode = xmldoc.appendChild(xmldoc.createElement("copsconfig"))
	
	var mode = parseInt(net.getAttribute("mode"))
	var netID = parseInt(net.getAttribute("id"))
	
	if (mode != CAN_MODE_SLAVE)
		return
	
	var code = "	(* Automatically generated code, do not edit! *)\n\n"
	
	if ( CANOPEN_SLAVE_DYNAMIC_ALLOCATION )
		code += CANopenSlaveDynamicAllocation( net )
	
	//	riempio la struttura di configurazione
	m_copsCfg.max_tpdo_num = parseInt(net.getAttribute("slaveCfgMaxTPDONum"))
	m_copsCfg.max_rpdo_num = parseInt(net.getAttribute("slaveCfgMaxRPDONum"))
	m_copsCfg.granularity = parseInt(net.getAttribute("slaveCfgGranularity"))
	m_copsCfg.max_entries = 64 / m_copsCfg.granularity
	
	//	inizializza il database del cops
	MandatoryDatabaseDefinition()
		
	// creazione nodo <cops> con opzioni dello slave
	var copsNode = rootNode.appendChild(xmldoc.createElement("cops"))
	copsNode.setAttribute("channel", netID)
	copsNode.setAttribute("nodeID", parseInt(net.getAttribute("slaveNodeID")))
	copsNode.setAttribute("baudrate", parseInt(net.getAttribute("baudRate")))
/*
	if ( parseInt(net.getAttribute("isFixedNodeId")) )
		copsNode.setAttribute("nodeID", parseInt(net.getAttribute("slaveNodeID")))
	else
		copsNode.setAttribute("nodeID", 0)
	
	if ( parseInt(net.getAttribute("isFixedBaudrate")) )
		copsNode.setAttribute("baudrate", parseInt(net.getAttribute("baudRate")))
	else
		copsNode.setAttribute("baudrate", 0)
*/	
	// creazione nodo <params> che raggruppa i parametri
	var paramsNode = copsNode.appendChild(xmldoc.createElement("params"))
	
	/*	oggetti mandatori */
	
	var ris = true
	//	0x1000.0 - slaveDeviceType
	SlaveSetParam( xmldoc, paramsNode, "0x1000.0", net.getAttribute("slaveDeviceType") )
	//	0x1005.0 - slaveSyncCOBID
	SlaveSetParam( xmldoc, paramsNode, "0x1005.0", net.getAttribute("slaveSyncCOBID") )
	//	0x1006.0 - slaveSyncCycle
	//SlaveSetParam( xmldoc, paramsNode, "0x1006.0", net.getAttribute("slaveSyncCycle") )	//	non gestito dallo stack canopen slave
	//	0x1008.0 - slaveManufacturerDeviceName
	SlaveSetParam( xmldoc, paramsNode, "0x1008.0", net.getAttribute("slaveManufacturerDeviceName") )
	//	0x1009.0 - slaveManufacturerHardwareVer
	SlaveSetParam( xmldoc, paramsNode, "0x1009.0", net.getAttribute("slaveManufacturerHardwareVer") )
	//	0x100A.0 - slaveManufacturerSoftwareVer
	SlaveSetParam( xmldoc, paramsNode, "0x100A.0", net.getAttribute("slaveManufacturerSoftwareVer") )
	//	0x100C.0 - slaveGuardTime
	SlaveSetParam( xmldoc, paramsNode, "0x100C.0", net.getAttribute("slaveGuardTime") )
	//	0x100D.0 - slaveLifeTimeFactor
	SlaveSetParam( xmldoc, paramsNode, "0x100D.0", net.getAttribute("slaveLifeTimeFactor") )
	//	0x1016.0 - slaveConsumerHeartbeatTime
	SlaveSetParam( xmldoc, paramsNode, "0x1016.0", net.getAttribute("slaveConsumerHeartbeatTime") )
	//	0x1017.0 - slaveProducerHeartbeatTime
	SlaveSetParam( xmldoc, paramsNode, "0x1017.0", net.getAttribute("slaveProducerHeartbeatTime") )
	//	0x1018.1 - slaveVendorID
	SlaveSetParam( xmldoc, paramsNode, "0x1018.1", net.getAttribute("slaveVendorID") )
	//	0x1018.2 - slaveProductCode
	SlaveSetParam( xmldoc, paramsNode, "0x1018.2", net.getAttribute("slaveProductCode") )
	//	0x1018.3 - slaveRevisionNumber
	SlaveSetParam( xmldoc, paramsNode, "0x1018.3", net.getAttribute("slaveRevisionNumber") )
	//	0x1018.4 - slaveSerialNumber
	SlaveSetParam( xmldoc, paramsNode, "0x1018.4", net.getAttribute("slaveSerialNumber") )
	
	/*	generazione PDO */
	
	//	ottiene tutte le informazioni sul database parametri
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var paramDBMap = AlCOPSGetParamMap(device, false)
	// inserisco i dummy object mappabili
	paramDBMap["0x1.0"] = {index: "0x1", subindex: 0, name: "Dummy Object BOOLEAN", type: "BOOL", readonly: 0, description: ""}
	paramDBMap["0x2.0"] = {index: "0x2", subindex: 0, name: "Dummy Object INTEGER8", type: "SINT", readonly: 0, description: ""}
	paramDBMap["0x3.0"] = {index: "0x3", subindex: 0, name: "Dummy Object INTEGER16", type: "INT", readonly: 0, description: ""}
	paramDBMap["0x4.0"] = {index: "0x4", subindex: 0, name: "Dummy Object INTEGER32", type: "DINT", readonly: 0, description: ""}
	paramDBMap["0x5.0"] = {index: "0x5", subindex: 0, name: "Dummy Object UNSIGNED8", type: "BYTE", readonly: 0, description: ""}
	paramDBMap["0x6.0"] = {index: "0x6", subindex: 0, name: "Dummy Object UNSIGNED16", type: "WORD", readonly: 0, description: ""}
	paramDBMap["0x7.0"] = {index: "0x7", subindex: 0, name: "Dummy Object UNSIGNED32", type: "DWORD", readonly: 0, description: ""}
	
	//	1° loop: TPDO
	//	2° loop: RPDO
	for ( k = 0; k < 2; k++ )
	{
		if ( k == 0 )	//	TPDO
		{
			var PDOgroupNode = net.selectSingleNode( "CANslave_PDOgroup_TX" )
			var baseObjectTransmissionType = 0x1800
			var baseObjectPDOMapping = 0x1A00
			var max_pdo_num = m_copsCfg.max_tpdo_num
			var PDOTypeDescr = "TPDO"
		}
		else //	RPDO
		{
			var PDOgroupNode = net.selectSingleNode( "CANslave_PDOgroup_RX" )
			var baseObjectTransmissionType = 0x1400
			var baseObjectPDOMapping = 0x1600
			var max_pdo_num = m_copsCfg.max_rpdo_num
			var PDOTypeDescr = "RPDO"
		}
		
		//	nessun PDO, tutti disabilitati di default
		if ( PDOgroupNode.childNodes.length == 0 )
			continue
		
		if ( PDOgroupNode.childNodes.length > max_pdo_num )
		{
			var msg = app.Translate( "Defined " + PDOTypeDescr + " number: " + PDOgroupNode.childNodes.length + ", is greater than maximum allowed: " + max_pdo_num + ". Not all PDO will be generated." )
			app.CallFunction("common.AddLog", enuLogLevels.LEV_WARNING, FUNCNAME, msg, err)
		}
				
		for ( var i = 0; i < max_pdo_num; i++ )
		{
			var PDOnum = i + 1
			var PDOconfig = app.CallFunction( "CANslave_PDO.GetPDO", PDOgroupNode, PDOnum, paramDBMap )
			
			if ( !PDOconfig )	//	se undefined significa che è fallita la validazione
			{
				var err = app.CallFunction("common.SplitFieldPath", PDOgroupNode)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, app.Translate("Configuration generation aborted"), err)
			}
			
			//	PDO disabilitato
			if ( PDOconfig.COBID & 0x80000000 )
				continue
			
			/*	PDO mapping */
			
			//	0x1600/0x1A00.0 - reset number of mapped application objects in PDO
			var objectIndex = baseObjectPDOMapping + i
			var objectMapID = "0x" + objectIndex.toString(16).toUpperCase() + ".0"
			SlaveSetParam( xmldoc, paramsNode, objectMapID, 0)
			
			for ( var j = 0; j < PDOconfig.NumberOfEntries && j < m_copsCfg.max_entries; j++ )
			{
				//	0x1600/0x1A00.j - mapped object entry
				var objectIndex = baseObjectPDOMapping + i
				var objectSubindex = j + 1
				var objectMapID = "0x" + objectIndex.toString(16).toUpperCase() + "." + objectSubindex.toString()
				SlaveSetParam( xmldoc, paramsNode, objectMapID, PDOconfig.EntryList[ j ] )
			}
			
			//	0x1600/0x1A00.0 - number of mapped application objects in PDO
			var objectIndex = baseObjectPDOMapping + i
			var objectMapID = "0x" + objectIndex.toString(16).toUpperCase() + ".0"
			SlaveSetParam( xmldoc, paramsNode, objectMapID, PDOconfig.NumberOfEntries)
				
			//	0x1400/0x1800.2 - transmission type
			var objectIndex = baseObjectTransmissionType + i
			var objectMapID = "0x" + objectIndex.toString(16).toUpperCase() + ".2"
			SlaveSetParam( xmldoc, paramsNode, objectMapID, PDOconfig.TransmissionType)
			
			if ( k == 0 )	//	TPDO
			{
				//	0x1800.5 - event timer
				var objectIndex = baseObjectTransmissionType + i
				var objectMapID = "0x" + objectIndex.toString(16).toUpperCase() + ".5"
				SlaveSetParam( xmldoc, paramsNode, objectMapID, PDOconfig.EventTimer)
			}
			
			//	0x1400/0x1800.1 - COB-ID used by PDO
			var objectIndex = baseObjectTransmissionType + i
			var objectMapID = "0x" + objectIndex.toString(16).toUpperCase() + ".1"
			SlaveSetParam( xmldoc, paramsNode, objectMapID, "0x" + PDOconfig.COBID.toString(16))
			
			var msg = app.Translate( "CANopen Slave: %1 #%2 configuration with %3 object entries generated" )
			app.PrintMessage(genfuncs.FormatMsg(msg, PDOTypeDescr, PDOconfig.Number, PDOconfig.NumberOfEntries))
		}
	}
	
	var msg = app.Translate( "CANopen Slave configured as node %1 on channel %2 at %3 Kb/s")
	app.PrintMessage(genfuncs.FormatMsg(msg, parseInt(net.getAttribute("slaveNodeID")), netID, parseInt(net.getAttribute("baudRate"))))

	// salvare il file conf insieme al progetto non è necessario	
	//xmldoc.save(CANopenSlave_filename + ".xml")
	
	var msg = app.Translate("%1: created CANopen Slave cfg")
	app.PrintMessage(genfuncs.FormatMsg(msg, device.getAttribute("caption")))

	code += GenerateIECCodeFromXml( rootNode )
	return code
}

//	a partire dall'xml generato produce il codice IEC da mettere nel progetto se il target non è LLExec
function GenerateIECCodeFromXml( rootNode )
{
	COPS_CHN_ENUM = {}
	COPS_CHN_ENUM[ 0 ] = "COPS_CHN_CAN0"
	COPS_CHN_ENUM[ 1 ] = "COPS_CHN_CAN1"
	COPS_CHN_ENUM[ 2 ] = "COPS_CHN_CAN2"

	COPS_BAUD_ENUM = {}
	COPS_BAUD_ENUM[ 0 ] = "COPS_BAUD_NOT_USED"
	COPS_BAUD_ENUM[ 1000000 ] = "COPS_BAUD_1000K"
	COPS_BAUD_ENUM[ 800000 ] = "COPS_BAUD_800K"
	COPS_BAUD_ENUM[ 500000 ] = "COPS_BAUD_500K"
	COPS_BAUD_ENUM[ 250000 ] = "COPS_BAUD_250K"
	COPS_BAUD_ENUM[ 125000 ] = "COPS_BAUD_125K"
	COPS_BAUD_ENUM[ 100000 ] = "COPS_BAUD_100K"
	COPS_BAUD_ENUM[ 50000 ] = "COPS_BAUD_50K"
	COPS_BAUD_ENUM[ 20000 ] = "COPS_BAUD_20K"
	COPS_BAUD_ENUM[ 10000 ] = "COPS_BAUD_10K"
	
	var code = ""
	code += "	VAR_GLOBAL\n"
	var nodeList = rootNode.selectNodes( "cops/params/par" )
	var parCount
	if ( nodeList )
		parCount = nodeList.length
	else
		parCount = 0
	
	if ( parCount == 0 )
		return ""
	
	//	metto le info in una struttura COPS_PARAM_STRUCT con questo significato:
	//	WORD index 		[ 0 ] index_lo_byte
	//					[ 1 ] index_hi_byte
	//	USINT subindex	[ 2 ] subindex
	//	USINT len		[ 3 ] len
	//	USINT extBuff	[ 4 ] extBuff 0/1
	//	USINT reserved	[ 5 ] 0
	//	DWORD valueAddr	[ 6 ] len > 4 ? *pData_lo_word_lo_byte : data_lo_word_lo_byte
	//					[ 7 ] len > 4 ? *pData_lo_word_hi_byte : data_lo_word_hi_byte
	//					[ 8 ] len > 4 ? *pData_hi_word_lo_byte : data_hi_word_lo_byte
	//					[ 9 ] len > 4 ? *pData_hi_word_hi_byte : data_hi_word_hi_byte
	
	//	generazione di variabili stringhe o array
	while ( node = nodeList.nextNode() )
	{
		var len = parseInt( node.getAttribute( "len" ) )
		var type = node.getAttribute( "type" )
		
		if ( type == "string" )
		{
			var strInitValue = node.getAttribute( "value" ) ? ":= '" + node.getAttribute( "value" ) + "'" : ""
			code += "\t\t$$sysParamNode_" + parseInt( node.getAttribute( "index" ) ).toString( 16 ) + "_" + node.getAttribute( "subindex" ) + " : STRING[ " + len + " ] " + strInitValue + ";\n"
		}
		else if ( len > 4 )
			code += "\t\t$$sysParamNode_" + parseInt( node.getAttribute( "index" ) ).toString( 16 ) + "_" + node.getAttribute( "subindex" ) + " : ARRAY[ 0.." + ( len - 1 ) + " ] OF BYTE;\n"
		else
			continue
	}
	
	//	generazione dell'array di init, un record per ogni parametro
	if ( parCount == 1 )
		var parCountArraySize = 1
	else
		var parCountArraySize = parCount - 1

	code += "\n"
	code += "\t\t$$sysCOPSParamArray : ARRAY[ 0.." + parCountArraySize + " ] OF COPS_PARAM_STRUCT := [\n"
		
	nodeList.reset()
	var par = 0	
	while ( node = nodeList.nextNode() )
	{
		var len = parseInt( node.getAttribute( "len" ) )
		var type = node.getAttribute( "type" )
		code += "\t\t( index := 16#" + parseInt( node.getAttribute( "index" ) ).toString( 16 ) + ", subindex := " + node.getAttribute( "subindex" ) + ", len := " + len + ","
		if ( type != "string" && len <= 4 )	//	il valore viene messo all'interno dell'array senza che sia necessario metterlo su un'altra costante		
			code += " isExtBuff := FALSE, value := " + parseInt( node.getAttribute( "value" ) ) + " )"
		else if ( type == "string" )
			code += " isExtBuff := TRUE, value := ?$$sysParamNode_" + parseInt( node.getAttribute( "index" ) ).toString( 16 ) + "_" + node.getAttribute( "subindex" ) + " )"
		else if ( len > 4 )
			code += " isExtBuff := TRUE, value := ?$$sysParamNode_" + parseInt( node.getAttribute( "index" ) ).toString( 16 ) + "_" + node.getAttribute( "subindex" ) + "[0] )"

		if ( parCount == 1 )
			code += ",\n\t\t\t( index := 16#0000, subindex := 16#00, len := 16#00, isExtBuff := FALSE, valueAddr := 16#00000000 )"
		else if ( ( par + 1 ) < parCount )
			code += ","

		par += 1
		code += "\n"
	}
	code += "\t\t];\n"	
	code += "\tEND_VAR\n\n"
	
	var copsNode = rootNode.selectSingleNode( "cops" )
	code += "\tPROGRAM $$AlCOPS_SetConfiguration WITH Init;\n"
	code += "\tPROGRAM $$AlCOPS_SetConfiguration\n"
	code += "\t\t{ HIDDEN:ON }\n"
	code += "\t\t{ CODE:ST }\n"
	code += "\t\tVAR\n"
	code += "\t\tdummy : BOOL;\n"
	code += "\t\tEND_VAR\n"	
	var channel = COPS_CHN_ENUM[ parseInt( copsNode.getAttribute( "channel" ) ) ]
	var baudrate = COPS_BAUD_ENUM[ parseInt( copsNode.getAttribute( "baudrate" ) ) ]
	code += "\t\tdummy := AlCOPS_SetConfiguration( " + channel + ", " + baudrate + ", " + copsNode.getAttribute( "nodeID" ) + ", FALSE, TO_DWORD( ADR( $$sysCOPSParamArray[ 0 ] ) ), " + parCount + " );\n"
	code += "\tEND_PROGRAM\n"
	
	return code
}

/*
function EncodeParamField( num, value )
{
	if ( num == 1 )
	{
		return value
	}
	else if ( num == 2 )
	{
		var lo_byte = parseInt( value ) & 0x00FF
		var hi_byte = ( ( parseInt( value ) & 0xFF00 ) >> 8 ) & 0x00FF
		return lo_byte + ", " + hi_byte
	}
	else if ( num == 4 )
	{
		var lo_word_lo_byte = parseInt( value ) & 0x000000FF
		var lo_word_hi_byte = ( ( parseInt( value ) & 0x0000FF00 ) >> 8 ) & 0x000000FF
		var hi_word_lo_byte = ( ( parseInt( value ) & 0x00FF0000 ) >> 16 ) & 0x000000FF
		var hi_word_hi_byte = ( ( parseInt( value ) & 0xFF000000 ) >> 24 ) & 0x000000FF
		return lo_word_lo_byte + ", " + lo_word_hi_byte + ", " + hi_word_lo_byte + ", " + hi_word_hi_byte 
	}
}
*/

function AlCOPSGetParamList(device, excludeReadOnly)
{
	var useAlCOPSObjDict = (device.getAttribute( "useAlCOPSObjDict" ) == "true")
	var excludeTypeString = true
	var excludeNotMappable = true
	
	if ( useAlCOPSObjDict )
	{
		//	get parameters list from AlCOPSObjDict
		return AlCOPSObjDictGetParamList(excludeReadOnly, excludeTypeString, 0x2000, 0xFFFF, excludeNotMappable)
	}
	else
	{	
		// voglio solo gli oggetti mappabili CANopen (>= 0x2000)
		return GetParamList(excludeReadOnly, excludeTypeString, 0x2000)		
	}
}

function AlCOPSGetParamMap(device, excludeReadOnly)
{
	var useAlCOPSObjDict = (device.getAttribute( "useAlCOPSObjDict" ) == "true")
	var excludeTypeString = true
	var excludeNotMappable = true
	
	if ( useAlCOPSObjDict )
	{
		//	get parameters map from AlCOPSObjDict
		return AlCOPSObjDictGetParamMap(excludeReadOnly, excludeTypeString, 0x2000, 0xFFFF, excludeNotMappable)		
	}
	else
	{	
		// voglio solo gli oggetti mappabili CANopen (>= 0x2000)
		return GetParamMap(false, excludeTypeString, 0x2000)
	}
}
