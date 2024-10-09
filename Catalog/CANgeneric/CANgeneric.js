//	da definire per CANcommon.js
var IS_GENERIC_MODE = true
var CAN_CONFIG_PATH = "CANgeneric_config"
var CAN_MODULE = "CANgeneric"

	// id icone di overlay per l'albero
var TREE_OVERLAY_NONE = 0
var TREE_OVERLAY_DISABLED = 1

#include ../CANcommon/CANcommon.js

//---------------------------------------------------------- EDS E CAN GENERIC DEVICE ------------------------------------------------------

// i seguenti oggetti sono mappe dove la chiave e' l'id del device CAN generic, il valore e' un array

var m_CANgenericDeviceInfo = {}

function GetCANgenericDeviceInfo(id)
{
	return m_CANgenericDeviceInfo[id]
}

/*
mappa (indicizzata per deviceid) con le informazioni su un device CANgeneric:
{
	id: string
	parList:
		[
			{
				name
				description
				type
				readOnly
				address
				min
				max
				defaultValue
				commIndex
				commSubIndex
			}
		]
	PDORxList, PDOTxList:
		[
			{
				numPDO
				bitstart
				index
				subindex
				size
				type
				name
			}
		]
	parMap: {}       (come parlist)
	hasDynamicPDO: bool
	hasBootUpMsg: bool
	realBoolSize: int
	granularity: int
	
	defaultPDOTxTransmission: int
	defaultPDOTxCyclicTime: int
	defaultPDORxTransmission: int
	isPDOTxSyncSupported: bool
	isPDOTxEventSupported: bool
	isPDOTxCyclicSupported: bool
	isPDORxSyncSupported: bool
	isPDORxEventSupported: bool
}
*/

function OnLoadTemplate_CANgeneric(filename, xml)
{
	var i, obj

	// estrae l'id del template appena caricato
	var node = xml.selectSingleNode("/devicetemplate/deviceinfo/@deviceid")
	if (!node) return

	var id = node.nodeTypedValue
	if (!id || id.substr(0, 10) != "CANgeneric")
		return
	
	// se lista parametri gia' caricata esce
	if (m_CANgenericDeviceInfo[id] != undefined)
		return
	
	// caricamento lista da sezione gf_express
	var parList = []
	app.CallFunction("parameters.LoadParameters", xml, parList, "CanOpen")
	
	// crea una mappa per ricerca piu' veloce
	var parMap = new CANParMap()
	
	for (i = 0; i < parList.length; i++)
		parMap.Set(parList[i].commIndex, parList[i].commSubIndex, parList[i])
	
	// inserimento caratteristiche nella mappa di tutti i CANgeneric
	var newitem = {}
	newitem.id = id
	newitem.parList = parList
	newitem.parMap = parMap
	
	// in can generic il numero massimo di pdo in rx e tx puo' essere variato
	// l'informazione e' salvata nel file dati relativi all'oggetto CAN generic del progetto
	newitem.numPDORx = undefined
	newitem.numPDOTx = undefined
	
	// granularita' per allocazione pdo mapping, ovvero dimensione in bit effettiva del piu' piccolo oggetto mappabile
	newitem.granularity = parseInt(GetNode(node, "/devicetemplate/customconfig/canopen/@granularity", 0))
	// estrazione mapping PDO
	newitem.PDORxList = []
	newitem.PDOTxList = []
	// il PDO mapping dinamico deve sempre essere abilitato
	newitem.hasDynamicPDO = true
	// dimensione in bytes per i boolean (default 1)
	newitem.realBoolSize = parseInt(GetNode(node, "/devicetemplate/customconfig/canopen/@realBoolSize", 0))
	// valore da usare per modalita' sync (default 1)
	newitem.transmissionSyncValue = parseInt(GetNode(xml, "/devicetemplate/customconfig/canopen/@transmissionSyncValue", TRANSMISSION_SYNC_VALUE))
	// valore da usare per modalita' event/cyclic (default 255)
	newitem.transmissionEventValue = parseInt(GetNode(xml, "/devicetemplate/customconfig/canopen/@transmissionEventValue", TRANSMISSION_EVENT_VALUE))
	// abilita tutte le possibilita' di trasmsissione
	newitem.defaultPDOTxTransmission = -1
	newitem.defaultPDOTxCyclicTime = -1
	newitem.defaultPDORxTransmission = -1
	newitem.isPDOTxSyncSupported = true
	newitem.isPDOTxEventSupported = true
	newitem.isPDOTxCyclicSupported = true
	newitem.isPDORxSyncSupported = true
	newitem.isPDORxEventSupported = true
		
	m_CANgenericDeviceInfo[id] = newitem
}

// utilizzata per aggiornamento nodi di versioni di PCT vecchie
function OnLoadNode(node)
{
	//caricamento overlay icona per disabilitazione
	var enabled = node.getAttribute("enabled")
	
	if (enabled === null)
	{
		// se attributo enabled non trovato lo aggiunge ora, non ï¿½ infatti stato incrementata la versione di schema,
		// questo per riportare la feature su tutte le versioni precedenti
		node.setAttribute("enabled", "1")
		enabled = true
	}
	else
		enabled = ParseBoolean(enabled)
	
	if (!enabled)
	{
		var datapath = app.GetDataPathFromNode(node)
		// mette overlay di disabilitazione (X rossa)
		app.HMISetOverlayImg("tree1", app.HMIGetElementPath("tree1", datapath), TREE_OVERLAY_DISABLED)
	}
}

function OnCreateNode(node, skipPDO)
{
	var datapath = app.GetDataPathFromNode(node) + "/" + CAN_CONFIG_PATH

	var devinfo = m_CANgenericDeviceInfo[node.nodeName]
	if (!devinfo) return
	
	// OnCreateNode e' anche chiamata esplicitamente da GFX_CAN.js, passando skipPDO=true
	if (!skipPDO)
	{
		// creazione elenco mapping pdo
		list = devinfo.PDORxList
		if (datapath && list)
			CANgeneric_AddToPDOMappingList(list, datapath + "/PDORxMappingList")
		
		list = devinfo.PDOTxList
		if (datapath && list)
			CANgeneric_AddToPDOMappingList(list, datapath + "/PDOTxMappingList")
	}
	
	// settaggio valori iniziali Transmission, se e' presente un default valido
	if (devinfo.defaultPDOTxCyclicTime != -1)
		SetNode(node, CAN_CONFIG_PATH + "/PDOTxCyclicTime", devinfo.defaultPDOTxCyclicTime)
		
	if (devinfo.defaultPDOTxTransmission != -1)
	{
		SetNode(node, CAN_CONFIG_PATH + "/PDOTxTransmission", devinfo.defaultPDOTxTransmission)
		UpdatePDOTxTransmission(node, devinfo.defaultPDOTxTransmission, devinfo.defaultPDOTxCyclicTime)
	}
	
	if (devinfo.defaultPDORxTransmission != -1)
	{
		SetNode(node, CAN_CONFIG_PATH + "/PDORxTransmission", devinfo.defaultPDORxTransmission)
		UpdatePDORxTransmission(node, devinfo.defaultPDORxTransmission)
	}
	
	// generazione sdo
	UpdatePDOMapping(node, "tx")
	UpdatePDOMapping(node, "rx")
}

// aggiunge le variabili presenti nella lista alla PDOMappingList
function CANgeneric_AddToPDOMappingList(parlist, datapath)
{
	// aggiunge le variabili di default traducendole dalla struttura del gf_Express
	for (var i = 0; i < parlist.length; i++)
	{
		var varpath = app.AddTemplateData("PDOmapping", datapath, 0, false)
		var par 	= parlist[i]
		
		app.DataSet(varpath + "/size", 0, par.size)
		app.DataSet(varpath + "/name", 0, par.name)
		
		app.DataSet(varpath + "/ioObject/@objtype", 0, app.CallFunction("parameters.ParTypeToIEC", par.type, par.format))
		// i pdo in uscita dal device sono degli input per il master (e quindi per il plc)
		app.DataSet(varpath + "/ioObject/@inout", 0, (par.typePDO == typePDOTx ? "in" : "out") )
		app.DataSet(varpath + "/ioObject/@PDONumber", 0, par.numPDO)
		app.DataSet(varpath + "/ioObject/@objectIndex", 0, par.index)
		app.DataSet(varpath + "/ioObject/@objectSubIndex", 0, par.subindex)
		app.DataSet(varpath + "/ioObject/@PDOStartBit", 0, par.startbit)
	}
}

function GetDefVal(obj)
{
	if (obj && obj.defaultValue != null && obj.defaultValue != undefined)
		return obj.defaultValue
	else
		return 0
}

function IsDynCfgSlaveNodeID(device)
{
	return ParseBoolean(GetNode(device, CAN_CONFIG_PATH + "/dyncfgNodeNumber"))
}

function GetSlaveNodeID(device)
{
	var slaveNodeID
	
	if ( IsDynCfgSlaveNodeID(device) )
	{
			//	configurazione mediante variabile
		var varName = GetNode(device, CAN_CONFIG_PATH + "/nodeNumberVar")
		var varObj = app.CallFunction( "logiclab.GetGlobalVariable", varName )
		
		var errNode = device.selectSingleNode( CAN_CONFIG_PATH )
		var err = app.CallFunction("common.SplitFieldPath", errNode, "nodeNumberVar")
		if ( !varObj )
		{
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "GetSlaveNodeID", app.Translate("Slave Node ID variable must be specified"), err)
			return
		}
			
		if ( !varObj.IsDataBlock )
		{
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "GetSlaveNodeID", app.Translate("Slave Node ID variable must be a variable mapped on datablock"), err)
			return
		}
		
		if ( varObj.type != "USINT" && varObj.type != "SINT" && varObj.type != "BYTE" )
		{
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "GetSlaveNodeID", app.Translate("Slave Node ID variable must be of USINT/SINT/BYTE type"), err)
			return
		}
		
		slaveNodeID = varObj.dataBlock
	}
	else
	{
			//	configurazione statica
		slaveNodeID = parseInt(GetNode(device, CAN_CONFIG_PATH + "/nodeNumber"))
	}
	
	return slaveNodeID
}

function GetCANInfo(device)
{
	var info = {}
	
	info.DynCfgNodeID = IsDynCfgSlaveNodeID(device)
	
	//	info.NodeID è un valore fisso se info.DynCfgNodeID è false
	//	info.NodeID è il datablock in cui c'è il nodo info.DynCfgNodeID è true
	try
	{		
		info.NodeID = GetSlaveNodeID(device)
	}
	catch (err)
	{
		// la variabile non è definita correttamente
		return
	}
	info.DeviceName = device.getAttribute("caption");
	info.BootTime = parseInt(GetNode(device, CAN_CONFIG_PATH + "/BootTime"))
	info.NodeHbPTime = parseInt(GetNode(device, CAN_CONFIG_PATH + "/NodeHbPTime"))
	info.NodeHbCTime = parseInt(GetNode(device, CAN_CONFIG_PATH + "/NodeHbCTime"))
	info.MasterHbCTime = parseInt(GetNode(device, CAN_CONFIG_PATH + "/MasterHbCTime"))
	info.nodeGuardPeriod = parseInt(GetNode(device, CAN_CONFIG_PATH + "/nodeGuardPeriod"))
	info.lifeTimeFactor = parseInt(GetNode(device, CAN_CONFIG_PATH + "/lifeTimeFactor"))
	info.MandatorySlave = ParseBoolean(GetNode(device, CAN_CONFIG_PATH + "/MandatorySlave"))

	//	l'informazione sulla trasmissione dei PDO TX dal master allo slave ad evento con cyclic mode non finisce in un parametro da inviare allo slave ma ï¿½ una configurazione del master
	info.PDOTxEventMode = ( parseInt(GetNode(device, CAN_CONFIG_PATH + "/PDORxTransmission")) == TRANSMISSION_EVENT )
	if ( info.PDOTxEventMode )
		info.PDOTxEventCycle = parseInt(GetNode(device, CAN_CONFIG_PATH + "/PDORxCycleNum"))
	else
		info.PDOTxEventCycle = 0

	// elenco parametri
	var devinfo = m_CANgenericDeviceInfo[device.nodeName]
	var parMap = devinfo.parMap

	// identificazione, solo se flag apposito attivo
	var identityObjectCheck = ParseBoolean(GetNode(device, CAN_CONFIG_PATH + "/identityObjectCheck"))
	if (identityObjectCheck)
	{
		info.deviceType	 = parseInt(GetNode(device, CAN_CONFIG_PATH + "/identityObjectCheckDeviceTypeID"))
		info.vendorID	 = parseInt(GetNode(device, CAN_CONFIG_PATH + "/identityObjectCheckVendorID"))
		info.productCode = parseInt(GetNode(device, CAN_CONFIG_PATH + "/identityObjectCheckProductCode"))
		info.revision	 = parseInt(GetNode(device, CAN_CONFIG_PATH + "/identityObjectCheckRevision"))
		info.serial		 = parseInt(GetNode(device, CAN_CONFIG_PATH + "/identityObjectCheckSerial"))
	}
	else
	{
		info.deviceType	 = 0
		info.vendorID	 = 0
		info.productCode = 0
		info.revision	 = 0
		info.serial		 = 0
	}
	
	info.waitBootUpMsg = ParseBoolean(GetNode(device, CAN_CONFIG_PATH + "/waitBootUpMsg"))
	
	info.SDODef = {}
	
	// generazione setlist
	info.SDODef.setList = []
	
	nodeslist = device.selectNodes(CAN_CONFIG_PATH + "/SDOsetList/SDOset")
	while (node = nodeslist.nextNode())
	{
		item = {}
		item.Index = parseInt(GetNode(node, "index"))
		item.SubIndex = parseInt(GetNode(node, "subindex"))
		item.DataType = GetNode(node, "type")
		
		if (item.DataType == "BOOL" && devinfo.realBoolSize)
			item.DataLength = devinfo.realBoolSize
		else
			item.DataLength = app.CallFunction("common.GetIECTypeSize", item.DataType)
		
		// permette espressioni tipo $NODEID+x
		item.Value = EvalCANExpr(GetNode(node, "value"), info.NodeID, info.DynCfgNodeID)
		item.TimeOut = parseInt(GetNode(node, "timeout"))
		item.node = node
		
		info.SDODef.setList.push(item)
	}
	
	// generazione sdo scheduling
	info.SDOscheduling = {}
	info.SDOscheduling.SDOscheduledList = []
	
	nodeslist = device.selectNodes(CAN_CONFIG_PATH + "/SDOscheduling/SDOscheduled")
	while (node = nodeslist.nextNode())
	{
		item = {}
		item.Label = GetNode(node, "label")
		item.Direction = parseInt(GetNode(node, "direction"))
		item.Name = GetNode(node, "ioObject/@name")
		item.DataType = GetNode(node, "ioObject/@objtype")
		item.Index = parseInt(GetNode(node, "ioObject/@objectIndex"))
		item.SubIndex = parseInt(GetNode(node, "ioObject/@objectSubIndex"))
		if ( node.selectSingleNode( "oneshot" ) )
			item.OneShot = GetNode(node, "oneshot")
		else
			item.OneShot = ""		
		if ( node.selectSingleNode( "polling" ) )
			item.Polling = parseInt(GetNode(node, "polling"))
		else
			item.Polling = 1	//	sempre
		item.TimeOut = parseInt(GetNode(node, "timeout"))

		if (item.DataType == "BOOL" && devinfo.realBoolSize)
			item.DataLength = devinfo.realBoolSize
		else
			item.DataLength = app.CallFunction("common.GetIECTypeSize", item.DataType)
		
		item.node = node
		
		info.SDOscheduling.SDOscheduledList.push(item)
	}	

	try
	{
		// creazione PDO Tx (riferiti al master, per cui inserisce gli Rx del device slave)
		info.PDOTxList = []

		nodeslist = device.selectNodes(CAN_CONFIG_PATH + "/PDORxMappingList/PDOmapping")
		while (node = nodeslist.nextNode())
		{
			var label = GetNode(node, "label")
				
			var COBIDstr = node.getAttribute("COBIDstr")
			var PDO = PDOTxList_AddVar(device, parMap, info.NodeID, info.PDOTxList, parseInt(GetNode(node, "ioObject/@PDONumber")), GetPDOVar(node), COBIDstr, info.DynCfgNodeID)
			if (!PDO) return
		}
		
		// creazione PDO Rx (riferiti al master, per cui inserisce gli Tx del device slave)
		info.PDORxList = []
		
		nodeslist = device.selectNodes(CAN_CONFIG_PATH + "/PDOTxMappingList/PDOmapping")
		while (node = nodeslist.nextNode())
		{
			var COBIDstr = node.getAttribute("COBIDstr")
			var PDO = PDORxList_AddVar(device, parMap, info.NodeID, info.PDORxList, parseInt(GetNode(node, "ioObject/@PDONumber")), GetPDOVar(node), COBIDstr, info.DynCfgNodeID)
			if (!PDO) return
		}
	}
	catch (err)
	{
		// errore durante il calcolo dei PDO (PDORx() e PDOTx() possono fare throw, di conseguenza anche PDORxList_AddVar() e PDOTxList_AddVar())
		return
	}
	
	return info
}

function UpgradeNode(device, oldversion)
{
	var xmldoc = app.GetXMLDocument()
	
	if (oldversion < 2.0)
	{
		var parent = device.selectSingleNode(CAN_CONFIG_PATH)
		if (!parent.selectSingleNode("waitBootUpMsg"))
		{
			// inserimento DOPO nodo identityObjectCheckSerial (per gestione caso particolare TMIOT101_1p0!)
			var next = parent.selectSingleNode("identityObjectCheckSerial").nextSibling;
			parent.insertBefore(xmldoc.createElement("waitBootUpMsg"), next).text = "0"
		}
	}
	
	if (oldversion < 3.0)
	{
		var parent = device.selectSingleNode(CAN_CONFIG_PATH);
		if (!parent.selectSingleNode("SDOscheduling"))
			parent.appendChild(xmldoc.createElement("SDOscheduling"));
	}
	
	if (oldversion < 4.0)
	{
		var parent = device.selectSingleNode(CAN_CONFIG_PATH);
		if (!parent.selectSingleNode("PDORxCycleNum"))
			parent.appendChild(xmldoc.createElement("PDORxCycleNum")).text = "0"
	}

	if (oldversion < 5.0)
	{
		var parent = device.selectSingleNode(CAN_CONFIG_PATH);
		if (!parent.selectSingleNode("dyncfgNodeNumber"))
			parent.appendChild(xmldoc.createElement("dyncfgNodeNumber")).text = "false"
		if (!parent.selectSingleNode("nodeNumberVar"))
			parent.appendChild(xmldoc.createElement("nodeNumberVar")).text = ""
	}
}

// funzione invocata da script.OnRefactoringMsg per rinomino istanze variabili dentro XML
function Refactor(deviceNode, objType, oldName, newName)
{
	var querylist = [
		"CANgeneric_config/PDOTxMappingList/PDOmapping/label",
		"CANgeneric_config/PDORxMappingList/PDOmapping/label",
		"CANgeneric_config/SDOscheduling/SDOscheduled/label",
		"CANgeneric_config/SDOscheduling/SDOscheduled/oneshot"
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
