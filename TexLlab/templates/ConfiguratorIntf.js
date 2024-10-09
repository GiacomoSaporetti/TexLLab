//estensione del file custom per cliente
var CONFIGURATOR_NAME = "SoftTune"
var CONFIGURATOR_EXT = "SFT"
var CONFIGURATOR_EXE = "..\\SoftTune\\SoftTune.exe"
var CONFIGURATOR_PROGID = "SoftTune"

var CHECKCFN_ABORT = 0
var CHECKCFN_OK = 1
var CHECKCFN_OK_REOPEN = 2


var gentypes = app.CallFunction("common.GetGeneralTypes")
var MSGBOX = gentypes.MSGBOX
var enuLogLevels = gentypes.enuLogLevels

var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var GetNode = genfuncs.GetNode

var m_fso = new ActiveXObject("Scripting.FileSystemObject")

	//nodi xml del pct base
var m_deviceTemplateXMLMap = {}
var m_deviceTemplateDataMap = {}



function SetConfiguratorName(name, ext, exe, progid)
{
	if (name)
		CONFIGURATOR_NAME = name
	if (ext)
		CONFIGURATOR_EXT = ext
	if (exe)
		CONFIGURATOR_EXE = exe
	if (progid)
		CONFIGURATOR_PROGID = progid
}


// verifica se il configuratore è aperto con il documento CFN specificato
// se aperto e modificato chiede conferma per salvarlo, per permetterne la modifica
function CheckIfCFNOpen(cfnPath)
{
	var doAutoSave = false
	
	while (1)
	{
		var configuratorIntf
		try
		{
			// tenta di ottenere il riferimento all'istanza attuale; se il configuratore non è attivo solleva eccezione
			configuratorIntf = GetObject("", CONFIGURATOR_PROGID + ".AlCOMInterface")
		}
		catch (ex)
		{
			// se il configuratore non in esecuzione procede
			return CHECKCFN_OK
		}
		
		if (!configuratorIntf)
			return CHECKCFN_OK

		var result = undefined
		
		// verifica se il path del documento attuale corrisponde
		var docpath = configuratorIntf.GetDocumentPath().toLowerCase()
		if (docpath == cfnPath.toLowerCase())
		{
			// ok nel configuratore c'è aperto il CFN attuale
			if (!configuratorIntf.ModifiedFlag)
			{
				// CFN non modificato nel configuratore, lo riaprirà e procede in automatico
				result = CHECKCFN_OK_REOPEN
			}
			else if (doAutoSave)
			{
				// CFN modificato, lo salva in automatico e lo riaprirà con il confguratore
				configuratorIntf.SaveDocumentFile(cfnPath)
				
				if (!configuratorIntf.ModifiedFlag)
					// ok salvataggio andato a buon fine
					result = CHECKCFN_OK_REOPEN
				else
					// salvataggio fallito, annulla creazione CFN
					result = CHECKCFN_ABORT
			}
			else
			{
				// CFN modificato dal configuratore: chiede se salvarlo in automatico
				var msg = " is already open and modified in " + CONFIGURATOR_NAME + "!\n\n" +
						"If you continue and the " + CONFIGURATOR_EXT +" is still open, it will be automatically saved and closed"
				var msgris = app.MessageBox(cfnPath + app.Translate(msg), "", MSGBOX.MB_ICONEXCLAMATION|MSGBOX.MB_RETRYCANCEL)
				
				if (msgris == MSGBOX.IDCANCEL)
					// annulla la creazione del CFN, procederà cmq con la compilazione
					result = CHECKCFN_ABORT
				else if (msgris == MSGBOX.IDRETRY)
					// alza il flag di autosave e riesegue un altro ciclo, il salvataggio e chiusura effettivi saranno fatti dopo una ulteriore verifica
					// questo per gestire il caso in cui l'utente chiude il configuratore e però fa "continue" invece di "retry"
					doAutoSave = true
			}
		}
		else
			// altro documento (o nessun documento) aperto nel configuratore
			result = CHECKCFN_OK

		configuratorIntf = undefined
		CollectGarbage()  // per liberare subito la reference al configuratore
		
		if (result != undefined)
			return result
	}
}

// lancia il configuratore per aprire il CFN specificato, o se già aperto apre il documento nell'istanza attuale
function OpenConfigurator(cfnPath)
{
	// path del CFN che risiede insieme all'applicazione
	var cfnPath = app.CallFunction("logiclab.get_ProjectPath")
	cfnPath = cfnPath.substr(0, cfnPath.lastIndexOf(".")) + "." + CONFIGURATOR_EXT
	
	if (!m_fso.FileExists(cfnPath))
	{
		app.MessageBox(app.Translate("Please build the project first!"), "", MSGBOX.MB_ICONEXCLAMATION)
		return
	}

	if (!m_fso.FileExists(cfnPath))
		return
	
	// tenta di agganciarsi ad istanza attuale del configuratore
	var configuratorIntf
	try
	{
		// tenta di ottenere il riferimento all'istanza attuale; se il configuratore non è attivo solleva eccezione
		configuratorIntf = GetObject("", CONFIGURATOR_PROGID + ".AlCOMInterface")
	}
	catch (ex)
	{ }
	
	if (configuratorIntf)
	{
		var givefocus = false
		if (!configuratorIntf.GetDocumentPath())
		{
			// nessun documento aperto, apre il CFN e dà il fuoco
			configuratorIntf.OpenDocumentFile(cfnPath)
			givefocus = true
		}
			
		if (givefocus || configuratorIntf.GetDocumentPath().toLowerCase() == cfnPath.toLowerCase())
		{
			// ok il configuratore già aperto con questo progetto attivo, ridà focus con il flag di force (per evitare lampeggio in taskbar)
			configuratorIntf.SetFocus(true)
			configuratorIntf = undefined
			CollectGarbage()
			return
		}
	}
	

	// esecuzione nuova istanza di configuratore
/*	if (app.TempVar("_DEBUG"))
		var exePath = "L:\\win.net\\" + CONFIGURATOR_NAME + "\\testprogram\\" + CONFIGURATOR_NAME + ".exe"
	else*/
		var exePath = app.GetApplicationPath() + CONFIGURATOR_EXE

	if (!m_fso.FileExists(exePath))
	{
		app.MessageBox(app.Translate("ERROR: can not find ") + exePath, "", MSGBOX.MB_ICONERROR)
		return
	}
	
	// lancia il configuratore quotando sia l'eseguibile che l'argomento
	var shell = new ActiveXObject("WScript.Shell")
	shell.Run('"' + exePath + '" /nosplash "' + cfnPath + '"')
}

function OnUpdateOpenConfigurator()
{
	// disabilita apertura configuratore se in modo simulazione
	return app.CallFunction("logiclab.get_SimulMode") ? 0 : 1
}


// riapertura "silenziosa" di un documento CFN in seguito a una modifica
function ReOpenCFNSilent(cfnPath)
{
	try
	{
		// tenta di ottenere il riferimento all'istanza attuale; se il configuratore non è attivo solleva eccezione
		var configuratorIntf = GetObject("", CONFIGURATOR_PROGID + ".AlCOMInterface")
		
		// verifica se la finestra del configuratore è iconizzata, in questo caso la ripristina subito
		// l'apertura del file altrimenti fallirebbe se iconizzato
		var isIconic = app.CallFunction("extfunct.IsWindowIconic", configuratorIntf.MainWindowHWND)
		if (isIconic)
			app.CallFunction("extfunct.ShowWindowCmd", configuratorIntf.MainWindowHWND, 9)  // SW_RESTORE=9
			
		configuratorIntf.OpenDocumentFile(cfnPath)
		
		if (isIconic)
			// se il configuratore era iconizzato (e quindi è stato ripristinato prima) riattiva la finestra principale del LogicLab (senza flag force)
			app.SetFocus()
	}
	catch (ex)
	{ }
}


// memorizza il <templatedata> al caricamento di un PCT
function LoadTemplateData(filename, xml)
{

	// estrae deviceid
	var deviceidNode = xml.selectSingleNode("/devicetemplate/deviceinfo/@deviceid")
	if (!deviceidNode) return
	var deviceid = deviceidNode.text
	
	// dato il deviceid estrae il nodo <templateData>
	var templateData = xml.selectSingleNode("/devicetemplate/deviceconfig/templatedata/" + deviceid)
	if (!templateData) return
	
	var versionNode = xml.selectSingleNode("/devicetemplate/deviceconfig/datadef/@version")
	if (!versionNode) return
	var nameNode = xml.selectSingleNode("/devicetemplate/deviceinfo/@name")
	if (!nameNode) return

	// aggiunge gli attributi per il configuratore e memorizza il templateData in mappa, da utilizzare per la generazione del CFN collegato
	templateData.setAttribute("template", filename)
	templateData.setAttribute("version", versionNode.text)
	templateData.setAttribute("name", nameNode.text)
	m_deviceTemplateDataMap[deviceid] = templateData
	return templateData
}

// memorizzazione sezioni deviceconfig per configuratore
function OnLoadTemplate(filename, xml)
{
	var node = xml.selectSingleNode("/devicetemplate/deviceinfo/@deviceid")
	if (!node) return
	
	// memorizza in una variabile globale la sezione deviceconfig del PCT
	var deviceid = node.text
	m_deviceTemplateXMLMap[deviceid] = xml.selectSingleNode("/devicetemplate/deviceconfig")
	
	LoadTemplateData(filename, xml)
}


function GetDeviceTemplateXML(deviceid)
{
	return m_deviceTemplateXMLMap[deviceid]
}
function GetDeviceTemplateData(deviceid)
{
	return m_deviceTemplateDataMap[deviceid]
}

// generazione file CFN per tutti i device root del progetto
function BuildCFN()
{
	// path del CFN associato, risiede nella stessa cartella del .CON
	var CFNpath = app.CallFunction("common.ChangeFileExt", app.GetDocumentPath(), CONFIGURATOR_EXT )
	var templ = app.CatalogPath + m_fso.GetParentFolderName(CONFIGURATOR_EXE) + "\\templates\\emptyData.templ"
	
	// caricamento del template vuoto per il CFN
	var xmlDocCFN = new ActiveXObject("MSXML2.DOMDocument.6.0")
	xmlDocCFN.async = false
	if (!xmlDocCFN.load(templ))
	{
		// impossibile caricare il template per OPDExplorer: va avanti cmq a compilare
		app.PrintMessage(genfuncs.FormatMsg(app.Translate("WARNING: %1 not installed, its %2 file will not be generated"), CONFIGURATOR_NAME, CONFIGURATOR_EXT))
		return true
	}
	
	var oldDocCFN
	var checkCFNResult 
	if (m_fso.FileExists(CFNpath))
	{
		// verifica se possibile sovrascrivere il CFN (non aperto nel configuratore)
		checkCFNResult = CheckIfCFNOpen(CFNpath)
		if (checkCFNResult == CHECKCFN_ABORT)
		{
			// annulla generazione CFN, procede cmq con la compilazione
			app.PrintMessage(app.Translate("WARNING: " + CONFIGURATOR_EXT  + "generation aborted"))
			return true
		}
		
		// carica vecchio CFN
		oldDocCFN = new ActiveXObject("MSXML2.DOMDocument.6.0")
		oldDocCFN.async = false
		if (!oldDocCFN.load(CFNpath))
		{
			app.PrintMessage(app.Translate("ERROR: can not load ") + CFNpath)
			return false 
		}
	}
	
	
	var CFNRootNode = xmlDocCFN.selectSingleNode("/configuration/data")
	var nextIDNode = xmlDocCFN.selectSingleNode("/configuration/data/project_config/@nextID")
	
	// itera su tutti i device principali
	var modified = false
	var srcNodeList = app.SelectNodesXML("/*[@IsRootDevice]")
	var srcNode
	while (srcNode = srcNodeList.nextNode())
	{
		// ID del nodo precedente associato nel CFN
		var oldUniqueID = srcNode.getAttribute("CFNuniqueID")
			
		// recupera il templateData dall'xml originale del PCT
		var templNode = GetDeviceTemplateData(srcNode.nodeName)
		if (!templNode) continue
		
		// aggiornamento device corrispondente nel CFN
		var deviceNode = CFNRootNode.appendChild(templNode.cloneNode(true))
		deviceNode.setAttribute("caption", srcNode.getAttribute("caption"))
		deviceNode.setAttribute("uniqueID", nextIDNode.text)
		// aggiorna legame con il device corrispondente
		if (oldUniqueID != nextIDNode.text)
		{
			srcNode.setAttribute("CFNuniqueID", nextIDNode.text)
			modified = true
		}
		nextIDNode.text++

		if (oldDocCFN && oldUniqueID != null)
		{
			// tenta di recuperare dal CFN precedente i valori dei parametri
			var oldDeviceNode = oldDocCFN.selectSingleNode("//*[@uniqueID = " + oldUniqueID + "]")
			if (oldDeviceNode)
			{
				var oldCommstring = oldDeviceNode.selectSingleNode("config/commstring")
				if (oldCommstring)
					deviceNode.selectSingleNode("config/commstring").text = oldCommstring.text
				
				var newValuesNode = deviceNode.selectSingleNode("config/values")
				
				// sposta tutti i nodi <value> dal vecchio al nuovo documento xml del CFN
				var oldValues = oldDeviceNode.selectNodes("config/values/*")
				var oldValue
				while (oldValue = oldValues.nextNode())
					newValuesNode.appendChild(oldValue)
			}
		}

		// aggiornamento dei settaggi tramite funzione adhoc
		var func = srcNode.getAttribute("CFNUpdateFunc")
		if (func)
			if (!app.CallFunction(func, xmlDocCFN, srcNode, deviceNode))
				return false
	}
	
	// se sono stati settati gli attributi CFNuniqueID, quindi il documento è stato modificato
	if (modified)
		app.ModifiedFlag = true
	
	// salvataggio CFN su disco
	try
	{
		xmlDocCFN.save(CFNpath)
		app.PrintMessage(app.Translate( CONFIGURATOR_EXT + " correctly saved as ") + CFNpath )
	}
	catch (ex)
	{
		app.PrintMessage(app.Translate("ERROR saving " + CONFIGURATOR_EXT + " as ") + CFNpath)
		return false
	}
	
	// riapertura del CFN se prima era aperto
	if (checkCFNResult == CHECKCFN_OK_REOPEN)
		ReOpenCFNSilent(CFNpath)
		
	return true
}

function ExportAppToCatalog()
{
	var rootdevice = app.SelectNodesXML("/*[@IsRootDevice]")[0]
	app.CallFunction(rootdevice.getAttribute("ExtensionName") + ".ExportAppToCatalog", rootdevice)
}
