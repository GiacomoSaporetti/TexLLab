// estensione dei files template
var EXT_PCT = app.CallFunction("EDS.GetFileExtension")
// cartella contenente tutti i files custom
var CATALOG_DESTDIR = app.CallFunction("EDS.GetCatalogDestDir")

 // import tipi generici
var gentypes = app.CallFunction("common.GetGeneralTypes")
var MSGBOX = gentypes.MSGBOX
var enuLogLevels = gentypes.enuLogLevels
// import funzioni generiche
var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var GetNode = genfuncs.GetNode
var SetNode = genfuncs.SetNode
var ParseBoolean = genfuncs.ParseBoolean

var PROTOCOL_CANOPEN = "CANopen_master"
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
var XPATH_TREENODECAPTION = "/devicetemplate/plcconfig/hmi/tree/node/@caption"
var XPATH_TREENODEICON = "/devicetemplate/plcconfig/hmi/tree/node/@icon"
var XPATH_DEVICEINFO_PROTOCOLS = "/devicetemplate/deviceinfo/protocols"
var XPATH_DEVICEINFO_CANOPEN = "/devicetemplate/deviceinfo/protocols/protocol[. = '" + PROTOCOL_CANOPEN + "']"
var XPATH_CUSTOMCONFIG_CANOPEN_NUMPDOTX = "/devicetemplate/customconfig/canopen/@numPDOTx"
var XPATH_CUSTOMCONFIG_CANOPEN_NUMPDORX = "/devicetemplate/customconfig/canopen/@numPDORx"
var XPATH_CUSTOMCONFIG_CANOPEN_HASDYNAMICPDO = "/devicetemplate/customconfig/canopen/@hasDynamicPDO"
var XPATH_CUSTOMCONFIG_CANOPEN_GRANULARITY = "/devicetemplate/customconfig/canopen/@granularity"

var CANOPEN_ADDRESS_MIN = 1
var CANOPEN_ADDRESS_MAX = 65536
var CANOPEN_SUBINDEX_MIN = 0
var CANOPEN_SUBINDEX_MAX = 255

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
	// apre documento template iniziale: custom.templ
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
	
	if (!m_xmldoc.load(app.CatalogPath + CATALOG_DESTDIR + "\\custom_editor.templ"))
	{
		app.MessageBox("Error loading template 'custom_editor.templ' !", "", MSGBOX.MB_ICONERROR)
		return false
	}
	
	m_filename = ""
	SetModifiedFlag(false)
	
	// resetta i valori iniziali, in modbus.templ ci sono i placeholder $NAME$, $ID$, $ICON$
	SetNode(m_xmldoc, XPATH_DEVICEINFO_NAME, "")
	SetNode(m_xmldoc, XPATH_DEVICEINFO_ICON, "")
	SetNode(m_xmldoc, XPATH_DEVICEINFO_DEVICEID, "")
	
	UpdateHTMLData()
	ReloadGridData()
}

function OnBeforeLoad(filename)
{
	if (!app.CallFunction( "CANcustom.IsValidDestinationPath", filename ))
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
	
	//if (!m_xmldoc.load(app.CatalogPath + "CANcustom\\custom.templ"))
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
		app.MessageBox(app.Translate("This %1 file has not been created with CANcustomEditor\nand so can not be edited !").replace("%1", EXT_PCT), "", MSGBOX.MB_ICONERROR)
		New()
		return false
	}
	
	UpdateHTMLData()
	
	m_filename = filename
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
	var numPDOTx = GetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_NUMPDOTX)
	var numPDORx = GetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_NUMPDORX)
	var hasPDOMapping = GetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_HASDYNAMICPDO)
	var granularity = GetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_GRANULARITY)
	
	SetField("txtName", name)
	SetField("txtDeviceID", deviceid)
	SetField("txtIcon")
	SetField("txtComment", descr)
	SetField("txtVersion", version)
	SetField("txtNumPDOTx", numPDOTx)
	SetField("txtNumPDORx", numPDORx)
	SetField("chkDynamicPDOMapping", hasPDOMapping)
	SetField("txtGranularity", granularity)
}

// legge i dati dalla finestra html e li mette nel documento xml
function UpdateXMLData()
{
	// rimuove gli attributi <devicetemplate template="CANcustomEditor.pct" version="1.0">
	//m_xmldoc.documentElement.removeAttribute("template")
	//m_xmldoc.documentElement.removeAttribute("version")
	
	var name = GetField("txtName")
	var deviceid = GetField("txtDeviceID")
	//var icon = GetField("txtIcon")
	// per ora icona fissata
	var icon = "custom.ico"
	var descr = GetField("txtComment")
	var version = GetField("txtVersion")
	var numPDOTx = GetField("txtNumPDOTx")
	var numPDORx = GetField("txtNumPDORx")
	var hasPDOMapping = GetField("chkDynamicPDOMapping")
	hasPDOMapping = ( hasPDOMapping ? 1 : 0 )
	var granularity = GetField("txtGranularity")

	SetNode(m_xmldoc, XPATH_DEVICEINFO_NAME, name)
	SetNode(m_xmldoc, XPATH_DEVICEINFO_DEVICEID, deviceid)
	SetNode(m_xmldoc, XPATH_DEVICEINFO_ICON, icon)
	SetNode(m_xmldoc, XPATH_DEVICEINFO_DESCRIPTION, descr)
	SetNode(m_xmldoc, XPATH_DEVICEINFO_VERSION, version)
	SetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_NUMPDOTX, numPDOTx)
	SetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_NUMPDORX, numPDORx)
	SetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_HASDYNAMICPDO, hasPDOMapping)
	SetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_GRANULARITY, granularity)
	
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
		initname = initname.substr(10)  //salta il prefisso CANCustom
		
		var filter = "Device template files (*." + EXT_PCT + ")|*." + EXT_PCT + "|"
		var filename = app.CallFunction("extfunct.ShowSaveFileDlgEx", filter, EXT_PCT, initname, app.CatalogPath + CATALOG_DESTDIR)
		if (!filename)
			return false
	}
	
	return Save(filename)
}

function OnBeforeSave(filename)
{
	if (!app.CallFunction( "CANcustom.IsValidDestinationPath", filename ))
		return false
		
	var name = GetNode(m_xmldoc, XPATH_DEVICEINFO_NAME)
	var version = GetNode(m_xmldoc, XPATH_DEVICEINFO_VERSION)
	var deviceid = GetNode(m_xmldoc, XPATH_DEVICEINFO_DEVICEID)
	if (app.CallFunction( "CANcustom.CheckCatalogDuplication", filename, name, version, deviceid ) == enuLogLevels.LEV_CRITICAL)
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
	
	// alza il flag di modifiche al catalogo
	app.TempVar("CANcustomEditor_catalogModified") = true
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
		
	var numPDOTx = GetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_NUMPDOTX)
	if (!numPDOTx)
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Empty num PDO Tx value"))
	else if (isNaN(numPDOTx) || (numPDOTx < 0 || numPDOTx > 512) )
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Num PDO Tx value must be >= 0 and < 512"))
		
	var numPDORx = GetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_NUMPDORX)
	if (!numPDORx)
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Empty num PDO Rx value"))
	else if (isNaN(numPDORx) || (numPDORx < 0 || numPDORx > 512) )
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Num PDO Rx value must be >= 0 and < 512"))
		
	var hasDynamicPDO = GetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_HASDYNAMICPDO)
	if (!hasDynamicPDO)
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Has dynamic PDO value not specified"))
	else if (hasDynamicPDO != 0 && hasDynamicPDO != 1 )
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Bad Has dynamic PDO value"))
		
	var granularity = GetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_GRANULARITY)
	if (!granularity)
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Granularity value not specified"))
	else if ( isNaN(granularity) || !(granularity >= 0 && granularity <= 64 ) )
		return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", app.Translate("Granularity value must be >= 0 ans < 64"))
	
	var numPDORx = GetNode(m_xmldoc, XPATH_CUSTOMCONFIG_CANOPEN_NUMPDORX)
		
	// verifica validità di tutti i parametri
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
		
		// verifica index e subindex
		
		var indexNode = par.selectSingleNode("protocol[@name='CanOpen']/@commaddr")
		var subindexNode = par.selectSingleNode("protocol[@name='CanOpen']/@commsubindex")
		
		if (isNaN(indexNode.text))
		{
			var msg = app.Translate("Index is not a number")
			return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", msg, XPATH_DEVICECONFIG_PARAMETERS, row)
		}
		else
			var index = parseInt(indexNode.text)
		
		if (isNaN(subindexNode.text))
		{
			var msg = app.Translate("Indicated subIndex is not a number")
			return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", msg, XPATH_DEVICECONFIG_PARAMETERS, row)
		}
		else
			var subindex = parseInt(subindexNode.text)
			
		if (! (index >= CANOPEN_ADDRESS_MIN && index <= CANOPEN_ADDRESS_MAX))
		{
			var msg = app.Translate("Invalid CANOpen index (must be ") + CANOPEN_ADDRESS_MIN + ".." + CANOPEN_ADDRESS_MAX + ")"
			return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", msg, XPATH_DEVICECONFIG_PARAMETERS, row)
		}
		
		if (! (subindex >= CANOPEN_SUBINDEX_MIN && subindex <= CANOPEN_SUBINDEX_MAX) )
		{
			var msg = app.Translate("Invalid CANOpen subIndex (must be ") + CANOPEN_SUBINDEX_MIN + ".." + CANOPEN_SUBINDEX_MAX + ")"
			return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", msg, XPATH_DEVICECONFIG_PARAMETERS, row)
		}
		
		//	genera short descr
		
		var shortdescr = index.toString( 16 ) + "sub" + subindex.toString( 16 )
		SetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@shortdescr", shortdescr)
		
		var duplist = m_xmldoc.selectNodes(XPATH_DEVICECONFIG_PARAMETERS + "/par/protocol[@name='CanOpen' and @commaddr='" + index + "' and @commsubindex='" + subindex + "']")
		if ( duplist.length > 1 )
		{
			var msg = app.Translate("Duplicate object found " + shortdescr )
			return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", msg, XPATH_DEVICECONFIG_PARAMETERS, row)
		}
		
		//	genera readonly in base ad accesstype
		
		var accessType = par.selectSingleNode("option[@optid='AccessType']")

		if ( accessType.text == "ro" )
			SetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@readonly", "true")
		else
			SetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@readonly", "false")
		
		//	verifica defval
		
		var defval = par.getAttribute("defval")
		if ( defval == "" )
		{
			//var msg = app.Translate("Default value not specified")
			//return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", msg, XPATH_DEVICECONFIG_PARAMETERS, row)
		}
		else if ( defval.length > 0 && isNaN( defval ) && defval.substr(0, 7) != "$NODEID" )
		{
			var msg = app.Translate("Default value '" + defval + "' is not allowed")
			return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", msg, XPATH_DEVICECONFIG_PARAMETERS, row)
		}
		else if ( defval.length > 8 && !isNaN( defval) && defval.substr(0, 7) == "$NODEID" )
		{
			var error = true
			
			//	verifico se la sintassi $NODEID è corretta
			var splitted = defval.split( "+" )
			if ( String.trim( splitted( 0 ) ) == "$NODEID" )
			{
				if ( splitted( 1 ) != undefined )
				{
					if ( !IsNaN( String.trim( splitted( 1 ) ) ) )
					{
						error = false
					}
				}
			}
				
			if ( nodeIdError )
			{
				var msg = app.Translate("Check $NODEID syntax. Should be in the form $NODEID + 0x180.")
				return AddLog(enuLogLevels.LEV_CRITICAL, "Validate", msg, XPATH_DEVICECONFIG_PARAMETERS, row)
			}
		}
		
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
		case "BOOL":  return "boolean"
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
		
	if ( row != undefined )
		grid.Move( row, 0 )
		
	return level
}
