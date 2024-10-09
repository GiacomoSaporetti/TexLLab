// questo file viene incluso dai moduli CANgeneric.js e CANcustom.js
// nel modulo CANgeneric definire:
// var IS_GENERIC_MODE = true
// var CAN_CONFIG_PATH = "CANgeneric_config"
// var CAN_MODULE = "CANgeneric"
// nel modulo CANcustom definire:
// var IS_GENERIC_MODE = false
// var CAN_CONFIG_PATH = "CANcustom_config"
// var CAN_MODULE = "CANcustom"

var gentypes = app.CallFunction("common.GetGeneralTypes")
var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var enuLogLevels = gentypes.enuLogLevels
var ParseBoolean = genfuncs.ParseBoolean
var GetNode = genfuncs.GetNode
var SetNode = genfuncs.SetNode

var COMPILATIONPHASE = app.CallFunction("compiler.GetCompilationPhase")

// costanti per logging
var LEV_OK = 0
var LEV_INFO = 1
var LEV_WARNING = 2
var LEV_ERROR = 3
var LEV_CRITICAL = 4

function Init(param)
{
	return 1
}

// ATTENZIONE in CANcommon.js e compiler.js
var TRANSMISSION_SYNC = 0
var TRANSMISSION_EVENT = 1
var TRANSMISSION_CYCLIC = 2

var TRANSMISSION_SYNC_VALUE = 1
var TRANSMISSION_EVENT_VALUE = 255

var IDX_IDENTITY = 0x1018
var IDX_PDOTX_MAPPING = 0x1A00
var IDX_PDORX_MAPPING = 0x1600
var SUBIDX_PDO_NUMOBJ = 0
var SUBIDX_PDO_MINOBJ = 1
var SUBIDX_PDO_MAXOBJ = 8
var IDX_PDOTX_PARAMS = 0x1800
var IDX_PDORX_PARAMS = 0x1400
var SUBIDX_PDO_COBID = 1
var SUBIDX_PDO_MODE = 2
var SUBIDX_PDO_TIMER = 5
var NUM_PDO_STANDARD = 4
var MAX_PDO = 512
var COBID_29BIT_FLAG = 1 << 29
var COBID_RTR_FLAG = 1 << 30
var COBID_DISABLED_FLAG = 1 << 31

// costanti per tipo pdo
var typePDORx = 0
var typePDOTx = 1

//	se viene messo true la generazione della configurazione dei PDO includerà anche l'SDO di disabilitazione del PDO
//	se viene messo false la generazione della configurazione dei PDO includerà l'SDO di disabilitazione del PDO solo se il default del PDO è $NODEID + 0x8xxxxxxx
var m_alwaysGenerateDisablePDO = false	//	default false

// mappa per ricerca veloce parametri
function CANParMap()
{
}

CANParMap.prototype.Set = function(idx, sub, value)
{
	this[ this.BuildIndex(idx, sub) ] = value
}

CANParMap.prototype.Get = function(idx, sub)
{
	return this[ this.BuildIndex(idx, sub) ]
}

CANParMap.prototype.BuildIndex = function(idx, sub)
{
	return idx.toString(16) + "." + sub.toString(16)
}

function IsDigitalObject(index, parMap)
{
	var obj = parMap["1000.0"]
	if (obj && obj.defaultValue && (obj.defaultValue & 0xFFFF) == 401)
		// ok dispositivo DS401, è digitale l'indice è 6000,6100,6200,6300
		return index == 0x6000 || index == 0x6100 || index == 0x6200 || index == 0x6300
	else
		// non è DS401
		return false
}

function GetCANcommonDeviceInfo(id)
{
	if ( IS_GENERIC_MODE )
		return GetCANgenericDeviceInfo(id)
	else
		return GetCANCustomDeviceInfo(id)
}

function GetPDOMapping(parMap, startIndex, numPDO, typePDO, granularity)
{
	var list = []
	var obj, bit
	
	// contatore numero di pdo trovati
	for (var i = 0, cnt = 0; i < MAX_PDO && cnt < numPDO; i++)
	{
		obj = parMap.Get(startIndex + i, 0)
		if (!obj) continue

		// incr contatore num pdo
		cnt++
		
		// lettura numero variabili contenute in questo pdo
		var numvars = parseInt(obj.defaultValue)
		var startbit = 0
		
		for (v = 0; v < numvars; v++)
		{
			obj = parMap.Get(startIndex + i, v + 1)
			if (obj && obj.defaultValue)
			{
				var value = parseInt(obj.defaultValue)
				
				// allinea alla granularità l'inizio dell'oggetto
				if (granularity > 1 && startbit % granularity != 0)
					startbit += granularity - (startbit % granularity)
					
				// estrazione oggetto mappato
				var item = {}
				item.typePDO = typePDO
				item.numPDO = i+1
				item.index = value >> 16 & 0xFFFF
				item.subindex = (value >> 8) & 0xFF
				item.size = value & 0xFF
				item.startbit = startbit
				
				// legge il nome dell'oggetto mappato nel pdo
				var mappedObj = parMap.Get(item.index, item.subindex)
				if (mappedObj)
				{
					item.name = mappedObj.name
					item.type = mappedObj.type
				}
				else
				{
					app.PrintMessage("(GetPDOMapping) Object " + parMap.BuildIndex(item.index, item.subindex) + " does not exist (mapped inside " + parMap.BuildIndex(startIndex + i, v + 1) + ")", LEV_ERROR)
					continue
				}
					
				if (IsDigitalObject(item.index, parMap))
					// oggetto io digitale: scompone nei bit singoli
					for (bit = 0; bit < item.size; bit++)
					{
						var itembit = { typePDO: item.typePDO, numPDO: item.numPDO, name: item.name,
										index: item.index, subindex: item.subindex, 
										size: 1, type: "boolean", startbit: startbit }
						list.push(itembit)
						startbit += 1
					}
				else
				{
					list.push(item)
					startbit += item.size
				}
			}
		}
	}
	
	return list
}

// valutazione di una espression EDS (l'unico valido è l'offset al nodeid)
function EvalCANExpr(expr, nodeid, dyncfg)
{
	if ( dyncfg )
	{
		//	in caso di configurazione dinamica ritorna esattamente $NODEID+xxx
		//	questo valore dovrà essere risolto a runtime dal master alla lettura della configurazione
		return expr 
	}
	
	expr = expr.replace(/\$NODEID/gi, nodeid)	
	try
	{
		return eval(expr)
	}
	catch(e)
	{
		return undefined	//	in modo che isNaN sia true per il chiamante
	}
}

function GetPDOVar(node)
{
	var result = {
		VarLabel: GetNode(node, "label"),
		BitStart: parseInt(GetNode(node, "ioObject/@PDOStartBit")),
		BitLength: parseInt(GetNode(node, "size")),
		objectIndex: parseInt(GetNode(node, "ioObject/@objectIndex")),
		objectSubIndex: parseInt(GetNode(node, "ioObject/@objectSubIndex")),
		dataBlock: GetNode(node, "dataBlock"),
		type: GetNode(node, "type"),
		node: node
	}
	return result
}

// lo standard definisce solo i primi 4 pdo

var PDORx_COBIDList = [0x180, 0x280, 0x380, 0x480, 0x680, 0x1C0, 0x2C0, 0x3C0, 0x4C0, 0x6C0, 0x1A0, 0x2A0, 0x3A0, 0x4A0, 0x6A0, 0x1E0, 0x2E0, 0x3E0, 0x4E0, 0x6E0]

function PDORx(device, num, nodeID, parMap, COBIDToUse, dyncfg)
{
	if ( COBIDToUse != undefined )
	{
		//	solo il CAN generic specifica questo parametro
		this.COBID = EvalCANExpr(COBIDToUse, nodeID, dyncfg)
	}
	else
	{
		// cerca se esiste l'oggetto contenente il cobid dei PDO nel dizionario, altrimenti tenta di usare i default
		var par = parMap.Get(0x1800 + num - 1, 1)
		if (par && par.defaultValue)
			this.COBID = EvalCANExpr(par.defaultValue, nodeID, dyncfg)
		else if (PDORx_COBIDList[num - 1] != undefined)
		{
			if ( dyncfg )
				this.COBID = "$NODEID+ " + PDORx_COBIDList[num - 1].toString()
			else
				this.COBID = PDORx_COBIDList[num - 1] | nodeID
		}
		else
		{
			app.PrintMessage("(PDORx) PDORx number " + num + ": can not determine COBID to use", LEV_ERROR)
			throw ""
		}
	}
	
	// se il bit del disabled è alto lo toglie (è già stato inserito l'oggetto apposito di abilitazione in SDO set)
	if (this.COBID & COBID_DISABLED_FLAG)
		this.COBID &= ~COBID_DISABLED_FLAG
		
	this.num = num
	this.size = 0
	this.numMappedVars = 0
	this.vars = []
}


// inserimento in una lista PDORx di una nuova variabile
function PDORxList_AddVar(device, parMap, nodeID, list, numPDO, newVar, COBIDstr, dyncfg )
{
	var PDO
	for (var i = 0; i < list.length; i++)
		if (list[i].num == numPDO)
		{
			PDO = list[i]
			break
		}
	
	if (PDO == undefined)
	{
		PDO = new PDORx(device, numPDO, nodeID, parMap, COBIDstr, dyncfg)
		list.push(PDO)
	}
	
	PDO.vars.push(newVar)
	
	// calcolo dimensione totale PDO
	if (newVar.BitStart + newVar.BitLength > PDO.size)
		PDO.size = newVar.BitStart + newVar.BitLength
		
	// calcolo numero di variabili realmente mappate
	if (newVar.VarLabel)
		PDO.numMappedVars++
	
	return PDO
}

// lo standard definisce solo i primi 4 pdo
var PDOTx_COBIDList = [0x200, 0x300, 0x400, 0x500, 0x780, 0x240, 0x340, 0x440, 0x540, 0x7C0, 0x220, 0x320, 0x420, 0x520, 0x7A0, 0x260, 0x360, 0x460, 0x560, 0x7E0]

// creazione oggetto PDOTx con settaggi default
function PDOTx(device, num, nodeID, parMap, COBIDToUse, dyncfg)
{
	if ( COBIDToUse != undefined )
	{
		//	solo il CAN generic specifica questo parametro
		this.COBID = EvalCANExpr(COBIDToUse, nodeID, dyncfg)
	}
	else
	{
		// cerca se esiste l'oggetto contenente il cobid dei PDO nel dizionario, altrimenti tenta di usare i default
		var par = parMap.Get(0x1400 + num - 1, 1)
		if (par && par.defaultValue)
			this.COBID = EvalCANExpr(par.defaultValue, nodeID, dyncfg)
		else if (PDOTx_COBIDList[num - 1] != undefined)
		{
			if ( dyncfg )
				this.COBID = "$NODEID+ " + PDOTx_COBIDList[num - 1].toString()
			else
				this.COBID = PDOTx_COBIDList[num - 1] | nodeID
		}
		else
		{
			app.PrintMessage("(PDOTx) PDOTx number " + num + ": can not determine COBID to use", LEV_ERROR)
			throw ""
		}
	}

	// se il bit del disabled è alto lo toglie (è già stato inserito l'oggetto apposito di abilitazione in SDO set)
	if (this.COBID & COBID_DISABLED_FLAG)
		this.COBID &= ~COBID_DISABLED_FLAG
		
	this.num = num
	this.size = 0
	this.numMappedVars = 0
	this.vars = []
}

// inserimento in una lista PDOTx di una nuova variabile
function PDOTxList_AddVar(device, parMap, nodeID, list, numPDO, newVar, COBIDstr, dyncfg)
{
	var PDO
	for (var i = 0; i < list.length; i++)
		if (list[i].num == numPDO)
		{
			PDO = list[i]
			break
		}
	
	if (PDO == undefined)
	{
		PDO = new PDOTx(device, numPDO, nodeID, parMap, COBIDstr, dyncfg)
		list.push(PDO)
	}
	
	PDO.vars.push(newVar)
	
	// calcolo dimensione totale PDO
	if (newVar.BitStart + newVar.BitLength > PDO.size)
		PDO.size = newVar.BitStart + newVar.BitLength
		
	// calcolo numero di variabili realmente mappate
	if (newVar.VarLabel)
		PDO.numMappedVars++
	
	return PDO
}


var PDOSIZE = 64    // dim in bit di un pdo

function PDOMappingSortFunc(a, b)
{
	if (a.numPDO != b.numPDO)
		return a.numPDO - b.numPDO
	else
		return a.bitstart - b.bitstart
}

function UpdatePDOMappingSortFunc(a, b)
{
	return a - b
}

function Validate(device, phase)
{
	// poichè vengono cercate variabili nella symtab tramite logiclab.FindSymbol, la compilazione deve già essere avvenuta, quindi fa i check in postbuild
	if (phase == COMPILATIONPHASE.POSTBUILD)
	{
		var enabled = GetNode(device, "@enabled")
		if (enabled !== null)
		{
			enabled = ParseBoolean(enabled)
		}
		else
			enabled = true
		
		if(!enabled)
		{
			return LEV_OK
		}
		
		var result = CheckPDOMappingList(device, CAN_CONFIG_PATH + "/PDOTxMappingList/PDOmapping", typePDOTx)
		if (result != LEV_OK) return result
		
		var result = CheckPDOMappingList(device, CAN_CONFIG_PATH + "/PDORxMappingList/PDOmapping", typePDORx)
		if (result != LEV_OK) return result
		
		var result = CheckSDOList(device, CAN_CONFIG_PATH + "/SDOsetList/SDOset", IS_GENERIC_MODE )
		if (result != LEV_OK) return result
		
		var result = CheckSDOScheduled(device, CAN_CONFIG_PATH + "/SDOscheduling/SDOscheduled", IS_GENERIC_MODE )
		if (result != LEV_OK) return result
	}
	
	return LEV_OK
}


// verifica lista oggetti SDO schedulati
function CheckSDOScheduled(device, query, skipParCheck)
{
	var list = device.selectNodes(query);
	if (!list || list.length == 0)
		return LEV_OK;

	var devinfo =  GetCANcommonDeviceInfo(device.nodeName)
	var parMap = devinfo.parMap
	
	var nodeID = parseInt(GetNode(device, CAN_CONFIG_PATH + "/nodeNumber"))
	
	var node
	while (node = list.nextNode())
	{		
		var label = GetNode(node, "label")
		var oneshot = GetNode(node, "oneshot")
		var idx = parseInt(GetNode(node, "ioObject/@objectIndex"))
		var subidx = parseInt(GetNode(node, "ioObject/@objectSubIndex"))
		
		if ( label == "" )
		{
			//	la variabile deve esistere
			var err = app.CallFunction("common.SplitFieldPath", node)
			var msg = "SDO 0x" + parseInt(idx).toString(16) + "." + parseInt(subidx).toString(16) + " scheduled command variable not specified"
			app.CallFunction("common.AddLog", LEV_WARNING, CAN_MODULE + ".Validate", msg, err)
			continue
		}
		
		// NB: sarebbe stato meglio lasciar fare questi controlli al chiamante (es. CANopen_cfg.js di LLExec)
		var plcvar;
		var isComplex = app.CallFunction("script.IsComplexVar", label)
		if (!isComplex)
			plcvar = app.CallFunction("logiclab.GetGlobalVariable", label);
		else
			plcvar = app.CallFunction("logiclab.FindSymbol", label, "");
		
		if ( !plcvar )
		{
			//	la variabile deve esistere
			var err = app.CallFunction("common.SplitFieldPath", node)
			var msg = "SDO 0x" + parseInt(idx).toString(16) + "." + parseInt(subidx).toString(16) + " scheduled command variable does not exists"
			return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", msg, err)
		}
		
		// ATTENZIONE, LA SECONDA FindSymbol DISTRUGGE LA PRIMA!!! QUINDI RECUPERO QUI LE INFO CHE MI SERVONO DA plcvar
		var varsize = app.CallFunction("common.GetIECTypeBits", plcvar.Type)
		
		if ( oneshot != "" )
		{
			// NB: sarebbe stato meglio lasciar fare questi controlli al chiamante (es. CANopen_cfg.js di LLExec)
			var oneshotvar;
			var isComplex = app.CallFunction("script.IsComplexVar", oneshot)
			if (!isComplex)
				oneshotvar = app.CallFunction("logiclab.GetGlobalVariable", oneshot);
			else
				oneshotvar = app.CallFunction("logiclab.FindSymbol", oneshot, "");

			if ( !oneshotvar )
			{
				//	la variabile, se specificata deve esistere
				var err = app.CallFunction("common.SplitFieldPath", node)
				var msg = "SDO 0x" + parseInt(idx).toString(16) + "." + parseInt(subidx).toString(16) + " scheduled command oneshot variable '"+oneshot+"' does not exists"
				return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", msg, err)
			}
			else if ( oneshotvar.Type != "BOOL" )
			{
				//	la variabile, se specificata deve esistere
				var err = app.CallFunction("common.SplitFieldPath", node)
				var msg = "SDO 0x" + parseInt(idx).toString(16) + "." + parseInt(subidx).toString(16) + " scheduled command oneshot variable '"+oneshot+"' must be BOOL"
				return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", msg, err)
			}
		}
		
		//	in modalità generica non ci devono essere riferimenti alla mappa parametri
		if ( skipParCheck )
			continue
		
		var size = app.CallFunction("common.GetIECTypeBits", GetNode(node, "ioObject/@objtype"))
		
		// verifica corrispondenza dimensione con variabile
		if (varsize != size)
		{
			var err = app.CallFunction("common.SplitFieldPath", node)
			var msg = app.Translate("Field variable '%1' has wrong size (%2, must be %3 bits)").replace("%1", label).replace("%2", varsize).replace("%3", size)
			return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", msg, err)
		}
		
		var obj = parMap.Get(idx, subidx)
		if (!obj)
		{
			// oggetto non trovato (non dovrebbe mai accadere...)
			var err = app.CallFunction("common.SplitFieldPath", node)
			return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", "Invalid CAN object", err)
		}
	}
	return LEV_OK
}

// verifica lista oggetti SDO
function CheckSDOList(device, query, skipParCheck)
{
	var devinfo =  GetCANcommonDeviceInfo(device.nodeName)
	var parMap = devinfo.parMap
	
	var dyncfgNodeNumber = ParseBoolean(GetNode(device, CAN_CONFIG_PATH + "/dyncfgNodeNumber"))
	if ( dyncfgNodeNumber )
		var nodeID = 1	//	esegue la validazione con il valore 1 per effettuare le sostituzione
	else
		var nodeID = parseInt(GetNode(device, CAN_CONFIG_PATH + "/nodeNumber"))
	
	var list = device.selectNodes(query)
	var node
	while (node = list.nextNode())
	{
		// valore con eventuali simboli $NODEID sostituiti
		var value = EvalCANExpr(GetNode(node, "value"), nodeID)
		
		var idx = parseInt(GetNode(node, "index"))
		var subidx = parseInt(GetNode(node, "subindex"))
		var type = GetNode(node, "type")
		
		// controllo particolare per COBID
		if ((idx >= IDX_PDORX_PARAMS && idx < IDX_PDORX_PARAMS + MAX_PDO ||
			 idx >= IDX_PDOTX_PARAMS && idx < IDX_PDOTX_PARAMS + MAX_PDO ) &&
			subidx == SUBIDX_PDO_COBID && value == 0)
		{
			var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("value"))
			return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", "SDO Set: COBID value can not be zero", err)
		}
		
		if (isNaN(value))
		{
			var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("value"))
			return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", "'" + idx.toString(16) + "." + subidx + "' : invalid Value", err)
		}
		
		//	in modalità generica non ci devono essere riferimenti alla mappa parametri
		if ( skipParCheck )
			continue
		
		var obj = parMap.Get(idx, subidx)
		if (!obj)
		{
			// oggetto non trovato (non dovrebbe mai accadere...)
			var err = app.CallFunction("common.SplitFieldPath", node)
			return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", "Invalid CAN object", err)
		}
		
		// estrazione limiti (espliciti o impliciti)
		var limits = app.CallFunction("common.GetIECTypeLimits", type)
		
		var min, max
		if (obj.min != null)
			min = obj.min
		else if (limits)
			min = limits.min
		
		if (obj.max != null)
			max = obj.max
		else if (limits)
			max = limits.max
		
		if (min != undefined && value < min || max != undefined && value > max)
		{
			// valore dell'oggetto out of range
			var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("value"))
			return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", "'" + obj.name + "' : Value out of range (min: " + min + ", max: " + max + ")", err)
		}
	}
	return LEV_OK
}

function CheckPDOMappingList(device, query, typePDO)
{
	var lastNumPDO = 0
	var pos = 0

	// mappa oggetti per verifica validità PDO
	var devinfo = GetCANcommonDeviceInfo( device.nodeName )
	var parMap = devinfo.parMap
	
	// estrae tutti i pdo mapping e li ordina per numPDO / bitstart
	// in questo modo se le voci in griglia non sono consecutive i controlli sono cmq corretti
	var sortedlist = []
	var list = device.selectNodes(query)
	var node
	var prevIndex, prevSubindex
	while (node = list.nextNode())
	{
		var item = {}
		item.label = GetNode(node, "label")
		item.numPDO = parseInt(GetNode(node, "ioObject/@PDONumber"))
		item.bitstart = parseInt(GetNode(node, "ioObject/@PDOStartBit"))
		item.size = app.CallFunction("common.GetIECTypeBits", GetNode(node, "ioObject/@objtype"))
		item.varsize = app.CallFunction("common.GetIECTypeBits", GetNode(node, "type"))
		item.index = parseInt(GetNode(node, "ioObject/@objectIndex"))
		item.subindex = parseInt(GetNode(node, "ioObject/@objectSubIndex"))
		item.node = node
		
		if (item.index == prevIndex && item.subindex == prevSubindex && item.size == 1)
			// se la riga attuale ha lo stesso index e subindex del precedente ed è un bool significa che un bit splittato (ma non il primo)
			// di conseguenza non bisogna verificare il suo allineamento alla granularity
			item.notAligned = true
		
		sortedlist.push(item)
		prevIndex = item.index
		prevSubindex = item.subindex
	}
	sortedlist.sort(PDOMappingSortFunc)
	
	for (var i = 0; i < sortedlist.length; i++)
	{
		var item = sortedlist[i]
		
		// se non siamo su un BOOL splittato e l'inizio non è allineato alla granularità errore
		if (devinfo.granularity > 1 && (item.bitstart % devinfo.granularity != 0) && !item.notAligned)
		{
			var err = app.CallFunction("common.SplitFieldPath", item.node)
			var msg = app.Translate("Wrong start bit, must be aligned to granularity: %1 bits").replace("%1", devinfo.granularity)
			return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", msg, err)
		}
		
		if (item.numPDO != lastNumPDO)
		{
			if (item.bitstart != 0)
			{
				// al cambio di pdo il bit deve essere 0 (all'inizio)
				var err = app.CallFunction("common.SplitFieldPath", item.node)
				var msg = app.Translate("First mapped object must start at bit 0")  //translate
				return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", msg, err)
			}
		}
		else
		{
			if (item.bitstart < pos)
			{
				// la var attuale si sovrappone alla precedente
				var err = app.CallFunction("common.SplitFieldPath", item.node)
				var msg = app.Translate("Mapped object overlaps with its previous one")  //translate
				return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", msg, err)
			}
// !!! controllo sulla consecutività per ora rimosso, per permettere di lasciare volontariamente buchi nel mapping
/*			else if (item.bitstart > pos)
			{
				// la var attuale ha un buco prima della precedente
				var err = app.CallFunction("common.SplitFieldPath", item.node)
				var msg = app.Translate("Mapped object does not follow its previous one")  //translate
				return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", msg, err)
			}*/
		}
		
		if (item.bitstart + item.size > PDOSIZE)
		{
			// la var attuale sfora la dimensione del pdo
			var err = app.CallFunction("common.SplitFieldPath", item.node)
			var msg = app.Translate("PDO size exceeds its maximum (64 bits)")  //translate
			return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", msg, err)
		}
		
		// verifica corrispondenza dimensione con variabile
		if (item.label && item.varsize != item.size)
		{
			var err = app.CallFunction("common.SplitFieldPath", item.node)
			var msg = app.Translate("Field variable has wrong size (%1, must be %2 bits)").replace("%1", item.varsize).replace("%2", item.size)
			return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", msg, err)
		}
		
		// se siamo in generic mode non dobbiamo fare controlli sull'esistenza del parametro
		if (!IS_GENERIC_MODE)
		{
			var idx = (typePDO == typePDOTx) ? IDX_PDOTX_PARAMS : IDX_PDORX_PARAMS
			
			// verifica validità PDO, l'oggetto 180x.2 (Tx) / 140x.2 (Rx) deve esistere
			if (!parMap.Get(idx + item.numPDO - 1, SUBIDX_PDO_MODE))
			{
				var err = app.CallFunction("common.SplitFieldPath", item.node)
				return app.CallFunction("common.AddLog", LEV_CRITICAL, CAN_MODULE + ".Validate", "Invalid PDO Number, does not exist in object dictionary: " + item.numPDO, err)
			}
		}
		
		pos = item.bitstart + item.size
		lastNumPDO = item.numPDO
	}
	
	return LEV_OK
}

function AddToSDOsetList(datapath, parMap, index, subindex, label, type, value, duplicateIfExists )
{
	datapath += CAN_CONFIG_PATH + "/SDOsetList"
	
	var nodelist = app.SelectNodesXML(datapath + "/SDOset[index = " + index + " and subindex = " + subindex + "]")
	if (!nodelist || nodelist.length == 0 || duplicateIfExists)
	{
		if (parMap == undefined || (parMap != undefined && parMap.Get(index, subindex)))
		{
			// l'oggetto esiste nella mappa ma non nella setlist, lo crea
			var newpath = app.AddTemplateData("SDOset", datapath, 0, false)
			app.DataSet(newpath + "/label", 0, label)
			app.DataSet(newpath + "/index", 0, index)
			app.DataSet(newpath + "/subindex", 0, subindex)
			app.DataSet(newpath + "/type", 0, type)
			app.DataSet(newpath + "/value", 0, value)
		}
	}
	else
		// già presente, aggiorna solo il valore
		nodelist[0].selectSingleNode("value").text = value
}

function DeleteFromSDOsetList(datapath, index, subindex)
{
	datapath += CAN_CONFIG_PATH + "/SDOsetList"
	
	if ( subindex != undefined )
		var nodelist = app.SelectNodesXML(datapath + "/SDOset[index = " + index + " and subindex = " + subindex + "]")
	else
		var nodelist = app.SelectNodesXML(datapath + "/SDOset[index = " + index + "]")
		
	if (nodelist && nodelist.length != 0)
	{
		var length = nodelist.length
		for ( var i = 0; i < length; i++ )
		{
			var parent = nodelist[i].parentNode
			parent.removeChild(nodelist[i])
		}
	}
}


function UpdatePDOTxTransmission(device, Transmission, CyclicTime)
{
	// ricava la modalità di trasmissione per i PDOTx attuali se non passato come argomento
	if (Transmission == undefined)
		Transmission = parseInt(GetNode(device, CAN_CONFIG_PATH + "/PDOTxTransmission", -1))

	if (Transmission != TRANSMISSION_SYNC && Transmission != TRANSMISSION_EVENT && Transmission != TRANSMISSION_CYCLIC)
		return
	
	// tempo di ciclo per la modalità CYCLIC, lo legge da xml se non passato
	if (CyclicTime == undefined)
		CyclicTime = parseInt(GetNode(device, CAN_CONFIG_PATH + "/PDOTxCyclicTime", 0))
	
	var PDOTxMappingList = device.selectSingleNode(CAN_CONFIG_PATH + "/PDOTxMappingList")
	var devinfo = GetCANcommonDeviceInfo(device.nodeName)
	var parMap = devinfo.parMap
	var datapath = app.GetDataPathFromNode(device) + "/"
	var numPDOTx = GetNumPDOTx( device )
	
	for (var i = 0, cnt = 0; i < MAX_PDO && cnt < numPDOTx; i++)
	{
		var obj
		
		if ( !IS_GENERIC_MODE )
		{
			obj = parMap.Get(IDX_PDOTX_PARAMS + i, SUBIDX_PDO_MODE)
			if (!obj) continue
		}
		
		// verifica se il pdo corrente è inserito nel mapping
		var node = PDOTxMappingList.selectSingleNode("PDOmapping[ioObject/@PDONumber = " + (i+1) + "]")
		if (node)
		{
			if (IS_GENERIC_MODE)
			{
				// il pdo è mappato, valorizza transmission type
				var value = (Transmission == TRANSMISSION_SYNC) ? devinfo.transmissionSyncValue : devinfo.transmissionEventValue
				AddToSDOsetList(datapath, undefined, IDX_PDOTX_PARAMS + i, SUBIDX_PDO_MODE, "Transmission Type", "USINT", value)
				
				if (Transmission == TRANSMISSION_SYNC)
					// in sync rimuove l'oggetto 5
					DeleteFromSDOsetList(datapath, IDX_PDOTX_PARAMS + i, SUBIDX_PDO_TIMER)
				else
				{
					// in event o ciclico lo valorizza
					var value = (Transmission == TRANSMISSION_EVENT) ? 0 : CyclicTime
					AddToSDOsetList(datapath, undefined, IDX_PDOTX_PARAMS + i, SUBIDX_PDO_TIMER, "Event Timer", "UINT", value)
				}
			}
			else
			{
				if (!obj.readOnly)
				{
					// il pdo è mappato, valorizza transmission type
					var value = (Transmission == TRANSMISSION_SYNC) ? devinfo.transmissionSyncValue : devinfo.transmissionEventValue
					AddToSDOsetList(datapath, parMap, IDX_PDOTX_PARAMS + i, SUBIDX_PDO_MODE, "Transmission Type", "USINT", value)
				}
				
				// se esiste il subindex 5 per il timer lo cancella o valorizza
				obj = parMap.Get(IDX_PDOTX_PARAMS + i, SUBIDX_PDO_TIMER)
				if (obj && !obj.readOnly)
					if (Transmission == TRANSMISSION_SYNC)
						// in sync rimuove l'oggetto 5
						DeleteFromSDOsetList(datapath, IDX_PDOTX_PARAMS + i, SUBIDX_PDO_TIMER)
					else
					{
						// in event o ciclico lo valorizza
						var value = (Transmission == TRANSMISSION_EVENT) ? 0 : CyclicTime
						AddToSDOsetList(datapath, parMap, IDX_PDOTX_PARAMS + i, SUBIDX_PDO_TIMER, "Event Timer", "UINT", value)
					}
			}
		}
		else
		{
			// il pdo non è mappato, elimina eventuali oggetti nella setlist
			DeleteFromSDOsetList(datapath, IDX_PDOTX_PARAMS + i, SUBIDX_PDO_MODE)
			DeleteFromSDOsetList(datapath, IDX_PDOTX_PARAMS + i, SUBIDX_PDO_TIMER)
		}
		cnt++
	}
}

function UpdatePDORxTransmission(device, Transmission)
{
	// ricava la modalità di trasmissione per i PDORx attuali se non passato come argomento
	if (Transmission == undefined)
		Transmission = parseInt(GetNode(device, CAN_CONFIG_PATH + "/PDORxTransmission", -1))
	
	if (Transmission != TRANSMISSION_SYNC && Transmission != TRANSMISSION_EVENT)
		return
	
	var PDORxMappingList = device.selectSingleNode(CAN_CONFIG_PATH + "/PDORxMappingList")
	var devinfo = GetCANcommonDeviceInfo(device.nodeName)
	var parMap = devinfo.parMap
	var datapath = app.GetDataPathFromNode(device) + "/"
	var numPDORx = GetNumPDORx( device )
	
	for (var i = 0, cnt = 0; i < MAX_PDO && cnt < numPDORx; i++)
	{
		var obj
		
		if ( !IS_GENERIC_MODE )
		{
			obj = parMap.Get(IDX_PDORX_PARAMS + i, SUBIDX_PDO_MODE)
			if (!obj) continue
		}
		
		// verifica se il pdo corrente è inserito nel mapping
		var node = PDORxMappingList.selectSingleNode("PDOmapping[ioObject/@PDONumber = " + (i+1) + "]")
		if (node)
		{
			if (IS_GENERIC_MODE)
			{
				// il pdo è mappato, valorizza transmission type
				var value = (Transmission == TRANSMISSION_SYNC) ? devinfo.transmissionSyncValue : devinfo.transmissionEventValue
				AddToSDOsetList(datapath, undefined, IDX_PDORX_PARAMS + i, SUBIDX_PDO_MODE, "Transmission Type", "USINT", value)
			}
			else
			{
				if (!obj.readOnly)
				{
					// il pdo è mappato, valorizza transmission type
					var value = (Transmission == TRANSMISSION_SYNC) ? devinfo.transmissionSyncValue : devinfo.transmissionEventValue
					AddToSDOsetList(datapath, parMap, IDX_PDORX_PARAMS + i, SUBIDX_PDO_MODE, "Transmission Type", "USINT", value)
				}
			}
		}
		else
			// il pdo non è mappato, elimina eventuali oggetti nella setlist
			DeleteFromSDOsetList(datapath, IDX_PDORX_PARAMS + i, SUBIDX_PDO_MODE)
			
		cnt++
	}
}


// ESPORTAZIONE FILE EDS
var EDS = app.CallFunction("EDS.GetEDSEnums")
var m_ParToEDSType =  { "boolean": EDS.DATATYPE.BOOLEAN, "char": EDS.DATATYPE.INTEGER8, "short": EDS.DATATYPE.INTEGER16, "int": EDS.DATATYPE.INTEGER32, 
					"unsignedChar": EDS.DATATYPE.UNSIGNED8, "unsignedShort": EDS.DATATYPE.UNSIGNED16, "unsignedInt": EDS.DATATYPE.UNSIGNED32, 
					"float": EDS.DATATYPE.REAL32, "string": EDS.DATATYPE.VISIBLE_STRING }

function GetAccessType(par)
{
	if (par.AccessType)
		return par.AccessType
	else if (par.readOnly)
		return "ro"
	else
		return "rw"
}

function GetEDSItemFromPar(par, idxOffset)
{
	if (idxOffset === undefined)
		idxOffset = 0
	
	var item = {}
	item.ParameterName = par.name
	item.Index = par.commIndex + idxOffset
	item.ObjectType = EDS.OBJTYPE.VAR
	item.AccessType = GetAccessType(par)
	item.DataType = m_ParToEDSType[par.type]
	item.DefaultValue = par.defaultValue
	item.LowLimit = par.min
	item.HighLimit = par.max
	item.PDOMapping = par.PDOMapping
	return item
}

function GetEDSInfo(deviceName)
{
	if (typeof deviceName == "object")
		// accetta per retrocompatibilità anche il nodo xml
		deviceName = deviceName.name;
		
	var info = GetCANcommonDeviceInfo(deviceName)
	
	// tutti i dati dell'header sono incompleti, devono essere valorizzati manualmente!
	var result = {
		FileVersion: 1,
		FileRevision: 1,
		EDSVersion: "4.0",
		Description: "EDS files for ???",
		CreationDateTime: new Date(2011, 3, 3, 17, 44, 1),
		CreatedBy: "???",

		VendorName: "???",
		VendorNumber: 0,
		ProductName: "???",
		ProductNumber: 0,
		RevisionNumber: 0,
		OrderCode: "???????????",
		BaudRate_10: false,
		BaudRate_20: true,
		BaudRate_50: true,
		BaudRate_125: true,
		BaudRate_250: true,
		BaudRate_500: true,
		BaudRate_800: true,
		BaudRate_1000: true,
		SimpleBootUpMaster: false,
		SimpleBootUpSlave: true,
		Granularity: info.granularity,
		DynamicChannelsSupported: 0,
		CompactPDO: 0,
		GroupMessaging: false,
		NrOfRXPDO: info.numPDORx,
		NrOfTXPDO: info.numPDOTx,
		LSS_Supported: false,
		
		Dummy: [0,0,0,0,0,0,0],
		
		Comments: [
			"???",
			"???"
		]
	}
	
	result.MandatoryObjects = []
	result.OptionalObjects = []
	result.ManufacturerObjects = []
	

	for (var i = 0; i < info.parList.length; i++)
	{
		var par = info.parList[i]
		
		// genera item come se fosse variabile semplice
		var item = GetEDSItemFromPar(par)
		
		// determina lista di appartenenza (i range sono presi dalla specifica EDS)
		if (item.Index == 0x1000 || item.Index == 0x1001 || item.Index == 0x1018)
			var list = result.MandatoryObjects
		else if (item.Index >= 0x1000 && item.Index <= 0x1FFF || item.Index >= 0x6000 && item.Index <= 0xFFFF)
			var list = result.OptionalObjects
		else if (item.Index >= 0x2000 && item.Index <= 0x5FFF)
			var list = result.ManufacturerObjects
		
		// verifica se sub 0 di un oggetto quindi complesso
		if (par.description && par.description.slice(-4) == "sub0")
		{
			// per i subobjects Index è il sottoindice
			item.Index = 0
			
			// genera elemento principale RECORD
			var mainItem = {}
			mainItem.ParameterName = par.name
			mainItem.Index = par.commIndex
			mainItem.ObjectType = EDS.OBJTYPE.RECORD
			mainItem.SubObjects = [ item ]
			list.push(mainItem)
			
			// aggiunge tutti i sub objects
			for (var n = 1; n <= 255; n++)
			{
				var parSub = info.parMap.Get(par.commIndex, n)
				if (parSub)
				{
					var item = GetEDSItemFromPar(parSub)
					// per i subobjects Index è il sottoindice
					item.Index = n
					mainItem.SubObjects.push(item)
				}
			}
		}
		else if (par.description && par.description.slice(-4, -1) == "sub")
			// altro oggetto subN, lo scarta in quanto deve essere già stato processato dal rispettivo sub0
			continue
		else
			// aggiunge, altro oggetto semplice
			list.push(item)
	}
	
	
	return result
}

function GetNumPDOTx( device )
{
	var numPDO
	if ( IS_GENERIC_MODE )
	{
		numPDO = MAX_PDO
	}
	else
	{
		devinfo = GetCANcommonDeviceInfo(device.nodeName)
		numPDO = devinfo.numPDOTx
	}
	
	return numPDO
}

function GetNumPDORx( device )
{
	var numPDO
	if ( IS_GENERIC_MODE )
	{
		numPDO = MAX_PDO
	}
	else
	{
		devinfo = GetCANcommonDeviceInfo(device.nodeName)
		numPDO = devinfo.numPDORx
	}
	
	return numPDO
}

// se esiste già un pdo ottiene il valore del cobid, altrimenti lo calcola
function AssignCOBIDString( pdonum, tx )
{
	if ( pdonum > 0 && pdonum <= NUM_PDO_STANDARD ) 
		if ( tx )
			return "$NODEID+ 0x" + ( 128 + 256 * pdonum ).toString( 16 )	//	lo mette nella forma "$NODEID+ 0x180"
		else
			return "$NODEID+ 0x" + ( 256 + 256 * pdonum ).toString( 16 )	//	lo mette nella forma "$NODEID+ 0x200"
	else
		return "0x80000000"	//	disabilitato
}

// genera sdo set per configurazione pdo
function UpdatePDOMapping(device, mode)
{
	var PDOAutoMapping = ParseBoolean( device.selectSingleNode(CAN_CONFIG_PATH + "/PDOAutoMapping").text )
	if ( PDOAutoMapping )
	{
		var devinfo = GetCANcommonDeviceInfo(device.nodeName)
		var parMap = devinfo.parMap
		var datapath = app.GetDataPathFromNode(device) + "/"

		if ( mode == "tx" )
		{
			var PDOMappingList = device.selectSingleNode(CAN_CONFIG_PATH + "/PDOTxMappingList")
			var IDX_PDO_PARAMS = IDX_PDOTX_PARAMS
			var IDX_PDO_MAPPING = IDX_PDOTX_MAPPING
			var numPDO = GetNumPDOTx( device )
		}
		else	//	rx
		{
			var PDOMappingList = device.selectSingleNode(CAN_CONFIG_PATH + "/PDORxMappingList")
			var IDX_PDO_PARAMS = IDX_PDORX_PARAMS
			var IDX_PDO_MAPPING = IDX_PDORX_MAPPING
			var numPDO = GetNumPDORx( device )
		}
		
		for (var idpdo = 0, cnt = 0; idpdo < MAX_PDO; idpdo++)
		{
			// se esiste la possibilità di configurare automaticamente questo pdo elimino tutta la configurazione esistente per questo PDO
			// se non lo facessi continuerei a creare duplicati
			DeleteFromSDOsetList(datapath, IDX_PDO_PARAMS + idpdo, SUBIDX_PDO_COBID)	//	elimino i settaggi relativi al COBID
			DeleteFromSDOsetList(datapath, IDX_PDO_MAPPING + idpdo )					//	elimino il settaggio relativo al numero di oggetti mappati
			
			// non aggiungo niente se ho raggiunto il numero max di pdo configurabili
			if ( cnt >= numPDO )
				continue
			
			//	in modalità CANgeneric non faccio logiche di disabilitazione ma soltanto di abilitazione e configurazione dei pdo in TX e RX
			if ( IS_GENERIC_MODE )
			{
				var objCOBID = {}
				var objNumObjects = {}
				
				// verifica se esiste almento una mappatura per il pdo corrente
				var nodeList = PDOMappingList.selectNodes("PDOmapping[ioObject/@PDONumber = " + (idpdo+1) + "]")
				var node
				if (nodeList.length > 0)
				{
					// creo i due parametri da configurare per disabilitare / abilitare il pdo in modo che superino i controlli
					objCOBID.name = "COB-ID"
					objCOBID.readOnly = false
					
					node = nodeList.nextNode()
					var COBIDstr = node.getAttribute( "COBIDstr" )
					if ( COBIDstr != undefined )
						objCOBID.defaultValue = COBIDstr
					else
					{
						objCOBID.defaultValue = AssignCOBIDString( idpdo + 1, (mode == "tx") )
						
						msg = app.Translate( "WARNING: Unable to get COBID for PDO " + ( idpdo + 1 ) + ". Object " + obj + "." + subobj + " COBID will be set as default" )
						app.CallFunction("common.AddLog", LEV_ERROR, CAN_MODULE + ".UpdatePDOMapping", msg)
					}
				
					objNumObjects.name = "Number of entries PDO " + ( idpdo + 1 ) + " " + mode
					objNumObjects.readOnly = false
				}
				else
				{
					//	passo al pdo successivo
					continue
				}
			}
			else
			{
				// ricavo i due parametri da configurare per disabilitare / abilitare il pdo
				var objCOBID = parMap.Get(IDX_PDO_PARAMS + idpdo, SUBIDX_PDO_COBID)
				var objNumObjects = parMap.Get(IDX_PDO_MAPPING + idpdo, SUBIDX_PDO_NUMOBJ)
			}
			
			if ( objCOBID != undefined && !objCOBID.readOnly && objCOBID.defaultValue && ( m_alwaysGenerateDisablePDO || IsDisabledCOBID(objCOBID.defaultValue) ) )
			{
				//	genera l'SDO di disabilitazione
				var value = GetDisabledCOBID(objCOBID.defaultValue)
				AddToSDOsetList(datapath, ( IS_GENERIC_MODE ? undefined : parMap ), IDX_PDO_PARAMS + idpdo, SUBIDX_PDO_COBID, objCOBID.name, "UDINT", value, true )
			}
			else if ( idpdo >= NUM_PDO_STANDARD && !IS_GENERIC_MODE )	//	non metto warning se il numero del pdo è minore dei pdo standard, se no deve essere possibile disabilitare i pdo
			{
				var obj = (IDX_PDO_PARAMS + idpdo).toString( 16 )
				var subobj = SUBIDX_PDO_COBID.toString( 16 )
				var msg
				if ( objCOBID == undefined )
					msg = app.Translate( "WARNING: Cannot disable PDO. Object " + obj + "." + subobj + " does not exists" )
				else if ( objCOBID.readOnly )
					msg = app.Translate( "WARNING: Cannot disable PDO. Object " + obj + "." + subobj + " is read only" )
				else
					msg = app.Translate( "WARNING: Cannot disable PDO. Object " + obj + "." + subobj + " cannot be set as invalid" )
				
				app.CallFunction("common.AddLog", LEV_WARNING, CAN_MODULE + ".UpdatePDOMapping", msg)
			}
			
			if ( objNumObjects != undefined && !objNumObjects.readOnly )
			{
				//	il numero di entries deve essere posto a zero
				AddToSDOsetList(datapath, ( IS_GENERIC_MODE ? undefined : parMap ), IDX_PDO_MAPPING + idpdo, SUBIDX_PDO_NUMOBJ, objNumObjects.name, "USINT", 0x00, true )
			}
			else if ( !IS_GENERIC_MODE )
			{
				var msg
				var obj = (IDX_PDO_MAPPING + idpdo).toString( 16 )
				var subobj = SUBIDX_PDO_NUMOBJ.toString( 16 )
				if ( objNumObjects == undefined )
					msg = app.Translate( "ERROR: Cannot disable PDO. Object " + obj + "." + subobj + " does not exists" )
				else if ( objNumObjects.readOnly )
					msg = app.Translate( "ERROR: Cannot disable PDO. Object " + obj + "." + subobj + " is read only" )
				else
					msg = app.Translate( "ERROR: Cannot disable PDO. Object " + obj + "." + subobj )
				
				app.CallFunction("common.AddLog", LEV_ERROR, CAN_MODULE + ".UpdatePDOMapping", msg)
			}
			
			// inserisco gli oggetti da mappare se sono specificati
			var mappedObjects = 0
			var lastItem

			// ottengo una lista ordinata dei bit del pdo corrente
			var PDOBitNodeList = PDOMappingList.selectNodes("PDOmapping/ioObject[@PDONumber = " + (idpdo+1) + "]")
			var PDOBitNode
			var PDOBitList = []
			while ( PDOBitNode = PDOBitNodeList.nextNode() )
			{
				var PDOStartBit = PDOBitNode.getAttribute( "PDOStartBit" )
				PDOBitList.push( parseInt( PDOStartBit ) )
			}
			
			PDOBitList.sort(UpdatePDOMappingSortFunc)
			
			//	provo bit per bit per avere le entries ordinate secondo quanto specificato
			for (var PDOBitListIndex = 0; PDOBitListIndex <  PDOBitList.length; PDOBitListIndex++ )
			{
				var bitindex = PDOBitList[ PDOBitListIndex ]
				
				// verifica se esiste almento una mappatura per il pdo corrente
				var nodeList = PDOMappingList.selectNodes("PDOmapping[ioObject/@PDONumber = " + (idpdo+1) + " and ioObject/@PDOStartBit = " + bitindex + "]")
				var node
				if (nodeList.length > 0)
				{
					while ( node = nodeList.nextNode() )
					{
						var nodeSize = node.selectSingleNode( "size" )
						var nodeIoObject = node.selectSingleNode( "ioObject" )
						var item = {}
						
						item.objIndex = nodeIoObject.getAttribute( "objectIndex" )
						item.objSubIndex = nodeIoObject.getAttribute( "objectSubIndex" )
						item.objType = nodeIoObject.getAttribute( "objtype" )
						
						//	ho già aggiunto l'sdo di configurazione per gli splitted bits?
						if ( lastItem != undefined &&
							 item.objIndex == lastItem.objIndex &&
							 item.objSubIndex == lastItem.objSubIndex &&
							 item.objType == lastItem.objType &&
							 splittedBits )
						{
							bitindex++
							continue
						}
						
						//	siamo nel caso di splitted bits?
						if ( item.objType == "BOOL" )
						{
							var splittedList = PDOMappingList.selectNodes("PDOmapping[ioObject/@PDONumber = " + (idpdo+1) + " and ioObject/@objectIndex = " + item.objIndex + " and ioObject/@objectSubIndex = " + item.objSubIndex + "]")
							item.size = splittedList.length
							splittedBits = splittedList.length > 1
						}
						else
						{
							item.size = parseInt( nodeSize.text, 10 )
							splittedBits = false
						}
						
						//	compongo il valore da settare 0x[16bit index][8bit subindex][8bit size]
						var value = 0
						value = parseInt( item.objIndex, 10 ) & 0xFFFF
						value = value << 8
						value |= ( parseInt( item.objSubIndex, 10 ) & 0xFF )
						value = value << 8
						value |= ( item.size & 0xFF )
						if ( value < 0 ) value = 4294967296 + value		// segno sempre positivo
						value = value.toString( 16 )
						for ( var s = value.length; s < 8; s++ ) value = "0" + value	// zero padding
						item.value = "0x" + value
						
						//	aggiungo l'oggetto mappato
						mappedObjects++
						if ( IS_GENERIC_MODE )
						{
							var objEntry = {}
							objEntry.name = "Mapped object " + mappedObjects
							objEntry.readOnly = false
						}
						else
						{
							var objEntry = parMap.Get(IDX_PDO_MAPPING + idpdo, mappedObjects)
						}
						
						if ( objEntry && !objEntry.readOnly )
						{
							//	aggiungo la mappatura
							AddToSDOsetList(datapath, ( IS_GENERIC_MODE ? undefined : parMap ), IDX_PDO_MAPPING + idpdo, mappedObjects, objEntry.name, "UDINT", item.value, false )
						}
						else
						{
							var msg
							var obj = (IDX_PDO_MAPPING + idpdo); obj = obj.toString( 16 )
							var subobj = mappedObjects.toString( 16 )
							if ( objEntry == undefined )
								msg = app.Translate( "ERROR: Cannot add PDO mapping entry. Object " + obj + "." + subobj + " does not exists" )
							else if ( objEntry.readOnly )
								msg = app.Translate( "ERROR: Cannot add PDO mapping entry. Object " + obj + "." + subobj + " is read only" )
							else
								msg = app.Translate( "ERROR: Cannot add PDO mapping entry. Object " + obj + "." + subobj )
							
							app.CallFunction("common.AddLog", LEV_ERROR, CAN_MODULE + ".UpdatePDOMapping", msg)
						}
						
						//	salvo l'ultimo oggetto mappato
						lastItem = item

						//	passo al successivo
						bitindex = bitindex + item.size
					}
				}
				else
				{
					bitindex++
				}
			}
			
			// confermo la mappatura e abilito il pdo se ho mappato degli oggetti
			if ( mappedObjects > 0 )
			{
				if ( objNumObjects != undefined && !objNumObjects.readOnly )
				{
					//	il numero di entries deve essere settato
					AddToSDOsetList(datapath, ( IS_GENERIC_MODE ? undefined : parMap ), IDX_PDO_MAPPING + idpdo, SUBIDX_PDO_NUMOBJ, objNumObjects.name, "USINT", mappedObjects, true )
				}
				else
				{
					var msg
					var obj = (IDX_PDO_MAPPING + idpdo); obj = obj.toString( 16 )
					var subobj = SUBIDX_PDO_NUMOBJ; subobj = subobj.toString( 16 )
					if ( objNumObjects == undefined )
						msg = app.Translate( "ERROR: Cannot set PDO mapping entries, Object " + obj + "." + subobj + " does not exists" )
					else if ( objNumObjects.readOnly )
						msg = app.Translate( "ERROR: Cannot set PDO mapping entries. Object " + obj + "." + subobj + " is read only" )
					else
						msg = app.Translate( "ERROR: Cannot set PDO mapping entries. Object " + obj + "." + subobj )
					
					app.CallFunction("common.AddLog", LEV_ERROR, CAN_MODULE + ".UpdatePDOMapping", msg)
				}
				
				if ( objCOBID != undefined && !objCOBID.readOnly && objCOBID.defaultValue )
				{
					// il pdo è mappato, genera l'SDO di abilitazione
					var value = GetEnabledCOBID(objCOBID.defaultValue)
					AddToSDOsetList(datapath, ( IS_GENERIC_MODE ? undefined : parMap ), IDX_PDO_PARAMS + idpdo, SUBIDX_PDO_COBID, objCOBID.name, "UDINT", value, true )
				}
				else
				{
					var msg
					var obj = (IDX_PDO_PARAMS + idpdo); obj = obj.toString( 16 )
					var subobj = SUBIDX_PDO_COBID; subobj = subobj.toString( 16 )
					if ( objCOBID == undefined )
						msg = app.Translate( "INFO: Parametrization to enable PDO not generated (Object " + obj + "." + subobj + " does not exists)" )
					else if ( objCOBID.readOnly )
						msg = app.Translate( "INFO: Parametrization to enable PDO not generated (Object " + obj + "." + subobj + " is read only)" )
					else
						msg = app.Translate( "INFO: Parametrization to enable PDO not generated (Object " + obj + "." + subobj + ")" )
					
					app.CallFunction("common.AddLog", LEV_INFO, CAN_MODULE + ".UpdatePDOMapping", msg)
				}
			}
			
			//	passo al pdo successivo
			cnt++
		}
	}
}

function IsDisabledCOBID(cobid)
{
	// toglie la stringa $NODEID e + se presenti
	var cobid = parseInt(cobid.toUpperCase().replace("$NODEID", "").replace("+", ""))
	if (isNaN(cobid)) return false
	
	// PDO disabilitato se ultimo bit alto
	return (cobid & COBID_DISABLED_FLAG) != 0
}

function GetEnabledCOBID(cobid)
{
	var pos = cobid.indexOf("+")
	if (pos != -1)
	{
		// c'è all'inizio anche $NODEID + , quindi toglie il bit alla parte rimanente e lo riconcatena
		var result = parseInt(cobid.substr(pos+1)) & ~COBID_DISABLED_FLAG
		return cobid.substr(0,pos+1) + " 0x" + result.toString(16)
	}
	else
	{
		// si suppone cobid solo numerico, toglie l'ultimo bit
		var result = parseInt(cobid) & ~COBID_DISABLED_FLAG
		return "0x" + result.toString(16)
	}
}

//	è uguale al valore di abilitazione con il bit più significativo = 1
function GetDisabledCOBID(cobid)
{
	var pos = cobid.indexOf("+")
	if (pos != -1)
	{
		// c'è all'inizio anche $NODEID + , quindi toglie il bit alla parte rimanente e lo riconcatena
		var result = parseInt(cobid.substr(pos+1)) | COBID_DISABLED_FLAG
		if ( result < 0 ) result = 4294967296 + result	//	per avere un valore positivo
		return cobid.substr(0,pos+1) + " 0x" + result.toString(16)
	}
	else
	{
		// si suppone cobid solo numerico, toglie l'ultimo bit
		var result = parseInt(cobid) | COBID_DISABLED_FLAG
		if ( result < 0 ) result = 4294967296 + result	//	per avere un valore positivo
		return "0x" + result.toString(16)
	}
}
