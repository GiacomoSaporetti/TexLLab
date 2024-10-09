// -------------- SCRIPT CON FUNZIONI COMUNI DI UTILITA' DA INCLUDERE COME SCRIPT EXTENSION DEL FRAMEWORK ----------------

function Init(intf)
{
	return 1
}


var m_mainTree     // nome dell'albero principale di progetto
function SetMainTree(treename)
	{ m_mainTree = treename }

var m_useCatalog = true   // per default utilizzo del catalogo abilitato
function Set_UseCatalog(use)
	{ m_useCatalog = use }

var m_treeCut_regenerateID = true   // per default rigenera gli uniqueID nell'operazione di cut nell'albero
function Set_TreeCut_RegenerateID(generate)
	{ m_treeCut_regenerateID = generate }

var m_catalogQuerySection       // per limitare le query nel catalogo ai device che hanno una specifica section
function Set_CatalogQuerySection(section)
	{ m_catalogQuerySection = section }

var m_RootProtocol = "root"   // per impostare il protocollo root settato da OnNew
function SetRootProtocol(prot)
	{ m_RootProtocol = prot }
function GetRootProtocol(prot)
	{ return m_RootProtocol }

// apertura finestre con doppio click nell'albero (default false, apre con singolo)
var m_openWindowOnDblClick = false;
function Set_OpenWindowOnDblClick(flag)
	{ m_openWindowOnDblClick = flag; }

var m_fso = new ActiveXObject("Scripting.FileSystemObject")

// costanti per messagebox
var MSGBOX = {
	MB_OK:				0x00,
	MB_OKCANCEL:		0x01,
	MB_ABORTRETRYIGNORE:0x02,
	MB_YESNOCANCEL:		0x03,
	MB_YESNO:			0x04,
	MB_RETRYCANCEL:		0x05,
	MB_CANCELTRYCONTINUE: 0x06,
	MB_ICONERROR:		0x10,
	MB_ICONQUESTION:	0x20,
	MB_ICONEXCLAMATION:	0x30,
	MB_ICONINFORMATION:	0x40,
	IDOK : 1,
	IDCANCEL : 2,
	IDABORT : 3,
	IDRETRY : 4,
	IDIGNORE : 5,
	IDYES : 6,
	IDNO : 7,
	IDTRYAGAIN: 10,
	IDCONTINUE: 11
}

// costanti presenti anche in AlFramework/commonTypes.h
var enuGetWinElements = {
	welAll: 0,
	welRefreshOnly: 1,
	welActiveOnly: 2
}

var enuRefreshWinType = {
	refAll: 0,
	refNotActive: 1,
	refActiveOnly: 2,
	refParseAgain: 3,
	refFullReload: 4
}

var VARENUM = {
		VT_EMPTY: 0,			VT_NULL: 1,			VT_I2: 2,				VT_I4: 3,
		VT_R4: 4,				VT_R8: 5,			VT_CY: 6,				VT_DATE: 7,
		VT_BSTR: 8,				VT_DISPATCH: 9,		VT_ERROR: 10,			VT_BOOL: 11,
		VT_VARIANT: 12,			VT_UNKNOWN: 13,		VT_DECIMAL: 14,			VT_I1: 16,
		VT_UI1: 17,				VT_UI2: 18,			VT_UI4: 19,				VT_I8: 20,
		VT_UI8: 21,				VT_INT: 22,			VT_UINT: 23,			VT_VOID: 24,
		VT_HRESULT : 25,		VT_PTR: 26,			VT_SAFEARRAY: 27,		VT_CARRAY: 28,
		VT_USERDEFINED: 29,		VT_LPSTR: 30,		VT_LPWSTR: 31,			VT_FILETIME: 64
	}

// costanti per fso.OpenTextFile
var enuOpenTextFileModes = {
	ForReading: 1,
	ForWriting: 2,
	ForAppending: 8
}

// costanti per logging
var enuLogLevels = {
	LEV_OK: 0,
	LEV_INFO: 1,
	LEV_WARNING: 2,
	LEV_ERROR: 3,
	LEV_CRITICAL: 4
}

// bits per HMISetItemStyle
var HMIITEMSTYLE = {
	BOLD:			1,
	DISABLED:		2,
	DROP:			4,
	TEXTCOLOR:		8,
	BACKCOLOR:		16,
	SELTEXTCOLOR:	32,
	SELBACKCOLOR:	64
}

// enumerativo per app.HMIAddElement, app.AddTemplateData, app.ParseNode
var enuOperationPos = {
	opAppend: 0,
	opReplace: 1,
	opInsertBefore: 2,
	opNoEnsureVisible: 256
}

// enumerativo per app.Feature
var enuFrameworkFeatures = {
	featForceSaveAsAfterUpgrade: 0,
	featUndoEnable: 1,
	featAppExitCode: 2,
	featValidationRequired: 3,
	featSkipSaveStateOnCleanup: 4,
	featBitmapTransparentColor: 5,
	featTimeStampOnPrintMessage: 6
}

var UPDATECMDFLAGS = {
	DISABLED: 0,
	ENABLED: 1,
	CHECKED: 0x10000,
	UNCHECKED: 0x00000
}

// id icone di overlay per l'albero
var TREE_OVERLAY_NONE = 0
var TREE_OVERLAY_DISABLED = 1

// ----------------------------------- EVENTHANDLER -----------------------------------------------
function OnNew(filename)
{
	// creazione nodi di default
	app.DataCreate("/@protocol", 0, m_RootProtocol)
	app.AddTemplateData("project_config", "/", 0, false)

	SetRootCaption(app.Translate("Untitled"))
	// si posiziona sulla radice del progetto
	app.HMISetCurElement(m_mainTree, "/ROOT")
}

function OnLoad(filename)
{
	SetRootCaption(filename)
	// si posiziona sulla radice del progetto
	app.HMISetCurElement(m_mainTree, "/ROOT")
}

function OnSave(filename)
{
	SetRootCaption(filename)
}

// callback chiamata al caricamento di un PCT che verifica se è necessario caricare un PCT esterno
function OnLoadTemplate_External(filename, xml)
{
	// cerca i nodi loadExternalPCT
	var list = xml.selectNodes("/devicetemplate/customconfig/loadExternalPCT")
	var pct
	while (pct = list.nextNode())
		app.LoadTemplate(pct.nodeTypedValue, -1)
}



// ----------------------------------- FUNZIONI PER ID/CAPTION UNIVOCI -----------------------------------------------
function GenerateCaption(deviceid, name, allCaptionsMap)
{
	var prefix = deviceid
	
	if (name)
		// ok name passato esplicitamente (necessario per device alias)
		prefix = name
	else
	{
		// legge il nome del catalogo tramite il deviceid
		var list = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + deviceid + "']/@caption")
		if (list && list.length != 0)
			prefix = list[0].nodeTypedValue
	}
	
	// crea mappa con tutte le caption in uso se non già passata dal chiamante
	if (!allCaptionsMap)
	{
		allCaptionsMap = {}
		var nodeslist = app.SelectNodesXML("//*[@caption]")
		var node
		while (node = nodeslist.nextNode())
			allCaptionsMap[node.getAttribute("caption")] = true
	}
	
	// costruzione caption univoca
	var n = 1
	var unique
	while (1)
	{
		unique = prefix + "_" + n
		
		if (allCaptionsMap[unique])
			n++     // caption già trovata, incrementa l'indice
		else
			break   // caption NON esistente
	}
	
	return unique
}

function SetRootCaption(filename)
{
	var name = m_fso.GetBaseName(filename)
	app.HMISetCaption(m_mainTree, "/ROOT", name)
}


// assegna un nuovo id univoco e incrementa
function AssignUniqueID(datapath)
{
	var id = parseInt(app.DataGet("/project_config/@nextID", 0))
	app.DataCreate(datapath + "/@uniqueID", 0, id)
	app.DataSet("/project_config/@nextID", 0, id + 1)
	return id
}
// assegna un nuovo id univoco e incrementa
function AssignUniqueID_node(node)
{
	var id = parseInt(app.DataGet("/project_config/@nextID", 0))
	node.setAttribute("uniqueID", id)
	app.DataSet("/project_config/@nextID", 0, id + 1)
	return id
}

// se il uniqueID specificato coincide con nextID-1 (ovvero è l'ultimo appena assegnato), decrementa il nextID stesso
// chiamando questa funzione sulla cancellazione di un nodo si evita di avere un continuo incremento del nextID
function DecrementNextIDIfLast(uniqueID)
{
	var nextID = parseInt(app.DataGet("/project_config/@nextID", 0));
	if (uniqueID == nextID - 1)
		app.DataSet("/project_config/@nextID", 0, uniqueID);
}

// riempie il sottonodo specificato con un valore univoco, iterando sui fratelli del device specificato
function CreateUniqueSubNode(device, query, minValue)
{
	var parent = device.parentNode
	var n = minValue
	if (n === undefined)
		n = 0
	
	// cerca il primo nodeNumber libero tra i propri fratelli
	while (parent.selectSingleNode("*[@insertable and " + query + " = " + n + "]"))
		n++
	
	device.selectSingleNode(query).text = n
	return n
}



// ----------------------------------- ADD/DELETE GENERICHE ASSOCIATE A FUNZIONE -----------------------------------------------
// gestione bottone generico di "Add", richiama una eventuale AddElementFunc definita per il nodo selezionato
function AddElement()
{
	var curdata = app.HMIGetElementData(m_mainTree, "")
	var func = app.DataGet(curdata + "/@AddElementFunc", 0)
	if (func)
		app.CallFunction(func)
}

function UpdateAddElement()
{
	var result = 0
	var oldMask = app.LogMask
	app.LogMask = 0
	
	var curdata = app.HMIGetElementData(m_mainTree, "")
	if (curdata && curdata != "/")
	{
		var func = app.DataGet(curdata + "/@AddElementFunc", 0)
		if (func)
			result = 1
	}
	
	app.LogMask = oldMask
	return result
}

// gestione bottone generico di "Delete", richiama una eventuale DeleteElementFunc definita per il nodo selezionato
function DeleteElement()
{
	var curdata = app.HMIGetElementData(m_mainTree, "")
	var func = app.DataGet(curdata + "/@DeleteElementFunc", 0)
	if (func)
		app.CallFunction(func)
}

function UpdateDeleteElement()
{
	var result = 0
	var oldMask = app.LogMask
	app.LogMask = 0
	
	var curdata = app.HMIGetElementData(m_mainTree, "")
	if (curdata && curdata != "/")
	{
		var func = app.DataGet(curdata + "/@DeleteElementFunc", 0)
		if (func)
			result = 1
	}
	
	app.LogMask = oldMask
	return result
}




// ----------------------------------- FUNZIONI GENERICHE DI UTILITA' -----------------------------------------------
function ParseBoolean(s, defval)
{
	if (s === undefined || s === null || s === "")
	{
		if (defval !== undefined)
			return defval;
		else
			return false;
	}
	else if (s === "false" || s === "no" || s === "0" || s === "FALSE" || s === "NO" || s === "False")
		return false
	else if (s === "true" || s === "yes" || s === "1" || s === "TRUE" || s === "YES" || s === "True")
		return true
	else if (s != '' && !isNaN(parseInt(s)) && parseInt(s) != 0)
		return true
	else if (typeof s === "boolean")
		return s
	else
		return false
}

function GetNode(node, query, defval)
{
	if (defval === undefined)
		defval = ""
	
	if (!node || !query)
		return ""
	
	var ris = node.selectSingleNode(query)
	if (ris)
		return ris.text
	else
		return defval
}

function GetNodeText(node, query)
{
	if (!node) return ""
	var ris = query ? node.selectSingleNode(query) : node
	if (!ris) return ""
	
	// invece di usare la property text (MOLTO lenta) estrae il primo figlio che si suppone sia TEXT o CDATA o ATTRIBUTE, se nodo text-only !
	var child = ris.firstChild
	if (!child)
		return ""
	
	var type = child.nodeType
	if (type == 3 || type == 4 || type == 2)  // NODE_TEXT == 3, NODE_CDATA_SECTION == 4, NODE_ATTRIBUTE == 2
		return child.nodeValue
	else
		return ""
}

function SetNode(node, query, value)
{
	if (!node || !query) return
	var ris = node.selectSingleNode(query)
	if (ris)
	{
		ris.text = (value === null || value === undefined) ? "" : value
		app.ModifiedFlag = true
	}
	return ris
}

function CreateNode(node, name, value)
{
	var newnode = node.ownerDocument.createElement(name);
	node.appendChild(newnode);
	if (value !== null && value !== undefined)
		newnode.text = value;
	return newnode;
}

function FromSafeArray(safearr)
{
	return VBArray(safearr).toArray()
}

function ToSafeArray(arr)
{
	var dict = new ActiveXObject("Scripting.Dictionary")
	for (var i = 0; i < arr.length; i++)
		dict.add(i, arr[i])
    return dict.Items()
}

function GetNodeIndex(parent, node)
{
	var list = parent.childNodes
	for (var i = 0, t = list.length; i < t; i++)
		if (list[i] == node)
			return i
			
	return -1
}

/**
 * JavaScript printf/sprintf functions.
 *
 * This code is unrestricted: you are free to use it however you like.
 * 
 * The functions should work as expected, performing left or right alignment,
 * truncating strings, outputting numbers with a required precision etc.
 *
 * For complex cases, these functions follow the Perl implementations of
 * (s)printf, allowing arguments to be passed out-of-order, and to set the
 * precision or length of the output based on arguments instead of fixed
 * numbers.
 *
 * See http://perldoc.perl.org/functions/sprintf.html for more information.
 *
 * Implemented:
 * - zero and space-padding
 * - right and left-alignment,
 * - base X prefix (binary, octal and hex)
 * - positive number prefix
 * - (minimum) width
 * - precision / truncation / maximum width
 * - out of order arguments
 *
 * Not implemented (yet):
 * - vector flag
 * - size (bytes, words, long-words etc.)
 * 
 * Will not implement:
 * - %n or %p (no pass-by-reference in JavaScript)
 *
 * @version 2007.04.27
 * @author Ash Searle
 */
function sprintf() 
{
	function pad(str, len, chr, leftJustify)
	{
		var padding = (str.length >= len) ? '' : Array(1 + len - str.length >>> 0).join(chr);
		return leftJustify ? str + padding : padding + str;
	}

    function justify(value, prefix, leftJustify, minWidth, zeroPad)
	{
		var diff = minWidth - value.length;
		if (diff > 0) 
		{
			if (leftJustify || !zeroPad)
				value = pad(value, minWidth, ' ', leftJustify);
			else
				value = value.slice(0, prefix.length) + pad('', diff, '0', true) + value.slice(prefix.length);
		}
		return value;
    }

    function formatBaseX(value, base, prefix, leftJustify, minWidth, precision, zeroPad)
	{
		// Note: casts negative numbers to positive ones
		var number = value >>> 0;
		prefix = prefix && number && {'2': '0b', '8': '0', '16': '0x'}[base] || '';
		value = prefix + pad(number.toString(base), precision || 0, '0', false);
		return justify(value, prefix, leftJustify, minWidth, zeroPad);
    }

    function formatString(value, leftJustify, minWidth, precision, zeroPad)
	{
		if (precision != null)
			value = value.slice(0, precision);
		return justify(value, '', leftJustify, minWidth, zeroPad);
    }

    var a = arguments, i = 0, format = a[i++];
	
    return format.replace(sprintf.regex, function(substring, valueIndex, flags, minWidth, _, precision, type) {
	    if (substring == '%%') return '%';

	    // parse flags
	    var leftJustify = false, positivePrefix = '', zeroPad = false, prefixBaseX = false;
		
	    for (var j = 0; flags && j < flags.length; j++)
			switch (flags.charAt(j))
			{
				case ' ': positivePrefix = ' '; break;
				case '+': positivePrefix = '+'; break;
				case '-': leftJustify = true; break;
				case '0': zeroPad = true; break;
				case '#': prefixBaseX = true; break;
			}

	    // parameters may be null, undefined, empty-string or real valued
	    // we want to ignore null, undefined and empty-string values

	    if (!minWidth)
			minWidth = 0;
	    else if (minWidth == '*')
			minWidth = +a[i++];
	    else if (minWidth.charAt(0) == '*')
			minWidth = +a[minWidth.slice(1, -1)];
	    else
			minWidth = +minWidth;

	    // Note: undocumented perl feature:
	    if (minWidth < 0)
		{
			minWidth = -minWidth;
			leftJustify = true;
	    }

	    if (!isFinite(minWidth))
			throw new Error('sprintf: (minimum-)width must be finite');

	    if (!precision)
			precision = 'fFeE'.indexOf(type) > -1 ? 6 : (type == 'd') ? 0 : void(0);
	    else if (precision == '*')
			precision = +a[i++];
	    else if (precision.charAt(0) == '*')
			precision = +a[precision.slice(1, -1)];
	    else
			precision = +precision;

	    // grab value using valueIndex if required?
	    var value = valueIndex ? a[valueIndex.slice(0, -1)] : a[i++];

	    switch (type)
		{
		case 's': return formatString(String(value), leftJustify, minWidth, precision, zeroPad);
		case 'c': return formatString(String.fromCharCode(+value), leftJustify, minWidth, precision, zeroPad);
		case 'b': return formatBaseX(value, 2, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
		case 'o': return formatBaseX(value, 8, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
		case 'x': return formatBaseX(value, 16, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
		case 'X': return formatBaseX(value, 16, prefixBaseX, leftJustify, minWidth, precision, zeroPad).toUpperCase();
		case 'u': return formatBaseX(value, 10, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
		case 'i':
		case 'd': 
			{
				var number = parseInt(+value);
				var prefix = number < 0 ? '-' : positivePrefix;
				value = prefix + pad(String(Math.abs(number)), precision, '0', false);
				return justify(value, prefix, leftJustify, minWidth, zeroPad);
			}
		case 'e':
		case 'E':
		case 'f':
		case 'F':
		case 'g':
		case 'G':
			{
				var number = +value;
				var prefix = number < 0 ? '-' : positivePrefix;
				var method = ['toExponential', 'toFixed', 'toPrecision']['efg'.indexOf(type.toLowerCase())];
				var textTransform = ['toString', 'toUpperCase']['eEfFgG'.indexOf(type) % 2];
				
				if (precision != undefined)
					value = prefix + Math.abs(number)[method](precision);
				else
					// l'implementazione della toPrecision() di Microsoft non accetta la precision undefined, per cui omette il parametro
					value = prefix + Math.abs(number)[method]();
					
				return justify(value, prefix, leftJustify, minWidth, zeroPad)[textTransform]();
			}
		default: return substring;
	    }
	});
}
sprintf.regex = /%%|%(\d+\$)?([-+#0 ]*)(\*\d+\$|\*|\d+)?(\.(\*\d+\$|\*|\d+))?([scboxXuidfegEG])/g;

function CreateObject(progid)
{
	// creazione oggetto COM generico, da utilizzare nelle funzioni script di pagine HTML dove altrimenti non si avrebbero privilegi per istanziare
	return new ActiveXObject(progid)
}

function GetCOMObject(pathname, classname)
{
	try
	{
		// ottiene oggetto COM già istanzianto, da utilizzare nelle funzioni script di pagine HTML dove non è disponibile
		return GetObject(pathname, classname)
	}
	catch (ex)
	{ }
}

function IsPathRelative( path )
{
	if (path.substr(0, 1) == "\\" ||
		path.length >= 3 && path.substr( 1, 2 ) == ":\\")
		return false
	else
		return true
}

function UniqueArray_Add(list, item)
{
	for (var i = 0, t = list.length; i < t; i++)
		if (list[i] == item)
			return

	list.push(item)
}

function ArrayIndexOf(list, item)
{
	for (var i = 0, t = list.length; i < t; i++)
		if (list[i] == item)
			return i
			
	return -1
}

function ArrayFind(arr, func)
{
	for (var i = 0, t = arr.length; i < t; i++)
		if (func(arr[i]))
			return i;
		
	return -1;
}

// funzione analoga a Array.prototype.filter
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
function ArrayFilter(arr, func) {
	var res = [];

	for (var i = 0, t = arr.length; i < t; i++)
		if (func(arr[i]))
			res.push(arr[i]);

	return res;
}

function MapFind(obj, func)
{
	for (var name in obj)
		if (func(obj[name]))
			return name;
		
	return null;
}

function ArrayToMap(list, keyfield)
{
	if (!list || !keyfield) return
	
	var map = {}
	for (var i = 0, t = list.length; i < t; i++)
	{
		var item = list[i]
		map[item[keyfield]] = item
	}
	return map
}

function MapToArray(map)
{
	if (!map) return
	
	var list = []
	for (var i in map)
		list.push(map[i])
	return list
}

function Right(str, n)
{
	var s = String(str)
	if (n <= 0)
		return ""
	else if (n > s.length)
		return str
    else
		return s.substring(s.length, s.length - n)
}

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

function IsValidIPAddress(ip)
{
	if (!ip) return false
	var arr = ip.split(".")
	var notValid = arr.length != 4 ||
					isNaN(arr[0]) || arr[0] > 255 || arr[0] < 0 ||
					isNaN(arr[1]) || arr[1] > 255 || arr[1] < 0 ||
					isNaN(arr[2]) || arr[2] > 255 || arr[2] < 0 ||
					isNaN(arr[3]) || arr[3] > 255 || arr[3] < 0;
	return !notValid;
}


// verifica se il file specificato esiste e se sì lo rinomina in .bak
function MakeBackup(filename)
{
	if (m_fso.FileExists(filename))
	{
		var bakname = filename + ".bak"
		try 
		{
			if (m_fso.FileExists(bakname))
				m_fso.DeleteFile(bakname, true)
			
			m_fso.MoveFile(filename, bakname)
		}
		catch (e)
		{		
			AddLog(enuLogLevels.LEV_ERROR, "MakeBackup", "FileSystem Error: " + e.description + " (maybe file already open in OpenPCS?)")
			throw e
		}
	}
}

function SafeCreateTextFile(filename)
{
	try 
	{
		var f = m_fso.CreateTextFile(filename, true)
		return f
	}
	catch (e)
	{		
		AddLog(enuLogLevels.LEV_ERROR, "SafeCreateTextFile", "FileSystem Error: " + e.description + " , can not create file " + filename)
		throw e
	}
}

function ConcatFiles(arrSrc, dest)
{
	var fDest = SafeCreateTextFile(dest);
	
	for (var i = 0; i < arrSrc.length; i++)
	{
		var f = m_fso.OpenTextFile(arrSrc[i], enuOpenTextFileModes.ForReading);
		while (!f.AtEndOfStream)
		{
			var s = f.ReadLine();
			fDest.WriteLine(s);
		}
		f.Close();
	}
	
	fDest.Close();
}

function LoadXML(filename)
{
	var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0");
	xmldoc.async = false;
	if (xmldoc.load(filename))
		return xmldoc;
	else
		return null;
}

function WriteXML(xmldoc, filename, prettyprint, throwexc)
{
	try
	{
		if (prettyprint)
		{
			// salvataggio con pretty-print (indentazione automatica)
			var stream = new ActiveXObject("ADODB.Stream")
			stream.Type = 1  // adTypeBinary = 1
			stream.Mode = 3|12  // adModeReadWrite = 3, adModeShareExclusive = 12
			stream.Open()
			
			var writer = new ActiveXObject("MSXML2.MXXMLWriter.6.0")
			writer.indent = true
			writer.encoding = "UTF-8"
			writer.output = stream
			
			var reader = new ActiveXObject("MSXML2.SAXXMLReader.6.0")
			reader.contentHandler = writer
			// lexical-handler per preservare commenti (importanti: per #define e #include!)
			reader.putProperty("http://xml.org/sax/properties/lexical-handler", writer)
			reader.parse(xmldoc)
			
			stream.SaveToFile(filename, 2)   // adSaveCreateOverWrite = 2
			stream.Close()
		}
		else
			// salvataggio normale senza pretty-print
			xmldoc.save(filename)
			
		return true
	}
	catch (ex)
	{
		if (throwexc)
			throw "ERROR saving XML to " + filename
		else
			return false
	}
}

// dato un path restituisce il nome dell'ultimo elemento (senza / e [])
function GetLastPathElement(path, sep)
{
	if (!sep) sep = "/"
	
	if (path.charAt(path.length-1) == sep)
		path = path.slice(0,-1)
	
	var pos = path.lastIndexOf(sep)
	if (pos != -1)
		path = path.substr(pos + 1)
	pos = path.indexOf("[")
	if (pos != -1)
		path = path.substr(0, pos)
	
	return path
}

// rinomina un nodo (creando uno nuovo, spostandone tutti i figli e inserendolo al suo posto)
function RenameXMLElement(node, newname)
{
	var parent = node.parentNode
	var newnode = app.GetXMLDocument().createElement(newname)
	parent.insertBefore(newnode, node)
	
	// sposta tutti i figli
	var childNode = node.firstChild
	while (childNode)
	{
		var nextNode = childNode.nextSibling
		newnode.appendChild(childNode)
		childNode = nextNode
	}
	
	// copia tutti gli attributi "specified" (non i default e fixed dell'XSD)
	for (var i = 0; i < node.attributes.length; i++)
	{
		var attr = node.attributes[i]
		if (attr.specified)
			newnode.setAttribute(attr.name, attr.text)
	}
	
	parent.removeChild(node)
	return newnode
}

function AddXMLNamespace(xmldoc, nsToAdd)
{
	// aggiunge namespace per permettere query xpath sullo schema XSD
	var ns = xmldoc.getProperty("SelectionNamespaces")
	if (ns.indexOf(nsToAdd) == -1)
		xmldoc.setProperty("SelectionNamespaces", ns + " " + nsToAdd)
}

// LTtrim / RTrim / Trim
function LTrim(s, ch)
{
	if (ch === undefined)
		ch = ' ';
	
	var l = 0
	while (l < s.length && s.charAt(l) == ch)
		l++
	return s.substring(l)
}

function RTrim(s, ch)
{
	if (ch === undefined)
		ch = ' ';
	
	var r = s.length - 1
	while (r > 0 && s.charAt(r) == ch)
		r--
	return s.substring(0, r+1)
}

function Trim(s, ch)
{
	if (ch === undefined)
		ch = ' ';
	
	var l = 0
	var r = s.length - 1
	while (l < s.length && s.charAt(l) == ch)
		l++
	while (r > l && s.charAt(r) == ch)
		r--
	return s.substring(l, r+1)
}

// sostituzione di argomenti in una stringa nel formato %1, %2 ecc
function FormatMsg()
{
	if (arguments.length == 0) return ""
	var msg = arguments[0]
	for (var i = 1; i < arguments.length; i++)
		msg = msg.replace("%" + i, arguments[i])
	return msg
}


// cambio di estensione in un nome di file
function ChangeFileExt(fileName, newExt)
{
	var pos = fileName.lastIndexOf(".")
	if (pos)
		fileName = fileName.substr(0, pos+1)
	return fileName + newExt
}

// cerca un device per @uniqueID e ne restituisce il nodo xml
function GetDeviceFromUniqueID(id)
{
	var nodelist = app.SelectNodesXML("//*[@uniqueID = " + id + "]")
	if (nodelist && nodelist.length != 0)
		return nodelist[0]
}

// restituisce un nome di variabile IEC o di tag XML valido (senza caratteri speciali)
function NormalizeName(name)
{
	var result = ""
	for (var i = 0; i < name.length; i++)
	{
		var c = name.charAt(i)
		if (c >= 'a' && c <= 'z'  ||  
			c >= 'A' && c <= 'Z'  ||  
			c >= '0' && c <= '9'  ||
			c == '_' )
			// ok carattere alfanumerico
			result += c
		else if (c == " ")
			// sostituzione ' ' -> '_'
			result += "_"
		else if (c == ".")
			// sostituzione '.' -> 'p'
			result += "p"
		else
		{
			// altro carattere unicode qualunque: sostituisce con valore hex
			c = name.charCodeAt(i);
			result += c.toString(16).toUpperCase();
		}
	}
	
	if (result.charAt(0) >= '0' && result.charAt(0) <= '9')
		result = "_" + result  // il nodo xml non può iniziare con un numero!
	
	return result;
}

// composizione di un COLORREF dato i tre componenti R,G,B (come macro windows)
function RGB(r, g, b)
{
	return (r & 0xFF) | ((g & 0xFF) << 8) | ((b & 0xFF) << 16)
}

// ricerca in profondità di nodi, bloccandosi al rilevamento dell'attributo stopNodeParsing
// necessario perchè con grossi progetti query del tipo //*[@attr] impiegano tempi esagerati (causa presenza XSD!)
function SearchNodes(rootnode, query, maxdepth)
{
	var result = [];
	
	function SearchNodesPrivate(rootnode, maxdepth)
	{
		//app.PrintMessage("SearchNodesPrivate " + query + " : " + rootnode.nodeName);   // DEBUG
		var nodelist = rootnode.selectNodes(query)
		var node
		while (node = nodelist.nextNode())
			result.push(node)
		
		if (maxdepth > 1 || maxdepth == -1)
		{
			if (maxdepth > 1)
				maxdepth--
				
			// iterazione ricorsiva su tutti i figli
			for (node = rootnode.firstChild; node != null; node = node.nextSibling)
				// solo se NODE_ELEMENT (1) e non c'è l'attributo stopNodeParsing che interrompe l'analisi in profondità
				if (node.nodeType == 1 && !node.getAttribute("stopNodeParsing"))
					SearchNodesPrivate(node, maxdepth)
		}
	}
	
	//var startTime = new Date().getTime();
	SearchNodesPrivate(rootnode, maxdepth)
	//app.PrintMessage("SearchNodes " + query + " : " + (new Date().getTime() - startTime));   // DEBUG
	return result
}

// ricerca in profondità di nodi, bloccandosi al rilevamento dell'attributo stopNodeParsing
// come SearchNodes ma specifica per cercare nodi con attributi, quindi con query del tipo *[@attrName]
function SearchNodesWithAttribute(rootnode, attrName, maxdepth, attrValue)
{
	var result = [];
	
	function SearchNodesWithAttributePrivate(rootnode, maxdepth)
	{
		//app.PrintMessage("SearchNodesWithAttributePrivate " + attrName + " : " + rootnode.nodeName);   // DEBUG
		var visitChildren = false;
		if (maxdepth > 1)
		{
			visitChildren = true;
			maxdepth--;
		}
		else if (maxdepth == -1)
			visitChildren = true;
		
		// iterazione ricorsiva su tutti i figli
		for (var node = rootnode.firstChild; node !== null; node = node.nextSibling)
		{
			if (node.nodeType == 1)   // solo se NODE_ELEMENT (1)
			{
				var val = node.getAttribute(attrName);
				if (attrValue === undefined)
				{
					// attrValue non specificato, sufficiente la presenza dell'attributo
					if (val !== null)
						result.push(node);
				}
				else
				{
					// attrValue specificato, il valore deve coincidere (attrValue deve essere stringa!)
					if (val === attrValue)
						result.push(node);
				}
				
				// solo se non c'è l'attributo stopNodeParsing che interrompe l'analisi in profondità
				if (visitChildren && node.getAttribute("stopNodeParsing") === null)
					SearchNodesWithAttributePrivate(node, maxdepth);
			}
		}
	}
	
	//var startTime = new Date().getTime();
	SearchNodesWithAttributePrivate(rootnode, maxdepth)
	//app.PrintMessage("SearchNodesWithAttribute " + attrName + " : " + (new Date().getTime() - startTime));     // DEBUG
	return result
}

function CompareVersions(ver1, ver2, sep)
{
	if (typeof ver1 == "string")
		ver1 = ver1.split(sep ? sep : ".");
	if (typeof ver2 == "string")
		ver2 = ver2.split(sep ? sep : ".");
	
	for (var i = 0, t = Math.max(ver1.length, ver2.length); i < t; i++)
	{
		var v1 = ver1[i] ? parseInt(ver1[i]) : 0;
		var v2 = ver2[i] ? parseInt(ver2[i]) : 0;
		
		if (v1 < v2)
			return -1;
		else if (v1 > v2)
			return 1;
	}
	return 0;
}

function StringStartsWith(s, prefix)
{
	return s.substr(0, prefix.length) == prefix;
}

function StringEndsWith(s, suffix)
{
	return s.slice(-suffix.length) == suffix;
}

// concatena un numero variabile di argomenti con il separatore di path, rimuovendo backslash in eccesso
function PathJoin()
{
	var arr = [];
	for (var i = 0; i < arguments.length; i++)
	{
		var s = Trim(arguments[i], '\\');
		arr.push(s);
	}
	return arr.join("\\");
}

function quote(s)
{
	return '"' + s + '"';
}

// creazione ricorsiva di una struttura di directory. la directory iniziale startPath deve già esistere in partenza
function CreateDirRecursive(startPath, newPath)
{
	var arr = newPath.split("\\");
	var curPath = startPath;
	for (var i = 0; i < arr.length; i++)
	{
		curPath += "\\" + arr[i];
		if (!m_fso.FolderExists(curPath))
			m_fso.CreateFolder(curPath);
	}
}

function IsNullOrEmptyString(s)
{
	return s === "" || s === undefined || s === null;
}

var m_generalFunctions = {
	ParseBoolean: ParseBoolean,
	GetNode: GetNode,
	GetNodeText: GetNodeText,
	SetNode: SetNode,
	CreateNode: CreateNode,
	FromSafeArray: FromSafeArray,
	ToSafeArray: ToSafeArray,
	GetNodeIndex: GetNodeIndex,
	sprintf: sprintf,
	CreateObject: CreateObject,
	AddLog: AddLog,
	SplitFieldPath: SplitFieldPath,
	NewINI: NewINI,
	ReadINI: ReadINI,
	GetLastPathElement: GetLastPathElement,
	LTrim: LTrim,
	RTrim: RTrim,
	Trim: Trim,
	ArrayToMap: ArrayToMap,
	MapToArray: MapToArray,
	FormatMsg: FormatMsg,
	toHex: toHex,
	IsValidIPAddress: IsValidIPAddress,
	ArrayIndexOf: ArrayIndexOf,
	WriteXML: WriteXML,
	RGB: RGB,
	SearchNodes: SearchNodes,
	SearchNodesWithAttribute: SearchNodesWithAttribute,
	StringStartsWith: StringStartsWith,
	StringEndsWith: StringEndsWith,
	IsNullOrEmptyString: IsNullOrEmptyString,
	PathJoin: PathJoin,
	quote: quote,
	CreateDirRecursive: CreateDirRecursive,
	LoadXML: LoadXML,
	ArrayFind: ArrayFind,
	MapFind: MapFind,
	ArrayFilter: ArrayFilter
};

// funzioni di pubblicazione di funzioni e tipi comuni
function GetGeneralFunctions()
{
	return m_generalFunctions;
}

var m_generalTypes = {
	enuGetWinElements: enuGetWinElements,
	enuRefreshWinType: enuRefreshWinType,
	VARENUM: VARENUM,
	MSGBOX: MSGBOX,
	enuOpenTextFileModes: enuOpenTextFileModes,
	enuLogLevels: enuLogLevels,
	HMIITEMSTYLE: HMIITEMSTYLE,
	enuOperationPos: enuOperationPos,
	enuFrameworkFeatures: enuFrameworkFeatures,
	UPDATECMDFLAGS: UPDATECMDFLAGS
};

function GetGeneralTypes()
{
	return m_generalTypes;
}




// ----------------------------------------------- PARSING COMMSTRING -------------------------------------------------------
function BuildCommString(protocol, address, timeout, portType, portNum, baud, lineConf, protocolOptions, slaveAddr)
{
	if (protocol == "ModbusTCP")
	{
		// gestione particolare per ModbusTCP, l'address è in realtà l'indirizzo IP
		portNum = address + "/" + portNum
		if (slaveAddr)
			address = slaveAddr;
		else
			address = 255;
	}
	else if (protocol == "HDPCLink")
	{
		portNum = address + "/" + portNum
		address = 1	//	PC mode
	}
	else if (protocol == "GDB")
	{
		// gestione particolare per GDB TCP , l'address è in realtà l'indirizzo IP
		if(portType == "TCPIP")
			portNum = address + "/" + portNum
		
		address = 0		// addr non usato attualmente, è sempre 0
	}
	else if (protocol == "UABus" && portType == "TCPIP")
	{
		portNum = address + "/" + portNum;
		address = 0;	// addr non usato (serve solo su seriale), è sempre 0
	}
	else if (protocol == "VABus" && portType == "TCPIP")
	{
		portNum = address + "/" + portNum;
		address = 1;	// addr non usato (serve solo su seriale), è sempre 1
	}
	
	var result = protocol + ":" + address
	if (timeout != undefined)
		result += "," + timeout
	if (protocolOptions != undefined )
		result += "," + protocolOptions	
	result += "#" + portType + ":" + portNum
	if (baud != undefined)
		result += "," + baud
	if (lineConf != undefined)
		result += "," + lineConf
	return result
}

function BuildCommString2(objConf)
{
	if (!objConf) return
	
	var protOptions = objConf.protocolOptions;
	if (objConf.protocol == "UABus" && objConf.user && objConf.password)
		protOptions += "," + objConf.user + "," + objConf.password;
	
	return BuildCommString(objConf.protocol, objConf.address, objConf.timeout, objConf.portType, objConf.portNum, objConf.baud, objConf.lineConf, protOptions, objConf.slaveAddr)
}

/* --------- CASI GESTITI : --------
Modbus:1,1000,M#COM:1,19200,N,8,1
Modbus:1,1000,M#RSUSBX:1,38400,N,8,1,H
Modbus:1,1000,J#COM:1,19200,N,8,1
Modbus:1,1000,J#RSUSBX:1,38400,N,8,1,H
EwDMI:0,1000#COM:1,19200,N,8,1
ModbusTCP:255,1000,M#TCPIP:0.0.0.0/502,1000
CanOpen:0,1000#CANUSBX:0,500000
CanOpen:0,1000#CANUSBX2:0,500000
CanOpen:0,1000#CANUSB:0,500000,500000
CanOpen:0,1000#CANPC:1,500000,500000
CanOpen:0,1000#CAN:500000
Slink:0,1000#COM:3,38400,N,8,1
Slink4:0,1000,0#COM:3,38400,N,8,1
SBCSer:0,1000#COM:3,9600,E,8,1
GDB:0,1000#COM:1,38400,N,8,1
GDB:0,1000#TCPIP:1.2.3.4/5000
Cencal:0,1000#COM:1,9600,O,8,1
CanTracer:#CANPC:1,500000,115200
Kfm:1000#COM:1,9600,E,8,1
HDPCLink:1,1000#TCPIP:0.0.0.0/18500,5000
UABus:0,10000,4,user,pass#TCPIP:localhost/17221,5000
UABus:1,10000,4,user,pass#COM:2,921600,N,8,1
*/
function SplitCommString(commstring)
{
	var conf = {}
	
	// posizione del primo : dopo il protocollo
	var protocolNameSep = commstring.indexOf(":")
	conf.protocol = commstring.substr(0, protocolNameSep)
	
	// posizione del # prima del tipo porta
	var protocolPortSep = commstring.indexOf("#", protocolNameSep+1)
	var protocolStr = commstring.substr(protocolNameSep+1, protocolPortSep-protocolNameSep-1)
	var list = protocolStr.split(",")
	conf.address = list[0]
	conf.timeout = list[1]
	conf.protocolOptions = list[2]
	
	if (conf.protocol == "UABus" && list.length >= 5)
	{
		conf.user = list[3];
		conf.password = list[4];
	}
	
	// posizione del secondo : dopo il tipo porta
	var portNameSep = commstring.indexOf(":", protocolPortSep)
	conf.portType = commstring.substr(protocolPortSep+1, portNameSep-protocolPortSep-1)
	
	var portStr = commstring.substr(portNameSep+1)
	switch (conf.portType)
	{
		case "COM":
		case "RSUSBX":
		case "CANUSB":
		case "CANPC":
			list = portStr.split(",")
			conf.portNum = list[0]
			conf.baud = list[1]
			
			// posizione della lineconf in fondo
			var baudSep = portNameSep + conf.portNum.length + 1 + conf.baud.length + 2
			conf.lineConf = commstring.substr(baudSep)
			break
			
		case "TCPIP":
			if (conf.protocol == "ModbusTCP" ||
				conf.protocol == "HDPCLink" ||
				conf.protocol == "GDB" ||
				conf.protocol == "UABus" ||
				conf.protocol == "VABus")
			{
				if (conf.protocol == "ModbusTCP")
					conf.slaveAddr = conf.address
				
				list = portStr.split(",")
				
				var portSep = list[0].lastIndexOf("/")
				if (portSep != -1)
				{
					conf.address = list[0].substr(0, portSep)
					conf.portNum = list[0].substr(portSep+1)
				}
				
				if (list.length > 1)
					conf.lineConf = portStr.substr(portStr.indexOf(",")+1);
			}
			else
				conf.portNum = portStr
			break
			
		case "CANUSBX":
		case "CANUSBX2":
		case "PCANUSB":
			list = portStr.split(",")
			conf.portNum = list[0]
			conf.baud = list[1]
			break
			
		case "CAN":
			conf.baud = portStr
			break
	}
	
	return conf
}



//----------------------------------------------------- GESTIONE TREE -------------------------------------

function AddNewDevice(curDatapath, deviceid, template, name, replace)
{
	if (curDatapath == "" || template == "" || deviceid == "") return
	
	if (!replace)
	{
		// se in modalità aggiunta verifica l'eventuale attributo maxSlaves se presente
		var node = app.SelectNodesXML(curDatapath)[0]
		var maxSlaves = parseInt(node.getAttribute("maxSlaves"))
		if (maxSlaves > 0)
		{
			// conteggio nodi slaves e verifica se oltre il max
			var count = node.selectNodes("*[@insertable]").length
			if (count >= maxSlaves)
			{
				app.MessageBox(app.Translate("Can not add another element:\nmaximum number is ") + maxSlaves, "", MSGBOX.MB_ICONEXCLAMATION)  //translate
				return
			}
		}
	}
	else
	{
		// si posiziona sulla radice del progetto, il replace potrebbe infatti dare altrimenti un errore sul nuovo nodo
		app.HMISetCurElement(m_mainTree, "/ROOT")
		
		if (m_openWindowOnDblClick)
			app.OpenWindow("emptypage", "", "");
	}
		
	
	// carica il template corretto
	if (! app.LoadTemplate(template, -1)) return
		
	// aggiunge il template dati alla posizione data attuale e riceve il data path
	var datapath = app.AddTemplateData(deviceid, curDatapath, replace ? 1 : 0)
	if (!datapath) return
	
	var newNode = app.SelectNodesXML(datapath)[0]
	
	if (newNode.getAttribute("uniqueID") === null)
		// assegna l'id univoco al device se nessuno l'ha ancora fatto (es. oncreatenode del nuovo nodo)
		AssignUniqueID_node(newNode)
	
	// legge eventuale attributo opzionale per evitare la generazione automatica della caption
	var noAutoGenCaption = ParseBoolean(newNode.getAttribute("noAutoGenCaption"))
	
	if (!noAutoGenCaption && newNode.getAttribute("caption") === null && newNode.getAttribute("name") === null)
	{
		var treepath = app.HMIGetElementPath(m_mainTree, datapath)
		// costruzione caption
		var caption = GenerateCaption(deviceid, name)
		
		newNode.setAttribute("caption", caption)
		newNode.setAttribute("name", name)
		app.HMISetCaption(m_mainTree, treepath, caption)
	}
	
	// invia messaggio broadcast
	app.SendMessage("DeviceAdded", datapath)
	
	return datapath
}

// costruisce la query per il catalog; protocol è un elenco di protocolli separato da virgole, deviceid è opzionale per limitare la ricerca a un solo master
function GetProtocolQuery(protocol, deviceid)
{
	var query = "//deviceinfo[ "
	
	if (deviceid)
		query += "(@deviceid = '" + deviceid + "') and "
	
	// verifica la presenza di una specifica section nel PCT
	if (m_catalogQuerySection)
		query += "(sections/@" + m_catalogQuerySection + ") and "
		
	query += "("
	
	// genera la query splittando in base al carattere ','; (funziona anche se c'è una sola voce)
	var arr = protocol.split(",")
	for (var i = 0; i < arr.length; i++)
	{
		var p = Trim(arr[i])
		if (p != "")
			query += (i > 0 ? " or " : "") + "protocols/protocol = '" + p + "'"
	}
		
	query += ") ]"
	return query
}

// mostra il catalogo e aggiunge o sostituisce un nuovo nodo
function AddOrReplace(protocolPath, replace)
{
	// ottiene il data del nodo corrente (su cui si è cliccato)
	var curdata = app.HMIGetElementData(m_mainTree, "")
	var protocol = app.DataGet(curdata + protocolPath, 0)
	if (!protocol) return

	var retval = app.CallFunction("catalog.Select", GetProtocolQuery(protocol))
	if (!retval) return
	
	AddNewDevice(curdata, retval.getAttribute("deviceid"), retval.getAttribute("template"), retval.getAttribute("caption"), replace)
}


function AddNode(param)
{
	// aggiunge un nodo sotto il nodo corrente
	AddOrReplace("/@protocol", false)
}

function ChangeNode(param)
{
	// aggiunge un nodo al posto del nodo corrente
	AddOrReplace("/../@protocol", true)
}

function EnableDisableNode(param)
{
	// ottiene il data del nodo corrente (su cui si è cliccato)
	var curdata = app.HMIGetElementData(m_mainTree, "")
	if (curdata == "/")
		return
	
	var oldmask = app.LogMask
	app.LogMask = 0
	var canBeDisabled = app.DataGet(curdata + "/@canBeDisabled", 0)
	app.LogMask =  oldmask
	
	if (!ParseBoolean(canBeDisabled))
		// nodo non disabilitabile
		return
		
	var enabled = app.DataGet(curdata + "/@enabled", 1)
	enabled = ParseBoolean(enabled)
	
	enabled = !enabled
		
	app.DataSet(curdata + "/@enabled", 0, enabled.toString() )
	
	app.HMISetOverlayImg(m_mainTree, "" , enabled ? TREE_OVERLAY_NONE : TREE_OVERLAY_DISABLED )
	
	app.ModifiedFlag = true
}

function RemoveNode(param)
{
	// ottiene il data del nodo corrente (su cui si è cliccato)
	var curdata = app.HMIGetElementData(m_mainTree, "")
	if (curdata == "/")
		return
	
	var oldmask = app.LogMask
	app.LogMask = 0
	var caption = app.DataGet(curdata + "/@caption", 0)
	var insertable = app.DataGet(curdata + "/@insertable", 0)
	app.LogMask =  oldmask
	
	if (!ParseBoolean(insertable))
		// nodo non inseribile, quindi non cancellabile
		return
	
	if (!caption)
		// se il nodo xml non ha caption la prende dal tree
		caption = app.HMIGetCaption(m_mainTree, "")
		
	if (app.MessageBox(app.Translate("Are you sure you want to delete item\n") + caption + " ?", "", MSGBOX.MB_ICONQUESTION|MSGBOX.MB_OKCANCEL) == MSGBOX.IDCANCEL)  //translate
		return
	
	// si riposiziona sulla main page
	app.HMISetCurElement(m_mainTree, "/ROOT")
	
	if (m_openWindowOnDblClick)
		app.OpenWindow("emptypage", "", "");
	
	// elimina il nodo dati e l'eventuale nodo tree associato
	app.DataDelete(curdata, 0)
	
	// invia messaggio broadcast
	app.SendMessage("DeviceRemoved", curdata)
}

function RenameNode()
{
	app.HMIEditElement(m_mainTree)
}

// click singolo su elemento albero
function OnTreeClick(node, tree)
{
	if (!tree)
		tree = m_mainTree
		
	// ottiene il data del nodo corrente (su cui si è cliccato)
	var curdata = app.HMIGetElementData(tree, "")
	if (curdata === null)
		return
	if (curdata.slice(-1) != "/")
		curdata += "/"
	
	if (m_useCatalog)
	{
		// ottiene il protocollo supportato dal nodo corrente (master), elenco separato da virgole
		var oldLogMask = app.LogMask
		app.LogMask = 0
		var protocol = app.DataGet(curdata + "@protocol", 0)
		app.LogMask = oldLogMask
		if (protocol)
			var query = GetProtocolQuery(protocol)
		else
			var query = ""
		
		// aggiorna il list control del catalogo
		app.CallFunction("catalog.UpdateCatalogListCtrl", query)
	}
	
	if (!m_openWindowOnDblClick)
	{
		// apertura finestra collegata al nodo dell'albero
		var linkedWin = app.HMIGetLinkedWindow(tree, "")
		if (!linkedWin)
			return
			
		app.OpenWindow(linkedWin, "", curdata)
	}
	// se invece m_openWindowOnDblClick è true, l'apertura della pagina viene fatta direttamente dal framework, in quanto è l'azione di default del dblclick
}

var DRAGDROP_PREFIX = "DRAGDROP:"
var DRAGDROP_SEP = "|"

function ParseDragDropText(text)
{
	// la stringa droppata deve iniziare con "DRAGDROP:"
	if (text.substr(0, DRAGDROP_PREFIX.length) != DRAGDROP_PREFIX) return
	text = text.substr(DRAGDROP_PREFIX.length)
	
	var result = {}
	
	var pos = text.indexOf(DRAGDROP_SEP)
	if (pos != -1)
	{
		result.deviceid = text.substr(0, pos)
		result.name = text.substr(pos+1)
	}
	else
	{
		result.deviceid = text
		result.name = ""
	}
	return result
}

function OnTreeDrop(text)
{
	var result = ParseDragDropText(text)
	if (!result) return
	
	// ottiene il data del nodo corrente (su cui si è cliccato)
	var curdata = app.HMIGetElementData(m_mainTree, "")
	
	var retval = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + result.deviceid + "']")
	if (!retval || retval.length == 0) return
	
	if (!result.name)
		result.name = retval[0].getAttribute("caption")
		
	AddNewDevice(curdata, result.deviceid, retval[0].getAttribute("template"), result.name)
}

function OnTreeKeyDown(key)
{
	// vedi winuser.h per lista tasti VK_XXX
	if (key == 0x2E)  // VK_DELETE
		RemoveNode()
}

function MoveUpNode()
{
	// elemento corrente
	var curDatapath = app.HMIGetElementData(m_mainTree, "")
	var node = app.SelectNodesXML(curDatapath)[0]
	
	MoveUpNode_private(node)
	
	// si riposiziona sul nodo nella nuova posizione
	var treepath = app.HMIGetElementPath(m_mainTree, app.GetDataPathFromNode(node))
	app.HMISetCurElement(m_mainTree, treepath ? treepath : "/ROOT")
	
	if (m_openWindowOnDblClick)
		app.OpenWindow("emptypage", "", "");
}

// sposta un nodo xml che ha corrispondenza nell'albero prima del precedente. funzione interna da non chiamare dall'esterno!
function MoveUpNode_private(node)
{
	var curDatapath = app.GetDataPathFromNode(node)
	var curTreepath = app.HMIGetElementPath(m_mainTree, curDatapath)
	
	var prev = node.previousSibling
	if (!prev || !prev.getAttribute("hasDatalink"))
		return   // non c'è un nodo precedente (o il nodo precedente non ha collegamento con l'abero) prima del quale spostare, esce
		
	var parent = node.parentNode

	// cancella il nodo da spostare dall'albero (SOLO dall'albero)
	app.HMIRemoveElement(m_mainTree, curTreepath)
	
	// salva il path del nodo xml precedente prima di inserire il nuovo; deve passare il path vecchio alla ParseNode perchè i nodi dell'albero fanno riferimento a lui
	var prevDatapath = app.GetDataPathFromNode(prev)
	// sposta il nodo xml nella nuova posizione, prima di prev
	parent.insertBefore(node, prev)
	// la parseNode andrà ad inserire il nodo dell'albero nel posto giusto
	app.ParseNode(node, prevDatapath, enuOperationPos.opInsertBefore)

	app.ModifiedFlag = true
}

function MoveDownNode()
{
	var curDatapath = app.HMIGetElementData(m_mainTree, "")
	var node = app.SelectNodesXML(curDatapath)[0]
	
	var next = node.nextSibling
	if (!next || !next.getAttribute("hasDatalink"))
		return   // non c'è un nodo successivo (o il nodo successivo non ha collegamento con l'abero) dopo il quale spostare, esce
	
	// riconduce il move down al move up del successivo
	MoveUpNode_private(next)
	
	// si riposiziona sul nodo nella nuova posizione
	var treepath = app.HMIGetElementPath(m_mainTree, app.GetDataPathFromNode(node))
	app.HMISetCurElement(m_mainTree, treepath ? treepath : "/ROOT")
	
	if (m_openWindowOnDblClick)
		app.OpenWindow("emptypage", "", "");
}


//------------------------------------------------------------------ GESTIONES GRID ----------------------------------------------
// ATTENZIONE: richiesta AxEditGrid.OCX >= 3.0.5 !

function ShowGridColumns()
{
	var grid = app.TempVar("CurrentGrid")
	// mostra dialog per selezione colonne da mostrare
	if (grid.ShowColumnsDlg())
		// scatena evento come se la colonna fosse stata ridimensionata (per settare m_gridColumnsChanged=true)
		grid.Fire_EndColTrack(0)
}

function HideGridColumn()
{
	var grid = app.TempVar("CurrentGrid")
	var col = app.TempVar("CurrentGrid_col")
	// nasconde la colonna selezionata portando larghezza a 0
	grid.ColWidth(col) = 0
	// scatena evento come se la colonna fosse stata ridimensionata (per settare m_gridColumnsChanged=true)
	grid.Fire_EndColTrack(col)
}

function GridGetSelections(grid)
{
	var list = []
	
	var multisel = grid.GetSelections()
	if (multisel != undefined)
		// multiselezione
		list = FromSafeArray(multisel)
	
	if (list.length == 0 && grid.NumRows != 0)
		list = [ grid.SelectedRow ]
		
	return list
}

function CheckGridSorting(datapath)
{
	// il move up/down con la griglia ordinata farebbe solo confusione, obbliga prima a rimuovere l'ordinamento
	var sortCol = app.TempVar("GridSortColumn_" + datapath)
	if (sortCol != undefined)
	{
		app.MessageBox(app.Translate("Can not move rows while the grid is sorted.\nRemove the sorting by clicking the first column and try again"), "", MSGBOX.MB_ICONEXCLAMATION)
		return false
	}
	else
		return true
}

function GridMoveUp()
{
	var grid = app.TempVar("CurrentGrid")
	var datapath = app.TempVar("CurrentGrid_dataPath")
	var selectNodesFunc = app.TempVar("CurrentGrid_selectNodesFunc")
	var datapath_filterString = app.TempVar("CurrentGrid_dataPathFilterString")
	if (grid == undefined || datapath == undefined)
		return false
	
	if (!datapath_filterString)
		datapath_filterString = "*"
	
	if (!CheckGridSorting(datapath))
		return false
		
	var list = GridGetSelections(grid)
	if (!list || list.length == 0) return

	if (list[0] == 0)
		return false   // impossibile spostare in alto se la prima riga è selezionata
			
	// esce da editing
	grid.EditMode(false)
	
	for (var i = 0; i < list.length; i++)
	{
		var row = list[i]
		var xpath = datapath + "/" + datapath_filterString + "[" + (row+1) + "]"
		if (selectNodesFunc)
			var nodelist = selectNodesFunc(xpath)
		else
			var nodelist = app.SelectNodesXML(xpath)
		
		if (nodelist.length == 0)
			return false
			
		var node = nodelist[0]
		var prevnode = node.previousSibling
		if (!prevnode)
			return false

		node.parentNode.insertBefore(node, prevnode)
		grid.Move(row - 1, 0)
		
		grid.Update(row - 1, -1)
		grid.Update(row, -1)
	}
	
	// crea nuova lista delle selezioni scalate in alto di 1
	var newlist = []
	for (var i = 0; i < list.length; i++)
		newlist.push( list[i] - 1 )
	
	// converte in safearray e lo passa alla griglia
	grid.SetSelections(ToSafeArray(newlist))
	
	grid.EditMode(false)
	app.ModifiedFlag = true
	
	return true
}

function GridMoveDown()
{
	var grid = app.TempVar("CurrentGrid")
	var datapath = app.TempVar("CurrentGrid_dataPath")
	var selectNodesFunc = app.TempVar("CurrentGrid_selectNodesFunc")
	var datapath_filterString = app.TempVar("CurrentGrid_dataPathFilterString")
	if (grid == undefined || datapath == undefined)
		return false
	
	if (!datapath_filterString)
		datapath_filterString = "*"
	
	if (!CheckGridSorting(datapath))
		return false
		
	var list = GridGetSelections(grid)
	if (!list || list.length == 0) return

	if (list[list.length-1] == grid.NumRows-1)
		return false   // impossibile spostare in basso se l'ultima riga è selezionata
			
	// esce da editing
	grid.EditMode(false)
	
	for (var i = list.length-1; i >= 0 ; i--)
	{
		var row = list[i]
		var xpath = datapath + "/" + datapath_filterString + "[" + (row+1) + "]"
		if (selectNodesFunc)
			var nodelist = selectNodesFunc(xpath)
		else
			var nodelist = app.SelectNodesXML(xpath)
			
		if (nodelist.length == 0)
			return false
			
		var node = nodelist[0]
		var nextnode = node.nextSibling
		if (!nextnode)
			return false

		node.parentNode.insertBefore(node, nextnode.nextSibling)
		grid.Move(row + 1, 0)
		
		grid.Update(row + 1, -1)
		grid.Update(row, -1)
	}

	// crea nuova lista delle selezioni scalate in basso di 1
	var newlist = []
	for (var i = 0; i < list.length; i++)
		newlist.push( list[i] + 1 )
	
	// converte in safearray e lo passa alla griglia
	grid.SetSelections(ToSafeArray(newlist))
	
	grid.EditMode(false)
	app.ModifiedFlag = true
	
	return true
}

function UpdateGridMove()
{
	var grid = app.TempVar("CurrentGrid")
	var datapath = app.TempVar("CurrentGrid_dataPath")
	if (grid == undefined || datapath == undefined)
		return 0
	else
		return 1
}

var GRID_CLIPBOARD_PREFIX = ""
var GRID_CLIPBOARD_COLSEP = "\t"
var GRID_CLIPBOARD_ROWSEP = "\n"

// permette di modificare le caratteristiche di copy/paste della griglia
function GridClipboardSetup( prefix, colsep, rowsep )
{
	if ( prefix != undefined )
		GRID_CLIPBOARD_PREFIX = prefix
	if ( colsep != undefined )
		GRID_CLIPBOARD_COLSEP = colsep
	if ( rowsep != undefined )
		GRID_CLIPBOARD_ROWSEP = rowsep
}

function GridCut()
{
	GridCopy()
	GridCut_DeleteRows()
}

// cancella le righe selezionate, sono state appena copiate
function GridCut_DeleteRows()
{
	var grid = app.TempVar("CurrentGrid")
	var dataPath = app.TempVar("CurrentGrid_dataPath")
	var rowTemplate = app.TempVar("CurrentGrid_rowTemplate")
	var deleteRowFunc = app.TempVar("CurrentGrid_deleteRowFunc")
	
	if (!grid || !dataPath || !rowTemplate || grid.NumRows <= 0) return
	
	var list = GridGetSelections(grid)
	if (!list || list.length == 0) return

	for (var i = list.length - 1; i >= 0; i--)
		if (deleteRowFunc)
			deleteRowFunc(dataPath + "/*[" + (list[i]+1) + "]")
		else
			app.DataDelete(dataPath + "/*[" + (list[i]+1) + "]", 0)
	
	grid.DeleteRows(list.length)
}

// restituisce stringa con i record copiati dalla griglia
function GetGridCopyBuffer(rowList)
{
	var grid = app.TempVar("CurrentGrid")
	var getCurValueFunc = app.TempVar("CurrentGrid_getCurValueFunc")
	if (!grid || grid.NumRows <= 0) return
	
	var buf = ""
	if (!rowList)
		rowList = GridGetSelections(grid)
		
	if (!rowList || rowList.length == 0) return

	// crea il buffer iterando sulle linee selezionate
	var rowIdx, col
	for (rowIdx = 0; rowIdx < rowList.length; rowIdx++)
	{
		for (col = 0; col < grid.NumCols; col++)
		{
			if (getCurValueFunc)
				// utilizza funzione callback speciale per ottenere nuovo valore
				buf += getCurValueFunc(rowList[rowIdx], col )
			else
				buf += grid.Elem(rowList[rowIdx], col)
			
			// aggiunge separatore se non ultima colonna
			if (col < grid.NumCols-1)
				buf += GRID_CLIPBOARD_COLSEP
		}
		
		// aggiunge separatore se non ultima riga
		if (rowIdx < rowList.length-1)
			buf += GRID_CLIPBOARD_ROWSEP
	}
	
	return buf
}

function GridCopy()
{
	var buf = GetGridCopyBuffer()
	app.Clipboard = GRID_CLIPBOARD_PREFIX + buf
}

function UpdateGridPaste()
{
	if (!app.IsClipboardAvailable())
		return 0
		
	var len = GRID_CLIPBOARD_PREFIX.length
	var buf = app.Clipboard
	return (buf.substr(0, len) == GRID_CLIPBOARD_PREFIX) ? 1 : 0
}

// paste normale
function GridPaste()
{
	if (!UpdateGridPaste())
		// se paste non abilitato esce
		return
		
	var grid = app.TempVar("CurrentGrid")
	if (!grid) return
	DoGridPaste(grid, grid.NumRows, true, app.Clipboard)
}

// incolla prima della posizione attuale (se la griglia non è vuota)
function GridPasteBefore()
{
	if (!UpdateGridPaste())
		// se paste non abilitato esce
		return
		
	var grid = app.TempVar("CurrentGrid")
	if (!grid) return
	
	if (grid.NumRows > 0)
		DoGridPaste(grid, grid.SelectedRow, false, app.Clipboard)
	else
		GridPaste()
}

function DoGridPaste(grid, destrow, pasteAtEnd, buf)
{
	var dataPath = app.TempVar("CurrentGrid_dataPath")
	var rowTemplate = app.TempVar("CurrentGrid_rowTemplate")
	var getNewValueFunc = app.TempVar("CurrentGrid_getNewValueFunc")
	var addTemplateDataFunc = app.TempVar("CurrentGrid_addTemplateDataFunc")
	
	if (!grid || !dataPath || !rowTemplate || !buf)
		return 0
	
	var len = GRID_CLIPBOARD_PREFIX.length
	buf = buf.substr(len)
	
	var rows = buf.split(GRID_CLIPBOARD_ROWSEP)
	var addedRows = 0
	
	for (var row = 0; row < rows.length; row++)
	{
		var cols = rows[row].split(GRID_CLIPBOARD_COLSEP)
		if (cols.length != grid.NumCols)
			continue    // verifica coincidenza numero colonne
		
		if (pasteAtEnd)
		{
			if (addTemplateDataFunc)
				addTemplateDataFunc(rowTemplate, dataPath, true)
			else
				app.AddTemplateData(rowTemplate, dataPath, enuOperationPos.opAppend, false)
		}
		else
		{
			if (addTemplateDataFunc)
				addTemplateDataFunc(rowTemplate, dataPath + "/*[" + (destrow+1) + "]", false)
			else
				app.AddTemplateData(rowTemplate, dataPath + "/*[" + (destrow+1) + "]", enuOperationPos.opInsertBefore, false)
		}
		
		grid.InsertRows(1)
		
		//aggiorno la selezione per evitare di disassegnare la variabile
		//la funzione di callback infatti è la stessa usata dalla setelemes sul nome, che disassenga la vecchia var
		if (pasteAtEnd)
			grid.Move(grid.GetRealRow(grid.NumRows-1), 0)
		else
			grid.Move(grid.GetRealRow(destrow), 0)
		
		for (var col = 0; col < cols.length; col++)
		{
			if (getNewValueFunc)
				// utilizza funzione callback speciale per ottenere nuovo valore
				var value = getNewValueFunc(row, col, cols[col], cols, destrow)
			else
				var value = cols[col]
				
			if (value !== null)
				grid.Elem(destrow, col) = value;
		}
		
		grid.Update(destrow, -1)

		addedRows++
		if ( app.TempVar("CurrentGrid_logPastedRows") == true )
			AddLog(enuLogLevels.LEV_INFO, "Clipboard paste", "Pasted row: " + rows[row] )
		
		destrow++
		if (pasteAtEnd && destrow > grid.NumRows)
			break
	}
	
	if ( app.TempVar("CurrentGrid_logPastedRows") == true )
		AddLog(enuLogLevels.LEV_INFO, "Clipboard paste", "Pasted rows: " + addedRows )
		
	if (addedRows != 0)
		app.ModifiedFlag = true
	
	return addedRows
}



//------------------------------------------------------------------ COPIA/INCOLLA ALBERO ----------------------------------------------

// prefisso per il xpath di origine nella clipboard per il tree
var TREE_CLIPBOARD_PREFIX = "TREE:"
var m_clipboardCut = false

function TreeCopy()
{
	var curdata = app.HMIGetElementData(m_mainTree, "")
	if (!curdata)
		return
	
	app.Clipboard = TREE_CLIPBOARD_PREFIX + curdata
	m_clipboardCut = false
}

function TreeCut()
{
	var curdata = app.HMIGetElementData(m_mainTree, "")
	if (!curdata)
		return
	
	app.Clipboard = TREE_CLIPBOARD_PREFIX + curdata
	m_clipboardCut = true
}

function TreePaste()
{
	var destpath = app.HMIGetElementData(m_mainTree, "")
	
	var srcpath = app.Clipboard
	if (srcpath == undefined || srcpath == "" || srcpath.substr(0, TREE_CLIPBOARD_PREFIX.length) != TREE_CLIPBOARD_PREFIX || destpath == undefined || destpath == "")
		return
	srcpath = srcpath.substr(TREE_CLIPBOARD_PREFIX.length)
	
	// estrae nodo di origine
	var nodeslist = app.SelectNodesXML(srcpath)
	if (nodeslist.length == 0)
		return
	var srcnode = nodeslist[0]
	
	// estrae nodo destinazione
	nodeslist = app.SelectNodesXML(destpath)
	if (nodeslist.length == 0)
		return
	var destnode = nodeslist[0]
	
	if (m_useCatalog)
	{
		// protocollo del nodo destinazione
		var protocol = destnode.getAttribute("protocol")
		if (!protocol) return
		
		// verifica che la sorgente supporti il protocollo destinazione
		var query = GetProtocolQuery(protocol, srcnode.nodeName)
		var nodeslist = app.CallFunction("catalog.Query", query)
		if (!nodeslist || nodeslist.length == 0)
		{
			var msg = app.Translate("Wrong protocol, can not paste") //translate
			app.MessageBox(msg, "", MSGBOX.MB_ICONEXCLAMATION)
			return
		}
	}

	// verifica numero massimo di nodi figli
	var maxSlaves = parseInt(destnode.getAttribute("maxSlaves"))
	if (maxSlaves > 0)
	{
		// conteggio nodi slaves e verifica se oltre il max
		var count = destnode.selectNodes("*[@insertable]").length
		if (count >= maxSlaves)
		{
			app.MessageBox(app.Translate("Can not add another element:\nmaximum number of childs is ") + maxSlaves, "", MSGBOX.MB_ICONEXCLAMATION)  //translate
			return
		}
	}
		
	// duplica nodo e tutto il suo albero
	var newnode = srcnode.cloneNode(true)
	destnode.appendChild(newnode)
	
	var IDmapping = {}
	
	// crea mappa con tutte le caption in uso
	var allCaptionsMap = {}
	nodeslist = app.SelectNodesXML("//*[@caption]")
	while (node = nodeslist.nextNode())
		allCaptionsMap[node.getAttribute("caption")] = true
	
	// rigenera nuovi uniqueID e caption per il nodo stesso e tutti i figli aventi attributo "uniqueID"
	nodeslist = newnode.selectNodes("descendant-or-self::*[@uniqueID]")
	while (node = nodeslist.nextNode())
	{
		// se è un copia rigenera la caption
		if (!m_clipboardCut)
		{
			var noAutoGenCaption = ParseBoolean(node.getAttribute("noAutoGenCaption"))
			if (!noAutoGenCaption)
			{
				var newcaption = GenerateCaption(node.nodeName, node.getAttribute("name"), allCaptionsMap)
				node.setAttribute("caption", newcaption)
				// aggiunge la nuova caption alla mappa
				allCaptionsMap[newcaption] = true
			}
		}
		
		// creazione nuovo id se copia oppure se taglia e flag m_treeCut_regenerateID attivo
		if (!m_clipboardCut || m_treeCut_regenerateID)
		{
			var oldID = node.getAttribute("uniqueID")
			var newID = AssignUniqueID_node(node)
			IDmapping[newID] = oldID
		}
	}
	
	// parsa il nodo (per eventuali onloadnode, inserimento albero ecc)
	app.ParseNode(newnode)
	
	// chiama l'eventuale funzione di onpastenode, per permettere eventuali operazioni di copia custom (es gfx4)
	nodeslist = newnode.selectNodes("descendant-or-self::*[@uniqueID and @onpastenode]")
	while (node = nodeslist.nextNode())
	{
		var ID = node.getAttribute("uniqueID")
		if (IDmapping[ID] != undefined)
			ID = IDmapping[ID]
			
		var originalNode = srcnode.selectSingleNode("descendant-or-self::*[@uniqueID = " + ID + "]")
		app.CallFunction(node.getAttribute("onpastenode"), node, originalNode, m_clipboardCut, (node == newnode))
	}
	
	if (m_clipboardCut)
		// se operazione di taglia cancella il nodo originale
		app.DataDelete(srcpath, 0)
		
	// invia messaggio broadcast
	app.SendMessage("DeviceAdded", app.GetDataPathFromNode(newnode))
	
	app.ModifiedFlag = true
}

// verifica validità del comando paste sull'albero controllando il prefisso
function UpdateTreePaste(cmd)
{
	if (!app.IsClipboardAvailable())
		return 0
		
	var path = app.Clipboard
	return (path.substr(0, TREE_CLIPBOARD_PREFIX.length) == TREE_CLIPBOARD_PREFIX) ? 1 : 0
}


//------------------------------------------------------------------ COMPILAZIONE ----------------------------------------------
function OutputClick(idx, text, itemdata)
{
	GoToFieldPath(itemdata)
}

function GoToFieldPath(itemdata)
{
	if (!itemdata || !itemdata.dataPath)
		return
		
	if (itemdata.treePath)
		// se specificato attiva l'elemento dell'albero
		app.HMISetCurElement(m_mainTree, itemdata.treePath)
	
	// setta le variabili temporanee con la posizione dell'errore
	app.TempVar("ErrorPath") = itemdata.fullPath
	app.TempVar("ErrorRow") = itemdata.row
	app.TempVar("ErrorCol") = itemdata.column

	if (itemdata.page)
		// se specificata apre la pagina contenente l'elemento in errore
		app.OpenWindow(itemdata.page, "", itemdata.dataPath)
		
	if (itemdata.callback)
		itemdata.callback(itemdata);
}

var m_logs = []

function ClearLogs()
{
	m_logs = []
}

function AddLog(level, location, msg, err)
{
	var newlog = new Object()
	newlog.level = level
	newlog.location = location
	newlog.msg = msg
	if (err)
	{
		newlog.dataPath = err.dataPath      // datapath del nodo xml da passare come datapath alla pagina
		newlog.fullPath = err.fullPath      // path del nodo xml dell'elemento da evidenziare (relativo a dataPath)
		newlog.row = err.row                // se tabella, numero di riga del record in errore
		newlog.column = err.column          // se tabella, nome della colonna del campo in errore
		newlog.treePath = err.treePath      // path dell'elemento dell'albero da evidenziare
		newlog.page = err.page              // pagina da aprire
		newlog.callback = err.callback      // funzione da chiamare su apertura
	}
	
	m_logs.push(newlog)
	
	if (location != "" && level != enuLogLevels.LEV_INFO)
		msg = "(" + location + ") " + msg
		
	if (level == enuLogLevels.LEV_WARNING)
		msg = "WARNING: " + msg
	else if (level == enuLogLevels.LEV_ERROR || level == enuLogLevels.LEV_CRITICAL)
		msg = "ERROR: " + msg
	
	app.PrintMessage(msg, level, newlog)
	return level
}

function GetLogs()
{
	return m_logs
}

function SplitFieldPath(node, attributeName)
{
	
	if (!node) return
	
	var result = {}
	
	// identifica se il nodo è un campo di un record di una tabella
	var istable
	if (ParseBoolean(node.getAttribute("isTableRow")))
	{
		// il nodo è un header di record di tabella: come colonna prende il primo campo
		istable = true
		if (node.firstChild)
			result.column = node.firstChild.nodeName
		else if (attributeName)
			// il nodo non ha figli ma è specificato un attributo, si suppone sia la colonna in errore
			result.column = "@" + attributeName
	}
	else if (node.parentNode != null && ParseBoolean(node.parentNode.getAttribute("isTableRow")))
	{
		// il nodo è un campo di record, procede con l'elaborazione col nodo parent (header di record)
		istable = true
		result.column = node.nodeName
		node = node.parentNode
	}
	else
		istable = false
	
	// disattiva log per evitare messaggi di elemento non trovato da parte di app.HMIGetElementPath()
	var oldmask = app.LogMask
	app.LogMask = 0
	
	// partendo dal nodo, risale di livello uno step alla volta in cerca di un padre avente un elemento dell'albero associato e una pagina associata
	var parent = node
	result.treePath = ""
	while (parent)
	{
		if (!result.page && parent.getAttribute("locationPage"))
			// il nodo ha una pagina specificata esplicitamente con locationPage
			// tale attributo ha la caratteristica di essere ereditato dal primo padre che ce l'ha
			result.page = parent.getAttribute("locationPage")
		
		// verifica se il nodo in esame ha associato un elemento del tree
		result.treePath = app.HMIGetElementPath(m_mainTree, app.GetDataPathFromNode(parent))
		
		if (result.treePath && !result.page)
			// non ancora trovata una pagina con locationPage, cerca la pagina di default dell'elemento del tree
			result.page = app.HMIGetLinkedWindow(m_mainTree, result.treePath)
		
		if (result.treePath && result.page)
			// esce quando trova un'elemento dell'albero e una pagina associati
			break
		else
			// risale al padre
			parent = parent.parentNode
	}
	
	app.LogMask = oldmask
	if (!result.treePath)
		return  // in realtà non dovrebbe mai succedere, risalendo la catena una pagina dovrebbe esserci per forza...

	// path del device padre ("titolare" della finestra)
	result.dataPath = app.GetDataPathFromNode(parent)
	
	// path completo nel nodo
	var path = app.GetDataPathFromNode(node)
	
	// se tabella spezza, ES:    config/vars/var[4]  ->   path = config/vars,  row = 4
	if (istable && path.substr(path.length-1, 1) == "]")
	{
		var pos = path.lastIndexOf("[")
		result.row = parseInt(path.substring(pos+1, path.length-1)) - 1
		path = path.substr(0, path.lastIndexOf("/"))
	}
	else if (attributeName)
		// se è stato specificato una attributo del nodo lo aggiunge come stringa al path
		// non è infatti possibile risalire da un IXMLDOMAttribute al suo parent IXMLDOMElement
		path += "/@" + attributeName
		
	result.fullPath = path
	return result
}



// --------------------------------------- GESTIONE FILES INI ----------------------------------
function INIFile(path)
{
	this.path = path
	this.sections = new Object
	this.putBlankSeparator = false
	this.caseSensitive = true
}

function NewINI(path)
{
	return new INIFile(path)
}

function ReadINI(inipath, caseSensitive)
{
	if (!m_fso.FileExists(inipath))
		return
		
	var f = m_fso.OpenTextFile(inipath, enuOpenTextFileModes.ForReading)
	var s
	var ini = new INIFile(inipath)
	
	if (caseSensitive != undefined)
		ini.caseSensitive = caseSensitive
		
	var sectionName, key, value
	var section
	
	while (!f.AtEndOfStream)
	{
		s = f.ReadLine()
		if (s.length == 0)
			continue
			
		// commento
		if(s.indexOf(";") == 0)
			continue;
			
		if (s.substr(0, 1) == "[" && s.substr(s.length-1, 1) == "]")
		{
			if (section)
				ini.sections[sectionName] = section
				
			section = new Object
			sectionName = Trim(s.substr(1, s.length-2));
			
			if (!ini.caseSensitive)
				sectionName = sectionName.toUpperCase()
		}
		else if (section)
		{
			var pos = s.indexOf("=")
			if (pos != -1)
			{
				key = Trim(s.substr(0, pos));
				value = Trim(s.substr(pos+1));
				
				if (!ini.caseSensitive)
					key = key.toUpperCase()
					
				section[key] = value
			}
		}
	}
	f.Close()
	
	if (section)
		ini.sections[sectionName] = section
		
	return ini
}

function ReadUTF16INI(inipath, caseSensitive)
{
	if (!m_fso.FileExists(inipath))
		return
	
	var strData;
	// lettura unicode UTF16
	var objStream = new ActiveXObject("ADODB.Stream");
	objStream.CharSet = "utf-16";
	objStream.Open();
		
	try
	{
		objStream.LoadFromFile(inipath)
		strData = objStream.ReadText()
	}
	catch (ex)
	{
		return;
	}
		
	objStream.Close();
	
	var s
	var ini = new INIFile(inipath)
	
	if (caseSensitive != undefined)
		ini.caseSensitive = caseSensitive
		
	var sectionName, key, value
	var section
	
	var rows = strData.split("\n");	
	for (var i = 0; i < rows.length; i++)
	{
		var s = rows[i];
		s = s.replace(/(\r\n|\n|\r)/gm, ""); // pulizia
		
		if (s.length == 0)
			continue
			
		// commento
		if(s.indexOf(";") == 0)
			continue;
			
		if (s.substr(0, 1) == "[" && s.substr(s.length-1, 1) == "]")
		{
			if (section)
				ini.sections[sectionName] = section
				
			section = new Object
			sectionName = s.substr(1, s.length-2)
			
			if (!ini.caseSensitive)
				sectionName = sectionName.toUpperCase()
		}
		else if (section)
		{
			var pos = s.indexOf("=")
			if (pos != -1)
			{
				key = s.substr(0, pos)
				value = s.substr(pos+1)
				
				if (!ini.caseSensitive)
					key = key.toUpperCase()
					
				section[key] = value
			}
		}
	}
	
	if (section)
		ini.sections[sectionName] = section
		
	return ini
}

INIFile.prototype.WriteINI = function (path,headerComment)
{
	if ((path == "" || path == undefined) && this.path != "")
		path = this.path
		
	MakeBackup(path)
	var f = SafeCreateTextFile(path)
	var name, key
	
	if (headerComment)
		f.WriteLine(";" + headerComment )
	
	for (name in this.sections)
	{
		f.WriteLine("[" + name + "]")
		
		var curSection = this.sections[name]
		for (key in curSection)
			f.WriteLine(key + "=" + curSection[key])
			
		if (this.putBlankSeparator)
			f.WriteLine("") // riga vuota di separazione dopo ogni sezione
	}
	f.Close()
}

INIFile.prototype.GetINIValue = function (section, key, undefinedIfNotFound)
{
	if (section == "" || key == "")
		return ""
	
	if (!this.caseSensitive)
	{
		section = section.toUpperCase()
		key = key.toUpperCase()
	}
	
	var curSection = this.sections[section]
	if (curSection != undefined)
	{
		var value = curSection[key]
		if (value != undefined)
			return value
	}
	
	if (undefinedIfNotFound)
		return undefined
	else
		return ""
}

INIFile.prototype.GetINISection = function (section)
{
	if (!this.caseSensitive)
		section = section.toUpperCase()
	
	return this.sections[section]
}

INIFile.prototype.PutINIValue = function (section, key, value)
{
	if (value == undefined)
		AddLog(enuLogLevels.LEV_WARNING, "PutINIValue", "INI: value for " + section + "." + key + " is undefined")
	else if (value == null)
		AddLog(enuLogLevels.LEV_WARNING, "PutINIValue", "INI: value for " + section + "." + key + " is null")
	else if (typeof value == "number" && isNaN(value))
		AddLog(enuLogLevels.LEV_WARNING, "PutINIValue", "INI: value for " + section + "." + key + " is NaN")
		
	if (section == "" || key == "")
		return
	
	var curSection = this.sections[section]
	if (curSection == undefined)
	{
		curSection = new Object
		this.sections[section] = curSection
	}
	
	curSection[key] = value
}


// --------------------------------------------- GESTIONE TIPI IEC ----------------------------------------
// dimensione in bytes del tipo iec
var m_IECTypeSize = {BOOL: 1, SINT: 1, USINT: 1, BYTE: 1, INT: 2, UINT: 2, WORD: 2, DINT: 4, UDINT: 4, DWORD: 4, LINT: 8, ULINT: 8, REAL: 4, LREAL: 8, TIME: 4, LWORD: 8 }

function GetIECTypeSize(type)
{
	return m_IECTypeSize[type]
}

// dimensione in bits del tipo iec
var m_IECTypeBits = {BOOL: 1, SINT: 8, USINT: 8, BYTE: 8, INT: 16, UINT: 16, WORD: 16, DINT: 32, UDINT: 32, DWORD: 32, LINT: 64, ULINT: 64, REAL: 32, LREAL: 64, TIME: 32, LWORD: 64 }

function GetIECTypeBits(type)
{
	return m_IECTypeBits[type]
}

function GetAllIECTypeBits()
{
	return m_IECTypeBits
}

function IsIECTypeSigned(iectype)
{
	return (iectype == "SINT" || iectype == "INT" || iectype == "DINT" || iectype == "LINT" || iectype == "REAL" || iectype == "LREAL")
}

var m_IECTypeLimits = {
	BOOL:  { min:0, max:1 },
	SINT:  { min:-0x7F-1, max:0x7F },								USINT: { min:0, max:0xFF },
	INT:   { min:-0x7FFF-1, max:0x7FFF },							UINT:  { min:0, max:0xFFFF },
	DINT:  { min:-0x7FFFFFFF-1, max:0x7FFFFFFF },					UDINT: { min:0, max:0xFFFFFFFF },
	LINT:  { min:-0x7FFFFFFFFFFFFFFF-1, max:0x7FFFFFFFFFFFFFFF },	ULINT: { min:0, max:0xFFFFFFFFFFFFFFFF },
	REAL:  { min:-3.4e+38, max:3.4e+38 },							LREAL: { min:-1.7e+308, max:1.7e+308 },
	BYTE:  { min:0, max:0xFF },		WORD: { min:0, max:0xFFFF }, 	DWORD: { min:0, max:0xFFFFFFFF },	LWORD: { min:0, max:0xFFFFFFFFFFFFFFFF }
}

function GetIECTypeLimits(type)
{
	return m_IECTypeLimits[type]
}

function ParseDataBlock(value)
{
	if (value.substr(0,1) == "%")
		value = value.substr(1)  // toglie eventuale % iniziale
		
	var result = {}
	result.area = value.substr(0,1)
	result.type = value.substr(1,1)
	var pos  = value.indexOf(".")
	
	if (!result.area || !result.type || pos == -1)
		return false
	
	if (result.area != "I" && result.area != "Q" && result.area != "M")
		return false
	if (result.type != "X" && result.type != "B" && result.type != "W" && result.type != "D" && result.type != "R" && result.type != "Q" && result.type != "L")
		return false
		
	result.datablock = parseInt(value.substr(2, pos-2))
	result.offset    = parseInt(value.substr(pos+1))
	return result
}

// compara due indirizzi datablock, a meno dell'indicatore di dimensione, che è "cosmetico" e non indicativo dell'indirizzo stesso
function CompareDatablocks(db1, db2)
{
	if (db1.slice(0,-1) == "*")
		// se datablock unspecified fa comparazione esatta di stringhe
		return db1 == db2;
	else
		// omette il 3o carattere: %MD101.28 == %MX101.28
		return db1.substr(0,2) == db2.substr(0,2) && db1.substr(3) == db2.substr(3);
}

// verifica se il nome di tipo specificato è IEC standard
function IsIECType(type)
{
	return (type == "STRING") || (type == "WSTRING") || (type in m_IECTypeSize);
}
