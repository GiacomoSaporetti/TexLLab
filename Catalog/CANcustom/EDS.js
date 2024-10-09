// estensione dei files template
var EXT_PCT = "PCT"
function SetFileExtension(ext)
	{ EXT_PCT = ext }
function GetFileExtension()
	{ return EXT_PCT }
	
// cartella contenente tutti i files custom
var CATALOG_DESTDIR = "CANCustom"
function SetCatalogDestDir(dir)
	{ CATALOG_DESTDIR = dir }
function GetCatalogDestDir()
	{ return CATALOG_DESTDIR }
	
function Init(param)
{
	return 1
}

var gentypes = app.CallFunction("common.GetGeneralTypes")
var MSGBOX = gentypes.MSGBOX

// costanti per fso.OpenTextFile
var ForReading = 1
var ForWriting = 2
var ForAppending = 8

// costanti per logging
var LEV_OK = 0
var LEV_INFO = 1
var LEV_WARNING = 2
var LEV_ERROR = 3
var LEV_CRITICAL = 4
var ADDLONGFUNC = "common.AddLog"
var SPLITFIELDPATHFUNC = "common.SplitFieldPath"

// funzione chiamata del menu
function Open_ImportEDS_Dlg()
{
	app.OpenWindow("importEDS", app.Translate("Import EDS"), "")
	// rifresca il CatalogList
	app.CallFunction("common.OnTreeClick")
}


// --------------------------------------- GESTIONE EDS ----------------------------------
var EDS = {
	OBJTYPE:  { NULL: 0, DOMAIN: 2, DEFTYPE: 5, DEFSTRUCT: 6, VAR: 7, ARRAY: 8, RECORD: 9 },
	ACCESS:   { rw: "rw", wo: "wo", ro: "ro", Const: "const", rw_inp: "rwr", rw_out: "rww" },
	DATATYPE: { BOOLEAN: 1, INTEGER8: 2, INTEGER16: 3, INTEGER32: 4, UNSIGNED8: 5, UNSIGNED16: 6, UNSIGNED32: 7, REAL32: 8, VISIBLE_STRING: 9, 
				OCTET_STRING: 0xA, UNICODE_STRING: 0xB, TIME_OF_DAY: 0xC, TIME_DIFFERENCE: 0xD,
				DOMAIN: 0xF, INTEGER24: 0x10, REAL64: 0x11, INTEGER40: 0x12, INTEGER48: 0x13, INTEGER56: 0x14, INTEGER64: 0x15, UNSIGNED24: 0x16,
				UNSIGNED40: 0x18, UNSIGNED48: 0x19, UNSIGNED56: 0x1A, UNSIGNED64: 0x1B,
				PDO_COMMUNICATION_PARAMETER: 0x20, PDO_MAPPING: 0x21, SDO_PARAMETER: 0x22, IDENTITY: 0x23 } 
}

function GetEDSEnums()
{
	return EDS
}

function PadZero(value, len)
{
	var pad = "00000000000000000000"
	var s = value.toString()
	if (s.length < len)
		s = pad.substr(0, len - s.length) + s
	return s
}

function GetEDSDate(d)
{
	return PadZero(d.getMonth()+1, 2) + "-" + PadZero(d.getDate(), 2) + "-" + PadZero(d.getYear(), 4)
}

function GetEDSTime(d)
{
	return PadZero(d.getHours() % 12, 2) + ":" + PadZero(d.getMinutes(), 2) + ( (d.getHours() < 12) ? "AM" : "PM" )
}

function IsComplexType(objtype)
{
	return (objtype == EDS.OBJTYPE.DEFSTRUCT || objtype == EDS.OBJTYPE.ARRAY || objtype == EDS.OBJTYPE.RECORD)
}

function GenerateEDSFile()
{
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var device = app.SelectNodesXML("/" + targetID)[0]
	
	// salva file EDS con il nome del progetto
	var filename = app.CallFunction("common.ChangeFileExt", app.CallFunction("logiclab.get_ProjectPath"), "EDS")
	
	if (WriteEDS(device, filename) != LEV_CRITICAL)
		return true
	else
		return false
}

function WriteEDS(device, filename)
{
	var ini = app.CallFunction("common.NewINI", filename)
	ini.putBlankSeparator = true
	ini.PutEDSObject = PutEDSObject
	ini.PutEDSObjectList = PutEDSObjectList
	
	var func = device.getAttribute("ExtensionName")
	if (!func || func == "")
	{
		var err = app.CallFunction(SPLITFIELDPATHFUNC, device)
		return app.CallFunction(ADDLONGFUNC, LEV_CRITICAL, "WriteEDS", "Extension not defined", err)
	}
	
	var info = app.CallFunction(func + ".GetEDSInfo", device)
	if (!info)
	{
		var err = app.CallFunction(SPLITFIELDPATHFUNC, device)
		return app.CallFunction(ADDLONGFUNC, LEV_CRITICAL, "WriteEDS", "Invalid CAN data", err)
	}
	
	var wshshell = new ActiveXObject("wscript.shell")
	var str, i, section
	
	// ---------- FileInfo
	ini.PutINIValue("FileInfo", "FileName", filename)
	ini.PutINIValue("FileInfo", "FileVersion", info.FileVersion)
	ini.PutINIValue("FileInfo", "FileRevision", info.FileRevision)
	ini.PutINIValue("FileInfo", "EDSVersion", info.EDSVersion)
	ini.PutINIValue("FileInfo", "Description", info.Description)
	ini.PutINIValue("FileInfo", "CreatedBy", info.CreatedBy)
	ini.PutINIValue("FileInfo", "CreationDate", GetEDSDate(info.CreationDateTime))
	ini.PutINIValue("FileInfo", "CreationTime", GetEDSTime(info.CreationDateTime))
	ini.PutINIValue("FileInfo", "ModifiedBy", wshshell.ExpandEnvironmentStrings("%USERNAME%"))
	ini.PutINIValue("FileInfo", "ModificationDate", GetEDSDate(new Date))
	ini.PutINIValue("FileInfo", "ModificationTime", GetEDSTime(new Date))
	
	// ---------- DeviceInfo
	ini.PutINIValue("DeviceInfo", "VendorName", info.VendorName)
	ini.PutINIValue("DeviceInfo", "ProductName", info.ProductName)
	
	ini.PutINIValue("DeviceInfo", "VendorNumber", toHex(info.VendorNumber)) // TODO oggetto
	ini.PutINIValue("DeviceInfo", "ProductNumber", info.ProductNumber) // TODO oggetto
	ini.PutINIValue("DeviceInfo", "RevisionNumber", toHex(info.RevisionNumber)) // TODO oggetto
	
	ini.PutINIValue("DeviceInfo", "OrderCode", info.OrderCode)
	ini.PutINIValue("DeviceInfo", "BaudRate_10", info.BaudRate_10 ? 1 : 0)
	ini.PutINIValue("DeviceInfo", "BaudRate_20", info.BaudRate_20 ? 1 : 0)
	ini.PutINIValue("DeviceInfo", "BaudRate_50", info.BaudRate_50 ? 1 : 0)
	ini.PutINIValue("DeviceInfo", "BaudRate_125", info.BaudRate_125 ? 1 : 0)
	ini.PutINIValue("DeviceInfo", "BaudRate_250", info.BaudRate_250 ? 1 : 0)
	ini.PutINIValue("DeviceInfo", "BaudRate_500", info.BaudRate_500 ? 1 : 0)
	ini.PutINIValue("DeviceInfo", "BaudRate_800", info.BaudRate_800 ? 1 : 0)
	ini.PutINIValue("DeviceInfo", "BaudRate_1000", info.BaudRate_1000 ? 1 : 0)
	ini.PutINIValue("DeviceInfo", "SimpleBootUpMaster", info.SimpleBootUpMaster ? 1 : 0)
	ini.PutINIValue("DeviceInfo", "SimpleBootUpSlave", info.SimpleBootUpSlave ? 1 : 0)
	ini.PutINIValue("DeviceInfo", "Granularity", info.Granularity)
	ini.PutINIValue("DeviceInfo", "DynamicChannelsSupported", info.DynamicChannelsSupported)
	ini.PutINIValue("DeviceInfo", "CompactPDO", info.CompactPDO)
	ini.PutINIValue("DeviceInfo", "GroupMessaging", info.GroupMessaging ? 1 : 0)
	ini.PutINIValue("DeviceInfo", "NrOfRXPDO", info.NrOfRXPDO)
	ini.PutINIValue("DeviceInfo", "NrOfTXPDO", info.NrOfTXPDO)
	ini.PutINIValue("DeviceInfo", "LSS_Supported", info.LSS_Supported ? 1 : 0)
	
	// ---------- Dummy
	if (info.Dummy != undefined)
	{
		for (i = 0; i < info.Dummy.length; i++)
			ini.PutINIValue("DummyUsage", "Dummy000" + (i+1), info.Dummy[i] ? 1 : 0)
	}
	
	// ---------- Comments
	if (info.Comments != undefined)
	{
		ini.PutINIValue("Comments", "Lines", info.Comments.length)
		for (i = 0; i < info.Comments.length; i++)
			ini.PutINIValue("Comments", "Line" + (i+1), info.Comments[i])
	}
	
	var tot = 0
	// ---------- MandatoryObjects
	tot += ini.PutEDSObjectList(info, "MandatoryObjects")
	// ---------- OptionalObjects
	tot += ini.PutEDSObjectList(info, "OptionalObjects")
	// ---------- ManufacturerObjects
	tot += ini.PutEDSObjectList(info, "ManufacturerObjects")
	
	ini.WriteINI()
	app.CallFunction(ADDLONGFUNC, LEV_INFO, "WriteEDS", "Created " + ini.path + " (" + tot + " objects)")
}

// aggiunge nell'ini la sezione contenente gli oggetti nella lista specificata
function PutEDSObjectList(info, listname)
{
	var list = info[listname]
	this.PutINIValue(listname, "SupportedObjects", list.length)
	
	var i
	for (i = 0; i < list.length; i++)
	{
		var obj = list[i]
		this.PutINIValue(listname, i+1, toHex(obj.Index))

		this.PutEDSObject(obj)
	}
	
	return list.length
}

function PutEDSObject(obj, parentObj)
{
	var section = obj.Index.toString(16)
	if (parentObj)
		// se passato parentObj siamo in un SubObject
		section = parentObj + "sub" + section
		
	this.PutINIValue(section, "ParameterName", obj.ParameterName)
	
	// ObjectType per default è VAR
	var objtype = obj.ObjectType
	if (objtype == undefined)
		objtype = EDS.OBJTYPE.VAR
	this.PutINIValue(section, "ObjectType", toHex(objtype))

	if (obj.ObjFlags != undefined)
		this.PutINIValue(section, "ObjFlags", obj.ObjFlags)
	
	var iscomplex = IsComplexType(objtype)
	if (iscomplex && parentObj)
		// oggetti strutturati devono essere di primo livello
		return app.CallFunction(ADDLONGFUNC, LEV_CRITICAL, "PutEDSObject", "A SubObject can not be structured " + section)
	
	if (iscomplex && obj.SubObjects != undefined)
	{
		// oggetto complesso con SubObjects
		var subnumber = obj.SubObjects.length
		
		if (obj.SubObjects.length != 0 && obj.SubObjects[obj.SubObjects.length-1].Index == 0xFF)
			// il subobject FF (ultimo della lista se presente) non viene conteggiato nel totale
			subnumber--
		
		var autoSub0 = false
		var obj0 = obj.SubObjects[0]
		if (obj0 == undefined || obj0.Index != 0)
		{
			// se subobject 0 non presente lo scrive con valori di default
			obj0 = { Index: 0, ParameterName: "Number of Entries", DataType: EDS.DATATYPE.UNSIGNED8, AccessType: "ro", DefaultValue: subnumber }
			this.PutEDSObject(obj0, section)
			
			subnumber++
			autoSub0 = true
		}
		
		// subnumber è il numero di subobjects, inclusi lo 0 ed escluso il FF
		this.PutINIValue(section, "SubNumber", subnumber)
		
		// scrittura ricorsiva subobjects
		var maxsub = 0
		for (var i = 0; i < obj.SubObjects.length; i++)
		{
			var subobj = obj.SubObjects[i]
			this.PutEDSObject(subobj, section)
			
			if (subobj.Index > maxsub)
				// tiene traccia del più alto indice
				maxsub = subobj.Index
		}
		
		if (autoSub0)
			// se il sub0 è gestito automaticamente aggiorna il valore più alto di subobject
			this.PutINIValue(section + "sub0", "DefaultValue", maxsub)
	}
	else if (iscomplex && obj.SubObjects == undefined && obj.CompactSubObj == undefined)
	{
		// oggetto complesso non valido
		return app.CallFunction(ADDLONGFUNC, LEV_CRITICAL, "PutEDSObject", "Missing SubObjects for complex object " + section)
	}
	else
	{
		// oggetto semplice o complesso con ComplexSubObj
		if (!iscomplex && obj.SubObjects != undefined)
			return app.CallFunction(ADDLONGFUNC, LEV_CRITICAL, "PutEDSObject", "A simple DataType can not be structured " + section)
		else if (!iscomplex && obj.ComplexSubObj != undefined)
			return app.CallFunction(ADDLONGFUNC, LEV_CRITICAL, "PutEDSObject", "A simple DataType can not have ComplexSubObj" + section)
			
		// scrittura campi per oggetti semplici
		this.PutINIValue(section, "DataType", toHex(obj.DataType))
		this.PutINIValue(section, "AccessType", obj.AccessType)
		
		if (obj.DefaultValue != undefined)
			this.PutINIValue(section, "DefaultValue", obj.DefaultValue)
		if (obj.LowLimit != undefined)
			this.PutINIValue(section, "LowLimit", obj.LowLimit)
		if (obj.HighLimit != undefined)
			this.PutINIValue(section, "HighLimit", obj.HighLimit)
		if (obj.PDOMapping != undefined)
			this.PutINIValue(section, "PDOMapping", obj.PDOMapping ? 1 : 0)
			
		if (iscomplex && obj.ComplexSubObj != undefined)
			this.PutINIValue(section, "ComplexSubObj", obj.ComplexSubObj)
	}
}

// esamina ed esplode un oggetto di tipo complesso (avendo cioè tutti i subObjects definiti)
function ParseEDSComplexObject(obj)
{
	var numSubObj = parseInt(obj.SubNumber)
	if (!numSubObj)
	{
		app.PrintMessage("(GetEDSObjectList) Object " + obj.Index + ": SubNumber not found", LEV_WARNING)
		return
	}
	
	// scorre tutti i subobjects, ATTENZIONE: obj.SubNumber è il totale degli oggetti, non l'indice più alto
	obj.SubObjects = []
	var n, subidx, subobj
	for (n = 0, subidx = 0; n < numSubObj && subidx < 0xFF; subidx++)
	{
		subobj = this.GetEDSObject(obj.Index, subidx)
		if (subobj)
		{
			if (!subobj.ParameterName)
			{
				// se ParameterName non presente o non valorizzato usa quello del parent
				subobj.ParameterName = obj.ParameterName + "_" + subidx
				app.PrintMessage("(GetEDSObjectList) Object " + obj.Index + "." + toHex(subidx) + " : missing ParameterName, assuming " + subobj.ParameterName, LEV_WARNING)
			}
			
			obj.SubObjects.push(subobj)
			n++
		}
	}
	
	if (n != numSubObj)
		app.PrintMessage("(GetEDSObjectList) Object " + obj.Index + ": only " + n + " of " + numSubObj + " subObjects found", LEV_WARNING)
		
	// l'oggetto 255 non è conteggiato nei SubNumber, lo legge a parte
	subobj = this.GetEDSObject(obj.Index, 0xFF)
	if (subobj)
		obj.SubObjects.push(subobj)
}

// esamina ed esplode un oggetto compatto (che usa la sintassi CompactSubObj)
function ParseEDSCompactObject(obj)
{
	obj.SubObjects = []
	// crea l'oggetto subindex 0 che contiene il numero di oggetti
	obj.SubObjects.push( { Index: 0,  ParameterName: "NrOfObjects",  ObjectType: EDS.OBJTYPE.VAR, 
		DataType: EDS.DATATYPE.UNSIGNED8,  AccessType: "ro",  DefaultValue: obj.CompactSubObj  } )
	
	// legge la sezioni con i nomi alternativi se presente (name è minuscolo perchè viene fatto il lowercase di tutto all'inizio!)
	var compactNames = this.GetINISection(obj.Index.toString(16) + "name")
	
	// genera tutti i subobjects tutti uguali
	for (var n = 1; n <= obj.CompactSubObj && n < 256; n++)
	{
		var subobj = {
			Index: n,
			ObjectType: EDS.OBJTYPE.VAR,
			DataType: obj.DataType,
			AccessType: obj.AccessType,
			DefaultValue: obj.DefaultValue,
			PDOMapping: obj.PDOMapping
		}
		
		if (compactNames && compactNames[n])
			subobj.ParameterName = compactNames[n]
		else
			subobj.ParameterName = obj.ParameterName + n
			
		obj.SubObjects.push(subobj)
	}
}

function GetEDSObjectList(info, listname)
{
	var list = []
	
	var section = this.GetINISection(listname.toLowerCase())
	if (!section)
		return
	
	var i
	for (i in section)
	{
		if (i == "SupportedObjects")
			continue
			
		var index = parseInt(section[i])
		
		obj = this.GetEDSObject(index)
		if (!obj)
			continue
		
		var iscomplex = IsComplexType(obj.ObjectType)
		if (iscomplex)
		{
			if (obj.CompactSubObj != undefined)
				this.ParseEDSCompactObject(obj)
			else
				this.ParseEDSComplexObject(obj)
		}
		
		list.push(obj)
	}
	
	info[listname] = list
}

function GetEDSObject(index, subindex)
{
	var obj = new Object
	if (subindex != undefined)
		obj.Index = subindex
	else
		obj.Index = index
	
	//	nella forma [XXXXsubY]
	var sectionName = index.toString(16)
	if (subindex != undefined)
		sectionName += "sub" + subindex.toString(16)
	
	var section = this.GetINISection(sectionName)

	//	provo anche nella forma nella forma [XXXXsub0Y]
	if (!section && subindex != undefined && subindex < 10)
	{
		var sectionName = index.toString(16)
		if (subindex != undefined)
			sectionName += "sub0" + subindex.toString(16)
		
		var section = this.GetINISection(sectionName)
	}
	
	if (!section)
		return
		
	var i
	for (i in section)
	{
		if (i == "ObjectType" || i == "DataType" || i == "ObjFlags" || i == "CompactSubObj")
			// conversione campi interi
			obj[i] = parseInt(section[i])
		else if (i == "PDOMapping")
			// conversione campi bool
			obj[i] = ParseBoolean(section[i])
		else
			// altri campi stringa
			obj[i] = section[i]
	}
	
	// se objecttype non presente, oggetto di primo livello ma con subobjects sottointende sia un array
	if (obj.ObjectType == undefined && subindex == undefined && obj.SubNumber != 0)
	{
		app.PrintMessage("(GetEDSObject) Object " + sectionName + ": ObjectType not found, assuming ARRAY", LEV_WARNING)
		obj.ObjectType = EDS.OBJTYPE.ARRAY
	}

	return obj
}

function FindEDSObject(list, index, subindex)
{
	var i, j
	for (var i = 0; i < list.length; i++)
		if (list[i].Index == index)
		{
			if (subindex == undefined)
				return list[i]
				
			var subobj = list[i].SubObjects
			for (var j = 0; j < subobj.length; j++)
				if (subobj[j].Index == subindex)
					return subobj[j]
			
			break
		}
}

function ReadEDS(edspath)
{
	var info = new Object
	
	var i, j, obj
	
	var ini = app.CallFunction("common.ReadINI", edspath)
	if (!ini)
	{
		app.PrintMessage("(ReadEDS) Error reading EDS file " + edspath, LEV_ERROR)
		return
	}
	ini.GetEDSObject = GetEDSObject
	ini.GetEDSObjectList = GetEDSObjectList
	ini.ParseEDSCompactObject = ParseEDSCompactObject
	ini.ParseEDSComplexObject = ParseEDSComplexObject
		
	info.Description = ini.GetINIValue("FileInfo", "Description")
	info.FileVersion = ini.GetINIValue("FileInfo", "FileVersion")
	info.FileRevision = ini.GetINIValue("FileInfo", "FileRevision")
	info.EDSVersion = ini.GetINIValue("FileInfo", "EDSVersion")
	info.CreatedBy = ini.GetINIValue("FileInfo", "CreatedBy")
	info.CreationDateTime = new Date
	
	info.ProductName = ini.GetINIValue("DeviceInfo", "ProductName")
	info.VendorName  = ini.GetINIValue("DeviceInfo", "VendorName")
	info.VendorNumber   = parseInt(ini.GetINIValue("DeviceInfo", "VendorNumber"))
	info.ProductNumber  = parseInt(ini.GetINIValue("DeviceInfo", "ProductNumber"))
	info.RevisionNumber = parseInt(ini.GetINIValue("DeviceInfo", "RevisionNumber"))
	info.OrderCode = ini.GetINIValue("DeviceInfo", "OrderCode")
	info.DynamicChannelsSupported = ini.GetINIValue("DeviceInfo", "DynamicChannelsSupported")
	info.CompactPDO   = ini.GetINIValue("DeviceInfo", "CompactPDO")
	info.BaudRate_10   = ParseBoolean(ini.GetINIValue("DeviceInfo", "BaudRate_10"))
	info.BaudRate_20   = ParseBoolean(ini.GetINIValue("DeviceInfo", "BaudRate_20"))
	info.BaudRate_50   = ParseBoolean(ini.GetINIValue("DeviceInfo", "BaudRate_50"))
	info.BaudRate_125  = ParseBoolean(ini.GetINIValue("DeviceInfo", "BaudRate_125"))
	info.BaudRate_250  = ParseBoolean(ini.GetINIValue("DeviceInfo", "BaudRate_250"))
	info.BaudRate_500  = ParseBoolean(ini.GetINIValue("DeviceInfo", "BaudRate_500"))
	info.BaudRate_800  = ParseBoolean(ini.GetINIValue("DeviceInfo", "BaudRate_800"))
	info.BaudRate_1000 = ParseBoolean(ini.GetINIValue("DeviceInfo", "BaudRate_1000"))
	info.SimpleBootUpMaster = ParseBoolean(ini.GetINIValue("DeviceInfo", "SimpleBootUpMaster"))
	info.SimpleBootUpSlave  = ParseBoolean(ini.GetINIValue("DeviceInfo", "SimpleBootUpSlave"))
	
	if (isNaN(info.VendorNumber))
		info.VendorNumber = 0
	if (isNaN(info.ProductNumber))
		info.ProductNumber = 0
	if (isNaN(info.RevisionNumber))
		info.RevisionNumber = 0
	
	info.Granularity = parseInt(ini.GetINIValue("DeviceInfo", "Granularity"))
	if (isNaN(info.Granularity))
	{
		app.PrintMessage("(ReadEDS) Granularity invalid or not found, assuming 8", LEV_WARNING)
		info.Granularity = 8
	}
	
	info.NrOfRXPDO = parseInt(ini.GetINIValue("DeviceInfo", "NrOfRXPDO"))
	if (isNaN(info.NrOfRXPDO))
	{
		app.PrintMessage("(ReadEDS) NrOfRXPDO invalid or not found, assuming 4", LEV_WARNING)
		info.NrOfRXPDO = 4
	}
	info.NrOfTXPDO = parseInt(ini.GetINIValue("DeviceInfo", "NrOfTXPDO"))
	if (isNaN(info.NrOfTXPDO))
	{
		app.PrintMessage("(ReadEDS) NrOfTXPDO invalid or not found, assuming 4", LEV_WARNING)
		info.NrOfTXPDO = 4
	}
	
	// lettura tutti i valori generali ?
	
	var section = ini.GetINISection("Comments")
	info.Comments = []
	for (i in section)
		if (i.toLowerCase() != "lines")
			info.Comments.push(section[i])
	
	// trasforma tutte le sezioni lette in lowercase
	for (i in ini.sections)
		if (i.toLowerCase() != i)
		{
			ini.sections[i.toLowerCase()] = ini.sections[i]
			delete ini.sections[i]
		}
	
	ini.GetEDSObjectList(info, "MandatoryObjects")
	ini.GetEDSObjectList(info, "OptionalObjects")
	ini.GetEDSObjectList(info, "ManufacturerObjects")
	
	// se gli identity objects non hanno i defaultValue usa quelli della deviceInfo
	obj = FindEDSObject(info.MandatoryObjects, 0x1018, 1)
	if (obj && !obj.DefaultValue)
	{
		app.PrintMessage("(ReadEDS) Object 1018sub1: DefaultValue not found, assuming VendorNumber", LEV_WARNING)
		obj.DefaultValue = info.VendorNumber
	}
	
	obj = FindEDSObject(info.MandatoryObjects, 0x1018, 2)
	if (obj && !obj.DefaultValue)
	{
		app.PrintMessage("(ReadEDS) Object 1018sub2: DefaultValue not found, assuming ProductNumber", LEV_WARNING)
		obj.DefaultValue = info.ProductNumber
	}
		
	obj = FindEDSObject(info.MandatoryObjects, 0x1018, 3)
	if (obj && !obj.DefaultValue)
	{
		app.PrintMessage("(ReadEDS) Object 1018sub3: DefaultValue not found, assuming RevisionNumber", LEV_WARNING)
		obj.DefaultValue = info.RevisionNumber
	}
	
	// lettura e generazione oggetti dummy
	info.DummyObjects = []
	info.Dummy = []
	
	var dummysection = ini.GetINISection("dummyusage")
	if (dummysection)
		for (dummy in dummysection)
		{
			if (ParseBoolean(dummysection[dummy]))
			{
				// crea pseudo-oggetto dummy del tipo corretto
				var obj = {
					ParameterName: dummy,
					Index: parseInt(dummy.substr(5)),
					ObjectType: EDS.OBJTYPE.VAR,
					DataType: parseInt(dummy.substr(5)),
					AccessType: EDS.ACCESS.rw,
					PDOMapping: true
				}
				info.DummyObjects.push(obj)
				info.Dummy.push(true)
			}
			else
				info.Dummy.push(false)
		}
		
	return info
}

function GetNameFromEDS(info)
{
	if (info.RevisionNumber & 0xFFFF0000)
		// word alta del revision number specificata: lo interpreta come alta.bassa come da specifica CANopen
		var arrRev = [info.RevisionNumber >> 16, info.RevisionNumber & 0xFFFF]
	else
		// solo revision number bassa: usa solo quello, altrimenti uscirebbe sempre 0.x
		var arrRev = [info.RevisionNumber]
	
	var result = {}
	result.revision = arrRev.join(".")
	result.name = info.ProductName
	
	// sostituisce nello shortname i caratteri non validi ( ' ' . : / \)
	var s = app.CallFunction("common.NormalizeName", info.ProductName)
	result.shortName = s + "_" + arrRev.join("p")
	return result
}

function ImportEDS(info, name, version, shortname, hasDynPDO, templSuffix, hasBootUpMsg)
{
	var s, i, j, obj
	
	if (!info)
		return false
	
	
	var fso = new ActiveXObject("Scripting.FileSystemObject")
	var catPath = app.CatalogPath
	var path = catPath + "\\" + CATALOG_DESTDIR + "\\"
	var pathPCT = path + shortname + "." + EXT_PCT
	
	if (templSuffix)
		var filename = "custom_" + templSuffix + ".templ"
	else
		var filename = "custom.templ"

	// msg per conferma sovrascrittura file esistente
	if (fso.FileExists(pathPCT))
		if (app.MessageBox(app.Translate("File %1 already exists.\nProceed and overwrite it?").replace("%1",shortname + "." + EXT_PCT), "", MSGBOX.MB_ICONEXCLAMATION|MSGBOX.MB_OKCANCEL) == MSGBOX.IDCANCEL)
			return false
	
	// apertura files
	try
	{
		var fIn = fso.OpenTextFile(path + filename, ForReading)
		var fOut = fso.CreateTextFile(pathPCT, true)
	}
	catch (e)
	{
		app.MessageBox(app.Translate("ERROR while opening or creating file: ") + e)
		return false
	}
	
	// sostituzione di tutte le stringhe $CUSTOM$ con il nome del device
	while (!fIn.AtEndOfStream)
	{
		s = fIn.ReadLine()
		s = s.replace(/\$NAME\$/g, name)
		s = s.replace(/\$VERSION\$/g, version)
		s = s.replace(/\$PREFIX\$/g, "CANcustom_" + shortname)
		fOut.WriteLine(s)
	}
	
	fIn.Close()
	fOut.Close()
	
	
	// caricamento documento PCT
	var xmldoc = new ActiveXObject("Msxml2.DOMDocument.6.0")
	if (!xmldoc.load(pathPCT))
	{
		app.PrintMessage("(ImportEDS) Can not load PCT file " + pathPCT, LEV_ERROR)
		return false
	}

	
	// radice dei parametri gfexpress
	var parRoot = xmldoc.selectSingleNode("/devicetemplate/deviceconfig/parameters")
	if (!parRoot) return
	
	// aggiunta dei parametri
	AddParList(xmldoc, parRoot, info.MandatoryObjects)
	if ( info.OptionalObjects ) 
		AddParList(xmldoc, parRoot, info.OptionalObjects)
	if ( info.ManufacturerObjects )
		AddParList(xmldoc, parRoot, info.ManufacturerObjects)
	if ( info.DummyObjects )
		AddParList(xmldoc, parRoot, info.DummyObjects)
	
	// settaggio customconfig per canopen
	var node = xmldoc.selectSingleNode("/devicetemplate/customconfig/canopen")
	if (node)
	{
		node.setAttribute("numPDORx", info.NrOfRXPDO)
		node.setAttribute("numPDOTx", info.NrOfTXPDO)
		node.setAttribute("hasDynamicPDO", hasDynPDO ? 1 : 0)
		node.setAttribute("granularity", info.Granularity)
		node.setAttribute("hasBootUpMsg", hasBootUpMsg ? 1 : 0)
	}

	// salva con pretty-print, il caricamento è MOLTO più veloce
	app.CallFunction("common.WriteXML", xmldoc, pathPCT, true)
	
	// reset cache catalogo
	app.CallFunction("catalog.ResetCache", "")
	
	return true
}

function AddParList(xmldoc, parRoot, objlist)
{
	for (var i = 0; i < objlist.length; i++)
	{
		var obj = objlist[i]
		
		var iscomplex = IsComplexType(obj.ObjectType)
		if (iscomplex)
		{
			// oggetto complesso, aggiunge i subobjects
			for (var j = 0; j < obj.SubObjects.length; j++)
				AddPar(xmldoc, parRoot, obj.SubObjects[j], obj)
		}
		else
			AddPar(xmldoc, parRoot, obj)
	}
}

function AddPar(xmldoc, parRoot, obj, parentObj)
{
	// costruisce l'indirizzo
	var address = ""
	if (parentObj)
		address = parentObj.Index.toString(16).toUpperCase() + "sub"
	address += obj.Index.toString(16).toUpperCase()
	
	// rende accesstype in lowercase per effettuare il confronto
	if (obj.AccessType)
		obj.AccessType = obj.AccessType.toLowerCase()
	
	if (m_EDSTypeToPar[obj.DataType] == undefined)
	{
		// tipo non supportato, cerca il nome
		var typename
		for (i in EDS.DATATYPE)
			if (EDS.DATATYPE[i] == obj.DataType)
			{
				typename = i
				break
			}
		app.PrintMessage("(ImportEDS) Object " + address + ": EDS DataType '" + typename + "' (" + obj.DataType + ") not supported", LEV_ERROR)
		return
	}
		
	var par = xmldoc.createElement("par")
	par.setAttribute("ipa", parRoot.childNodes.length)
	par.setAttribute("readonly", (obj.AccessType == EDS.ACCESS.ro || obj.AccessType == EDS.ACCESS.Const) ? "true" : "false")
	par.setAttribute("name", obj.ParameterName)
	par.setAttribute("typepar", m_EDSTypeToPar[obj.DataType])
	par.setAttribute("typetarg", m_EDSTypeToPar[obj.DataType])
	//par.setAttribute("descr", obj.ParameterName)
	par.setAttribute("shortdescr", address)
	
	if (obj.LowLimit != undefined)
	{
		if (obj.DataType == EDS.DATATYPE.REAL32 || obj.DataType == EDS.DATATYPE.REAL64)
		{
			if (!isNaN(parseFloat(obj.LowLimit)))
				par.setAttribute("min", parseFloat(obj.LowLimit))
		}
		else
		{
			if (!isNaN(parseInt(obj.LowLimit)))
				par.setAttribute("min", parseInt(obj.LowLimit))
		}
	}
	
	if (obj.HighLimit != undefined)
	{
		if (obj.DataType == EDS.DATATYPE.REAL32 || obj.DataType == EDS.DATATYPE.REAL64)
		{
			if (!isNaN(parseFloat(obj.HighLimit)))
				par.setAttribute("max", parseFloat(obj.HighLimit))
		}
		else
		{
			if (!isNaN(parseInt(obj.HighLimit)))
				par.setAttribute("max", parseInt(obj.HighLimit))
		}
	}
	
	if (obj.DefaultValue != undefined)
	{
		if (obj.DataType == EDS.DATATYPE.REAL32 || obj.DataType == EDS.DATATYPE.REAL64)
		{
			if (!isNaN(parseFloat(obj.DefaultValue)))
				par.setAttribute("defval", parseFloat(obj.DefaultValue))
		}
		else
		{
			if (!isNaN(parseInt(obj.DefaultValue)))
				par.setAttribute("defval", parseInt(obj.DefaultValue))
			else
				// stringa o altro tipo?
				par.setAttribute("defval", obj.DefaultValue)
		}
	}
	
	par.setAttribute("scale", 1)
	par.setAttribute("form", (obj.DataType == EDS.DATATYPE.REAL32) ? "%g" : "%d")
	par.setAttribute("offs", 0)
	
	parRoot.appendChild(par)
	
	// sottonodo menu
	var node = xmldoc.createElement("menu")
	node.setAttribute("id", 0)
	par.appendChild(node)

	// sottonodo protocol
	node = xmldoc.createElement("protocol")
	node.setAttribute("name", "CanOpen")
	if (parentObj)
	{
		node.setAttribute("commaddr", parentObj.Index)
		node.setAttribute("commsubindex", obj.Index)
	}
	else
	{
		node.setAttribute("commaddr", obj.Index)
		node.setAttribute("commsubindex", 0)
	}
	par.appendChild(node)
	
	// sottonodo option per AccessType (gf_express supporta solo readonly)
	if (obj.AccessType)
	{
		node = xmldoc.createElement("option")
		node.setAttribute("optid", "AccessType")
		node.nodeTypedValue = obj.AccessType
		par.appendChild(node)
	}
	
	// sottonodo option per PDOMapping
	if (obj.PDOMapping)
	{
		node = xmldoc.createElement("option")
		node.setAttribute("optid", "PDOMapping")
		node.nodeTypedValue = 1
		par.appendChild(node)
	}
}


var m_EDSTypeToPar =  { 1: "boolean", 2: "char", 3: "short", 4: "int", 5: "unsignedChar", 6: "unsignedShort", 7: "unsignedInt", 8: "float", 
						9: "stringex100", 0xA: "stringex100", 0xB: "stringex100" }
						
var m_ParToEDSType =  { "boolean": "BOOLEAN", "char": "INTEGER8", "short": "INTEGER16", "int": "INTEGER32", "unsignedChar": "UNSIGNED8", 
						"unsignedShort": "UNSIGNED16", "unsignedInt": "UNSIGNED32", "float": "REAL32", "string": "VISIBLE_STRING" }
/*
	DATATYPE: { BOOLEAN: 1, INTEGER8: 2, INTEGER16: 3, INTEGER32: 4, UNSIGNED8: 5, UNSIGNED16: 6, UNSIGNED32: 7, REAL32: 8, VISIBLE_STRING: 9, 
				OCTET_STRING: 0xA, UNICODE_STRING: 0xB, TIME_OF_DAY: 0xC, TIME_DIFFERENCE: 0xD,
				DOMAIN: 0xF, INTEGER24: 0x10, REAL64: 0x11, INTEGER40: 0x12, INTEGER48: 0x13, INTEGER56: 0x14, INTEGER64: 0x15, UNSIGNED24: 0x16,
				UNSIGNED40: 0x18, UNSIGNED48: 0x19, UNSIGNED56: 0x1A, UNSIGNED64: 0x1B,
				PDO_COMMUNICATION_PARAMETER: 0x20, PDO_MAPPING: 0x21, SDO_PARAMETER: 0x22, IDENTITY: 0x23 } 
 */

 
 
 
 
 function toHex(s)
{
	return "0x" + s.toString(16).toUpperCase()
}

function toHex2(s)
{
	if (typeof s == "number")
		return "0x" + s.toString(16).toUpperCase()
	else if (s != undefined && s != null)
		return s.toString()
	else
		return s
}

function ParseBoolean(s)
{
	if (s == undefined || s == null || s == "")
		return false
	else if (s == "true" || s == "yes" || s == "1" || s == "TRUE" || s == "YES")
		return true
	else if (s != '' && !isNaN(parseInt(s)) && parseInt(s) != 0)
		return true
	else
		return false
}
