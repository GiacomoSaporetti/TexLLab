/*	AlDatabase_cfg.js */

//	utilizza datablock applicativi per l'immagine di parametri e status variables
var USE_LOGICLAB_APPLICATION_DATABLOCK = false

//	di default è false ovvero il target è little endian
//	per metterlo big endian specificare negli attributi del target
//	<xs:attribute name="IsTargetBigEndian" type="xs:boolean" fixed="true"/>
var ALDATABASE_IS_TARGET_BIG_ENDIAN = false

//	mettere true se il target supporta il web server
//	defaul false
var ALDATABASE_GENERATE_MENUS = false

// Definizione range degli indirizzi fisici e logici di default per l'assegnamento dei parametri

// Indirizzamento modbus compliant 
var m_params_AddressRangeModbus		= { start: 0x4000, end: 0x4FFF }	//	16384 - 20479 (4096 EEProm parameters)
var m_paramsRO_AddressRangeModbus	= { start: 0x6000, end: 0x6FFF }	//	24576 - 28671 (4096 Status variables)

// Indirizzamento libero: NB 65000..65535 sono riservati per runtime PLC! 
var m_params_AddressRangeFree		= { start: 1,      end: 64999 }
var m_paramsRO_AddressRangeFree		= { start: 1,      end: 64999 }

// Range degli IPA. ATTENZIONE non devono sovrapporsi a quelli di sistema (che quindi devono partire dal 20000 in poi)
var m_params_IpaRange				= { start:     1,  end:  9999 }
var m_paramsRO_IpaRange				= { start: 10000,  end: 19999 }


//	possibilità di ridefinire le configurazioni di default impostate fin ora (vedi righe qui sopra)
#include ../AlDatabase_settings.js


var gentypes = app.CallFunction("common.GetGeneralTypes")
var enuLogLevels = gentypes.enuLogLevels
var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var GetNode = genfuncs.GetNode
var SetNode = genfuncs.SetNode
var GetNodeText = genfuncs.GetNodeText

var m_LogicLabTypes = app.CallFunction("script.GetLogicLabTypes")
var TYPEPAR = m_LogicLabTypes.TYPEPAR

	//	FileSystemObject di uso generale
var m_fso = new ActiveXObject("Scripting.FileSystemObject")

var PATH_PARAMS   = "config/params/param"
var PATH_PARAMSRO = "config/paramsRO/param"
var PATH_MENUS_NODE = "config/menus"
var PATH_ENUMS    = "config/enums/enum"
var PATH_SYSENUMS	= "config/sysenums/enum"
var PATH_MODBUS_ADDRESS = "protocol[@name = 'Modbus']/@commaddr"

var m_databaseSignatureCRC32

// visibilita accesslevel
var ACCLEV = { NEVER: 0, LEVEL1: 1, LEVEL2: 2, ALWAYS: 3 }

// unita di misura (presenti nel combo um) per le quali esiste il corrispondente led sul display
var DEFAULT_UM = [""]
// formati predefiniti presenti nel combo format per gli interi
var DEFAULT_FORMATS_INT = [m_LogicLabTypes.FORMAT_XXXY, m_LogicLabTypes.FORMAT_XXYY, "%04x", m_LogicLabTypes.FORMAT_HHMM]
// formati predefiniti presenti nel combo format per i non interi
var DEFAULT_FORMATS = ["%.1f", "%.2f"]

// import fasi di compilazione
var COMPILATIONPHASE = app.CallFunction("compiler.GetCompilationPhase")

var m_clientTypeEnum = {0:"Analog Input", 1:"Digital Input", 2:"Status", 3:"Alarm", 4:"Command"}


function GetParamsAddressRange()
	{ 
		if( IsModbusCompliantDatabase() )
		{
			return m_params_AddressRangeModbus 
		}
		else
		{
			return m_params_AddressRangeFree 
		}
	}
	
function GetParamsROAddressRange()
	{ 
		if( IsModbusCompliantDatabase() )
		{
			return m_paramsRO_AddressRangeModbus
		}
		else
		{
			return m_paramsRO_AddressRangeFree
		}
	 }
	
function GetParamsIpaRange()
	{ return m_params_IpaRange }
	
function GetParamsROIpaRange()
	{ return m_paramsRO_IpaRange }
	
function GetDefaultUM()
	{ return DEFAULT_UM }

function GetDefaultFormats_Int()
	{ return DEFAULT_FORMATS_INT }
	
function GetDefaultFormats()
	{ return DEFAULT_FORMATS }

function GetClientTypeEnum()
{
	//ritorna la mappa enumerativo sotto forma di array
	var arr = []
	for (var type in m_clientTypeEnum)
	{
		arr.push(type)
		arr.push(m_clientTypeEnum[type])
	}
	return arr
}


function PLCDatablock(dbtype, elemtype, idx)
{
	this.dbType = dbtype       // I/Q/M
	this.elemType = elemtype   // B/W/D/X
	this.idx = idx             // indice datablock
	this.size = 0              // numero elementi (calcolato runtime ad ogni save)
}

PLCDatablock.prototype.toString = function(offset)
{
	var str = "%" + this.dbType + this.elemType + this.idx
	if (offset !== undefined)
		str += "." + offset
	return str
}

PLCDatablock.prototype.GetElemSize = function()
{
	var type2size = { "X":1, "B":1, "W":2, "D":4 }
	return type2size[this.elemType]
}

PLCDatablock.prototype.GetTotalByteSize = function()
{
	return this.size * this.GetElemSize()
}

var m_paramsE2_DataBlock  = new PLCDatablock("M", "W", 200)
var m_paramsRAM_DataBlock = new PLCDatablock("M", "W", 201)

	// id icone di overlay per l'albero
var TREE_OVERLAY_NONE = 0
var TREE_OVERLAY_DISABLED = 1
	
function OnLoad_VerifyDatabase()
{
	// se il file progetto.PLK non esiste ma esiste la var globale autogenerata $$ParDB, e' probabile che arriviamo da un "save as",
	// che si e' copiato il VECCHIO progetto.PLK (poiche' e' referenziato cosi nel vecchio come {INIT:... ), in modo da non dare errori di apertura.
	// forza quindi il ModifiedFlag in modo da triggerare al piu' presto un save che vada a rigenerare il PLK prima della compilazione
	// rimarra' in giro il vecchio .PLK ma non fa danni...
	var plkname = app.CallFunction("common.ChangeFileExt", GetPLCProjectPath(), "PLK")
	if (!m_fso.FileExists(plkname))
	{
		var plcVar = app.CallFunction("logiclab.GetGlobalVariable", "$$ParDB")
		if (plcVar)
		{
			//var msg = app.Translate("WARNING: ParDB init file not found: please save now to re-generate it\n\n")
			//app.CallFunction("logiclab.PrintToOutput", msg)
			
			app.ModifiedFlag = true
		}
	}
}

//	typetarg specified is enumerative?
function IsEnumType(typetarg)
{
	var logicLabTypes = app.CallFunction("script.GetLogicLabTypes")
	var typeTargs = logicLabTypes.TYPETARG//logicLabTypes.TYPETARG64
	
	var ris = typeTargs[ typetarg ]
	if (ris == undefined)
	{
		var targetID = app.CallFunction( "logiclab.get_TargetID" )
		var device = app.SelectNodesXML( "/" + targetID )[0]
		var nodes = device.selectNodes( PATH_SYSENUMS + "[@caption = '" + typetarg + "'] | " + PATH_ENUMS + "[@caption = '" + typetarg + "']" )
		return nodes.length != 0
	}
	else
	{
		return false
	}
}

function BuildParIndex(isModbusCompliant, idx, subidx)
{
	if (isModbusCompliant)
	{
		return idx
	}
	else
	{
		// subidx gestito; non ci sono modifiche dell'indice per supportare un bus di campo specifico
		if (subidx !== undefined)
			return idx + "." + subidx
		else
			return idx
	}
}

function CanSwitchToFreeIndexMode(device)
{
	var nodes = device.selectNodes(PATH_PARAMS + " | " + PATH_PARAMSRO)
	var node
	while (node = nodes.nextNode())
	{
		var size = parseInt(GetNodeText(node, "size"))
		var typeparInt = parseInt(GetNodeText(node, "typepar"))

		//	free index does not support arrays
		if (size > 0 && typeparInt != TYPEPAR.STRING)
			return false
	}
	return true
}

function ValidateDatabase(device)
{
	var FUNCNAME = "ValidateDatabase"
	
	//	validate enums
	var ris = ValidateEnums(device)
	if ( ris != enuLogLevels.LEV_OK )
		return ris

	var isModbusCompliant = IsModbusCompliantDatabase()
	
	var ipaMap = {}
	var nameMap = {}
	var addressMap = {}

	// verifica duplicazione nomi e ipa per parametri e statusvar
	var nodes = device.selectNodes(PATH_PARAMS + " | " + PATH_PARAMSRO)
	var node
	while (node = nodes.nextNode())
	{
		var name = GetNodeText(node, "name")
		if(!name)
			continue	// salta per non assegnati a var PLC
		
		//	Verifica duplicazione name
		if (nameMap[name])
		{
			var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("name"))
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "AlDatabase.Validate", "Duplicate parameter name: " + name, err)
		}
		
			//	Verifica duplicazione ipa
		var ipa = parseInt(GetNodeText(node, "ipa"))
		if (ipaMap[ipa])
		{
			var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("ipa"))
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "AlDatabase.Validate", "Duplicate or overlapping parameter IPA code: " + ipa, err)
		}

		// Verifica indice
		var addressStr = GetNodeText(node, "address")
		if (isNaN(addressStr))
		{
			var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("address"))
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "Validate", "Invalid index specified: " + addressStr, err)
		}
		var address = parseInt(addressStr)			
		
		// verifica sotto indice	
		var subindex = undefined
		if (!isModbusCompliant)
		{
			var subindexStr = GetNodeText(node, "subindex")
				//	Verifica sotto indice è un numero
			if (isNaN(subindexStr))
			{
				var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("subindex"))
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "Validate", "Invalid subindex specified: " + node.selectSingleNode("subindex"), err)
			}
			subindex = parseInt(subindexStr)
		}
		
		
		// calcolo della dimensione del parametro (prima verifico coerenza tipi e validità)
		var typetarg = GetNodeText(node, "typetarg")
		var typepar = parseInt(GetNodeText(node, "typepar"))
		
		// per usare i parametri stringa entrambi i tipi devono essere STRING
		if (typepar == TYPEPAR.STRING && typetarg != "STRING" || 
		    typepar != TYPEPAR.STRING && typetarg == "STRING")
		{
			var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("typepar"))
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "AlDatabase.Validate", "DeviceType and ApplicationType must be both STRING", err)
		}
		
		//	se il type targ è un enum, deve esserlo anche il typepar (stesso enum)
		if ( IsEnumType( typetarg ) )
		{
			if (IsStandardTypePar(typepar))
			{
				var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("typepar"))
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "AlDatabase.Validate", "Parameter type must be the same of PLC type if enum is specified", err)
			}
			else
			{
				//	il type par deve essere lo stesso enumerativo
				var enumNode = device.selectSingleNode( PATH_ENUMS + "[@id=" + (typepar - m_LogicLabTypes.ENUM_BASE) + "]" )
				var enumNodeCaption = enumNode.getAttribute( "caption" )
				if ( enumNodeCaption != typetarg )
				{
					var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("typepar"))
					return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "AlDatabase.Validate", "Parameter type must be the same of PLC type if enum is specified", err)
				}
			}
		}
		else if (IsStandardTypePar(typepar))
		{
			// se typepar standard tale tipo sara' usato anche per il typetarg, ne tiene conto per il calcolo della dimensione
			for (var i in TYPEPAR)
			{
				if (TYPEPAR[i] == typepar)
				{
					typetarg = i
					break
				}
			}
		}
		
		// calcolo dimensione
		var strsize = parseInt(GetNodeText(node, "size"))
		var arrsize = parseInt(GetNodeText(node, "size"))
		var size = 0;
		
		if (typepar == TYPEPAR.STRING)
		{
			// la lunghezza massima per le stringhe e' 31 caratteri
			if (strsize < 1 || strsize > 31)
			{
				var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("size"))
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "AlDatabase.Validate", "Invalid string size (max is 31): " + strsize, err)
			}
			
			if (isModbusCompliant)
			{
				// aggiunge il terminatore
				strsize++
			}
			else
			{
				// stringa come elemento elementare
				strsize = 1
			}
			size = strsize
		}
		else if(!IsEnumType( typetarg ))
		{
			if (arrsize == 0)
				arrsize = 1   // sempre almeno un elemento
			
			// verifica coerenza valori default, min, max in base al tipo scelto
			var limits = app.CallFunction("common.GetIECTypeLimits", typetarg)
			if (limits)
			{
				var defval = parseFloat(GetNodeText(node, "value"))
				if (defval && (defval < limits.min || defval > limits.max))
				{
					var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("value"))
					return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "Validate", "Invalid default value", err)
				}
				
				var min = parseFloat(GetNodeText(node, "min"))
				if (min && (min < limits.min || min > limits.max))
				{
					var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("min"))
					return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "Validate", "Invalid minimum value", err)
				}
				
				var max = parseFloat(GetNodeText(node, "max"))
				if (max && (max < limits.min || max > limits.max))
				{
					var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("max"))
					return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "Validate", "Invalid maximum value", err)
				}
			}
			
			size = arrsize
		}
		
		
		// address deve essere indefinito per gli attributi BACnet non pubblicati
		if(address)
		{
			if(isModbusCompliant)
			{
				if ( IsEnumType( typetarg ) )
				{
					// force type to DINT for enum
					typetarg = "DINT"
					size = app.CallFunction("parameters.GetModbusObjectSizeFromIEC", "DINT")
				}
				else
				{
					size = app.CallFunction("parameters.GetModbusObjectSizeFromIEC", typetarg, size)
				}
			}
				
			for (var i = 0; i < size; i++)
			{
				var index = BuildParIndex(isModbusCompliant, address + i, subindex)
				
				// Verifica duplicazione index
				if (addressMap[index])
				{
					var err = app.CallFunction("common.SplitFieldPath", node.selectSingleNode("address"))
					return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "AlDatabase.Validate", "Duplicate or overlapping parameter address: " + (index), err)
				}
				else
					addressMap[index] = true
			}
		}
		
		//	Memorizza nelle mappe
		ipaMap[ipa] = true
		nameMap[name] = true
	}

	// elimina eventuali nodi menu con riga vuota (ipa==-1, come da templatedata in EWApplication.pct)
	nodes = device.selectNodes("config/*/menu/menuItem[ipa = -1]")
	while (node = nodes.nextNode())
		node.parentNode.removeChild(node)
	
	return enuLogLevels.LEV_OK
}

// calcolo allocazione datablock per i parametri eeprom/status
function GetParDataBlock(db, type, arrsize)
{
	var size
	
	if (type == "STRING")
	{
		size = arrsize + 1  // aggiunge terminatore
	}
	else
	{
		if (IsEnumType( type ) )
		{
			type = "DINT"	//	force type to DINT
		}
		
		size = app.CallFunction("common.GetIECTypeSize", type)
		size = size * arrsize

		if (db.elemType == "B")
		{
			if (size > 1 && (db.size % size) != 0)
				// si accerta di allineare a word/dword le variabili di dimensione >1
				db.size += db.size % size
		}
		else if (db.elemType == "W")
		{
			if (size == 4 && (db.size % 2) == 1)
				// se tipo a 32bit su una WORD dispari lascia un buco
				db.size++
		}
		else if (db.elemType == "D")
		{
			// TODO datablock a 32bit
		}
	}
	
	var result = db.toString(db.size)

	if (db.elemType == "W")
		// i datablock sono a word quindi divide per 2 la dimensione in byte
		size = Math.ceil(size / 2)
	else if (db.elemType == "D")
		// i datablock sono a dword quindi divide per 4 la dimensione in byte
		size = Math.ceil(size / 4)
	
	db.size += size

	return result
}

	//	Restituisce elenco delle variabili da esportare nel file .PLC
function GetExportPLCVars(device)
{
	if ( USE_LOGICLAB_APPLICATION_DATABLOCK )
	{
		app.CallFunction("logiclab.RemoveApplicationDB", m_paramsE2_DataBlock.idx,  m_paramsE2_DataBlock.dbType)
		app.CallFunction("logiclab.RemoveApplicationDB", m_paramsRAM_DataBlock.idx, m_paramsRAM_DataBlock.dbType)
	}

	// creazione variabili PLC per Parametri EEPROM
	var list 	 = []
	
	m_paramsE2_DataBlock.size = 0
	var nodelist = device.selectNodes(PATH_PARAMS)
	var node
	while( node = nodelist.nextNode() )
	{	
		var arrsize
		var newitem  = {}
		newitem.type = GetNodeText( node, "typetarg" )
		if (newitem.type == "STRING")
		{
			newitem.size = parseInt(GetNodeText( node, "size" ))   // dimensione per ora solo per stringhe
			arrsize = newitem.size
		}
		else
		{
			arrsize = parseInt(GetNodeText( node, "size" ))
			if (arrsize == 0)
			{
				arrsize++
				//newitem.size = arrsize	//	skip this because otherwise create unary array
			}
			else
			{
				newitem.size = arrsize
			}
		}
			
		newitem.dataBlock = GetParDataBlock(m_paramsE2_DataBlock, newitem.type, arrsize)
		newitem.label 	  = GetNodeText( node, "name" )
		newitem.description = GetNodeText( node, "description" )
		newitem.group     = "Parameters"
		newitem.node = node
			
		list.push( newitem )
		// memorizza datablock calcolato per uso successivo (database interno)
		SetNode(node, "dataBlock", newitem.dataBlock)
	}
	
	if ( USE_LOGICLAB_APPLICATION_DATABLOCK )
	{
		if (m_paramsE2_DataBlock.size > 0)
			// ATTENZIONE: nel simulatore questi DB sono dichiarati come DB normali nel TGSX! altrimenti non vanno i pannellini di IO
			app.CallFunction("logiclab.AddApplicationDB", m_paramsE2_DataBlock.idx, m_paramsE2_DataBlock.dbType, m_paramsE2_DataBlock.elemType, m_paramsE2_DataBlock.size, "rw")
	}

	m_paramsRAM_DataBlock.size = 0
	// creazione variabili PLC per Status variables
	nodelist = device.selectNodes(PATH_PARAMSRO)
	while( node = nodelist.nextNode() )
	{	
		var arrsize
		var newitem  = {}
		newitem.type = GetNodeText( node, "typetarg" )
		if (newitem.type == "STRING")
		{
			newitem.size = parseInt(GetNodeText( node, "size" ))   // dimensione per ora solo per stringhe
			arrsize = newitem.size
		}
		else
		{
			arrsize = parseInt(GetNodeText( node, "size" ))
			if (arrsize == 0)
			{
				arrsize++
				//newitem.size = arrsize	//	skip this because otherwise create unary array
			}
			else
			{
				newitem.size = arrsize
			}
		}
			
		newitem.dataBlock = GetParDataBlock(m_paramsRAM_DataBlock, newitem.type, arrsize)
		newitem.label 	  = GetNodeText( node, "name" )
		newitem.description = GetNodeText( node, "description" )
		newitem.group     = "Variables"
		newitem.node = node

		var value = GetNodeText( node, "value" )
		if (value != "")
		{
			if( newitem.type == "BOOL" || newitem.type == "STRING" )
			{
				newitem.defaultValue = value
			}
			else
			{
				//	Calcolo del valore di default numerico, con fattore di scala e offset,
				//	per FREE Studio Application (e non per Device)
				var scale = parseFloat( GetNodeText( node, "scale" ) )
				var offset = parseFloat( GetNodeText( node, "offs" ) )
				var defaultValue = parseFloat(value) * scale + offset
				newitem.defaultValue = defaultValue.toString()
			}
		}

		list.push( newitem )
		// memorizza datablock calcolato per uso successivo (database interno)
		SetNode(node, "dataBlock", newitem.dataBlock)
	}
	
	if ( USE_LOGICLAB_APPLICATION_DATABLOCK )
	{
		if (m_paramsRAM_DataBlock.size > 0)
			// ATTENZIONE: nel simulatore questi DB sono dichiarati come DB normali nel TGSX! altrimenti non vanno i pannellini di IO
			app.CallFunction("logiclab.AddApplicationDB", m_paramsRAM_DataBlock.idx, m_paramsRAM_DataBlock.dbType, m_paramsRAM_DataBlock.elemType, m_paramsRAM_DataBlock.size, "rw")
	}
	
	return list
}

function GetPLCProjectPath(device)
{
	var prjpath = app.CallFunction("logiclab.get_ProjectPath")
	return prjpath
}

function GetExportPLCFile(device)
{
	var result = {}
	result.filename = "Global shared.plc"
	return result
}

function GetExportExtVars(device)
{
	return []
}

function GetExportExtFile(device)
{
}

function IsStandardTypePar(type)
{
	return type <= TYPEPAR.__LAST
}

// funzione per manipolazioni al PCT applicativo prima di salvarlo
function CustomAppBuild(device, xmldoc)
{
	// ha database interno, quindi elimina scala e offset in quanto vengono gestiti direttamente da lui
	var nodelist = xmldoc.selectNodes("/devicetemplate/deviceconfig/parameters/par")
	var node
	while (node = nodelist.nextNode())
	{
		// per i tipi standard il tipo target viene forzato al tipo par, in quanto la conversione viene fatta dal device
		var typepar = node.getAttribute("typepar")
		if (typepar.substr(0,4) != "enum")
			node.setAttribute("typetarg", typepar)
		
		// reset di scala e offset (sono fatti nel db interno)
		node.setAttribute("scale", 1)
		node.setAttribute("offs", 0)
	}
	
	return enuLogLevels.LEV_OK
}


// funzioni ausiliarie che convertono il valore di input in lista di byte aggiunti all'array
function EncodeInt(value, list)
{
	if ( ALDATABASE_IS_TARGET_BIG_ENDIAN )
		list.push((value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF)
	else
		list.push(value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF, (value >> 24) & 0xFF)
}
function EncodeShort(value, list)
{
	if ( ALDATABASE_IS_TARGET_BIG_ENDIAN )
		list.push((value >> 8) & 0xFF, value & 0xFF)
	else
		list.push(value & 0xFF, (value >> 8) & 0xFF)
}
function EncodeFloat(value, list)
{
	var intValue = app.CallFunction("commonDLL.FloatToInt", value)
	
	EncodeInt(intValue, list)
}


/*typedef struct DBTABLE
{
	unsigned short ipa;
	unsigned short subidx;
	unsigned char typePar;
	unsigned char typeVar;
	unsigned short unused;
	unsigned long ptr;
	unsigned long el;
	unsigned long attr;
	float def;
	float min;
	float max;
	float scale;
	float off;
} */

//NULL:-1, VOID:0, BOOL:1, BYTE:2, INT:3, WORD:4, LONG:5, DWORD:6, REAL:7, STRING:8, BUFF:9, SINT:10
var m_TypeTargToParDB = { INT:3, DINT:5, WORD:4, DWORD:6, REAL:7, BOOL:1, STRING:8, BYTE:2, SINT:10, USINT:2, UINT:4 , UDINT:6 }

// preso da DBase.h
var PARDB_ATTR = { RO:0, WR:1, DEFVAL:2, MIN:4, MAX:8, PMIN:0x10, PMAX:0x20, SCALE:0x40, DATABLOCK_ADDR:0x80, E2PROM:0x80000000 }

// numero di bytes per parametro (per ritorno a capo)
var BYTES_PER_PAR = 40

// converte valore di typepar in valore da salvare nel ParDB per l'EWP2
function TypeParToParDB(typepar)
{
	switch (typepar)
	{
		case TYPEPAR.BOOL:	return m_TypeTargToParDB.BOOL
		case TYPEPAR.INT:	return m_TypeTargToParDB.INT
		case TYPEPAR.WORD:	return m_TypeTargToParDB.WORD
		case TYPEPAR.DINT:	return m_TypeTargToParDB.DINT
		case TYPEPAR.DWORD:	return m_TypeTargToParDB.DWORD
		case TYPEPAR.REAL:	return m_TypeTargToParDB.REAL
		case TYPEPAR.STRING:	return m_TypeTargToParDB.STRING
		case TYPEPAR.SINT:	return m_TypeTargToParDB.SINT
		case TYPEPAR.BYTE:	return m_TypeTargToParDB.BYTE
	}
}

function BuildSinglePar(root, par, isEEPROM, list, allParamsMap)
{
	var parName = GetNodeText(par, "name")
	// ptr, prima word numero datablock e seconda word offset
	var db = GetNodeText(par, "dataBlock")
	if(!db)
	{
		var msg = app.Translate("WARNING: check Global shared generation. ExportPLCVars attribute missing?")
		app.PrintMessage( msg, enuLogLevels.LEV_WARNING )
		app.CallFunction("extfunct.SelectOutputTab", 3)
		return false
	}
	var typetarg = GetNodeText(par, "typetarg")
	
	var attr = 0
	
	if (isEEPROM)
		attr |= PARDB_ATTR.E2PROM
	
	// attributo di readonly
	if (!genfuncs.ParseBoolean(GetNodeText(par, "readonly")))
		attr |= PARDB_ATTR.WR
	
	// address come 16bit
	var address = parseInt(GetNodeText(par, "address"))
	EncodeShort(address, list)
	
	// gestione subidx (non usato in modbus)
	if(IsModbusCompliantDatabase())
	{
		EncodeShort(0, list)
	}
	else
	{
		EncodeShort(parseInt(GetNodeText(par, "subindex")), list)
	}
		
	
	var typepar  = parseInt(GetNodeText(par, "typepar"))
	
	
	// typepar: se tipi "speciali" interi scalati o enumerativi mette il tipo target (che sara' l'intero corretto)
	var dbtype
	if (IsStandardTypePar(typepar))
		dbtype = TypeParToParDB(typepar)
	else
	{
		if ( IsEnumType( typetarg ) )
		{
			typetarg = "DINT"
			dbtype = m_TypeTargToParDB[typetarg]
		}
		else
			dbtype = m_TypeTargToParDB[typetarg]
	}
	
	if (dbtype != undefined)
		list.push(dbtype)
	else
		throw "Invalid TypePar: " + typepar
		
	// typetarg, nessuna conversione particolare
	dbtype = m_TypeTargToParDB[typetarg]
	if (dbtype != undefined)
		list.push(dbtype)
	else
		throw "Invalid TypeTarg: " + typetarg
	
	// unused for 32bit alignment
	EncodeShort(0, list)
	
	var splittedAddr = app.CallFunction("common.ParseDataBlock", db)
	
	if ( ALDATABASE_IS_TARGET_BIG_ENDIAN )
	{
		//	address e offset sono su un campo uint32_t lato target
		EncodeShort(splittedAddr.datablock, list)
		EncodeShort(splittedAddr.offset, list)
	}
	else
	{
		//	address e offset sono su un campo uint32_t lato target
		EncodeShort(splittedAddr.offset, list)
		EncodeShort(splittedAddr.datablock, list)
	}
	
	attr |= PARDB_ATTR.DATABLOCK_ADDR
	
	var size = parseInt(GetNodeText(par, "size"))
	if (dbtype == m_TypeTargToParDB.STRING)
	{
		// per stringhe usa size (+1 per il terminatore)
		size = size++
	}
	else
	{
		if (size == 0)
			size++
	}
	EncodeInt(size, list)
	
	// valore default, alza bit di attr se necessario (NB le stringhe non hanno default a livello di DB)
	var defval = GetNodeText(par, "value")
	if (dbtype != m_TypeTargToParDB.STRING && defval != "")
	{
		defval = parseFloat(defval)
		attr |= PARDB_ATTR.DEFVAL
	}
	else
		defval = 0
		
	// valore min, alza bit di attr se necessario
	var min = GetNodeText(par, "min")
	if (min != "")
	{
		if (isNaN(min))
		{
			// stringa, e' un nome di parametro, quindi passa l'indirizzo modbus
			var parLimit = allParamsMap[min]
			if (parLimit != undefined)
				min = parseFloat(parLimit)
			else
				throw "Invalid Minimum limit: " + min
				
			attr |= PARDB_ATTR.PMIN
		}
		else
			// valore numerico semplice come limite
			min = parseFloat(min)
			
		attr |= PARDB_ATTR.MIN
	}
	else
		min = 0
		
	// valore max, alza bit di attr se necessario
	var max = GetNodeText(par, "max")
	if (max != "")
	{
		if (isNaN(max))
		{
			// stringa, e' un nome di parametro, quindi passa l'indirizzo modbus
			var parLimit = allParamsMap[max]
			if (parLimit != undefined)
				max = parseFloat(parLimit)
			else
				throw "Invalid Maximum limit: " + max
				
			attr |= PARDB_ATTR.PMAX
		}
		else
			// valore numerico semplice come limite
			max = parseFloat(max)
			
		attr |= PARDB_ATTR.MAX
	}
	else
		max = 0
	
	// scala e offset, alza il bit di attr se necessario (e' lo stesso per entrambi)
	var scale = GetNodeText(par, "scale")
	if (scale != "" && parseFloat(scale) != 1)
	{
		scale = parseFloat(scale) 
		attr |= PARDB_ATTR.SCALE
	}
	else
		scale = 1
		
	var offset = GetNodeText(par, "offs")
	if (offset != "" && parseFloat(offset) != 0)
	{
		offset = parseFloat(offset)
		attr |= PARDB_ATTR.SCALE
	}
	else
		offset = 0
		
	// attr calcolato in base alle features
	EncodeInt(attr, list)
	
	// codifica il defval in base al tipo del parametro (float/int)
	if (typepar == TYPEPAR.REAL)
		EncodeFloat(defval, list)
	else
		EncodeInt(parseInt(defval), list)
	
	// tutti i float gia' esaminati prima
	EncodeFloat(min,    list)
	EncodeFloat(max,    list)
	EncodeFloat(scale,  list)
	EncodeFloat(offset, list)
	
	return true
}

function DecodeParDB(parDBPlk)
{
	var result = {}
	var SEEK_SET = 0
	var SEEK_CUR = 1
	var SEEK_END = 2
	
	if (!m_fso.FileExists(parDBPlk))
	{
		result.list = []
		result.code = ""
		
		return result
	}
		
	//	in questo caso la lista viene riempita con i valori letti dal file plk
	var f = app.CallFunction("commonDLL.BinaryFileOpen", parDBPlk, "rb")
	var fileSize
	
	//	get file size
	app.CallFunction("commonDLL.BinaryFileSeek", f, 0, SEEK_END)
	fileSize = app.CallFunction("commonDLL.BinaryFileGetPos", f)
	app.CallFunction("commonDLL.BinaryFileSeek", f, 0, SEEK_SET)	//	riporta all'inizio
	
	//	get all data as safe array
	var fileData = app.CallFunction("commonDLL.BinaryFileRead", f, fileSize, false)
	//	close file
	app.CallFunction("commonDLL.BinaryFileClose", f)
	
	//	convert safe array to bytes          
	result.list = genfuncs.FromSafeArray(fileData)
	result.code = '$$ParDB : ARRAY[ 0..' + (result.list.length-1) + ' ] OF USINT; { HIDDEN:ON } { INIT:"' + m_fso.GetFileName(parDBPlk) + '+0" }\n'
	
	return result
}

// codifica il database parametri (ricevuto in input come un array di byte) in un 'ARRAY[] OF USINT' in PLC
function EncodeParDB(list, parDBPlk)
{
	var result = '$$ParDB : ARRAY[ 0..' + (list.length-1) + ' ] OF USINT; { HIDDEN:ON } { INIT:"' + m_fso.GetFileName(parDBPlk) + '+0" }\n'
	
	// per velocizzare l'elaborazione, salva l'array di inizializzazione della var ParDB in un file binario esterno
	// altrimenti per database molto grandi (migliaia di par) il preprocess dell'array e' molto lento
	var f = app.CallFunction("commonDLL.BinaryFileOpen", parDBPlk, "wb")
	app.CallFunction("commonDLL.BinaryFileWrite", f, list)
	app.CallFunction("commonDLL.BinaryFileClose", f)

	return result
}

function GenerateDBParProgramHeader( root )
{
	// ottiene il nome del task a cui associare il ParDB
	var task = root.getAttribute("PLCTaskParDB")
	if (!task) // se non è specificato lo mette nel task "Init"
		task = "Init"
		
	return "PROGRAM InitParDB WITH " + task + ";\n\
\n\
PROGRAM InitParDB\n\
	{ HIDDEN:ON }\n\
	{ CODE:ST }\n\
	VAR\n\
		warningsKiller: USINT;\n\
		dummyCrc32: UDINT;\n\
	END_VAR\n"
}

function GetParKey(par)
{
	// address come 16bit
	var index = parseInt(GetNodeText(par, "address"))
	
	if(IsModbusCompliantDatabase())
	{
		// subidx non usato in modbus
		var subindex = 0
	}
	else
	{
		var subindex = parseInt(GetNodeText(par, "subindex"))
	}
	
	var key = index + "." + subindex
	return key
}

function GenerateDatabaseMenuIDs(root)
{
	// valorizza tutti gli attributi id su menu e pagine
	// anche configurator_app.js lo fa, ma troppo tardi; inoltre se il configuratore non è installato non farebbe il PCT,
	// quindi fa subito qui gli id, che verranno poi usati anche dopo
	var MENU_BASE = 30000;   // id arbitrario "alto", come in configurator_app.js
	var menuId = MENU_BASE;
	var menus = root.selectSingleNode( "config/menus" )
	if ( menus )
	{
		var children = menus.selectNodes(".//menu | .//custompage");
		var child
		while (child = children.nextNode())
			child.setAttribute("id", menuId++);
	}
}

function GenerateParDB(root, parDBPlk, parDBMap, calculateCRC32only)
{
	var list = []
	var dblen = 0

	if ( !calculateCRC32only )
	{
		// mappa nome -> address per ricerca veloce
		var allParamsMap = {}
		var allPars = root.selectNodes(PATH_PARAMS + " | " + PATH_PARAMSRO)
		var par
		while (par = allPars.nextNode())
		{
			if(IsModbusCompliantDatabase())
			{
				allParamsMap[ GetNodeText(par, "name") ] = GetNodeText(par, "address")
			}
			else
			{
				allParamsMap[ GetNodeText(par, "name") ] = GetNodeText(par, "address") + "." + GetNodeText(par, "subindex")
			}
		}
			
		// codifica parametri EEPROM
		var params = root.selectNodes(PATH_PARAMS)
		while (par = params.nextNode())
		{
			if (BuildSinglePar(root, par, true, list, allParamsMap,false))
			{
				var strIndex = GetParKey( par )
				parDBMap[ strIndex ] = dblen	//	mappa parametro -> indice parametro in tabella
				
				dblen++
			}
		}
	
		// codifica parametri RAM
		var paramsRO = root.selectNodes(PATH_PARAMSRO)
		while (par = paramsRO.nextNode())
		{
			if (BuildSinglePar(root, par, false, list, allParamsMap,false))
			{
				var strIndex = GetParKey( par )
				parDBMap[ strIndex ] = dblen	//	mappa parametro -> indice parametro in tabella
				
				dblen++
			}
		}
		
		if (list.length == 0)
		{
			if (m_fso.FileExists(parDBPlk))
				m_fso.DeleteFile(parDBPlk)
			
			// nessun parametro, non genera niente
			return ""
		}
	}
		
	var result = "VAR_GLOBAL CONSTANT\n"
	if ( calculateCRC32only )
	{
		var risDecode = DecodeParDB(parDBPlk)
		if ( risDecode.code != "" )
		{
			dblen = risDecode.list.length / BYTES_PER_PAR;
			
			list = risDecode.list
			result += risDecode.code
		}
		else
		{
			list = []
			dblen = 0
		}
	}
	else
	{
		result += EncodeParDB(list, parDBPlk)
	}
	
	// variabile riassuntiva finale con la dimensione dell'array
	result +=  "$$ParDBLength  : DWORD := " + dblen + "; { HIDDEN:ON }\n" + 
				"END_VAR\n\n"
	
	// controllo di sicurezza sulla correttezza dell'array generato
	if (list.length != BYTES_PER_PAR * dblen)
		app.MessageBox("ERROR: bad ParDB array encoding !!!")
		
	return result
}

function GenerateMenuPar( index, subindex, parNode, generationInfo )
{
	var paramsStrCode = ""
	
	var parNameVar = "$$PARITEM_" + index + "_" + subindex + "_NAME"
	var parDescriptionVar = "$$PARITEM_" + index + "_" + subindex + "_DESCR"
	var parFormatVar = "$$PARITEM_" + index + "_" + subindex + "_FORMAT"
	var parUmVar = "$$PARITEM_" + index + "_" + subindex + "_UM"
	
	var pParNameVar = "NULL"
	var pParDescriptionVar = "NULL"
	var pParFormatVar = "NULL"
	var pParUmVar = "NULL"
	
	var name = genfuncs.GetNode( parNode, "name" )
	if ( name != "" ) pParNameVar = "?" + parNameVar
	
	/*	name */
	
	generationInfo.parNameMap[ parNameVar ] = name
						
	/*	description */
	
	var description = genfuncs.GetNode( parNode, "description" )
	if ( description == "" )
	{
		pParDescriptionVar = "NULL"
	}
	else
	{
		//	cerca se è già stata generata una descrizione uguale
		if ( !generationInfo.parDescriptionMap[ description ] )
		{
			//	aggiunge la descrizione nella mappa
			generationInfo.parDescriptionMap[ description ] = "$$PARDESCRIPTION_" + generationInfo.parDescriptionNum
			
			//	variabile con la descrizione di questo parametro
			pParDescriptionVar = "?$$PARDESCRIPTION_" + generationInfo.parDescriptionNum
			
			generationInfo.parDescriptionNum++
		}
		else
		{
			pParDescriptionVar = "?" + generationInfo.parDescriptionMap[ description ]
		}
	}
	
	/*	format	*/
	
	var format = genfuncs.GetNode( parNode, "form" )
	if ( format == "" )
	{
		pParFormatVar = "NULL"
	}
	else
	{
		//	cerca se è già stata generata un format uguale		
		if ( !generationInfo.parFormatMap[ format ] )
		{
			//	aggiunge la descrizione nella mappa
			generationInfo.parFormatMap[ format ] = "$$PARFORMAT_" + generationInfo.parFormatNum
			
			//	variabile con la descrizione di questo parametro
			pParFormatVar = "?$$PARFORMAT_" + generationInfo.parFormatNum
			
			generationInfo.parFormatNum++
		}
		else
		{
			pParFormatVar = "?" + generationInfo.parFormatMap[ format ]
		}
	}

	/*	um	*/
	
	var um = genfuncs.GetNode( parNode, "um" )
	if ( um == "" )
	{
		pParUmVar = "NULL"
	}
	else
	{
		//	cerca se è già stata generata un um uguale
		if ( !generationInfo.parUmMap[ um ] )
		{
			//	aggiunge la descrizione nella mappa
			generationInfo.parUmMap[ um ] = "$$PARUM_" + generationInfo.parUmNum
			
			//	variabile con la descrizione di questo parametro
			pParUmVar = "?$$PARUM_" + generationInfo.parUmNum
			
			generationInfo.parUmNum++
		}
		else
		{
			pParUmVar = "?" + generationInfo.parUmMap[ um ]
		}
	}
	
	var parKey = GetParKey( parNode )
	var itemId = generationInfo.parDBMap[ parKey ]
	
	//	in pParAddress ci finisce l'id progressivo del parametro nella tabella degli external parameters
	paramsStrCode = (	"\t( flags := ALDATABASE_MENU_PAR_FLAGS_ENUM#PAR_ADDRESS_DBTABLE_EXT_ID" +
						", ParAddress := " + itemId +
						", pParName := " + pParNameVar + 
						", pParDescription := " + pParDescriptionVar + 
						", pParFormat := " + pParFormatVar + 
						", pParUm := " + pParUmVar + " )" )

	return paramsStrCode
}

function GenerateMenu( device, menuNode, generationInfo, item )
{
	//	seleziona i figli del nodo indicato
	var childNodes = menuNode.selectNodes( "menu" )
	var menuArrayLength = 0
	
	if ( generationInfo.level > 0 )
		generationInfo.itemId.push(item)
	
	generationInfo.level++
	
	//	se ci sono dei figli procede ricorsivamente
	if ( childNodes.length > 0 )
	{
		var childNode
		
		var subItem = 0
		while ( childNode = childNodes.nextNode() )
		{		
			//	processa ricorsivamente tutti i menu
			GenerateMenu( device, childNode, generationInfo, subItem++ )
		}
		
		childNodes.reset()
		
		menuArrayLength = childNodes.length;
		if (menuArrayLength == 1) menuArrayLength++
		
		var menuStrId = ""
		for ( var i = 0; i < generationInfo.itemId.length; i++ )
		{
			menuStrId += ( "_" + generationInfo.itemId[ i ] )
		}
		
		var paramsStrCode = ""
		var menusStrCode = "$$MENU" + menuStrId + " : ARRAY[ 0.." + (menuArrayLength - 1) + " ] OF ALDATABASE_MENU := [\n"
		
		//	liste parametri associate in base al menu
		var paramListAddrByMenu = {}
		
		subItem = 0
		while ( childNode = childNodes.nextNode() )
		{
			var subMenuName = "$$MENU" + menuStrId + "_" + subItem
			var subMenuParListName = "$$PARLIST" + menuStrId + "_" + subItem		//	se ci sono parametri nel menu
			
			/*	generazione parametri dei sotto menu */
			
			var menuParListNode = childNode.selectNodes( "menuItems/menuItem" )
			if ( menuParListNode.length > 0 )
			{
				var parListArrayLength = menuParListNode.length
				if ( parListArrayLength == 1 ) parListArrayLength++
					
				paramsStrCode += subMenuParListName + " : ARRAY[ 0.." + (parListArrayLength - 1) + " ] OF ALDATABASE_PARITEM := [\n"
				
				var menuParNode
				var parItem = 0
				while (menuParNode = menuParListNode.nextNode())
				{
					var index = genfuncs.GetNode( menuParNode, "ipa" )
					var subindex = 0
					
					var parNode = device.selectSingleNode( PATH_PARAMS + "[ipa = '" + index + "'] | " + PATH_PARAMSRO + "[ipa = '" + index + "']" )
					if ( !parNode )	
						throw "Cannot find parameter specified into menu: " + index
					
					paramsStrCode += GenerateMenuPar( index, subindex, parNode, generationInfo )
					
					if ( parItem < parListArrayLength - 1 )
						paramsStrCode += ",\n"
					else
						paramsStrCode += "\n"
					
					parItem++
				}
				
				if ( menuParListNode.length == 1 )
				{
					paramsStrCode += "\t( flags := ALDATABASE_MENU_PAR_FLAGS_ENUM#PAR_ADDRESS_NONE, ParAddress := 0, pParName := NULL, pParDescription := NULL, pParFormat := NULL, pParUm := NULL )\n"
				}
				
				paramsStrCode += "];\n\n"
				
				paramListAddrByMenu[ subMenuName ] = {}
				paramListAddrByMenu[ subMenuName ].address = "?" + subMenuParListName
				paramListAddrByMenu[ subMenuName ].numPars = menuParListNode.length
			}
			else
			{
				paramListAddrByMenu[ subMenuName ] = {}
				paramListAddrByMenu[ subMenuName ].address = "NULL"
				paramListAddrByMenu[ subMenuName ].numPars = 0
			}
			
			/*	generazione menu */
			
			var captionVar = "$$MENUCAPTION" + menuStrId + "_" + subItem
			var caption = childNode.getAttribute( "caption" )
			generationInfo.menusCaptionStrCode += ( captionVar + " : STRING[ " + caption.length + " ] := '" + caption + "';\n" )
			
			//	push menu
			generationInfo.menusIndex.push( "$$MENU" + menuStrId + "[" + subItem + "]" )
			
			//	processa ricorsivamente tutti i menu
			
			var numSubMenus = childNode.selectNodes( "menu" ).length
			if ( numSubMenus > 0 )
			{
				var subMenuAddress = "?" + subMenuName				
			}
			else
			{
				var subMenuAddress = "NULL"
			}
				
			menusStrCode += "\t( id := " + generationInfo.menuGlobalId + ", numPars := " + paramListAddrByMenu[ subMenuName ].numPars + ", numSubMenus := " + numSubMenus + ", caption := ?" + captionVar + ", pSubMenu := " + subMenuAddress + ", pParList := " + paramListAddrByMenu[ subMenuName ].address + " )"
			
			if ( subItem < (menuArrayLength - 1) )
				menusStrCode += ", (* " + childNode.getAttribute( "caption" ) + " *)\n"
			else
				menusStrCode += " (* " + childNode.getAttribute( "caption" ) + " *)\n"
			
			generationInfo.menuGlobalId++
			subItem++
		}
		
		if ( childNodes.length < menuArrayLength )
			menusStrCode += "\t( id := 16#FFFF, numPars := 0, numSubMenus := 0, caption := NULL, pSubMenu := NULL, pParList := NULL )\n"
			
		menusStrCode += "];\n\n"
		
		generationInfo.menusStrCode += ( paramsStrCode + menusStrCode )
	}	
	
	generationInfo.level--
	
	if ( generationInfo.level > 0 )
		generationInfo.itemId.pop()
}

function GenerateMenuIndex( generationInfo )
{
	var arraySize = generationInfo.menusIndex.length
	if ( arraySize == 1 ) arraySize++
	
	//	dichiarazione indice
	generationInfo.menusIndexStrCodeDecl = "(* Menu index list by menu id *)\n"
	generationInfo.menusIndexStrCodeDecl += "$$MENUINDEX : ARRAY[ 0.." + ( arraySize - 1 ) + " ] OF @ALDATABASE_MENU;\n"
	
	//	codice di inizializzazione
	generationInfo.menusIndexStrCodeInit = "\t(* Menu index initialization *)\n"	
	for ( var i = 0; i < generationInfo.menusIndex.length; i++ )
	{
		generationInfo.menusIndexStrCodeInit += "\t$$MENUINDEX[ " + i + " ] := ?" + generationInfo.menusIndex[ i ] + ";\t(* id = " + i + " *)\n"
	}
}

//	lista dei nomi parametri
function GenerateParamNamesList( parNameMap )
{
	strCode = "\n(* Param Names List *)\n"
	
	for ( var varName in parNameMap )
	{
		var value = parNameMap[ varName ]
		strCode += varName + " : STRING[" + value.length + "] := '" + value + "';\n"
	}
	
	return strCode
}

//	lista delle descrizioni parametri
function GenerateParamDescriptionList( parMap )
{
	strCode = "\n(* Param Description List *)\n"
	
	for ( var value in parMap )
	{
		var varName = parMap[ value ]
		strCode += varName + " : STRING[" + value.length + "] := '" + value + "';\n"
	}

	return strCode
}

//	lista dei format parametri
function GenerateParamFormatList( parMap )
{
	strCode = "\n(* Param Format List *)\n"
	
	for ( var value in parMap )
	{
		var varName = parMap[ value ]
		strCode += varName + " : STRING[" + value.length + "] := '" + value + "';\n"
	}

	return strCode
}

//	lista delle um parametri
function GenerateParamUmList( parMap )
{
	strCode = "\n(* Param Um List *)\n"
	
	for ( var value in parMap )
	{
		var varName = parMap[ value ]
		strCode += varName + " : STRING[" + value.length + "] := '" + value + "';\n"
	}

	return strCode
}

function GenerateMenuProgramHeader( root )
{
	// ottiene il nome del task a cui associare il ParDB
	var task = root.getAttribute("PLCTaskParDB")
	if (!task) // se non è specificato lo mette nel task "Init"
		task = "Init"
		
	return "PROGRAM $$InitMenus WITH " + task + ";\n\
\n\
PROGRAM $$InitMenus\n\
	{ HIDDEN:ON }\n\
	{ CODE:ST }\n\
	VAR\n\
		warningsKiller: BOOL;\n\
	END_VAR\n"
}

function GenerateMenus( root, parDBMap )
{
	//	seleziona nodo menus
	var menusNode = root.selectSingleNode(PATH_MENUS_NODE)
	
	var generationInfo = {}
	generationInfo.itemId = []			//	lista indicizzazione menu
	generationInfo.level = 0			//	livello di profondita del menu
	generationInfo.menuGlobalId = 1		//	global menu id
	generationInfo.menusStrCode = ""	//	codice generazione menu
	generationInfo.menusCaptionStrCode = "(* Menu name list *)\n$$MENUCAPTION_ALLPARAMETERS : STRING[14] := 'All parameters';\n"
	generationInfo.menusIndex = []		//	lista dell'indice dei menu
	generationInfo.menusIndex.push( "$$MENU_ALLPARAMETERS" )	//	primo menu
	generationInfo.parNameMap = {}			//	lista nomi parametri
	generationInfo.parDescriptionMap = {}	//	mappa descrizione parametri
	generationInfo.parDescriptionNum = 0	//	numero descrizioni
	generationInfo.parFormatMap = {}		//	mappa format parametri
	generationInfo.parFormatNum = 0			//	numero format
	generationInfo.parUmMap = {}			//	mappa um parametri
	generationInfo.parUmNum = 0				//	numero um
	generationInfo.parDBMap = parDBMap		//	mappa parametri db
	
	//	genera codice tabelle ricorsive e riempie indice
	GenerateMenu( root, menusNode, generationInfo, 0 )
	
	//	main menu all parameters	
	var pSubMenuStr = ""
	if ( generationInfo.menusStrCode == "" )
	{
		var pSubMenuStr = "NULL"
		var numSubMenus = 0
	}
	else
	{
		var pSubMenuStr = "?$$MENU"
		var numSubMenus = menusNode.selectNodes( "menu" ).length
	}
	generationInfo.menusStrCode += "$$MENU_ALLPARAMETERS : ALDATABASE_MENU := ( id := 0, numPars := 0, numSubMenus := " + numSubMenus + ", caption := ?$$MENUCAPTION_ALLPARAMETERS, pSubMenu := " + pSubMenuStr + ", pParList := NULL ); (* All parameters *)\n"
	
	//	indice dei menu
	GenerateMenuIndex( generationInfo )
	//	lista dei nomi parametri
	var parNamesStrCode = GenerateParamNamesList( generationInfo.parNameMap )
	//	lista delle descrizioni parametri
	var parDescriptionStrCode = GenerateParamDescriptionList( generationInfo.parDescriptionMap )
	//	lista dei format parametri
	var parFormatStrCode = GenerateParamFormatList( generationInfo.parFormatMap )
	//	lista delle um parametri
	var parUmStrCode = GenerateParamUmList( generationInfo.parUmMap )
	//	numero di voci nell'indice
	var strMenuItems = "$$MENUINDEX_ITEMS : UDINT := " + generationInfo.menuGlobalId + ";\n"
	
	var code = ""
	if ( generationInfo.menusStrCode != "" )
	{
		code += "VAR_GLOBAL CONSTANT\n"
		code += generationInfo.menusCaptionStrCode
		code += parNamesStrCode
		code += parDescriptionStrCode
		code += parFormatStrCode
		code += parUmStrCode
		code += strMenuItems
		code += "END_VAR\n"
		code += "\n"
		code += "VAR_GLOBAL\n"
		code += "\n"
		code += generationInfo.menusStrCode
		code += "\n"
		code += generationInfo.menusIndexStrCodeDecl
		code += "\n"
		code += "END_VAR\n"
		code += "\n"
	}

	code += GenerateMenuProgramHeader( root )
	
	if ( generationInfo.menusStrCode != "" )
	{
		code += generationInfo.menusIndexStrCodeInit
	}

	code += "\n\twarningsKiller := sysDBase_SetExtMenus( TO_DWORD( ADR( $$MENUINDEX ) ), $$MENUINDEX_ITEMS );\n"
	code += "END_PROGRAM\n\n"
	
	return code
}

//	generate enums
#include AlDatabase_cfg_enums.js

// generazione database parametri
function BuildCfg_Database(root, calculateCRC32only, skipGenerateMenuID)
{
	var projectPath = app.CallFunction( "logiclab.get_ProjectPath" )
	if( ! projectPath || projectPath == "" )
		app.PrintMessage( "Cannot generate custom IEC code: invalid project path", enuLogLevels.LEV_ERROR )

	//	genero il tabellone binario nel formato del target
	ALDATABASE_IS_TARGET_BIG_ENDIAN = genfuncs.ParseBoolean( root.getAttribute( "IsTargetBigEndian" ) )

	// ---------------------------- generazione codice in ParDB.plc ------------------------------
	var fileNameDB = "ParDB.plc"
	try
	{
		var content = "(* Automatically generated, do not edit! *)\n\n"
		
		// nome del file PLK per ParDB
		var parDBPlk = GetPLCProjectPath()
		parDBPlk = parDBPlk.substr(0, parDBPlk.lastIndexOf(".")) + ".PLK"	
		
		// utilizzato per i menu (ogni voce in lista parametri di un menu punta al record della tabella parametri)
		var parDBMap = {}
		
		// generate enums definition code
		var enumDefsContent = GenerateEnums(root)
		if ( enumDefsContent != "" )
			content += enumDefsContent
		
		if (!calculateCRC32only && !skipGenerateMenuID)
			GenerateDatabaseMenuIDs(root);
		
		// dichiarazione   VAR_GLOBAL CONSTANT $$ParDB = ...
		var parDBSrc = GenerateParDB(root, parDBPlk, parDBMap, calculateCRC32only)
		var hasParDB = (parDBSrc != "")
		
		if (hasParDB)
			content += parDBSrc
		
		// genera albero menu
		var hasMenus = false
		if ( ALDATABASE_GENERATE_MENUS )
		{
			var menusSrc = GenerateMenus(root, parDBMap)
			var hasMenus = (menusSrc != "")
			if ( hasMenus )
				content += menusSrc
		}
			
		// dichiarazione   "PROGRAM InitParDB WITH Serv" e "PROGRAM InitParDB ...."
		content += GenerateDBParProgramHeader(root)

		/*
		// invoca la funzione per comunicare al firmware se il database scaricato è modbus compliant o free indexing
		if(IsModbusCompliantDatabase())
			content += "\n\twarningsKiller := sysDBase_SetDBModbusCompliant( TRUE );\n"
		else
			content += "\n\twarningsKiller := sysDBase_SetDBModbusCompliant( FALSE );\n"
		*/
		
		if (hasParDB)
		{
			// il calcolo del crc di questa parte serve a vedere se ci sono state modifiche sulla definizione parametri.
			// nel caso di modifiche il crc diverso, assegnato alla variabile plc dummyCrc32 causa la notifica dello status di modifica del task di init.
			// se il codice associato al task di init e' modificato e viene scaricato il plc in modalita' hotswap viene forzato uno scaricamento globale.
			// Un cambio del valore di init delle variabili non a' infatti sufficiente a settare il flag di modifica del task nei task control bit.
			var dummyCrc32 = app.CallFunction("commonDLL.CalcCRC32ForFile", parDBPlk)
			dummyCrc32 = app.CallFunction("commonDLL.CalcCRC32ForData", content, dummyCrc32)
			
			if ( dummyCrc32 < 0 )
				dummyCrc32 = 0x100000000 + dummyCrc32		//	per avere valore UDINT: altrimenti mettendolo DINT esce un warning in preproc
			
			content += "\n\tdummyCrc32 := " + dummyCrc32 + ";\n"
			
			var addrE2db  = m_paramsE2_DataBlock.size  > 0 ? "TO_DWORD( ADR(" + m_paramsE2_DataBlock.toString(0)  + ") )" : 0
			var addrRAMdb = m_paramsRAM_DataBlock.size > 0 ? "TO_DWORD( ADR(" + m_paramsRAM_DataBlock.toString(0) + ") )" : 0
			
			content += genfuncs.FormatMsg("\n\twarningsKiller := sysDBase_SetExtTable( TO_DWORD( ADR($$ParDB) ), $$ParDBLength, %1, %2, %3, %4, %5, %6, %7, %8, %9 );\n",
				m_paramsE2_DataBlock.idx,  addrE2db,  m_paramsE2_DataBlock.size,  m_paramsE2_DataBlock.GetElemSize(),
				m_paramsRAM_DataBlock.idx, addrRAMdb, m_paramsRAM_DataBlock.size, m_paramsRAM_DataBlock.GetElemSize(), dummyCrc32 );
			
			//	can be compared in predownload with the value on the target
			m_databaseSignatureCRC32 = dummyCrc32
		}
		else
		{
			// anche se non db, chiama cmq la sysDBase_SetExtTable con tutti zeri (mettere PLC_BOOTED=true, letto da De!)
			content += "\n\tdummyCrc32 := 0;\n"
			content += "\n\twarningsKiller := sysDBase_SetExtTable( TO_DWORD( 0 ), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 );\n"
			
			m_databaseSignatureCRC32 = 0
		}
		
		if (calculateCRC32only)
		{
			//	esco dopo avere valorizzato m_databaseSignatureCRC32
			return
		}
		
		content += "\n\END_PROGRAM\n\n"

		app.CallFunction( "compiler.LogicLab_UpdatePLC", projectPath, fileNameDB, content, false, 1 )
		app.PrintMessage( "Created " + m_fso.GetParentFolderName( projectPath ) + "\\" + fileNameDB, enuLogLevels.LEV_INFO )
	}
	catch( error )
	{
		app.CallFunction( "compiler.LogicLab_UpdatePLC", projectPath, fileNameDB, "" )
		app.PrintMessage( "Cannot generate par DB (error message: " + error + ")", enuLogLevels.LEV_ERROR )
		return enuLogLevels.LEV_CRITICAL
	}
}

function CalculateCRC32Value(device)
{
	//	chiama la funzione di build con parametro calculateCRC32only = true
	BuildCfg_Database( device, true )
}

//	chiamato nella pre download
function InitDefaultValues_Database(device)
{
	//	questo è l'ipa da scriver per inizializzare i valori di default
	var IPA_SETDEFAULTSATSTARTUP
	var nodelist = genfuncs.SearchNodesWithAttribute( app.SelectNodesXML("/")[0], "IpaSetDefaultAtStartup", -1)
	if (nodelist.length == 1)
	{
		IPA_SETDEFAULTSATSTARTUP = parseInt( nodelist[0].getAttribute("IpaSetDefaultAtStartup") )
	}
	else	
	{
		app.PrintMessage( "Configuration error. Cannot find: IPA_SETDEFAULTSATSTARTUP", enuLogLevels.LEV_ERROR )
		return enuLogLevels.LEV_CRITICAL
	}
	
	//	signature
	var IPA_APPDATABASESIGNATURE
	var nodelist = genfuncs.SearchNodesWithAttribute( app.SelectNodesXML("/")[0], "IpaAppDatabaseSignature", -1)
	if (nodelist.length == 1)
	{
		IPA_APPDATABASESIGNATURE = parseInt( nodelist[0].getAttribute("IpaAppDatabaseSignature") )
	}
	
	var doInit = false
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var nodelist = app.SelectNodesXML("/" + targetID + "/config/params/param")			
	if (nodelist.length != 0)
	{
		//	nessun ipa con la signature da confrontare
		if ( !IPA_APPDATABASESIGNATURE )
		{
			doInit = true
		}
		else
		{
			if ( m_databaseSignatureCRC32 == undefined )
			{
				CalculateCRC32Value(device)
			}
			
			var targetSignature			
			
			// ottiene l'interfaccia IDeviceLink attiva da logiclab
			var devlink = app.CallFunction("logiclab.GetDeviceLink")
			if (!devlink)
				return enuLogLevels.LEV_CRITICAL
			
			try
			{
				targetSignature = devlink.Par(IPA_APPDATABASESIGNATURE, 0, gentypes.VARENUM.VT_UI4)
			}
			catch (ex)
			{
				app.PrintMessage( "Cannot compare signature with target" )
				
				targetSignature = 0xFFFFFFFF
			}
			// rilascia reference al devicelink e unlock della comunicazione (logiclab fa lock nella GetDeviceLink()!)
			devlink = undefined
			CollectGarbage()  // chiama subito il gc per forzare la release del devicelink
			app.CallFunction("logiclab.UnlockComm")
			
			if ( targetSignature == 0xFFFFFFFF )
			{
				//	cannot compare signature
				doInit = true
			}
			else if ( targetSignature == m_databaseSignatureCRC32 )
			{
				//	same signature
				doInit = false
			}
			else
			{
				//	different signature
				doInit = true
			}
		}
	}
	
	var result = enuLogLevels.LEV_OK
	if ( doInit )
	{
		// ottiene l'interfaccia IDeviceLink attiva da logiclab
		var devlink = app.CallFunction("logiclab.GetDeviceLink")
		if (!devlink)
			return enuLogLevels.LEV_CRITICAL
		
		var msg = app.Translate( "Init database with default values?" )
		
		//	default value is NO
		if (app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNO|0x100) == gentypes.MSGBOX.IDYES)
		{
			try
			{
				devlink.Par(IPA_SETDEFAULTSATSTARTUP, 0, gentypes.VARENUM.VT_UI1) = 1			
				result = enuLogLevels.LEV_OK
			}
			catch (ex)
			{
				app.PrintMessage( "Cannot write init database default values parameter" )
				result = enuLogLevels.LEV_CRITICAL
			}
		}
		
		// rilascia reference al devicelink e unlock della comunicazione (logiclab fa lock nella GetDeviceLink()!)
		devlink = undefined
		CollectGarbage()  // chiama subito il gc per forzare la release del devicelink
		app.CallFunction("logiclab.UnlockComm")
	}
	
	return result
}

// verifica coerenza tra file .PLK e dichiarazione variabili PLC nascoste nell'aux
// questo per prevenire casi di "disallineamento" non chiari e non identificati
function CheckParDBCoherence()
{
	var ParDB = app.CallFunction("logiclab.GetGlobalVariable", "$$ParDB")
	if (!ParDB)
		// nessun DB, ovvero nessun parametro
		return true
	
	var dbsize = app.CallFunction("common.FromSafeArray", ParDB.Dims)[0]
	
	var plkname = app.CallFunction("common.ChangeFileExt", GetPLCProjectPath(), "PLK")
	if (!m_fso.FileExists(plkname))
	{
		app.PrintMessage(app.Translate("WARNING: Missing ParDB PLK file. Please rebuild now to automatically re-generate it."))
		app.ModifiedFlag = true
		return false
	}
	
	var filesize = m_fso.GetFile(plkname).Size
	if (dbsize != filesize)
	{
		app.PrintMessage(app.Translate("WARNING: ParDB PLK file is not coherent. Please rebuild now to automatically re-generate it."))
		app.ModifiedFlag = true
		return false
	}
	
	return true
}

// cerca il nome del parametro con l'ipa indicato nel PCT indicato
function GetParName(xmlPCT, ipa)
{
	if (!xmlPCT) return ipa
	
	// carica dal vecchio PCT il nome del parametro BIOS
	var parNode = xmlPCT.selectSingleNode("/devicetemplate/deviceconfig/parameters/par[@ipa = " + ipa + "]")
	if (parNode)
		return parNode.getAttribute("name")
	else
		return ipa
}

// questione lunga e spinosa... metodo "moderno" nei browser è Array.isArray https://stackoverflow.com/questions/4775722/how-to-check-if-an-object-is-an-array
// ma qui non si può usare... usa una "euristica semplice"
// https://stackoverflow.com/questions/4775722/how-to-check-if-an-object-is-an-array
// http://web.mit.edu/jwalden/www/isArray.html
function IsArray(obj)
{
	return "length" in obj;
}

function CheckAddressRange(address, addressRange, quiet)
{
	var msg = "";
	
	// supportato addressRange sia singolo (oggetto con start e end), che array di range
	if (!IsArray(addressRange))
		addressRange = [ addressRange ];
	
	for (var i = 0; i < addressRange.length; i++)
	{
		if (address >= addressRange[i].start && address <= addressRange[i].end)
			return true;
		
		msg += (i ? "," : "") + addressRange[i].start + ".." + addressRange[i].end;
	}
	
	if (!quiet)
		app.MessageBox(app.Translate("Invalid address value! Must be in %1 range").replace("%1", msg), "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
	
	return false;
}

// cerca il primo address libero
function FindFreeAddress(addressRange, modbusDimension)
{
	var isModbusCompliant = app.CallFunction(app.CallFunction("logiclab.get_TargetID") + ".IsModbusCompliantDatabase")	
	
	if (!addressRange)
		return -1
		
	if(!modbusDimension)
		modbusDimension = 1
		
	var freeAddr = -1
	var used = {}
	var node
	
	// scorre tutti i parametri e status vars (gridDatapath finisce con /. quindi toglie l'ultimo carattere!)
	var nodelist = app.SelectNodesXML("//param")
	while (node = nodelist.nextNode())
	{
		var size = GetParamSize(node, isModbusCompliant)
		if (size == 0)
			size = 1  // se parametro vuoto lo considera cmq almeno da 1 registro!
		var address = parseInt(GetNodeText(node, "address"))
		
		for (var i = 0; i < size; i++)
			used[address + i] = true
	}
	
	// supportato addressRange sia singolo (oggetto con start e end), che array di range
	if (IsArray(addressRange))
	{
		for (var i = 0; i < addressRange.length; i++)
		{
			freeAddr = FindFreeAddressInRange(addressRange[i].start, addressRange[i].end, used, modbusDimension);
			if (freeAddr != -1)
				break;
		}
	}
	else
		 freeAddr = FindFreeAddressInRange(addressRange.start,addressRange.end,used,modbusDimension)
	
				
	return freeAddr	
}

function FindFreeAddressInRange(addressRangeStart,addressRangeEnd,used,modbusDimension)
{
	var freeAddr = -1
	
	for (var i = addressRangeStart; i <= addressRangeEnd; i++)
	{
		if (!used[i])
		{
			//devo trovare un buco di dimensioni sufficienti
			for (var z = 0; z < modbusDimension ; z++)
			{
				if (!used[i+z])
					freeAddr = i						
				else
				{
					freeAddr = -1
					break
				}
			}
			if(freeAddr != -1)
				return freeAddr				
			
		}
	}
	
	return freeAddr

}

function GetParamSize(node, isModbusCompliant)
{
	if (isModbusCompliant === undefined)
		isModbusCompliant = app.CallFunction(app.CallFunction("logiclab.get_TargetID") + ".IsModbusCompliantDatabase")	
	
	var typetarg = GetNode(node, "typetarg")
	if (!typetarg)
		return 0   // per parametri non assegnati
		
	var typepar = parseInt(GetNode(node, "typepar"))
	var arrsize = parseInt(GetNode(node, "size"))
	
	if (app.CallFunction("script.IsStandardTypePar", typepar))
		// se typepar standard tale tipo sarà usato anche per il typetarg, ne tiene conto per il calcolo della dimensione
		for (var i in TYPEPAR)
			if (TYPEPAR[i] == typepar)
			{
				typetarg = i
				break
			}
	
	if (isModbusCompliant)
	{
		if (typetarg == "STRING")
			arrsize++   // aggiunge terminatore
		else if (typetarg == "BOOL" || typetarg == "BYTE" || typetarg == "SINT")
			typetarg = "WORD"
		
		//	se db modbus calcola la size (in registri modbus a 16 bit) e determina il numero di registri contigui necessari
		var size = app.CallFunction("parameters.GetModbusObjectSizeFromIEC", typetarg, arrsize)
		if (size === undefined)
		{
			if (app.CallFunction("logiclab.GetEnumElements", typetarg))
				size = app.CallFunction("parameters.GetModbusObjectSizeFromIEC", "DINT");  // in LL gli enum sono sempre DINT
		}

		return size
	}
	else
	{
		if (typetarg == "STRING")
			arrsize = 1  // le stringhe sono come tipi elementari da 1 parametro
		
		return arrsize
	}
}

// funzione invocata da script.OnRefactoringMsg per rinomino istanze variabili dentro XML
function Refactor(deviceNode, objType, oldName, newName)
{
	var querylist = [
		"config/params/param/name",
		"config/paramsRO/param/name",
		"config/ioMappings/ioMappingsLocal/ioMapping/variable"
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

function ParSortFunc(par1, par2)
{					
	var order1 = parseInt(par1.index) * 256 + parseInt(par1.subindex)
	var order2 = parseInt(par2.index) * 256 + parseInt(par2.subindex)

	return order1 - order2
}

function GetParamList(excludeReadOnly, excludeTypeString, indexMin, indexMax)
{
	var nodelist, node
	var paramDBlist = []
	var targetID = app.CallFunction("logiclab.get_TargetID")
	
	var filtersList = []
	if ( excludeReadOnly )
		filtersList.push("readonly = '0'")
		
	if ( excludeTypeString )
		filtersList.push("typetarg != 'STRING'")
	
	var filter = ""
	if (filtersList.length != 0)
		filter = "[" + filtersList.join(" and ") + "]"

	// Parameter
	nodelist = app.SelectNodesXML("/" + targetID + "/config/params/param" + filter)
	while (node = nodelist.nextNode())
	{
			//	non inserisce parametro nella lista
		var index = parseInt( GetNode(node, "address") )
		if ( indexMin != undefined && index < indexMin )
			continue
		if ( indexMax != undefined && index > indexMax )
			continue
			
		paramDBlist.push( { 	ipa: GetNode(node, "ipa"),
								index: GetNode(node, "address"), 
								subindex: GetNode(node, "subindex"),
								type: GetNode(node, "typetarg"),
								name: GetNode(node, "name"),
								description: GetNode(node, "description"),
								readonly: GetNode(node, "readonly"),
								nodeXML : node } )
	}

	// Status variable
	nodelist = app.SelectNodesXML("/" + targetID + "/config/paramsRO/param" + filter)
	while (node = nodelist.nextNode())
	{
			//	non inserisce parametro nella lista
		var index = parseInt( GetNode(node, "address") )
		if ( indexMin != undefined && index < indexMin )
			continue
		if ( indexMax != undefined && index > indexMax )
			continue
		
		paramDBlist.push( {		ipa: GetNode(node, "ipa"),
								index: GetNode(node, "address"), 
								subindex: GetNode(node, "subindex"),
								type: GetNode(node, "typetarg"),
								name: GetNode(node, "name"),
								description: GetNode(node, "description"),
								readonly: GetNode(node, "readonly"),
								nodeXML : node } )
	}

	paramDBlist.sort( ParSortFunc )

	return paramDBlist
}

function GetParamMap(excludeReadOnly, excludeTypeString, indexMin, indexMax)
{
	var nodelist, node
	var paramDBmap = {}
	var targetID = app.CallFunction("logiclab.get_TargetID")
	
	var filtersList = []
	if ( excludeReadOnly )
		filtersList.push("readonly = '0'")
		
	if ( excludeTypeString )
		filtersList.push("typetarg != 'STRING'")
	
	var filter = ""
	if (filtersList.length != 0)
		filter = "[" + filtersList.join(" and ") + "]"

	// Parameter
	nodelist = app.SelectNodesXML("/" + targetID + "/config/params/param" + filter)
	while (node = nodelist.nextNode())
	{
			//	non inserisce parametro nella lista
		var index = parseInt( GetNode(node, "address") )
		if ( indexMin != undefined && index < indexMin )
			continue
		if ( indexMax != undefined && index > indexMax )
			continue
		
		var obj = { ipa: GetNode(node, "ipa"),
					index: GetNode(node, "address"), 
					subindex: GetNode(node, "subindex"),
					type: GetNode(node, "typetarg"),
					name: GetNode(node, "name"),
					description: GetNode(node, "description"),
					readonly: GetNode(node, "readonly"),
					nodeXML : node }
		
		var key = "0x" + parseInt(obj.index).toString(16) + "." + parseInt(obj.subindex).toString()
		paramDBmap[key] = obj
	}

	// Status variable
	nodelist = app.SelectNodesXML("/" + targetID + "/config/paramsRO/param" + filter)
	while (node = nodelist.nextNode())
	{
			//	non inserisce parametro nella lista
		var index = parseInt( GetNode(node, "address") )
		if ( indexMin != undefined && index < indexMin )
			continue
		if ( indexMax != undefined && index > indexMax )
			continue
		
		var obj = { ipa: GetNode(node, "ipa"),
					index: GetNode(node, "address"), 
					subindex: GetNode(node, "subindex"),
					type: GetNode(node, "typetarg"),
					name: GetNode(node, "name"),
					description: GetNode(node, "description"),
					readonly: GetNode(node, "readonly"),
					nodeXML : node }
		
		var key = "0x" + parseInt(obj.index).toString(16) + "." + parseInt(obj.subindex).toString()
		paramDBmap[key] = obj
	}

	return paramDBmap
}

function IsModbusCompliantDatabase()
{
	var isModbusCompliant = true	//	default, prima dell'introduzione del subindex era sempre cosi'
	try
	{
		var targetID = app.CallFunction("logiclab.get_TargetID")
		var configNodeList = app.SelectNodesXML("/" + targetID + "/config")
		var configNode = configNodeList.nextNode()
		var databaseDefinitionMode = parseInt( configNode.getAttribute( "databaseDefinitionMode" ) )
		if ( !databaseDefinitionMode )
			isModbusCompliant = true
		else
			isModbusCompliant = false
	}
	catch (ex){}
	
	return isModbusCompliant
}
