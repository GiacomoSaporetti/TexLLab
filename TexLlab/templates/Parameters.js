// import funzioni generiche
var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var ParseBoolean = genfuncs.ParseBoolean
var GetNode = genfuncs.GetNode
var GetNodeText = genfuncs.GetNodeText

var MB_READCOILSTATUS = 1
var MB_READINPUTSTATUS = 2
var MB_READHOLDINGREG = 3
var MB_READINPUTREG = 4
var MB_WRITESINGLECOIL = 5
var MB_WRITESINGLEREG = 6
var MB_WRITEMULTIPLECOILS = 15
var MB_WRITEMULTIPLEREG = 16
var MB_READWRITEMULTIPLEREG = 23


function Init(intf)
{
	return 1
}

function GetParTypeSize(type)
{
	switch (type)
	{
		case "digitalInput":	
		case "digitalOutput":	
		case "boolean":			
		case "byte":			
		case "char":			
		case "unsignedByte":	
		case "unsignedChar":	return 1
		case "short":			
		case "unsignedShort":	return 2
		case "float":			
		case "int":				
		case "unsignedInt":		return 4
		case "long":
		case "unsignedLong":
		case "double":		return 8
	}
}

// converte i tipi dei configuratori in iec
function ParTypeToIEC(type, format)
{
	if (type == "string" || type.substr(0, 8) == "stringex")
		return "STRING"
	else if (type.substr(0, 4) == "enum")
		return "DINT"
		
	var hex = (format == "%x" || format == "%X")
	
	switch (type)
	{
		case "byte":			
		case "char":			return "SINT"
		case "unsignedByte":	
		case "unsignedChar":	return hex ? "BYTE" : "USINT"
		case "short":			return "INT"
		case "unsignedShort":	return hex ? "WORD" : "UINT"
		case "int":				return "DINT"
		case "unsignedInt":		return hex ? "DWORD" : "UDINT"
		case "boolean":			return "BOOL"
		case "float":			return "REAL"
		case "double":			return "LREAL"
		case "long":			return "LINT"
		case "unsignedLong":	return hex ? "LWORD" : "ULINT"
		case "string4":			return "STRING"
		case "digitalInput":	return "BOOL"
		case "digitalOutput":	return "BOOL"
	}
	return ""
}



function AddToParList(nodeList, parList, loadCommAddr, commAddrMode)
{
	var node, obj, i

	// costruzione xpath per estrazione commAddr se richiesto
	if (loadCommAddr)
	{
		var commAddrQuery = "protocol[@name = '" + loadCommAddr + "'"
		if (commAddrMode)
			commAddrQuery += " and @mode = '" + commAddrMode + "']"
		else
			commAddrQuery += " and not(@mode)]"
	}
	
	nodeList.reset()
	while (node = nodeList.nextNode())
	{
		// non inserisce i parametri virtual, sono usati solo dagli script
		if (node.getAttribute("typetarg") == "virtual")
			continue
		
		obj = { name: node.getAttribute("name"), 
				description: node.getAttribute("descr"), 
				type: node.getAttribute("typetarg"), 
				readOnly: ParseBoolean(node.getAttribute("readonly")),
				ipa: parseInt(node.getAttribute("ipa")), 
				address: parseInt(node.getAttribute("ipa")), 
				min: node.getAttribute("min"), 
				max: node.getAttribute("max"),
				defaultValue: node.getAttribute("defval"),
				format: node.getAttribute("form"),
				typepar: node.getAttribute("typepar")
			}
		
		if (!obj.description)
			obj.description = node.getAttribute("shortdescr")  // se non c'è description usa la shortdescr (per tpd32)
		
		obj.typeIEC = ParTypeToIEC(obj.type, obj.format)
		// valori di default sicuri con l'ipa come indirizzo
		obj.commIndex = obj.address
		obj.commSubIndex = 0
		
		// se richiesto caricamento commaddr
		if (loadCommAddr)
		{
			// cerca il comaddr
			var commAddr = node.selectSingleNode(commAddrQuery)
			if (commAddr)
			{
				obj.commIndex = parseInt(commAddr.getAttribute("commaddr"))
				obj.commSubIndex = parseInt(commAddr.getAttribute("commsubindex"))
			}
		}
		
		if (loadCommAddr == "CanOpen")
		{
			// solo se canopen legge anche il valore dell'eventuale attributo PDOMapping (bool) e AccessType
			obj.PDOMapping = ParseBoolean(GetNodeText(node, "option[@optid = 'PDOMapping']"))
			obj.AccessType = GetNodeText(node, "option[@optid = 'AccessType']")
			// il campo realReadOnly su CAN non ha senso (serve solo in modbus per generazione files ICT), quindi risparmia tempo non leggendolo
			obj.realReadOnly = ""
			// la normalizzazione del nome non serve in CAN, il nome dell'oggetto è usato solo come descrizione
		}
		else
		{
			//obj.name = NormalizeVarName(obj.name)
			//obj.realReadOnly = GetNodeText(node, "option[@optid = 'realReadOnly']")
		}
			
		if (loadCommAddr == "Modbus" && obj.type == "boolean")
			// in modbus i tipi indicati come "boolean" in realtà sono scambiati come register a 16bit
			// i veri booleani sono i "digitalInput" scambiati come "discrete input" e i "digitalOutput" che sono scambiati come "coil"
			obj.type = "unsignedShort"
	
		parList.push(obj)
	}
}


// caricamento parametri dalla sezione devicetemplate
function LoadParameters(xmldoc, parList, loadCommAddr, commAddrMode)
{
	// parametri da aggiugnere
	var nodeList = xmldoc.selectNodes("/devicetemplate/deviceconfig/parameters/par")
	AddToParList(nodeList, parList, loadCommAddr, commAddrMode)
}

function AddToEnumMap(nodeList, enumMap)
{
	var values = {}	
	var elemNodes = node.selectNodes("elem")
	var elemNode
	while (elemNode = elemNodes.nextNode())
		values[elemNode.getAttribute("value")] = elemNode.getAttribute("descr")
	
	enumMap[node.getAttribute("id")] = values
}

// caricamento enums dalla sezione devicetemplate
function LoadEnums(xmldoc, enumMap)
{
	// parametri da aggiugnere
	var nodeList = xmldoc.selectNodes("/devicetemplate/deviceconfig/enums/enum")
	while (node = nodeList.nextNode())
		AddToEnumMap(nodeList, enumMap)
}

// dato un tipo par restituisce il numero di indirizzi modbus occupati
function GetModbusAddressSize(type)
{
	return (type == "int" || type == "unsignedInt" || type == "float") ? 2 : 1
}

// funzione modbus per leggere il tipo specificato
function GetModbusReadFunc(type, readonly)
{
	if (type == "digitalOutput")
		return MB_READCOILSTATUS  // Read coil status
	else if (type == "digitalInput")
		return MB_READINPUTSTATUS  // Read input status
	else if (!readonly)
		return MB_READHOLDINGREG  // Read Holding Registers 
	else
		return MB_READINPUTREG  // Read Input Registers
}

// ritorna il verso del tipo di funzione modbus
function GetModbusFuncIODirection(func)
{
	switch (parseInt(func))
	{
	case MB_READCOILSTATUS:
	case MB_READINPUTSTATUS:
	case MB_READHOLDINGREG:
	case MB_READINPUTREG:
		return "input"
	
	case MB_WRITESINGLECOIL:
	case MB_WRITEMULTIPLECOILS:
	case MB_WRITESINGLEREG:
	case MB_WRITEMULTIPLEREG:
		return "output"
	
	case MB_READWRITEMULTIPLEREG:
		return "inputoutput"
	}
}

// ritorna true se la funzione specificata opera su bit, false se su registri
function IsModbusBitFunc(func)
{
	return (func == MB_READCOILSTATUS || func == MB_READINPUTSTATUS || func == MB_WRITESINGLECOIL || func == MB_WRITEMULTIPLECOILS)
}

// restituisce il numero di registri modbus necessari per contenere il tipo IEC indicato
function GetModbusObjectSizeFromIEC(type, arrsize)
{
	if (!arrsize)
		arrsize = 1
	
	switch (type)
	{
	case "BOOL":
	case "SINT":
	case "USINT":
	case "BYTE":
		return Math.ceil(arrsize / 2) // i caratteri occupano mezza word modbus l'uno
	
	case "INT":
	case "UINT":
	case "WORD":
		return 1 * arrsize
	
	case "DINT":
	case "UDINT":
	case "DWORD":
	case "REAL":
	case "TIME":
		return 2 * arrsize
	
	case "LINT":
	case "ULINT":
	case "LWORD":
	case "LREAL":
		return 4 * arrsize
	
	case "STRING":
		return Math.ceil(arrsize / 2) // i caratteri occupano mezza word modbus l'uno
	}
}


var TREENAME = "tree1"
var m_translated = false;

// traduzione delle caption dei templatedata (da fare una tantum)
// nella Init() putroppo è troppo presto, non sono ancora presenti
function TranslateTemplateData()
{
	if (m_translated)
		return;
	
	var node = app.GetTemplateData("menu")[0];
	if(node && node.getAttribute("caption"))
		node.setAttribute("caption", app.Translate(node.getAttribute("caption")));
	
	// lo smart non ha questo templatedata, vedi parameters.pct
	var node = app.GetTemplateData("custompage")[0];
	if(node && node.getAttribute("caption"))
		node.setAttribute("caption", app.Translate(node.getAttribute("caption")));
	
	m_translated = true;
}


function AddMenu()
{
	TranslateTemplateData();
	
	// aggiunta nuovo menu sotto il nodo corrente (sarà "Menus")
	var curdata = app.HMIGetElementData(TREENAME, "")
	var datapath = app.AddTemplateData("menu", curdata, 0, false)
	
	// mette subito in editing la caption
	var itempath = app.HMIGetElementPath(TREENAME, datapath)
	if (itempath)
		app.HMIEditElement(TREENAME, itempath)
}

function AddCustomPage()
{
	TranslateTemplateData();
	
	var curdata = app.HMIGetElementData(TREENAME, "")
	var datapath = app.AddTemplateData("custompage", curdata, 0, false)
	
	// mette subito in editing la caption
	var itempath = app.HMIGetElementPath(TREENAME, datapath)
	if (itempath)
		app.HMIEditElement(TREENAME, itempath)
}

function OnEndMenuEdit(treepath, newtext)
{
	// rinfresca la finestra corrente per aggiornare il titolo
	var curdata = app.HMIGetElementData(TREENAME, treepath)
	
	// setta subito nel xml e rilegge per vedere se la validazione è andata a buon fine; se diversi no
	app.DataSet(curdata + "/@caption", 0, newtext)
	var validated = app.DataGet(curdata + "/@caption", 0)
	if (validated != newtext)
		return false
	
	app.HMISetCurElement(TREENAME, treepath)
	app.OpenWindow(app.HMIGetLinkedWindow(TREENAME, treepath), "", curdata)
}

function DeleteElement()
{
	// cancellazione nodo corrente
	var curdata = app.HMIGetElementData(TREENAME, "")
	app.DataDelete(curdata, 0)
	// va sulla pagina vuota
	app.OpenWindow("emptypage", "", "")
}


// ----------- aggiunta di un parametro a menu tramite dragdrop -----------
var DRAG_ROWSEP			= "\n"
var DRAG_SEP			= "|"
var DRAG_STRINGID		= "PAR"
var DRAG_ID				= 0
var DRAG_IPA			= 1
var DRAG_NUMELEMENTS	= 2

function BuildDragDropParams(params)
{
	var result = []
	for (var i = 0; i < params.length; i++)
		result.push(DRAG_STRINGID + DRAG_SEP + params[i])
	
	if (result.length != 0)
		return result.join(DRAG_ROWSEP)
	else
		return ""
}

function ParseDragDropParams(str)
{
	var result = []
	
	var lines = str.split(DRAG_ROWSEP)
	for (var i = 0; i < lines.length; i++)
	{
		// split e verifica validità stringa
		var arr = lines[i].split(DRAG_SEP)
		if (arr.length != DRAG_NUMELEMENTS || arr[DRAG_ID] != DRAG_STRINGID)
			return
		
		var newitem = parseInt(arr[DRAG_IPA])
		result.push(newitem)
	}
	return result
}

// aggiunta di un parametro a menu tramite dragdrop (STRUTTURA NUOVA DI PARAMETERS2.PCT !)
// vecchi target usano funzione dentro script PREFIX
function OnDropAppMenu(txt, treepath)
{
	// datapath e device destinazione del drop
	var curdata = app.HMIGetElementData(TREENAME, treepath)
	if (!curdata) return
	
	var destmenu = app.SelectNodesXML(curdata + "/menuItems")[0]
	if (!destmenu) return
	
	var xmldoc = app.GetXMLDocument()
	
	var params = ParseDragDropParams(txt)
	for (var i = 0; i < params.length; i++)
	{
		if (destmenu.selectSingleNode("menuItem[ipa = " + params[i] + "]"))
			continue  // parametro già presente nel menu destinazione
			
		var newitem = xmldoc.createElement("menuItem")
		newitem.appendChild(xmldoc.createElement("ipa")).text = params[i]
		destmenu.appendChild(newitem)
	}
	app.ModifiedFlag = true
}