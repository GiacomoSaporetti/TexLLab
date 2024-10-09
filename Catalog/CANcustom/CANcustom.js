//	da definire per CANcommon.js
var IS_GENERIC_MODE = false
var CAN_CONFIG_PATH = "CANcustom_config"
var CAN_MODULE = "CANcustom"

	// id icone di overlay per l'albero
var TREE_OVERLAY_NONE = 0
var TREE_OVERLAY_DISABLED = 1

#include ../CANcommon/CANcommon.js

//---------------------------------------------------------- EDS E CAN CUSTOM DEVICE ------------------------------------------------------

// i seguenti oggetti sono mappe dove la chiave è l'id del device CAN custom, il valore è un array

var m_CANCustomDeviceInfo = {}

function GetCANCustomDeviceInfo(id)
{
	return m_CANCustomDeviceInfo[id]
}

/*
mappa (indicizzata per deviceid) con le informazioni su un device CANCustom:
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
	
	enumMap: name -> { value -> descr }
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
	
	identityObjectCheck:
	{
		deviceType
		vendorID
		productCode
		revision
		serial
	}
}
*/

function GetPDOTransmissionFeatures(devinfo)
{
	var parMap = devinfo.parMap
	var result = {}
	
	// features per modalità trasmissione PDO Tx
	result.defaultPDOTxTransmission = -1
	result.defaultPDOTxCyclicTime = -1
	// itera su tutti i pdo possibili in cerca del primo disponibile
	for (var i = 0; i < MAX_PDO; i++)
	{
		obj = parMap.Get(IDX_PDOTX_PARAMS + i, SUBIDX_PDO_MODE)
		if (obj)
		{
			if (obj.defaultValue == devinfo.transmissionSyncValue)
				// il default è sync se 180x.2 == 1
				result.defaultPDOTxTransmission = TRANSMISSION_SYNC
			else if (obj.defaultValue == devinfo.transmissionEventValue)
			{
				// il default è event/cyclic se 180x.2 == 255
				obj = parMap.Get(IDX_PDOTX_PARAMS, SUBIDX_PDO_TIMER)
				if (!obj || obj.defaultValue == 0)
					// se 180x.5 non esiste o è == 0 il default è event
					result.defaultPDOTxTransmission = TRANSMISSION_EVENT
				else
				{
					// se 180x.5 esiste ed è != 0 il default è cyclic
					result.defaultPDOTxTransmission = TRANSMISSION_CYCLIC
					result.defaultPDOTxCyclicTime = obj.defaultValue
				}
			}
			// al primo trovato esce subito
			break
		}
	}
	
	// itera su tutti i PDOTx supportati per verificare il supporto alle varie modalità di comunicazione
	result.isPDOTxSyncSupported = true
	result.isPDOTxEventSupported = true
	result.isPDOTxCyclicSupported = true
	for (var i = 0, cnt = 0; i < MAX_PDO && cnt < devinfo.numPDOTx; i++)
	{
		obj = parMap.Get(IDX_PDOTX_PARAMS + i, SUBIDX_PDO_MODE)
		if (!obj)
			continue  // anche se il pdo manca procede ugualmente, sono ammessi i buchi (ES: numPDOTx=2, ma solo PDO1 e PDO6)
			
		if (obj.min != null && obj.min > devinfo.transmissionSyncValue || 
		    obj.max != null && obj.max < devinfo.transmissionSyncValue ||
			obj.readOnly && obj.defaultValue != devinfo.transmissionSyncValue)
			// il sync NON è supportato se il valore 1 non è accettato nel range min/max (se presente)
			result.isPDOTxSyncSupported = false
			
		if (obj.min != null && obj.min > devinfo.transmissionEventValue || 
		    obj.max != null && obj.max < devinfo.transmissionEventValue ||
			obj.readOnly && obj.defaultValue != devinfo.transmissionEventValue)
		{
			// il event/cyclic NON è supportato se il valore 255 non è accettato nel range min/max (se presente)
			result.isPDOTxEventSupported = false
			result.isPDOTxCyclicSupported = false
		}
		
		obj = parMap.Get(IDX_PDOTX_PARAMS + i, SUBIDX_PDO_TIMER)
		if (obj && obj.min != null && obj.min > 0 ||
		    obj && obj.readOnly && obj.defaultValue != 0)
			// il event NON è supportato se il valore 0 non è accettato nel range min/max (se presente)
			result.isPDOTxEventSupported = false
			
		if (!obj || 
		    obj.max != null && obj.max == 0 ||
			obj.readOnly && obj.defaultValue == 0)
			// il cyclic NON è supportato se 180x.5 non esiste o il min/max non accettano valori != 0
			result.isPDOTxCyclicSupported = false
			
		// incr contatore num pdo
		cnt++
	}
	
	if (cnt == 0)
	{
		// se nessun oggetto trovato disabilita tutte le modalità
		result.isPDOTxSyncSupported = false
		result.isPDOTxEventSupported = false
		result.isPDOTxCyclicSupported = false
	}
	
	
	// features per modalità trasmissione PDO Rx (qui non c'è cyclic)
	result.defaultPDORxTransmission = -1
	// itera su tutti i pdo possibili in cerca del primo disponibile
	for (var i = 0; i < MAX_PDO; i++)
	{
		obj = parMap.Get(IDX_PDORX_PARAMS + i, SUBIDX_PDO_MODE)
		if (obj)
		{
			if (obj.defaultValue == devinfo.transmissionSyncValue)
				// il default è sync se 180x.2 == 1
				result.defaultPDORxTransmission = TRANSMISSION_SYNC
			else if (obj.defaultValue == devinfo.transmissionEventValue)
				// il default è event se 180x.2 == 255
				result.defaultPDORxTransmission = TRANSMISSION_EVENT
				
			// al primo trovato esce subito
			break
		}
	}
	
	// itera su tutti i PDOTx supportati per verificare il supporto alle varie modalità di comunicazione
	result.isPDORxSyncSupported = true
	result.isPDORxEventSupported = true
	for (var i = 0, cnt = 0; i < MAX_PDO && cnt < devinfo.numPDORx; i++)
	{
		obj = parMap.Get(IDX_PDORX_PARAMS + i, SUBIDX_PDO_MODE)
		if (!obj)
			continue  // anche se il pdo manca procede ugualmente, sono ammessi i buchi (ES: numPDOTx=2, ma solo PDO1 e PDO6)
			
		if (obj.min != null && obj.min > devinfo.transmissionSyncValue || 
		    obj.max != null && obj.max < devinfo.transmissionSyncValue ||
			obj.readOnly && obj.defaultValue != devinfo.transmissionSyncValue)
			// il sync NON è supportato se il valore 1 non è accettato nel range min/max (se presente)
			result.isPDORxSyncSupported = false
			
		if (obj.min != null && obj.min > devinfo.transmissionEventValue || 
		    obj.max != null && obj.max < devinfo.transmissionEventValue ||
			obj.readOnly && obj.defaultValue != devinfo.transmissionEventValue)
			// il event NON è supportato se il valore 255 non è accettato nel range min/max (se presente)
			result.isPDORxEventSupported = false
			
		// incr contatore num pdo
		cnt++
	}
	
	if (cnt == 0)
	{
		// se nessun oggetto trovato disabilita tutte le modalità
		result.isPDORxSyncSupported = false
		result.isPDORxEventSupported = false
	}
	
	return result
}

function OnLoadTemplate_CANCustom(filename, xml)
{
	var i, obj

	// estrae l'id del template appena caricato
	var deviceInfoNode = xml.selectSingleNode("/devicetemplate/deviceinfo")
	if (!deviceInfoNode) return
	
	var id = deviceInfoNode.getAttribute("deviceid")
	if (!id) return
	
	if (!( id.substr(0, 9) == "CANcustom" || ParseBoolean(deviceInfoNode.getAttribute("CANcustom")) ))
		return
	
	// se lista parametri già caricata esce
	if (m_CANCustomDeviceInfo[id] != undefined)
		return
	
	// caricamento lista da sezione parametri
	var parList = []
	app.CallFunction("parameters.LoadParameters", xml, parList, "CanOpen")
	
	// caricamento enumerativi da sezione parametri
	var enumMap = {}
	app.CallFunction("parameters.LoadEnums", xml, enumMap)

	// crea una mappa per ricerca più veloce
	var parMap = new CANParMap()
	
	for (i = 0; i < parList.length; i++)
		parMap.Set(parList[i].commIndex, parList[i].commSubIndex, parList[i])
	
	// inserimento caratteristiche nella mappa di tutti i CANCustom
	var newitem = {}
	newitem.id = id
	newitem.parList = parList
	newitem.parMap = parMap
	newitem.enumMap = enumMap
	
	// lettura numero PDO rx e tx da sezione customconfig del gft
	var node = xml.selectSingleNode("/devicetemplate/customconfig/canopen/@numPDORx")
	if (!node) return
	newitem.numPDORx = parseInt(node.text)
	
	node = xml.selectSingleNode("/devicetemplate/customconfig/canopen/@numPDOTx")
	if (!node) return
	newitem.numPDOTx = parseInt(node.text)
	
	// granularità per allocazione pdo mapping, ovvero dimensione in bit effettiva del più piccolo oggetto mappabile
	newitem.granularity = parseInt(GetNode(xml, "/devicetemplate/customconfig/canopen/@granularity", 0))
	// estrazione mapping PDO
	newitem.PDORxList = GetPDOMapping(parMap, IDX_PDORX_MAPPING, newitem.numPDORx, typePDORx, newitem.granularity)
	newitem.PDOTxList = GetPDOMapping(parMap, IDX_PDOTX_MAPPING, newitem.numPDOTx, typePDOTx, newitem.granularity)
	// flag che abilita la configurazione del PDO mapping dinamico
	newitem.hasDynamicPDO = ParseBoolean(GetNode(xml, "/devicetemplate/customconfig/canopen/@hasDynamicPDO"))
	// flag che abilita la modalita di riconoscimento del nodo mediante messaggio di bootup da parte del nodo
	newitem.hasBootUpMsg = ParseBoolean(GetNode(xml, "/devicetemplate/customconfig/canopen/@hasBootUpMsg"))
	// dimensione in bytes per i boolean (default 1)
	newitem.realBoolSize = parseInt(GetNode(xml, "/devicetemplate/customconfig/canopen/@realBoolSize", 0))
	// valore da usare per modalità sync (default 1)
	newitem.transmissionSyncValue  = parseInt(GetNode(xml, "/devicetemplate/customconfig/canopen/@transmissionSyncValue", TRANSMISSION_SYNC_VALUE))
	// valore da usare per modalità event/cyclic (default 255)
	newitem.transmissionEventValue = parseInt(GetNode(xml, "/devicetemplate/customconfig/canopen/@transmissionEventValue", TRANSMISSION_EVENT_VALUE))
	
	// informazioni sul device che sono controllate se identity object check è attivato
	newitem.identityObjectCheck = {}
	newitem.identityObjectCheck.deviceType = GetDefVal(parMap.Get(0x1000,0))
	newitem.identityObjectCheck.vendorID = GetDefVal(parMap.Get(IDX_IDENTITY,1))
	newitem.identityObjectCheck.productCode = GetDefVal(parMap.Get(IDX_IDENTITY,2))
	newitem.identityObjectCheck.revision = GetDefVal(parMap.Get(IDX_IDENTITY,3))
	newitem.identityObjectCheck.serial = GetDefVal(parMap.Get(IDX_IDENTITY,4))
		
	var result = GetPDOTransmissionFeatures(newitem)
	for (i in result)
		newitem[i] = result[i]
		
	m_CANCustomDeviceInfo[id] = newitem
}

// utilizzata per aggiornamento nodi di versioni di PCT vecchie
function OnLoadNode(node)
{
	var cfg = node.selectSingleNode(CAN_CONFIG_PATH)
	
	// il nodo identityObjectCheck è stato aggiunto successivamente
	// visto che non è possibile modificare i PCT già a catalogo lo aggiunge qui
	var check = cfg.selectSingleNode("identityObjectCheck")
	if (!check)
	{
		check = cfg.appendChild(app.GetXMLDocument().createElement("identityObjectCheck"))
		check.text = 1
	}
	
	// il nodo MandatorySlave è stato aggiunto successivamente
	// visto che non è possibile modificare i PCT già a catalogo lo aggiunge qui
	var mandatory = cfg.selectSingleNode("MandatorySlave")
	if (!mandatory)
	{
		mandatory = cfg.appendChild(app.GetXMLDocument().createElement("MandatorySlave"))
		mandatory.text = 0
	}
	
	// il nodo PDOAutoMapping è stato aggiunto successivamente
	// visto che non è possibile modificare i PCT già a catalogo lo aggiunge qui
	var PDOAutoMapping = cfg.selectSingleNode("PDOAutoMapping")
	if (!PDOAutoMapping)
	{
		PDOAutoMapping = cfg.appendChild(app.GetXMLDocument().createElement("PDOAutoMapping"))
		PDOAutoMapping.text = 0
	}
	
	// il nodo identityObjectCheckRevision è stato aggiunto successivamente
	// visto che non è possibile modificare i PCT già a catalogo lo aggiunge qui
	var identityObjectCheckRevision = cfg.selectSingleNode("identityObjectCheckRevision")
	if (!identityObjectCheckRevision)
	{
		identityObjectCheckRevision = cfg.appendChild(app.GetXMLDocument().createElement("identityObjectCheckRevision"))
		identityObjectCheckRevision.text = "0x0"
	}
	
	// il nodo identityObjectCheckSerial è stato aggiunto successivamente
	// visto che non è possibile modificare i PCT già a catalogo lo aggiunge qui
	var identityObjectCheckSerial = cfg.selectSingleNode("identityObjectCheckSerial")
	if (!identityObjectCheckSerial)
	{
		identityObjectCheckSerial = cfg.appendChild(app.GetXMLDocument().createElement("identityObjectCheckSerial"))
		identityObjectCheckSerial.text = "0x0"
	}
	
	//caricamento overlay icona per disabilitazione
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
		app.HMISetOverlayImg("tree1", app.HMIGetElementPath("tree1", datapath), TREE_OVERLAY_DISABLED)
	}
	
	// il nodo SDOscheduling è stato aggiunto successivamente
	// visto che non è possibile modificare i PCT già a catalogo lo aggiunge qui
	var SDOscheduling = cfg.selectSingleNode("SDOscheduling")
	if (!SDOscheduling)
		cfg.appendChild(app.GetXMLDocument().createElement("SDOscheduling"))

	// il nodo PDORxCycleNum è stato aggiunto successivamente
	// visto che non è possibile modificare i PCT già a catalogo lo aggiunge qui
	var PDORxCycleNum = cfg.selectSingleNode("PDORxCycleNum")
	if (!PDORxCycleNum)
	{
		var PDORxCycleNum = cfg.appendChild(app.GetXMLDocument().createElement("PDORxCycleNum"))
		PDORxCycleNum.text = "0"	// di base aggiunge senza spedizione ciclica
	}
	
	// il nodo dyncfgNodeNumber è stato aggiunto successivamente
	// visto che non è possibile modificare i PCT già a catalogo lo aggiunge qui
	var dyncfgNodeNumber = cfg.selectSingleNode("dyncfgNodeNumber")
	if (!dyncfgNodeNumber)
	{
		var dyncfgNodeNumber = cfg.appendChild(app.GetXMLDocument().createElement("dyncfgNodeNumber"))
		dyncfgNodeNumber.text = "false"
	}
	
	// il nodo dyncfgNodeNumber è stato aggiunto successivamente
	// visto che non è possibile modificare i PCT già a catalogo lo aggiunge qui
	var nodeNumberVar = cfg.selectSingleNode("nodeNumberVar")
	if (!nodeNumberVar)
	{
		var nodeNumberVar = cfg.appendChild(app.GetXMLDocument().createElement("nodeNumberVar"))
		nodeNumberVar.text = ""
	}			
}

function OnCreateNode(node, skipPDO)
{
	var datapath = app.GetDataPathFromNode(node) + "/" + CAN_CONFIG_PATH

	var devinfo = m_CANCustomDeviceInfo[node.nodeName]
	if (!devinfo) return
	
	// OnCreateNode è anche chiamata esplicitamente da GFX_CAN.js, passando skipPDO=true
	if (!skipPDO)
	{
		// creazione elenco mapping pdo
		list = devinfo.PDORxList
		if (datapath && list)
			CANCustom_AddToPDOMappingList(list, datapath + "/PDORxMappingList")
		
		list = devinfo.PDOTxList
		if (datapath && list)
			CANCustom_AddToPDOMappingList(list, datapath + "/PDOTxMappingList")
	}
	
	// settaggio valori iniziali Transmission, se è presente un default valido
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
function CANCustom_AddToPDOMappingList(parlist, datapath)
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
	if (obj && obj.defaultValue != null && obj.defaultValue != undefined && obj.defaultValue != "")
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

/* GetCANInfo ritorna un oggetto così strutturato:
{
	DynCfgNodeID (bool)
	NodeID (int)
	DeviceName (string)
	BootTime (int)
	NodeHbPTime (int)
	NodeHbCTime (int)
	MasterHbCTime (int)
	nodeGuardPeriod (int)
	lifeTimeFactor (int)
	MandatorySlave (bool)
	PDOTxEventMode (bool)
	PDOTxEventCycle (int)
	deviceType	 (int)
	vendorID	 (int)
	productCode (int)
	revision	 (int)
	serial		 (int)
	waitBootUpMsg (bool)
	
	SDODef 
	{
		setList
		[
			{
				Index (int)
				SubIndex (int)
				DataType (string)
				DataLength (int)
				Value (variant)
				TimeOut (int)
				node (object)
			}
		]
	}
	
	SDOscheduling
	{
		SDOscheduledList
		[
			{
				Label (string)
				Direction (int)
				Name (string)
				DataType (string)
				Index (int)
				SubIndex (int)
				TimeOut (int)
				OneShot (string)
				Polling (int)
				DataLength (int)
				node (object)
			}
		]
	}
	
	PDOTxList, PDORxList       // RX e TX riferiti al master
	[
		{
			COBID (int)
			num (int)
			size (int)
			numMappedVars (int)
			vars
			[
				{
					VarLabel (string)
					BitStart (int)
					BitLength (int)
					objectIndex (int)
					objectSubIndex (int)
					dataBlock (string)       datablock della variabile PLC associata
					type (string)            tipo IEC della variabile PLC associata
					node (object)            nodo XML per posizionamento errore
				}
			]
		}
	]
}
*/
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

	//	l'informazione sulla trasmissione dei PDO TX dal master allo slave ad evento con cyclic mode non finisce in un parametro da inviare allo slave ma è una configurazione del master
	info.PDOTxEventMode = ( parseInt(GetNode(device, CAN_CONFIG_PATH + "/PDORxTransmission")) == TRANSMISSION_EVENT )
	if ( info.PDOTxEventMode )
		info.PDOTxEventCycle = parseInt(GetNode(device, CAN_CONFIG_PATH + "/PDORxCycleNum"))
	else
		info.PDOTxEventCycle = 0

	// elenco parametri
	var devinfo = m_CANCustomDeviceInfo[device.nodeName]
	var parMap = devinfo.parMap

	// identificazione, solo se flag apposito attivo
	var identityObjectCheck = ParseBoolean(GetNode(device, CAN_CONFIG_PATH + "/identityObjectCheck"))
	if (identityObjectCheck)
	{
		info.deviceType	 = GetDefVal(parMap.Get(0x1000,0))
		info.vendorID	 = GetDefVal(parMap.Get(IDX_IDENTITY,1))
		info.productCode = GetDefVal(parMap.Get(IDX_IDENTITY,2))
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
	
	//	l'informazione sul bootup msg viene scelta in fase di importazione dell'EDS
	info.waitBootUpMsg = ParseBoolean(devinfo.hasBootUpMsg)
	
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
		if ( item.Label == "" )	//	se non c'è la variabile proseguo
			continue
		item.Direction = parseInt(GetNode(node, "direction"))
		item.Name = GetNode(node, "ioObject/@name")
		item.DataType = GetNode(node, "ioObject/@objtype")
		item.Index = parseInt(GetNode(node, "ioObject/@objectIndex"))
		item.SubIndex = parseInt(GetNode(node, "ioObject/@objectSubIndex"))
		item.TimeOut = parseInt(GetNode(node, "timeout"))
		if ( node.selectSingleNode( "oneshot" ) )
			item.OneShot = GetNode(node, "oneshot")
		else
			item.OneShot = ""		
		if ( node.selectSingleNode( "polling" ) )
			item.Polling = parseInt(GetNode(node, "polling"))
		else
			item.Polling = 1	//	sempre
		
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
				
			var PDO = PDOTxList_AddVar(device, parMap, info.NodeID, info.PDOTxList, parseInt(GetNode(node, "ioObject/@PDONumber")), GetPDOVar(node), undefined, info.DynCfgNodeID)
			if (!PDO) return
		
			// memorizza nel nodo l'ultimo cobid calcolato (per visualizzarlo in griglia)
			if ( info.DynCfgNodeID )
			{
				node.setAttribute("COBID", "0")
				node.setAttribute("COBIDstr", PDO.COBID)
			}
			else
			{
				node.setAttribute("COBID", PDO.COBID)
				node.setAttribute("COBIDstr", "")
			}
		}
		
		// creazione PDO Rx (riferiti al master, per cui inserisce gli Tx del device slave)
		info.PDORxList = []
		
		nodeslist = device.selectNodes(CAN_CONFIG_PATH + "/PDOTxMappingList/PDOmapping")
		while (node = nodeslist.nextNode())
		{
			var PDO = PDORxList_AddVar(device, parMap, info.NodeID, info.PDORxList, parseInt(GetNode(node, "ioObject/@PDONumber")), GetPDOVar(node), undefined, info.DynCfgNodeID)
			if (!PDO) return
		
			// memorizza nel nodo l'ultimo cobid calcolato (per visualizzarlo in griglia)
			if ( info.DynCfgNodeID )
			{
				node.setAttribute("COBID", "0")
				node.setAttribute("COBIDstr", PDO.COBID)
			}
			else
			{
				node.setAttribute("COBID", PDO.COBID)
				node.setAttribute("COBIDstr", "")
			}
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
}

function ResetAllDeviceParameters()
{
	m_CANCustomDeviceInfo = {}
}

// ricaricamento di TUTTE le definizioni di tutti i ModbusCustom
function ReloadAllDeviceParameters()
{
	ResetAllDeviceParameters()
	
	var nodelist = app.SelectNodesXML("//*[@insertable and @ExtensionName = 'CANcustom']")
	if (nodelist && nodelist.length != 0)
	{
		var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0")
		xmldoc.async = false
		
		var node
		while (node = nodelist.nextNode())
		{
			var filename = app.CatalogPath + node.getAttribute("template")
			// ATTENZIONE: non viene fatto preprocess del XML del PCT! le #define non vengono quindi espanse!
			if (xmldoc.load(filename))
				OnLoadTemplate_CANCustom(filename, xmldoc)
		}
	}
}

function RunCANcustomEditor(cmdId, filename)
{
	app.TempVar("CANcustomEditor_filename") = filename
	app.TempVar("CANcustomEditor_catalogModified") = false
	
	// apre finestra modale
	app.OpenWindow("CANcustomEditor", "", "")
	
	if (app.TempVar("CANcustomEditor_catalogModified"))
	{
		// ricarica il catalogo se modifiche effettuate
		app.CallFunction("catalog.ResetCache", "")
		app.CallFunction("catalog.Load", app.CatalogPath)
		// rifresca il CatalogList
		app.CallFunction("common.OnTreeClick")
		// ricarica le definizioni dei parametri
		app.CallFunction("CANcustom.ReloadAllDeviceParameters")
	}
	
	// cancella variabili temporanee
	app.TempVar("CANcustomEditor_filename") = undefined
	app.TempVar("CANcustomEditor_catalogModified") = undefined
}

// funzione invocata da script.OnRefactoringMsg per rinomino istanze variabili dentro XML
function Refactor(deviceNode, objType, oldName, newName)
{
	var querylist = [
		"CANcustom_config/PDOTxMappingList/PDOmapping/label",
		"CANcustom_config/PDORxMappingList/PDOmapping/label",
		"CANcustom_config/SDOscheduling/SDOscheduled/label",
		"CANcustom_config/SDOscheduling/SDOscheduled/oneshot"
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

/*	ESPORTAZIONE CANCUSTOM SLAVE A CATALOGO */

#include ..\ConfiguratorCommon\configurator_app.js

function IsValidDestinationPath(filename)
{
	// cartella contenente tutti i files custom
	var CATALOG_DESTDIR = app.CallFunction("EDS.GetCatalogDestDir")
	
	var fso = app.CallFunction("common.CreateObject", "Scripting.FileSystemObject")
	var path = fso.GetParentFolderName(filename)
	var customPath = app.CatalogPath + CATALOG_DESTDIR
	
	if (path != "" && path.toLowerCase() != customPath.toLowerCase())
	{
		// blocca apertura del file se cartella diversa da ModbusCustom
		app.MessageBox(app.Translate("You can open and save only files in the Catalog\\%1 folder !").replace("%1", CATALOG_DESTDIR), "", MSGBOX.MB_ICONERROR)
		return false
	}
	else
		return true
}

// verifica non duplicazione di name+versione e deviceid nel catalogo
function CheckCatalogDuplication(filename, name, version, deviceid, askForOverwrite)
{
	// verifica non duplicazione name+version
	var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@name = '" + name + "' and @version = '" + version + "' and ( protocols/protocol = 'CANopen_master' )]")
	if (nodelist && nodelist.length != 0)
	{
		var template = app.CatalogPath + nodelist[0].getAttribute("template")
		if (template.toLowerCase() != filename.toLowerCase())
			// se c'è già nel catalogo un device con lo stesso name+version (che non è il file attuale) dà errore
			return genfuncs.AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("A device with the same Name+Version already exists in catalog"), XPATH_DEVICEINFO_NAME)
	}
	
	// verifica non duplicazione deviceid
	var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + deviceid + "']")
	if (nodelist && nodelist.length != 0)
	{
		var template = app.CatalogPath + nodelist[0].getAttribute("template")
		if (template.toLowerCase() != filename.toLowerCase())
		{
			// se c'è già nel catalogo un device con lo stesso deviceID (che non è il file attuale) dà errore
			return genfuncs.AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Another device with the same DeviceID already exists. Please change Name or Version"), XPATH_DEVICEINFO_NAME)
		}
		else if ( askForOverwrite )	//	se è lo stesso template chiede se continuare
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

// questa funzione viene chiamata in fase di esportazione del CANcustom slave
// xmldoc è il CANcustom che sta per essere esportato a catalogo
// questa funzione mette i valori di default effettivi settati nella configurazione dello slave
function CANopenSlaveExportSetObjDictDefaultValue( xmldoc, index, subindex, value )
{
	var CANcustom_ObjDictNode = xmldoc.selectSingleNode( "devicetemplate/deviceconfig/parameters/par[protocol/@name='CanOpen' and protocol/@commaddr='" + index.toString(10) + "' and protocol/@commsubindex='" + subindex.toString(10) + "']" )
	if ( !CANcustom_ObjDictNode )
		return
	
	CANcustom_ObjDictNode.setAttribute( "defval", value )
}

function CANopenSlaveExportSetPDOConfiguration( xmldoc, CANopenSlaveNode, TxMode )
{
	var granularity = 8
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var device = app.SelectNodesXML("/" + targetID)[0]
	var paramDBMap = app.CallFunction(targetID + ".GetParamMap", false, true, 0x2000, undefined, false )
	// inserisco i dummy object mappabili
	paramDBMap["0x1.0"] = {index: "0x1", subindex: 0, name: "Dummy Object BOOLEAN", type: "BOOL", readonly: 0, description: ""}
	paramDBMap["0x2.0"] = {index: "0x2", subindex: 0, name: "Dummy Object INTEGER8", type: "SINT", readonly: 0, description: ""}
	paramDBMap["0x3.0"] = {index: "0x3", subindex: 0, name: "Dummy Object INTEGER16", type: "INT", readonly: 0, description: ""}
	paramDBMap["0x4.0"] = {index: "0x4", subindex: 0, name: "Dummy Object INTEGER32", type: "DINT", readonly: 0, description: ""}
	paramDBMap["0x5.0"] = {index: "0x5", subindex: 0, name: "Dummy Object UNSIGNED8", type: "BYTE", readonly: 0, description: ""}
	paramDBMap["0x6.0"] = {index: "0x6", subindex: 0, name: "Dummy Object UNSIGNED16", type: "WORD", readonly: 0, description: ""}
	paramDBMap["0x7.0"] = {index: "0x7", subindex: 0, name: "Dummy Object UNSIGNED32", type: "DWORD", readonly: 0, description: ""}
	
	if ( TxMode )
	{
		var PDONodeList = CANopenSlaveNode.selectNodes( "CANslave_PDOgroup_TX/*/PDO_config" )
		var PDOTTBase = 0x1800
		var PDOEntryBase = 0x1A00
	}
	else
	{
		var PDONodeList = CANopenSlaveNode.selectNodes( "CANslave_PDOgroup_RX/*/PDO_config" )
		var PDOTTBase = 0x1400
		var PDOEntryBase = 0x1600
	}
	
	var PDONode
	while ( PDONode = PDONodeList.nextNode() )
	{
		var num = parseInt( GetNode( PDONode, "Number" ) )
		var off = num - 1
		var cobid = parseInt( GetNode( PDONode, "COBID" ) )
		var tt = parseInt( GetNode( PDONode, "TransmissionType" ) )
		var eventTimer = parseInt( GetNode( PDONode, "EventTimer" ) )
		
		//	CANopenSlaveExportSetObjDictDefaultValue( xmldoc, PDOTTBase + off, 1, cobid )
		CANopenSlaveExportSetObjDictDefaultValue( xmldoc, PDOTTBase + off, 2, tt )
		CANopenSlaveExportSetObjDictDefaultValue( xmldoc, PDOTTBase + off, 5, eventTimer )
		
		var PDOEntryNodeList = PDONode.selectNodes( "PDO_entryList/PDO_entry" )
		if ( !PDOEntryNodeList )
			continue
		
		var PDOEntryNodeListCount = PDOEntryNodeList.length		
		CANopenSlaveExportSetObjDictDefaultValue( xmldoc, PDOEntryBase + off, 0, PDOEntryNodeListCount )
		
		var PDOEntryListNode = PDONode.selectSingleNode( "PDO_entryList" )
		var entry = 0
		for ( var i = 0; i < 8; i++ )
		{
			PDOEntryNode = PDOEntryListNode.selectSingleNode( "PDO_entry[BitStart='" + ( 8 * i ) + "']" )
			if ( PDOEntryNode )
			{
				var index = parseInt( GetNode( PDOEntryNode, "index" ) )
				var subindex = parseInt( GetNode( PDOEntryNode, "subindex" ) )
				var key = "0x" + index.toString( 16 ) + "." + subindex
				var par = paramDBMap[ key ]
				if ( !par )
				{
					app.PrintMessage( "Cannot find parameter " + key + " into database" )
					return false
				}
				
				//	calcola valore
				var typeIEC = par.type
				var size = app.CallFunction("common.GetIECTypeBits", typeIEC)
				if ( size < granularity )
					size = granularity	//	BOOL viene trattato come BYTE
							
				//	compongo il valore da settare 0x[16bit index][8bit subindex][8bit size]
				var value = 0
				value = index
				value = value << 8
				value |= ( subindex & 0xFF )
				value = value << 8
				value |= ( size & 0xFF )
				if ( value < 0 ) value = 4294967296 + value		// segno sempre positivo
				value = value.toString( 16 )
				for ( var s = value.length; s < 8; s++ ) value = "0" + value	// zero padding
				var defval = "0x" + value
				
				entry++
				CANopenSlaveExportSetObjDictDefaultValue( xmldoc, PDOEntryBase + off, entry, defval )
			}
		}
	}
	
	return true
}

//	sistema la configurazione prima del salvataggio
function CANopenSlaveExportConfiguration( xmldoc )
{
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var device = app.SelectNodesXML("/" + targetID)[0]
	
	var CANopenSlaveNode;
	var funcname = targetID + ".GetCANopenSlaveNode";
	if (app.FunctionExists(funcname))
		CANopenSlaveNode = app.CallFunction(funcname, device);
	else
		// vecchio codice obsoleto, e troppo specifico per target LLExec...
		CANopenSlaveNode = device.selectSingleNode( "CANopen[ @mode = '2' ]" )

	if ( !CANopenSlaveNode )
	{
		app.MessageBox( app.Translate( "Cannot export CANopen slave device.\nCurrent target is not configured for CANopen slave." ), "Export CANopen slave", gentypes.MSGBOX.MB_ICONEXCLAMATION|gentypes.MSGBOX.MB_CANCEL )
		return false
	}
	
	//	controllo granularità, al momento 8 è unica supportata	
	var granularity = CANopenSlaveNode.getAttribute( "slaveCfgGranularity" )
	if ( granularity != 8 )
	{
		app.MessageBox( app.Translate( "Cannot export CANopen slave device.\nOnly granularity 8 is supported." ), "Export CANopen slave", gentypes.MSGBOX.MB_ICONEXCLAMATION|gentypes.MSGBOX.MB_CANCEL )
		return false
	}
	
	//	controllo auto assignment (supportato solo con auto assignment true)
	var autoAssignment = genfuncs.ParseBoolean( CANopenSlaveNode.getAttribute( "slaveCfgCOBIDAutoAssignment" ) )
	if ( !autoAssignment )
	{
		app.MessageBox( app.Translate( "Cannot export CANopen slave device.\nOnly cobid auto assignment mode is supported." ), "Export CANopen slave", gentypes.MSGBOX.MB_ICONEXCLAMATION|gentypes.MSGBOX.MB_CANCEL )
		return false
	}

	//	questo è il template in cui dovranno essere settate queste impostazioni
	var CANcustom_configNode = xmldoc.selectSingleNode( "devicetemplate/plcconfig/templatedata/PREFIX/CANcustom_config" )
	var CANcustom_customConfigNode = xmldoc.selectSingleNode( "devicetemplate/customconfig/canopen" )
	
	SetNode( CANcustom_configNode, "nodeNumber", CANopenSlaveNode.getAttribute( "slaveNodeID" ) )
	CANopenSlaveExportSetObjDictDefaultValue( xmldoc, 0x1000, 0, CANopenSlaveNode.getAttribute( "slaveDeviceType" ) )
	//SetNode( CANcustom_configNode, "slaveSyncCOBID", CANopenSlaveNode.getAttribute( "slaveSyncCOBID" ) )
	//SetNode( CANcustom_configNode, "slaveSyncCycle", CANopenSlaveNode.getAttribute( "slaveSyncCycle" ) )
	//CANopenSlaveNode.getAttribute( "slaveManufacturerDeviceName" )
	//CANopenSlaveNode.getAttribute( "slaveManufacturerHardwareVer" )
	//CANopenSlaveNode.getAttribute( "slaveManufacturerSoftwareVer" )
	SetNode( CANcustom_configNode, "nodeGuardPeriod", CANopenSlaveNode.getAttribute( "slaveGuardTime" ) )
	SetNode( CANcustom_configNode, "lifeTimeFactor", CANopenSlaveNode.getAttribute( "slaveLifeTimeFactor" ) )
	SetNode( CANcustom_configNode, "NodeHbCTime", CANopenSlaveNode.getAttribute( "slaveConsumerHeartbeatTime" ) )
	SetNode( CANcustom_configNode, "NodeHbPTime", CANopenSlaveNode.getAttribute( "slaveProducerHeartbeatTime" ) )
	CANopenSlaveExportSetObjDictDefaultValue( xmldoc, 0x1018, 1, CANopenSlaveNode.getAttribute( "slaveVendorID" ) )
	CANopenSlaveExportSetObjDictDefaultValue( xmldoc, 0x1018, 2, CANopenSlaveNode.getAttribute( "slaveProductCode" ) )
	CANopenSlaveExportSetObjDictDefaultValue( xmldoc, 0x1018, 3, CANopenSlaveNode.getAttribute( "slaveRevisionNumber" ) )
	CANopenSlaveExportSetObjDictDefaultValue( xmldoc, 0x1018, 4, CANopenSlaveNode.getAttribute( "slaveSerialNumber" ) )
	
	SetNode( CANcustom_customConfigNode, "granularity", granularity )
	SetNode( CANcustom_customConfigNode, "numPDOTx", CANopenSlaveNode.getAttribute( "slaveCfgMaxTPDONum" ) )
	SetNode( CANcustom_customConfigNode, "numPDORx", CANopenSlaveNode.getAttribute( "slaveCfgMaxRPDONum" ) )	
	
	//	configurazione PDO TX/RX
	if ( !CANopenSlaveExportSetPDOConfiguration( xmldoc, CANopenSlaveNode, true ) )		//	TX
	{
		app.MessageBox( app.Translate( "Cannot export CANopen slave device.\nPDO Tx configuration error" ), "Export CANopen slave", gentypes.MSGBOX.MB_ICONEXCLAMATION|gentypes.MSGBOX.MB_CANCEL )
		return false
	}
	if ( !CANopenSlaveExportSetPDOConfiguration( xmldoc, CANopenSlaveNode, false ) )	//	RX
	{
		app.MessageBox( app.Translate( "Cannot export CANopen slave device.\nPDO Rx configuration error" ), "Export CANopen slave", gentypes.MSGBOX.MB_ICONEXCLAMATION|gentypes.MSGBOX.MB_CANCEL )
		return false
	}		
	
	return true
}

//	handler menu developer
function CANcustomExportIntoCatalogAllowed()
{
	var device = app.SelectNodesXML("/" + app.CallFunction("logiclab.get_TargetID"))[0]
	if ( !device )
		return 0x00000
	
	if ( !device.getAttribute("CANcustomTemplateFile") )
		return 0x00000
	
	return 0x00001
}

//	launcher menu developer
function CANcustomExportIntoCatalog()
{
	var device = app.SelectNodesXML("/" + app.CallFunction("logiclab.get_TargetID"))[0]
	if ( !device )
		return false
	
	ExportAsCANcustom( device )
}

