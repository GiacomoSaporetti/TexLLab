var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var gentypes = app.CallFunction("common.GetGeneralTypes")
var enuLogLevels = gentypes.enuLogLevels
var TREENAME = "tree1"

	// id icone di overlay per l'albero
var TREE_OVERLAY_NONE = 0
var TREE_OVERLAY_DISABLED = 1

// lo standard CANopen DS301 definisce i COBID solo dei primi 4 PDO, oltre sono implementation-specific!
// http://www.canopensolutions.com/english/about_canopen/predefined.shtml
// i PDOTx5 e PDORx5 sono allocati nei range 680..6FF e 780..7FF (sempre liberi non avendo LSS), mentre per poter utilizzare
// gli altri PDO 6..8 è necessario che la rete CAN abbia un numero di slave < 64, per non collidere con i COBID !
var PDOTx_COBIDList = [ 0x180, 0x280, 0x380, 0x480, 0x680, 0x1C0, 0x2C0, 0x3C0 ]
var PDORx_COBIDList = [ 0x200, 0x300, 0x400, 0x500, 0x780, 0x240, 0x340, 0x440 ]

//	riempio la struttura di configurazione generale
var m_copsCfg = GetCOPSCfgInfo()

function GetCOPSCfgInfo()
{
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var CANopenNode = app.SelectNodesXML("/" + targetID + "/CANopen")[0]
		
	//	riempio la struttura di configurazione
	var copsCfg = {}
	copsCfg.max_tpdo_num = parseInt(CANopenNode.getAttribute("slaveCfgMaxTPDONum"))
	copsCfg.max_rpdo_num = parseInt(CANopenNode.getAttribute("slaveCfgMaxRPDONum"))
	copsCfg.granularity = parseInt(CANopenNode.getAttribute("slaveCfgGranularity"))
	copsCfg.COBIDauto = parseInt(CANopenNode.getAttribute("slaveCfgCOBIDAutoAssignment"))
	copsCfg.max_pdo_size = 64
	copsCfg.max_entries = copsCfg.max_pdo_size / copsCfg.granularity	
	
	return copsCfg
}

function OnLoadNode(node)
{
	//	aggiorna caption
	var PDOnumber = genfuncs.GetNode( node, "PDO_config[1]/Number[1]" )
	UpdateCOBID(node)
	
	//caricamento overlay icona per disabilitazione
	var enabled = node.getAttribute("enabled")
	
	if (enabled === null)
	{
		node.setAttribute("enabled", "1")
		enabled = true
	}
	else
		enabled = genfuncs.ParseBoolean(enabled)
	
	if (!enabled)
	{
		var datapath = app.GetDataPathFromNode(node)
		// mette overlay di disabilitazione (X rossa)
		app.HMISetOverlayImg("tree1", app.HMIGetElementPath("tree1", datapath), TREE_OVERLAY_DISABLED)
	}
}

function OnCreateNode(node)
{
	var groupNode = node.parentNode
	var PDOnumber = FindFirstFreePDO(groupNode)
	
	genfuncs.SetNode( node, "PDO_config[1]/Number[1]", PDOnumber )
	SetCaption(node, PDOnumber)
	UpdateCOBID(node)
}

function SetCaption(node, PDOnumber)
{
	var caption = "PDO #" + PDOnumber
	node.setAttribute( "caption", caption )
	app.HMISetCaption(TREENAME, app.HMIGetElementPath(TREENAME, app.GetDataPathFromNode(node)), caption)
}

function SetCOBID(node, COBIDhex)
{
	if (isNaN(COBIDhex))
		return false
	
	var COBIDdec = parseInt(COBIDhex, 16)
	
	//	range non ammissibili
	if ( COBIDdec < 0x180 || (COBIDdec >= 0x580 && COBIDdec < 0x680 ) || (COBIDdec >= 0x700 && COBIDdec < 0x780 ) || COBIDdec >= 0x800 )
		return false
		
	genfuncs.SetNode( node, "PDO_config[1]/COBID[1]", COBIDdec )
	return true
}

function OnPasteNode(node)
{
	//	resetto il valore del numero di pdo
	genfuncs.SetNode( node, "PDO_config[1]/Number[1]", 0 )
	//	lo ricalcolo
	OnCreateNode(node)
}

function ChangePDONumber( node, newValue )
{
	if (isNaN(newValue))
		return false
	
	var direction = node.parentNode.getAttribute( "direction")
	var max_pdo_num = (direction == "TX" ? m_copsCfg.max_tpdo_num : m_copsCfg.max_rpdo_num )
	
	var newValueInt = parseInt(newValue)
	if ( newValueInt > 0 && newValueInt <= max_pdo_num)
	{
		if ( IsPDONumberFree( node.parentNode, newValueInt ) )
		{
			genfuncs.SetNode( node, "PDO_config[1]/Number[1]", newValueInt )
			SetCaption(node, newValueInt)
			UpdateCOBID(node)
			return true
		}
	}
	
	return false
}

function FindFirstFreePDO(groupNode)
{
	var direction = groupNode.getAttribute( "direction")
	var max_pdo_num = (direction == "TX" ? m_copsCfg.max_tpdo_num : m_copsCfg.max_rpdo_num )
	
	for (var pdo_num = 1; pdo_num <= max_pdo_num; pdo_num++ )
	{
		if ( IsPDONumberFree( groupNode, pdo_num ) )
			return pdo_num
	}
	
	return 0
}

function IsPDONumberFree(groupNode, pdo_num)
{
	var found = false
	for (i = 0; i < groupNode.childNodes.length; i++)
	{
		var PDOnode = groupNode.childNodes[i]
		if ( parseInt( genfuncs.GetNode( PDOnode, "PDO_config[1]/Number[1]" ) ) == pdo_num )
		{
			found = true
			break;
		}
	}
	return !found
}

//	se siamo in COBID auto mode aggiorna il valore del cobid
function UpdateCOBID(node)
{	
	var groupNode = node.parentNode
	var canopenNode = groupNode.parentNode
	var isCOBIDAuto = canopenNode.getAttribute("slaveCfgCOBIDAutoAssignment")
	
	//	solo se assegnamento automatico attivo!
	if (!isCOBIDAuto)
		return
	
	//	se definito
	isCOBIDAuto = parseInt( isCOBIDAuto )
	if (!isCOBIDAuto)
		return
	
	var PDOnumber = parseInt(genfuncs.GetNode( node, "PDO_config[1]/Number[1]" ))
	var isTx = groupNode.getAttribute("direction") == "TX"	
	var nodeId = parseInt(canopenNode.getAttribute("slaveNodeID"))

	if ( isTx )
		var cobid = PDOTx_COBIDList[PDOnumber - 1]
	else
		var cobid = PDORx_COBIDList[PDOnumber - 1]
	
	cobid += nodeId
	
	var cobidPrevValue = genfuncs.GetNode( node, "PDO_config[1]/COBID[1]" )
	if ( cobidPrevValue != cobid )
		genfuncs.SetNode( node, "PDO_config[1]/COBID[1]", cobid )
}

//	Validazione del singolo pdo
function ValidatePDO(node, paramDBMap)
{
	var PDOobject = {}
	var direction = node.parentNode.getAttribute( "direction" )
	var configNode = node.selectSingleNode( "PDO_config" )
	
	if ( direction == "TX" )
		var PDOdescr = "TPDO"
	else
		var PDOdescr = "RPDO"
	
	//	Number
	PDOobject.Number = parseInt(genfuncs.GetNode( configNode, "Number" ))
	if ( isNaN(PDOobject.Number) || PDOobject.Number < 0 || ( direction == "TX" && PDOobject.number > m_copsCfg.max_tpdo_num ) || ( direction == "RX" && PDOobject.number > m_copsCfg.max_rpdo_num ) )
	{
		var err = app.CallFunction("common.SplitFieldPath", configNode.selectSingleNode("Number"))
		var msg = app.Translate( "Invalid PDO number" )
		return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "COPS validate PDO", msg, err)
	}
	
	//	COBID
	PDOobject.COBID = parseInt(genfuncs.GetNode( configNode, "COBID" ))
	if ( isNaN(PDOobject.COBID) || PDOobject.COBID < 0 || ( PDOobject.COBID >= 0x800 && ( ( PDOobject.COBID & 0x80000000 ) == 0 ) ) )
	{
		var err = app.CallFunction("common.SplitFieldPath", configNode.selectSingleNode("COBID"))
		var msg = app.Translate( "COBID out of range")
		return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "COPS validate PDO", msg, err)
	}
	
	//	TransmissionType
	PDOobject.TransmissionType = parseInt(genfuncs.GetNode( configNode, "TransmissionType" ))
	if ( isNaN(PDOobject.TransmissionType) || PDOobject.TransmissionType < 0 || PDOobject.TransmissionType > 255 )
	{
		var err = app.CallFunction("common.SplitFieldPath", configNode.selectSingleNode("TransmissionType"))
		var msg = app.Translate( "Invalid Transmission Type specified")
		return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "COPS validate PDO", msg, err)
	}
	
	//	EventTimer
	PDOobject.EventTimer = parseInt(genfuncs.GetNode( configNode, "EventTimer" ))
	if ( isNaN(PDOobject.EventTimer) || PDOobject.EventTimer < 0 )
	{
		var err = app.CallFunction("common.SplitFieldPath", configNode.selectSingleNode("EventTimer"))
		var msg = app.Translate( "Invalid Event Timer specified" )
		return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "COPS validate PDO", msg, err)
	}
	
	PDOobject.NumberOfEntries = 0
	PDOobject.EntryList = []
	for ( var bitPos = 0; bitPos < m_copsCfg.max_pdo_size; )
	{
		var PDOentryList = configNode.selectNodes( "PDO_entryList/PDO_entry[BitStart = '" + bitPos + "']" )
		if ( PDOentryList.length == 0 )
		{
			//	se questo è vuoto i successivi devono essere vuoti
			var PDOemptyList = configNode.selectNodes( "PDO_entryList/PDO_entry[BitStart > '" + bitPos + "' and BitStart < '" + m_copsCfg.max_pdo_size + "']" )
			if ( PDOemptyList.length > 0 )
			{
				var err = app.CallFunction("common.SplitFieldPath", PDOemptyList[0])
				var msg = app.Translate( "PDO mapping sequence misaligned" )
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "COPS validate PDO", msg, err)
			}
			else if ( bitPos == 0 )
			{
				var err = app.CallFunction("common.SplitFieldPath", configNode)
				var msg = genfuncs.FormatMsg(app.Translate( "No object entries specified for %1 #%2" ), PDOdescr, PDOobject.Number )
				app.CallFunction("common.AddLog", enuLogLevels.LEV_INFO, "COPS validate PDO", msg, err)
				return enuLogLevels.LEV_OK
			}
		}
		else if ( PDOentryList.length > 1 )
		{
			var err = app.CallFunction("common.SplitFieldPath", PDOentryList[0])
			var msg = app.Translate( "Duplicated PDO entry" )
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "COPS validate PDO", msg, err)
		}
		else
		{
			var PDOentry = PDOentryList[0]
		}
		
		//	il bit di partenza deve essere allineato alla granularity
		if ( bitPos % m_copsCfg.granularity != 0 )
		{
			var err = app.CallFunction("common.SplitFieldPath", PDOentry)
			var msg = app.Translate( "Start bit misaligned in PDO mapping" )
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "COPS validate PDO", msg, err)
		}
		
		var objectIndex = parseInt(genfuncs.GetNode(PDOentry, "index"))
		var objectSubindex = parseInt(genfuncs.GetNode(PDOentry, "subindex"))
		var key = "0x" + objectIndex.toString(16) + "." + objectSubindex.toString()
		var obj = paramDBMap[key]
		
		if ( !obj )
		{
			var err = app.CallFunction("common.SplitFieldPath", PDOentry)
			var msg = app.Translate( "Cannot find specified database object" )
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "COPS validate PDO", msg, err)
		}
		else if ( parseInt(obj.readonly) && direction == "RX" )
		{
			var err = app.CallFunction("common.SplitFieldPath", PDOentry)
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "COPS validate PDO", "Cannot map readonly object in RPDO", err)
		}
		
		//	calcola valore
		var bitSize = app.CallFunction("common.GetIECTypeBits", obj.type)
		if ( bitSize < m_copsCfg.granularity )
			bitSize = m_copsCfg.granularity	//	BOOL viene trattato come BYTE

		//	verifica limite size PDO (in bit)
		if ( ( bitPos + bitSize ) > 64 )
		{
			var err = app.CallFunction("common.SplitFieldPath", PDOentry)
			var msg = app.Translate( "PDO mapping exceeds PDO max size" )
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "COPS validate PDO", msg, err)
		}

		//	i successivi devono essere vuoti
		var PDOemptyList = configNode.selectNodes( "PDO_entryList/PDO_entry[BitStart > '" + bitPos + "' and BitStart < '" +  (bitPos + bitSize) + "']" )
		if ( PDOemptyList.length > 0 )
		{
			var err = app.CallFunction("common.SplitFieldPath", PDOemptyList[0])
			var msg = app.Translate( "PDO mapping sequence overlapping" )
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "COPS validate PDO", msg, err)
		}
		
		bitPos = bitPos + bitSize
		
		PDOobject.NumberOfEntries++
	}
	
	if ( PDOobject.NumberOfEntries > m_copsCfg.max_entries )
	{
		var err = app.CallFunction("common.SplitFieldPath", configNode)
		var msg = app.Translate( "Number of entries exceeds limit" )
		return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "COPS validate PDO", msg, err)
	}

	return enuLogLevels.LEV_OK
}
				
//	chiamata in fase di generazione del conf
//	riempie una struttura con tutte le info del pdo
function GetPDO( PDOgroupNode, PDOnum, paramDBMap )
{
	var direction = PDOgroupNode.getAttribute( "direction" )
	var PDOnode = PDOgroupNode.selectSingleNode( "*/PDO_config[Number = '" + PDOnum + "']")
	
	var PDOobject = {}
	
	//	non esiste il PDO indicato
	if ( !PDOnode )
	{
		//	PDO disabilitato
		PDOobject.COBID = 0x80000000
		return PDOobject
	}
	
	/*	PDO abilitato? */
	var enabled = PDOnode.parentNode.getAttribute("enabled")
	if (enabled === null)
		enabled = true
	else
		enabled = genfuncs.ParseBoolean(enabled)

	if ( !enabled )
	{
		//	PDO disabilitato
		PDOobject.COBID = 0x80000000
		return PDOobject
	}
		
	/*	PDO esistente e abilitato */
	
	var ris = ValidatePDO( PDOnode.parentNode, paramDBMap )
	if ( ris != enuLogLevels.LEV_OK )
		return undefined	//	errore
	
	PDOobject.Number = PDOnum
	PDOobject.COBID = parseInt(genfuncs.GetNode( PDOnode, "COBID" ))
	PDOobject.TransmissionType = parseInt(genfuncs.GetNode( PDOnode, "TransmissionType" ))
	PDOobject.EventTimer = parseInt(genfuncs.GetNode( PDOnode, "EventTimer" ))
	
	PDOobject.NumberOfEntries = 0
	PDOobject.EntryList = []
	for ( var bitPos = 0; bitPos < m_copsCfg.max_pdo_size && PDOobject.NumberOfEntries < m_copsCfg.max_entries; )
	{		
		var PDOentry = PDOnode.selectSingleNode( "PDO_entryList/PDO_entry[BitStart = '" + bitPos + "']" )
		if ( !PDOentry )
		{
			if ( bitPos == 0 )	//	se non c'è il primo oggetto
			{
				//	PDO disabilitato
				PDOobject.COBID = 0x80000000
			}
			return PDOobject
		}
		
		var objectIndex = parseInt(genfuncs.GetNode(PDOentry, "index"))
		var objectSubindex = parseInt(genfuncs.GetNode(PDOentry, "subindex"))
		var key = "0x" + objectIndex.toString(16) + "." + objectSubindex.toString()
		var obj = paramDBMap[key]
		
		//	calcola valore
		var bitSize = app.CallFunction("common.GetIECTypeBits", obj.type)
		if ( bitSize < m_copsCfg.granularity )
			bitSize = m_copsCfg.granularity	//	BOOL viene trattato come BYTE
		
		var entryValue = objectIndex * 0x10000 + objectSubindex * 0x100 + bitSize		//	[idx][idx][idx][idx][ si][ si][ bs][ bs]
		PDOobject.EntryList.push("0x" + entryValue.toString(16))
		
		bitPos = bitPos + bitSize
		
		PDOobject.NumberOfEntries++
	}
	
	return PDOobject
}
