#include WebServer.js

var m_targetID = app.CallFunction("logiclab.get_TargetID");

var APIJSON_FOLDER_NAME = "apijson";

var m_isBigEndian = false;
var m_isModbus = true;

var WS_FS_SIZEOF_MAGIC		= 4		//	0xAEB5E81E
var WS_FS_SIZEOF_CRC32		= 4		//	crc32
var WS_FS_SIZEOF_BLOBSIZE	= 4		//	size del blob (dati + campo numrecs). il calcolo del crc32 avviene su questa area
var WS_FS_SIZEOF_NUMRECS	= 4		//	numero di record nel fs

var WS_FS_REC_SIZEOF_RECSIZE	= 4	//	uint32_t recSize;	//	dimensione totale del record ( header + filesize )
var WS_FS_REC_SIZEOF_PATHSIZE	= 2	//	uint16_t pathSize;	//	dimensione del campo path name (len + terminatore)
var WS_FS_REC_SIZEOF_FLAGS		= 2	//	uint16_t flags;		//	cartella o file?
var WS_FS_REC_SIZEOF_FILESIZE	= 4	//	uint32_t fileSize;	//	dimensione del file
var WS_FS_REC_SIZEOF_HEADER		= WS_FS_REC_SIZEOF_RECSIZE + WS_FS_REC_SIZEOF_PATHSIZE + WS_FS_REC_SIZEOF_FLAGS + WS_FS_REC_SIZEOF_FILESIZE

var WS_FILE_REC_FLAG_IS_FILE		= 1
var WS_FILE_REC_FLAG_IS_DIRECTORY	= 2

var WS_MAGIC = 0xAEB5E81E

var IPA_WEBSERVER_SITE_BASEADDRESS	= 65220
var IPA_WEBSERVER_SITE_MAXSIZE		= 65222
var IPA_WEBSERVER_SITE_COMMAND		= 65224
var IPA_WEBSERVER_SITE_STATUS		= 65226

var WEB_SERVER_CMD_START = 1
var WEB_SERVER_CMD_STOP = 2

var WS_PACKET_SIZE = 128
var WS_ERASE_FLASH_TIMEOUT = 10000
var WS_WRITE_FLASH_TIMEOUT = 5000
var WS_VALIDATE_TIMEOUT = 10000

var WS_DEBUG = false

var INCLUDE_SYS_PAR = false // include parametri e enum di sistema, richiede USE_CONFIGURATOR = true

var m_TypeParToCfg = { 0:"short", 1:"int", 2:"unsignedShort", 3:"unsignedInt", 4:"float", 5:"boolean", 6: "char", 7:"unsignedChar", 8:"string" }

var IEC_TYPES_TO_CSV = {
	"INT"	: { type: "SS", size: 1 },
	"DINT"	: { type: "SL", size: 2 },
	"WORD"	: { type: "US", size: 1 },
	"DWORD"	: { type: "UL", size: 2 },
	"REAL"	: { type: "SF", size: 2 },
	"BOOL"	: { type: "UB", size: 1 },
	"STRING": { type: "ST", size: -1},
	"SINT"	: { type: "SB", size: 1 },
	"BYTE"	: { type: "UB", size: 1 },
	"USINT"	: { type: "UB", size: 1 },
	"UINT"	: { type: "US", size: 1 },
	"UDINT"	: { type: "UL", size: 2 }
}

var CFG_TYPES_TO_IEC = {
	"short": "INT",
	"int": "DINT",
	"unsignedShort": "WORD",
	"unsignedInt": "DWORD",
	"float": "REAL",
	"boolean": "BOOL",
	"string": "STRING",
	"char": "SINT",
	"unsignedChar": "BYTE",
	"unsignedChar": "USINT",
	"unsignedShort": "UINT",
	"unsignedInt": "UDINT"
}

function IsEmbeddedWebServer()
{
	return true
}

function GetDownloadDir() {
	return app.CallFunction(app.CallFunction("logiclab.get_TargetID") + ".GetConfDir");
}

function GetWebsiteFilename()
{
	return GetDownloadDir() + "website.bin";
}

function BrowseFolder(folder, wsPathString, wsList)
{	
	var wsListItem = {}
	wsListItem.isFolder = true
	wsListItem.fullPath = folder.Path
	wsListItem.wsPath = wsPathString
	wsList.push( wsListItem )
	
	if (WS_DEBUG)
	{
		app.PrintMessage("Folder: '" + folder.Name + "' - '" + wsPathString + "'")
	}
	
	// iterazione su tutte le sottocartelle di primo livello (saranno ModbusCustom o CANcustom o EtherCATcustom)
	for (var enDirs = new Enumerator(folder.SubFolders); !enDirs.atEnd(); enDirs.moveNext())
	{
		var subFolder = enDirs.item()
				
		BrowseFolder(subFolder, wsPathString + "\\" + subFolder.Name, wsList)
	}
	
	// iterazione su tutti i files
	for (var enFiles = new Enumerator(folder.Files); !enFiles.atEnd(); enFiles.moveNext())
	{
		var f = enFiles.item()
		var filepath = f.Path
		var wsFilePathStr = wsPathString + "\\" + f.Name
		
		var wsListItem = {}
		wsListItem.isFolder = false
		wsListItem.fullPath = filepath
		wsListItem.wsPath = wsFilePathStr
		wsList.push( wsListItem )
		
		if (WS_DEBUG)
		{
			app.PrintMessage("File: '" + f.Name + "' - '" + wsFilePathStr + "'")
		}
	}
	
	return
}

function EncodeWORD(list, value)
{
	if ( m_isBigEndian )
		list.push((value >> 8) & 0xFF, value & 0xFF)
	else
		list.push(value & 0xFF, (value >> 8) & 0xFF)
}

function EncodeDWORD(list, value)
{
	if ( m_isBigEndian )
		list.push((value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF)
	else
		list.push(value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF, (value >> 24) & 0xFF)
}

function PatchWORD(list, value, offset)
{
	if ( m_isBigEndian )
	{
		list[offset] = (value >> 8) & 0xFF
		list[offset + 1] = value & 0xFF
	}
	else
	{
		list[offset] = value & 0xFF
		list[offset + 1] = (value >> 8) & 0xFF
	}
}

function PatchDWORD(list, value, offset)
{
	if ( m_isBigEndian )
	{
		list[offset] = (value >> 24) & 0xFF
		list[offset + 1] = (value >> 16) & 0xFF
		list[offset + 2] = (value >> 8) & 0xFF
		list[offset + 3] = value & 0xFF
	}
	else
	{
		list[offset] = value & 0xFF
		list[offset + 1] = (value >> 8) & 0xFF
		list[offset + 2] = (value >> 16) & 0xFF
		list[offset + 3] = (value >> 24) & 0xFF
	}
}

function WSListSortFunc(item1, item2)
{					
	//	compare case insensitive
	return item1.wsPath.localeCompare(item2.wsPath)
}

function BuildParListCSVFile(basePath)
{
	var CSVStr = "";

	// ~~~~~ parametri applicativi ~~~~~
	var parList = app.CallFunction(m_targetID + ".GetParamList", false, false, 0, 65535);
	for (var key in parList)
	{
		var par = parList[key];

		var CSVSize;
		var CSVtype;

		var typePar = genfuncs.GetNodeText(par.nodeXML, "typepar");
		if (app.CallFunction("script.IsStandardTypePar", typePar)) {

			if (par.type === "STRING") {
				var parSize = parseInt(genfuncs.GetNodeText(par.nodeXML, "size"));
				// se la lunghezza e' dispari aggiungo 1
				if (parSize % 2 !== 0)
					parSize += 1;

				// 2 e' la dimensione dei registri
				CSVSize = parSize / 2;
			}
			else
				CSVSize =IEC_TYPES_TO_CSV[par.type].size;

			CSVtype = IEC_TYPES_TO_CSV[par.type].type;
		}
		else {
			var typeTarg = genfuncs.GetNodeText(par.nodeXML, "typetarg")

			if (!IEC_TYPES_TO_CSV[typeTarg]) {
				// se il typetarg non e' un tipo IEC standard (puo' essere lo stesso del typepar, ovvero corrispondere al tipo dell'enum)
				// lo forzo come DINT perche' in quel caso occuperebbe lo spazio di due registri (es. typepar = enum1 e typetarg = enum1)
				CSVSize = IEC_TYPES_TO_CSV["DINT"].size;
				CSVtype = IEC_TYPES_TO_CSV["DINT"].type;
			}
			else {
				// in caso contrario il typetarg e' specificato in modo puntuale e occupa quanto e' definito per il tipo
				// (es. typepar = enum1 e typetarg = SINT)
				CSVSize = IEC_TYPES_TO_CSV[typeTarg].size;
				CSVtype = IEC_TYPES_TO_CSV[typeTarg].type;
			}
		}


		CSVStr += genfuncs.FormatMsg("%1;%2;%3\n", par.ipa, CSVtype, CSVSize);
	}

	// ~~~~~ parametri di sistema presi dal PCT (richiede USE_CONFIGURATOR) ~~~~~
	if(INCLUDE_SYS_PAR)
	{
		var xmlBase = app.CallFunction("ConfiguratorIntf.GetDeviceTemplateXML", m_targetID);
		var parNodes = xmlBase.selectNodes('parameters/par');
		var node;
		while (node = parNodes.nextNode())
		{
			var ipa = node.getAttribute('ipa');
			var typeCfg = node.getAttribute('typetarg');

			if (typeCfg == "stringex" || typeCfg == "string") {
				var typeIEC = "STRING";
				// ATTENZIONE: prende la dimensione dal protocollo Modbus
				var protNode = node.selectSingleNode("protocol[@name = 'Modbus']");
				var parSize = parseInt(protNode.getAttribute("commsubindex"));
				// se la lunghezza e' dispari aggiungo 1
				if (parSize % 2 !== 0)
					parSize += 1;

				// 2 e' la dimensione dei registri
				var size = parSize / 2;
			}
			else {
				var typeIEC = CFG_TYPES_TO_IEC[typeCfg];
				var size = IEC_TYPES_TO_CSV[typeIEC].size;
			}

			var type = IEC_TYPES_TO_CSV[typeIEC].type;

			CSVStr += genfuncs.FormatMsg("%1;%2;%3\n", ipa, type, size);
		}
	}
	

	var filePath = basePath + "\\parlist_map.csv";

	try {
		var tf = m_fso.CreateTextFile(filePath);
		tf.Write(CSVStr);
		tf.Close();
	} catch (e) {
		app.PrintMessage(genfuncs.FormatMsg(app.Translate("ERROR: Cannot write '%1' file"), filePath));
		//	return false solo in caso di errore
		return false;
	}

	//	se non ci sono parametri genera un file vuoto e ritorna true
	return true
}

function BuildJsonFiles(basePath)
{
	var SYSTEM_PREFIX = "SYS";

	var ENUM_BASE = app.CallFunction("script.GetLogicLabTypes").ENUM_BASE;

	// funzione ricorsiva per cercare i menu innestati
	function FindPLCMenus(node, parent, allMenus) {
		var childMenus = node.selectNodes('menu');
		if (childMenus && childMenus.length > 0) {
			var node;
			while (node = childMenus.nextNode())
			{
				var child = { type: 0, id: node.getAttribute("id"), caption: node.getAttribute("caption") };
				allMenus.push(child);

				FindPLCMenus(node, child, allMenus);

				if (!parent.children)
					parent.children = [];

				parent.children.push(child);
			}

			return parent;
		}

		return;
	}

	function FindSystemMenus(node, parent, allMenus) {
		var childMenus = node.childNodes;
		if (childMenus && childMenus.length > 0) {
			var node;
			while (node = childMenus.nextNode())
			{
				var child = {
					type: 0,
					id: node.getAttribute("name").replace(m_targetID + "_menu", SYSTEM_PREFIX + "_"),
					caption: node.getAttribute("caption")
				};
				allMenus.push(child);

				FindSystemMenus(node, child, allMenus);

				if (!parent.children)
					parent.children = [];

				parent.children.push(child);
			}

			return parent;
		}

		return;
	}

	// funzione per creare l'oggetto del parametro con gli attributi da stampare nel JSON
	function GetPLCParObjToPrint(par) {
		var parObj = {
			ipa: par.ipa,
			name: par.name,
			readonly: genfuncs.ParseBoolean(par.readonly),
			descr: par.description,
			form: genfuncs.GetNodeText(par.nodeXML, "form"),
			um: genfuncs.GetNodeText(par.nodeXML, "um")
		}

		var limits = {}
		var typetarg = genfuncs.GetNodeText(par.nodeXML, "typetarg");
		var typePar = genfuncs.GetNodeText(par.nodeXML, "typepar");
		if (!app.CallFunction("script.IsStandardTypePar", typePar)) {
			// setto id enumerativo
			var enumId = parseInt(genfuncs.GetNodeText(par.nodeXML, "typepar")) - ENUM_BASE;
			parObj.enumId = enumId;

			var limitsDef = app.CallFunction("common.GetIECTypeLimits", "DINT")
			var enumElements = app.CallFunction("logiclab.GetEnumElements", typetarg);
			if (enumElements)
			{
				limits.max = Number.MIN_VALUE
				limits.min = Number.MAX_VALUE
				for (var el = 0; el < enumElements.Length; el++)
				{
					var enumElement = enumElements.Item(el);
					limits.max = Math.max(enumElement.InitValue, limits.max)
					limits.min = Math.min(enumElement.InitValue, limits.min)
				}
			}
			else
				limits = limitsDef
		}
		else {
			// valore "convertito" da numero a nome
			typePar = m_TypeParToCfg[typePar];
			limits = app.CallFunction("common.GetIECTypeLimits", typetarg)
		}

		var min = genfuncs.GetNodeText(par.nodeXML, "min");
		if (min === "")
			min = limits.min

		var max = genfuncs.GetNodeText(par.nodeXML, "max");
		if (max === "")
			max = limits.max

		parObj.min = min
		parObj.max = max

		parObj.typepar = typePar;
		// ATTENZIONE: i parametri applicativi hanno scala e offset gia' gestite dal database!
		// parObj.scale = ParseNumber(genfuncs.GetNodeText(par.nodeXML, "scale"), typePar, 1);
		// parObj.offs = ParseNumber(genfuncs.GetNodeText(par.nodeXML, "offs"), typePar, 0);

		return parObj;
	}

	// funzione per creare l'oggetto del parametro con gli attributi da stampare nel JSON
	function GetSystemParObjToPrint(node) {
		var parObj = {
			ipa: node.getAttribute("ipa"),
			name: node.getAttribute("name"),
			readonly: genfuncs.ParseBoolean(node.getAttribute("readonly")),
			defval: node.getAttribute("defval"),
			descr: node.getAttribute("descr"),
			form: node.getAttribute("form"),
			um: node.getAttribute("um"),
		}

		var typePar = node.getAttribute("typepar");
		if (typePar.substr(0, 4) == "enum")
		{
			var enumId = typePar.substr(4);
			// metto il prefisso per non confonderli con gli enum applicativi che potrebbero avere gli stessi ID
			parObj.enumId = SYSTEM_PREFIX + enumId;

			typePar = "enum";
		}

		parObj.typepar = typePar;
		parObj.offs = ParseNumber(node.getAttribute("offs"), typePar, 0);
		parObj.scale = ParseNumber(node.getAttribute("scale"), typePar, 1);

		return parObj;
	}

	function ParseNumber(str, type, defval) {
		if (type == "boolean" || type == "stringex" || type == "string" || type == "enum")
			return null;

		var val = parseFloat(str);
		if (val != NaN)
			return val;
		else if (defval)
			return defval;

		return null;
	}

	// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ lettura menulist applicativa ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	var PATH_MENUS_NODE = "config/menus";
	var menusNode = app.SelectNodesXML("/" + m_targetID + "/" + PATH_MENUS_NODE + "/menu");

	// contiene tutto il menu applicativo innestato (partendo dai nodi del primo livello)
	var appMenuRoot = [];
	// contine una lista con TUTTI i menu con i rispettivi figli che trovo durante la ricorsione
	var appAllMenus = [];

	if (menusNode && menusNode.length > 0) {
		// nodi menu di primo livello
		var node;
		while (node = menusNode.nextNode())
		{
			var nodeObj = { type: 0, id: node.getAttribute("id"), caption: node.getAttribute("caption") };
			FindPLCMenus(node, nodeObj, appAllMenus);
			appMenuRoot.push(nodeObj);
			appAllMenus.push(nodeObj);
		}
	}
	
	// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ lettura parlist applicativa ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	var parList = app.CallFunction(m_targetID + ".GetParamList");

	// mappa[IPA] = par per trovare velocemente i parametri quando sono suddivisi tra i menu
	var appParMap = {};
	// contiene la lista di tutti i prametri applicativi
	var parlistToPrint = [];
	// mappa[menu id] = [array parametri appartenenti al menu]
	var parListMenuMap = {};

	// scorro tutta la lista dei parametri per una sola volta
	for (var key in parList) {
		var par = parList[key];
		if (!par)
			continue;

		appParMap[par.ipa] = par;

		// gia' che li sto scorrendo, creo l'array gia' nel formato di stampa
		parlistToPrint.push(GetPLCParObjToPrint(par));
	}

	// parlist per ogni menu
	var baseMenuNode = app.SelectNodesXML("/" + m_targetID + "/" + PATH_MENUS_NODE)[0];
	var menuItemsNodes = baseMenuNode.selectNodes('//menu/menuItems/menuItem');

	if (menuItemsNodes && menuItemsNodes.length > 0) {
		// creo mappa[id menu] = lista parametri da stampare
		var node;
		while (node = menuItemsNodes.nextNode())
		{
			// il primo parent e' "menuItems" e il secondo e' "menu"
			var menuId = node.parentNode.parentNode.getAttribute('id');
			// ipa che c'e' nel menu, lo uso per cercare i dettagli del parametro
			var ipa = genfuncs.GetNodeText(node, "ipa");

			var par = appParMap[ipa];
			if (!par)
				continue;

			if (!parListMenuMap[menuId])
				parListMenuMap[menuId] = [];

			parListMenuMap[menuId].push(GetPLCParObjToPrint(par));
		}
	}

	// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ stampa JSON applicativi ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	// stampa parlist applicativa completa
	if (parlistToPrint.length > 0) {
		var filePath = basePath + "\\parlist_0.json";
		try {
			var tf = m_fso.CreateTextFile(filePath);
			tf.Write(JSON.stringify(parlistToPrint));
			tf.Close();
		} catch (error) {
			app.PrintMessage(genfuncs.FormatMsg(app.Translate("ERROR: cannot write '%1' file"), filePath));
			//	return false solo in caso di errore
			return false;
		}
	}

	// stampa parlist di ogni menu
	for (var key in parListMenuMap) {
		var parList = parListMenuMap[key];

		var filePath = basePath + genfuncs.FormatMsg("\\parlist_%1.json", key);

		try {
			var tf = m_fso.CreateTextFile(filePath);
			tf.Write(JSON.stringify(parList));
			tf.Close();
		} catch (error) {
			app.PrintMessage(genfuncs.FormatMsg(app.Translate("ERROR: cannot write '%1' file"), filePath));
			//	return false solo in caso di errore
			return false;
		}
	}

	// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ lettura parlist di sistema ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	parListMenuMap = {};
	parlistToPrint = []
	
	if(INCLUDE_SYS_PAR)
	{

		var configXMLBase = app.CallFunction("ConfiguratorIntf.GetDeviceTemplateXML", m_targetID);
		var parNodes = configXMLBase.selectNodes('parameters/par');

		if (parNodes && parNodes.length > 0) {
			var node;
			while (node = parNodes.nextNode())
			{
				var exportPar = GetSystemParObjToPrint(node);
		
				var menuNodes = node.selectNodes("menu")
				var menu
				while (menu = menuNodes.nextNode()) {
					var menuId = menu.getAttribute("id");
		
					if (!parListMenuMap[menuId])
						parListMenuMap[menuId] = [];
		
					parListMenuMap[menuId].push(exportPar);
				}
		
				// gia' che li sto scorrendo, creo l'array di tutti i parametri gia' nel formato di stampa
				parlistToPrint.push(exportPar);
			}
		}
	

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ lettura menulist di sistema ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// /tree root/nodo del target/nodo all parameters/nodi menu figli
		var query ='hmi/tree/node[@name="' + m_targetID + '"]/node/node';
		menusNode = configXMLBase.selectNodes(query);

		// contiene tutto il menu innestato (partendo dai nodi del primo livello)
		var sysMenuRoot = [];
		// contine una lista con TUTTI i menu che trovo durante la ricorsione con i rispettivi figli
		var sysAllMenus = [];

		if (menusNode && menusNode.length > 0) {
			var node;
			while (node = menusNode.nextNode()) {
				var nodeObj = {
					type: 0,
					id: node.getAttribute("name").replace(m_targetID + "_menu", SYSTEM_PREFIX + "_"),
					caption: node.getAttribute("caption")
				};
				FindSystemMenus(node, nodeObj, sysAllMenus);
				sysMenuRoot.push(nodeObj);
				sysAllMenus.push(nodeObj);
			}
		}

		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ stampa JSON sistema ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
		// stampa parlist sistema completa
		if (parlistToPrint.length > 0) {
			var filePath = basePath + genfuncs.FormatMsg("\\parlist_%1_0.json", SYSTEM_PREFIX);;
			try {
				var tf = m_fso.CreateTextFile(filePath);
				tf.Write(JSON.stringify(parlistToPrint));
				tf.Close();
			} catch (error) {
				app.PrintMessage(genfuncs.FormatMsg(app.Translate("ERROR: cannot write '%1' file"), filePath));
				//	return false solo in caso di errore
				return false;
			}
		}
	}

	// stampa parlist di ogni menu
	for (var key in parListMenuMap) {
		var parList = parListMenuMap[key];

		var filePath = basePath + genfuncs.FormatMsg("\\parlist_%1_%2.json", SYSTEM_PREFIX, key);

		try {
			var tf = m_fso.CreateTextFile(filePath);
			tf.Write(JSON.stringify(parList));
			tf.Close();
		} catch (error) {
			app.PrintMessage(genfuncs.FormatMsg(app.Translate("ERROR: cannot write '%1' file"), filePath));
			//	return false solo in caso di errore
			return false;
		}
	}


	// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ stampo menu COMPLETO + menu app e sys NON ricorsivi ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	var sysRoot = { type: 0, id: SYSTEM_PREFIX + "_" + 0, caption: "System Parameters", children: sysMenuRoot };
	var appRoot = { type: 0, id: 0, caption: "App Parameters", children: appMenuRoot };

	// li metto sotto un'unica radice
	var root = [sysRoot, appRoot];

	try {
		var filePath = basePath + "\\menulist_0_rec.json";
		var tf = m_fso.CreateTextFile(filePath);
		tf.Write(JSON.stringify(root));
		tf.Close();
	} catch (e) {
		app.PrintMessage(genfuncs.FormatMsg(app.Translate("ERROR: Cannot write '%1' file"), filePath));
		//	return false solo in caso di errore
		return false;
	}

	// NB: i menu non "rec" li stampo alla fine di tutto perche' rimuovendo i figli non potrei stamparli prima di avere stampato tutto il resto

	// stampa i menu non "rec" (rimuovendo i figli)
	for (var key in sysAllMenus) {
		var element = sysAllMenus[key];

		delete element.children;

		try {
			var filePath = basePath + genfuncs.FormatMsg("\\menulist_%1.json", element.id);
			var tf = m_fso.CreateTextFile(filePath);
			tf.Write(JSON.stringify(element));
			tf.Close();
		} catch (e) {
			app.PrintMessage(genfuncs.FormatMsg(app.Translate("ERROR: Cannot write '%1' file"), filePath));
			//	return false solo in caso di errore
			return false;
		}
	}


	// stampa i menu non "rec" (rimuovendo i figli)
	for (var key in appAllMenus) {
		var element = appAllMenus[key];

		delete element.children;

		try {
			var filePath = basePath + genfuncs.FormatMsg("\\menulist_%1.json", element.id);
			var tf = m_fso.CreateTextFile(filePath);
			tf.Write(JSON.stringify(element));
			tf.Close();
		} catch (e) {
			app.PrintMessage(genfuncs.FormatMsg(app.Translate("ERROR: Cannot write '%1' file"), filePath));
			//	return false solo in caso di errore
			return false;
		}
	}


	// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ generazione e stampa enumerativi ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	var enumList = [];

	// enum applicativi
	var PATH_ENUMS_NODES = "config/enums/enum";
	var appEnumNodes = app.SelectNodesXML("/" + m_targetID + "/" + PATH_ENUMS_NODES);
	if (appEnumNodes && appEnumNodes.length > 0) {
		var node;
		while (node = appEnumNodes.nextNode()) {
			var nodeObj = {
				id: node.getAttribute("id"),
				name: node.getAttribute("caption")
			};

			var enumValueNodes = node.selectNodes("enum_value");
			var enumValueNode;
			while (enumValueNode = enumValueNodes.nextNode()) {
				var enumValObj = {
					value: genfuncs.GetNodeText(enumValueNode, "value"),
					descr: genfuncs.GetNodeText(enumValueNode, "description"),
					name: genfuncs.GetNodeText(enumValueNode, "name")
				}

				if (!nodeObj.values)
					nodeObj.values = [];

				nodeObj.values.push(enumValObj);
			}

			enumList.push(nodeObj);
		}
	}

	// enum di sistema
	if(INCLUDE_SYS_PAR)
	{
		var sysEnumNodes = configXMLBase.selectNodes('enums/enum');
		if (sysEnumNodes && sysEnumNodes.length > 0) {
			var node;
			while (node = sysEnumNodes.nextNode()) {
				var nodeObj = {
					// metto il prefisso per non confonderli con gli enum applicativi che potrebbero avere gli stessi ID
					id: SYSTEM_PREFIX + node.getAttribute("id"),
				};

				var enumValueNodes = node.selectNodes("elem");
				var enumValueNode;
				while (enumValueNode = enumValueNodes.nextNode()) {
					var enumValObj = {
						value: enumValueNode.getAttribute("value"),
						name: enumValueNode.getAttribute("descr")
					}

					if (!nodeObj.values)
						nodeObj.values = [];

					nodeObj.values.push(enumValObj);
				}

				enumList.push(nodeObj);
			}
		}
	}

	try {
		var filePath = basePath + "\\EnumList.json";
		var tf = m_fso.CreateTextFile(filePath);
		tf.Write(JSON.stringify(enumList));
		tf.Close();
	} catch (e) {
		app.PrintMessage(genfuncs.FormatMsg(app.Translate("ERROR: Cannot write '%1' file"), filePath));
		//	return false solo in caso di errore
		return false;
	}

	//	se non ci sono menu/parametri ritorna true e cancella il files se presenti
	return true;
}

function GetWebSiteBuildDir()
{
	return app.CallFunction('script.GetBuildDir') + APIJSON_FOLDER_NAME;
	
}

function BuildWebSiteAuxFiles()
{
	var dirPath = GetWebSiteBuildDir()
	if (m_fso.FolderExists(dirPath)) {
		try {
			m_fso.DeleteFolder(dirPath);
		} catch (error) {
			app.PrintMessage(app.Translate("ERROR: Cannot delete existing JSON/CSV support files for application website. Maybe in use?"));
			return false;
		}
	}

	try {
		m_fso.CreateFolder(dirPath);
	} catch (error) {
		app.PrintMessage(genfuncs.FormatMsg(app.Translate("ERROR: Cannot create '%1' directory"), dirPath));
		return false;
	}

	if (!BuildParListCSVFile(dirPath))
		return false;

	if (!BuildJsonFiles(dirPath))
		return false;

	return true;
}

function BuildWebSiteEmbedded()
{
	if (app.ModifiedFlag) {
		var errmsg = app.Translate("You must save the project before building the website");
		app.MessageBox(errmsg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return false;
	}

	// faccio questo controllo altrimenti manca la cartella Download in cui viene salvato il BLOB
	if (!m_fso.FolderExists(GetDownloadDir())) {
		var errmsg = app.Translate("You must build the project before building the website");
		app.MessageBox(errmsg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return false;
	}

	var hasApplicationWebSite
	
	//	build standard (crea cartella)
	if ( !BuildWebSite() )
	{
		//	se batch mode procede senza conferma
		// if (app.MessageBox(app.Translate("No application website available.\n\nDo you want to build basic website with no custom pages?"), "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNO) == gentypes.MSGBOX.IDNO)
			// return false
		
		hasApplicationWebSite = false
	}
	else
	{
		//	controllo esistenza cartella sito
		var webFolder = m_fso.GetParentFolderName(GetPLCProjectPath()) + "\\" + WEBSITE_FOLDER_NAME;
		if (! m_fso.FolderExists(webFolder) )
		{
			var errmsg = genfuncs.FormatMsg(app.Translate("ERROR: Web site folder %1 does not exists"), webFolder);
			app.PrintMessage(errmsg);
			return false
		}
		
		hasApplicationWebSite = true
	}
	
	if ( !BuildWebSiteAuxFiles() )
	{
		var errmsg = genfuncs.FormatMsg(app.Translate("ERROR: Cannot generate CSV and JSON support files for application website") );
		app.PrintMessage(errmsg);
		return false
	}
		
	//	controllo esistenza cartella api json
	var apiJsonFolder = GetWebSiteBuildDir()
	if (! m_fso.FolderExists(apiJsonFolder) )
	{
		var errmsg = genfuncs.FormatMsg(app.Translate("ERROR: Api json folder %1 does not exists"), apiJsonFolder);
		app.PrintMessage(errmsg);
		return false
	}
	
	var SEEK_SET = 0
	var SEEK_CUR = 1
	var SEEK_END = 2
	
	// ottiene dal catalogo il nodo xml <deviceinfo> del target corrente per avere il path del PCT
	var nodelist = app.CallFunction("extfunct.QueryCatalog", "//deviceinfo[@deviceid = '" + app.CallFunction("logiclab.get_TargetID") + "']");
	if (!nodelist || nodelist.length == 0)
		return false
	
	var pctPath = app.CatalogPath + nodelist[0].getAttribute("template")
	var websitePath = m_fso.GetParentFolderName( pctPath ) + "\\..\\LLResources\\AlWebServer\\webdata"

	if( !m_fso.FolderExists( websitePath ) )
	{
		app.PrintMessage( "Cannot find '" + websitePath + "' folder" )
		return enuLogLevels.LEV_CRITICAL
	}
	
	var folder = m_fso.GetFolder( websitePath )	
	var wsPathString = "."
	var wsList = []
	
	//	browse ricorsivo delle cartelle e dei file del webserver
	//	tutte le informazioni utili vengono messe in wsList che poi viene processata
	BrowseFolder(folder, wsPathString + "\\" + folder.Name, wsList)
	
	if ( hasApplicationWebSite )
	{
		//	oltre alla cartella base aggiunge anche quella del progetto locale
		//	la cartella viene messa come sottodirectory di webdata
		var localSitefolder = m_fso.GetFolder( webFolder )
		wsPathString = ".\\webdata"
		BrowseFolder(localSitefolder, wsPathString + "\\" + localSitefolder.Name, wsList)
	}
	
	
	//	oltre alla cartella base aggiunge anche quella del progetto locale
	//	la cartella viene messa come sottodirectory di webdata
	var localSitefolder = m_fso.GetFolder( apiJsonFolder )
	wsPathString = ".\\webdata"
	BrowseFolder(localSitefolder, wsPathString + "\\" + localSitefolder.Name, wsList)
	
	//	ordina la lista per poi eventualmente usare ricerca dicotomica
	wsList.sort( WSListSortFunc )
	
	if (WS_DEBUG)
	{
		for ( var i = 0; i < wsList.length; i++ )
		{
			app.PrintMessage( wsList[i].wsPath )
		}
	}
	
	//	blobfile
	var blobdata_header = []	
	EncodeDWORD( blobdata_header, WS_MAGIC )		//	magic
	EncodeDWORD( blobdata_header, 0 )				//	crc32 che verrà patchato dopo all'offset 4
	EncodeDWORD( blobdata_header, 0 )				//	blobsize (contato a partire dal campo successivo incluso) che verrà patchato dopo all'offset 8
	
	EncodeDWORD( blobdata_header, wsList.length )	//	num records	(incluso nel calcolo del crc32)
	
	for ( var i = 0; i < wsList.length; i++ )
	{
		var wsItem = wsList[ i ]
		
		var wsRec = {}
		wsRec.pathSize16 = 0
		wsRec.flags16 = 0
		wsRec.fileSize32 = 0
		wsRec.recSize32 = 0
		wsRec.fileBytes = []
	
		if ( wsItem.isFolder )	/*	folder	*/
		{
			//	nel record metto il nome e setto che è una cartella
			wsRec.pathSize16 = wsItem.wsPath.length + 1
			wsRec.flags16 = WS_FILE_REC_FLAG_IS_DIRECTORY
			wsRec.fileSize32 = 0
			wsRec.recSize32 = wsRec.pathSize16 + WS_FS_REC_SIZEOF_HEADER
			wsRec.fileBytes = []
		}
		else	/*	file	*/
		{
			var f = app.CallFunction("commonDLL.BinaryFileOpen", wsItem.fullPath, "rb")
			if (!f)
				return enuLogLevels.LEV_CRITICAL
			
			//	nel record metto il nome e setto che è una cartella
			wsRec.pathSize16 = wsItem.wsPath.length + 1
			wsRec.flags16 = WS_FILE_REC_FLAG_IS_FILE
			
			//	get file size
			app.CallFunction("commonDLL.BinaryFileSeek", f, 0, SEEK_END)
			wsRec.fileSize32 = app.CallFunction("commonDLL.BinaryFileGetPos", f)
			app.CallFunction("commonDLL.BinaryFileSeek", f, 0, SEEK_SET)	//	riporta all'inizio

			if (wsRec.fileSize32 == 0)
			{
				wsRec.fileBytes = 0
			}
			else {
				//	get all data as safe array
				var fileData = app.CallFunction("commonDLL.BinaryFileRead", f, wsRec.fileSize32, false)
				//	convert safe array to bytes          
				wsRec.fileBytes = genfuncs.FromSafeArray(fileData)
			}
			
			//	close file
			app.CallFunction("commonDLL.BinaryFileClose", f)

			wsRec.recSize32 = wsRec.pathSize16 + wsRec.fileSize32 + WS_FS_REC_SIZEOF_HEADER
		}
		
		wsItem.blobdata = {}
		wsItem.blobdata.header = []
		wsItem.blobdata.name = []
		wsItem.blobdata.filedata = []
		
		EncodeDWORD( wsItem.blobdata.header, wsRec.recSize32 )
		EncodeWORD( wsItem.blobdata.header, wsRec.pathSize16 )
		EncodeWORD( wsItem.blobdata.header, wsRec.flags16 )
		EncodeDWORD( wsItem.blobdata.header, wsRec.fileSize32 )
				
		for ( var j = 0; j < wsItem.wsPath.length; j++ )
		{
			var strChar = wsItem.wsPath.charCodeAt(j)
			wsItem.blobdata.name.push( strChar )
		}
		wsItem.blobdata.name.push( 0 )
		
		if ( wsRec.fileBytes.length != 0 )
		{
			//	aggiunge il file al blob
			wsItem.blobdata.filedata = wsRec.fileBytes
		}
	}
	
	//	al termine del ciclo precedente ho:
	//	-	blobdata_header con l'intestazione del blob del fs
	//	-	n record wsItem.blobdata con .header, .name già valorizzato e .filedata già valorizzato nel caso di file
	//	il blobdata risultante da scrivere sul target è quindi:
	//	blobdata_header
	//	wsList[0].blobdata.header
	//	wsList[0].blobdata.name
	//	wsList[0].blobdata.filedata
	//	...
	//	wsList[n-1].blobdata.header
	//	wsList[n-1].blobdata.name
	//	wsList[n-1].blobdata.filedata
	
	var blobsize = WS_FS_SIZEOF_NUMRECS	//	parto da 4 perchè conto anche la size del campo num records
	for ( var i = 0; i < wsList.length; i++ )
	{
		var wsItem = wsList[ i ]
		blobsize += wsItem.blobdata.header.length
		blobsize += wsItem.blobdata.name.length
		blobsize += wsItem.blobdata.filedata.length
	}
	
	var crc32 = 0	//	todo
	
	PatchDWORD( blobdata_header, crc32, WS_FS_SIZEOF_MAGIC )							//	crc32 che verrà patchato dopo all'offset 8
	PatchDWORD( blobdata_header, blobsize, WS_FS_SIZEOF_MAGIC + WS_FS_SIZEOF_CRC32 )	//	blobdata size è la size dei dati su cui è stato calcolato l'offset
	
	var blobdataBin = GetWebsiteFilename()
	
	//	salvo il blob su file
	var f = app.CallFunction("commonDLL.BinaryFileOpen", blobdataBin, "wb")
	if (!f)
		return enuLogLevels.LEV_CRITICAL
	
	app.CallFunction("commonDLL.BinaryFileWrite", f, blobdata_header)
	for ( var i = 0; i < wsList.length; i++ )
	{
		var wsItem = wsList[ i ]
		
		app.CallFunction("commonDLL.BinaryFileWrite", f, wsItem.blobdata.header)
		app.CallFunction("commonDLL.BinaryFileWrite", f, wsItem.blobdata.name)
		if (wsItem.blobdata.filedata.length > 0)
		{
			app.CallFunction("commonDLL.BinaryFileWrite", f, wsItem.blobdata.filedata)
		}
	}
	
	//	close file
	app.CallFunction("commonDLL.BinaryFileClose", f)	
	
	var caption = app.Translate( "Web server" )
	var message = app.Translate( "Website successfully built" )
	app.MessageBox("Website successfully built", caption, gentypes.MSGBOX.MB_ICONINFORMATION);
	
	app.PrintMessage( message )
	
	return enuLogLevels.LEV_OK
}

function DownloadWebSiteEmbedded()
{
	var startTime = new Date().getTime();

	var SEEK_SET = 0
	var SEEK_CUR = 1
	var SEEK_END = 2
	var GDB_DATATRANSF_IO = 3

	var PACKET_COMMAND_CMD_WRITE_MEMORY = 1
	var PACKET_COMMAND_CMD_ERASE_FLASH = 4
	var PACKET_COMMAND_CMD_VALIDATE_AREA = 5
	var PACKET_COMMAND_CMD_GET_FLASH_DATAS = 6

	//	se batch mode procede senza conferma
	if (app.MessageBox(app.Translate("Are you sure you want to download Website"), "", gentypes.MSGBOX.MB_ICONQUESTION | gentypes.MSGBOX.MB_YESNO) == gentypes.MSGBOX.IDNO)
		return enuLogLevels.LEV_OK

	var blobdataBin = GetWebsiteFilename()

	//	calcolo crc32 del blob
	var crc32 = app.CallFunction("commonDLL.CalcCRC32ForFile", blobdataBin)

	//	apro il file per scaricarlo
	var f = app.CallFunction("commonDLL.BinaryFileOpen", blobdataBin, "rb")
	if (!f)
		return enuLogLevels.LEV_CRITICAL

	var message = ""
	var caption = app.Translate("Web server")

	// get active IDeviceLink from LogicLab
	var devlink = app.CallFunction("logiclab.GetDeviceLink")
	if (!devlink)
		return enuLogLevels.LEV_CRITICAL

	var ris = enuLogLevels.LEV_OK

	//	packet command per ottenere informazioni dal target
	if (m_isModbus)	//	modbus
	{
		var packet = []

		//	header
		packet[0] = PACKET_COMMAND_CMD_GET_FLASH_DATAS		//	Get flash datas

		//	this is the packet to write                                             
		var packetSafeArray = genfuncs.ToSafeArray(packet)
		var response
		var responseMaxSize = 100
		try
		{
			response = devlink.PacketVARIANT(GDB_DATATRANSF_IO, packetSafeArray, responseMaxSize, 0)
		}
		catch (ex)
		{
			message = app.Translate("Cannot get flash data")
			app.PrintMessage(message)
			ris = enuLogLevels.LEV_CRITICAL
		}

		app.CallFunction("commonDLL.DoPaintEvents")

		//	process response
		if (ris == enuLogLevels.LEV_OK)
		{
			var responseArray = genfuncs.FromSafeArray(response)
			var cmd = responseArray[0]
			var baseTargetAddress = responseArray[1] | (responseArray[2] << 8) | (responseArray[3] << 16) | (responseArray[4] << 24)
			var maxWebServerSize = responseArray[5] | (responseArray[6] << 8) | (responseArray[7] << 16) | (responseArray[8] << 24)
		}
	}
	else
	{
		message = app.Translate("Communication protocol not supported")
		app.PrintMessage(message)
		ris = enuLogLevels.LEV_CRITICAL
	}

	if (ris == enuLogLevels.LEV_OK)
	{
		var timeout = devlink.TimeOut

		//	get file size
		app.CallFunction("commonDLL.BinaryFileSeek", f, 0, SEEK_END)
		var fileSize = app.CallFunction("commonDLL.BinaryFileGetPos", f)

		if (fileSize > maxWebServerSize)
		{
			message = app.Translate("Web server site exceeds maximum target space. Cannot continue.")
			app.PrintMessage(message)
			//	close file
			app.CallFunction("commonDLL.BinaryFileClose", f)

			ris = enuLogLevels.LEV_CRITICAL
		}

		app.CallFunction("logiclab.ShowProgressDlg", app.Translate("Website download in progress"), fileSize)

		if (ris == enuLogLevels.LEV_OK)
		{

			var responseArray

			app.CallFunction("commonDLL.BinaryFileSeek", f, 0, SEEK_SET)
			//	get all data as safe array
			var fileData = app.CallFunction("commonDLL.BinaryFileRead", f, fileSize, false)
			//	close file
			app.CallFunction("commonDLL.BinaryFileClose", f)
			//	convert safe array to bytes          
			var fileBytes = genfuncs.FromSafeArray(fileData)

			/*	ERASE FLASH */


			devlink.TimeOut = WS_ERASE_FLASH_TIMEOUT

			var packet = []

			//	header
			packet[0] = PACKET_COMMAND_CMD_ERASE_FLASH			//	erase flash
			packet[1] = baseTargetAddress & 0xFF				//	address
			packet[2] = (baseTargetAddress >> 8) & 0xFF
			packet[3] = (baseTargetAddress >> 16) & 0xFF
			packet[4] = (baseTargetAddress >> 24) & 0xFF

			//	this is the packet to write                                             
			var packetSafeArray = genfuncs.ToSafeArray(packet)
			var response
			var responseMaxSize = 100
			try
			{
				response = devlink.PacketVARIANT(GDB_DATATRANSF_IO, packetSafeArray, responseMaxSize, 0)
			}
			catch (ex)
			{
				message = app.Translate("Error erasing flash (command failed)")
				app.PrintMessage(message)
				ris = enuLogLevels.LEV_CRITICAL
			}

			responseArray = genfuncs.FromSafeArray(response)
			if (responseArray[0] != 0xAA)
			{
				message = app.Translate("Error erasing flash")
				app.PrintMessage(message)
				ris = enuLogLevels.LEV_CRITICAL
			}

			/*	WRITE MEMORY */

			if (ris == enuLogLevels.LEV_OK)
			{
				//	timeout scrittura flash
				devlink.TimeOut = WS_WRITE_FLASH_TIMEOUT

				//	write WS_PACKET_SIZE bytes at the time
				var address = baseTargetAddress
				for (var i = 0; i < fileSize; i += WS_PACKET_SIZE) 
				{
					app.CallFunction("commonDLL.DoPaintEvents")
					var packetDataSize
					if (fileSize - i < WS_PACKET_SIZE)
						packetDataSize = fileSize - i
					else
						packetDataSize = WS_PACKET_SIZE

					var packet = []
					//	header
					packet[0] = PACKET_COMMAND_CMD_WRITE_MEMORY		//	memory write cmd							
					packet[1] = address & 0xFF				//	address
					packet[2] = (address >> 8) & 0xFF
					packet[3] = (address >> 16) & 0xFF
					packet[4] = (address >> 24) & 0xFF

					packet[5] = packetDataSize & 0xFF	//	size
					packet[6] = (packetDataSize >> 8) & 0xFF

					//	data to write
					for (var j = 0; j < packetDataSize; j++)
						packet[7 + j] = fileBytes[j + i]

					//	this is the packet to write                                             
					var packetSafeArray = genfuncs.ToSafeArray(packet)
					var response
					var responseMaxSize = 100
					try
					{
						response = devlink.PacketVARIANT(GDB_DATATRANSF_IO, packetSafeArray, responseMaxSize, 0)
					}
					catch (ex)
					{
						message = app.Translate("Error writing flash (command failed)")
						message += genfuncs.FormatMsg(" at 0X%1", address.toString(16).toUpperCase());
						app.PrintMessage(message)
						ris = enuLogLevels.LEV_CRITICAL
						break;
					}

					responseArray = genfuncs.FromSafeArray(response)
					if (responseArray[0] != 0xAA)
					{
						message = app.Translate("Error writing flash")
						message += genfuncs.FormatMsg(" at 0X%1", address.toString(16).toUpperCase());
						app.PrintMessage(message)
						ris = enuLogLevels.LEV_CRITICAL
						break;
					}

					//            next address
					address += packetDataSize

					app.CallFunction("logiclab.UpdateProgressDlg", (address - baseTargetAddress));

					app.CallFunction("commonDLL.DoPaintEvents")
				}

				/*	VALIDATE AREA */

				//	timeout validate flash
				if (ris == enuLogLevels.LEV_OK)
				{
					devlink.TimeOut = WS_VALIDATE_TIMEOUT

					var packet = []

					//	header
					packet[0] = PACKET_COMMAND_CMD_VALIDATE_AREA		//	validate area
					packet[1] = baseTargetAddress & 0xFF				//	address
					packet[2] = (baseTargetAddress >> 8) & 0xFF
					packet[3] = (baseTargetAddress >> 16) & 0xFF
					packet[4] = (baseTargetAddress >> 24) & 0xFF
					packet[5] = fileSize & 0xFF							//	file size
					packet[6] = (fileSize >> 8) & 0xFF
					packet[7] = (fileSize >> 16) & 0xFF
					packet[8] = (fileSize >> 24) & 0xFF
					packet[9] = crc32 & 0xFF							//	crc32
					packet[10] = (crc32 >> 8) & 0xFF
					packet[11] = (crc32 >> 16) & 0xFF
					packet[12] = (crc32 >> 24) & 0xFF

					//	this is the packet to write                                             
					var packetSafeArray = genfuncs.ToSafeArray(packet)
					var response
					var responseMaxSize = 100
					try
					{
						response = devlink.PacketVARIANT(GDB_DATATRANSF_IO, packetSafeArray, responseMaxSize, 0)
					}
					catch (ex)
					{
						message = app.Translate("CRC32 validation generic error")
						app.PrintMessage(message)
						ris = enuLogLevels.LEV_CRITICAL
					}

					responseArray = genfuncs.FromSafeArray(response)

					if (responseArray[0] == 0xAA)
					{
						message = app.Translate("Website downloaded")
						app.PrintMessage(message)
						ris = enuLogLevels.LEV_OK
					}
					else
					{
						message = app.Translate("CRC32 validation error")
						app.PrintMessage(message)
						ris = enuLogLevels.LEV_CRITICAL
					}
				}
			}
		}
		//	ripristino timeout comunicazione
		devlink.TimeOut = timeout
	}

	app.CallFunction("logiclab.HideProgressDlg");

	// rilascia reference al devicelink e unlock della comunicazione (logiclab fa lock nella GetDeviceLink()!)
	devlink = undefined
	CollectGarbage()  // chiama subito il gc per forzare la release del devicelink
	app.CallFunction("logiclab.UnlockComm")

	var endTime = new Date().getTime();
	var difference = (endTime - startTime) / (1000 * 60)

	if (WS_DEBUG)
	{
		if (fileSize)
			app.PrintMessage(Math.round(fileSize / (1024)) + "KB in " + Math.round(difference) + " min")
	}

	app.MessageBox(message, caption, ris == enuLogLevels.LEV_OK ? gentypes.MSGBOX.MB_ICONINFORMATION : gentypes.MSGBOX.MB_ICONEXCLAMATION)

	return ris
}
