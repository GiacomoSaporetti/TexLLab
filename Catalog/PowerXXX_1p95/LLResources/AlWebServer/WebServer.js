var m_fso = new ActiveXObject("Scripting.FileSystemObject");
var genfuncs = app.CallFunction("common.GetGeneralFunctions");
var gentypes = app.CallFunction("common.GetGeneralTypes");
var enuLogLevels = gentypes.enuLogLevels;
var GetNode = genfuncs.GetNode;

var TREENAME = "tree1";
var WEBPAGE_MIN_REFRESH = 250;   // tempo minimo refresh in ms
var EXT_HTM = ".html";
var HTMLCONTROLS = { TEXT: 0, SELECT: 1, BUTTON: 2, IMAGE: 3, RADIO: 4, CHECKBOX: 5 , TOGGLE_BUTTON: 6};
var WEBSITE_FOLDER_NAME = "website";
var WEBROOT_FOLDER_NAME = "webdata";
var WEBIMG_FOLDER_NAME = "img";

var PLUGIN_ROOT_NODE = "webmenus";
var PLUGIN_PCT_PATH = "%TARGETPCTPATH%\\..\\WebServer\\WebServer.pct";

var m_remotePars_ProtocolName;
var m_remotePars_ProtocolPar;
var m_remotePars_netID;
var m_remotePars_timeout;

var m_downloadFileFuncName = "GDBFileTransfer.GDBCopyFileToDevice";
var m_createDirFuncName = "GDBFileTransfer.GDBCreateDirectory";
var m_deleteDirFuncName = "GDBFileTransfer.GDBDeleteDirectory";

function SetRemoteParsSettings(protName, protPar, netID, timeout)
{
	m_remotePars_ProtocolName = protName;
	m_remotePars_ProtocolPar = protPar;
	m_remotePars_netID = netID;
	m_remotePars_timeout = timeout;
}

function SetFileTransferFunctions(downloadFunc, createDirFunc, deleteDirFunc)
{
	m_downloadFileFuncName = downloadFunc;
	m_createDirFuncName = createDirFunc;
	m_deleteDirFuncName = deleteDirFunc;
}

var WEBITEMTYPES = { PLC:1, PAR:2, REMOTEPAR:4 };

function GetWebItemTypes()
	{ return WEBITEMTYPES; }


// configurare tramite Init del target principale i tipi permessi tramite SetAllowedItemTypes
var m_allowedItemTypes = WEBITEMTYPES.PLC;

function SetAllowedItemTypes(types)
	{ m_allowedItemTypes = types; }
function GetAllowedItemTypes()
	{ return m_allowedItemTypes; }

// funzione callback da utilizzare per la gestione/traduzione di formati custom
var m_customFormatFunc;

function SetCustomFormatFunc(func)
	{ m_customFormatFunc = func; }
function GetCustomFormatFunc()
	{ return m_customFormatFunc; }

// funzione callback da utilizzare per la gestione/traduzione di formati custom (contrario della m_customFormatFunc!)
var m_customFormatReverseFunc;

function SetCustomFormatReverseFunc(func)
	{ m_customFormatReverseFunc = func; }
function GetCustomFormatReverseFunc()
	{ return m_customFormatReverseFunc; }


// funzione callback da utilizzare per la gestione del drop parametri su un web menu
var m_customOnDropWebMenuFunc;
function SetCustomOnDropWebMenuFunc(func)
	{ m_customOnDropWebMenuFunc = func; }
function GetCustomOnDropWebMenuFunc()
	{ return m_customOnDropWebMenuFunc; }


// sostituzione nel templatedata principale del target del placeholder con il nome del plugin con il vero nodo con tutti gli attributi reali
function AdjustTemplateData()
{
	var newNode = app.GetTemplateData(PLUGIN_ROOT_NODE)[0].cloneNode(true);
	// usa var di ambiente TARGETPCTPATH per permettere aggiornamenti e cambi target indolori (richiede LogicLab >= 5.13.0.12)
	newNode.setAttribute("template", PLUGIN_PCT_PATH);
	
	var rootNode = app.GetTemplateData(app.CallFunction("logiclab.get_TargetID"))[0];
	rootNode.replaceChild(newNode, rootNode.selectSingleNode(PLUGIN_ROOT_NODE))
}

function UpgradeOldLLExecNode(targetNode)
{
	var node = targetNode.selectSingleNode(PLUGIN_ROOT_NODE);
	if (node)
	{
		// setta template e version su un vecchio nodo che non aveva l'aggancio al PCT corrente. chiamata da UpgradeNode di LLExec!
		// gestisce vecchi progetti LLExec in cui il plugin currente c'era già, ma con la vecchia gestione
		node.setAttribute("template", PLUGIN_PCT_PATH);
		node.setAttribute("version", 1);
	}
	else
	{
		// creazione di nuovo nodo per il plugin corrente, per progetti dove non esisteva proprio
		var newNode = app.GetTemplateData(PLUGIN_ROOT_NODE)[0].cloneNode(true);
		// usa var di ambiente TARGETPCTPATH per permettere aggiornamenti e cambi target indolori (richiede LogicLab >= 5.13.0.12)
		newNode.setAttribute("template", PLUGIN_PCT_PATH);
		targetNode.appendChild(newNode);
	}
}

function GetHTMLControls()
	{ return HTMLCONTROLS }

function AddWebMenu()
{
	// aggiunta nuovo menu sotto il nodo corrente (sarÃ  "Menus")
	var curdata = app.HMIGetElementData(TREENAME, "")
	var datapath = app.AddTemplateData("webmenu", curdata, 0, false)
	
	// mette subito in editing la caption
	var itempath = app.HMIGetElementPath(TREENAME, datapath)
	if (itempath)
		app.HMIEditElement(TREENAME, itempath)
}

function DeleteWebPage()
{
	// cancellazione nodo corrente
	var curdata = app.HMIGetElementData(TREENAME, "")
	
	var nodename = genfuncs.GetLastPathElement(curdata)
	if (nodename == "webmenu" || nodename == "webtemplatepage")
	{
		var filename = app.DataGet(curdata + "/@filename", 0)
		if (filename)
		{
			var webFolder = m_fso.GetParentFolderName(GetPLCProjectPath()) + "\\" +WEBSITE_FOLDER_NAME + "\\";
			if (m_fso.FileExists(webFolder + filename + EXT_HTM))
			{
				var ris = app.MessageBox("Do you want to delete also the file '" + filename + ".html' ?", "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNOCANCEL);
				if (ris == gentypes.MSGBOX.IDCANCEL)
					return
				else if (ris == gentypes.MSGBOX.IDYES)
				{
					try
					{
						m_fso.DeleteFile(webFolder + filename + EXT_HTM, true)
					}
					catch (ex)
					{ }
				}
			}
		}
	}
	
	app.HMISetCurElement(TREENAME, "/ROOT");
	
	app.DataDelete(curdata, 0)
}

// mostra finestra di scelta del template di pagina
function ChooseWebTemplatePage()
{
	var list = []
	var PCTfolder = m_fso.GetParentFolderName(app.CallFunction("script.GetCurrentTargetPCTPath", true));
	var baseFolder = PCTfolder + "\\..\\WebServer\\WebPageTemplates";
	
	// scorre tutte le cartelle in WebPageTemplates
	var folder = m_fso.GetFolder(app.CatalogPath + baseFolder)
	for (var fenum = new Enumerator(folder.SubFolders); !fenum.atEnd(); fenum.moveNext())
	{
		var f = fenum.item()
		if ((f.Attributes & 2) == 0)
			// include solo le cartelle NON hidden, ad es. per escludere .svn (attributo 2)
			list.push( { name: f.name, value: f.name + "\\" + f.name + ".pagetempl" } )
	}
	
	// mostra lista di selezione
	app.TempVar("GenericList_input") = list
	app.TempVar("GenericList_multipleSel") = false
	app.OpenWindow("GenericList", app.Translate("Choose Web template page"), "")
	var result = app.TempVar("GenericList_result")
	if (!result || result.length == 0)
		return
	
	// il nome del file .pagetempl deve chiamarsi come la cartella !
	var filename = baseFolder + "\\" + result[0].value
	return filename
}

function AddWebCustomPage()
{
	var curdata = app.HMIGetElementData(TREENAME, "")
	var datapath = app.AddTemplateData("webcustompage", curdata, 0, false)

	// mette subito in editing la caption
	var itempath = app.HMIGetElementPath(TREENAME, datapath)
	if (itempath)
		app.HMIEditElement(TREENAME, itempath)

	// quando aggiungo una custom page in un progetto nuovo, la cartella 'website' non esiste. quindi la creo per poterci mettere dentro un file html
	var webFolder = m_fso.GetParentFolderName(GetPLCProjectPath()) + "\\" + WEBSITE_FOLDER_NAME
	if (!m_fso.FolderExists(webFolder))
		m_fso.CreateFolder(webFolder)
}

function AddWebTemplatePage()
{
	// estrae nodo xml destinazione
	var nodelist = app.SelectNodesXML(app.HMIGetElementData(TREENAME, ""))
	if (!nodelist || nodelist.length == 0)
		return
	var destnode = nodelist[0]
	
	// caricamento page template scelto
	var pagetemplatePath = ChooseWebTemplatePage()
	if (!pagetemplatePath)
		return
	var pagetempl = LoadWebPageTemplate(pagetemplatePath)
	if (!pagetempl)
	{
		app.MessageBox("Can not load page template " + pagetemplatePath, "", gentypes.MSGBOX.MB_ICONERROR)
		return false
	}
	
	// aggiunta del templatedata al documento xml
	var newnode = destnode.appendChild(pagetempl.templatedata.cloneNode(true))
	app.ParseNode(newnode)
	app.ModifiedFlag = true
}

function BuildWebSite()
{
	// log di inizio e focus sul tab resources dell'output
	app.PrintMessage("")
	app.PrintMessage(app.Translate("Building web site..."))
	app.CallFunction("extfunct.SelectOutputTab", 3)
	
	// device radice del progetto
	var device = app.SelectNodesXML("/*[@IsRootDevice]")[0]
	
	// estrae TUTTE le pagine in profondità
	var menus = device.selectNodes("webmenus//webmenu")
	var custompages = device.selectNodes("webmenus//webcustompage")
	var templatepages = device.selectNodes("webmenus//webtemplatepage")
	// se nessun menu e nessuna pagina custom esce subito, nulla da fare
	if ((menus.length + custompages.length + templatepages.length) == 0)
	{
		app.PrintMessage(app.Translate("Nothing to do, no web page"))
		return false
	}
	
	// cartella 'web' al di sotto del progetto PLC (la crea se necessario)
	var webFolder = m_fso.GetParentFolderName(GetPLCProjectPath()) + "\\" + WEBSITE_FOLDER_NAME
	if (!m_fso.FolderExists(webFolder))
		m_fso.CreateFolder(webFolder)
		
	webFolder += "\\"

	// scorre tutte le pagine custom per fare la copia dei files
	var custompage
	while (custompage = custompages.nextNode())
	{
		if (!genfuncs.ParseBoolean(custompage.getAttribute("enabled")))
			continue
		
		var src = custompage.getAttribute("link")
		if (!src)
		{
			var err = app.CallFunction("common.SplitFieldPath", custompage, "link")
			app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "BuildWebSite", "Missing filename for custom page", err)
			return false
		}

		// TODO perche' fa toLowerCase? Su Linux dove conta il case non funziona!
		// src = src.toLowerCase()

		// se indicato un file esterno alla cartella "web" lo copia
		if ((m_fso.GetParentFolderName(src) + "\\") != webFolder.toLowerCase())
			if (!DoCopyFile(src, webFolder))
				return false
		
		// il nome del file all'interno del sito è lo stesso della sorgente (deve essere 8+3!)
		custompage.setAttribute("filename", m_fso.GetFileName(src))
	}

	// primo ciclo per calcolare e valorizzare subito i nomi dei files
	var pagenum = 0
	var menu
	while (menu = templatepages.nextNode())
		menu.setAttribute("filename", GetWebFilename(pagenum++))
	
	// primo ciclo per calcolare e valorizzare subito i nomi dei files
	while (menu = menus.nextNode())
	{
		// se nessun parametro, nome file vuoto (ovvero non generare)
		var hasParams = menu.selectNodes("webmenuItems/webmenuItem").length != 0
		menu.setAttribute("filename", hasParams ? GetWebFilename(pagenum++) : "")
	}

	// la mappa ritornata dalla GetParamMap ha come chiave index.subindex, la trasforma indicizzando per name,
	// per comodità di ricerca del WebPageBuilder
	var paramsMap = {};
	if (m_allowedItemTypes & WEBITEMTYPES.PAR)
	{
		var allParamsMap = app.CallFunction(app.CallFunction("logiclab.get_TargetID") + ".GetParamMap");
		for (var key in allParamsMap)
		{
			var par = allParamsMap[key];
			paramsMap[par.name] = par;
		}
	}
	
	// generazione di tutte le pagine template
	templatepages.reset()
	while (menu = templatepages.nextNode())
	{
		if (!genfuncs.ParseBoolean(menu.getAttribute("enabled")))
			continue
		
		var builder = new WebPageBuilder(device, menu, webFolder, paramsMap)
		if (!builder.BuildWebTemplatePage())
			return false
	}
	
	// generazione di tutte le pagine menu
	menus.reset()
	while (menu = menus.nextNode())
	{
		if (!genfuncs.ParseBoolean(menu.getAttribute("enabled")))
			continue
		
		var builder = new WebPageBuilder(device, menu, webFolder, paramsMap)
		if (!builder.BuildWebMenu())
			return false
	}
	
	app.PrintMessage(app.Translate("Web site correctly built in ") + webFolder)
	return true;
}

function GetPLCProjectPath()
{
	var prjpath = app.CallFunction("logiclab.get_ProjectPath")
	return prjpath
}

function GetWebFilename(pagenum)
{
	if (pagenum == 0)
		// la prima pagina si chiama sempre index in modo da farla aprire automaticamente
		// sarà: o la prima pagina template (home), o la prima pagina menu
		return "index"
	else
		return "page" + pagenum
}

function OnUpdateGetConnected()
{
	return app.CallFunction("logiclab.get_Connected") ? 1 : 0;
}

function DownloadWebSite()
{
	var devlink = app.CallFunction("logiclab.GetDeviceLink");
	if (!devlink)
		return false;

	app.CallFunction("extfunct.SelectOutputTab", 3);  // tab resources
	
	// cancella prima la website esistente (tollera fallimento, es. dir non esistente)
	app.CallFunction(m_deleteDirFuncName, devlink, WEBROOT_FOLDER_NAME + "/" + WEBSITE_FOLDER_NAME);
	
	// creo le cartelle sul target
	app.CallFunction(m_createDirFuncName, devlink, WEBROOT_FOLDER_NAME + "/" + WEBSITE_FOLDER_NAME);
	app.CallFunction(m_createDirFuncName, devlink, WEBROOT_FOLDER_NAME + "/" + WEBSITE_FOLDER_NAME + "/" + WEBIMG_FOLDER_NAME);

	// scarica TUTTO il contenuto della cartella website, sia roba autogenerata che messa dall'utente
	var webFolder = m_fso.GetParentFolderName(GetPLCProjectPath()) + "\\" + WEBSITE_FOLDER_NAME;
	if (! m_fso.FolderExists(webFolder) )
	{
		var errmsg = genfuncs.FormatMsg(app.Translate("ERROR: Web site folder %1 does not exists"), webFolder);
		app.PrintMessage(errmsg);
		app.CallFunction("logiclab.UnlockComm");
		
		return false;
	}
	
	var folder = m_fso.GetFolder(webFolder);	
	for (var en = new Enumerator(folder.files); !en.atEnd(); en.moveNext())
	{
		var filepath = en.item().Path;
		var result = app.CallFunction(m_downloadFileFuncName, devlink, filepath, WEBROOT_FOLDER_NAME + "/" + WEBSITE_FOLDER_NAME + "/" + m_fso.GetFileName(filepath))
		if (!result)
		{
			// se fallisce un solo download lo considero fallito
			app.PrintMessage(app.Translate("ERROR: Web site download failed"));
			app.CallFunction("logiclab.UnlockComm");
			
			return false;
		}

		app.PrintMessage(app.Translate("Downloaded file") + ": " + filepath);
	}

	// scarica TUTTO il contenuto della cartella website\img
	var imgFolder = m_fso.GetParentFolderName(GetPLCProjectPath()) + "\\" + WEBSITE_FOLDER_NAME + "\\" + WEBIMG_FOLDER_NAME;
	if (m_fso.FolderExists(imgFolder))
	{
		var folder = m_fso.GetFolder(imgFolder);

		for (var en = new Enumerator(folder.files); !en.atEnd(); en.moveNext())
		{
			var filepath = en.item().Path;
			var result = app.CallFunction(m_downloadFileFuncName, devlink, filepath, WEBROOT_FOLDER_NAME + "/" + WEBSITE_FOLDER_NAME + "/" + WEBIMG_FOLDER_NAME + "/" + m_fso.GetFileName(filepath));
			if (!result)
			{
				// se fallisce un solo download lo considero fallito
				app.PrintMessage(app.Translate("ERROR: Web site download failed"));
				app.CallFunction("logiclab.UnlockComm");
				
				return false;
			}

			app.PrintMessage(app.Translate("Downloaded file") + ": " + filepath);
		}
	}

	app.PrintMessage(app.Translate("Web site downloaded on target"));
	app.CallFunction("logiclab.UnlockComm");
	
	return true;
}

function IsRemoteParamName(name)
{
	return name.substr(0,1) == "@" && name.indexOf(".") != -1;
}

// parsing di un possibile nome di parametro remoto, nella forma @deviceName.parName
function ParseRemoteParamName(name)
{
	if (name.substr(0,1) != "@")
		return;
	var pos = name.indexOf(".");
	if (pos == -1)
		return;
	
	var deviceName = name.substr(1, pos-1);
	var parName = name.substr(pos+1);

	var externalSlavesMap = app.CallFunction("target.GetExternalSlavesMap");
	var device = externalSlavesMap[deviceName];
	if (!device)
		return;
	
	var parIdx = genfuncs.ArrayFind(device.parList, function(par){ return par.name == parName } );
	if (parIdx == -1)
		return;
	var par = device.parList[parIdx];
	
	return { device: device, par: par };
}

function GetEnumValues(name, strFilterValues)
{
	var result = {};
	var mapFilterValues

	function AddEnumVal(value, descr)
	{
		if (!mapFilterValues)
			// nessun filtro, aggiunge al risultato valore e descr dell'enum originale
			result[value] = descr
		else
		{
			var found = mapFilterValues[value];

			// per i valori speciali true e false, prova anche con 1 e 0, l'utente potrebbe averli messi così
			if (found === undefined && value === "true")
				found = mapFilterValues["1"];
			else if (found === undefined && value === "false")
				found = mapFilterValues["0"];
			
			if (found !== undefined)
				// valore presente in mappa; usa !== stretto per evitare cast tra ""/undefined/null
				result[value] = found !== null ? found : descr
		}
	}
	
	
	if (typeof strFilterValues == "string" && strFilterValues != "")
	{
		// se stringa non nulla la converte in mappa
		// sono valide le sintassi:  0,1,2         (solo valori, usa le descrizioni dell'enum)
		//                           0:aaa,2:bbb   (valori e descrizioni alternative)
		mapFilterValues = {}
		var arrValues = strFilterValues.split(",")
		for (var i = 0; i < arrValues.length; i++)
		{
			var str = genfuncs.Trim(arrValues[i]);
			var arrVal = str.split(":");
			if (arrVal.length == 2)
				// mette in mappa valore+descr alternativa
				mapFilterValues[arrVal[0]] = arrVal[1]
			else
				// usa null per marcare elemento presente nella mappa ma senza descr
				mapFilterValues[arrVal[0]] = null
		}
	}

	if ((m_allowedItemTypes & WEBITEMTYPES.REMOTEPAR) && IsRemoteParamName(name))
	{
		var remotePar = ParseRemoteParamName(name);
		if (!remotePar)
			return;
		
		// caso parametro remoto da PARX
		var parTypes = app.CallFunction("configurator.GetParTypes");
		
		if (remotePar.par.typePar == parTypes.boolean)
		{
			AddEnumVal("true", "True");
			AddEnumVal("false", "False");
		}
		else if (remotePar.par.typePar == parTypes.Enum)
		{
			var curEnum = remotePar.device.enums[remotePar.par.enumId];
			for (var value in curEnum)
			{
				var enumElem = curEnum[value];
				if (value === "default" || enumElem.hidden)
					continue;
				
				AddEnumVal(value, enumElem.descr);
			}
		}
	}
	else
	{
		// caso variabile PLC locale (gestisce anche il caso di parametro locale)
		var plcVar = app.CallFunction("logiclab.GetGlobalVariable", name);
		if (plcVar)
		{
			if (plcVar.type.toUpperCase() == "BOOL")
			{
				AddEnumVal("true", "True");
				AddEnumVal("false", "False");
			}
			else
			{
				var enumElements = app.CallFunction("logiclab.GetEnumElements", plcVar.type);
				if (enumElements.Length == 0)
					return;

				for (var el = 0; el < enumElements.Length; el++)
				{
					var enumElement = enumElements.Item(el);
					AddEnumVal(enumElement.InitValue, enumElement.Name);
				}
			}
		}
	}

	return result;
}

// -----------------------------------------------------------------------------------------------------------------------------
// --------------------------------- classe WebPageBuilder, generatore della singola pagina ------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------
function WebPageBuilder (device, menu, webFolder, paramsMap)
{
	this.device = device;
	this.menu = menu;
	this.webFolder = webFolder;
	this.paramsMap = paramsMap;
	this.filename = this.menu.getAttribute("filename");
	this.refresh = parseInt(this.menu.getAttribute("refresh"));
	this.title = this.menu.getAttribute("title");
	if (!this.title)
		// se titolo non specificato usa caption
		this.title = this.menu.getAttribute("caption");
	// inizializzati da Init()
	this.template = null;
	this.htmFile = null;
}

var DATA_TYPE = {
	SYM: 'sym',
	PAR: 'par',
	REM_PAR: 'remotepar'
}

/**
 * Function called to print in the document the <b>select</b> control with the specified parameters
 * @param {!string} varName parameter name
 * @param {!DATA_TYPE} dataType indicates the variable type (symbol, parameter or remote parameter)
 * @param {!object} entries object containing elements to populate the select like <code>{"value": "description"}</code>
 * @param {?string} ctrlId id for the control
 * @param {?boolean} refresh indicates whether the control should be refreshed continuously
 * @param {?string} readOnly flag
 */
function LLX_Select(varName, dataType, entries, ctrlId, refresh, readOnly, addAttr)
{
	var refreshTxt = refresh ? genfuncs.sprintf("data-llweb-refresh=\"%s\"", refresh) : "";
	var ctrlIdTxt = ctrlId ? genfuncs.sprintf("id=\"%s\"", ctrlId) : "";
	var readOnlyTxt = genfuncs.ParseBoolean(readOnly) ? "disabled" : "";

	var strToWrite = genfuncs.sprintf("<select data-llweb-%s=\"%s\" %s %s %s%s>", dataType, varName, refreshTxt, ctrlIdTxt, readOnlyTxt, addAttr);

	for (var entry in entries)
		strToWrite += genfuncs.sprintf("<option value=\"%s\">%s</option>", entry, entries[entry]);

	strToWrite += "</select>";

	return strToWrite;
}

/**
 * Function called to print in the document the <b>input</b> control with the specified parameters
 * @param {!string} varName parameter name
 * @param {!DATA_TYPE} dataType indicates the variable type (symbol, parameter or remote parameter)
 * @param {?string} ctrlId id for the control
 * @param {?boolean} refresh indicates whether the control should be refreshed continuously
 * @param {?number} size indicates the dimension of the input field
 * @param {?string} format indicates sprintf format
 * @param {?string} readOnly flag
 */
function LLX_Text(varName, dataType, ctrlId, refresh, size, format, readOnly, addAttr)
{
	var refreshTxt = refresh ? genfuncs.sprintf("data-llweb-refresh=\"%s\"", refresh) : "";
	var ctrlIdTxt = ctrlId ? genfuncs.sprintf(" id=\"%s\"", ctrlId) : "";
	var sizeTxt = size ? genfuncs.sprintf(" size=\"%s\"", size) : "";
	var formatTxt = format ? genfuncs.sprintf(" data-llweb-format=\"%s\"", format) : "";
	var readOnlyTxt = genfuncs.ParseBoolean(readOnly) ? "readonly onfocus=\"this.blur()\"" : "";

	var strToWrite = genfuncs.sprintf("<input type=\"text\" data-llweb-%s=\"%s\" %s%s%s%s%s%s>", dataType, varName, refreshTxt, ctrlIdTxt, formatTxt, sizeTxt, readOnlyTxt, addAttr);
	return strToWrite;
}

/**
 * Function called to print in the document the <b>button</b> control with the specified parameters
 * @param {!string} varName parameter name
 * @param {!DATA_TYPE} dataType indicates the variable type (symbol, parameter or remote parameter)
 * @param {!Object} value value that should be written when the button pressed
 * @param {?boolean} refresh indicates whether the control should be refreshed continuously
 * @param {?string} ctrlId id for the control
 * @param {?string} title title of the control
 */
function LLX_Button(varName, dataType, value, refresh, ctrlId, title, addAttr)
{
	var content = (title !== undefined) ? title : value;
	var ctrlIdTxt = ctrlId ? genfuncs.sprintf("id=\"%s\"", ctrlId) : "";
	var refreshTxt = refresh ? genfuncs.sprintf(" data-llweb-refresh=\"%s\"", refresh) : "";

	var strToWrite = genfuncs.sprintf("<button data-llweb-%s=\"%s\" value=\"%s\" %s %s%s>%s</button>", dataType, varName, value, ctrlIdTxt, refreshTxt, addAttr, content);
	return strToWrite;
}

/**
 * Function called to print in the document the <b>toggle button</b> control with the specified parameters
 * @param {!string} varName parameter name
 * @param {!DATA_TYPE} dataType indicates the variable type (symbol, parameter or remote parameter)
 * @param {!Object} value value that should be written when the button pressed
 * @param {?boolean} refresh indicates whether the control should be refreshed continuously
 * @param {?string} ctrlId id for the control
 * @param {?string} title title of the control
 */
function LLX_ToggleButton(varName, dataType, value, refresh, ctrlId, title, addAttr)
{
	var content = (title !== undefined) ? title : value;
	var ctrlIdTxt = ctrlId ? genfuncs.sprintf("id=\"%s\"", ctrlId) : "";
	var refreshTxt = refresh ? genfuncs.sprintf(" data-llweb-refresh=\"%s\"", refresh) : "";

	var strToWrite = genfuncs.FormatMsg("<button data-llweb-toggle=\"%1\" data-llweb-%2=\"%3\" %4 %5%6>%7</button>",
										value, dataType, varName, ctrlIdTxt, refreshTxt, addAttr, content)

	return strToWrite;
}

/**
 * Function called to print in the document the <b>checkbox</b> control with the specified parameters
 * @param {!string} varName parameter name
 * @param {!DATA_TYPE} dataType indicates the variable type (symbol, parameter or remote parameter)
 * @param {?boolean} refresh indicates whether the control should be refreshed continuously
 * @param {?string} ctrlId id for the control
 * @param {?string} readOnly flag
*/
function LLX_CheckBox(varName, dataType, refresh, ctrlId, readOnly, addAttr)
{
	var refreshTxt = refresh ? genfuncs.sprintf("data-llweb-refresh=\"%s\"", refresh) : "";
	var ctrlIdTxt = ctrlId ? genfuncs.sprintf("id=\"%s\"", ctrlId) : "";
	var readOnlyTxt = genfuncs.ParseBoolean(readOnly) ? "disabled" : "";

	// metto valore dummy falso
	var strToWrite = genfuncs.sprintf("<input type=\"checkbox\" data-llweb-%s=\"%s\" %s %s %s%s/>",
										dataType, varName, refreshTxt, ctrlIdTxt, readOnlyTxt, addAttr);
	return strToWrite;
}

/**
 * Function called to print in the document the <b>radio button</b> control with the specified parameters
 * @param {!string} varName parameter name
 * @param {!DATA_TYPE} dataType indicates the variable type (symbol, parameter or remote parameter)
 * @param {!Object} value value that should be written when the button pressed
 * @param {?boolean} refresh indicates whether the control should be refreshed continuously
 * @param {?string} ctrlId id for the control
 * @param {?string} title title of the control
 * @param {?string} readOnly flag
 */
function LLX_Radio(varName, dataType, value, refresh, ctrlId, title, readOnly, addAttr)
{
	var refreshTxt = refresh ? genfuncs.sprintf("data-llweb-refresh=\"%s\"", refresh) : "";
	var content = (title !== undefined) ? title : value;
	var readOnlyTxt = genfuncs.ParseBoolean(readOnly) ? "disabled" : "";

	var strToWrite = genfuncs.sprintf("<input type=\"radio\" data-llweb-%s=\"%s\" name=\"rad-%s\" value=\"%s\" id=\"%s\" %s %s%s/><label for=\"%s\">%s</label>",
										dataType, varName, varName, value, ctrlId, refreshTxt, readOnlyTxt, addAttr, ctrlId, content);
	return strToWrite;
}

/**
 * Function called to print in the document the <b>image</b> control with the specified parameters
 * @param {!string} varName parameter name
 * @param {!DATA_TYPE} dataType indicates the variable type (symbol, parameter or remote parameter)
 * @param {!Object} imgFileNames file names separated by comma
 * @param {?boolean} refresh indicates whether the control should be refreshed continuously
 * @param {?number} width image width
 * @param {?number} height image height
 * @param {?string} readOnly flag
 */
function LLX_Image(varName, dataType, imgFileNames, refresh, width, height, readOnly, addAttr)
{
	var refreshTxt = refresh ? genfuncs.sprintf("data-llweb-refresh=\"%s\"", refresh) : "";

	var styleTxt = "style=\"";
	if (width > 0)
		styleTxt += genfuncs.sprintf("width: %spx;", width);
	if (height > 0)
		styleTxt += genfuncs.sprintf("height: %spx;", height);

	var isReadOnly = genfuncs.ParseBoolean(readOnly);

	if (!isReadOnly)
		styleTxt += "cursor: pointer;";

	styleTxt += "\"";

	// invento l'attributo data-readonly perche' l'immagine di default non ha un attributo readonly
	var readOnlyTxt = isReadOnly ? "data-readonly=\"true\"" : "data-readonly=\"false\"";

	var strToWrite = genfuncs.sprintf("<img data-llweb-%s=\"%s\" name=\"img-%s\" data-llweb-img=\"%s\" alt=\"no image\" %s %s %s%s/>",
										dataType, varName, varName, imgFileNames, styleTxt, refreshTxt, readOnlyTxt, addAttr);

	return strToWrite;
}

// parsing di una stringa contenente i nomi dei files per le immagini associate ad enum
// ES: "0:Bool0.PNG,1:Bool1.PNG,2:Bool2.PNG"   ->   [ { value:0, filename:"Bool0.PNG" }, { value:1, filename:"Bool1.PNG" }, { value:2, filename:"Bool2.PNG" } ]
function ParseImgFilenames(imgFilenames, menuItem)
{
	imgFilenames = imgFilenames.replace(/ /g, "");
	var imgFileNamesArr = imgFilenames.split(",");

	var result = [];
	for (var i = 0, j = imgFileNamesArr.length; i < j; i++)
	{
		var imgValueItem = imgFileNamesArr[i];

		if (!imgValueItem.match(/^(\d+|true|false):\w+\.\w+$/))
		{
			var err = app.CallFunction("common.SplitFieldPath", menuItem.selectSingleNode("enumValues"));
			app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "BuildWebParam", "Wrong syntax for '" + imgValueItem + "': it must be 'Value:ImageName.extension'", err);
			return;
		}

		var arr = imgValueItem.split(':');
		result.push( { value: arr[0], filename: arr[1] } );
	}
	
	return result;
}

// generazione codice htm per l'item specificato; deve essere un webmenuItem o webtemplateItem
WebPageBuilder.prototype.BuildWebParam = function(menuItem, addAttr)
{
	var result = { ctrlType: 0, ctrl: "", label: "", um: "", ctrlNames: [] }

	result.ctrlType = parseInt(GetNode(menuItem, "ctrlType"))
	if (result.ctrlType == -1)
	{
		var err = app.CallFunction("common.SplitFieldPath", menuItem)
		app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "BuildWebParam", "Invalid ctrlType", err)
		return
	}

	var varName = GetNode(menuItem, "name");

	if (result.ctrlType == HTMLCONTROLS.BUTTON || result.ctrlType == HTMLCONTROLS.SELECT || result.ctrlType == HTMLCONTROLS.RADIO)
	{
		var enumValues = GetEnumValues(varName, GetNode(menuItem, "enumValues"));
		if (!enumValues)
		{
			var err = app.CallFunction("common.SplitFieldPath", menuItem.selectSingleNode("name"));
			app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "BuildWebParam", genfuncs.FormatMsg(app.Translate("Enum \"%1\" is not valid"), varName), err);
			return;
		}
	}

	// label parametro, se non specificata usa name; indicare "" per NON visualizzare nessuna stringa
	result.label = GetNode(menuItem, "label");
	if (result.label == '""')
		result.label = "";
	else if (!result.label)
		result.label = varName;

	result.label = ReplaceWithEntities(result.label)
	
	if (addAttr)
		addAttr = " " + addAttr;
	else
		addAttr = "";

	var dataType;
	// se contiene la @ e' una var remota, quindi il varName avra' la sintassi tipo ModbusRTU:0,1,400.0,1000,INT
	if ((m_allowedItemTypes & WEBITEMTYPES.REMOTEPAR) && IsRemoteParamName(varName))
	{
		var remParObj = ParseRemoteParamName(varName);
		if (remParObj)
		{
			// conversione typeTarg in tipo IEC
			var typeIEC = app.CallFunction("configurator.GetTypeNameIEC", remParObj.par.typeTarg);
			if (typeIEC == "STRING" && remParObj.par.strsize)
				typeIEC += "[" + remParObj.par.strsize + "]";

			// NB: se Modbus il commaddr sarà decrementato di 1 direttamente dal plugin ModbusRTU
			var addr = remParObj.par.GetCommAddr(m_remotePars_ProtocolPar);
			
			varName = genfuncs.sprintf("%s:%d,%d,%s.%s,%d,%s", m_remotePars_ProtocolName, m_remotePars_netID, remParObj.device.slaveAddress, addr.commaddr, addr.commsubindex, m_remotePars_timeout, typeIEC);
			dataType = DATA_TYPE.REM_PAR;
			
			result.um = remParObj.par.um;
		}
		else
		{
			genfuncs.AddLog(enuLogLevels.LEV_CRITICAL, "BuildWebParam", app.Translate("Invalid remote parameter: ") + varName, genfuncs.SplitFieldPath(menuItem.selectSingleNode("name")));
			return;
		}
	}
	else if ((m_allowedItemTypes & WEBITEMTYPES.PAR) && (varName in this.paramsMap))
	{
		dataType = DATA_TYPE.PAR;
		var par = this.paramsMap[varName];
		result.um = par.um;
		varName = par.index;
	}
	else
	{
		dataType = DATA_TYPE.SYM;
	}
	
	if (result.um === undefined || result.um === null)
		result.um = "";
	
	switch (result.ctrlType)
	{
		case HTMLCONTROLS.TEXT:
			var format = GetNode(menuItem, "format");
			if (format && m_customFormatFunc)
				format = m_customFormatFunc(format);
			
			result.ctrl = LLX_Text(varName, dataType, "txt-ctrl-" + varName, true, GetNode(menuItem, "size"), format, GetNode(menuItem, "readOnly"), addAttr);
			break;

		case HTMLCONTROLS.SELECT:
			result.ctrl = LLX_Select(varName, dataType, enumValues, "sel-ctrl-" + varName, true, GetNode(menuItem, "readOnly"), addAttr);
			break;

		case HTMLCONTROLS.BUTTON:
			var cnt = 1;
			for (var v in enumValues)
			{
				result.ctrl += LLX_Button(varName, dataType, v, true, "btn-ctrl-" + varName + "-" + cnt, enumValues[v], addAttr);
				cnt++;
			}
			break;

		case HTMLCONTROLS.TOGGLE_BUTTON:
			result.ctrl = LLX_ToggleButton(varName, dataType, true, true, "chk-toggle-" + varName, "Toggle", addAttr);

			break;

		case HTMLCONTROLS.IMAGE:
			var imgFilenames = GetNode(menuItem, "enumValues")
			var imgWidth = parseInt(GetNode(menuItem, "imgWidth"))
			var imgHeight = parseInt(GetNode(menuItem, "imgHeight"))
			if (!imgFilenames)
			{
				var err = app.CallFunction("common.SplitFieldPath", menuItem.selectSingleNode("enumValues"));
				app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "BuildWebParam", "Images not specified", err);
				return;
			}

			// tolgo dalla stringa tutti gli spazi bianchi
			imgFilenames = imgFilenames.replace(/ /g, "");

			var imgFileNamesArr = ParseImgFilenames(imgFilenames, menuItem);
			if (!imgFileNamesArr)
				return;
			
			for (var i = 0, j = imgFileNamesArr.length; i < j; i++)
			{
				var imgFileName = imgFileNamesArr[i].filename;
				if (!CheckSourceImageExists(imgFileName))
				{
					var err = app.CallFunction("common.SplitFieldPath", menuItem.selectSingleNode("enumValues"));
					app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "BuildWebParam", "Image '" + imgFileName + "' not found in the source directory", err);
					return;
				}
			}

			result.ctrl = LLX_Image(varName, dataType, imgFilenames, true, imgWidth, imgHeight, GetNode(menuItem, "readOnly"), addAttr);
			break;
	
		case HTMLCONTROLS.RADIO:
			var cnt = 1;
			for (var v in enumValues)
			{
				result.ctrl += LLX_Radio(varName, dataType, v, true, "rad-ctrl-" + varName + "-" + cnt, enumValues[v], GetNode(menuItem, "readOnly"), addAttr);
				cnt++;
			}
			break;
			
		case HTMLCONTROLS.CHECKBOX:
			result.ctrl = LLX_CheckBox(varName, dataType, true, "chk-ctrl-" + varName, GetNode(menuItem, "readOnly"), addAttr);
			break;
	}
	
	return result
}


function CheckSourceImageExists(fileName)
{
	// guardo se esiste il file
	var imgFile = m_fso.GetParentFolderName(GetPLCProjectPath()) + "\\" + WEBSITE_FOLDER_NAME + "\\" + WEBIMG_FOLDER_NAME + "\\" + fileName;
	if (m_fso.FileExists(imgFile))
		// se esiste comparo anche il case (nota: la funzione GetFileName() di FileSystemObject non preserva il case)
		return (m_fso.GetFile(imgFile).Name == fileName);

	return false;
}


// caricamento del template di sito specificato; si suppone path relativo al catalogo
function LoadWebSiteTemplate(templatepath)
{
	var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0")
	xmldoc.async = false
	if (!templatepath || !xmldoc.load(app.CatalogPath + templatepath))
		return false
	
	var root = xmldoc.selectSingleNode("sitetemplate")
	var result = {}
	
	result.pageheader    = GetNode(root, "pageheader")
	result.pagefooter    = GetNode(root, "pagefooter")
	result.sectionheader = GetNode(root, "sectionheader")
	result.sectionfooter = GetNode(root, "sectionfooter")
	result.param         = GetNode(root, "param")
	
	result.tabheader     = GetNode(root, "tabheader")
	result.tabfooter     = GetNode(root, "tabfooter")
	result.tabactive     = GetNode(root, "tabactive")
	result.tabinactive   = GetNode(root, "tabinactive")
	result.tabclose      = GetNode(root, "tabclose")
	
	result.menuheader    = GetNode(root, "menuheader")
	result.menuitem      = GetNode(root, "menuitem")
	result.menuclose     = GetNode(root, "menuclose")
	result.menufooter    = GetNode(root, "menufooter")
	
	// caricamento files
	result.files = []
	var nodelist = root.selectNodes("files/file")
	var node
	while (node = nodelist.nextNode())
		result.files.push(node.text)
	
	return result
}

// caricamento del template di pagina indicato; si suppone path relativo al catalogo
function LoadWebPageTemplate(templatepath)
{
	var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0")
	xmldoc.async = false
	if (!templatepath || !xmldoc.load(app.CatalogPath + templatepath))
		return false
	
	var root = xmldoc.selectSingleNode("pagetemplate")
	var result = {}
	
	// nodo <webtemplatepage> che sarà inserito nel documento xml; salva il link al file .pagetempl corrente
	result.templatedata = root.selectSingleNode("templatedata/webtemplatepage")
	result.templatedata.setAttribute("pagetemplate", templatepath)
	result.templatedata.setAttribute("enabled", 1)
	
	result.extraheader  = GetNode(root, "extraheader")
	result.pagebody     = GetNode(root, "pagebody")
	
	// caricamento parametri
	result.params = {}
	var nodelist = root.selectNodes("params/param")
	var node
	while (node = nodelist.nextNode())
	{
		var item = { htm: node.text, addAttr: node.getAttribute("addAttr"), note: node.getAttribute("note") }
		result.params[node.getAttribute("id")] = item
	}
	
	// caricamento files
	result.files = []
	var nodelist = root.selectNodes("files/file")
	while (node = nodelist.nextNode())
		result.files.push(node.text)
	
	return result
}

function GetWebFilename(pagenum)
{
	if (pagenum == 0)
		// la prima pagina si chiama sempre index in modo da farla aprire automaticamente
		// sarà: o la prima pagina template (home), o la prima pagina menu
		return "index"
	else
		return "page" + pagenum
}

function IsImage(filename)
{
	var ext = m_fso.GetExtensionName(filename).toLowerCase();
	return ext == "jpg" || ext == "jpeg" || ext == "png" || ext == "bmp" || ext == "gif";
}

// generazione menu a tendina di navigazione
WebPageBuilder.prototype.BuildSubmenuNavigation = function(curmenu)
{
	var submenus = curmenu.selectNodes("webmenu | webcustompage | webtemplatepage")
	if (!submenus || submenus.length == 0)
		return ""
		
	var result = this.template.menuheader
	
	var submenu
	while (submenu = submenus.nextNode())
	{
		var filename = submenu.getAttribute("filename")
		if (filename)
		{
			if (filename.indexOf(".") == -1)
				filename += EXT_HTM
		}
		else
			filename = "#"
			
		result += MultipleReplace(this.template.menuitem, /%CAPTION%/g, submenu.getAttribute("caption"), /%LINK%/g, filename)
		result += this.BuildSubmenuNavigation(submenu)
		result += this.template.menuclose
	}
	
	result += this.template.menufooter
	return result
}

// generazione tabs navigazione
WebPageBuilder.prototype.BuildTabNavigation = function()
{
	var webmenus = this.device.selectSingleNode("webmenus")
	var menus = webmenus.selectNodes("webmenu | webcustompage | webtemplatepage")
	if (!menus || menus.length == 0)
		return ""
	
	// calcola il path completo e il tab padre (anche per i sottomenu)
	var pagepath = ""
	var menu = this.menu
	var currentTab
	while (menu && (menu.nodeName == "webmenu" || menu.nodeName == "webcustompage" || menu.nodeName == "webtemplatepage"))
	{
		currentTab = menu
		pagepath = menu.getAttribute("caption") + (pagepath ? " &gt; " + pagepath : "")
		menu = menu.parentNode
	}
	
	var title = this.menu.getAttribute("title")
	if (!title)
		// se titolo non specificato usa caption
		title = this.menu.getAttribute("caption")
	
	// header tab
	var result = MultipleReplace(this.template.tabheader, /%TITLE%/g, title, /%FILENAME%/g, this.menu.getAttribute("filename"), /%PAGEPATH%/g, pagepath)
	
	while (menu = menus.nextNode())
	{
		var filename = menu.getAttribute("filename")
		// se nome di file non presente (=pagina vuota) oppure il tab è la pagina corrente annulla il link, altrimenti aggiunge .HTM
		if (!filename || menu == this.menu)
			filename = "#"
		else
		{
			if (filename.indexOf(".") == -1)
				filename += EXT_HTM
		}
		
		var t = (menu == currentTab) ? this.template.tabactive : this.template.tabinactive
		result += MultipleReplace(t, /%CAPTION%/g, menu.getAttribute("caption"), /%LINK%/g, filename)
		result += this.BuildSubmenuNavigation(menu, this.template)
		result += this.template.tabclose
	}
	
	// footer tab
	result += MultipleReplace(this.template.tabfooter, /%TITLE%/g, title, /%FILENAME%/g, this.menu.getAttribute("filename"), /%PAGEPATH%/g, pagepath)
	return result
}

WebPageBuilder.prototype.Init = function ()
{
	if (this.refresh < WEBPAGE_MIN_REFRESH && this.refresh != 0)
	{
		var err = app.CallFunction("common.SplitFieldPath", this.menu, "refresh")
		app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "WebPageBuilder.Init", "Refresh time must be >= " + WEBPAGE_MIN_REFRESH + " or 0", err)
		return false
	}
	
	// caricamento file .sitetempl associato
	var sitetemplatePath = this.menu.getAttribute("sitetemplate")
	this.template = LoadWebSiteTemplate(sitetemplatePath)
	if (!this.template)
	{
		var err = app.CallFunction("common.SplitFieldPath", this.menu, "sitetemplate")
		app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "WebPageBuilder.Init", "Can not load site template " + sitetemplatePath, err)
		return false
	}
	
	// copia di tutti i files specificati nel template
	var srcpath = m_fso.GetParentFolderName(app.CatalogPath + sitetemplatePath) + "\\"
	for (var i = 0; i < this.template.files.length; i++)
		if (!DoCopyFile(srcpath + this.template.files[i], this.webFolder))
			return false
	
	// creazione a apertura nuovi files HTM
	try
	{
		this.htmFile = new ActiveXObject("ADODB.Stream");
		this.htmFile.CharSet  = "utf-8"
		this.htmFile.Open();
	}
	catch (ex)
	{
		app.PrintMessage(app.Translate("ERROR creating text file: ") + ((ex && ex.description) ? ex.description : "unknown error"))
		// ritorna cmq true per saltare la generazione di questa pagina ma continuare con il resto
	}
	
	return true
}

// generazione header
WebPageBuilder.prototype.WriteHeader = function (extraHeader)
{
	var content = MultipleReplace(this.template.pageheader, /%TITLE%/g, this.title, /%FILENAME%/g, this.filename, /%REFRESH%/g, this.refresh, /%EXTRAHEADER%/g, extraHeader);
	this.htmFile.WriteText(content)
	
	// generazione tab navigazione
	var content = this.BuildTabNavigation()
	this.htmFile.WriteText(content)
}

// generazione footer
WebPageBuilder.prototype.WriteFooter = function ()
{
	var content = MultipleReplace(this.template.pagefooter, /%TITLE%/g, this.title, /%FILENAME%/g, this.filename, /%REFRESH%/g, this.refresh)
	this.htmFile.WriteText(content)
	this.htmFile.SaveToFile(this.webFolder + this.filename + EXT_HTM, 2 ) // 2 = adSaveCreateOverWrite
	this.htmFile.Close();
	
	this.htmFile = null
}

// generazione pagina HTML di menu
WebPageBuilder.prototype.BuildWebMenu = function()
{
	if (!this.filename)
		return true  // se nessun filename significa che NON va generata la pagina (poichè non ci sono parametri)
	
	if (!this.Init())
		return false
	
	if (!this.htmFile)
	{
		app.PrintMessage(genfuncs.FormatMsg(app.Translate("Table page '%1' will NOT be generated (%2%3)"), this.title, this.filename, EXT_HTM))
		return true
	}
	
	this.WriteHeader("")
	
	var numParam = 0
	var menuItems = this.menu.selectNodes("webmenuItems/webmenuItem")
	var menuItem
	while (menuItem = menuItems.nextNode())
	{
		var section = ReplaceWithEntities(GetNode(menuItem, "section"))
		
		var result = this.BuildWebParam(menuItem)
		if (!result)
			return false
		
		if (numParam == 0 || section)
		{
			// chiusura sezione precedente
			if (numParam > 0)
				this.htmFile.WriteText(this.template.sectionfooter)
			
			// apertura nuova sezione
			this.htmFile.WriteText(MultipleReplace(this.template.sectionheader, /%SECTION%/g, section))
		}
		
		var content = MultipleReplace(this.template.param, /%LABEL%/g, result.label, /%CTRL%/g, result.ctrl, /%UM%/g, result.um)
		this.htmFile.WriteText(content)

		numParam++
	}
	
	// chiusura ultima sezione
	if (numParam > 0)
		this.htmFile.WriteText(this.template.sectionfooter)
	
	this.WriteFooter()
	return true
}


// generazione pagina HTML di template
WebPageBuilder.prototype.BuildWebTemplatePage = function()
{
	if (!this.filename)
		return true  // se nessun filename significa che NON va generata la pagina (poichè non ci sono parametri)
	
	if (!this.Init())
		return false
	
	if (!this.htmFile)
	{
		app.PrintMessage(genfuncs.FormatMsg(app.Translate("Table page '%1' will NOT be generated (%2%3)"), this.title, this.filename, EXT_HTM))
		return true
	}
	
	// caricamento file .pagetempl associato
	var pagetemplatePath = this.menu.getAttribute("pagetemplate")
	var pagetempl = LoadWebPageTemplate(pagetemplatePath)
	if (!pagetempl)
	{
		var err = app.CallFunction("common.SplitFieldPath", this.menu, "pagetemplate")
		app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "BuildWebTemplatePage", "Can not load page template " + pagetemplatePath, err)
		return false
	}
	
	var destpathImg = this.webFolder + WEBIMG_FOLDER_NAME + "\\";
	if (!m_fso.FolderExists(destpathImg))
		m_fso.CreateFolder(destpathImg);
	
	// copia di tutti i files specificati nel template
	var srcpath = m_fso.GetParentFolderName(app.CatalogPath + pagetemplatePath) + "\\"
	for (var i = 0; i < pagetempl.files.length; i++)
		if (!DoCopyFile(srcpath + pagetempl.files[i], this.webFolder))
			return false
	
	
	this.WriteHeader(pagetempl.extraheader)
	
	
	var pagebody = pagetempl.pagebody
	
	var menuItems = this.menu.selectNodes("webtemplateItems/webtemplateItem")
	var menuItem
	while (menuItem = menuItems.nextNode())
	{
		// ottiene template del parametro dal pagetemplate
		var id = menuItem.getAttribute("id")
		var param = pagetempl.params[id]
		if (!param)
		{
			app.PrintMessage(app.Translate("ERROR: param with id")+ " " + id + " " + app.Translate("not found in page template") + " " +  pagetemplatePath)
			return false
		}
		
		// genera il l'item solo se parametro associato
		var name = GetNode(menuItem, "name");
		if (name)
		{
			var ctrlType = parseInt(GetNode(menuItem, "ctrlType"));
			if (ctrlType == HTMLCONTROLS.IMAGE)
			{
				// per i controlli di tipo image, copia le immagini specificate dalla cartella del template a quella del progetto sotto IMG
				var imgFileNamesArr = ParseImgFilenames(GetNode(menuItem, "enumValues"), menuItem);
				if (!imgFileNamesArr)
					return false;
				
				for (var i = 0; i < imgFileNamesArr.length; i++)
					if (!DoCopyFile(srcpath + imgFileNamesArr[i].filename, destpathImg))
						return false;
			}
			
			var result = this.BuildWebParam(menuItem, param.addAttr)
			if (!result)
				return false
			
			content = MultipleReplace(param.htm, /%LABEL%/g, result.label, /%CTRL%/g, result.ctrl, /%UM%/g, result.um)
		}
		else
			// parametro disabilitato
			content = ""
			
		pagebody = pagebody.replace("%PARAM_" + id + "%", content)
	}

	this.htmFile.WriteText(pagebody)

		
	this.WriteFooter()
	return true
}
// -----------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------------------------------------------

function DoCopyFile(src, destFolder)
{
	if (destFolder.slice(-1) != "\\")
		destFolder += "\\";
	
	// copia esattamente con lo stesso nome specificato anche nella destinazione, per essere sicuro di copiare con il case originale giusto
	var dest = destFolder + m_fso.GetBaseName(src) + "." + m_fso.GetExtensionName(src);
	
	try
	{
		m_fso.CopyFile(src, dest, true)
		return true
	}
	catch (ex)
	{
		app.PrintMessage("ERROR copying " + src + " to " + dest)
		return false
	}
}

function MultipleReplace(str)
{
	if (!str) return ""
	
	for (var i = 1; i < arguments.length; i += 2)
		str = str.replace(arguments[i], arguments[i+1])
	return str
}

function ReplaceWithEntities(str)
{
	// sostituisce le entities più importanti
	// NB: &amp; deve essere la prima, altrimenti autosostituisce poi le altre...
	return MultipleReplace(str, /&/g, "&amp;", /°/g, "&deg;", /"/g, "&quot;", /'/g, "&#39;", /</g, "&lt;", />/g, "&gt;")
}

function OnEndMenuEdit(treepath, newtext)
{
	// rinfresca la finestra corrente per aggiornare il titolo
	var curdata = app.HMIGetElementData(TREENAME, treepath)
	
	app.HMISetCurElement(TREENAME, treepath)
	app.OpenWindow(app.HMIGetLinkedWindow(TREENAME, treepath), "", curdata)
}

function OpenWebSitePreview()
{
	var msg
		
	var path = GetWebSitePath();
	if (!path)
	{
		msg = app.Translate("Can not open preview: Web site not found")
		app.PrintMessage(msg)
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION | gentypes.MSGBOX.MB_OK ) 
		return
	}
	
	var filename = path + "\\index" + EXT_HTM;
	// apre la pagina index.htm con il browser associato
	var shell = app.CallFunction("common.CreateObject", "WScript.Shell")
	try
	{
		shell.Run('"' + filename + '"')
	}
	catch (ex)
	{
		msg = app.Translate("Error while opening preview: Web site not found")
		app.PrintMessage(msg)
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONERROR | gentypes.MSGBOX.MB_OK ) 
	}
}

// cerca la cartella "web" con il sito web autogenerato da application
function GetWebSitePath(device)
{
	var websitePath = m_fso.GetParentFolderName(app.GetDocumentPath()) + "\\" + WEBSITE_FOLDER_NAME;
	if (m_fso.FolderExists(websitePath))
		return websitePath
	else	
		return ""
}

function UpgradeNode(root, oldVersion)
{
	var xmldoc = app.GetXMLDocument();
	
	if (oldVersion < 2.0)
	{
		// rinomina imgFilename in enumValues
		var node;
		var nodelist = root.selectNodes("webmenu/webmenuItems/webmenuItem/imgFilename");
		while (node = nodelist.nextNode())
			app.CallFunction("common.RenameXMLElement", node, "enumValues");
		
		var nodelist = root.selectNodes("webtemplatepage/webtemplateItems/webtemplateItem/imgFilename");
		while (node = nodelist.nextNode())
			app.CallFunction("common.RenameXMLElement", node, "enumValues");
	}
}

function OnDropWebMenu(txt, treepath)
{
	if (m_customOnDropWebMenuFunc)
		m_customOnDropWebMenuFunc(txt, treepath);
}