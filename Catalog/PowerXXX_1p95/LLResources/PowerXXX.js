// -----> cercare e controllare tutte le occorrenze di "TODO_NEWTARGET" in questo file !


var m_fso = new ActiveXObject("Scripting.FileSystemObject")

var gentypes = app.CallFunction("common.GetGeneralTypes")
var enuLogLevels = gentypes.enuLogLevels

// 0 modbus
var MODBUS_ADDRESS_OFFSET = app.CallFunction("script.GetModbusAddressOffset")

var genfuncs = app.CallFunction("common.GetGeneralFunctions")

var XPATH_ROOTDEVICE = "(ancestor::*[@IsRootDevice])[last()]"

// import fasi di compilazione
var COMPILATIONPHASE = app.CallFunction("compiler.GetCompilationPhase")


function Init_Common(p)
{
	if (typeof USE_MODBUSRTU_MASTER == "undefined")		USE_MODBUSRTU_MASTER = false;
	if (typeof USE_MODBUSTCP_MASTER == "undefined")		USE_MODBUSTCP_MASTER = false;
	if (typeof USE_CANOPEN_MASTER == "undefined")		USE_CANOPEN_MASTER = false;
	if (typeof USE_CANOPEN_SLAVE == "undefined")		USE_CANOPEN_SLAVE = false;
	if (typeof USE_MODBUS_SLAVE == "undefined")			USE_MODBUS_SLAVE = false;
	if (typeof USE_DATABASE == "undefined")				USE_DATABASE = false;
	if (typeof USE_ALARMS == "undefined")				USE_ALARMS = false;
	if (typeof USE_RECIPES == "undefined")				USE_RECIPES = false;
	if (typeof USE_LOCALIO == "undefined")				USE_LOCALIO = false;
	if (typeof USE_ETHERCAT_MASTER == "undefined")		USE_ETHERCAT_MASTER = false;
	if (typeof USE_CONFIGURATOR == "undefined")			USE_CONFIGURATOR = false;
	if (typeof USE_LLSYMBOLSREMOTE == "undefined")		USE_LLSYMBOLSREMOTE = false;
	if (typeof USE_GENERIC_FIELDBUS == "undefined")		USE_GENERIC_FIELDBUS = false;
	if (typeof USE_WEBSERVER == "undefined")			USE_WEBSERVER = false;
	if (typeof USE_DATALOGGER == "undefined")			USE_DATALOGGER = false;
	if (typeof USE_ONESW_HMI == "undefined") 			USE_ONESW_HMI = false;
    if (typeof USE_ONESW_COMMISSIONING == "undefined")  USE_ONESW_COMMISSIONING = false;
    if (typeof USE_MQTT == "undefined")                 USE_MQTT = false;
    if (typeof USE_MOTION == "undefined")               USE_MOTION = false;
	
	if (typeof USE_MACHINECFG == "undefined") 			USE_MACHINECFG = false;
	
	
	return 1;
}

// recupera da PCT il template XML con la definizione dell'IO locale, invece di tenerlo nel PCN
// il suffisso PREFIX_LocalIODef_ è cablato fisso !
// il paremetro suffix permette di cercare es. PREFIX_LocalIODef_DI
function GetLocalIODef(device, suffix)
{
	if (!suffix)
		return
	
	var nodelist = app.GetTemplateData(device.nodeName + "_LocalIODef_" + suffix)
	if (nodelist && nodelist.length != 0)
		return nodelist[0]
}

// verifica la coerenza delle variabili mappate sul local IO
function CheckLocalIOMapping(device, mappedVars)
{
	// TODO_NEWTARGET : se necessario aggiungere/togliere tipologie di IO in base al PCT, vedi config/ioMappings_xxxx
	var ioTypesSuffix = ["DI", "DO"]
	
	for (var i = 0; i < ioTypesSuffix.length; i++)
	{
		// ottiene definizione del local IO
		var localIODef = GetLocalIODef(device, ioTypesSuffix[i])
		
		// lista delle mappature
		var nodelist = device.selectNodes("config/ioMappings_" + ioTypesSuffix[i] + "/ioMapping[label != '']")
		var node
		while (node = nodelist.nextNode())
		{
			// ricava la definizione del nodo IO (chiave di ricerca è il nome)
			var ioNode = localIODef.selectSingleNode("io[@id = " + node.getAttribute("id") + "]")
			if (!ioNode)
				continue
			
			// ricava la variabile PLC mappata e la confronta con la mappatura; non confronta il tipo (si può mappare UINT su INT)
			var label = genfuncs.GetNode(node, "label")
			var PLCvar = mappedVars[label]
			if (!PLCvar)
			{
				// variabile PLC cancellata
				var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has been deleted or changed to 'Auto' allocation"), label)
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "CheckLocalIOMapping", errmsg, app.CallFunction("common.SplitFieldPath", node))
			}
			else if (PLCvar.DataBlock != ioNode.getAttribute("db"))
			{
				// variabile PLC modificata nell'allocazione
				var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has been modified in datablock allocation"), label)
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "CheckLocalIOMapping", errmsg, app.CallFunction("common.SplitFieldPath", node))
			}
		}
	}
	
	return enuLogLevels.LEV_OK
}



function Validate(device, phase)
{
	if (phase == COMPILATIONPHASE.ONSAVE)
	{
		return enuLogLevels.LEV_OK
	}
	else if (phase == COMPILATIONPHASE.PREBUILD)
	{
		if (USE_LOCALIO)
		{
			// ottiene mappa di tutte le var mappate su datablock
			var mappedVars = app.CallFunction("script.GetMappedPLCVars")
			var ris = CheckLocalIOMapping(device, mappedVars)
			if ( ris != enuLogLevels.LEV_OK )
				return ris
		}
		if (USE_DATABASE)
		{
			var ris = ValidateDatabase(device)
			if ( ris != enuLogLevels.LEV_OK )
				return ris
		}
		if (USE_CANOPEN_SLAVE_OD)
		{
			var validate = ValidateObjectDictionary(device, true)
			if (validate != 0)
				return validate
		}
		if (USE_MQTT)
		{
			var ris = app.CallFunction("MQTT.Validate", device);
			if (ris != enuLogLevels.LEV_OK)
				return ris
		}
		
		return enuLogLevels.LEV_OK
	}
	else if (phase == COMPILATIONPHASE.POSTBUILD)
	{
		return enuLogLevels.LEV_OK
	}
	else
		return enuLogLevels.LEV_OK
}

// restituisce il nome del datablock adibito all'IO del tipo specificato
function GetIODataBlockName(protocol, isInput, type)
{
	/* ATTENZIONE: verifica IsResourceManagedDatablock che deve essere allineato se no le variabili non tornano automatiche quando vengono disassegnate! */
	
	if (protocol == "ModbusRTU_master")
	{
		if (isInput)
			return "sysFieldbusDataRO"
		else
			return "sysFieldbusDataRW"
	}
	else if (protocol == "EtherCAT")
	{
		if (isInput)
			return "sysEtherCATDataRO"
		else
			return "sysEtherCATDataRW"
	}
	else if (protocol == "ModbusTCP_master")
	{
		if (isInput)
			return "sysModbusTCPMasterDataRO"
		else
			return "sysModbusTCPMasterDataRW"
	}
	else
	{
		//	CANopen non richiede variabili mappate su datablock!
		return ""
	}
}


function CustomBuild(device, phase)
{
	if (phase == COMPILATIONPHASE.PREBUILD)
	{
		if ( USE_DATABASE )
		{
			if ( !CheckParDBCoherence() )
				return enuLogLevels.LEV_CRITICAL
		}
	
		return enuLogLevels.LEV_OK
	}
	else if( phase == COMPILATIONPHASE.POSTBUILD )
	{
		var mappedVars = app.CallFunction("script.GetMappedPLCVars")
		
		try
		{
			var confDir = GetConfDir();
			if (!m_fso.FolderExists(confDir))
				m_fso.CreateFolder (confDir);
			
			if ( USE_CONFIGURATOR )
			{
				if (!app.CallFunction("ConfiguratorIntf.BuildCFN"))
					return enuLogLevels.LEV_CRITICAL
			}
			
			if (USE_MOTION)
				app.CallFunction("Motion.GetMappedMotionVars", mappedVars);
			
			if (USE_ETHERCAT_MASTER)
			{
				
			}
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
		
		return enuLogLevels.LEV_OK
	}
	else if( phase == COMPILATIONPHASE.ONSAVE )
	{
		var mappedVars = app.CallFunction("script.GetMappedPLCVars")
		var modbusSlaveCfg = { RTUports: [], TCPports: [], MbRTUMasterEnabled: false }
		
		try
		{
			if (USE_ETHERCAT_MASTER)
			{
				app.CallFunction("ECATCfg.SaveEtherCATProject", device);
				
				var ris = app.CallFunction("ECATCfg.BuildCfg_EtherCAT", device, mappedVars);
				if (ris !== true)
					return enuLogLevels.LEV_CRITICAL
			}
			
			if ( USE_DATABASE )
			{
				BuildCfg_Database(device)
			}
			if ( USE_CANOPEN_SLAVE_OD )
			{
				BuildCfg_ObjectDictionary(device, true)
			}
			if ( USE_MODBUSRTU_MASTER || USE_MODBUSRTU_SLAVE )
			{
				if(!BuildCfg_RS485(device, mappedVars, modbusSlaveCfg))
					return enuLogLevels.LEV_CRITICAL
			}
			if ( USE_MODBUSTCP_MASTER )
			{
				if(!BuildCfg_Ethernet(device, mappedVars, modbusSlaveCfg))
					return enuLogLevels.LEV_CRITICAL
			}
			if ( USE_CANOPEN_MASTER )
			{
				BuildCfg_CAN(device, mappedVars)
			}
			if ( USE_CANOPEN_SLAVE )
			{
				BuildCfg_CANSlave(device, mappedVars)
			}
			if ( USE_LLSYMBOLSSERVER )
			{
				BuildCfg_LLSymbolsServer(device)
			}
			if ( USE_MQTT )
			{
				var ris = app.CallFunction("MQTT.BuildCfg_MQTT", device);
				if (ris !== true)
					throw ris;
			}
			if (USE_MOTION)
			{
				var ris = app.CallFunction("Motion.Build", device);
				if (ris !== true)
					throw ris;
			}
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
		
		//	aux source generation sample
/*		var filename = "my_aux_src.plc"
		var content = my_Generate_PLC_Code( device )
		if (content === null)
			// errore di generazione
			return enuLogLevels.LEV_CRITICAL
		else if (content === "")
			// nessun codice generato, rimuove il codice aux eventualmente presente
			app.CallFunction( "compiler.LogicLab_RemovePLC", app.CallFunction("logiclab.get_ProjectPath"), filename )
		else
		{
			app.CallFunction( "compiler.LogicLab_UpdatePLC", app.CallFunction("logiclab.get_ProjectPath"), filename, content )
			app.PrintMessage( "Created my plc code", enuLogLevels.LEV_INFO )
		}
		*/
		
		return enuLogLevels.LEV_OK
	}
	else
	{
		return enuLogLevels.LEV_OK
	}
}

// cartella che conterrà tutti i files .conf: è la cartella 'download' in modo da raggruppare tutti i files scaricabili
function GetConfDir()
{
	var dir = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath")) + "\\Download\\";
	return dir;
}

function GetBuildDir()
{
	var prjDir = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath")) + "\\";
	if (m_fso.FolderExists(prjDir + "Build"))
		return prjDir + "Build\\";  // le nuove versioni di LogicLab hanno la sottocartella "build" con tutti gli output di compilazione
	else
		return prjDir;  // vecchie versioni salvano tutto nella cartella di progetto
}

function GetSymbolTableFilename()
{
	var prjpath = app.CallFunction("logiclab.get_ProjectPath");
	var symtab = GetBuildDir() + "\\" + m_fso.GetBaseName(prjpath) + ".sym.xml";
	return symtab;
}

function GetSymbolTableNameOnTarget()
{
	return "/sdcard/plc_runtime/PLC.sym.xml";
}

function CustomDownload(device, phase, errcode)
{
	if (phase == COMPILATIONPHASE.PREDOWNLOAD)
	{
		// non scarica i file se in simulazione
		if (app.CallFunction("logiclab.get_SimulMode"))
			return true
		
		if ( USE_DATABASE )
		{			
			var result = InitDefaultValues_Database(device);
			if ( result != enuLogLevels.LEV_OK )
				return result
		}
		
		PreDownload(device);
		
/*
		// ottiene l'interfaccia IDeviceLink attiva da logiclab
		var devlink = app.CallFunction("logiclab.GetDeviceLink")
		if (!devlink)
			return false	

		// la symbol table ha il path completo del progetto con estensione .sym.xml
		// scarico sempre la symbol table in PLC.sym.xml
		var prjpath = app.CallFunction("logiclab.get_ProjectPath")
		var symtab = m_fso.GetParentFolderName(prjpath) + "\\" + m_fso.GetBaseName(prjpath) + ".sym.xml"
		
		var result = app.CallFunction("GDBFileTransfer.GDBCopyFileToDevice", devlink, symtab, "PLC.sym.xml")
		app.PrintMessage("Downloading PLC.sym.xml symbol table : " + (result ? "OK" : "FAILED"))

		// se flag di downloadSymTab attivo la scarica ora, visto che c'è già la connessione attiva!
		//var downloadSymTab = genfuncs.ParseBoolean(genfuncs.GetNode(device, "config/downloadSymbolTable"))
		var downloadSymTab = true; // sempre abilitato per LLSymbolServer
		if (downloadSymTab)
		{
			// la symbol table ha il path completo del progetto con estensione .sym.xml
			var prjpath = app.CallFunction("logiclab.get_ProjectPath")
			var symtab = m_fso.GetParentFolderName(prjpath) + "\\" + m_fso.GetBaseName(prjpath) + ".sym.xml"
			
			var result = app.CallFunction("GDBFileTransfer.GDBCopyFileToDevice", devlink, symtab, "PLC.sym.xml")
			app.PrintMessage("Downloading Symbol table : " + (result ? "OK" : "FAILED"))
		}
		
		// rilascia reference al devicelink e unlock della comunicazione (logiclab fa lock nella GetDeviceLink()!)
		devlink = undefined
		CollectGarbage()  // chiama subito il gc per forzare la release del devicelink
		app.CallFunction("logiclab.UnlockComm")
*/
		return enuLogLevels.LEV_OK
	}
	else if (phase == COMPILATIONPHASE.POSTDOWNLOAD)
	{
		PostDownload(device, errcode);
	}
}

function CreateEmptyFile(filename)
{
	var f = m_fso.CreateTextFile(filename, true)
	f.Close()
}

/* USE_DATABASE */
// ---------------- gestione parametri/status variables
// TODO_NEWTARGET : se USE_DATABASE==false è possibile NON includere questo file
#include AlDatabase/AlDatabase_cfg.js

// TODO_NEWTARGET : se USE_MODBUS_MASTER==false è possibile NON includere questo file
#include AlModbusRTU/AlModbusRTU_cfg.js

// TODO_NEWTARGET : se USE_MODBUSTCP_MASTER==false è possibile NON includere questo file
#include AlModbusTCPMaster/AlModbusTCPMaster_cfg.js

// TODO_NEWTARGET : se USE_CANOPEN_MASTER==false è possibile NON includere questo file
#include AlCOPM/AlCOPM_cfg.js

// TODO_NEWTARGET : se USE_CANOPEN_SLAVE==false è possibile NON includere questo file
#include AlCOPS/AlCOPS_cfg.js

// TODO_NEWTARGET : se USE_LLSYMBOLSSERVER==false è possibile NON includere questo file
//#include LLSymbolsServer/LLSymbolsServer_cfg.js

/* USE_CONFIGURATOR */
// --------------------------------------------------- GENERAZIONE PCT APPLICATIVO  ---------------------------------------------------
// path per applicazioni, relativo alla radice del catalogo
var APPLICATIONS_PATH = "Applications\\"

// script gestione esportazione applicazione a catalogo LV2
#include ../../ConfiguratorCommon/configurator_app.js

// ----------------------------------------- gestione scaricamento files sul target -------------------------------
// questo include deve SEMPRE essere presente
#include download_cfg.js


function UpgradeNode(device, oldVersion)
{
	var xmldoc = app.GetXMLDocument()
	
	if (oldVersion < 2.0)
	{
		//	aggiungo il nodo CANopen dopo il nodo RS485
		var CANopenNode = app.GetTemplateData( device.nodeName + "/CANopen")[0].cloneNode(true)
		var RS485Node = device.selectSingleNode("RS485")
		RS485Node.parentNode.appendChild( CANopenNode )
	}
	if (oldVersion < 3.0)
	{
		//	aggiungo il nodo Ethernet dopo il nodo CANopen
		var EthernetNode = app.GetTemplateData( device.nodeName + "/Ethernet")[0].cloneNode(true)
		var CANopenNode = device.selectSingleNode("CANopen")
		CANopenNode.parentNode.appendChild( EthernetNode )
		
		var analogInputsNode = device.selectSingleNode( "config/ioMappings_AI" )
		for ( var i = 4; i < 16; i++ )
		{
			var ioMappingNode = analogInputsNode.appendChild( xmldoc.createElement( "ioMapping" ) )
			ioMappingNode.appendChild( xmldoc.createElement( "label" ) )
			ioMappingNode.setAttribute( "id", i )
		}
		
		var analogOutputsNode = device.selectSingleNode( "config/ioMappings_AO" )
		for ( var i = 4; i < 16; i++ )
		{
			var ioMappingNode = analogOutputsNode.appendChild( xmldoc.createElement( "ioMapping" ) )
			ioMappingNode.appendChild( xmldoc.createElement( "label" ) )
			ioMappingNode.setAttribute( "id", i )
		}
	}
	if(oldVersion < 4.0)
	{
		//	per retrocompatibilità se non è definito è tutto come prima, il database è basato sul modbus
		var configNode = device.selectSingleNode("config")
		configNode.setAttribute("databaseDefinitionMode", "0")	//	0: modbus, 1: free index
	}
	
	if (oldVersion < 5.0)
	{
		if (USE_ETHERCAT_MASTER)
			device.appendChild(xmldoc.createElement("EtherCAT"));
	}
	
	if (oldVersion < 6.0)
	{
		if (USE_MQTT)
		{
			var newNode = app.GetTemplateData(device.nodeName + "/MQTT")[0].cloneNode(true)
			device.appendChild(newNode);
		}
	}
	
	if (oldVersion < 7.0)
		device.selectSingleNode("RS485").setAttribute("masterNetId", 0);
	
	if (oldVersion < 8.0)
	{
		if (USE_MOTION)
			device.appendChild(xmldoc.createElement("Motion"));
	}
	
	if (oldVersion < 9.0)
	{
		if (USE_WEBSERVER)
			device.appendChild(xmldoc.createElement("webmenus"));
	}
}


// conversione da un vecchio target tramite ChangeTarget
function UpgradeOldTarget(node)
{
	// targetID del progetto attuale, in quanto PREFIX coincide con il nome del nodo xml
	var targetID = app.CallFunction("logiclab.get_TargetID")
	
	// rinomina il vecchio nodo xml
	var newnode = app.CallFunction("common.RenameXMLElement", node, targetID)
	
	app.ParseNode(newnode)
	app.ModifiedFlag = true
	app.PrintMessage("Target correctly upgraded")
}


function OnCreateNode(node)
{
}

function OnLoadNode(node)
{
	if (app.CallFunction("script.HasTargetChanged"))
	{
		// ..... se serve fare qualcosa farlo qui
	}
	
	if (USE_ETHERCAT_MASTER)
		app.CallFunction("ECATCfg.AlEtherCAT_LoadEtherCATProject", node);
}


// TODO_NEWTARGET : per casi particolari aggiungere/togliere altre gestioni di allocazione variabili su datablock
var PLCVARUSAGE = {
	PARAM: 0,
	PARAMRO: 1,
	CANOPEN: 2,
	MODBUSRTU: 3,
	MODBUSTCP: 4,
	LOCALIO: 5,
	ETHERCAT: 6
}

// estrae tutti gli usi della var specificata
function GetPLCVariableUsages(varName)
{
	var result = []
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var nodelist, node
	
	if (USE_LOCALIO)
	{
		// verifica uso su local I/O
		nodelist = app.SelectNodesXML("/" + targetID + "/config/ioMappings/ioMapping[label = '" + varName + "']")
		while (node = nodelist.nextNode())
			result.push( { type: PLCVARUSAGE.LOCALIO, node: node, descr: "Local I/O" } )
	}

	if (USE_DATABASE)
	{
		// verifica uso su parametri
		nodelist = app.SelectNodesXML("/" + targetID + "/config/params/param[name = '" + varName + "']")
		while (node = nodelist.nextNode())
			result.push( { type: PLCVARUSAGE.PARAM, node: node, descr: "Parameters" } )

		// verifica uso su parametri
		nodelist = app.SelectNodesXML("/" + targetID + "/config/params/paramRO[name = '" + varName + "']")
		while (node = nodelist.nextNode())
			result.push( { type: PLCVARUSAGE.PARAMRO, node: node, descr: "Status variables" } )
	}
	
	if (USE_MODBUSRTU_MASTER)
	{
		// verifica uso su slave ModbusRTU su porta RS485
		nodelist = app.SelectNodesXML("/" + targetID + "/RS485//modbusMapping[label = '" + varName + "']")
		while (node = nodelist.nextNode())
			result.push( { type: PLCVARUSAGE.MODBUSRTU, node: node, descr: "ModbusRTU" } )
		
		nodelist = app.SelectNodesXML("/" + targetID + "/RS485//FC_image[label = '" + varName + "']")
		while (node = nodelist.nextNode())
			result.push( { type: PLCVARUSAGE.MODBUSRTU, node: node, descr: "ModbusRTU" } )
	}
	
	if (USE_MODBUSTCP_MASTER)
	{
		// verifica uso su slave ModbusTCP su porta Ethernet
		nodelist = app.SelectNodesXML("/" + targetID + "/Ethernet//modbusMapping[label = '" + varName + "']")
		while (node = nodelist.nextNode())
			result.push( { type: PLCVARUSAGE.MODBUSTCP, node: node, descr: "ModbusTCP" } )
		
		nodelist = app.SelectNodesXML("/" + targetID + "/Ethernet//FC_image[label = '" + varName + "']")
		while (node = nodelist.nextNode())
			result.push( { type: PLCVARUSAGE.MODBUSTCP, node: node, descr: "ModbusTCP" } )
	}
	
	// su COPM le variabili rimangono automatiche
	
	if (USE_ETHERCAT_MASTER)
	{
		// verifica uso su ethercat
		if (app.CallFunction("ECATCfg.IsPLCVarMappedOnEtherCAT", varName))
			result.push( { type: PLCVARUSAGE.ETHERCAT, node: null, descr: "EtherCAT" } )
	}
	
	return result
}

// verifica se il datablock della var è uno di quelli gestiti dal framework
function IsResourceManagedDatablock(dbArea, dbNum)
{
	// TODO_NEWTARGET : aggiungere/togliere datablock le cui variabili sono gestite in modo automatico dal framework
	
	return  (dbArea == "I" && dbNum == 0) ||	// local digital input
		(dbArea == "Q" && dbNum == 0) ||	// local digital output
		(dbArea == "M" && dbNum == 100) ||	// fieldbus RO Modbus RTU
		(dbArea == "M" && dbNum == 101)	||	// fieldbus RW Modbus RTU
		(dbArea == "M" && dbNum == 102) ||	// fieldbus RO Modbus TCP
		(dbArea == "M" && dbNum == 103)	||	// fieldbus RW Modbus TCP
		(dbArea == "M" && dbNum == 104) ||	// ethercat RO
		(dbArea == "M" && dbNum == 105)		// ethercat RW
}

function GetComplexVarOffset(PLCvar, xmlnode)
{
	// la GetVarAddress successiva altera l'indirizzo della PLCvar (??), lo salva quindi subito
	var varAddr = PLCvar.Address
	var baseName = app.CallFunction("script.GetComplexVarBaseName", PLCvar.name)
	var baseAddr = app.CallFunction("logiclab.GetVarAddress", baseName, "")
	if (baseAddr == 0)
		throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, "Error getting address of " + baseName, app.CallFunction("common.SplitFieldPath", xmlnode))
		
	return varAddr - baseAddr
}

// funzione invocata da script.OnRefactoringMsg per rinomino istanze variabili dentro XML
function Refactor(deviceNode, objType, oldName, newName)
{
	var querylist = [
		"config/params/param/name",
		"config/paramsRO/param/name"
	];
	
	var totReplaced = 0;
	
	for (var i = 0; i < querylist.length; i++)
	{
		var nodelist = deviceNode.selectNodes(querylist[i] + "[. = '" + oldName + "']");
		var node;
		while (node = nodelist.nextNode())
			node.text = newName;
		
		totReplaced += nodelist.length;
	}
	
	if (USE_ETHERCAT_MASTER)
		totReplaced += app.CallFunction("ECATCfg.RefactorECAT", oldName, newName);
	
	return totReplaced;
}

// lista di tutti i device slave inseriti nel progetto, ad uso di script.BackupAllUserTemplates per esportazione PCT utente nel progetto
function GetAllSlaveDevices()
{
	var rootnode = app.SelectNodesXML("/" + app.CallFunction("logiclab.get_TargetID"))[0]
	var nodelist = rootnode.selectNodes( "RS485/*[@insertable] | RS232/*[@insertable] | Ethernet/*[@insertable]" )
	
	if (USE_ETHERCAT_MASTER)
	{
		var ECATDeviceIDs = app.CallFunction("ECATCfg.GetLoadedECATTemplatesDeviceIDs");
		if (ECATDeviceIDs && ECATDeviceIDs.length != 0)
		{
			// se ci sono PCT caricati per EtherCAT, invece di tornare solo la lista di nodi torna un array con la lista dei deviceid (il chiamante BackupAllUserTemplates gestisce i formati)
			var list = [];
			var node;
			while (node = nodelist.nextNode())
				list.push(node.nodeName);
			
			return list.concat(ECATDeviceIDs);
		}
	}
	
	return nodelist
}


#include MachineCFG.js