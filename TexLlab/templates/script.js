var m_fso = new ActiveXObject("Scripting.FileSystemObject")
var m_shell = new ActiveXObject("WScript.Shell")

// da plcObject.h
var PLCOBJ_TYPES = {
	PLCOBJ_NULL:	0x00000000,
	PLCOBJ_REFER:	0x00000001,
	PLCOBJ_VAR:		0x00000002,
	PLCOBJ_CONST:	0x00000004,
	PLCOBJ_PROGR:	0x00000008,
	PLCOBJ_INSTR:	0x00000010,
	PLCOBJ_LABEL:	0x00000020,
	PLCOBJ_FBLOCK:	0x00000040,
	PLCOBJ_FUNC:	0x00000080,
	PLCOBJ_TASK:	0x00000100,
	PLCOBJ_OPR:		0x00000200,
	PLCOBJ_TYPE:	0x00000400,
	PLCOBJ_MACRO:	0x00000800,
	PLCOBJ_ENUM:	0x00001000,
	PLCOBJ_STRUCT:	0x00002000,
	PLCOBJ_SUBR:	0x00004000,
	PLCOBJ_TYPEDEF:	0x00008000,
	PLCOBJ_IDXREF:	0x00010000,
	PLCOBJ_ARRBASE:	0x00020000
}

var SYMLOC = {
	symlAll: 0,
	symlProject: 1,
	symlTarget: 2,
	symlLibrary: 3,
	symlLocal: 4,
	symlEmbedded: 5,
	symlAuxSrc: 6
};

var TYSOURCE = {
	tysIL:			0, 
	tysFBD:			1,
	tysLD:			2,
	tysST:			3,
	tysSFC:			4,
	tysEmbedded:	5,
	tysUndefined:	6
}

// primo enum utente (internamente nel PCN)
var ENUM_BASE = 100

// enumerativo dei TYPEPAR (ovvero DeviceType)
// !!! ATTENZIONE: se si aggiungono tipi ricordarsi di aggiornare anche __LAST !!!
var TYPEPAR  = { INT:0, DINT:1, WORD:2, DWORD:3, REAL:4, BOOL:5, SINT:6, BYTE:7, STRING:8, __LAST:8 }

// descrizioni dei TYPEPAR, è una mappa dove la chiave è il valore del TYPEPAR corrispondente
var TYPEPAR_DESCR = { 0:"Signed 16-bit", 1:"Signed 32-bit", 2:"Unsigned 16-bit", 3:"Unsigned 32-bit", 4:"Real", 5:"Boolean", 6:"Signed 8-bit", 7:"Unsigned 8-bit", 8:"String" }

// enumerativo dei TYPETARG (ovvero ApplicationType)
var TYPETARG = { SINT:0, INT:1, DINT:2, USINT:3, UINT:4, UDINT:5, BYTE:6, WORD:7, DWORD:8, REAL:9, BOOL:10, STRING:11 }


// valore di uscita che termina subito una serie di eventhandler
var ERRORLEVEL_CRITICAL = 1 << 31
var gentypes = app.CallFunction("common.GetGeneralTypes")
var MSGBOX = gentypes.MSGBOX
var enuLogLevels = gentypes.enuLogLevels

// import funzioni generiche
var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var ParseBoolean = genfuncs.ParseBoolean
var GetNode = genfuncs.GetNode

// import fasi di compilazione
var COMPILATIONPHASE = app.CallFunction("compiler.GetCompilationPhase")


var m_lastCompilationResult

var m_targetChanged = false   // flag messo a true dopo un 'change target'
var m_oldTargetID             // target precedente prima di un 'change target'

var TREENAME = "tree1"

var MODBUSADDRESSTYPE = {
	MODBUS: 0,
	JBUS: 1
};

/*
	AXELDBVER_0
	
	specificare 0 se si usa l'indirizzamento 'modbus' (ovvero gli indirizzi database hanno già il +1) o 1 se 'jbus' (ovvero bisogna aggiungere +1)

	Protocol	Address		WinCommLibs			MBSlave/COPS		DBase	MODBUS_ADDRESS_OFFSET	Tabella def.
				specified																			Parametri
	JBUS		1000		1000 	-> 1000		1000+1	->	1001	1001	<-					1	1000
	MODBUS		1000		1000-1 	->  999		999+1	->	1000	1000	<-					0	1000
	
	Con questa versione in configurazione JBUS non è possibile utilizzare il CANOPEN slave correttamente
	CANOPEN		1000		1000				1000				1000	<-					0	1000
	
	--------------------------------------------------------------------------------------------------------------------------------------
	
	AXELDBVER_1
	
	specificare 0 se si usa l'indirizzamento 'modbus' o 1 se 'jbus'. l'informazione viene gestita dal modbus slave

	Protocol	Address		WinCommLibs			MBSlave/COPS		DBase	MODBUS_ADDRESS_OFFSET	Tabella def.
				specified																			Parametri
	JBUS		1000		1000 	-> 1000		1000	->	1000	1000	serve al modbus slave	1000
	MODBUS		1000		1000-1 	->  999		999+1	->	1000	1000	serve al modbus slave	1000
	CANOPEN		1000		1000	-> 1000		1000	->	1000	1000	non viene considerato	1000

	La versione è relativa al singolo target
*/
var MODBUS_ADDRESS_OFFSET = MODBUSADDRESSTYPE.JBUS;
// nome del nodo "targetdef" nel PCT
var TARGETDEF_NODE = "targetdef"
// estensione dei templates nel catalogo
var PCT_EXT = "PCT"
// nome della cartella sotto il progetto con gli user templates
var USERTEMPLATES_DIR = "UserTemplates"
// user template sub directory, specificare solo se i custom templates sono in una sotto cartella di Catalog USERTEMPLATES_DIR
var USERTEMPLATES_SUBDIR = "" // "SubDir1\\SubDir2"

// da L:\win.net\Pagelab_trunk\HMIPrjProfile.h
var enuHMIProfileFlags =
{
	profAllowDownload: 1,
	profDefault: 2,
	profExpVars: 4,
	profLocalParameters: 8,
	profCommonLibraries: 16,
	profRemoteSlavesParameters: 32,
	profSaveRSM: 64
};


function Init(intf)
{
	app.CallFunction("common.SetMainTree", TREENAME)
	app.CallFunction("compiler.SetAppName", "LogicLab")
	app.CallFunction("compiler.SetLogicLabName", "LogicLab")
	app.CallFunction("common.Set_CatalogQuerySection", "plcconfig")
	
	// indica alle funzioni esportate in ExtFunct.cpp di LogicLab che riceveranno il parametro 'group' (aggiunto da poco) dalle chiamate js
	// poichè le funzioni esportate da estensioni "C" non supportano parametri variabili, è il metodo più affidabile e corretto
	app.CallFunction("extfunct.SetGroupParameterSupported", true)
	return 1
}

function GetLogicLabTypes()
{
	var result = {}
	result.PLCOBJ_TYPES = PLCOBJ_TYPES
	result.TYSOURCE = TYSOURCE
	result.TYPEPAR_DESCR = TYPEPAR_DESCR
	result.TYPEPAR = TYPEPAR
	result.TYPETARG = TYPETARG
	result.ENUM_BASE = ENUM_BASE
	result.SYMLOC = SYMLOC;
	result.enuHMIProfileFlags = enuHMIProfileFlags;
	return result
}

function IsStandardTypePar(type)
{
	return type <= TYPEPAR.__LAST
}

function GetModbusAddressOffset()
{
	return MODBUS_ADDRESS_OFFSET
}

// ritorna la modalità di default per i PCT degli slaves Modbus, in mancanza di altre indicazioni nel PCT stesso
/*function GetDefaultModbusAddressOffsetOfSlaves()
{
	return MODBUSADDRESSTYPE.MODBUS;
}*/

function OnNew()
{
	// apertura welcome screen
	app.OpenWindow("welcome", "", "")
}

function OnLoad(filename)
{
	//var arrArgs = VBArray( app.StartupArguments ).toArray()
	
	app.HMISetCaption(TREENAME, "/ROOT", app.Translate("Configuration"))
	
	// aggiunta del nodo principale all'inizio dopo il new project
	var isEmpty = CheckForEmptyProject()
	
	if (!isEmpty && m_targetChanged)
	{
		// riabilita msg di errori su caricamento template (era stato disabilitato da CheckForTargetChange), ormai le varie onloadnode / UpgradeNode sono già girate
		app.CallFunction("extfunct.SetSuppressTemplateErrorMsg", false);
		
		// OnLoad subito dopo un cambio target effettuato dalla CheckForTargetChange()
		var nodelist = app.SelectNodesXML("/*[@IsRootDevice]")
		if (nodelist.length == 0)
			return
			
		// chiama funzione specifica di OnTargetChanged del nuovo target corrente (assume nome estensione = nome target !)
		var targetID = app.CallFunction("logiclab.get_TargetID")
		// funzione OnTargetChanged per ora disabilitata. è adatta solo per cambi di contenuto ma non di struttura, in quanto tutte le validazioni e upgrade sono già stati fatti
		//app.CallFunction(targetID + ".OnTargetChanged", nodelist[0], m_oldTargetID)
	}

	// apre la finestra principale del target corrente all'avvio (NB deve chiamarsi main)
	app.OpenWindow("main", "", "/*[@IsRootDevice]")
	
	if (isEmpty)
	{
		// msg di creazione nuovo progetto, nome del progetto PLC come data del msg
		app.SendMessage("createNewProject", filename)
	}
}

// crea cartelle annidate
function CreateFullFolderPath(basePath, newPath)
{
	var foldersPath = basePath
	
	if (!m_fso.FolderExists(basePath + "\\" + newPath))
	{
		var folders = newPath.split( "\\" )
		for ( var fi = 0; fi < folders.length; fi++ )
		{							
			foldersPath += "\\" + folders[ fi ]
			
			if (m_fso.FolderExists(foldersPath))
				continue
			
			//	crea la sottocartella sarà messa allo stesso livello del catalogo
			//	la cartella finale sarà ModbusCustom o CANcustom
			m_fso.CreateFolder(foldersPath)
		}
	}
}

// copia di tutti i PCT utente nella cartella del progetto locale dal catalogo
function BackupAllUserTemplates(destPath, slavesList)
{
	destPath += "\\" + USERTEMPLATES_DIR
	// se la cartella destinazione esiste già la cancella, in modo da ricrearla dopo e far contenere solo i PCT attualmente usati
	if (m_fso.FolderExists(destPath))
	{
		try
		{
			m_fso.DeleteFolder(destPath)
		}
		catch (ex)
		{
			// anche se fallisce la cancellazione della cartella procede cmq: se era aperta in explorer,
			// è cmq probabile che tutto il contenuto sia stato cancellato e sia rimasta solo la cartella vuota
			app.PrintMessage("ERROR deleting folder " + destPath + " : " + ex.message)
		}
	}
	
	if (slavesList === undefined)
	{
		// soppressione log per funzione non trovata su vecchi target
		var oldmask = app.LogMask
		app.LogMask = 0
		var extName = app.CallFunction("logiclab.get_TargetID")
		slavesList = app.CallFunction(extName + ".GetAllSlaveDevices")
		app.LogMask = oldmask
	}
	
	if (!slavesList || slavesList.length == 0)
		return    // nessuno slave, niente da fare

	// scorre l'elenco di tutti gli slaves (funziona sia con array che con IXMLDOMNodeList)
	var alreadyCopied = {};
	var totCopied = 0
	for (var i = 0, t = slavesList.length; i < t; i++)
	{
		// cerca nella cache del catalogo per deviceid
		if (typeof slavesList[i] == "string")
			var deviceid = slavesList[i];          // già una stringa (slavesList è quindi per forza un array)
		else
			var deviceid = slavesList[i].nodeName; // altro, assume sia IXMLDOMNode
			
		var nodelist = app.CallFunction("extfunct.QueryCatalog", "//deviceinfo[@deviceid = '" + deviceid + "']")
		if (nodelist && nodelist.length != 0)
		{
			var deviceinfo = nodelist[0]
			// il PCT è da salvare insieme al progetto se ha attributi editingEnabled=true (ModbusCustomEditor o CANcustomEditor) o importedFromEDS=true o importedFromESI=true
			if (genfuncs.ParseBoolean(deviceinfo.getAttribute("editingEnabled")) || 
				genfuncs.ParseBoolean(deviceinfo.getAttribute("importedFromEDS")) ||
				genfuncs.ParseBoolean(deviceinfo.getAttribute("importedFromESI")))
			{
				var PCT = deviceinfo.getAttribute("template")
				if (alreadyCopied[PCT])
					continue;
				
				var PCTpath = m_fso.GetParentFolderName(PCT)
				var caption = deviceinfo.getAttribute("caption")
				var version = deviceinfo.getAttribute("version")
				
				try
				{
					if (!m_fso.FolderExists(destPath))
						// alla prima copia crea la cartella UserTemplates (che di sicuro non c'è in quanto cancellata all'inizio)
						m_fso.CreateFolder(destPath)
						
					// crea gerarchia folder PCTpath
					CreateFullFolderPath(destPath, PCTpath)
					
					m_fso.CopyFile(app.CatalogPath + PCT, destPath + "\\" + PCT, true)
					
					var msg = app.Translate("User object '%1 %2' copied into project from %3")
					app.PrintMessage(genfuncs.FormatMsg(msg, caption, version, PCT))
					totCopied++
					alreadyCopied[PCT] = true;
					
					// copia icone per i device EtherCAT
					if (genfuncs.ParseBoolean(deviceinfo.getAttribute("importedFromESI")))
						BackupUserTemplate_ESI(deviceinfo, destPath, PCTpath)
				}
				catch (ex)
				{
					var msg = app.Translate("ERROR while copying %1 : %2")
					app.PrintMessage(genfuncs.FormatMsg(msg, PCT, ex.message))
				}
			}
		}
	}
}

// ----- queste due funzioni BackupUserTemplate_ESI e RestoreUserTemplate_ESI dovrebbe andare nel LLXPlugin_EtherCAT...
// tuttavia la RestoreAllUserTemplates è chiamata nella OnBeforeLoad quindi i PCT non sono ancora caricati, quindi deve essere raggiungibile direttamente da qui!
function BackupUserTemplate_ESI(deviceinfo, destPath, PCTpath)
{
	// crea folder se necessario
	CreateFullFolderPath(destPath, PCTpath + "\\img")
	CreateFullFolderPath(destPath, PCTpath + "\\ESI");
	
	//	imgPath destinazione
	var imgPath = destPath + "\\" + PCTpath + "\\img\\"
	var esiPath = destPath + "\\" + PCTpath + "\\ESI\\";

	// copia icona del device: nella cache del catalogo è già un path assoluto
	var srcImg = deviceinfo.getAttribute("icon");
	if (srcImg && m_fso.FileExists(srcImg))
		m_fso.CopyFile(srcImg, imgPath, true)
	
	// copia icone dei gruppi
	var grpNodelist = deviceinfo.selectNodes("groups/group")
	var grpNode
	while (grpNode = grpNodelist.nextNode())
	{
		var srcImg = grpNode.getAttribute("icon");
		if (srcImg)
		{
			srcImg = app.CatalogPath + PCTpath + "\\" + srcImg;
			if (m_fso.FileExists(srcImg))
				m_fso.CopyFile(srcImg, imgPath, true)
		}
	}
	
	// copia immagini aggiuntive (slots, moduli, ...)
	var imageNodelist = deviceinfo.selectNodes("images/image")
	var imageNode
	while (imageNode = imageNodelist.nextNode())
	{
		var srcImg = imageNode.text;
		if (srcImg)
		{
			srcImg = app.CatalogPath + PCTpath + "\\" + srcImg;
			if (m_fso.FileExists(srcImg))
				m_fso.CopyFile(srcImg, imgPath, true)
		}
	}
	
	// copia sourceFiles
	var sourceNodelist = deviceinfo.selectNodes("sourceFiles/sourceFile");
	var sourceNode;
	while (sourceNode = sourceNodelist.nextNode())
	{
		var src = app.CatalogPath + PCTpath + "\\" + sourceNode.text;
		if (m_fso.FileExists(src))
			m_fso.CopyFile(src, esiPath, true);
	}
}

function RestoreUserTemplate_ESI(deviceinfo, filepath, destFullFilename)
{
	var srcPathPCT = m_fso.GetParentFolderName(filepath) + "\\";
	var destPathImg = m_fso.GetParentFolderName(destFullFilename) + "\\img\\";
	
	CreateFullFolderPath(m_fso.GetParentFolderName(destFullFilename), "ESI");
	var destPathESI = m_fso.GetParentFolderName(destFullFilename) + "\\ESI\\";
	
	// copia icona del device
	var srcImg = deviceinfo.getAttribute("icon");
	if (m_fso.FileExists(srcPathPCT + srcImg))
		m_fso.CopyFile(srcPathPCT + srcImg, destPathImg, true)
	
	// copia icone dei gruppi
	var grpNodelist = deviceinfo.selectNodes("groups/group")
	var grpNode
	while (grpNode = grpNodelist.nextNode())
	{
		var srcImg = srcPathPCT + grpNode.getAttribute("icon");
		if (m_fso.FileExists(srcImg))
			m_fso.CopyFile(srcImg, destPathImg, true)
	}
	
	// copia immagini extra
	var imgNodelist = deviceinfo.selectNodes("images/image")
	var imgNode
	while (imgNode = imgNodelist.nextNode())
	{
		var srcImg = srcPathPCT + imgNode.text;
		if (m_fso.FileExists(srcImg))
			m_fso.CopyFile(srcImg, destPathImg, true)
	}
	
	// copia sourceFiles
	var sourceNodelist = deviceinfo.selectNodes("sourceFiles/sourceFile");
	var sourceNode;
	while (sourceNode = sourceNodelist.nextNode())
	{
		var src = srcPathPCT + "\\" + sourceNode.text;
		if (m_fso.FileExists(src))
			m_fso.CopyFile(src, destPathESI, true);
	}
}

// copia di tutti i PCT utente dalla cartella UserTemplates al catalogo
function RestoreAllUserTemplates(srcPath)
{
	function ProcessDir(dir, dirPrefix)
	{
		// iterazione su tutti i files *.PCT in tutte le sottocartelle di primo livello
		for (var enFiles = new Enumerator(dir.Files); !enFiles.atEnd(); enFiles.moveNext())
		{
			var filepath = enFiles.item().Path
			if (m_fso.GetExtensionName(filepath).toUpperCase() != PCT_EXT)
				continue

			var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0")
			xmldoc.async = false
			if (!xmldoc.load(filepath))
				continue
			
			// lettura info device dal file PCT
			var deviceinfo = xmldoc.selectSingleNode("/devicetemplate/deviceinfo")
			var deviceid = deviceinfo.getAttribute("deviceid")
			var caption = deviceinfo.getAttribute("caption")
			var version = deviceinfo.getAttribute("version")
			
			if (!deviceid || !caption || !version)
				continue
			
			var destFilename = ( USERTEMPLATES_SUBDIR != "" ? USERTEMPLATES_SUBDIR + "\\" : "" ) + (dirPrefix ? dirPrefix : "") + dir.Name + "\\" + enFiles.item().Name
			var destFullFilename = app.CatalogPath + destFilename
			var doCopy = true
			
			var nodelist = app.CallFunction("extfunct.QueryCatalog", "//deviceinfo[@deviceid = '" + deviceid + "']")
			if (nodelist && nodelist.length != 0)
			{
				var currentPath = nodelist[0].getAttribute("template")
				if (currentPath.toUpperCase() != destFilename.toUpperCase())
				{
					// c'è già nel catalogo un oggetto con lo stesso deviceid ma in una posizione diversa :
					// politica attuale è di loggare l'anomalia, ma procedere cmq con l'importazione
					var msg = app.Translate("WARNING: User object '%1 %2' already exists in catalog at %3, should be at %4")
					app.PrintMessage(genfuncs.FormatMsg(msg, caption, version, currentPath, destFilename))
				}
			}
			
			if (m_fso.FileExists(destFullFilename))
			{
				// se il file esiste già, lo confronta
				if (app.CallFunction("commonDLL.BinaryFileCompare", filepath, destFullFilename))
				{
					// file già identico: non fa nulla
					doCopy = false
				}
				else
				{
					// file diverso: chiede conferma per la sovrascrittura (se suppressQuestions = yes)
					var msg = app.Translate("User object '%1 %2' already exists in catalog,\nbut it is different from the one saved in the project.\n\nDo you want to import it into catalog and overwrite the existing one?")
					if (app.CallFunction("logiclab.get_SuppressQuestions") || 
						app.MessageBox(genfuncs.FormatMsg(msg, caption, version), "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNO) == gentypes.MSGBOX.IDNO)
						doCopy = false
				}
			}
			
			if (doCopy)
			{
				try
				{
					m_fso.CopyFile(filepath, destFullFilename, true)
					
					var msg = app.Translate("User object '%1 %2' imported into catalog at %3")
					app.PrintMessage(genfuncs.FormatMsg(msg, caption, version, destFilename))
					updateCatalog = true
					
					// copia icone per i device EtherCAT
					if (genfuncs.ParseBoolean(deviceinfo.getAttribute("importedFromESI")))
						RestoreUserTemplate_ESI(deviceinfo, filepath, destFullFilename);
				}
				catch (ex)
				{
					var msg = app.Translate("ERROR while copying %1 : %2")
					app.PrintMessage(genfuncs.FormatMsg(msg, destFilename, ex.message))
				}
			}
		}
	}
	
	srcPath += "\\" + USERTEMPLATES_DIR + ( USERTEMPLATES_SUBDIR != "" ? "\\" + USERTEMPLATES_SUBDIR : "" )
	if (!m_fso.FolderExists(srcPath))
		return
	
	var updateCatalog = false
	
	var folder = m_fso.GetFolder(srcPath)
	// iterazione su tutte le sottocartelle di primo livello (saranno ModbusCustom o CANcustom o EtherCATcustom)
	for (var enDirs = new Enumerator(folder.SubFolders); !enDirs.atEnd(); enDirs.moveNext())
	{
		var dir = enDirs.item();
		ProcessDir(dir);
	}
	
	if (updateCatalog)
	{
		// ricarica cache del catalogo se modifiche effettuate
		app.CallFunction("extfunct.ResetCatalogCache")
		app.CallFunction("extfunct.ReloadCatalogCache")
	}
}

function GetCurrentTargetPCTPath(relative)
{
	var targetID = app.CallFunction("logiclab.get_TargetID");
	var nodelist = app.CallFunction("extfunct.QueryCatalog", "//deviceinfo[@deviceid = '" + targetID + "']/@template");
	if (nodelist && nodelist.length != 0)
	{
		if (relative)
			var pctPath = nodelist[0].text;
		else
			var pctPath = app.CatalogPath + nodelist[0].text;
		
		return pctPath;
	}
}

function HasTargetChanged()
{
	return m_targetChanged
}

function GetOldTargetID()
{
	return m_oldTargetID
}

function CheckForEmptyProject()
{
	// targetID del progetto attuale, in quanto PREFIX coincide con il nome del nodo xml da aggiungere
	var targetID = app.CallFunction("logiclab.get_TargetID")
	
	// controlla se esiste almeno un device principale nell'xml con attributo @template
	// se sì vuol dire che c'è già un device di primo livello, quindi esce subito
	var nodelist = app.SelectNodesXML("/*[@template]")
	if (nodelist.length != 0)
		return false
		
	// ottiene dal catalogo il nodo xml <deviceinfo> per avere il path del PCT e caricarlo
	var nodelist = app.CallFunction("extfunct.QueryCatalog", "//deviceinfo[@deviceid = '" + targetID + "']")
	if (!nodelist || nodelist.length == 0)
		return false
		
	var pct = nodelist[0].getAttribute("template")
	var caption = nodelist[0].getAttribute("caption")
	
	// creazione automatica nuovo nodo xml di primo livello
	if (app.LoadTemplate(pct, -1))
	{
		// dopo aver caricato il template aggiunge il nodo xml al progetto
		var datapath = app.AddTemplateData(targetID, "/")
		app.DataCreate(datapath + "/@name", 0, caption)
		app.DataCreate(datapath + "/@caption", 0, caption)
		
		// poichè la AddTemplateData ha già inserito l'elemento nell'albero con la caption di default, la reimposta ora
		app.HMISetCaption(TREENAME, app.HMIGetElementPath(TREENAME, datapath), caption)
		
		// per sicurezza rimuove tutti gli aux source: si potrebbe infatti arrivare qui anche dopo un change target con risorse non compatibili!
		app.CallFunction("logiclab.RemoveAuxSource", "*")
		
		app.PrintMessage(app.Translate("Added a new '%1' to project").replace("%1", targetID))
	}
	
	// ritorna true (ovvero era empty)
	return true
}

function OnBeforeLoad(filename)
{
	CheckForTargetChange()
	
	CheckForOldProject()
	
	var prjpath = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath"))
	RestoreAllUserTemplates(prjpath)
}

function CheckForTargetChange()
{
	// targetID del progetto attuale, in quanto PREFIX coincide con il nome del nodo xml
	var targetID = app.CallFunction("logiclab.get_TargetID")
	
	// controlla se esiste un nodo con attributo @template, il cui nome coincide col targetID attuale; se sì, non c'è da fare ChangeTarget
	// altrimenti, deduce che è un vecchio device prima di un ChangeTarget che non è citato esplicitamente come possibile destinazione di cambio nel PCT con la "onloadnode"
	var nodelist = app.SelectNodesXML("/*[@template]")
	if (nodelist.length == 0 || nodelist[0].nodeName == targetID)
		return false
		
	// ottiene dal catalogo il nodo xml <deviceinfo> per avere la caption del nuovo target
	var deviceInfoNodelist = app.CallFunction("extfunct.QueryCatalog", "//deviceinfo[@deviceid = '" + targetID + "']")
	if (!deviceInfoNodelist || deviceInfoNodelist.length == 0)
		return false
	var targetDeviceInfo = deviceInfoNodelist[0]
	var caption = targetDeviceInfo.getAttribute("caption")
	var newResourceClass = targetDeviceInfo.selectSingleNode(TARGETDEF_NODE + "/resources/@class").text
	
	var rootDevice = nodelist[0]
	m_oldTargetID = rootDevice.nodeName
	
	// come sicurezza ulteriore si accerta che il nodo con @template esista anche nel catalogo come device inseribile
	var nodelist = app.CallFunction("extfunct.QueryCatalog", "//deviceinfo[@deviceid = '" + m_oldTargetID + "']")
	if (!nodelist || nodelist.length == 0)
		return false
	var oldResourceClass = nodelist[0].selectSingleNode(TARGETDEF_NODE + "/resources/@class").text
	
	// memorizza il cambio target appena avvenuto, sarà processato da OnLoad
	m_targetChanged = true
	
	// disabilita msg di errori su template non trovati, per dare modo alle onloadnode / UpgradeNode di sistemare le cose
	app.CallFunction("extfunct.SetSuppressTemplateErrorMsg", true);
	
	if (oldResourceClass != newResourceClass)
		// se resource class diversa (ovvero xml non compatibile) esce subito sarà da gestire diversamente (es. onloadnode)
		return false
		
	// rinomina quindi il nodo al targetID corrente; questa cosa funzionerà SOLO fintanto che lo schema sia uguale, ma almeno non si perdono tutti i dati!
	var newnode = app.CallFunction("common.RenameXMLElement", rootDevice, targetID)
	newnode.setAttribute("name", caption)
	newnode.setAttribute("caption", caption)
	
	// NON deve venire fatta ancora ParseNode, visto che siamo in OnBeforeLoad verrà fatta subito dopo
	app.ModifiedFlag = true
	app.PrintMessage(app.Translate("Automatically renamed '%1' to '%2'").replace("%1", m_oldTargetID).replace("%2", targetID))
	
	return true
}

// verifica se si sta aprendo un progetto che aveva i vecchi path prima della creazione delle cartelle per versione di target
function CheckForOldProject()
{
	var nodelist = app.SelectNodesXML("//*[@template]")
	var node
	while (node = nodelist.nextNode())
	{
		var templ = node.getAttribute("template")
		var pos = templ.lastIndexOf(".")
		if (pos == -1)
			continue
		
		// cambio percorsi vecchi progetti dopo cambio struttura cartelle con versione
		if (templ.toUpperCase() == "AXC25\\AXC25_1P0.PCT")
			templ = "AXC25_1p0\\AXC25\\AXC25_1p0.PCT"
		else
			continue
			
		node.setAttribute("template", templ)
		app.PrintMessage("Template path for " + node.nodeName + " changed to " + templ)
	}
}


var m_disableOnSave = false

function ForceDisableOnSave(disable)
	{ m_disableOnSave = disable }

function OnBeforeSave(filename)
{
	if (!m_disableOnSave)
	{
		// invoca generazione dei PLC ausiliari
		// salva il risultato in una globale per utilizzarlo poi nella OnMessage prebuild
		m_lastCompilationResult = app.CallFunction("compiler.Go", COMPILATIONPHASE.ONSAVE)
		
		if (m_lastCompilationResult == enuLogLevels.LEV_OK)
		{
			//	esporto solo in caso di corretto salvataggio, inoltre se non testato questo flag l'esportazione viene fatta due volte in caso di PLC ausiliario
			BackupAllUserTemplates(m_fso.GetParentFolderName(filename))
		}
	}
	
	// procede con salvataggio standard
	return 1
}

// radice del documento xml (/configuration/data)
function GetDocRoot()
{
	return app.SelectNodesXML("/")[0]
}

function OnRefactoringMsg(data)
{
	// riceve una stringa del tipo SID,oldname,newname
	//app.PrintMessage(data)
	var arr = data.split(",");
	if (arr.length != 3)
	{
		app.PrintMessage("REFACTORING: Invalid data parameter: " + data);
		return;
	}
	
	var SID = arr[0];
	var oldName = arr[1];
	var newName = arr[2];
	
	// formato del SID:   <objtypeid>:[<source module>]:<object ID/path>
	var arr = SID.split(":");
	
	var objType = arr[0];
	if (objType != "V")
		return;   // considera solo variabili: ad oggi non ha senso niente altro
	
	var objFullPath = arr[arr.length - 1];
	if (objFullPath.indexOf(".") != -1)
		return;   // considera solo globali: se c'è un '.' si tratta di path di variabile locale

	
	// -------- inizio refactoring
	var msg = genfuncs.FormatMsg(app.Translate("REFACTORING: replacing '%1' with '%2'"), oldName, newName)
	app.PrintMessage(msg)
	
	var totReplaced = 0;
	// cerca tutti i nodi xml del documento con attributo 'RefactorFunc' (tipicamente fixed da XSD)
	var nodelist = genfuncs.SearchNodesWithAttribute(GetDocRoot(), "RefactorFunc", -1);
	for (var i = 0; i < nodelist.length; i++)
	{
		var node = nodelist[i];
		var func = node.getAttribute("RefactorFunc");
		
		// invocazione funzione custom (specifica del target) per refactoring
		totReplaced += app.CallFunction(func, node, objType, oldName, newName);
	}
	
	if (totReplaced != 0)
		app.ModifiedFlag = true;
	
	var msg = genfuncs.FormatMsg(app.Translate("REFACTORING: replaced %1 occurencies"), totReplaced)
	app.PrintMessage(msg)
}


var WM_COMMAND = 0x0111
var IDM_SAVEPRJ = 32789

function OnMessage(id, data)
{
//	app.MessageBox(id)
	
	switch (id)
	{
		case "prebuild":
			// pre-build del progetto logiclab:
			// la compilazione delle risorse è già stata eseguita prima nella OnSave (il comando di compile esegue SEMPRE prima un save di tutto il progetto!)
			// quindi qui esegue solo la verifica dell'esito per eventualmente bloccare la compilazione del PLC
			if (m_lastCompilationResult == enuLogLevels.LEV_CRITICAL)
			{
				// se la compilazione sul 'save' è fallita, dà il focus al tab corretto (per dare focus al tab 'build' se preprocess fallito)
				app.CallFunction("compiler.SelectTabWithError")
				return ERRORLEVEL_CRITICAL
			}
				
			// pre-build del progetto logiclab:
			var result = app.CallFunction("compiler.Go", COMPILATIONPHASE.PREBUILD)
			if (result == enuLogLevels.LEV_CRITICAL)
				return ERRORLEVEL_CRITICAL
			
			if (app.ModifiedFlag)
			{
				m_disableOnSave = true
				// se il prebuild ha modificato il documento del framework (xml) forza un salvataggio del progetto in modo da iniziare la compilazione
				// con lo stato di non modificato (e quindi poi il dischetto spento)
				app.SendWindowsMessage(WM_COMMAND, IDM_SAVEPRJ, 0, true)
				m_disableOnSave = false
			}
				
			return 0
			
		case "postbuild":
			// post-build del progetto logiclab:
			var result = app.CallFunction("compiler.Go", COMPILATIONPHASE.POSTBUILD)
			if (result == enuLogLevels.LEV_CRITICAL)
				return ERRORLEVEL_CRITICAL
			
			return 0
			
		case "predownload":
			// scarica tutti i files di cfg generati
			var result = app.CallFunction("compiler.CustomDownload", COMPILATIONPHASE.PREDOWNLOAD, data)
			if (result == enuLogLevels.LEV_CRITICAL)
				return ERRORLEVEL_CRITICAL
				
			return 0
			
		case "postdownload":
			app.CallFunction("compiler.CustomDownload", COMPILATIONPHASE.POSTDOWNLOAD, data)
			break
		
		case "refactoring":
			OnRefactoringMsg(data);
			break;
			
		case "callfunction":
			// usato per chiamata asincrona con postmessage
			app.CallFunction(data);
			break;
			
/*		// esempio di validazione tempi dei task (da "Tasks configuration")
		case "validateTasks":
			var arr = genfuncs.FromSafeArray(data)
			app.MessageBox(arr.join(","))
			if (arr[0] < 0)
				return ERRORLEVEL_CRITICAL
			break
			*/
	}
}


function CheckVarName(name, simpleNameOnly)
{
	// se checkSimpleName==true non tollera i nomi complessi (ovvero array e strutture)
	if (simpleNameOnly === undefined)
		simpleNameOnly = false
	
	if (app.FunctionExists("logiclab.CheckIdentifierName"))
	{
		// da versione >= 5.23.0.1 usa implementazione nativa che tiene conto anche dell'opzione "allow extended identified names" con stringhe unicode
		return app.CallFunction("logiclab.CheckIdentifierName", name, !simpleNameOnly);
	}
	else
	{
		for (var i = 0; i < name.length; i++)
		{
			var c = name.charAt(i)
			if (! (c >= 'a' && c <= 'z'  ||  
				   c >= 'A' && c <= 'Z'  ||  
				   c >= '0' && c <= '9' && i != 0  ||  
				   c == '_'  ||  
				   (c == '.' || c == '[' || c == ']') && i != 0 && !simpleNameOnly
				) )
			{
				return false
			}
		}
		return true
	}
}






// restituisce un array con l'elenco delle variabili PLC globali non assegnate (ovvero automatiche)
function GetUnassignedPLCVars()
{
	var result = []
	
	var list = app.CallFunction("logiclab.GetProjectVariables")
	for (var i = 0, t = list.length; i < t; i++)
	{
		var v = list.item(i)
		
		// una variabile globale è assegnabile se è automatica (Attribute 0 = ATV_NONE)
		if (!v.IsDataBlock && v.Attribute == 0)
			result.push(v)
	}
	
	return result
}

// restituisce una mappa indicizzata per nome con l'elenco delle variabili PLC mappate (ovvero NON automatiche)
function GetMappedPLCVars()
{
	var result = {}
	
	var list = app.CallFunction("logiclab.GetProjectVariables")
	for (var i = 0, t = list.length; i < t; i++)
	{
		var v = list.item(i)
		
		if (v.IsDataBlock)
			result[v.Name] = v
	}
	
	return result
}

function CanUnassignPLCVar(v, usageCountToCheck)
{
	if (typeof v == "string")
	{
		// passata stringa: è il nome della variabile
		var varName = v
		
		var v = app.CallFunction("logiclab.GetGlobalVariable", varName)
		if (!v)
			return false
	}
	else if (typeof v == "object")
		// altrimenti se passato oggetto, è già la PLCvar
		var varName = v.Name
	
	// le variabili complesse specificate manualmente sono a gestione totalmente manuale
	if (IsComplexVar(varName))
		return false
		
	// assume nome estensione = nome target !
	var extName = app.CallFunction("logiclab.get_TargetID")
	
	// verifica se il datablock della var è uno di quelli gestiti dal framework
	// in caso contrario, è un'assegnazione 'forzata' di una var già mappata, e non deve disassegnare in automatico
	var parsedDB = app.CallFunction("common.ParseDataBlock", v.DataBlock)
	if (!parsedDB)
		return false
	if (!app.CallFunction(extName + ".IsResourceManagedDatablock", parsedDB.area, parsedDB.datablock))
		return false
		
	// chiama funzione specifica di GetPLCVariableUsages del target corrente
	var usages = app.CallFunction(extName + ".GetPLCVariableUsages", varName)
	// se la variabile specificata è usata in più di un contesto non la disassegna ora, sarà fatto all'ultima cancellazione
	if (usages && usages.length > usageCountToCheck)
		return false
	else
		return true
}

function UnassignPLCVar(v)
{
	if (typeof v == "string")
	{
		// passata stringa: è il nome della variabile
		var v = app.CallFunction("logiclab.GetGlobalVariable", v)
		if (!v)
			return false
	}
	// altrimenti se passato oggetto, è già la PLCvar
	
	// riporta la variabile come automatica
	v.DataBlock = ""
	
	// rinfresca la griglia delle global vars se aperta
	app.CallFunction("extfunct.ReloadGlobalVars",  v.Group)
	// rinfresca l'albero delle var globali
	app.CallFunction("extfunct.UpdateWorkspaceGlobalVariables")
	return true
}

function AssignPLCVar(plcVar, dataBlock)
{
	if (typeof plcVar == "string")
	{
		// passata stringa: è il nome della variabile
		var plcVar = app.CallFunction("logiclab.GetGlobalVariable", plcVar)
		if (!plcVar)
			return false
	}
	
	// altrimenti se passato oggetto, è già la PLCvar
	if (dataBlock.substr(0,1) != "%")
	{
		// specificato un datablock come nome di variabile, alloca nel primo spazio disponibile
		if (!plcVar.AllocateOnDataBlock(dataBlock))
		{
			app.MessageBox("Can not assign PLC variable to datablock.\nPlease check that the datablock has enough free space.", "", MSGBOX.MB_ICONEXCLAMATION)
			return false
		}
	}
	else
		// specificato un indirizzo assoluto
		plcVar.DataBlock = dataBlock
	
	// rinfresca la griglia delle global vars se aperta
	app.CallFunction("extfunct.ReloadGlobalVars", plcVar.Group)
	// rinfresca l'albero delle var globali
	app.CallFunction("extfunct.UpdateWorkspaceGlobalVariables")
	return true
}

// disassegna TUTTE le variabili mappate al di sotto del device specificato
//usando la query ed il nome della variabil e specificati
function UnassignAllPLCVarsFromDeviceWithQuery(device, allVarsQuery, varnameQuery )
{
	// elenco di tutte le mappature in profondità
	var nodelist = device.selectNodes(allVarsQuery)
	if (!nodelist || nodelist.length == 0)
		// nulla da fare poichè nessuna var mappata, esce subito
		return true
	
	// se variabili globali già modificate e non salvate non permette l'operazione
	if (!CheckGlobalVarsModified())
		return false
	
	// estrae la mappa di tutte le variabili PLC su datablock
	var mappedVars = GetMappedPLCVars()
	var modified = false
	
	var node
	var groups = [];
	while (node = nodelist.nextNode())
	{
		var label = GetNode(node, varnameQuery)
		
		var v = mappedVars[label]
		if (v)
		{
			// riporta la variabile come automatica
			// verifica se possibile disassegnare la var precedente; testa usagecount > 1 perchè nel xml è ancora presente (sarà cancellata dopo)
			if (app.CallFunction("script.CanUnassignPLCVar", v, 1))
				v.DataBlock = ""
				
			modified = true
			
			groups.push(v.group);
		}
	}
	
	if (modified)
	{
		// rinfresca le griglie delle global vars se aperta
		for(var i = 0; i < groups.length; i++)
			app.CallFunction("extfunct.ReloadGlobalVars", groups[i])
		
		// rinfresca l'albero delle var globali
		app.CallFunction("extfunct.UpdateWorkspaceGlobalVariables")
	}
	return true
}

// disassegna TUTTE le variabili mappate al di sotto del device specificato
// invocata tipicamente come 'ondeletenode'
function UnassignAllPLCVarsFromDevice(device)
{
	return UnassignAllPLCVarsFromDeviceWithQuery(device, ".//*[ioObject and label != '']", "label" );
}

// pulisce TUTTE le variabili mappate al di sotto del device specificato, ma SENZA effettuare il cambio della variabile a automatica!
// invocata tipicamente come 'onpastenode', per evitare un doppio assegnamento della stessa variabile
function ClearAllPLCVarsFromDevice(device)
{
	// elenco di tutte le mappature in profondità
	var nodelist = device.selectNodes(".//*[ioObject and label != '']")
	if (!nodelist || nodelist.length == 0)
		// nulla da fare poichè nessuna var mappata, esce subito
		return true
	
	var node
	while (node = nodelist.nextNode())
	{
		genfuncs.SetNode(node, "label", "")
		genfuncs.SetNode(node, "dataBlock", "")
	}
	
	return true
}

function CheckGlobalVarsModified(group)
{
	// se variabili globali già modificate e non salvate non permette l'operazione
	if (app.CallFunction("extfunct.IsGlobalVarsModified", group))
	{
		var msg;		
		if(group)
			msg = app.Translate("Global variables group %1 is modified.\nPlease save before continuing.").replace("%1", group)
		else
			msg	= app.Translate("Global variables have been is modified but not saved.\nPlease save before continuing.")
			
		app.MessageBox(msg, "", MSGBOX.MB_ICONEXCLAMATION)
		return false
	}
	// ulteriore controllo se la dichiarazione testuale IEC è valida
	else if (!app.CallFunction("extfunct.IsGlobalVarsIECDeclarationValid", group))
	{
		var msg;		
		if(group)
			msg = app.Translate("Global variables group %1 has an invalid IEC declaration.\nPlease fix it before continuing.").replace("%1", group)
		else
			msg = app.Translate("Global variables have an invalid IEC declaration.\nPlease fix it before continuing.")
			
		app.MessageBox(msg, "", MSGBOX.MB_ICONEXCLAMATION)
		return false
	}	
	else
		return true
}


// verifica se un valore è ancora valido dopo un cambiamento di tipo
function CheckValueWithNewType(value, oldType, newType)
{
	if (oldType == "STRING" || newType == "STRING")
		return false
		
	var limits = app.CallFunction("common.GetIECTypeLimits", newType)
	if (!limits)
		return true
		
	return (value >= limits.min && value <= limits.max)
}

function GetBuildDir()
{
	var prjDir = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath")) + "\\";
	if (m_fso.FolderExists(prjDir + "Build"))
		return prjDir + "Build\\";  // le nuove versioni di LogicLab hanno la sottocartella "build" con tutti gli output di compilazione
	else
		return prjDir;  // vecchie versioni salvano tutto nella cartella di progetto
}

function GetSymbolTableFilename()
{
	
	var extName = app.CallFunction("logiclab.get_TargetID")
	var funName = extName + ".GetSymbolTableFilename"
	if (app.FunctionExists(funName))
		return app.CallFunction(funName)
	
	var prjpath = app.CallFunction("logiclab.get_ProjectPath");
	var symtab = GetBuildDir() + m_fso.GetBaseName(prjpath);
	symtab += app.CallFunction("logiclab.get_SimulMode") ? ".syt.simul" : ".syt.xml"
	return symtab;
}


// avvio SoftScope: da customizzare queste costanti in caso di modifica al nome
var SOFTSCOPE_NAME = "SoftScope";
var SOFTSCOPE_EXE = "..\\SoftScope\\SoftScope.exe";
var SOFTSCOPE_USE_GENERICTARGET = true;

function OpenSoftScope()
{
	var sscIntf
	try
	{
		// tenta di ottenere il riferimento all'istanza attuale; se il softscope non è attivo solleva eccezione
		sscIntf = GetObject("", "SoftScope.AlCOMInterface")
	}
	catch (ex)
	{ }
	
	if (sscIntf)
	{
		var ris = app.MessageBox(SOFTSCOPE_NAME + " is already running.\n\nDo you want to open a new instance?", "", MSGBOX.MB_ICONQUESTION|MSGBOX.MB_YESNO)
		if (ris == MSGBOX.IDNO)
		{
			sscIntf.SetFocus()
			return
		}
	}
	
	// avvio nuova istanza con target e commstring già selezionati
	var cmd = '"' + app.CatalogPath + SOFTSCOPE_EXE + '"';

	// lettura nome target SoftScope da usare indicato nel PCT del target LogicLab come attributo
	var sscTarget;
	var nodelist = app.SelectNodesXML("/*[@IsRootDevice]")
	if (nodelist.length != 0)
		sscTarget = nodelist[0].getAttribute("SoftScopeTarget");
	
	if (!sscTarget)
	{
		if (SOFTSCOPE_USE_GENERICTARGET)
			// SOLO SUITE AXEL: invece di specificare il target corrente, usa quello generico, visto che tanto tutti i target (di simulazione o meno) sono LLExec!
			sscTarget = "SoftScopeGeneric_1p0";
		else
			// target SoftScope nel catalogo con lo stesso nome del target LogicLab
			sscTarget = app.CallFunction("logiclab.get_TargetID");
	}
	
	cmd += " /newacq:" + sscTarget;
	
	cmd += " /commstring:" + app.CallFunction("logiclab.get_CommString")
	cmd += ' "/symtab:' + GetSymbolTableFilename() + '"'
	
	if (app.CallFunction("logiclab.get_Connected"))
		cmd += " /connect"

	try
	{
		m_shell.Run(cmd)
	}
	catch (ex)
	{
		app.MessageBox("Error executing " + SOFTSCOPE_NAME + "\n" + ex.description, "", MSGBOX.MB_ICONERROR)
	}
}

// determina se un nome di variabile è complesso (ovvero struttura e/o array)
function IsComplexVar(name)
{
	return name.indexOf(".") != -1 || name.indexOf("[") != -1
}

// ritorna la 'base' di una var complessa, ovvero il nome prima del separatore . o [ (quello che viene prima)
function GetComplexVarBaseName(name)
{
	var pos1 = name.indexOf(".")
	var pos2 = name.indexOf("[")
	if (pos1 == -1 && pos2 == -1)
		return name   // var non complessa!
	
	if (pos1 == -1)
		pos1 = 9999
	if (pos2 == -1)
		pos2 = 9999
	
	if (pos1 < pos2)
		return name.substr(0, pos1)
	else if (pos2 < pos1)
		return name.substr(0, pos2)
}

function DeletePLCApp()
{
	// ottiene l'interfaccia IDeviceLink attiva da logiclab
	var devlink = app.CallFunction("logiclab.GetDeviceLink")
	if (!devlink)
	{
		app.MessageBox(app.Translate("You must be connected to the target to perform this operation"), "", MSGBOX.MB_ICONEXCLAMATION)
		return false
	}
	
	// il path è in realtà dipendente dal target...
	app.CallFunction("GDBFileTransfer.GDBDeleteFile", devlink, "/data/plc/PlcCode0.bin")
	
	// rilascia reference al devicelink e unlock della comunicazione (logiclab fa lock nella GetDeviceLink()!)
	devlink = undefined
	CollectGarbage()  // chiama subito il gc per forzare la release del devicelink
	app.CallFunction("logiclab.UnlockComm")

	// TODO: attualmente con LLExec è richiesto il riavvio del processo (quindi della scheda), non basta il "fulmine"
	app.MessageBox(app.Translate("PLC application has been deleted from target.\nPlease reboot it if necessary"), "", MSGBOX.MB_ICONINFORMATION)
}


var RefactoringResult = {
	ABORTED: 0,
	NO_OCCURRENCES_FOUND: 1,
	SUCCESS: 2,
	PRJNOTSAVED: 3,
	INVALIDOBJECT: 4
}

function RefactorGlobalVariable(varName)
{
	var plcvar = app.CallFunction("logiclab.GetGlobalVariable", varName)
	if (plcvar)
	{
		// passa nome variabile vuoto per chiederlo all'utente
		var result = app.CallFunction("logiclab.Refactor", plcvar, "")
		
		if (result == RefactoringResult.PRJNOTSAVED)
			app.MessageBox(app.Translate("Project must be saved before executing refactoring"), "", gentypes.MSGBOX.MB_ICONEXCLAMATION)
		else if (result == RefactoringResult.NO_OCCURRENCES_FOUND)
			app.MessageBox(app.Translate("No occurrencies found"), "", gentypes.MSGBOX.MB_ICONINFORMATION)
		
		return result == RefactoringResult.SUCCESS
	}
	else
	{
		var msg = genfuncs.FormatMsg(app.Translate("PLC variable '%1' not found!"), varName)
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONERROR)
		return false
	}
}

// esecuzione comando di refactoring (tipicamente da menu di popup) con passaggio nome var con tempvar
function DoRefactoring()
{
	// la tempvar con il nome della var di cui fare refactoring deve essere stato settato dal chiamante prima di aprire il popup menu
	var varName = app.TempVar("Refactoring_varName")
	if (!varName)
		return
	
	RefactorGlobalVariable(varName)
}

// esecuzione comando di refactoring da elemento dell'albero
function DoRefactoringFromTree()
{
	var treepath = app.HMIGetCurElementPath(TREENAME)
	var varName = app.HMIGetCaption(TREENAME, treepath)
	
	if (RefactorGlobalVariable(varName))
	{
		// se refactor andato a buon fine recupera la proprietà caption (che sarà già stata cambiata da RefactorFunc del target)
		var newName = app.DataGet(app.HMIGetElementData(TREENAME, treepath) + "/@caption", 0)
		app.HMISetCaption(TREENAME, treepath, newName)
	}
}

// se opzione 'use last port' attiva, ritorna l'ultima COM usata
function GetLastUsedCOM()
{
	var uselast = genfuncs.ParseBoolean(app.ReadINIString("Settings", "UseLastPort"));
	if (uselast)
	{
		var port = app.ReadINIString("Modbus", "LastPort", "", m_shell.ExpandEnvironmentStrings("%APPDATA%") + "\\DeviceLink.ini");
		if (port)
			return parseInt(port);
	}
}

function ShowLLScanInternal()
{
	app.OpenWindow("LLScanInternal", app.Translate("Network scan"), "");
}