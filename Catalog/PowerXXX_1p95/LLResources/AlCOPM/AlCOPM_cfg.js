//	Impostare qui la configurazione del master

//	Il canale di comunicazione slave SDO server è supportato lato firmware
var CANOPEN_MASTER_SLAVE_CHANNEL_SUPPORTED = true
//	Supporto protocollo heartbeat
var CANOPEN_MASTER_HEARTBEAT_SUPPORTED = true
//	Supporto SDO scheduling
var CANOPEN_MASTER_SDO_SCHEDULING_SUPPORTED = true

//	Architetture supportate (CANopen_target.js)
var CANOPEN_MASTER_TARGET_TMS320_BIT	= 1
var CANOPEN_MASTER_TARGET_RENESAS_RX 	= 2
var CANOPEN_MASTER_TARGET_ARM 			= 3
var CANOPEN_MASTER_TARGET_POWERPC 		= 4

//	In base all'architettura cambia come vengono allocate le strutture
var CANOPEN_MASTER_TARGET_ARCHITECTURE = CANOPEN_MASTER_TARGET_ARM

//	Define per AddApplicationDB
var CANOPEN_NETLIST_DB_INDEX = "60003"
var CANOPEN_NETLIST_DB_TYPE = 'I'
var CANOPEN_NETLIST_DB_ELEMTYPE = 'W'

var COPM_BOOT_TASK_NAME = "COPMBoot"
var COPM_PAR_TASK_NAME = "COPMParam"

var COPM_USE_APPLICATION_DB = false

var COPMNETLIST_ARRAY_UPPER_BOUND_NAME 	= "COPMNETLISTBOUND"
var COPMNETLIST_ARRAY_COUNT_NAME 		= "COPMNETLISTCOUNT"

var SDOSCHEDULING_DIAGNO_NAME = "sysCopmSdoSchedulingDiagno"
var SDOSCHEDULING_CONFIG_NAME = "sysCopmSdoSchedulingConfig"

var COPM_TASK_IO_NAME = "Fast"

////////////////////////////////////////////////////////////////////////////////////////////////////

/*	Ridefinisce i default specificati qui sopra */

#include ../AlCOPM_settings.js

////////////////////////////////////////////////////////////////////////////////////////////////////

/*	Se la configurazione è supportata il resto non dovrebbe essere modificato! */

//	File con la definizione delle size e delle caratteristiche delle diverse architetture supportate
#include AlCOPM_target.js

var CAN_MODE_OFF = 0
var CAN_MODE_MASTER = 1
var CAN_MODE_SLAVE = 2

//	Indice del campo COPMNETLIST_CFG
var IDX_COPM_NETLIST_CFG_CAN = 0
var IDX_COPM_NETLIST_CFG_NODE = 1
var IDX_COPM_NETLIST_CFG_NODE_PADDING = 2
var IDX_COPM_NETLIST_CFG_BOOTTIME = 3
var IDX_COPM_NETLIST_CFG_BOOTTIME_PADDING = 4
var IDX_COPM_NETLIST_CFG_NODEGUARDING = 5
var IDX_COPM_NETLIST_CFG_LTF = 6
var IDX_COPM_NETLIST_CFG_MANDATORY = 7
var IDX_COPM_NETLIST_CFG_PARAMS = 8
var IDX_COPM_NETLIST_CFG_PDORX = 9
var IDX_COPM_NETLIST_CFG_PDOTX = 10
var IDX_COPM_NETLIST_CFG_NUM_HB_NO = 11
//	solo se CANOPEN_MASTER_HEARTBEAT_SUPPORTED
var IDX_COPM_NETLIST_CFG_NODE_HBP = 11
var IDX_COPM_NETLIST_CFG_NODE_HBP_PADDING = 12
var IDX_COPM_NETLIST_CFG_NODE_HBC = 13
var IDX_COPM_NETLIST_CFG_NODE_HBC_PADDING = 14
var IDX_COPM_NETLIST_CFG_MASTER_HBC = 15
var IDX_COPM_NETLIST_CFG_MASTER_HBC_PADDING = 16
var IDX_COPM_NETLIST_CFG_NUM_HB_YES = 17

var IDX_COPM_TABLE_PARAM_HNDL = 0
var IDX_COPM_TABLE_PARAM_NUM = 1
var IDX_COPM_TABLE_PARAM_INDEX = 2
var IDX_COPM_TABLE_PARAM_HI_SUBINDEX_LO_LENGTH = 3
var IDX_COPM_TABLE_PARAM_VALUE_LW = 4
var IDX_COPM_TABLE_PARAM_VALUE_HW = 5
var IDX_COPM_TABLE_PARAM_ISREAL = 6
var IDX_COPM_TABLE_PARAM_TIMEOUT = 7
var SIZEOF_COPM_TABLE_PARAM_RECORD = 8

var RO_MODE = 1
var WO_MODE = 2
var RW_MODE = 3

var COPM_NET_ENUM = {}
var COPM_CHN_ENUM = {}
var COPM_BAUD_ENUM = {}

//	struttura di configurazione in base a CANOPEN_MASTER_TARGET_ARCHITECTURE settata
var COPMCONST = {}

var IDX_COPM_NETLIST_CFG_NUM = 0	//	settato in base a CANOPEN_MASTER_HEARTBEAT_SUPPORTED

function BuildCfg_CAN_Init()
{
	switch ( CANOPEN_MASTER_TARGET_ARCHITECTURE )
	{
	case CANOPEN_MASTER_TARGET_TMS320_BIT:
		COPMCONST = m_CANopenConst.TMS320_BIT
		break;
	case CANOPEN_MASTER_TARGET_RENESAS_RX:
		COPMCONST = m_CANopenConst.RENESAS_RX
		break;
	case CANOPEN_MASTER_TARGET_ARM:
		COPMCONST = m_CANopenConst.ARM
		break;
	case CANOPEN_MASTER_TARGET_POWERPC:
		COPMCONST = m_CANopenConst.POWERPC
		break;
	default:
		return false
		break;
	}
	
	//	nelle const vengono previste le due possibilita
	if ( CANOPEN_MASTER_HEARTBEAT_SUPPORTED )
	{
		//	SIZEOF_COPM_NETLIST_CFG_HDLR sarà quello da usare
		COPMCONST.SIZEOF_COPM_NETLIST_CFG_HDLR = COPMCONST.SIZEOF_COPM_NETLIST_CFG_HDLR_HB_YES
		IDX_COPM_NETLIST_CFG_NUM = IDX_COPM_NETLIST_CFG_NUM_HB_YES
	}
	else
	{
		//	SIZEOF_COPM_NETLIST_CFG_HDLR sarà quello da usare
		COPMCONST.SIZEOF_COPM_NETLIST_CFG_HDLR = COPMCONST.SIZEOF_COPM_NETLIST_CFG_HDLR_HB_NO
		IDX_COPM_NETLIST_CFG_NUM = IDX_COPM_NETLIST_CFG_NUM_HB_NO
	}
	
	return true
}

function BuildCfg_CAN(device, mappedVars)
{
	//	inizializza i settaggi in base alla configurazione impostata
	if ( !BuildCfg_CAN_Init() )
	{
		var msg = genfuncs.FormatMsg( app.Translate("CHECK COPM TARGET CONFIGURATION ARCHITECTURE SETTINGS") )
		throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "BuildCfg_CAN_Init", msg)
	}
	
	if (COPM_USE_APPLICATION_DB)
	{
		// Rimuovo il datablock applicativo su cui viene messa la diagnostica della rete CANopen
		// lo rimuove come prima cosa, altrimenti andando da master a not used rimarrebbe presente nel prj ma non utilizzato
		app.CallFunction( "logiclab.RemoveApplicationDB", CANOPEN_NETLIST_DB_INDEX, CANOPEN_NETLIST_DB_TYPE )
	}
	
	//	genero un unico file per le due reti CAN (almeno una linea deve essere attiva)
	var generateMasterConf = false
	var openSdoServer = CANOPEN_MASTER_SLAVE_CHANNEL_SUPPORTED
	var portList = device.selectNodes( "CANopen | CANopenExp" )
	var port
	var portCount = 0
	while (port = portList.nextNode())
	{
		if (parseInt(port.getAttribute("mode")) == CAN_MODE_MASTER)
		{
			generateMasterConf = true
			openSdoServer = false
		}
		else if (parseInt(port.getAttribute("mode")) == CAN_MODE_SLAVE)
		{
			openSdoServer = false	//	utilizzerò lo stack slave per la comunicazione con logiclab
		}
		portCount++
	}
	var content = ""
	if ( generateMasterConf )
	{
		//	generazione configurazione per CANopen master (con numero PDO Rx/Tx e IEC mapping Tx e Rx effettivo)
		portList.reset()
		content = BuildCfg_CANopenMaster(device, portList, mappedVars)
	}
	else if ( openSdoServer )
	{
		//	se il master non è configurato genera comunque una configurazione per aprire il canale slave di comunicazione
		content = BuildCfg_CANopenSDOServer(portCount)
		
		var diagnoVar = GenerateDianosticVarsCOPM(0, 0)
		content += "\n\tVAR_GLOBAL \n" + diagnoVar.globalVarCode + "\tEND_VAR\n\n";
		content += "\n\tVAR_GLOBAL CONSTANT\n" + diagnoVar.globalConstCode + "\tEND_VAR\n\n";
	}	
	else
	{
		//	inizializza lo slave
		//content = BuildCfg_CANopenSlave()
		
		var diagnoVar = GenerateDianosticVarsCOPM(0, 0)
		content += "\n\tVAR_GLOBAL \n" + diagnoVar.globalVarCode + "\tEND_VAR\n\n";
		content += "\n\tVAR_GLOBAL CONSTANT\n" + diagnoVar.globalConstCode + "\tEND_VAR\n\n";
	}

	// rimuove il codice aux eventualmente presente generato con versioni vecchie
//	app.CallFunction( "compiler.LogicLab_RemovePLC", app.CallFunction("logiclab.get_ProjectPath"), "CANopen_0_cfg.plc" )
	
	//	inserimento sorgente ausiliario nel progetto PLC
	var filename = "CANopen_cfg.plc"
	if (content === null)
		// errore di generazione
		throw enuLogLevels.LEV_CRITICAL
	else if (content === "")
		// nessun codice generato, rimuove il codice aux eventualmente presente
		app.CallFunction( "compiler.LogicLab_RemovePLC", app.CallFunction("logiclab.get_ProjectPath"), filename )
	else
	{
		app.CallFunction( "compiler.LogicLab_UpdatePLC", app.CallFunction("logiclab.get_ProjectPath"), filename, content )
		app.PrintMessage( "Created CANopen configuration", enuLogLevels.LEV_INFO )
	}
}



function FindObjVal(list, idx, subidx, defval)
{
	for (var i = 0, t = list.length; i < t; i++)
	{
		var item = list[i]
		if (item.Index == idx && item.SubIndex == subidx)
			return item.Value
	}
	return defval
}


// costanti per CANopen
var IDX_PDOTX_PARAMS = 0x1800
var IDX_PDORX_PARAMS = 0x1400
var SUBIDX_PDO_MODE = 2
var TRANSMISSION_EVENT_VALUE = 255
var NMT_RESET_COM_CS = 130
var NMT_START_CS = 1
var MAX_PDO_NUM = 8   // numero massimo di PDO gestiti (in modalità non standard)
//	il range dei cobid va da 0x180 a 0x6FF, ma non posso averne da 0x580 a 0x67F
var RXCOBID_PDO_RANGE1_INI = 0x180
var RXCOBID_PDO_RANGE1_END = 0x57F
var RXCOBID_PDO_RANGE2_INI = 0x680
var RXCOBID_PDO_RANGE2_END = 0x6FF
var RXCOBID_PDO_RANGE_INI = 0x180
var RXCOBID_PDO_RANGE_END = 0x6FF

/* chiede ad ogni slave tramite la funzione GetCANInfo un oggetto così strutturato:
{
	NodeID (int)
	DeviceName (string)
	BootTime (int)
	NodeHbPTime (int)
	NodeHbCTime (int)
	MasterHbCTime (int)
	nodeGuardPeriod (int)
	lifeTimeFactor (int)
	deviceType	 (int)
	vendorID	 (int)
	productCode (int)
	revision	 (int)
	serial		 (int)
	
	info.SDODef 
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
	
	info.PDOTxList, info.PDORxList       // RX e TX riferiti al master
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
}    */

var m_NumSlaves = 0
var m_PdoRx = 0
var m_PdoTx = 0
var m_PdoRxIecMapping = 0
var m_PdoTxIecMapping = 0	
var m_PdoRxIecMappingList = []
var m_PdoTxIecMappingList = []
var m_RxCobID_PDO_Map = {}
var m_NetList_Cfg = []

function EncodeValue( num, value )
{
	//	padding non usato
	if ( num == 0 )
		return ""
	
	if ( COPMCONST.BYTE_SIZE == 16 )
	{
		//	TMS320_BIT
		if ( ( num == 1 ) && !COPMCONST.IS_BIG_ENDIAN )
		{		
			return value
		}
		else
		{
			//	da gestire endianness o campo DWORD
			debugger
			return 0
		}
	}
	else
	{
		if ( num == 1 )
		{
			//	se è un byte non devo controllare la endianness
			return value
		}
		else if ( num == 2 )
		{
			var lo_byte = parseInt( value ) & 0x00FF
			var hi_byte = ( ( parseInt( value ) & 0xFF00 ) >> 8 ) & 0x00FF
		
			if ( COPMCONST.IS_BIG_ENDIAN )
				return hi_byte + ", " + lo_byte
			else
				return lo_byte + ", " + hi_byte
		}	
		else
		{
			//	da gestire campo DWORD
			debugger
			return 0
		}
	}
}

function PrepareWordConstant( wordValue )
{
	if ( !COPMCONST.IS_BIG_ENDIAN )
		return wordValue
		
	var lo_byte = parseInt( wordValue ) & 0x00FF
	var hi_byte = ( ( parseInt( wordValue ) & 0xFF00 ) >> 8 ) & 0x00FF
	
	wordValueReversed = lo_byte << 8 | hi_byte
	
	return wordValueReversed
}

function BuildCfg_CANopenSDOServer( portCount )
{
	COPM_CHN_ENUM = {}
	COPM_CHN_ENUM[ 0 ] = "COPM_CHN_CAN0"
	COPM_CHN_ENUM[ 1 ] = "COPM_CHN_CAN1"
	COPM_CHN_ENUM[ 2 ] = "COPM_CHN_CAN2"
	
	var code = ""
	
	code = "	PROGRAM CopMBoot WITH " + COPM_BOOT_TASK_NAME + ";\n\
	PROGRAM CopMBoot\n\
	{ HIDDEN:ON }\n\n\
	VAR\n\
		master_return : DINT;\n\
	END_VAR\n"
	code += "\n"
	code += "	{ CODE:ST }\n"
	
	for ( var i = 0; i < portCount; i++ )
	{
		code += "	master_return := sysCopm_SdoServerOpen( " + COPM_CHN_ENUM[ i ] + " );\n"
	}
	code += "	master_return := sysCopm_MasterAssign( " + portCount + " );\n"
	code += "	END_PROGRAM\n"
	
	return code
}

// generazione configurazione CANopen Master (field, vero master)
function BuildCfg_CANopenMaster(device, netList, mappedVars)
{	
	m_NumSlaves = 0
	m_MaxSlaveNodeId = 0
	m_PdoRx = 0
	m_PdoTx = 0
	m_PdoRxIecMapping = 0
	m_PdoTxIecMapping = 0	
	m_PdoRxIecMappingList = []
	m_PdoTxIecMappingList = []
	m_RxCobID_PDO_Map = {}
	m_NetList_Cfg = []
	
	var m_MasterNodes = []

	var m_RxCobID_Net_Map = {}
	var m_ParamTable = []
	var m_slavesCode = ""
	var m_totVars = 0
	var masterSyncCycle = 0	//	se in uso sulla prima rete (> 0) deve essere lo stesso sulla seconda

	COPM_NET_ENUM = {}
	COPM_NET_ENUM[ 0 ] = "COPM_NET_0"
	COPM_NET_ENUM[ 1 ] = "COPM_NET_1"
	
	COPM_CHN_ENUM = {}
	COPM_CHN_ENUM[ 0 ] = "COPM_CHN_CAN0"
	COPM_CHN_ENUM[ 1 ] = "COPM_CHN_CAN1"
	COPM_CHN_ENUM[ 2 ] = "COPM_CHN_CAN2"

	COPM_BAUD_ENUM = {}
	COPM_BAUD_ENUM[ 0 ] = "COPM_BAUD_AUTO"
	COPM_BAUD_ENUM[ 1000000 ] = "COPM_BAUD_1000K"
	COPM_BAUD_ENUM[ 800000 ] = "COPM_BAUD_800K"
	COPM_BAUD_ENUM[ 500000 ] = "COPM_BAUD_500K"
	COPM_BAUD_ENUM[ 250000 ] = "COPM_BAUD_250K"
	COPM_BAUD_ENUM[ 125000 ] = "COPM_BAUD_125K"
	COPM_BAUD_ENUM[ 100000 ] = "COPM_BAUD_100K"
	COPM_BAUD_ENUM[ 50000 ] = "COPM_BAUD_50K"
	COPM_BAUD_ENUM[ 20000 ] = "COPM_BAUD_20K"
	COPM_BAUD_ENUM[ 10000 ] = "COPM_BAUD_10K"
	
	var FUNCNAME = "BuildCfg_CANopenMaster"
	var OPT_STARTUP = 0
	
	//	setto con 0xFFFF tutte le mappe emcy sdo e nmte
	for ( var i = 0; i < 128; i++ )
	{
		m_RxCobID_Net_Map[ i ] = 0xFFFF
	}
	
	// creazione nodo <master> con opzioni del master
	var net
	var numMaster = 0
	while ( net = netList.nextNode() )
	{
			//	default undefined
		var copmcan = parseInt(net.getAttribute("id"))
		m_MasterNodes[ copmcan ] = undefined
		
			//	genero solo per configurazione master
		if ( parseInt( net.getAttribute("mode") ) != CAN_MODE_MASTER )
			continue
			
			//	se usato riempio
		var master = {}
		master.net = numMaster++
		master.port = copmcan
		master.masterNodeID = parseInt(net.getAttribute("nodeID"))			
		master.synccob = parseInt(net.getAttribute("syncCOBID"))
		master.synccycle = parseInt(net.getAttribute("syncCycle")) * 1000
		master.hbTime = parseInt(net.getAttribute("hbTime"))	//	ms
		
		var rtCycle = app.CallFunction( "logiclab.get_TaskPeriod", COPM_TASK_IO_NAME )
		if (rtCycle == -1)
		{
			var err = app.CallFunction("common.SplitFieldPath", net, "syncCycle")
			var msg = genfuncs.FormatMsg(app.Translate("CANopen configurator error, check COPM_TASK_IO_NAME setting (current setting: '%1' does not match with IO task)"), COPM_TASK_IO_NAME )
		
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, err)
		}
		
			//	force sync cycle to IO cycle
		if (master.synccycle == 1000)
		{			
				//	force sync cycle to other master cycle
			if (masterSyncCycle > 0)
			{
				master.synccycle = masterSyncCycle;
				
				var msg = app.Translate("Sync cycle for network CAN-B forced to %1 ms (CAN-A sync cycle)")
				app.PrintMessage(genfuncs.FormatMsg(msg, masterSyncCycle / 1000))
			}
			else
			{
				master.synccycle = rtCycle * 1000
				
				var msg = app.Translate("Sync cycle for network CAN-B forced to %1 ms (IO sync cycle)")
				app.PrintMessage(genfuncs.FormatMsg(msg, rtCycle))
			}
		}
		
			//	il sync, se usato su entrambe deve essere lo stesso tempo
		if ( masterSyncCycle > 0 && 
			 master.synccycle > 0 && 
			 masterSyncCycle != master.synccycle )
		{
			var err = app.CallFunction("common.SplitFieldPath", net, "syncCycle")
			var msg = genfuncs.FormatMsg(app.Translate("Sync time must be the same if used on both CANopen lines (CAN-A: %1 ms vs CAN-B: %2 ms)"), (masterSyncCycle / 1000),  (master.synccycle / 1000))
			
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, err)
		}
		else if ( master.synccycle > 0 && master.synccycle % ( rtCycle * 1000) != 0 )
		{
			var err = app.CallFunction("common.SplitFieldPath", net, "syncCycle")
			var msg = genfuncs.FormatMsg(app.Translate("Specified sync time (%1 ms) must be equal to or multiple of the RealTime task period (%2 ms)"), ( master.synccycle / 1000 ), rtCycle )
			
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, err)
		}
		else
		{
			//	aggiorno tempo di sync
			masterSyncCycle = master.synccycle
		}
		
		master.baud = parseInt(net.getAttribute("baudRate"))
		m_MasterNodes[ copmcan ] = master
		
			// cobid univoci (per ciascuna rete)
		var usedCOBIDs = {}
			// impegna il nodeID del master
		var usedNodeIDs = {}
		usedNodeIDs[master.masterNodeID] = true
		
		if (CANOPEN_MASTER_SDO_SCHEDULING_SUPPORTED)
		{
			//	list of nodes to be scheduled
			m_MasterNodes[ copmcan ].SDOScheduling = []
			
			//	fill SDOSchedulingDiagno structure
			m_MasterNodes[ copmcan ].SDOSchedulingDiagno = {}
			m_MasterNodes[ copmcan ].SDOSchedulingDiagno.name = SDOSCHEDULING_DIAGNO_NAME + "_" + copmcan
			m_MasterNodes[ copmcan ].SDOSchedulingDiagno.numItems = 0
			
			//	fill SDOSchedulingConfig structure
			m_MasterNodes[ copmcan ].SDOSchedulingConfig = {}
			m_MasterNodes[ copmcan ].SDOSchedulingConfig.name = SDOSCHEDULING_CONFIG_NAME + "_" + copmcan
			m_MasterNodes[ copmcan ].SDOSchedulingConfig.numItems = 0
			m_MasterNodes[ copmcan ].SDOSchedulingConfig.list = []
		}
		
		var slaves = net.selectNodes("*[@insertable]")
		var slave
		while (slave = slaves.nextNode())
		{
			if (slave.nodeName == "cpuslot" || slave.nodeName == "swichslot" || slave.nodeName == "emptyslot" )
				continue   // pseudo slave del rack
		
			var extname = slave.getAttribute("ExtensionName")
			if (!extname)
				continue   // slave senza estensione definita?
			
			var enabled = genfuncs.ParseBoolean( slave.getAttribute("enabled") )
			if (!enabled)
				continue	// disabilitato
			
			var info = app.CallFunction(extname + ".GetCANInfo", slave)
			if (!info)
			{
				var err = app.CallFunction("common.SplitFieldPath", slave)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, app.Translate("Invalid CAN data"), err)
			}
			
			var errpath = app.CallFunction("common.SplitFieldPath", slave.selectSingleNode("*/nodeNumber"))
			
			// gli slaves devono essere in 1..127
			if (! (info.NodeID >= 1 && info.NodeID <= 127))
			{
				var msg = genfuncs.FormatMsg(app.Translate("Invalid node number: %1 (must be in 1..127)"), info.NodeID)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errpath)
			}
			
			// verifica unicità NodeID
			if (usedNodeIDs[info.NodeID] != undefined)
			{
				var msg = genfuncs.FormatMsg(app.Translate("Duplicate node number: %1"), info.NodeID)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errpath)
			}
			else
				usedNodeIDs[info.NodeID] = true
			
			// verifica unicità COBID dei PDO
			for (i = 0; i < info.PDORxList.length; i++)
			{
				var cobid = info.PDORxList[i].COBID
				if (isNaN(cobid))
				{
					var msg = genfuncs.FormatMsg(app.Translate("Invalid COBID specified: '%1' for node: '%2', PDO num '%3'"), cobid, info.NodeID, info.PDORxList[i].num )
					throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errpath)
				}
				if (usedCOBIDs[cobid])
				{
					var msg = genfuncs.FormatMsg(app.Translate("Duplicate PDORx COBID: %1 - Change 'Node number' of device"), genfuncs.toHex(cobid))
					throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errpath)
				}
				else
					usedCOBIDs[cobid] = true
			}
			
			for (i = 0; i < info.PDOTxList.length; i++)
			{
				var cobid = info.PDOTxList[i].COBID
				if (isNaN(cobid))
				{
					var msg = genfuncs.FormatMsg(app.Translate("Invalid COBID specified: '%1' for node: '%2', PDO num '%3'"), cobid, info.NodeID, info.PDOTxList[i].num )
					throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errpath)
				}
				if (usedCOBIDs[cobid])
				{
					var msg = genfuncs.FormatMsg(app.Translate("Duplicate PDOTx COBID: %1 - Change 'Node number' of device"), genfuncs.toHex(cobid))
					throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errpath)
				}
				else
					usedCOBIDs[cobid] = true
			}
			
			if (CANOPEN_MASTER_SDO_SCHEDULING_SUPPORTED)
			{
				for (var i = 0; i < info.SDOscheduling.SDOscheduledList.length; i++)
				{
					var srcItem = info.SDOscheduling.SDOscheduledList[i]
					if (srcItem.Label == "")
					{
						var v = app.CallFunction("logiclab.GetGlobalVariable", srcItem.Label)
						if (!v)
						{
							var msg = genfuncs.FormatMsg(app.Translate("SDO scheduling variable not specified"))
							throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errpath)
						}
					}
					if (srcItem.Label != "")
					{
						var v = app.CallFunction("logiclab.GetGlobalVariable", srcItem.Label)
						if (!v)
						{
							var msg = genfuncs.FormatMsg(app.Translate("Cannot find SDO scheduling specified variable '%1'"), srcItem.Label)
							throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errpath)
						}
					}
					if (srcItem.OneShot != "")
					{
						var v = app.CallFunction("logiclab.GetGlobalVariable", srcItem.Label)
						if (!v)
						{
							var msg = genfuncs.FormatMsg(app.Translate("Cannot find SDO scheduling oneshot specified variable '%1'"), srcItem.OneShot)
							throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, msg, errpath)
						}
					}					
				}
			}
			
			// generazione nodo <slave> con le opzioni dello slave
			
			// se il deviceType non è definito ed è passato come stringa vuota lo forzo a 0
			if (info.deviceType === "")
			{
				info.deviceType = "0"
			}
			if (info.vendorID === "")
			{
				info.vendorID = "0"
			}
			if (info.productCode === "")
			{
				info.productCode = "0"
			}
			if (info.revision === "")
			{
				info.revision = "0"
			}
			if (info.serial === "")
			{
				info.serial = "0"
			}
			
			m_slavesCode += "	slave_return:= sysCopm_SlaveAssign("+ COPM_NET_ENUM[ master.net ] +","+info.NodeID+");\n"	//,"+info.deviceType+","+info.vendorID+","+info.productCode+","+info.revision+","+info.serial+","+info.BootTime+","+info.nodeGuardPeriod+","+info.lifeTimeFactor+","+paramsCounter+");\n "				

				// aggiorna nodeID massimo
			var nodeNum = parseInt( info.NodeID )
			if ( nodeNum > m_MaxSlaveNodeId )
				m_MaxSlaveNodeId = nodeNum
				
			if ( master.net == 0 )
			{
				m_RxCobID_Net_Map[ nodeNum ] &= 0xFF00
				m_RxCobID_Net_Map[ nodeNum ] |= m_NumSlaves
			}
			else
			{
				m_RxCobID_Net_Map[ nodeNum ] &= 0x00FF
				m_RxCobID_Net_Map[ nodeNum ] |= ( m_NumSlaves << 8 )
			}
			
			m_NetList_Cfg[ m_NumSlaves ] = []
			m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_CAN ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_CAN, master.net );
			m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_NODE ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_NODE, info.NodeID );
			m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_NODE_PADDING ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_NODE_PADDING, 0 );
			m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_BOOTTIME ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_BOOTTIME, info.BootTime );
			m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_BOOTTIME_PADDING ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_BOOTTIME_PADDING, 0 );
			m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_NODEGUARDING ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_NODEGUARDING, info.nodeGuardPeriod );
			m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_LTF ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_LTF, info.lifeTimeFactor );
			m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_MANDATORY ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_MANDATORY, info.MandatorySlave ? 1 : 0 );
			m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_PARAMS ] = 0	//	aggiorno dopo la generazione effettiva dei parametri
			m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_PDORX ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_PDORX, 0 );
			m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_PDOTX ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_PDOTX, 0 );
			if ( CANOPEN_MASTER_HEARTBEAT_SUPPORTED )
			{
				m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_NODE_HBP ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_NODE_HBP, info.NodeHbPTime );
				m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_NODE_HBP_PADDING ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_NODE_HBP_PADDING, 0 );
				m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_NODE_HBC ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_NODE_HBC, info.NodeHbCTime );
				m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_NODE_HBC_PADDING ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_NODE_HBC_PADDING, 0 );
				m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_MASTER_HBC ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_MASTER_HBC, info.MasterHbCTime );
				m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_MASTER_HBC_PADDING ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_MASTER_HBC_PADDING, 0 );
			}
			
			// ---------------------- PDO RX (dallo slave al master) ----------------------
			for (var i = 0; i < info.PDORxList.length; i++)
			{
				var PDO = info.PDORxList[i]
				if (PDO.numMappedVars == 0)
					continue    // nessuna variabile mappata, non considera il PDO
					
				if (i >= MAX_PDO_NUM)
				{
					var msg = genfuncs.FormatMsg(app.Translate("Only %1 PDOTx are supported, PDOTx %2 will be discarded"), MAX_PDO_NUM, i)
					app.CallFunction("common.AddLog", enuLogLevels.LEV_ERROR, FUNCNAME, msg)
					continue
				}
				
				// cerca il transmissionType tra gli oggetto sdo da mandare del tipo 180x.2, la costante è Tx riferito allo slave (come in cancustom.js)
				var tt = FindObjVal(info.SDODef.setList, (IDX_PDOTX_PARAMS + PDO.num - 1), SUBIDX_PDO_MODE, TRANSMISSION_EVENT_VALUE)
							
				var result = BuildCfg_CANopenMaster_PDO(info.NodeID, master.net, 0, PDO, "Rx", tt, mappedVars)
				m_slavesCode += result.pdoCode
				m_totVars += result.totVars
			}
			
			
			// ---------------------- PDO TX (dal master allo slave) ----------------------
			for (var i = 0; i < info.PDOTxList.length; i++)
			{
				var PDO = info.PDOTxList[i]
				if (PDO.numMappedVars == 0)
					continue    // nessuna variabile mappata, non considera il PDO
					
				if (i >= MAX_PDO_NUM)
				{
					var msg = genfuncs.FormatMsg(app.Translate("Only %1 PDORx are supported, PDORx %2 will be discarded"), MAX_PDO_NUM, i)
					app.CallFunction("common.AddLog", enuLogLevels.LEV_ERROR, FUNCNAME, msg)
					continue
				}
				
				// cerca il transmissionType tra gli oggetto sdo da mandare del tipo 140x.2, la costante è Rx riferito allo slave (come in cancustom.js)
				var tt = FindObjVal(info.SDODef.setList, (IDX_PDORX_PARAMS + PDO.num - 1), SUBIDX_PDO_MODE, TRANSMISSION_EVENT_VALUE)
				
				var result = BuildCfg_CANopenMaster_PDO(info.NodeID, master.net, 0, PDO, "Tx", tt, mappedVars)
				m_slavesCode += result.pdoCode
				m_totVars += result.totVars
			}
			
			/*	generazione parametri di configurazione all'avvio (SDO Set) */		
			
			//	user param
			var n_prm = 0	//	il valore è riferito al singolo nodo
			
			//	node guarding
			var param = {}		
			param.hndl = m_NumSlaves
			param.par_num = n_prm++
			param.par_index = 0x100C
			param.par_subindex = 0
			param.par_length = 2
			param.par_value = parseInt( info.nodeGuardPeriod )
			param.timeout = 1000
			param.isReal = 0
			m_ParamTable.push(param)
			
			//	ltf
			var param = {}
			param.hndl = m_NumSlaves
			param.par_num = n_prm++
			param.par_index = 0x100D
			param.par_subindex = 0
			param.par_length = 1
			param.par_value = parseInt(info.lifeTimeFactor)
			param.isReal = 0
			param.timeout = 1000		
			m_ParamTable.push(param)
			
			if ( CANOPEN_MASTER_HEARTBEAT_SUPPORTED )
			{
				//	heartbeat consumer time
				if ( info.NodeHbCTime > 0 )
				{
					var param = {}
					param.hndl = m_NumSlaves
					param.par_num = n_prm++
					param.par_index = 0x1016
					param.par_subindex = 1
					param.par_length = 2
					param.par_value = parseInt(info.NodeHbCTime)
					param.isReal = 0
					param.timeout = 1000		
					m_ParamTable.push(param)
				}
				
				//	heartbeat producer time
				var param = {}
				param.hndl = m_NumSlaves
				param.par_num = n_prm++
				param.par_index = 0x1017
				param.par_subindex = 0
				param.par_length = 2
				param.par_value = parseInt(info.NodeHbPTime)
				param.isReal = 0
				param.timeout = 1000		
				m_ParamTable.push(param)
			}
			
			for (var i = 0, len = info.SDODef.setList.length; i < len; i++, n_prm++)
			{
				var SDO = info.SDODef.setList[i]
				if (SDO.Value === "" || isNaN(SDO.Value))
					continue
					
				var param = {}
				param.hndl = m_NumSlaves
				param.par_num = n_prm
				param.par_index = parseInt( SDO.Index )
				param.par_subindex = parseInt( SDO.SubIndex )
				param.par_length = parseInt( SDO.DataLength )
				if ( SDO.DataType === "REAL" )
				{
					var floatValue = parseFloat( SDO.Value )
					var intValue = app.CallFunction("commonDLL.FloatToInt", floatValue)
					param.par_value = intValue
					param.isReal = 1
				}
				else
				{
					param.par_value = parseInt( SDO.Value )
					param.isReal = 0
				}
				param.timeout = parseInt( SDO.TimeOut )
				m_ParamTable.push(param)
			}
			
			//	aggiorno qui il numero effettivo di parametri da configurare
			m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_PARAMS ] = EncodeValue( COPMCONST.SIZE_COPM_NETLIST_CFG_PARAMS, n_prm );
			
			if (CANOPEN_MASTER_SDO_SCHEDULING_SUPPORTED)
			{				
				for (var i = 0; i < info.SDOscheduling.SDOscheduledList.length; i++)
				{
					var srcItem = info.SDOscheduling.SDOscheduledList[i]
					var cfgItem = {}
					cfgItem["net"] = copmcan
					cfgItem["node"] = info.NodeID
					cfgItem["objIndex"] = genfuncs.toHex(srcItem.Index).replace("0x", "16#")
					cfgItem["objSubIndex"] = srcItem.SubIndex
					cfgItem["objLen"] = srcItem.DataLength
					cfgItem["cmdDirection"] = srcItem.Direction
					cfgItem["reserved1"] = 0
					cfgItem["timeout"] = srcItem.TimeOut
					cfgItem["diagnoRecIndex"] = m_MasterNodes[ copmcan ].SDOSchedulingConfig.numItems++
					cfgItem["polling"] = srcItem.Polling
					cfgItem["variableAddress"] = "?" + srcItem.Label
					cfgItem["pOneshotVar"] = srcItem.OneShot == "" ? "NULL" : "?" + srcItem.OneShot
					// push cfg item
					m_MasterNodes[ copmcan ].SDOSchedulingConfig.list.push(cfgItem)
				}
				
				//	fill SDOSchedulingDiagno structure
				m_MasterNodes[ copmcan ].SDOSchedulingDiagno.numItems = m_MasterNodes[ copmcan ].SDOSchedulingConfig.numItems
			}
			
			//	Slave successivo
			m_NumSlaves += 1
		}
	}
	
	//	la generazione del codice avviene solo dopo la prima fase di raccolta dati
	var code = ""
	
	if ( m_NumSlaves > 0 )
	{
		var arrayDim = m_NumSlaves;
		var arrayLim = arrayDim - 1
		
		if (COPM_USE_APPLICATION_DB)
		{
			//	Add application DB for network diagnostic		
			var dbSize = arrayDim * COPMCONST.SIZEOF_COPM_NETLIST_HDLR
			var dbOK = app.CallFunction( "logiclab.AddApplicationDB", CANOPEN_NETLIST_DB_INDEX, CANOPEN_NETLIST_DB_TYPE, CANOPEN_NETLIST_DB_ELEMTYPE, dbSize, RO_MODE )	
			if( ! dbOK )
			{
				var errmsg = genfuncs.FormatMsg(app.Translate("Cannot add application datablock %%1%2%3 for sysCopmNetList diagno"), CANOPEN_NETLIST_DB_TYPE, CANOPEN_NETLIST_DB_ELEMTYPE, CANOPEN_NETLIST_DB_INDEX)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg)
			}
		}

		//	resetta la lista con tutti 0xFFFF
		var RxCobID_PDO_List = []
		for ( var i = RXCOBID_PDO_RANGE_INI; i <= RXCOBID_PDO_RANGE_END; i++ )
		{
			RxCobID_PDO_List[ i - RXCOBID_PDO_RANGE_INI ] = 0xFFFF
		}
		code  = "	(* Automatically generated code, do not edit! *)\n\n"
		code += "	VAR_GLOBAL\n"
		if ( COPM_USE_APPLICATION_DB )
		{
			code += "		sysCopmNetList AT %" + CANOPEN_NETLIST_DB_TYPE + CANOPEN_NETLIST_DB_ELEMTYPE + CANOPEN_NETLIST_DB_INDEX + ".0 : ARRAY[ 0.." + arrayLim + " ] OF COPM_NETLIST_STRUCT; { DE:\"Status of CANopen Master Net list\" }\n"
		}
		
		code += "		$$PLCArrayWorkNMTE : ARRAY[ 0.." + ( ( COPMCONST.SIZEOF_NMTE_HDLR * m_NumSlaves ) - 1 ) + " ] OF " + COPMCONST.DATA_TYPE + ";{ HIDDEN:ON }\n"
		code += "		$$PLCArrayWorkSDO : ARRAY[ 0.." + ( ( COPMCONST.SIZEOF_SDO_HDLR * m_NumSlaves ) - 1 ) + " ] OF " + COPMCONST.DATA_TYPE + ";{ HIDDEN:ON }\n"
		code += "		$$PLCArrayWorkPRM : ARRAY[ 0.." + ( ( COPMCONST.SIZEOF_PRM_HDLR * m_NumSlaves ) - 1 ) + " ] OF " + COPMCONST.DATA_TYPE + ";{ HIDDEN:ON }\n"
		if ( m_PdoRx > 0 )
		{
			code += "		$$PLCArrayWorkRxPDO : ARRAY[ 0.." + ( ( COPMCONST.SIZEOF_PDO_RX_HDLR * m_PdoRx ) - 1 ) + " ] OF " + COPMCONST.DATA_TYPE + ";{ HIDDEN:ON }\n"
			code += "		$$PLCArrayInpProcImage : ARRAY[ 0.." + ( ( COPMCONST.SIZEOF_PROCIMG * m_PdoRx ) - 1 ) + " ] OF " + COPMCONST.DATA_TYPE + ";{ HIDDEN:ON }\n"
		}
		if ( m_PdoTx > 0 )
		{
			code += "		$$PLCArrayWorkTxPDO : ARRAY[ 0.." + ( ( COPMCONST.SIZEOF_PDO_TX_HDLR * m_PdoTx ) - 1 ) + " ] OF " + COPMCONST.DATA_TYPE + ";{ HIDDEN:ON }\n"
			code += "		$$PLCArrayOutProcImage : ARRAY[ 0.." + ( ( COPMCONST.SIZEOF_PROCIMG * m_PdoTx ) - 1 ) + " ] OF " + COPMCONST.DATA_TYPE + ";{ HIDDEN:ON }\n"
		}
		
		if ( CANOPEN_MASTER_TARGET_ARCHITECTURE == CANOPEN_MASTER_TARGET_POWERPC )
		{
			code += "		$$MEMORYMAPPING_ARRAY : ARRAY[ 0..10 ] OF DWORD;{ HIDDEN:ON }\n"
		}
		
		if ( CANOPEN_MASTER_SDO_SCHEDULING_SUPPORTED )
		{
			var isGroupSpecified = false
			for (var i = 0; i < m_MasterNodes.length; i++)
			{
				if (!isGroupSpecified)
				{
					code += "{\tG:\"Diagnostics\"}\n"
					isGroupSpecified = true
				}
				
				//	any SDO scheduled
				if (m_MasterNodes[i])	//	master available
				{
					if (m_MasterNodes[i].SDOSchedulingConfig.numItems > 0)
					{
						code += "		" + m_MasterNodes[i].SDOSchedulingDiagno.name + " : ARRAY[ 0.." + (m_MasterNodes[i].SDOSchedulingDiagno.numItems - 1) + " ] OF COPM_SDO_SCHEDULING_DIAGNO_STRUCT;\n"
					}
					else
					{
						code += "		" + m_MasterNodes[i].SDOSchedulingDiagno.name + " : ARRAY[ 0..0 ] OF COPM_SDO_SCHEDULING_DIAGNO_STRUCT;\n"
					}
				}
			}
		}
		
		code += "	END_VAR\n\n"
		
		code += "	PROGRAM CopMBoot WITH " + COPM_BOOT_TASK_NAME + ";\n\
		PROGRAM CopMBoot\n\
		{ HIDDEN:ON }\n\n\
		VAR\n\
			memory_return : DINT;\n\
			master_return : DINT;\n\
			slave_return : DINT;\n\
			pdo_return : DINT;\n\
			pdo_set_return : DINT;\n\
			adr_tmp : DWORD;\n\
			dummyCRC32 : UDINT;\n\
			bool_return : BOOL;\n"
			
		code += "	END_VAR\n\n"
		
		code += "	VAR CONSTANT\n"

		//	Inizializza le mappature
		if ( m_PdoRxIecMapping > 0 )
		{
			code += GeneratePDOMappingTable( m_PdoRxIecMappingList, m_PdoRxIecMapping, "Rx" )
		}
		if ( m_PdoTxIecMapping > 0 )
		{
			code += GeneratePDOMappingTable( m_PdoTxIecMappingList, m_PdoTxIecMapping, "Tx" )
		}

		//	Inizializza la struttura di configurazione
		code += "		$$PLCArrayWorkNetListCfg : ARRAY[ 0.." + ( m_NumSlaves * COPMCONST.SIZEOF_COPM_NETLIST_CFG_HDLR - 1 ) + " ] OF " + COPMCONST.DATA_TYPE + " := [\n\t\t\t"
		for ( var i = 0; i < m_NumSlaves; i++ )
		{
			for ( var j = 0; j < IDX_COPM_NETLIST_CFG_NUM; j++ )
			{
				//	i campi padding sono "" se il padding non è necessario
				if ( m_NetList_Cfg[ i ][ j ] === "" )
					continue
				
				code += m_NetList_Cfg[ i ][ j ]
				if ( j < IDX_COPM_NETLIST_CFG_NUM - 1 )
					code += ", "
			}
			if ( i < m_NumSlaves - 1 )
				code += ",\n\t\t\t"
			else
				code += "];\n"
		}
		
		//	per tutti i cobid rx usati mette l'indice del corrispondente PDO_HDL
		for ( var id in m_RxCobID_PDO_Map )
		{		
			var pdoInfo = m_RxCobID_PDO_Map[ id ]
			var cobid = pdoInfo.cobid
			if ( pdoInfo.can == 0 )
			{
				//	utilizza il byte basso
				RxCobID_PDO_List[ cobid - RXCOBID_PDO_RANGE_INI ] &= 0xFF00
				RxCobID_PDO_List[ cobid - RXCOBID_PDO_RANGE_INI ] |= pdoInfo.PDOHandler
			}
			else
			{
				//	utilizza il byte alto
				RxCobID_PDO_List[ cobid - RXCOBID_PDO_RANGE_INI ] &= 0x00FF
				RxCobID_PDO_List[ cobid - RXCOBID_PDO_RANGE_INI ] |= ( pdoInfo.PDOHandler << 8 )
			}
		}
		//	Inizializza una costante con tutti i COBID
		code += "		(* PDO range: " + RXCOBID_PDO_RANGE_INI + " to " + RXCOBID_PDO_RANGE_END + " *)\n"
		code += "		$$PLCArrayPDORxCobIDMap : ARRAY[ 0.." + ( RXCOBID_PDO_RANGE_END - RXCOBID_PDO_RANGE_INI ) + " ] OF WORD := [\n\t\t\t"
		for ( var i = 0; i < RxCobID_PDO_List.length; i++ )
		{
			code += "16#" + RxCobID_PDO_List[ i ].toString(16).toUpperCase()
			
			if ( i == RxCobID_PDO_List.length - 1 )
			{
				code += "];\n"
			}
			else
			{
				code += ", "
				
				if ( i % 20 == 19 )
					code += "\n\t\t\t"
			}
		}
		
			//	inizializza liste
		code += InitRxCobIDArray( "$$PLCArrayNetIDMap", m_RxCobID_Net_Map, m_MaxSlaveNodeId )
		
		if ( CANOPEN_MASTER_SDO_SCHEDULING_SUPPORTED )
		{
			for (var i = 0; i < m_MasterNodes.length; i++)
			{
				if (!m_MasterNodes[i])
					continue

				//	any SDO scheduled
				if (m_MasterNodes[i].SDOSchedulingConfig.numItems > 0)
				{
					code += "		" + m_MasterNodes[i].SDOSchedulingConfig.name + " : ARRAY[ 0.." + (m_MasterNodes[i].SDOSchedulingConfig.numItems - 1) + " ] OF COPM_SDO_SCHEDULING_CONFIG_STRUCT := [\n"
				}
				else
				{
					code += "		" + m_MasterNodes[i].SDOSchedulingConfig.name + " : ARRAY[ 0..0 ] OF COPM_SDO_SCHEDULING_CONFIG_STRUCT := [\n"
				
					//	fill dummy item
					var cfgItem = {}
					cfgItem["net"] = 0
					cfgItem["node"] = 0
					cfgItem["objIndex"] = 0
					cfgItem["objSubIndex"] = 0
					cfgItem["objLen"] = 0
					cfgItem["cmdDirection"] = 0
					cfgItem["reserved1"] = 0
					cfgItem["timeout"] = 0
					cfgItem["diagnoRecIndex"] = 0
					cfgItem["polling"] = 0
					cfgItem["variableAddress"] = "NULL"
					cfgItem["pOneshotVar"] = "NULL"
					// push cfg item
					m_MasterNodes[i].SDOSchedulingConfig.list.push(cfgItem)
				}
				
				//	N.B.: use m_MasterNodes[i].SDOSchedulingConfig.list.length instead of m_MasterNodes[i].SDOSchedulingConfig.numItems
				//	if numItems dummy entry is pushed into m_MasterNodes[i].SDOSchedulingConfig.list
				for (var j = 0; j < m_MasterNodes[i].SDOSchedulingConfig.list.length; j++)
				{
					var item = m_MasterNodes[i].SDOSchedulingConfig.list[j]
					var isFirst = true
					for (field in item)
					{
						if (isFirst)
						{
							isFirst = false
							code += "			("
						}
						else
						{
							code += ", "
						}
						code += field + " := " + item[field]
					}
					code += ")"
					if (j + 1 < m_MasterNodes[i].SDOSchedulingConfig.numItems)
						code += ",\n"
					else
						code += "\n"
				}
					
				code += "		];\n"
			}
		}

		code += "	END_VAR\n"
	}
	
	if ( CANOPEN_MASTER_SLAVE_CHANNEL_SUPPORTED && m_NumSlaves == 0 )
	{
		code += "	PROGRAM CopMBoot WITH " + COPM_BOOT_TASK_NAME + ";\n\
	PROGRAM CopMBoot\n\
	{ HIDDEN:ON }\n\n\
	VAR\n\
		master_return : DINT;\n\
		dummyCRC32 : UDINT;\n\
	END_VAR\n"
	
		code += "\n"
		code += "	{ CODE:ST }\n"
		
		var numLines = 0
		var numMasters = 0
		for ( var i = 0; i < m_MasterNodes.length; i++ )
		{
			if ( m_MasterNodes[ i ] )	//	impostato come master
			{
				var hbTimeStr = ""
				if ( CANOPEN_MASTER_HEARTBEAT_SUPPORTED )
					hbTimeStr = ", " + m_MasterNodes[ i ].hbTime
			
				code += "	master_return:= sysCopm_NetAssign( " + COPM_CHN_ENUM[ m_MasterNodes[ i ].port ] + ", " + 
																   COPM_BAUD_ENUM[ m_MasterNodes[ i ].baud ] + ", " + 
																   m_MasterNodes[ i ].masterNodeID + ", " + 
																   "16#" + m_MasterNodes[ i ].synccob.toString(16).toUpperCase() + ", " + 
																   m_MasterNodes[ i ].synccycle + hbTimeStr + " );\n"
				numMasters++
			}
			numLines += 1
		}
		code += "	master_return:= sysCopm_MasterAssign( " + numMasters + " );\n"
		
		// il calcolo del crc di questa parte serve a vedere se ci sono state modifiche sulla configurazione dello stack.
		// nel caso di modifiche il crc diverso, assegnato alla variabile plc dummyCrc32 causa la notifica dello status di modifica del task di init.
		// in caso di modifica della configurazione modbus, bisogna triggerare un warm restart per i target hotswap
		var dummyCrc32 = app.CallFunction("commonDLL.CalcCRC32ForData", code, 0)		
		if ( dummyCrc32 < 0 )
			dummyCrc32 = 0x100000000 + dummyCrc32		//	per avere valore UDINT: altrimenti mettendolo DINT esce un warning in preproc
				
		code += "	dummyCRC32 := " + dummyCrc32 + ";\n"
		code += "	END_PROGRAM\n"
	}
	else if ( m_NumSlaves > 0 )
	{	
		code += "\n"
		code += "	{ CODE:ST }\n"
		
		var numLines = 0
		for ( var i = 0; i < m_MasterNodes.length; i++ )
		{
			if ( !m_MasterNodes[ i ] )
				continue
			
			numLines += 1
			
			var hbTimeStr = ""
			if ( CANOPEN_MASTER_HEARTBEAT_SUPPORTED )
				hbTimeStr = ", " + m_MasterNodes[ i ].hbTime
			
			code += "	master_return:= sysCopm_NetAssign( " + COPM_CHN_ENUM[ m_MasterNodes[ i ].port ] + ", " + 
															   COPM_BAUD_ENUM[ m_MasterNodes[ i ].baud ] + ", " + 
															   m_MasterNodes[ i ].masterNodeID + ", " + 
															   "16#" + m_MasterNodes[ i ].synccob.toString(16).toUpperCase() + ", " + 
															   m_MasterNodes[ i ].synccycle + hbTimeStr + " );\n"
		}
		code += "	master_return:= sysCopm_MasterAssign( "+numLines+" );\n"
	}
	
	if ( m_NumSlaves > 0 )
	{		
		var memoryAllocated = ( ( COPMCONST.SIZEOF_COPM_NETLIST_HDLR + COPMCONST.SIZEOF_COPM_NETLIST_CFG_HDLR + COPMCONST.SIZEOF_NMTE_HDLR + COPMCONST.SIZEOF_SDO_HDLR + COPMCONST.SIZEOF_PRM_HDLR ) * m_NumSlaves ) + COPMCONST.SIZEOF_PROCIMG * ( m_PdoRx + m_PdoTx ) + ( COPMCONST.SIZEOF_PDO_RX_HDLR * m_PdoRx ) + ( COPMCONST.SIZEOF_PDO_TX_HDLR * m_PdoTx )
		
		if ( CANOPEN_MASTER_TARGET_ARCHITECTURE == CANOPEN_MASTER_TARGET_POWERPC )
		{	
			var strAddr = ( m_NumSlaves > 0 ) ? "ADR( sysCopmNetList )" : "0"
			code += "	$$MEMORYMAPPING_ARRAY[ MEMMAP_ADDR_COPMNETLIST ] := " + strAddr + ";\n"
			
			var strAddr = ( m_NumSlaves > 0 ) ? "ADR( $$PLCArrayWorkNetListCfg )" : "0"
			code += "	$$MEMORYMAPPING_ARRAY[ MEMMAP_ADDR_COPMNETLIST_CFG ] := " + strAddr + ";\n"
			
			var strAddr = ( m_NumSlaves > 0 ) ? "ADR( $$PLCArrayWorkNMTE )" : "0"
			code += "	$$MEMORYMAPPING_ARRAY[ MEMMAP_ADDR_WORK_NMTE ] := " + strAddr + ";\n"
			
			var strAddr = ( m_NumSlaves > 0 ) ? "ADR( $$PLCArrayWorkSDO )" : "0"
			code += "	$$MEMORYMAPPING_ARRAY[ MEMMAP_ADDR_WORK_SDO ] := " + strAddr + ";\n"
			
			var strAddr = ( m_NumSlaves > 0 ) ? "ADR( $$PLCArrayWorkPRM )" : "0"
			code += "	$$MEMORYMAPPING_ARRAY[ MEMMAP_ADDR_WORK_PRM ] := " + strAddr + ";\n"
			
			var strAddr = ( m_PdoRx > 0 ) ? "ADR( $$PLCArrayWorkRxPDO )" : "0"
			code += "	$$MEMORYMAPPING_ARRAY[ MEMMAP_ADDR_WORK_RX_PDO ] := " + strAddr + ";\n"
			
			var strAddr = ( m_PdoRx > 0 ) ? "ADR( $$PLCArrayInpProcImage )" : "0"
			code += "	$$MEMORYMAPPING_ARRAY[ MEMMAP_ADDR_INP_PROC_IMAGE ] := " + strAddr + ";\n"
			
			var strAddr = ( m_PdoTx > 0 ) ? "ADR( $$PLCArrayWorkTxPDO )" : "0"
			code += "	$$MEMORYMAPPING_ARRAY[ MEMMAP_ADDR_WORK_TX_PDO ] := " + strAddr + ";\n"
			
			var strAddr = ( m_PdoTx > 0 ) ? "ADR( $$PLCArrayOutProcImage )" : "0"
			code += "	$$MEMORYMAPPING_ARRAY[ MEMMAP_ADDR_OUT_PROC_IMAGE ] := " + strAddr + ";\n"
			
			code += "	$$MEMORYMAPPING_ARRAY[ MEMMAP_ADDR_WORK_PLC_IN ] := 0;\n"
			code += "	$$MEMORYMAPPING_ARRAY[ MEMMAP_ADDR_WORK_PLC_OUT ] := 0;\n"
			
			code += "	memory_return:= sysCopm_MemoryMappingArr( ADR( $$MEMORYMAPPING_ARRAY[ 0 ] ), " + m_NumSlaves + ", " + m_PdoRx + ", " + m_PdoTx + ", 0, 0, " + memoryAllocated + ");\n\n"
		}
		else
		{
			var strWorkSlaves = ( m_NumSlaves > 0 ) ? "TO_DWORD( ADR( sysCopmNetList ) ), TO_DWORD( ADR( $$PLCArrayWorkNetListCfg ) ), TO_DWORD( ADR( $$PLCArrayWorkNMTE ) ), TO_DWORD( ADR( $$PLCArrayWorkSDO ) ), TO_DWORD( ADR( $$PLCArrayWorkPRM ) ), " + m_NumSlaves : "0, 0, 0, 0, 0, 0"
			var strPdoRx = ( m_PdoRx > 0 ) ? "TO_DWORD( ADR( $$PLCArrayWorkRxPDO ) ), TO_DWORD( ADR( $$PLCArrayInpProcImage ) ), " + m_PdoRx : "0, 0, 0"
			var strPdoTx = ( m_PdoTx > 0 ) ? "TO_DWORD( ADR( $$PLCArrayWorkTxPDO ) ), TO_DWORD( ADR( $$PLCArrayOutProcImage ) ), " + m_PdoTx : "0, 0, 0"
		
			code += "	memory_return:= sysCopm_MemoryMapping( " + strWorkSlaves + ", " + strPdoRx + ", " + strPdoTx + ", 0, 0, 0, 0, " + memoryAllocated + ");\n\n"
		}

		code +=	"	adr_tmp := TO_DWORD( ADR( $$PLCArrayPDORxCobIDMap ) );\n"
		code += "	memory_return:= sysCopm_SetConstPDORxCobIDMap( adr_tmp, 16#" + RXCOBID_PDO_RANGE_INI.toString(16).toUpperCase() + ", " + ( RXCOBID_PDO_RANGE_END - RXCOBID_PDO_RANGE_INI + 1 ) + " );\n\n"
		code +=	"	adr_tmp := TO_DWORD( ADR( $$PLCArrayNetIDMap ) );\n"
		code += "	memory_return:= sysCopm_SetConstNetIDMap( adr_tmp, " + m_MaxSlaveNodeId + " );\n\n"

		var msg = app.Translate("%1: created CANopen Master cfg (%2 slaves, %3 variables)")
		app.PrintMessage(genfuncs.FormatMsg(msg, device.getAttribute("caption"), m_NumSlaves, m_totVars))
		
		code += m_slavesCode
		var strIecRx = ( m_PdoRxIecMapping > 0 ) ? "TO_DWORD( ADR( $$PLCArrayWorkPLCIn ) ), " + m_PdoRxIecMapping : "TO_DWORD( 0 ), 0"
		var strIecTx = ( m_PdoTxIecMapping > 0 ) ? "TO_DWORD( ADR( $$PLCArrayWorkPLCOut ) ), " + m_PdoTxIecMapping : "TO_DWORD( 0 ), 0"
		code += "	memory_return:= sysCopm_PdoIecMappingsSet( " + strIecTx + ", " + strIecRx + ");\n\n"

		if (CANOPEN_MASTER_SDO_SCHEDULING_SUPPORTED)
		{
			for (var i = 0; i < m_MasterNodes.length; i++)
			{
				if (!m_MasterNodes[i])
					continue
				
				var port = m_MasterNodes[ i ].port
				code += "\tbool_return := sysCopm_SdoSchedulingAssign( " + COPM_CHN_ENUM[ port ] + ", " + 
																		m_MasterNodes[ port ].SDOSchedulingConfig.numItems + ", " + 
																		"ADR(" + m_MasterNodes[ port ].SDOSchedulingConfig.name + "), " +
																		"ADR(" + m_MasterNodes[ port ].SDOSchedulingDiagno.name + ") );\n"
			}
		}

		// il calcolo del crc di questa parte serve a vedere se ci sono state modifiche sulla configurazione dello stack.
		// nel caso di modifiche il crc diverso, assegnato alla variabile plc dummyCrc32 causa la notifica dello status di modifica del task di init.
		// in caso di modifica della configurazione modbus, bisogna triggerare un warm restart per i target hotswap
		var dummyCrc32 = app.CallFunction("commonDLL.CalcCRC32ForData", code, 0)		
		if ( dummyCrc32 < 0 )
			dummyCrc32 = 0x100000000 + dummyCrc32		//	per avere valore UDINT: altrimenti mettendolo DINT esce un warning in preproc
				
		code += "\tdummyCRC32 := " + dummyCrc32 + ";\n"
		code += "\n\tEND_PROGRAM\n"
		code += "\n"
		code += "	PROGRAM CopMPrm WITH " + COPM_PAR_TASK_NAME + ";\n"
		code += "	PROGRAM CopMPrm\n\
		{ HIDDEN:ON }\n\n\
		VAR CONSTANT\n"
		code += "		$$PLCArrayWorkParTable : ARRAY[ 0.." + ( SIZEOF_COPM_TABLE_PARAM_RECORD * m_ParamTable.length - 1 ) + " ] OF WORD := [\n\t\t\t"

		for ( var i = 0; i < m_ParamTable.length; i++ )
		{
			var paramRecord = []
			paramRecord[ IDX_COPM_TABLE_PARAM_HNDL ] = m_ParamTable[ i ].hndl
			paramRecord[ IDX_COPM_TABLE_PARAM_NUM ] = m_ParamTable[ i ].par_num
			paramRecord[ IDX_COPM_TABLE_PARAM_INDEX ] = "16#" + m_ParamTable[ i ].par_index.toString(16).toUpperCase()
			if (COPMCONST.IS_BIG_ENDIAN)
				paramRecord[ IDX_COPM_TABLE_PARAM_HI_SUBINDEX_LO_LENGTH ] = "16#" + (( ( m_ParamTable[ i ].par_length << 8 ) & 0xFF00 ) | m_ParamTable[ i ].par_subindex).toString(16).toUpperCase()
			else
				paramRecord[ IDX_COPM_TABLE_PARAM_HI_SUBINDEX_LO_LENGTH ] = "16#" + (( ( m_ParamTable[ i ].par_subindex << 8 ) & 0xFF00 ) | m_ParamTable[ i ].par_length).toString(16).toUpperCase()
			// qui il caso BIGENDIAN viene gestito correttamente perchè c'è una composizione con una macro MAKE_DWORD(lwo,hwo)
			paramRecord[ IDX_COPM_TABLE_PARAM_VALUE_LW ] = m_ParamTable[ i ].par_value & 0xFFFF
			paramRecord[ IDX_COPM_TABLE_PARAM_VALUE_HW ] = ( m_ParamTable[ i ].par_value >> 16 ) & 0xFFFF
			paramRecord[ IDX_COPM_TABLE_PARAM_ISREAL ] = m_ParamTable[ i ].isReal
			paramRecord[ IDX_COPM_TABLE_PARAM_TIMEOUT ] = m_ParamTable[ i ].timeout
			
			for ( var j = 0; j < SIZEOF_COPM_TABLE_PARAM_RECORD; j++ )
			{
				code += paramRecord[ j ]
				
				if ( j < SIZEOF_COPM_TABLE_PARAM_RECORD - 1 )
				{
					code += ", "
				}
			}
			
			if ( i < m_ParamTable.length - 1 )
			{
				code += ",\n\t\t\t"
			}
			else
			{
				code += "\n\t\t];\n"	
			}
		}
		code += "		END_VAR\n\n"
		
		// il calcolo del crc di questa parte serve a vedere se ci sono state modifiche sulla configurazione dello stack.
		// nel caso di modifiche il crc diverso, assegnato alla variabile plc dummyCrc32 causa la notifica dello status di modifica del task di init.
		// in caso di modifica della configurazione modbus, bisogna triggerare un warm restart per i target hotswap
		var dummyCrc32 = app.CallFunction("commonDLL.CalcCRC32ForData", code, 0)		
		if ( dummyCrc32 < 0 )
			dummyCrc32 = 0x100000000 + dummyCrc32		//	per avere valore UDINT: altrimenti mettendolo DINT esce un warning in preproc
		
		code += "		VAR\n\
			param_set_return : DINT;\n\
			dummyCRC32 : UDINT;\n\
		END_VAR\n\n\
		{ CODE:ST }\n\n\
		param_set_return := sysCopm_SlavePrmSet( TO_DWORD( ADR( $$PLCArrayWorkParTable ) ), " + m_ParamTable.length + " );\n\
		dummyCRC32 := " + dummyCrc32 + ";\n\
		\n\
	END_PROGRAM\n\n"
	}
	
	if (!COPM_USE_APPLICATION_DB)
	{
		// genero sempre l'array (anche unitario) di diagnostica e relative costanti
		var arrayBound = m_NumSlaves - 1
		if(arrayBound == -1)
			arrayBound = 0;
		
		var diagnoVar = GenerateDianosticVarsCOPM(arrayBound, m_NumSlaves)
		code += "\n\tVAR_GLOBAL \n" + diagnoVar.globalVarCode + "\tEND_VAR\n\n";
		code += "\n\tVAR_GLOBAL CONSTANT\n" + diagnoVar.globalConstCode + "\tEND_VAR\n\n";
    }
	
	return code
}

function GeneratePDOMappingTable( mappingList, numMappings, RxTxMode )
{
/*	Genero tabella PDO, questa la struttura dell'oggetto */
/*	
	pdoMappingObj.can
	pdoMappingObj.cobid
	pdoMappingObj.cobid_hex
	pdoMappingObj.isOnDatablock
	pdoMappingObj.db.index
	pdoMappingObj.db.offset
	pdoMappingObj.db.type
	pdoMappingObj.label
	pdoMappingObj.mapping.BitStart
	pdoMappingObj.mapping.BitLength
	pdoMappingObj.mapping.numVars
	pdoMappingObj.mapping.hex
	pdoMappingObj.isPdoRx
	pdoMappingObj.mappingNum
*/
	var code = ""
	
	if ( numMappings > 0 )
	{
		if ( numMappings == 1 )
			var numMappingsArraySize = 1
		else
			var numMappingsArraySize = numMappings - 1

		if ( RxTxMode == "Rx" )
			var PLCArray = "$$PLCArrayWorkPLCIn"
		else
			var PLCArray = "$$PLCArrayWorkPLCOut"
		code += "\t\t" + PLCArray + " : ARRAY[ 0.." + numMappingsArraySize + " ] OF COPM_PLC_HDLR_STRUCT := [\n"
		for ( var i = 0; i < numMappings; i++ )
		{
			//	word 0 + 1		word 2 + 3		word 4					word 5
			//	pPlcImage		pProcImage		mappingBitOffBitLen		mappingNElem
			var pdoMappingObj = mappingList[ i ]
			//	con allocazione fissa è possibile avere direttamente l'indirizzo del datablock quando si compila.
			//	questo sistema NON FUNZIONA con sistemi che utilizzano link dinamici
			//	quando saranno disponibili gli indirizzi, invece dei primi due zeri bisogna mettere "?" + pdoMappingObj.label e "?$$PLCArrayInpProcImage( or Out for Tx)[" + ( pdoMappingObj.pdoNum * SIZEOF_PROCIMG ) + "]"
			var bitofflen = pdoMappingObj.mapping.BitLength
			bitofflen = bitofflen << 8 | pdoMappingObj.mapping.BitStart
			//	gestione dell'eventuale reverse per target big endian
			var mappingNElemValue = PrepareWordConstant( pdoMappingObj.mapping.numVars )
			if ( RxTxMode == "Rx" )
			{
				code += "\t\t\t( pPlcImage := ?" + pdoMappingObj.label + ", pProcImage := ?$$PLCArrayInpProcImage[" + ( pdoMappingObj.pdoNum * COPMCONST.SIZEOF_PROCIMG ) + "], mappingBitOffBitLen := 16#" + bitofflen.toString(16).toUpperCase() + ", mappingNElem := 16#" + mappingNElemValue.toString(16).toUpperCase() + ")"
			}
			else	//	"Tx"
			{
				code += "\t\t\t( pPlcImage := ?" + pdoMappingObj.label + ", pProcImage := ?$$PLCArrayOutProcImage[" + ( pdoMappingObj.pdoNum * COPMCONST.SIZEOF_PROCIMG ) + "], mappingBitOffBitLen := 16#" + bitofflen.toString(16).toUpperCase() + ", mappingNElem := 16#" + mappingNElemValue.toString(16).toUpperCase() + ")"
			}

			if ( numMappings == 1 )
			{
				code += ",\n\t\t\t( pPlcImage := 16#00000000, pProcImage := 16#00000000, mappingBitOffBitLen := 16#0000, mappingNElem := 16#00000000 )"	
			}
			else if ( ( i + 1 ) < numMappings )
			{
				code += ","
			}
			code += "\n"
		}
		code += "\t\t];\n"
	}
	
	return code
}

function CPDOVarGroup(curVar)
{
	// inizializzazione nuovo gruppo
	this.firstVar = curVar
	this.numVars = 1
	this.lastBit = curVar.BitStart + curVar.BitLength
	// dimensione in bit usata per fare il confronto di omogenità
	this.bitSize  = app.CallFunction("common.GetIECTypeBits", curVar.type)
	// dimensione in byte per controllare consecutività (i bool hanno bitSize==1 ma byteSize==1, e non bitSize/8)
	this.byteSize = app.CallFunction("common.GetIECTypeSize", curVar.type)
	this.db = app.CallFunction("common.ParseDataBlock", curVar.dataBlock)
	switch (this.db.type)
	{
	case "B":
		this.dbRecSize = 1
		break;
	case "W":
		this.dbRecSize = 2
		break;
	case "D":
		this.dbRecSize = 4
		break;
	case "X":
		this.dbRecSize = 1
		break;
	}
}

CPDOVarGroup.prototype.CanAddVar = function(curVar)
{
	var curBitSize = app.CallFunction("common.GetIECTypeBits", curVar.type)
	var curdb = app.CallFunction("common.ParseDataBlock", curVar.dataBlock)
	
	// può aggiungere se numero di bit uguale, indirizzo consecutivo e indice bit del pdo consecutivo
	if (!(curBitSize == this.bitSize && 
		this.db.offset + Math.ceil(this.numVars * this.byteSize / this.dbRecSize) == curdb.offset && 
		curVar.BitStart == this.lastBit))
	{
		return false
	}

	//	se ho una mappatura di un datablock a bit devo essere sempre sulla stessa word
	if ( curBitSize == 1 && ( Math.floor(this.db.offset / 16) != Math.floor(curdb.offset / 16) ) )
		return false
	
	return true
}

CPDOVarGroup.prototype.AddVar = function(curVar)
{
	this.numVars++
	this.lastBit = curVar.BitStart + curVar.BitLength
}

var m_DataBlockAreaIndex = { "M":0, "I":1, "Q":2 }

CPDOVarGroup.prototype.GeneratePLC = function(nodeid, copmcan, rxtx, COBID)
{
	var pdoMappingObj = {}
/*	
	pdoMappingObj.can
	pdoMappingObj.cobid
	pdoMappingObj.cobid_hex
	pdoMappingObj.isOnDatablock
	pdoMappingObj.db.index
	pdoMappingObj.db.offset
	pdoMappingObj.db.type
	pdoMappingObj.label
	pdoMappingObj.mapping.BitStart
	pdoMappingObj.mapping.BitLength
	pdoMappingObj.mapping.numVars
	pdoMappingObj.mapping.hex
	pdoMappingObj.isPdoRx
	pdoMappingObj.pdoNum
	pdoMappingObj.mappingNum
*/
	pdoMappingObj.can = copmcan
	pdoMappingObj.cobid = COBID
	
	var cobid_hex = pdoMappingObj.cobid
	if ( pdoMappingObj.can == 1 )
		cobid_hex |= 0x8000
	pdoMappingObj.cobid_hex = "16#" + cobid_hex.toString(16).toUpperCase()
	
	pdoMappingObj.isOnDatablock = !(this.numVars == 1 && this.firstVar.dataBlock == "Auto")
	if ( pdoMappingObj.isOnDatablock )
	{
		pdoMappingObj.db = {}
		pdoMappingObj.db.index = this.db.datablock
		pdoMappingObj.db.offset = this.db.offset
		pdoMappingObj.db.type = m_DataBlockAreaIndex[this.db.area]
	}

	pdoMappingObj.label = this.firstVar.VarLabel 
	
	pdoMappingObj.mapping = {}
	pdoMappingObj.mapping.BitStart = parseInt( this.firstVar.BitStart )
	pdoMappingObj.mapping.BitLength = parseInt( this.firstVar.BitLength )
	pdoMappingObj.mapping.numVars = parseInt( this.numVars )
	
	var map_info = 0
	map_info = pdoMappingObj.mapping.BitLength
	map_info = ( map_info << 8 ) | pdoMappingObj.mapping.BitStart
	map_info = ( map_info << 16 ) | pdoMappingObj.mapping.numVars
	
	//	crea la DWORD map_info in questo modo:
	//	0  .. numVars   .. 15
	//	16 .. BitStart  .. 23
	//	24 .. BitLength .. 31
	pdoMappingObj.mapping.hex = "16#" + map_info.toString(16).toUpperCase()
	pdoMappingObj.isPdoRx = (rxtx == "Rx")
	if ( pdoMappingObj.isPdoRx )
	{
		pdoMappingObj.mappingNum = m_PdoRxIecMapping++;	//	salvo id corrente e incremento numero iec mapping rx
		pdoMappingObj.pdoNum = m_PdoRx;
		m_PdoRxIecMappingList.push( pdoMappingObj )		//	metto l'oggetto in lista
	}
	else
	{
		pdoMappingObj.mappingNum = m_PdoTxIecMapping++;	//	salvo id corrente e incremento numero iec mapping tx
		pdoMappingObj.pdoNum = m_PdoTx;
		m_PdoTxIecMappingList.push( pdoMappingObj )		//	metto l'oggetto in lista
	}
		
/*
	NEL VECCHIO MODO DI ASSEGNAZIONE DELLE MAPPATURE VENIVANO FATTE UNA SERIE DI CHIAMATE,
	QUESTO MODO E STATO SOSTITUITO DALL'ASSEGNAMENTO DI UNA TABELLA DI COSTANTI
	
	//	genero codice chiamata
	if ( !pdoMappingObj.isOnDatablock )
	{
		var pdoCode = "\tadr_tmp:=ADR(" + pdoMappingObj.label + ");\n\
\tpdo_set_return:= sysCopm_Pdo" + rxtx + "IecMappingVar(" + pdoMappingObj.cobid_hex + ", " + pdoMappingObj.mapping.hex + ", adr_tmp);\n"
		return pdoCode;
	}
	else
	{	
		var pdoCode = "\tpdo_set_return:= sysCopm_Pdo" + rxtx + "IecMapping( " + pdoMappingObj.cobid_hex + ", " + pdoMappingObj.mapping.hex + ", " + pdoMappingObj.db.index + ", " + pdoMappingObj.db.offset + ", " + pdoMappingObj.db.type + ");\n"
		return pdoCode;
	}
*/
	return ""
}

// crea configurazione per mappatura PDO
//aggiunto parametri nodeid copmcan e cyclingtime
function BuildCfg_CANopenMaster_PDO(nodeid, netid, cyclingTime, PDO, rxtx, tt, mappedVars)
{
	var FUNCNAME = "BuildCfg_CANopenMaster_PDO"
	var totVars = 0
	var pdoCode = ""	
	
	var cobid = parseInt( PDO.COBID )
	var cobid_with_can = ( netid == 0 ) ? ( cobid ) : ( cobid | 0x8000 )
		
	// crea nodo <pdo>
	pdoCode += "	pdo_return:= sysCopm_Pdo" + rxtx + "Install("+COPM_NET_ENUM[netid]+","+nodeid+",16#"+cobid.toString(16).toUpperCase()+","+tt+","+Math.ceil(PDO.size / 8)+","+cyclingTime+");\n"
	
	// valorizza un record nella mappa dei cobid con il progressivo del PDO handler corrente
	if ( rxtx == "Rx" )
	{		
		if ( !(( cobid >= RXCOBID_PDO_RANGE1_INI && cobid <= RXCOBID_PDO_RANGE1_END ) || (cobid >= RXCOBID_PDO_RANGE2_INI && cobid <= RXCOBID_PDO_RANGE2_END )) )
		{
			var errmsg = genfuncs.FormatMsg(app.Translate("Cannot assign COBID '0x%1' for node '%2'. Allowed range is [0x%3,0x%4],[0x%5,0x%6]"), cobid.toString(16).toUpperCase(), nodeid, RXCOBID_PDO_RANGE1_INI.toString(16).toUpperCase(), RXCOBID_PDO_RANGE1_END.toString(16).toUpperCase(), RXCOBID_PDO_RANGE2_INI.toString(16).toUpperCase(), RXCOBID_PDO_RANGE2_END.toString(16).toUpperCase() )
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg)
		}
		else
		{
			//	mette le informazioni sul cobid e il numero progressivo del PDO nella mappa
			var pdoInfo = {}
			pdoInfo.PDOHandler = m_PdoRx
			pdoInfo.node = nodeid
			pdoInfo.can = netid
			pdoInfo.cobid = cobid
			
			m_RxCobID_PDO_Map[ cobid_with_can ] = pdoInfo
		}
	}
	
	var currentGroup
	
	for (var v = 0; v < PDO.vars.length; v++)
	{
		var curVar = PDO.vars[v]
		if (!curVar.VarLabel || !curVar.dataBlock)
			continue
			
			//	se la variabile non è automatica devo verificare se è su datablock
		if (curVar.dataBlock != "Auto")
		{
			var PLCvar = mappedVars[curVar.VarLabel]
			if (!PLCvar)
			{
				// variabile PLC cancellata
				var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has been deleted or changed to 'Auto' allocation"), curVar.VarLabel)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
			}
			
			var PLCvarSize = app.CallFunction("common.GetIECTypeBits", PLCvar.type);
			var curVarSize = app.CallFunction("common.GetIECTypeBits", curVar.type);
			if (!PLCvar || PLCvarSize != curVarSize || PLCvar.DataBlock != curVar.dataBlock)
			{
				// variabile PLC cancellata o modificata
				var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has been deleted or modified in type or allocation"), curVar.VarLabel)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, app.CallFunction("common.SplitFieldPath", curVar.node))
			}
		
			if (!currentGroup)
			{
				// nessun gruppo corrente, ne crea uno nuovo
				currentGroup = new CPDOVarGroup(curVar)
			}
			else if (currentGroup.CanAddVar(curVar))
			{
				// se possibile aggiungere al gruppo corrente, aggiunge la variabile attuale
				currentGroup.AddVar(curVar)
			}
			else
			{
				// non � possibile aggiungere: scrive il gruppo corrente e ne crea uno nuovo
				pdoCode += currentGroup.GeneratePLC(nodeid, netid, rxtx, PDO.COBID)
				totVars += currentGroup.numVars
			
				currentGroup = new CPDOVarGroup(curVar)
			}
		}
		else
		{
			// le variabili automatiche non possono essere raggruppate
			currentGroup = new CPDOVarGroup(curVar)
						
			// non � possibile aggiungere: scrive il gruppo corrente e ne crea uno nuovo
			pdoCode += currentGroup.GeneratePLC(nodeid, netid, rxtx, PDO.COBID)
			totVars += currentGroup.numVars
			
			currentGroup = undefined
		}
	}
	
	if (currentGroup)
	{
		// scrive ultimo gruppo alla fine dell'iterazione sulle variabili
		pdoCode += currentGroup.GeneratePLC(nodeid, netid, rxtx, PDO.COBID)
		totVars += currentGroup.numVars
	}
	
	if ( rxtx == "Rx" )
	{
		m_PdoRx++;
		m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_PDORX ]++;
	}
	else if ( rxtx == "Tx" )
	{
		m_PdoTx++;
		m_NetList_Cfg[ m_NumSlaves ][ IDX_COPM_NETLIST_CFG_PDOTX ]++;
	}
	
	// ritorna il codice generato e il numero totale delle variabili
	var result = {}
	result.pdoCode = pdoCode
	result.totVars = totVars
	return result
}

function InitRxCobIDArray( varName, map, maxNodeId )
{
	//	Inizializza una costante con tutti i COBID utilizzati negli SDO
	var code = "		" + varName + " : ARRAY[ 0.." + maxNodeId + " ] OF WORD := [\n\t\t\t"
	var nodeId = 0
	for ( var i in map )
	{			
		code += "16#" + map[ i ].toString(16).toUpperCase()		
		
		if ( nodeId == maxNodeId )
		{
			code += "];\n"
			break;
		}
		else
		{
			code += ", "
			
			if ( nodeId % 15 == 14 )
				code += "\n\t\t\t"
				
			nodeId++
		}			
	}
	return code
}


function GenerateDianosticVarsCOPM(arrBound, arrCount)
{
	var groupPragma = "{\tG:\"Diagnostics\"}\n"
	
	var globalVarCode = groupPragma
	globalVarCode += "\t\t" + "sysCopmNetList" + " : ARRAY[ 0.." + COPMNETLIST_ARRAY_UPPER_BOUND_NAME + " ] OF COPM_NETLIST_STRUCT; { DE:\"Status of CANopen Master Net list\" }\n"
	
	var globalConstCode = groupPragma
	globalConstCode += "\t\t" + COPMNETLIST_ARRAY_UPPER_BOUND_NAME + " : USINT := " + arrBound + "; { DE:\"Upper bound of CANopen Master Net list array\" }\n"
	globalConstCode += "\t\t" + COPMNETLIST_ARRAY_COUNT_NAME + " : USINT := " + arrCount + "; { DE:\"Number of CANopen slaves on net\" }\n"
	
	return {globalVarCode:globalVarCode, globalConstCode:globalConstCode}
	
}