// estensione dei files template
var EXT_PCT = "PCT"
function SetFileExtension(ext)
	{ EXT_PCT = ext }
function GetFileExtension()
	{ return EXT_PCT }
	
// cartella contenente tutti i files custom
var CATALOG_DESTDIR = "ModbusCustom"
function SetCatalogDestDir(dir)
	{ CATALOG_DESTDIR = dir }
function GetCatalogDestDir()
	{ return CATALOG_DESTDIR }
	
var gentypes = app.CallFunction("common.GetGeneralTypes")
var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var ParseBoolean = genfuncs.ParseBoolean
var enuLogLevels = gentypes.enuLogLevels
var GetNode = genfuncs.GetNode
var SetNode = genfuncs.SetNode
var m_fso = new ActiveXObject("Scripting.FileSystemObject");

var XPATH_ROOTDEVICE = "(ancestor::*[@IsRootDevice])[last()]"

// come in script.js
var MODBUSADDRESSTYPE = {
	MODBUS: 0,
	JBUS: 1
};

var SLAVEADDRESSCONFIGMODE = {
	STATIC: 0,
	BY_VARIABLE_NAME: 1,
	BY_16BIT_KEY: 2,
	BY_32BIT_KEY: 4
};

function GetSlaveAddressConfigMode()
	{ return SLAVEADDRESSCONFIGMODE }

// determina se modbus/jbus (0: modbus con indirizzi già con +1, 1: jbus con indirizzi 'raw' a cui sarà da sommare +1)
var MODBUS_ADDRESS_OFFSET = app.CallFunction("script.GetModbusAddressOffset")

// interpretazione di default della modalità jbus/modbus; se non presente la funzione in script.js sarà uguale al settaggio globale della suite
var DEFAULT_MODBUS_ADDRESS_OFFSET_OF_SLAVES = MODBUS_ADDRESS_OFFSET;
if (app.FunctionExists("script.GetDefaultModbusAddressOffsetOfSlaves"))
	DEFAULT_MODBUS_ADDRESS_OFFSET_OF_SLAVES = app.CallFunction("script.GetDefaultModbusAddressOffsetOfSlaves");

var TREENAME = "tree1";
	// id icone di overlay per l'albero
var TREE_OVERLAY_NONE = 0
var TREE_OVERLAY_DISABLED = 1

var m_deviceParameters = {}

function Init()
{
	return 1
}

// !!! ATTENZIONE: ricordarsi anche di aggiornare ModbusCustomUpdate.js per l'aggiornamento su disco dei PCT !!!
function UpgradeNode(device, oldversion)
{
	var xmldoc = app.GetXMLDocument()
	
	if (oldversion < 2.0)
	{
		// crea ModbusCustom_config/turnAround   (default 0)
		var parent = device.selectSingleNode("ModbusCustom_config")
		parent.appendChild(xmldoc.createElement("turnAround")).text = 0
	}
}

function OnCreateNode(device)
{
	// crea nodeNumber successivo libero con valore iniziale 1
	app.CallFunction("common.CreateUniqueSubNode", device, "*/nodeNumber", 1)
	
	var protocol = device.parentNode.getAttribute("protocol")
	if (protocol == "ModbusTCP_master")
		// se modbus tcp come address per default è 255
		genfuncs.SetNode(device, "*/modbusAddress", 255)
}

function OnPasteNode(device)
{
	ClearAllPLCVarsFromDevice(device);
	app.CallFunction("common.CreateUniqueSubNode", device, "*/nodeNumber", 1);
}

// memorizzazione parametri
function OnLoadTemplate(filename, xml)
{
	LoadDeviceParametersFromXML(xml, true)
}

function LoadDeviceParametersFromXML(xml, checkAlreadyLoaded)
{
	var node = xml.selectSingleNode("/devicetemplate/deviceinfo/@deviceid")
	if (!node) return
	
	// memorizza in una variabile globale la sezione deviceconfig del GFT, per avere a disposizione i parametri BIOS
	var deviceid = node.text
	if (checkAlreadyLoaded && m_deviceParameters[deviceid])
		return
	
	var parList = []
	app.CallFunction("parameters.LoadParameters", xml, parList, "Modbus")
		
	// caricamento enumerativi da sezione parametri
	var enumMap = {}
	app.CallFunction("parameters.LoadEnums", xml, enumMap)
	
	var newitem = {}
	newitem.id = deviceid
	newitem.parList = parList
	newitem.enumMap = enumMap
	
	m_deviceParameters[deviceid] = newitem
	return deviceid;
}

function GetDeviceParameters(deviceid)
{
	if ( !m_deviceParameters[deviceid] )
		return undefined
	else
		return m_deviceParameters[deviceid].parList
}

function GetDeviceParametersEnums(deviceid)
{
	if ( !m_deviceParameters[deviceid] )
		return undefined
	else
		return m_deviceParameters[deviceid].enumMap
}

function ResetAllDeviceParameters()
{
	m_deviceParameters = {}
}

// ricaricamento delle definizioni dei parametri dei ModbusCustom specificati
function ReloadAllDeviceParameters(modifiedDevicesArr)
{
	var allDeviceids = [];
	for (var i = 0; i < modifiedDevicesArr.length; i++)
	{
		var filename = modifiedDevicesArr[i];
		var xmldoc = app.CallFunction("commonDLL.LoadXMLFileWithPreProcess", filename);
		if (xmldoc)
		{
			var deviceid = LoadDeviceParametersFromXML(xmldoc, false)
			allDeviceids.push(deviceid);
			
			// sostituisce il templatedata (se PCT già caricato, quindi in uso nel progetto)
			var newnode = xmldoc.selectSingleNode("/devicetemplate/plcconfig/templatedata/" + deviceid);
			var oldnode = app.GetTemplateData(deviceid)[0];
			if (newnode && oldnode)
				oldnode.parentNode.replaceChild(newnode, oldnode);
		}
	}
	
	return allDeviceids;
}


/* ritorna la configurazione dello slave per la generazione dei settaggi del master

{
	modbusAddress (int)
	nodeNumber (int)
	IPAddress (string)
	minPollTime (int)
	addressType (int)
	
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
			maxMsgMappings (int)
			maxMsgSizeReg (int)
			maxMsgSizeBit (int)
			oneshot (string)
			funcode (int)
			addr (int)
			size (int)
			writeFirst (int)
			
			vars
			[
				{
					addr (int)
					funcode (int)     //riportato sul primo msg
					size (int)
					db (string)
					dbt (string)
					label (string)
					pollTime (int)    //riportato sul primo msg
					bit (int)
					oneshot (string)  //riportato sul primo msg
					pos (int)
					node (object)
					objectName (string)
					objectType (string)
					writeFirst (int)  //riportato sul primo msg
				}
			]
		}
	]
}
*/
function GetModbusRTUCfg(device, reqAddressType, allowUnassigned)
{
	var FUNCNAME = "GetModbusRTUCfg"
	
	var targetDevice  = device.selectSingleNode(XPATH_ROOTDEVICE)
	//	target device supporta tab input+output?
	
	//	ottiene il protocol dal parent (la porta)
	var protocol = device.parentNode.getAttribute("protocol")
	//	input output on variation
	var modbusInputOutputOnVariation;
	if ( protocol == "ModbusTCP_master" )
		modbusInputOutputOnVariation = genfuncs.ParseBoolean(targetDevice.getAttribute( "ModbusTCPInputOutputOnVariation" ));
	else
		modbusInputOutputOnVariation = genfuncs.ParseBoolean(targetDevice.getAttribute( "ModbusRTUInputOutputOnVariation" ));
	
	var result = {}
	result.name = device.getAttribute("caption");
	result.modbusAddress = parseInt(GetNode(device, "ModbusCustom_config/modbusAddress"))
	result.nodeNumber = parseInt(GetNode(device, "ModbusCustom_config/nodeNumber"))
	result.IPAddress = GetNode(device, "ModbusCustom_config/ip")
	result.minPollTime = parseInt(GetNode(device, "*/minPollTime"))
	result.swapWordsMode = parseInt(device.getAttribute("swapWordsMode"));
	if (isNaN(result.swapWordsMode))
		result.swapWordsMode = 0;
	result.slaveAddressConfigMode = parseInt(GetNode(device, "ModbusCustom_config/slaveAddressConfigMode"))
	result.dynamicSlaveAddress = GetNode(device, "ModbusCustom_config/dynamicSlaveAddress")
	
	result.images = []
	result.params = []
	
	// lettura numero massimo di mappature letto dal dispositivo master
	var rootDevice = device.selectSingleNode(XPATH_ROOTDEVICE)
	var maxMsgMappings = parseInt(rootDevice.getAttribute("maxModbusMsgMappings"))
	if (maxMsgMappings <= 0 || isNaN(maxMsgMappings))
		maxMsgMappings = 9999
	
	// lettura dimensione max messaggio registri e bit del dispositivo slave
	var maxMsgSizeReg = parseInt(device.getAttribute("maxMsgSizeReg"))
	if (maxMsgSizeReg <= 0 || isNaN(maxMsgSizeReg))
		maxMsgSizeReg = MAX_SIZE_REGISTERS
		
	var maxMsgSizeBit = parseInt(device.getAttribute("maxMsgSizeBit"))
	if (maxMsgSizeBit <= 0 || isNaN(maxMsgSizeBit))
		maxMsgSizeBit = MAX_SIZE_BIT
	
	// tipologia di configurazione richiesta dal master (modbus/jbus), per retrocompatibilità vecchi target è quella globale della suite
	if (reqAddressType === undefined)
		reqAddressType = MODBUS_ADDRESS_OFFSET;
	
	// tipologia dello slave corrente
	var addrType = device.getAttribute("addressType");
	if (addrType !== null)
		var devAddressType = (addrType == "modbus") ? MODBUSADDRESSTYPE.MODBUS : MODBUSADDRESSTYPE.JBUS;
	else
		// in caso di attributo mancante in vecchio PCT usa l'impostazione globale
		var devAddressType = DEFAULT_MODBUS_ADDRESS_OFFSET_OF_SLAVES;
	
	// calcolo offset: se richiesto modbus e lo slave è jbus farà +1, se richiesto jbus e lo slave è modbus farà -1
	var addressOffset = devAddressType - reqAddressType;
	result.addressType = devAddressType;
	
	// flag per usare comandi di scrittura singola (solo se 1 registro)
	var useWriteSingleCoil = genfuncs.ParseBoolean(device.getAttribute("useWriteSingleCoil"))
	var useWriteSingleReg  = genfuncs.ParseBoolean(device.getAttribute("useWriteSingleReg"))
	
	// timeout e turnaround sono definiti sono a livello generale per il device
	var timeout = parseInt(GetNode(device, "ModbusCustom_config/timeout"))
	var turnAround = parseInt(GetNode(device, "ModbusCustom_config/turnAround"))
	
	var parList = GetDeviceParameters(device.nodeName)
	if (!parList || parList.length == 0)
		return   // device non trovato tra quelli con parametri
	// trasforma in mappa per ricerca veloce
	var parMap = app.CallFunction("common.ArrayToMap", parList, "ipa")
	
	// mappa per rilevare variabili di field duplicate nell'input
	var usedVars = {}
	
	try
	{
		// parametri da settare al boot
		result.params = GetModbusSendParams(device, parMap, "ModbusCustom_config/sendParams/sendParam", addressOffset)
		
		// mappatura input/output
		var lastMsg
		var xpath = "ModbusCustom_config/inputs/modbusMapping | ModbusCustom_config/outputs/modbusMapping";
		if (modbusInputOutputOnVariation)
			xpath += " | ModbusCustom_config/inputsOutputs/modbusMappingIO";
		
		var nodelist = device.selectNodes(xpath)
		var node
		var pos = 0
		while (node = nodelist.nextNode())
		{
			var enabled = genfuncs.ParseBoolean(GetNode(node, "enabled"));
			if (!enabled)
				continue;
			
			var db = GetNode(node, "dataBlock")
			if (!db && !allowUnassigned)
				// se variabile non assegnata la salta, il messaggio verrà spezzato
				continue
			
			var curVar = new CModbusVar(node, parMap, usedVars, addressOffset, pos)
			
			if (!lastMsg || !lastMsg.CanAdd(curVar))
			{
				// aggiunta non possibile, crea nuovo buffer
				lastMsg = new CModbusMsg(turnAround, timeout, maxMsgMappings, maxMsgSizeReg, maxMsgSizeBit)
				result.images.push(lastMsg)
				
				//	reset pos
				pos = 0
				//	also for curVar (if cannot be added must be reset)
				curVar.pos = 0
			}
			
			// aggiunge la variabile all'ultimo buffer
			lastMsg.Add(curVar, allowUnassigned)
			
			//	next pos
			pos += curVar.size
		}
		
		// dopo aver generato tutte i messaggi fa un ciclo aggiuntivo per correggere le funzioni nel caso di messaggi a singola variabile
		if (useWriteSingleCoil || useWriteSingleReg)
		{
			for (var i = 0; i < result.images.length; i++)
			{
				var msg = result.images[i]
				if (useWriteSingleCoil && msg.vars.length == 1 && msg.funcode == MODBUSFUNC_WRITEMULTIPLECOILS)
				{
					// essendo messaggio da una sola variabile usa il comando 'write single coil' invece di 'write multiple coils'
					msg.funcode = MODBUSFUNC_WRITESINGLECOIL
					msg.vars[0].funcode = MODBUSFUNC_WRITESINGLECOIL
				}
				else if (useWriteSingleReg && msg.vars.length == 1 && msg.vars[0].size == 1 && msg.funcode == MODBUSFUNC_WRITEMULTIPLEREGS)
				{
					// essendo messaggio da una sola variabile usa il comando 'write single reg' invece di 'write multiple regs'
					msg.funcode = MODBUSFUNC_WRITESINGLEREG
					msg.vars[0].funcode = MODBUSFUNC_WRITESINGLEREG
				}
			}
		}

		return result
	}
	catch (ex)
	{
	}
}


function RunModbusCustomEditor(cmdId, filename, singleFileEdit, newDeviceName)
{
	app.TempVar("ModbusCustomEditor_filename") = filename
	app.TempVar("ModbusCustomEditor_catalogModified") = []
	app.TempVar("ModbusCustomEditor_singleFileEdit") = singleFileEdit
	app.TempVar("ModbusCustomEditor_newDeviceName") = newDeviceName
	
	// apre finestra modale
	app.OpenWindow("ModbusCustomEditor", "", "")
	
	var allDeviceids;
	var modifiedDevicesArr = app.TempVar("ModbusCustomEditor_catalogModified")
	if (modifiedDevicesArr && modifiedDevicesArr.length != 0)
	{
		// ricarica il catalogo se modifiche effettuate
		app.CallFunction("catalog.ResetCache", "")
		app.CallFunction("catalog.Load", app.CatalogPath)
		// rifresca il CatalogList
		app.CallFunction("common.OnTreeClick")
		// ricarica le definizioni dei parametri
		allDeviceids = ReloadAllDeviceParameters(modifiedDevicesArr)
	}
	
	// cancella variabili temporanee
	app.TempVar("ModbusCustomEditor_filename") = undefined
	app.TempVar("ModbusCustomEditor_catalogModified") = undefined
	app.TempVar("ModbusCustomEditor_singleFileEdit") = undefined
	app.TempVar("ModbusCustomEditor_newDeviceName") = undefined
	return allDeviceids;
}

// invoca il modbus custom editor in modalità di 'solo new', e poi aggiunge subito lo slave appena creato
function NewModbusCustomSlave()
{
	var allDeviceids = RunModbusCustomEditor(0, undefined, true);
	
	if (allDeviceids && allDeviceids.length)
	{
		var deviceid = allDeviceids[0];
		
		var retval = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + deviceid + "']")
		if (!retval || retval.length == 0)
			return
		
		var curdata = app.HMIGetElementData(TREENAME, "");
		app.CallFunction("common.AddNewDevice", curdata, deviceid, retval[0].getAttribute("template"), retval[0].getAttribute("caption"));
	}
}

function OnLoadNode(node)
{
	var xmldoc = app.GetXMLDocument();
	
	var STR_ONESHOT = "oneshot"
	var STR_ENABLED = "enabled"
	
	var nodelist = node.selectNodes("ModbusCustom_config/inputs/modbusMapping | ModbusCustom_config/outputs/modbusMapping")
	var nodeLoc
	var modified = false
	while (nodeLoc = nodelist.nextNode())
	{
		// aggiunta nodo oneshot
		if (!nodeLoc.selectSingleNode(STR_ONESHOT))
		{
			nodeLoc.appendChild(xmldoc.createElement(STR_ONESHOT));
			modified = true	
		}
		
		// aggiunta nodo enabled
		if (!nodeLoc.selectSingleNode(STR_ENABLED))
		{
			nodeLoc.appendChild(xmldoc.createElement(STR_ENABLED)).text = "1";
			modified = true	
		}
	}

	nodelist = node.selectNodes("ModbusCustom_config/sendParams/sendParam")
	while (nodeLoc = nodelist.nextNode())
	{
		// aggiunta nodo enabled
		if (!nodeLoc.selectSingleNode(STR_ENABLED))
		{
			nodeLoc.appendChild(xmldoc.createElement(STR_ENABLED)).text = "1";
			modified = true	
		}
	}
	
	// aggiunta inputsOutputs
	var nodeModbusCustom_config = node.selectSingleNode("ModbusCustom_config")
	var nodeInputsOutput = nodeModbusCustom_config.selectSingleNode("inputsOutputs")
	if ( !nodeInputsOutput )
	{
		nodeModbusCustom_config.appendChild(xmldoc.createElement("inputsOutputs"));
		modified = true;
	}

	/*	caricamento overlay icona per disabilitazione */
	var enabled = node.getAttribute("enabled")
	if (enabled === null)
	{
		node.setAttribute("enabled", "1")
		enabled = true
	}
	else
		enabled = ParseBoolean(enabled)
	
	if (!enabled)
	{
		var datapath = app.GetDataPathFromNode(node)
		// mette overlay di disabilitazione (X rossa)
		app.HMISetOverlayImg(TREENAME, app.HMIGetElementPath(TREENAME, datapath), TREE_OVERLAY_DISABLED)
	}
	
	/*	aggiunta minPollTime */
	var STR_MINPOLLTIME = "minPollTime"
	var minPollTimeNode = node.selectSingleNode("ModbusCustom_config/" + STR_MINPOLLTIME);
	if ( !minPollTimeNode )
	{
		//	preparo nodo da aggiungere
		minPollTimeNode = xmldoc.createElement(STR_MINPOLLTIME)
		minPollTimeNode.text = "1"
		
		var sendParamsNode = nodeModbusCustom_config.selectSingleNode("sendParams")
			
		//	se c'è altro dopo sendParamsNode (estensione del tipo base)
		if ( sendParamsNode.nextSibling )
		{
			//	inserisco dopo sendParamsNode
			nodeModbusCustom_config.insertBefore(minPollTimeNode, sendParamsNode.nextSibling)
		}
		else
		{
			//	aggiungo in coda
			nodeModbusCustom_config.appendChild(minPollTimeNode)
		}
		modified = true;
	}
	
	/*	aggiunta inputsOutputs */
	var STR_INPUTSOUTPUTS = "inputsOutputs"
	var inputsOutputsNode = node.selectSingleNode("ModbusCustom_config/" + STR_INPUTSOUTPUTS);
	if ( !inputsOutputsNode )
	{
		//	preparo nodo da aggiungere
		inputsOutputsNode = xmldoc.createElement(STR_INPUTSOUTPUTS)
		inputsOutputsNode.text = ""
		
		var minPollTimeNode = nodeModbusCustom_config.selectSingleNode(STR_MINPOLLTIME)
			
		//	se c'è altro dopo minPollTimeNode (estensione del tipo base)
		if ( minPollTimeNode.nextSibling )
		{
			//	inserisco dopo sendParamsNode
			nodeModbusCustom_config.insertBefore(inputsOutputsNode, minPollTimeNode.nextSibling)
		}
		else
		{
			//	aggiungo in coda
			nodeModbusCustom_config.appendChild(inputsOutputsNode)
		}
		modified = true;
	}
	
	/*	aggiunta slaveAddressConfigMode */
	var STR_SLAVEADDRESSINGMODE = "slaveAddressConfigMode"
	var slaveAddressingModeNode = node.selectSingleNode("ModbusCustom_config/" + STR_SLAVEADDRESSINGMODE);
	if ( !slaveAddressingModeNode )
	{
		//	preparo nodo da aggiungere
		slaveAddressingModeNode = xmldoc.createElement(STR_SLAVEADDRESSINGMODE)
		slaveAddressingModeNode.text = "0"
		
		var inputsOutputsNode = nodeModbusCustom_config.selectSingleNode(STR_INPUTSOUTPUTS)
			
		//	se c'è altro dopo inputsOutputsNode (estensione del tipo base)
		if ( inputsOutputsNode.nextSibling )
		{
			//	inserisco dopo inputsOutputsNode
			nodeModbusCustom_config.insertBefore(slaveAddressingModeNode, inputsOutputsNode.nextSibling)
		}
		else
		{
			//	aggiungo in coda
			nodeModbusCustom_config.appendChild(slaveAddressingModeNode)
		}
		modified = true;
	}
	
	/*	aggiunta dynamicSlaveAddress */
	var STR_DYNAMICSLAVEADDRESS = "dynamicSlaveAddress"
	var dynamicSlaveAddressNode = node.selectSingleNode("ModbusCustom_config/" + STR_DYNAMICSLAVEADDRESS);
	if ( !dynamicSlaveAddressNode )
	{
		//	preparo nodo da aggiungere
		dynamicSlaveAddressNode = xmldoc.createElement(STR_DYNAMICSLAVEADDRESS)
		dynamicSlaveAddressNode.text = ""
		
		var slaveAddressingModeNode = nodeModbusCustom_config.selectSingleNode(STR_SLAVEADDRESSINGMODE)
			
		//	se c'è altro dopo slaveAddressingModeNode (estensione del tipo base)
		if ( slaveAddressingModeNode.nextSibling )
		{
			//	inserisco dopo slaveAddressingModeNode
			nodeModbusCustom_config.insertBefore(dynamicSlaveAddressNode, slaveAddressingModeNode.nextSibling)
		}
		else
		{
			//	aggiungo in coda
			nodeModbusCustom_config.appendChild(dynamicSlaveAddressNode)
		}
		modified = true;
	}

	if( modified )
	{
		app.ModifiedFlag = true
		app.PrintMessage( node.getAttribute( "caption" ) + " has been upgraded" );
	}
}

// pulisce TUTTE le variabili mappate al di sotto del device specificato, ma SENZA effettuare il cambio della variabile a automatica!
// invocata tipicamente come 'onpastenode', per evitare un doppio assegnamento della stessa variabile
function ClearAllPLCVarsFromDevice(device)
{
	// ricarica il catalogo se modifiche effettuate
	if( !app.CallFunction("script.ClearAllPLCVarsFromDevice", device ) )
		return false;

	// elenco di tutte le mappature in profondità
	var nodelist = device.selectNodes(".//*[oneshot != '']")
	if (!nodelist || nodelist.length == 0)
		// nulla da fare poichè nessuna var mappata, esce subito
		return true
	
	var node
	while (node = nodelist.nextNode())
		genfuncs.SetNode(node, "oneshot", "")
	
	return true
}


// disassegna TUTTE le variabili mappate al di sotto del device specificato
// invocata tipicamente come 'ondeletenode'
function UnassignAllPLCVarsFromDevice(device)
{
	// ricarica il catalogo se modifiche effettuate
	return ( app.CallFunction("script.UnassignAllPLCVarsFromDevice", device ) &&
			 app.CallFunction("script.UnassignAllPLCVarsFromDeviceWithQuery", device, ".//*[oneshot != '']", "oneshot" ) )
}

#include ModbusCustom_common.js

// funzione invocata da script.OnRefactoringMsg per rinomino istanze variabili dentro XML
function Refactor(deviceNode, objType, oldName, newName)
{
	var querylist = [
		"ModbusCustom_config/inputs/modbusMapping/label",
		"ModbusCustom_config/outputs/modbusMapping/label",
		"ModbusCustom_config/inputs/modbusMapping/oneshot",
		"ModbusCustom_config/outputs/modbusMapping/oneshot",
		"ModbusCustom_config/inputsOutputs/modbusMappingIO/label",
		"ModbusCustom_config/sendParams/sendParam/label"
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
	
	return totReplaced;
}

/*	ESPORTAZIONE MODBUSCUSTOM SLAVE A CATALOGO */

#include ..\ConfiguratorCommon\configurator_app.js

// funzione chiamata da modbus custom editor ed esportazione oggetto modbus nel catalogo
function IsValidDestinationPath(filename)
{
	var path = m_fso.GetParentFolderName(filename)
	var customPath = app.CatalogPath + CATALOG_DESTDIR
	if (path != "" && path.toLowerCase() != customPath.toLowerCase())
	{
		// blocca apertura del file se cartella diversa da ModbusCustom
		app.MessageBox(app.Translate("You can open and save only files in the Catalog\\%1 folder !").replace("%1", CATALOG_DESTDIR), "", gentypes.MSGBOX.MB_ICONERROR)
		return false
	}
	else
		return true
}

// verifica non duplicazione di name+versione e deviceid nel catalogo
// funzione chiamata da modbus custom editor ed esportazione oggetto modbus nel catalogo
function CheckCatalogDuplication(filename, name, version, deviceid, askForOverwrite)
{
	// verifica non duplicazione name+version
	var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@name = '" + name + "' and @version = '" + version + "' and ( protocols/protocol = 'ModbusRTU_master' or protocols/protocol = 'ModbusTCP_master' )]")
	if (nodelist && nodelist.length != 0)
	{
		var template = app.CatalogPath + nodelist[0].getAttribute("template")
		if (template.toLowerCase() != filename.toLowerCase())
		{
			var msg = app.Translate("A device with the same Name+Version already exists in catalog");
			app.MessageBox( msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
			// se c'è già nel catalogo un device con lo stesso name+version (che non è il file attuale) dà errore
			return genfuncs.AddLog(enuLogLevels.LEV_CRITICAL, "Validate", msg);
		}
	}
	
	// verifica non duplicazione deviceid
	var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + deviceid + "']")
	if (nodelist && nodelist.length != 0)
	{
		var template = app.CatalogPath + nodelist[0].getAttribute("template")
		if (template.toLowerCase() != filename.toLowerCase())
		{
			// se c'è già nel catalogo un device con lo stesso deviceID (che non è il file attuale) dà errore
			var msg = app.Translate("A device with the same DeviceID already exists; change Name or Version");
			app.MessageBox( msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
			return genfuncs.AddLog(enuLogLevels.LEV_CRITICAL, "Validate", msg);
		}
		else if (askForOverwrite)	//	se è lo stesso template chiede se continuare
		{
			var msg = app.Translate("Catalog device %1 %2 already exists. Do you want to overwrite it?" ).replace( "%1", name ).replace( "%2", version )
			var caption = app.Translate( "Export object into Catalog" )	
			if ( app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONEXCLAMATION | gentypes.MSGBOX.MB_YESNO ) == gentypes.MSGBOX.IDYES )
				return enuLogLevels.LEV_OK
			else
				return enuLogLevels.LEV_CRITICAL
		}
	}
	
	return enuLogLevels.LEV_OK
}

//	sistema la configurazione prima del salvataggio
function ModbusSlaveExportConfiguration( xmldoc )
{
/*	//	l'implementazione di default lascia abilitato sia la configurazione come slave RTU che TCP
	//	esempio di configurazione custom in cui viene messo il protocollo solo se effettivamente usato:

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
*/
	return true
}

//	handler menu developer
function ModbusCustomExportIntoCatalogAllowed()
{
	var device = app.SelectNodesXML("/" + app.CallFunction("logiclab.get_TargetID"))[0]
	if ( !device )
		return 0x00000
	
	if ( !device.getAttribute("ModbusCustomTemplateFile") )
		return 0x00000
	
	return 0x00001
}

//	launcher menu developer
function ModbusCustomExportIntoCatalog()
{
	var device = app.SelectNodesXML("/" + app.CallFunction("logiclab.get_TargetID"))[0]
	if ( !device )
		return false
	
	ExportAsModbusCustom( device, false )
}

//	launcher menu developer
function ModbusCustomGeneratePCT()
{
	var device = app.SelectNodesXML("/" + app.CallFunction("logiclab.get_TargetID"))[0]
	if ( !device )
		return false
	
	ExportAsModbusCustom( device, true )
}

var TMPFILENAME = "$$tmpNew";

// esportazione dello slave selezionato come nuovo slave modbus custom nel catalogo
// di fatto sarà uguale al pct originale come object dictionary, ma con default di param/input/output differenti
function ExportToCatalogAsNewSlave()
{
	var curdata = app.HMIGetElementData(TREENAME, "");
	var slave = app.SelectNodesXML(curdata)[0];
	
	var srcTemplate = app.CatalogPath + slave.getAttribute("template");
	var destTemplate = m_fso.GetParentFolderName(srcTemplate) + "\\" + TMPFILENAME + ".pct";
	
	var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0");
	xmldoc.async = false;
	if (!xmldoc.load(srcTemplate))
		return;
	
	// copia la cfg dello slave dal progetto dentro il nuovo PCT
	var root = xmldoc.selectSingleNode("/devicetemplate/plcconfig/templatedata/PREFIX");
	root.removeChild(root.selectSingleNode("ModbusCustom_config"));
	root.appendChild(slave.selectSingleNode("ModbusCustom_config").cloneNode(true));
	
	// rimuove tutte le mappature di var PLC
	var nodelist = root.selectNodes("ModbusCustom_config/inputs/modbusMapping | ModbusCustom_config/outputs/modbusMapping");
	var node;
	while (node = nodelist.nextNode())
	{
		node.selectSingleNode("label").text = "";
		node.selectSingleNode("type").text = "";
		node.selectSingleNode("dataBlock").text = "";
		node.selectSingleNode("oneshot").text = "";
	}
	xmldoc.save(destTemplate);
	
	// apre il file temporaneo (sarà cancellato dallo stesso ModbusCustomEditor dopo l'apertura) con nuovo nome forzato
	RunModbusCustomEditor(0, destTemplate, true, slave.getAttribute("caption"));
}

function IsTmpPCTFile(filename)
{
	return m_fso.GetBaseName(filename) === TMPFILENAME;
}

// creazione cartella di lavoro in temp per import/export
function MakeExportTempFolder()
{
	var temp = m_fso.GetSpecialFolder(2) + "\\ModbusCustom_Export_tmp";   // 2=TempFolder
	if (m_fso.FolderExists(temp))
		m_fso.DeleteFolder(temp, true);
		
	m_fso.CreateFolder(temp);
	return temp;
}

// crea uno zip contenente tutto il contenuto della cartella specificata (ricorsivamente, con path relativi)
function ZipFolderContents(srcFolder, destZip)
{
	var shell = new ActiveXObject("WScript.Shell");
	var oldDir = shell.CurrentDirectory;
	// si sposta nella cartella destinazione per creare uno zip con path relativi
	shell.CurrentDirectory = srcFolder;
	
	var cmd = '"' + app.CatalogPath + '..\\Common\\Tools\\zip.exe" -r -9 "' + destZip + '" *.*';
	try
	{
		shell.Run(cmd, 0, true);   //0=hide
	}
	catch (ex)
	{
		app.MessageBox("ERROR executing command:\n" + cmd, "", gentypes.MSGBOX.MB_ICONERROR);
	}
	shell.CurrentDirectory = oldDir;
}

// scompatta il contenuto dello zip nella cartella specificata (deve già esistere)
function UnzipToFolder(srcZip, destFolder)
{
	var shell = new ActiveXObject("WScript.Shell");
	var oldDir = shell.CurrentDirectory;
	shell.CurrentDirectory = destFolder;
	
	var cmd = '"' + app.CatalogPath + '..\\Common\\Tools\\unzip.exe" "' + srcZip + '"';
	try
	{
		shell.Run(cmd, 0, true);   //0=hide
	}
	catch (ex)
	{
		app.MessageBox("ERROR executing command:\n" + cmd, "", gentypes.MSGBOX.MB_ICONERROR);
	}
	shell.CurrentDirectory = oldDir;
}

var MODBUSEXP = "ModbusExp";
var PCT_EXT = "PCT";
var XML_EXT = "XML";

function ExportToFileHelper(slavesList)
{
	var filter = "Slave export file (*." + MODBUSEXP + ")|*." + MODBUSEXP + "|"
	var filename = app.CallFunction("commonDLL.ShowSaveFileDlg", filter, MODBUSEXP, "", "");
	if (!filename)
		return;
	
	var tmpFolder = MakeExportTempFolder();
	
	// salva tutti i PCT
	app.CallFunction("script.BackupAllUserTemplates", tmpFolder, slavesList);
	
	// genera un XML per ogni slave
	for (var i = 0; i < slavesList.length; i++)
	{
		var slave = slavesList[i];
		
		var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0");
		var root = xmldoc.appendChild(xmldoc.createElement("root"));
		var newslave = root.appendChild(slave.cloneNode(true));
		
		// se c'era variabile mappata, pulisce tutti i campi (testa solo dataBlock in modo da non farlo nel caso di MODBUSRTU_MASTER_STRUCT_SLAVES, per conservare la label)
		if (genfuncs.GetNode(newslave, "dataBlock"))
		{
			genfuncs.SetNode(newslave, "label", "");
			genfuncs.SetNode(newslave, "type", "");
			genfuncs.SetNode(newslave, "dataBlock", "");
		}
		genfuncs.SetNode(newslave, "oneshot", "");
		
		xmldoc.save(tmpFolder + "\\" + slave.getAttribute("caption") + "." + XML_EXT);
	}

	ZipFolderContents(tmpFolder, filename);
	m_fso.DeleteFolder(tmpFolder, true);
}

function ExportToFile()
{
	var curdata = app.HMIGetElementData(TREENAME, "");
	var slave = app.SelectNodesXML(curdata)[0];
	var slavesList = [ slave ];
	ExportToFileHelper(slavesList);
}

function ExportToFileMultiple()
{
	var list = [];
	var curdata = app.HMIGetElementData(TREENAME, "");
	var nodelist = app.SelectNodesXML(curdata + "/*");
	var node;
	while (node = nodelist.nextNode())
		// esporta solo gli slaves con PCT in ModbusCustom
		if (genfuncs.StringStartsWith(node.getAttribute("template"), CATALOG_DESTDIR + "\\"))
			// per qualche strana ragione se si mette il node dentro l'attributo value, quando torna indietro il result non è leggibile (?)
			list.push( { name: node.getAttribute("caption"), node: node } );
	
	app.TempVar("GenericList_input") = list
	app.TempVar("GenericList_multipleSel") = true;
	app.OpenWindow("GenericList", app.Translate("Choose slaves to export"), "")
	var result = app.TempVar("GenericList_result")
	if (!result || result.length == 0)
		return
	
	var slavesList = [];
	for (var i = 0; i < result.length; i++)
	{
		var idx = result[i].index;
		slavesList.push(list[idx].node);
	}
	
	ExportToFileHelper(slavesList);
}

function ImportFromFile()
{
	var filter = "Slave export file (*." + MODBUSEXP + ")|*." + MODBUSEXP + "|"
	var filename = app.CallFunction("commonDLL.ShowOpenFileDlg", filter);
	if (!filename)
		return;
	
	var curdata = app.HMIGetElementData(TREENAME, "");
	var destNode = app.SelectNodesXML(curdata)[0];
	
	var tmpFolder = MakeExportTempFolder();
	UnzipToFolder(filename, tmpFolder);
	
	// carica tutti i PCT
	app.CallFunction("script.RestoreAllUserTemplates", tmpFolder);
	
	// aggiunge tutti gli slaves da file XML
	var f = m_fso.GetFolder(tmpFolder)
	for (var enFiles = new Enumerator(f.Files); !enFiles.atEnd(); enFiles.moveNext())
	{
		var filepath = enFiles.item().Path;
		if (m_fso.GetExtensionName(filepath).toUpperCase() != XML_EXT)
			continue;

		var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0");
		xmldoc.async = false;
		if (!xmldoc.load(filepath))
			continue;
		
		var newslave = destNode.appendChild(xmldoc.documentElement.firstChild);
		app.ParseNode(newslave);
	}
	
	m_fso.DeleteFolder(tmpFolder, true);
	app.ModifiedFlag = true;
}
