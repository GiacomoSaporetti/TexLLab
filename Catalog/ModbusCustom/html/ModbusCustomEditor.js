// estensione dei files template
var EXT_PCT = app.CallFunction("ModbusCustom.GetFileExtension")
// cartella contenente tutti i files custom
var CATALOG_DESTDIR = app.CallFunction("ModbusCustom.GetCatalogDestDir")

 // import tipi generici
var gentypes = app.CallFunction("common.GetGeneralTypes")
var MSGBOX = gentypes.MSGBOX
var enuLogLevels = gentypes.enuLogLevels
// import funzioni generiche
var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var GetNode = genfuncs.GetNode
var SetNode = genfuncs.SetNode
var ParseBoolean = genfuncs.ParseBoolean

var PROTOCOL_MODBUSRTU = "ModbusRTU_master"
var PROTOCOL_MODBUSTCP = "ModbusTCP_master"
var XPATH_DEVICEINFO_NAME = "/devicetemplate/deviceinfo/@name"
var XPATH_DEVICEINFO_ICON = "/devicetemplate/deviceinfo/@icon"
var XPATH_DEVICEINFO_CAPTION = "/devicetemplate/deviceinfo/@caption"
var XPATH_DEVICEINFO_DEVICEID = "/devicetemplate/deviceinfo/@deviceid"
var XPATH_DEVICEINFO_VERSION = "/devicetemplate/deviceinfo/@version"
var XPATH_DEVICEINFO_DESCRIPTION = "/devicetemplate/deviceinfo/description"
var XPATH_DEVICEINFO_EDITINGENABLED = "/devicetemplate/deviceinfo/@editingEnabled"
var XPATH_DEVICECONFIG_PARAMETERS = "/devicetemplate/deviceconfig/parameters"
var XPATH_DEVICECONFIG_PARAMETERS_NEXTIPA = "/devicetemplate/deviceconfig/parameters/@nextIpa"
var XPATH_TEMPLATEROOT = "/devicetemplate/plcconfig/datadef/xs:schema/xs:element/xs:complexType/xs:complexContent/xs:extension"
var XPATH_OVERLAPPEDMAPS = XPATH_TEMPLATEROOT + "/xs:attribute[@name='overlappedBitRegMaps']/@fixed"
var XPATH_MAXMSGSIZEBIT = XPATH_TEMPLATEROOT + "/xs:attribute[@name='maxMsgSizeBit']/@fixed"
var XPATH_MAXMSGSIZEREG = XPATH_TEMPLATEROOT + "/xs:attribute[@name='maxMsgSizeReg']/@fixed"
var XPATH_TREENODECAPTION = "/devicetemplate/plcconfig/hmi/tree/node/@caption"
var XPATH_TREENODEICON = "/devicetemplate/plcconfig/hmi/tree/node/@icon"
var XPATH_DEVICEINFO_PROTOCOLS = "/devicetemplate/deviceinfo/protocols"
var XPATH_DEVICEINFO_MODBUSRTU = "/devicetemplate/deviceinfo/protocols/protocol[. = '" + PROTOCOL_MODBUSRTU + "']"
var XPATH_DEVICEINFO_MODBUSTCP = "/devicetemplate/deviceinfo/protocols/protocol[. = '" + PROTOCOL_MODBUSTCP + "']"
var XPATH_USEWRITESINGLECOIL = XPATH_TEMPLATEROOT + "/xs:attribute[@name='useWriteSingleCoil']/@fixed"
var XPATH_USEWRITESINGLEREG = XPATH_TEMPLATEROOT + "/xs:attribute[@name='useWriteSingleReg']/@fixed"
var XPATH_ADDRESS_TYPE = XPATH_TEMPLATEROOT + "/xs:attribute[@name='addressType']/@fixed";
var XPATH_SWAPWORDSMODE = XPATH_TEMPLATEROOT + "/xs:attribute[@name='swapWordsMode']/@fixed";

var XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema";
var NODE_ELEMENT = 1;

var MODBUSADDRESSTYPE = {
	MODBUS: 0,
	JBUS: 1
};

var MODBUS_ADDRESS_OFFSET = app.CallFunction("script.GetModbusAddressOffset");
var MODBUS_ADDRESS_MIN = 1;
var MODBUS_ADDRESS_MAX = 65536;
var JBUS_ADDRESS_MIN = 0;
var JBUS_ADDRESS_MAX = 65535;
var ADDRESSTYPE_MODBUS = "modbus";
var ADDRESSTYPE_JBUS = "jbus";

var m_xmldoc
var m_filename
var m_modifiedFlag = false

// resetta nome di file corrente per forzare save as
function ResetFileName()
{
	m_filename = ""
}

// gestione flag di modifica documento (abbassato dal save)
function SetModifiedFlag(modif)
{
	if (modif == undefined) modif = true
	m_modifiedFlag = modif
	// aggiorna indicatore di modifica
	spnModif.innerText = m_modifiedFlag ? "*" : ""
}

function IsModified()
{
	return m_modifiedFlag
}

function InitXmlDoc()
{
	// apre documento template iniziale: modbus.templ
	m_xmldoc = app.CallFunction("common.CreateObject", "MSXML2.DOMDocument.6.0")
	m_xmldoc.async = false
		
	// aggiunge namespace per permettere query xpath sullo schema XSD
	var ns = m_xmldoc.getProperty("SelectionNamespaces")
	var nsToAdd = "xmlns:xs='http://www.w3.org/2001/XMLSchema'"
	if (ns.indexOf(nsToAdd) == -1)
		m_xmldoc.setProperty("SelectionNamespaces", ns + " " + nsToAdd)
}

function New()
{
	if (!PromptForSaving(true))
		return
		
	InitXmlDoc()
	
	if (!m_xmldoc.load(app.CatalogPath + CATALOG_DESTDIR + "\\modbus.templ"))
	{
		app.MessageBox("Error loading template 'modbus.templ' !", "", MSGBOX.MB_ICONERROR)
		return false
	}
	
	m_filename = ""
	SetModifiedFlag(false)
	
	// resetta i valori iniziali, in modbus.templ ci sono i placeholder $NAME$, $ID$, $ICON$
	SetNode(m_xmldoc, XPATH_DEVICEINFO_NAME, "")
	SetNode(m_xmldoc, XPATH_DEVICEINFO_ICON, "")
	SetNode(m_xmldoc, XPATH_DEVICEINFO_DEVICEID, "")
	// parte con il settaggio globale della suite
	SetNode(m_xmldoc, XPATH_ADDRESS_TYPE, (MODBUS_ADDRESS_OFFSET == MODBUSADDRESSTYPE.MODBUS) ? ADDRESSTYPE_MODBUS : ADDRESSTYPE_JBUS)
	
	UpdateHTMLData()
	ReloadGridData()
}

function OnBeforeLoad(filename)
{
	if (!app.CallFunction( "ModbusCustom.IsValidDestinationPath", filename ))
		return false
		
	return true
}

function DoOpen()
{
	if (!PromptForSaving(true))
		return
	
	var filter = "Device template files (*." + EXT_PCT + ")|*." + EXT_PCT + "|"
	var filename = app.CallFunction("extfunct.ShowOpenFileDlgEx", filter, EXT_PCT, app.CatalogPath + CATALOG_DESTDIR)
	if (!filename)
		return false
		
	return Open(filename)
}

function Open(filename)
{
	if (!OnBeforeLoad(filename))
		return false
		
	InitXmlDoc()
	
	//if (!m_xmldoc.load(app.CatalogPath + "ModbusCustom\\modbus.templ"))
	if (!m_xmldoc.load(filename))
	{
		New()
		return false
	}
	
	// se il file scelto ha protocolli che non siano modbus RTU o TCP non ne permette l'apertura in alcun caso
/*	var nodelist = app.SelectNodesXML("/deviceinfo/protocols/protocol[. != 'modbus_rtu' and . != 'modbus_tcp']")
	if (nodelist && nodelist.length != 0)
		result = false*/
	
	// il file PCT deve avere l'attributo <deviceinfo editingEnabled="true">
	result = GetNode(m_xmldoc, XPATH_DEVICEINFO_EDITINGENABLED)
	if (!result)
	{
		// blocca apertura del file
		app.MessageBox(app.Translate("This %1 file has not been created with ModbusCustomEditor\nand so can not be edited !").replace("%1", EXT_PCT), "", MSGBOX.MB_ICONERROR)
		New()
		return false
	}
	
	UpdateHTMLData()
	
	if (app.CallFunction("ModbusCustom.IsTmpPCTFile", filename))
	{
		var fso = app.CallFunction("common.CreateObject", "Scripting.FileSystemObject");
		fso.DeleteFile(filename);
		ResetFileName();
	}
	else
		m_filename = filename;
	
	ReloadGridData()
	return true
}

// legge i dati dal documento xml e valorizza la finestra html
function UpdateHTMLData()
{
	var name = GetNode(m_xmldoc, XPATH_DEVICEINFO_NAME)
	var deviceid = GetNode(m_xmldoc, XPATH_DEVICEINFO_DEVICEID)
	//var icon = GetNode(m_xmldoc, XPATH_DEVICEINFO_ICON)
	var descr = GetNode(m_xmldoc, XPATH_DEVICEINFO_DESCRIPTION)
	var version = GetNode(m_xmldoc, XPATH_DEVICEINFO_VERSION)
	var maxMsgSizeBit = GetNode(m_xmldoc, XPATH_MAXMSGSIZEBIT)
	var maxMsgSizeReg = GetNode(m_xmldoc, XPATH_MAXMSGSIZEREG)
	var overlapped = ParseBoolean(GetNode(m_xmldoc, XPATH_OVERLAPPEDMAPS))
	
	// verifica se esiste il nodo <xs:attribute name="useWriteSingleCoil"/>, se no lo aggiunge (è stato aggiunto dopo)
	var attr = GetNode(m_xmldoc, XPATH_USEWRITESINGLECOIL)
	if (attr == "")
	{
		var parent = m_xmldoc.selectSingleNode(XPATH_TEMPLATEROOT)
		var node = parent.appendChild(m_xmldoc.createNode(NODE_ELEMENT, "xs:attribute", XSD_NAMESPACE));
		node.setAttribute("name", "useWriteSingleCoil")
		node.setAttribute("type", "xs:boolean")
		attr = "false"
		node.setAttribute("fixed", attr)
	}
	var useWriteSingleCoil = ParseBoolean(attr)
	
	// verifica se esiste il nodo <xs:attribute name="useWriteSingleReg"/>, se no lo aggiunge (è stato aggiunto dopo)
	var attr = GetNode(m_xmldoc, XPATH_USEWRITESINGLEREG)
	if (attr == "")
	{
		var parent = m_xmldoc.selectSingleNode(XPATH_TEMPLATEROOT)
		var node = parent.appendChild(m_xmldoc.createNode(NODE_ELEMENT, "xs:attribute", XSD_NAMESPACE));
		node.setAttribute("name", "useWriteSingleReg")
		node.setAttribute("type", "xs:boolean")
		attr = "false"
		node.setAttribute("fixed", attr)
	}
	var useWriteSingleReg  = ParseBoolean(attr)
	
	// verifica se esiste il nodo <xs:attribute name="addressType"/>, se no lo aggiunge (è stato aggiunto dopo)
	var attr = GetNode(m_xmldoc, XPATH_ADDRESS_TYPE)
	if (attr == "")
	{
		var parent = m_xmldoc.selectSingleNode(XPATH_TEMPLATEROOT)
		var node = parent.appendChild(m_xmldoc.createNode(NODE_ELEMENT, "xs:attribute", XSD_NAMESPACE));
		node.setAttribute("name", "addressType")
		node.setAttribute("type", "xs:string")
		// setta in base all'impostazione globale della suite per retrocompatibilità
		attr = (MODBUS_ADDRESS_OFFSET == MODBUSADDRESSTYPE.MODBUS) ? ADDRESSTYPE_MODBUS : ADDRESSTYPE_JBUS;
		node.setAttribute("fixed", attr)
	}
	var addressType = attr;

	var attr = GetNode(m_xmldoc, XPATH_SWAPWORDSMODE)
	if (attr == "")
	{
		var parent = m_xmldoc.selectSingleNode(XPATH_TEMPLATEROOT)
		var node = parent.appendChild(m_xmldoc.createNode(NODE_ELEMENT, "xs:attribute", XSD_NAMESPACE));
		node.setAttribute("name", "swapWordsMode")
		node.setAttribute("type", "xs:integer")
		attr = "0"
		node.setAttribute("fixed", attr)
	}
	var swapWordsMode  = parseInt(attr);
	
	SetField("txtName", name)
	SetField("txtDeviceID", deviceid)
	SetField("txtIcon")
	SetField("txtComment", descr)
	SetField("txtVersion", version)
	SetField("txtMaxBit", maxMsgSizeBit)
	SetField("txtMaxReg", maxMsgSizeReg)
	SetField("chkOverlappedBitRegMaps", overlapped)
	SetField("chkUseWriteSingleCoil", useWriteSingleCoil)
	SetField("chkUseWriteSingleReg", useWriteSingleReg)
	SetField("radAddressTypeModbus", addressType == ADDRESSTYPE_MODBUS);
	SetField("radAddressTypeJbus", addressType == ADDRESSTYPE_JBUS);
	SetField("cmbSwapWordsMode", swapWordsMode);
	
	var node = m_xmldoc.selectSingleNode(XPATH_DEVICEINFO_MODBUSRTU)
	chkModbusRTU.checked = (node != null)
	node = m_xmldoc.selectSingleNode(XPATH_DEVICEINFO_MODBUSTCP)
	chkModbusTCP.checked = (node != null)
}

function EnableProtocol(protocol, enable)
{
	var parent = m_xmldoc.selectSingleNode(XPATH_DEVICEINFO_PROTOCOLS)
	var protNode = parent.selectSingleNode("protocol[. = '" + protocol + "']")
	
	if (enable && !protNode)
	{
		// creazione nuovo nodo <protocol>
		protNode = m_xmldoc.createElement("protocol")
		parent.appendChild(protNode).text = protocol
	}
	else if (!enable && protNode)
		// eliminazione nodo <protocol> esistente
		parent.removeChild(protNode)
		
	SetModifiedFlag(true)
}

// legge i dati dalla finestra html e li mette nel documento xml
function UpdateXMLData()
{
	// rimuove gli attributi <devicetemplate template="ModbusCustomEditor.pct" version="1.0">
	//m_xmldoc.documentElement.removeAttribute("template")
	//m_xmldoc.documentElement.removeAttribute("version")
	
	var name = GetField("txtName")
	var deviceid = GetField("txtDeviceID")
	//var icon = GetField("txtIcon")
	// per ora icona fissata
	var icon = "modbus.ico"
	var descr = GetField("txtComment")
	var version = GetField("txtVersion")
	var maxMsgSizeBit = GetField("txtMaxBit")
	var maxMsgSizeReg = GetField("txtMaxReg")
	var overlapped = GetField("chkOverlappedBitRegMaps")
	var useWriteSingleCoil = GetField("chkUseWriteSingleCoil")
	var useWriteSingleReg = GetField("chkUseWriteSingleReg")
	var addressType = GetField("radAddressTypeModbus") ? ADDRESSTYPE_MODBUS : ADDRESSTYPE_JBUS;
	var swapWordsMode = GetField("cmbSwapWordsMode");
	
	SetNode(m_xmldoc, XPATH_DEVICEINFO_NAME, name)
	SetNode(m_xmldoc, XPATH_DEVICEINFO_DEVICEID, deviceid)
	SetNode(m_xmldoc, XPATH_DEVICEINFO_ICON, icon)
	SetNode(m_xmldoc, XPATH_DEVICEINFO_DESCRIPTION, descr)
	SetNode(m_xmldoc, XPATH_DEVICEINFO_VERSION, version)
	SetNode(m_xmldoc, XPATH_MAXMSGSIZEBIT, maxMsgSizeBit)
	SetNode(m_xmldoc, XPATH_MAXMSGSIZEREG, maxMsgSizeReg)
	SetNode(m_xmldoc, XPATH_OVERLAPPEDMAPS, overlapped ? 1 : 0)
	SetNode(m_xmldoc, XPATH_USEWRITESINGLECOIL, useWriteSingleCoil ? 1 : 0)
	SetNode(m_xmldoc, XPATH_USEWRITESINGLEREG, useWriteSingleReg ? 1 : 0)
	SetNode(m_xmldoc, XPATH_ADDRESS_TYPE, addressType);
	SetNode(m_xmldoc, XPATH_SWAPWORDSMODE, swapWordsMode);
	
	// copia name in deviceinfo/@caption e tree/node/@caption
	SetNode(m_xmldoc, XPATH_DEVICEINFO_CAPTION, name)
	SetNode(m_xmldoc, XPATH_TREENODECAPTION, name)
	// copia icona in tree/node/@icon
	SetNode(m_xmldoc, XPATH_TREENODEICON, icon)
	
	// copia deviceid in #define _prefix_
	for (var node = m_xmldoc.firstChild; node != null; node = node.nextSibling)
		if (node && node.nodeType == 8)   // NODE_COMMENT=8
		{
			// cerca il primo figlio commento
			node.text = " #DEFINE PREFIX " + deviceid + " "
			break
		}
}

function DoSave()
{
	// aggiorna i campi da html a xml
	UpdateXMLData()
	
	// verifica prelimin
	if (Validate() == enuLogLevels.LEV_CRITICAL)
		return false
		
	var filename = m_filename
	if (!filename)
	{
		var initname = GetNode(m_xmldoc, XPATH_DEVICEINFO_DEVICEID) + "." + EXT_PCT
		
		var filter = "Device template files (*." + EXT_PCT + ")|*." + EXT_PCT + "|"
		var filename = app.CallFunction("extfunct.ShowSaveFileDlgEx", filter, EXT_PCT, initname, app.CatalogPath + CATALOG_DESTDIR)
		if (!filename)
			return false
	}
	
	return Save(filename)
}

function OnBeforeSave(filename)
{
	if (!app.CallFunction("ModbusCustom.IsValidDestinationPath", filename ))
		return false
		
	var name = GetNode(m_xmldoc, XPATH_DEVICEINFO_NAME)
	var version = GetNode(m_xmldoc, XPATH_DEVICEINFO_VERSION)
	var deviceid = GetNode(m_xmldoc, XPATH_DEVICEINFO_DEVICEID)	
	if (app.CallFunction("ModbusCustom.CheckCatalogDuplication", filename, name, version, deviceid) == enuLogLevels.LEV_CRITICAL)
		// dati non validi, annulla save
		return false
		
	return true
}

function Save(filename)
{
	if (!OnBeforeSave(filename))
		return false
	
	try
	{
		m_xmldoc.save(filename)
	}
	catch (ex)
	{
		app.MessageBox(app.Translate("Error saving file to ") + filename, "", MSGBOX.MB_ICONERROR)
		return false
	}
	
	m_filename = filename
	SetModifiedFlag(false)
	
	// memorizza il path del file PCT modificato nel catalogo
	app.TempVar("ModbusCustomEditor_catalogModified").push(filename)
	return true
}

function PromptForSaving(allowCancel)
{
	if (IsModified())
	{
		var flags = allowCancel ? MSGBOX.MB_YESNOCANCEL : MSGBOX.MB_YESNO
		var ris = app.MessageBox(app.Translate("File has been modified. Save changes?"), "", MSGBOX.MB_ICONQUESTION | flags)
		if (ris == MSGBOX.IDYES)
		{
			return DoSave()
		}
		else if (ris == MSGBOX.IDNO)
		{
			// non salvare modifiche, abbassa il flag
			SetModifiedFlag(false)
			return true
		}
		else
			return false
	}
	else
		// nessuna modifica
		return true
}

function IsPathRelative( path )
{
	if (path.substr(0, 1) == "\\" ||
		path.length >= 3 && path.substr( 1, 2 ) == ":\\")
		return false
	else
		return true
}

// dato un tipo par restituisce il numero di indirizzi modbus occupati
function GetModbusAddressSize(type)
{
	return (type == "int" || type == "unsignedInt" || type == "float") ? 2 : 1
}


// risultato ultima validazione
var m_ValidationResult = enuLogLevels.LEV_OK

function DoVerify()
{
	Validate()
}

// validazione dati prima del salvataggio
function Validate()
{
	// salva ultimo risultato e setta quello attuale a false
	var oldValidationResult = m_ValidationResult
	m_ValidationResult = enuLogLevels.LEV_CRITICAL

	// verifica validità name (non vuoto)
	var name = GetNode(m_xmldoc, XPATH_DEVICEINFO_NAME)
	if (!name)
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Empty device name"), XPATH_DEVICEINFO_NAME)
	
	// verifica validità version (non vuoto)
	var version = GetNode(m_xmldoc, XPATH_DEVICEINFO_VERSION)
	if (!version)
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Empty version value"), XPATH_DEVICEINFO_VERSION)
		
	var deviceid = GetNode(m_xmldoc, XPATH_DEVICEINFO_DEVICEID)
	if (!deviceid)
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Empty deviceID value"))
		
	// estrae flag di "overlapped"
	var overlappedBitRegMaps = ParseBoolean(GetNode(m_xmldoc, XPATH_OVERLAPPEDMAPS))
	
	var maxMsg = parseInt(GetNode(m_xmldoc, XPATH_MAXMSGSIZEREG))
	if (maxMsg > MAX_SIZE_REGISTERS)
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Max msg size for registers is ") + MAX_SIZE_REGISTERS)
	
	var maxMsg = parseInt(GetNode(m_xmldoc, XPATH_MAXMSGSIZEBIT))
	if (maxMsg > MAX_SIZE_BIT)
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Max msg size for bits is ") + MAX_SIZE_BIT)
	
	var addressType = GetNode(m_xmldoc, XPATH_ADDRESS_TYPE);
	var addressMin = (addressType == ADDRESSTYPE_MODBUS) ? MODBUS_ADDRESS_MIN : JBUS_ADDRESS_MIN;
	var addressMax = (addressType == ADDRESSTYPE_MODBUS) ? MODBUS_ADDRESS_MAX : JBUS_ADDRESS_MAX;
	
		
	// verifica validità di tutti i parametri
	var usedAddr_discreteInputs = {}
	var usedAddr_coils = {}
	var usedAddr_holdingRegs = {}
	var usedAddr_inputRegs = {}
	var usedAddr = {}
	
	var parlist = m_xmldoc.selectNodes(XPATH_DEVICECONFIG_PARAMETERS + "/par")
	var par
	var row = 0
	while (par = parlist.nextNode())
	{
		// verifica name non vuoto
		var name = par.getAttribute("name")
		if (!name)
			return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Empty parameter name"), XPATH_DEVICECONFIG_PARAMETERS, row, "@name")
		
		var type = par.getAttribute("typetarg")
		var readonly = genfuncs.ParseBoolean(par.getAttribute("readonly"));
		
		// verifica sovrapposizioni indirizzi
		var addessNode = par.selectSingleNode("protocol[@name='Modbus']/@commaddr")
		if (!addessNode) continue
		
		var address = parseInt(addessNode.text)
		if (! (address >= addressMin && address <= addressMax))
		{
			var msg = app.Translate("Invalid Modbus address (must be ") + addressMin + ".." + addressMax + ")"
			return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", msg, XPATH_DEVICECONFIG_PARAMETERS, row)
		}
		
		var size = GetModbusAddressSize(type)
		if (overlappedBitRegMaps)
		{
			// uso mappe specifiche per comando, per permettere indirizzi sovrapposti (specifica modbus originale)
			if (type == "digitalInput")
				var map = usedAddr_discreteInputs;
			else if (type == "digitalOutput")
				var map = usedAddr_coils;
			else if (readonly)
				var map = usedAddr_inputRegs;
			else
				var map = usedAddr_holdingRegs;
		}
		else
			// uso mappa unica (indirizzamento flat)
			var map = usedAddr
		
		for (var n = 0; n < size; n++)
			if (map[address + n])
				return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Overlapping address " + (address+n) + " for parameter " + name), XPATH_DEVICECONFIG_PARAMETERS, row, "@ipa")
			else
				map[address + n] = true
				
		row++
	}
	
	
	// ------------ fine verifica, tutto ok
	app.PrintMessage("--- Everything OK ! ---")
	m_ValidationResult = enuLogLevels.LEV_OK
	
//	if (oldValidationResult != enuLogLevels.LEV_OK)
		// se la validazione precedente era fallita rinfresca la pagina per rimuovere eventuali evidenziamenti
//		app.OpenWindow("mainpage", "", "")
		
	return enuLogLevels.LEV_OK
}

// conversione tipo IEC (stringa) in tipo parametro
function ConvertIECType(type, readOnly)
{
	switch (type)
	{
		case "BOOL":  return readOnly ? "digitalInput" : "digitalOutput"
		case "USINT": return "unsignedChar"
		case "INT":   return "short"
		case "UINT":  return "unsignedShort"
		case "DINT":  return "int"
		case "UDINT": return "unsignedInt"
		case "REAL":  return "float"
	}
}

/*
function OutputClick(idx, text, itemdata)
{
	if (!itemdata)
		return
		
	// setta le variabili temporanee con la posizione dell'errore
	app.TempVar("ErrorPath") = itemdata.fullPath
	app.TempVar("ErrorRow") = itemdata.row
	app.TempVar("ErrorCol") = itemdata.column

	// se specificata apre la pagina contenente l'elemento in errore
	app.OpenWindow("mainpage", "", "")
}*/

function AddLog(level, location, msg, fullPath, row, column)
{
/*	var itemdata = {}
	itemdata.fullPath = fullPath    // path del nodo xml dell'elemento da evidenziare (relativo a devicePath)
	itemdata.row = row              // se tabella, numero di riga del record in errore
	itemdata.column = column        // se tabella, nome della colonna del campo in errore
	
	if (location != "" && level != LEV_INFO)
		msg = "(" + location + ") " + msg*/
		
	app.PrintMessage(msg, level)
	
	if (level != enuLogLevels.LEV_INFO)
		app.MessageBox(msg, "", MSGBOX.MB_ICONEXCLAMATION)
	return level
}
