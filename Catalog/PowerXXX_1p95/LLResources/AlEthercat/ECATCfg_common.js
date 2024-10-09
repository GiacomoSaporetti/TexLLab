var m_fso = new ActiveXObject("Scripting.FileSystemObject")

var gentypes = app.CallFunction("common.GetGeneralTypes")
var enuLogLevels = gentypes.enuLogLevels
var genfuncs = app.CallFunction("common.GetGeneralFunctions")


var TREENAME = "tree1"

	// id icone di overlay per l'albero (vedi LogicLab.pct!)
var TREE_OVERLAY_NONE = 0
var TREE_OVERLAY_DISABLED = 1

var TAB_RESOURCES = 3;    // id del tab resources in LogicLab

var enuCatalogModes = app.CallFunction("CatalogFuncs.GetCatalogModes");

var ECAT_CATALOG_MODE = enuCatalogModes.CAT_DLG_QUERYMODE | /*enuCatalogModes.CAT_DLG_ALLVERSIONS |*/ enuCatalogModes.CAT_DLG_TREEVIEW | enuCatalogModes.CAT_DLG_SMALLICONS | 
						enuCatalogModes.CAT_TRANSPCOLOR_MAGENTA | enuCatalogModes.CAT_TREE_HASLINES | enuCatalogModes.CAT_TREE_LINESATROOT;


var m_ECATFactory;
var m_ECATPrj;

// mappa datapath->oggetto : il datapath (chiave) è generato come ECAT_DATAPATH_PREFIX+n , il valore è l'oggetto di ECATCfg associato
// necessario poichè il campo "data" degli elementi dell'albero è una stringa, quindi non è possibile associare un oggetto
// usa quindi un data fittizio progressivo e questa mappa intermedia
var m_datapath2ECATObjectMap = {};

var ECAT_DATAPATH_PREFIX = "ECATObj_";
var m_ECATObjectsCnt = 0;

var m_ECATObjCutCmd = false;  // true=cut, false=copy
var m_ECATObjCopySource;


// callback che devono essere configurati da chi include questo file
var m_AttachECATCtrlHandlers_func;
// per default il tab "Tasks" della configurazione del master non è visibile (è gestito dall'applicazione 'host')
var m_ECATMaster_GUI_ShowTasks = false;
// per default il tab "Raw commands" della configurazione del master è visibile
var m_ECATMaster_GUI_ShowRawCmd = true;
// per default tutte le modalità online attive
var m_ECATMaster_GUI_OnlineModeEnableFlags = -1;

// indice dello slave (nella lista principale del master) da non inserire nell'albero (per FastCAT)
var m_slaveIdxToSkipInTree;
function SetSlaveIdxToSkipInTree(idx)
	{ m_slaveIdxToSkipInTree = idx; }

// callback invocata alla creazione di nuovo progetto
var m_onCreateNewPrj_func;
function SetOnCreateNewPrjFunc(func)
	{ m_onCreateNewPrj_func = func; }


function CreateNewDatapath()
{
	var newDatapath = ECAT_DATAPATH_PREFIX + m_ECATObjectsCnt;
	m_ECATObjectsCnt++;
	return newDatapath;
}



// conversione da tipi specificati nel ESI in tipi IEC usati da LogicLab per la mappatura PLC vars
var m_EtherCAT2IECTypes = {
	BOOL:		"BOOL",
	BIT:		"BOOL",
	
	SINT:		"SINT",
	INT:		"INT",
	DINT:		"DINT",
	LINT:		"LINT",
	
	USINT:		"USINT",
	UINT:		"UINT",
	UDINT:		"UDINT",
	ULINT:		"ULINT",
	
	REAL:		"REAL",
	LREAL:		"LREAL",
	
	BYTE:		"BYTE",
	WORD:		"WORD",
	DWORD:		"DWORD",
	
	BITARR8:	"BYTE",
	BITARR16:	"WORD",
	BITARR32:	"DWORD",
	
	BIT1:		"BYTE",
	BIT2:		"BYTE",
	BIT3:		"BYTE",
	BIT4:		"BYTE",
	BIT5:		"BYTE",
	BIT6:		"BYTE",
	BIT7:		"BYTE",
	BIT8:		"BYTE",
	
	INT24:		"DINT",
	//INT40:		"LINT",
	//INT48:		"LINT",
	//INT56:		"LINT",
	
	UINT24:		"UDINT"
	//UINT40:		"ULINT",
	//UINT48:		"ULINT",
	//UINT56:		"ULINT",
}

var ECATPDODirection =
{
	Tx: 0,
	Rx: 1
};

var ECATErrorCode =
{
	OK: 0,
	DuplicateSlaveName: 1,
	DuplicateSlavePhysAddr: 2,
	InvalidPLCVariable: 3
};

var ECATOnlineMode =
{
	ecatOnlineLocal: 0,
	ecatOnlineGateway: 1,
	ecatOnlineRemote: 2
};

var ECATONLINE_GATEWAY_PORT = 5500;

function GetECATPrj()
{
	return m_ECATPrj;
}

function GetPLCTypeFromECATType(ecatType, BitSize)
{
	if (!ecatType)
		return;
	
	//Gestione caso datatype non standard BITARR
	// ereditato da GF_Net. Serve veramente?
	if (ecatType == "BITARR")
	{
		if (BitSize == "8")
			ecatType = "BITARR8"
		else if (BitSize == "16")
			ecatType = "BITARR16"
		else if (BitSize == "32")
			ecatType = "BITARR32"
	}
	
	if (ecatType.substr(0,6) == "ARRAY ")
	{
		var pos = ecatType.indexOf(" OF ");
		if (pos == -1)
			return null;  // tipo array non corretto?
		
		// ritorna il tipo base
		ecatType = ecatType.substr(pos + 4);
	}

	return m_EtherCAT2IECTypes[ecatType];
}

function GetArraySizeFromECATType(ecatType)
{
	if (!ecatType)
		return;
	
	// sono gestiti solo gli array 0..n ! non ci devono essere spazi strani in mezzo (si potrebbe altrimenti usare una regexp)
	var prefix = "ARRAY [0..";
	if (ecatType.substr(0,prefix.length) == prefix)
	{
		var pos = ecatType.indexOf("]");
		if (pos == -1)
			return null;  // tipo array non corretto?
		
		var ubound = parseInt(ecatType.slice(prefix.length, pos));
		return ubound + 1;
	}
}

// costruisce un oggetto ECATError da un PDOEntry in errore (sulla mappatura di var PLC)
function GetECATErrorFromPDOEntry(entry)
{
	var pdo = entry.ParentPDO;
	var slave = pdo.Parent;
	
	if (pdo.Direction == ECATPDODirection.Tx)
		var ctrlName = "gridMapping_in";
	else if (pdo.Direction == ECATPDODirection.Rx)
		var ctrlName = "gridMapping_out";
	
	var ecatErr = m_ECATFactory.CreateECATError(ECATErrorCode.InvalidPLCVariable, slave, undefined, undefined, undefined, ctrlName, entry);
	return ecatErr;
}

// costruisce un oggetto da passare alla common.AddLog per il posizionamento successivo tramite doppio click su output, come fa la common.SplitFieldPath classica
function GetLogErrFromECATError(ecatErr)
{
	var result = {};
	result.page = "ECATCtrl";
	result.treePath = FindTreepathFromECATObj(ecatErr.Obj);
	result.dataPath = ecatErr;
	
	if (IsECATSlave(ecatErr.Obj) && m_AttachECATCtrlHandlers_func)
		result.callback = function(){ m_AttachECATCtrlHandlers_func(); };
	
	// fullPath, row e column che vengono passate come TempVar non sono usate
	return result;
}

function GetLogErrFromECATMaster(master)
{
	var result = {};
	result.page = "ECATCtrl";
	result.treePath = FindTreepathFromECATObj(master);
	result.dataPath = master;
	// fullPath, row e column che vengono passate come TempVar non sono usate
	return result;
}

function GetLogErrFromPDOEntry(entry)
{
	var ecatErr = GetECATErrorFromPDOEntry(entry);
	return GetLogErrFromECATError(ecatErr);
}

// compara due indirizzi datablock, a meno dell'indicatore di dimensione, che è "cosmetico" e non indicativo dell'indirizzo stesso
function ECATCompareDatablocks(db1, db2)
{
	if (db1.slice(0,-1) == "*")
		// se datablock unspecified fa comparazione esatta di stringhe
		return db1 == db2;
	else
		// omette il 3o carattere: %MD101.28 == %MX101.28
		return db1.substr(0,2) == db2.substr(0,2) && db1.substr(3) == db2.substr(3);
}

function CreateEmptyFile(filename)
{
	// in alcuni casi potrebbe non esserci la cartella (build)
	var path = m_fso.GetParentFolderName(filename);
	if(!m_fso.FolderExists(path))
		m_fso.CreateFolder(path);
	
	var f = m_fso.CreateTextFile(filename, true)
	f.Close()
}

// ricerca sequenziale inversa value->key
function FindDatapathFromECATObj(obj)
{
	for (var datapath in m_datapath2ECATObjectMap)
		if (m_datapath2ECATObjectMap[datapath] == obj)
			return datapath;
		
	return null;
}

function FindTreepathFromECATObj(obj)
{
	var datapath = FindDatapathFromECATObj(obj);
	if (!datapath)
		return null;
	
	return app.HMIGetElementPath(TREENAME, datapath);
}

// ricerca obj da datapath tramite mappa
function FindECATObjFromDatapath(datapath)
{
	return m_datapath2ECATObjectMap[datapath];
}

// ricerca obj da treepath. specificare "" per l'elemento selezionato nell'albero!
function FindECATObjFromTreepath(treepath)
{
	var datapath = app.HMIGetElementData(TREENAME, treepath);
	return FindECATObjFromDatapath(datapath);
}

// cancella la chiave specificata, e ricorsivamente anche quelle di tutti i figli se presenti
function DeleteECATObjFromMap(datapath)
{
	var obj = FindECATObjFromDatapath(datapath);
	
	delete m_datapath2ECATObjectMap[datapath];
	
	if (IsECATSlave(obj))
	{
		for (var i = 0; i < obj.SubNetworksCount; i++)
		{
			var subnet = obj.GetSubNetwork(i);
			var datapath = FindDatapathFromECATObj(subnet);
			DeleteECATObjFromMap(datapath);
		}
	}
	else if (IsECATSlaveList(obj) || IsECATHotConnectGroup(obj))
	{
		for (var i = 0; i < obj.Count; i++)
		{
			var slave = obj.item(i);
			var datapath = FindDatapathFromECATObj(slave);
			DeleteECATObjFromMap(datapath);
		}
	}
}

function CreateNewECATFactory()
{
	try
	{
		m_ECATFactory = new ActiveXObject("ECATCfg.ECATFactory");
	}
	catch (ex)
	{
		app.MessageBox("ERROR loading EtherCAT configurator!\n\nMake sure .NET framework 4.7.2 is installed, and ECATCfg DLLs are registered", "", gentypes.MSGBOX.MB_ICONERROR);
		return false;
	}
	
	m_ECATFactory.CatalogPath = app.CatalogPath;
	m_ECATFactory.CatalogMng = app.GetExtensionDispatch("catalog");
	// abilita logging tramite framework nell'output window
	m_ECATFactory.SetDispatchLogger(app);
	return true;
}

function DeleteECATFactory()
{
	for (var m = 0; m < m_ECATPrj.MastersCount; m++)
	{
		var master = m_ECATPrj.GetMaster(m);
		master.OnlineDisconnect();
	}
	
	m_datapath2ECATObjectMap = {};
	m_ECATPrj = null;

	// per liberare reference all'interfaccia del framework all'uscita
	m_ECATFactory.RemoveLogger();
	m_ECATFactory = null;
}

function AttachECATPrjHandlers(prj)
{
	// aggiunge handler per property changed del progetto: quando ModifiedFlag interno va a true, manda il messaggio con PostMessage
	var WMU_SETMODIFIED = 0x404;  // da AlFramework\CommonDefines.h
	var handler = m_ECATFactory.CreatePropertyChanged2WndMsgHandler("ModifiedFlag", true, false, app.MainWindowHWND, WMU_SETMODIFIED, 1, 0);
	prj.add_PropertyChanged(handler);
	// oppure si può anche fare con funzione js diretta, come per i nomi degli slave:
	//var handler = m_ECATFactory.CreatePropertyChanged2JSFuncHandler("ModifiedFlag", true, function(){ app.ModifiedFlag = true } );
}

function AttachECATMasterHandlers()
{
	var handler = app.CallFunction("ECATCtrl.CreateGenericEvent2JSFuncHandler", OnAfterScanNetwork)
	app.CallFunction("ECATCtrl.AddCtrlEventHandler", null, "OnAfterScanNetwork", handler)
}


function CreateNewECATPrj(newMasterEnabled)
{
	// crea nuovo progetto con un unico master
	var master = m_ECATFactory.CreateMaster();
	master.Enabled = newMasterEnabled;
	
	var prj = m_ECATFactory.CreatePrj();
	prj.AddMaster(master);
	prj.ModifiedFlag = false;
	
	// invoca callback esterna di creazione progetto
	if (m_onCreateNewPrj_func)
		m_onCreateNewPrj_func(prj);
		
	return prj;
}

// caricamento progetto etherCAT dal xml del PLCPRJ (master singolo)
function LoadEtherCATProject(device, newMasterEnabled)
{
	if (!CreateNewECATFactory())
		return false;
	
	var EtherCATNode = device.selectSingleNode("EtherCAT");
	if (EtherCATNode.childNodes.length != 0)
	{
		// progetto ethercat già presente: lo carica a partire dalla stringa xml (non è possibile passare oggetti MSXML a .net)
		var ethercatContent = EtherCATNode.firstChild.xml;
		try
		{
			m_ECATPrj = m_ECATFactory.LoadPrjFromString(ethercatContent);
		}
		catch (ex)
		{
			// potrebbe esserci stato un errore di template non trovato... in questo caso l'import/export automatico dei PCT non ha funzionato a dovere!
			app.PrintMessage("!!! ERROR loading EtherCAT project: " + (ex && ex.description ? ex.description : ""));
			app.MessageBox(app.Translate("ERROR loading EtherCAT project\nSee 'Resources' tab for details"), "", gentypes.MSGBOX.MB_ICONERROR);
			return false;
		}
	}
	else
		m_ECATPrj = CreateNewECATPrj(newMasterEnabled);
	
	AttachECATPrjHandlers(m_ECATPrj);
	
	// modalità con master unico e fisso (LLExec): il nodo "EtherCAT" dell'albero è di fatto quello del master
	// eccezione rispetto a tutti gli altri oggetti: il master viene messo in mappa con il suo datapath REALE nel PCN, visto che esiste!
	var master = m_ECATPrj.GetMaster(0);
	var newDatapath = app.GetDataPathFromNode(EtherCATNode);
	var masterTreepath = app.HMIGetElementPath(TREENAME, newDatapath);
	m_datapath2ECATObjectMap[newDatapath] = master;

	AddECATMasterToTree(master, masterTreepath)

	return true;
}

// caricamento progetto EtherCAT da file (multi-master)
function LoadEtherCATProjectFromFile(filename, newMasterEnabled)
{
	if (!CreateNewECATFactory())
		return false;
	
	if (filename)
	{
		try
		{
			m_ECATPrj = m_ECATFactory.LoadPrj(filename);
		}
		catch (ex)
		{
			// potrebbe esserci stato un errore di template non trovato... in questo caso l'import/export automatico dei PCT non ha funzionato a dovere!
			app.PrintMessage("!!! ERROR loading EtherCAT project: " + (ex && ex.description ? ex.description : ""));
			app.MessageBox(app.Translate("ERROR loading EtherCAT project\nSee 'Output' tab for details"), "", gentypes.MSGBOX.MB_ICONERROR);
			return false;
		}
	}
	else
		m_ECATPrj = CreateNewECATPrj(newMasterEnabled);
	
	AttachECATPrjHandlers(m_ECATPrj);
	
	// modalità "standard" con più master possibili da aggiungere ora nell'albero
	for (var m = 0; m < m_ECATPrj.MastersCount; m++)
		AddECATMasterToTree(m_ECATPrj.GetMaster(m), null);

	return true;
}

function AddECATMasterToTree(master, masterTreepath)
{
	if (!masterTreepath)
	{
		// se treepath del master non specificato, significa che va aggiunto qui, altrimenti è già stato fatto dal chiamante (modalità a master fisso)
		var newDatapath = CreateNewDatapath();
		masterTreepath = app.HMIAddElement2(TREENAME, "EtherCAT_Master", "/ROOT", master.Name, newDatapath, "", "", gentypes.enuOperationPos.opAppend);
		m_datapath2ECATObjectMap[newDatapath] = master;

		// aggancia OnECATObjNameChanged al cambio di property Name dello slave
		var handler = m_ECATFactory.CreatePropertyChanged2JSFuncHandler("Name", undefined, OnECATObjNameChanged);
		master.add_PropertyChanged(handler)
		// aggancia OnECATObjEnableChanged al cambio di property Enable dello slave
		var handler = m_ECATFactory.CreatePropertyChanged2JSFuncHandler("Enabled", undefined, OnECATObjEnableChanged);
		master.add_PropertyChanged(handler)
		
		if (!master.Enabled)
			app.HMISetOverlayImg(TREENAME, masterTreepath, TREE_OVERLAY_DISABLED);
	}

	var newDatapath = CreateNewDatapath();
	var mainNetworkTreepath = app.HMIAddElement2(TREENAME, "EtherCAT_subNetwork", masterTreepath, app.Translate("Main network"), newDatapath, "", "", gentypes.enuOperationPos.opAppend);
	m_datapath2ECATObjectMap[newDatapath] = master.SlavesList;
	
	AddECATSlaveListToTree(mainNetworkTreepath, master.SlavesList, m_slaveIdxToSkipInTree);

	// creazione nodi nell'albero per gli hotconnect group
	for (var i = 0; i < master.HotConnectGroupsCount; i++)
	{
		var grp = master.GetHotConnectGroup(i);

		var newDatapath = CreateNewDatapath();
		var grpTreepath = app.HMIAddElement2(TREENAME, "EtherCAT_HotConnectGroup", masterTreepath, grp.Name, newDatapath, "", "", gentypes.enuOperationPos.opAppend);
		m_datapath2ECATObjectMap[newDatapath] = grp;

		AddECATSlaveListToTree(grpTreepath, grp);
	}
}

function GetECATPortDescr(port)
{
	// PortNum =>  0=A 1=B 2=C 3=D,    PortType è il carattere con il tipo (Y,K,H)
	var result = "Port" + String.fromCharCode(65 + port.PortNum) + "_" + String.fromCharCode(port.PortType);
	if (port.PortLabel)
		result += "_" + port.PortLabel;
	return result;
}

// funzione passata come delegate a PropertyChanged di tutti gli slave: rinomina lo slave nell'albero del framework
function OnECATObjNameChanged(slave)
{
	var datapath = FindDatapathFromECATObj(slave);
	if (datapath)
	{
		var treepath = app.HMIGetElementPath(TREENAME, datapath);
		if (treepath)
			app.HMISetCaption(TREENAME, treepath, slave.Name);
	}
}

// funzione passata come delegate a PropertyChanged di tutti gli slave: cambio dello stato di enabled/disabled
function OnECATObjEnableChanged(slave)
{
	var datapath = FindDatapathFromECATObj(slave);
	if (datapath)
	{
		var treepath = app.HMIGetElementPath(TREENAME, datapath);
		if (treepath)
			app.HMISetOverlayImg(TREENAME, treepath, slave.Enabled ? TREE_OVERLAY_NONE : TREE_OVERLAY_DISABLED);
	}
}

// aggiunta nell'albero dello slave specificato sotto la posizione treepath
function AddECATSlaveToTree(treepath, slave, operationPos)
{
	var icon = "";
	if (slave.Template.IconFileName)
		icon = app.CatalogPath + m_fso.GetParentFolderName(slave.Template.filename) + "\\" + slave.Template.IconFileName;
	
	// le bitmap presenti negli ESI e quindi poi importate nel catalogo hanno il colore di trasparenza magenta, il framework di default usa grigio
	var oldBitmapTransp = app.Feature(gentypes.enuFrameworkFeatures.featBitmapTransparentColor);
	app.Feature(gentypes.enuFrameworkFeatures.featBitmapTransparentColor) = 0xFF00FF;   // magenta
	
	var newDatapath = CreateNewDatapath();
	var slaveTreepath = app.HMIAddElement2(TREENAME, "EtherCAT_slave", treepath, slave.Name, newDatapath, icon, icon, operationPos);
	m_datapath2ECATObjectMap[newDatapath] = slave;
	
	app.Feature(gentypes.enuFrameworkFeatures.featBitmapTransparentColor) = oldBitmapTransp;
	
	// aggancia OnECATObjNameChanged al cambio di property Name dello slave
	var handler = m_ECATFactory.CreatePropertyChanged2JSFuncHandler("Name", undefined, OnECATObjNameChanged);
	slave.add_PropertyChanged(handler)
	// aggancia OnECATObjEnableChanged al cambio di property Enable dello slave
	var handler = m_ECATFactory.CreatePropertyChanged2JSFuncHandler("Enabled", undefined, OnECATObjEnableChanged);
	slave.add_PropertyChanged(handler)
	
	if (!slave.Enabled)
		app.HMISetOverlayImg(TREENAME, slaveTreepath, TREE_OVERLAY_DISABLED);
	
	// aggiunge le sottoreti dello slave (ce ne possono essere da 0..2 in base alle porte)
	for (var i = 0; i < slave.SubNetworksCount; i++)
	{
		var subnetwork = slave.GetSubNetwork(i);
		var parentPort = subnetwork.GetParentPort();

		var newDatapath = CreateNewDatapath();
		var subnetworkTreepath = app.HMIAddElement2(TREENAME, "EtherCAT_subNetwork", slaveTreepath, GetECATPortDescr(parentPort), newDatapath, "", "", gentypes.enuOperationPos.opAppend);
		m_datapath2ECATObjectMap[newDatapath] = subnetwork;
		
		AddECATSlaveListToTree(subnetworkTreepath, subnetwork);
	}
	
	return slaveTreepath;
}

function AddECATSlaveListToTree(treepath, slavesList, slaveIdxToSkipInTree)
{
	for (var i = 0; i < slavesList.Count; i++)
	{
		if (slaveIdxToSkipInTree === i)
			continue;   // salta slave con l'idx specificato, non comparirà nell'albero
			
		var slave = slavesList.Item(i);
		AddECATSlaveToTree(treepath, slave, gentypes.enuOperationPos.opAppend);
	}
}

// salva progetto ethercat dentro il progetto plcprj
function SaveEtherCATProject(device)
{
	if (!m_ECATPrj.ModifiedFlag)
		return;   // se prj non modificato, evita di fare cose inutili
	
	var EtherCATNode = device.selectSingleNode("EtherCAT");
	
	while (EtherCATNode.childNodes.length != 0)
		EtherCATNode.removeChild(EtherCATNode.firstChild)
	
	var ethercatContent = m_ECATPrj.SaveToString();
	
	var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0");
	xmldoc.async = false;
	if (!xmldoc.loadXML(ethercatContent))
	{
		app.PrintMessage("ERROR parsing EtherCAT xml project");
		return false;
	}
	
	EtherCATNode.appendChild(xmldoc.documentElement);
	m_ECATPrj.ModifiedFlag = false;
	return true;
}

// salva progetto EtherCAT su file
function SaveEtherCATProjectToFile(filename)
{
	m_ECATPrj.Save(filename);
	m_ECATPrj.ModifiedFlag = false;
	return true;
}

function IsECATSlaveList(obj)
{
	return m_ECATFactory.GetObjectTypeName(obj) == "ECATSlavesList";
}

function IsECATSlave(obj)
{
	return m_ECATFactory.GetObjectTypeName(obj) == "ECATSlave";
}

function IsECATMaster(obj)
{
	return m_ECATFactory.GetObjectTypeName(obj) == "ECATMaster";
}

function IsECATHotConnectGroup(obj)
{
	return m_ECATFactory.GetObjectTypeName(obj) == "ECATHotConnectGroup";
}

function GetProtocolFromECATObj(obj)
{
	var protocol;
	if (IsECATHotConnectGroup(obj))
		protocol = "EtherCAT_port_Y"
	else if (IsECATSlaveList(obj))
		protocol = "EtherCAT_port_" + String.fromCharCode(obj.GetParentPort().PortType);
	
	return protocol;
}

// click singolo su elemento dell'albero
function OnTreeClick_ECAT()
{
	var obj = FindECATObjFromTreepath("");
	if (obj)
	{
		var protocol = GetProtocolFromECATObj(obj);
		if (protocol)
		{
			// normalmente il ctrl del catalog è in modalità lista con icone grosse. solo per EtherCAT cambia la modalità al volo (albero, icone piccole),
			// aggiorna il ctrl e poi la riporta a quella standard
			var oldMode = app.CallFunction("catalog.get_Behaviour");
			if ((oldMode & enuCatalogModes.CAT_DLG_TREEVIEW) == 0)
			{
				// promemoria per abilitazione modalità corretta del catalogo alla partenza
				app.MessageBox("ERROR: Catalog is not in CAT_DLG_TREEVIEW mode! Enable it in CatalogFuncs.js, function Init()", "", gentypes.MSGBOX.MB_ICONERROR);
				return;
			}
			
			app.CallFunction("catalog.SetBehaviour", ECAT_CATALOG_MODE);
			
			var query = "//deviceinfo[protocols/protocol = '" + protocol + "']"
			app.CallFunction("catalog.UpdateCatalogListCtrl", query)
			
			app.CallFunction("catalog.SetBehaviour", oldMode);
		}
		else
			app.CallFunction("catalog.UpdateCatalogListCtrl", "")
		
		// per ovviare al messaggio "server occupato..." che su alcuni PC molto lenti può uscire nell'attesa del primo caricamento
		// del framework .net / WPF, alza il timeout a 60s (dovrebbe bastare per tutti...)
		// la funzione SetOleMessageFilter è stata messa di recente in AlFramework, per retrocompatibilità ne controlla l'esistenza
		if (app.FunctionExists("commonDLL.SetOleMessageFilter"))
			var SetOleMessageFilter_funcName = "commonDLL.SetOleMessageFilter";
		else
			var SetOleMessageFilter_funcName = "extfunct.SetOleMessageFilter";

		app.CallFunction(SetOleMessageFilter_funcName, null, 60000, null, null)
		app.OpenWindow("ECATCtrl", "", obj)
		// lascia il timeout a 60s per non dare il "server occupato..." mentre eventualmente girano gli script di NetEnable/NetDisable per la connessione local
		//app.CallFunction(SetOleMessageFilter_funcName, null, 5000, null, null)
		
		// se richiesto mostra/nasconde tab "Tasks" del master
		if (IsECATMaster(obj))
		{
			app.CallFunction("ECATCtrl.InvokeCtrlMethod", "ShowTasksTab", m_ECATMaster_GUI_ShowTasks);
			app.CallFunction("ECATCtrl.InvokeCtrlMethod", "ShowRawCmdTab", m_ECATMaster_GUI_ShowRawCmd);
			app.CallFunction("ECATCtrl.InvokeCtrlMethod", "SetOnlineModeEnableFlags", m_ECATMaster_GUI_OnlineModeEnableFlags);
		}

		if ((IsECATSlave(obj) || IsECATMaster(obj)) && m_AttachECATCtrlHandlers_func)
			m_AttachECATCtrlHandlers_func();
		
		if (IsECATMaster(obj))
			AttachECATMasterHandlers();
	}
	else
	{
		app.CallFunction("catalog.UpdateCatalogListCtrl", "");
		app.OpenWindow("emptypage", "", "");
	}
}



// drop di un device dalla dockbar del catalog dentro l'albero
function OnTreeDrop_ECAT(text)
{
	var result = app.CallFunction("common.ParseDragDropText", text);
	if (!result)
		return;
	
	var retval = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + result.deviceid + "']");
	if (!retval || retval.length == 0)
		return;
	
	// ottiene il treepath del nodo corrente (su cui si è droppato)
	var treepath = app.HMIGetCurElementPath(TREENAME)
	
	var template = retval[0].getAttribute("template");
	AddECATSlaveFromTemplate(treepath, template)
}

// corrisponde all'enum dentro ECATCfg
var ECATSlavesListResult = {
	OK: 0,
	IncompatiblePortType: 1,
	CanNotAppend: 2,
	AlreadyPresent: 3,
	InvalidName: 4,
	InvalidPhysAddr: 5,
	NotPresent: 6
};

// descrizioni corrispondenti all'enum ECATSlavesListResult
var m_ECATSlavesListResultMsg = {
	0: "OK",
	1: "Incompatible port type",
	2: "Can not append another slave",
	3: "Slave is already present in the list",
	4: "Invalid slave name",
	5: "Invalid slave physical address",
	6: "Slave is not present in the list"
}

// aggiunta di uno slave: carica il template e lo mette nell'albero sotto treepath specificato
function AddECATSlaveFromTemplate(treepath, template)
{
	var obj = FindECATObjFromTreepath(treepath);
	if (!obj)
		return;
	
	var slavesList;
	if (IsECATMaster(obj))
		slavesList = obj.SlavesList;
	else if (IsECATSlaveList(obj) || IsECATHotConnectGroup(obj))
		slavesList = obj;
	else
		return;
	
	var slaveTemplate = m_ECATFactory.LoadDeviceTemplate(template);
	
	var oldSlavesCount = slavesList.Count;
	var newSlave = slavesList.AddSlaveFromTemplate(slaveTemplate);
	if (!newSlave)
	{
		app.MessageBox(app.Translate("Can not add this slave here:\n") + m_ECATSlavesListResultMsg[slavesList.LastResult], "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return;
	}
	
	AddECATSlaveToTree(treepath, newSlave, gentypes.enuOperationPos.opAppend);
	
	// se sono stati aggiunti più di uno slave alla lista, siamo nel caso di slave che ha dei subDevices allo stesso livello (ovvero connessi alla sua outputPort)
	// in questo caso, deve aggiungere anche loro all'albero (nel progetto ci sono già)
	for (var i = oldSlavesCount + 1; i < slavesList.Count; i++)
		AddECATSlaveToTree(treepath, slavesList.Item(i), gentypes.enuOperationPos.opAppend);
}

// aggiunta di uno slave tramite dialog del catalog. chiamato da menu di popup
function AddECATSlaveFromMenu()
{
	var treepath = app.HMIGetCurElementPath(TREENAME);
	var obj = FindECATObjFromTreepath(treepath);
	if (!obj)
		return;
	
	var protocol = GetProtocolFromECATObj(obj);
	if (!protocol)
		return;
	
	var oldMode = app.CallFunction("catalog.get_Behaviour");
	app.CallFunction("catalog.SetBehaviour", ECAT_CATALOG_MODE);

	var query = "//deviceinfo[protocols/protocol = '" + protocol + "']";
	var retval = app.CallFunction("catalog.Select", query)
	
	app.CallFunction("catalog.SetBehaviour", oldMode);
	
	if (!retval)
		return;
	
	AddECATSlaveFromTemplate(treepath, retval.getAttribute("template"));
}

function AddECATHotConnectGroupFromMenu()
{
	var treepath = app.HMIGetCurElementPath(TREENAME);
	var mst = FindECATObjFromTreepath(treepath);  // DEVE essere per forza il master...
	if (!mst || !IsECATMaster(mst))
		return;
	
	var grp = m_ECATFactory.CreateHotConnectGroup("HotConnectGroup" + mst.HotConnectGroupsCount);
	mst.AddHotConnectGroup(grp);
	
	var newDatapath = CreateNewDatapath();
	var subnetworkTreepath = app.HMIAddElement2(TREENAME, "EtherCAT_HotConnectGroup", treepath, grp.Name, newDatapath, "", "", gentypes.enuOperationPos.opAppend);
	m_datapath2ECATObjectMap[newDatapath] = grp;
}

// rimuove lo slave selezionato nell'albero. chiamato da menu di popup o da tasto canc
function RemoveNode_ECAT()
{
	var treepath = app.HMIGetCurElementPath(TREENAME);
	var datapath = app.HMIGetElementData(TREENAME, treepath);
	var obj = FindECATObjFromDatapath(datapath);
	if (!obj)
		return;
		
	if (!(IsECATSlave(obj) || IsECATHotConnectGroup(obj) || IsECATMaster(obj)))
		return;


	if (IsECATSlave(obj))
	{
		if (app.MessageBox(app.Translate("Are you sure you want to delete item\n") + obj.Name + " ?", "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_OKCANCEL) == gentypes.MSGBOX.IDCANCEL)
			return;
		
		var slavesList = obj.Parent;
		slavesList.RemoveSlave(obj);
	}
	else if (IsECATHotConnectGroup(obj))
	{
		var mst = obj.Parent;
		if (!mst || !IsECATMaster(mst))
			return;

		var msg = genfuncs.FormatMsg(app.Translate("Group '%1' will be deleted.\nMove all its slaves to the Main network?"), obj.Name);
		var ris = app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNOCANCEL);
		if (ris == gentypes.MSGBOX.IDCANCEL)
			return;
		
		var oldCnt = mst.SlavesList.Count;
		
		if (!mst.RemoveHotConnectGroup(obj, (ris == gentypes.MSGBOX.IDYES)))
			// si è verificato un errore, ad esempio spostando gli slaves...
			app.MessageBox(app.Translate("ERROR deleting group ") + obj.Name, "", gentypes.MSGBOX.MB_ICONERROR);
		
		if (ris == gentypes.MSGBOX.IDYES)
		{
			// aggiuge a livello di alberto gli slaves che prima erano nel gruppo
			var mainTreepath = FindTreepathFromECATObj(mst.SlavesList);
			
			for (var i = oldCnt; i < mst.SlavesList.Count; i++)
				AddECATSlaveToTree(mainTreepath, mst.SlavesList.Item(i), gentypes.enuOperationPos.opAppend);
		}
	}
	else if (IsECATMaster(obj))
	{
		if (app.MessageBox(app.Translate("Are you sure you want to delete master\n") + obj.Name + " ?", "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_OKCANCEL) == gentypes.MSGBOX.IDCANCEL)
			return;

		m_ECATPrj.RemoveMaster(obj);
	}

	app.HMIRemoveElement(TREENAME, treepath);
	
	DeleteECATObjFromMap(datapath);
}

function OnTreeKeyDown_ECAT(key)
{
	// vedi winuser.h per lista tasti VK_XXX
	if (key == 0x2E)  // VK_DELETE
		RemoveNode_ECAT()
}

// notifica di rinomina di un elemento nell'albero con F2. Ne rinomina l'oggetto ECATSlave associato
function OnEndCaptionEdit_ECAT(treepath, newname)
{
	var obj = FindECATObjFromTreepath(treepath);
	if (!obj)
		return false;
	
	obj.Name = newname;
	return true;
}

// comando di spostamento su (da menu popup sullo slave)
function MoveUpNode_ECAT()
{
	var treepath = app.HMIGetCurElementPath(TREENAME);
	var datapath = app.HMIGetElementData(TREENAME, treepath);
	var slave = FindECATObjFromDatapath(datapath);
	if (!slave || !IsECATSlave(slave))
		return;
	
	// ottiene l'indice dello slave nella lista
	var parentList = slave.Parent;
	var i;
	for (i = 0; i < parentList.Count; i++)
		if (parentList.item(i) == slave)
			break;
	
	// se all'inizio o non trovato esce
	if (i == 0 || i == parentList.Count)
		return;

	var prevSlave = parentList.item(i - 1);
	var prevDatapath = FindDatapathFromECATObj(prevSlave);
	if (!prevDatapath)
		return
	var prevTreepath = app.HMIGetElementPath(TREENAME, prevDatapath);
	if (!prevTreepath)
		return
	
	var newTreepath = MoveUpNode_ECAT_helper(treepath, datapath, slave, i, prevTreepath);
	if (newTreepath)
		// si riposiziona sullo slave spostato su. nel movedown invece non serve, è già nel posto giusto
		app.HMISetCurElement(TREENAME, newTreepath);
}

// comando di spostamento giu (da menu popup sullo slave)
function MoveDownNode_ECAT()
{
	var treepath = app.HMIGetCurElementPath(TREENAME);
	var datapath = app.HMIGetElementData(TREENAME, treepath);
	var slave = FindECATObjFromDatapath(datapath);
	if (!slave || !IsECATSlave(slave))
		return;
	
	// ottiene l'indice dello slave nella lista
	var parentList = slave.Parent;
	var i;
	for (i = 0; i < parentList.Count; i++)
		if (parentList.item(i) == slave)
			break;
	
	// se in fondo o non trovato esce
	if (i == parentList.Count - 1 || i == parentList.Count)
		return;

	var nextSlave = parentList.item(i + 1);
	var nextDatapath = FindDatapathFromECATObj(nextSlave);
	if (!nextDatapath)
		return
	var nextTreepath = app.HMIGetElementPath(TREENAME, nextDatapath);
	if (!nextTreepath)
		return
	
	// riconduce al move up dello slave successivo
	MoveUpNode_ECAT_helper(nextTreepath, nextDatapath, nextSlave, i + 1, treepath);
}

function MoveUpNode_ECAT_helper(treepath, datapath, slave, slaveIdx, prevTreepath)
{
	var slavesList = slave.Parent;
	slavesList.RemoveSlave(slave);
	
	app.HMIRemoveElement(TREENAME, treepath);
	DeleteECATObjFromMap(datapath);
	
	if (!slavesList.InsertSlaveBeforeIdx(slave, slaveIdx - 1))
	{
		app.MessageBox(app.Translate("Can not insert this slave here:\n") + m_ECATSlavesListResultMsg[slavesList.LastResult], "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return;
	}
	
	var newTreepath = AddECATSlaveToTree(prevTreepath, slave, gentypes.enuOperationPos.opInsertBefore);
	return newTreepath;
}

// comando di taglia slave da menu popup
function TreeCut_ECAT()
{
	m_ECATObjCopySource = FindECATObjFromTreepath("");
	
	if (!IsECATSlave(m_ECATObjCopySource))
		m_ECATObjCopySource = null;  // per sicurezza
	
	m_ECATObjCutCmd = true;
}

// comando di copia slave da menu popup
function TreeCopy_ECAT()
{
	m_ECATObjCopySource = FindECATObjFromTreepath("");
	
	if (!IsECATSlave(m_ECATObjCopySource))
		m_ECATObjCopySource = null;  // per sicurezza
	
	m_ECATObjCutCmd = false;
}

// comando di paste slave su master o subnetwork da menu popup
function TreePaste_ECAT()
{
	var treepath = app.HMIGetCurElementPath(TREENAME);
	var destObj = FindECATObjFromTreepath(treepath);
	if (!destObj)
		return;
	
	var slavesList;
	if (IsECATMaster(destObj))
		slavesList = destObj.SlavesList;
	else if (IsECATSlaveList(destObj) || IsECATHotConnectGroup(destObj))
		slavesList = destObj;
	else
		return;
	
	if (m_ECATObjCutCmd)
	{
		// visto che subito dopo farà remove, si assicura che la AddSlave successiva andrà a buon fine, altrimenti la remove non sarà reversibile
		if (!slavesList.CanAddSlave(m_ECATObjCopySource))
		{
			app.MessageBox(app.Translate("Can not add this slave here:\n") + m_ECATSlavesListResultMsg[slavesList.LastResult], "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
			return;
		}
		
		m_ECATObjCopySource.Parent.RemoveSlave(m_ECATObjCopySource);
		
		app.HMIRemoveElement(TREENAME, FindTreepathFromECATObj(m_ECATObjCopySource));
		DeleteECATObjFromMap(FindDatapathFromECATObj(m_ECATObjCopySource));
		
		m_ECATObjCutCmd = false;    // paste successivi saranno copy!
		var newSlave = m_ECATObjCopySource;
	}
	else
		var newSlave = m_ECATObjCopySource.Clone(false);
		
	if (!slavesList.AddSlave(newSlave))
	{
		app.MessageBox(app.Translate("Can not add this slave here:\n") + m_ECATSlavesListResultMsg[slavesList.LastResult], "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return;
	}

	AddECATSlaveToTree(treepath, newSlave, gentypes.enuOperationPos.opAppend);
}

function UpdateTreePaste_ECAT()
{
	return m_ECATObjCopySource ? 1 : 0;
}

// funzione chiamata da menu di popup su slave per toggle abilitazione
function EnableDisableNode_ECAT()
{
	var obj = FindECATObjFromTreepath("");
	if (!obj)
		return;
	
	obj.Enabled = !obj.Enabled;
}

// ritorna un array con la lista dei deviceid dei vari PCT caricati
function GetLoadedECATTemplatesDeviceIDs(slave)
{
	if (slave)
	{
		// tutti i deviceID dello slave e dei suoi figli
		var stringsSafearr = slave.GetAllTemplatesIDs();
	}
	else
	{
		// tutti i deviceID del progetto
		// rimuove eventuali templates non più usati (ovvero di slaves cancellati)
		m_ECATFactory.UnloadUnunsedTemplates(m_ECATPrj);
		var stringsSafearr = m_ECATFactory.GetLoadedTemplatesDeviceIDs();
	}
	
	var safeArr = app.CallFunction("commonDLL.ConvertToSafeArrayOfVariant", stringsSafearr)
	return genfuncs.FromSafeArray(safeArr);
}

function ImportESI()
{
	var filename = app.CallFunction("commonDLL.ShowOpenFileDlg", "ESI files (*.XML)|*.XML|All files|*.*|");
	if (!filename)
		return;
	
	try
	{
		var importFilter = new ActiveXObject("ECATCfgGUI.ImportESIFilter");
	}
	catch (ex)
	{
		app.MessageBox("ERROR loading EtherCAT configurator!\n\nMake sure .NET framework 4.5 is installed, and ECATCfg DLLs are registered", "", gentypes.MSGBOX.MB_ICONERROR);
		return false;
	}
	
	try
	{
		var tot = m_ECATFactory.ImportESI(filename, importFilter);
	}
	catch (ex)
	{
		app.MessageBox(app.Translate("ERROR importing ESI file:\n") + ex.message, "", gentypes.MSGBOX.MB_ICONERROR);
		return;
	}
	
	if (tot != 0)
	{
		var msg = genfuncs.FormatMsg(app.Translate("Successfully imported %1 devices from ESI"), tot);
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONINFORMATION);
		
		app.CallFunction("catalog.ResetCache", "");
		app.CallFunction("catalog.Load", app.CallFunction("catalog.GetCatalogPath"));
		
		OnTreeClick_ECAT();   // rinfresca della finestra del catalogo
	}
}

var ECATScanNetworkResult =
{
	unknownSlave: -3,
	badTopology: -2,
	error: -1,
	OK: 0,
	OKNetworkMatching: 1
};

function OnAfterScanNetwork(master, result)
{
	// se siamo all'inteno di LogicLab (non ECATLab) attiva il tab resources
	if (app.ExtensionExists("logiclab"))
		app.CallFunction("extfunct.SelectOutputTab", TAB_RESOURCES);
	
	if (result != ECATScanNetworkResult.OK)
		return;  // nulla da fare
	
	var masterTreepath = FindTreepathFromECATObj(master);
	
	// rimozione 'main network', per successiva creazione
	var datapath = FindDatapathFromECATObj(master.SlavesList);
	DeleteECATObjFromMap(datapath);
	var treepath = app.HMIGetElementPath(TREENAME, datapath);
	app.HMIRemoveElement(TREENAME, treepath);
	
	// rimozione di tutti gli hotconnect group; poichè sono già stati rimossi internamente nel progetto ethercat (quindi master.HotConnectGroupsCount == 0),
	// effettua una query 'a basso livello' direttamente sul xml interno dell'albero per ottenere l'elenco dei vecchi gruppi
	var xmlTreeRoot = app.HMIGetInternalXMLDoc(TREENAME).documentElement;
	var nodelist = xmlTreeRoot.selectNodes("." + masterTreepath + "/EtherCAT_HotConnectGroup")
	var node
	while (node = nodelist.nextNode())
	{
		var datapath = node.getAttribute("data");
		DeleteECATObjFromMap(datapath);
		var treepath = app.HMIGetElementPath(TREENAME, datapath);
		app.HMIRemoveElement(TREENAME, treepath);
	}
	

	// ricrea l'albero al di sotto del master con gli esiti dello scan (il nodo master rimane lo stesso)
	AddECATMasterToTree(master, masterTreepath)
}



// ----------------------------- funzioni di backup/restore PCT user ------------------------------------
// ----------------------------- ATTENZIONE: presi con poche modifiche da LogicLab5\templates\script.js
// ----------------------------- ATTENZIONE: LogicLab infatti non usa queste funzioni ma una loro leggera variante
// ------------------------------------------------------------------------------------------------------
// nome della cartella sotto il progetto con gli user templates
var USERTEMPLATES_DIR = "UserTemplates"
// estensione dei templates nel catalogo
var PCT_EXT = "PCT"


// copia di tutti i PCT utente nella cartella del progetto locale dal catalogo
function BackupAllUserTemplates(destPath, slave)
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
	
	var slavesList = GetLoadedECATTemplatesDeviceIDs(slave);
	if (!slavesList || slavesList.length == 0)
		return    // nessuno slave, niente da fare

	// scorre l'elenco di tutti gli slaves (funziona sia con array che con IXMLDOMNodeList)
	var totCopied = 0
	for (var i = 0, t = slavesList.length; i < t; i++)
	{
		// cerca nella cache del catalogo per deviceid
		if (typeof slavesList[i] == "string")
			var deviceid = slavesList[i];          // già una stringa (slavesList è quindi per forza un array)
		else
			var deviceid = slavesList[i].nodeName; // altro, assume sia IXMLDOMNode
			
		var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + deviceid + "']")
		if (nodelist && nodelist.length != 0)
		{
			var deviceinfo = nodelist[0]
			// il PCT è da salvare insieme al progetto se ha attributi editingEnabled=true (ModbusCustomEditor o CANcustomEditor) o importedFromEDS=true o importedFromESI=true
			if (genfuncs.ParseBoolean(deviceinfo.getAttribute("editingEnabled")) || 
				genfuncs.ParseBoolean(deviceinfo.getAttribute("importedFromEDS")) ||
				genfuncs.ParseBoolean(deviceinfo.getAttribute("importedFromESI")))
			{
				var PCT = deviceinfo.getAttribute("template")
				var PCTpath = m_fso.GetParentFolderName(PCT)
				var caption = deviceinfo.getAttribute("caption")
				var version = deviceinfo.getAttribute("version")
				
				try
				{
					if (!m_fso.FolderExists(destPath))
						// alla prima copia crea la cartella UserTemplates (che di sicuro non c'è in quanto cancellata all'inizio)
						m_fso.CreateFolder(destPath)
						
					if (!m_fso.FolderExists(destPath + "\\" + PCTpath))
						// crea la sottocartella di primo livello (sarà ModbusCustom o CANcustom)
						m_fso.CreateFolder(destPath + "\\" + PCTpath)
					
					m_fso.CopyFile(app.CatalogPath + PCT, destPath + "\\" + PCT, true)
					
					var msg = app.Translate("User object '%1 %2' copied into project from %3")
					app.PrintMessage(genfuncs.FormatMsg(msg, caption, version, PCT))
					totCopied++
					
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
	var imgPath = destPath + "\\" + PCTpath + "\\img\\";
	if (!m_fso.FolderExists(imgPath))
		// crea la sottocartella img se non esiste
		m_fso.CreateFolder(imgPath);
	
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
}

function RestoreUserTemplate_ESI(deviceinfo, filepath, destFullFilename)
{
	var srcPathPCT = m_fso.GetParentFolderName(filepath) + "\\";
	var destPathImg = m_fso.GetParentFolderName(destFullFilename) + "\\img\\";
	
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
}

// copia di tutti i PCT utente dalla cartella UserTemplates al catalogo
function RestoreAllUserTemplates(srcPath)
{
	srcPath += "\\" + USERTEMPLATES_DIR
	if (!m_fso.FolderExists(srcPath))
		return
	
	var updateCatalog = false
	
	var folder = m_fso.GetFolder(srcPath)
	// iterazione su tutte le sottocartelle di primo livello (saranno ModbusCustom o CANcustom o EtherCATcustom)
	for (var enDirs = new Enumerator(folder.SubFolders); !enDirs.atEnd(); enDirs.moveNext())
	{
		// iterazione su tutti i files *.PCT in tutte le sottocartelle di primo livello
		for (var enFiles = new Enumerator(enDirs.item().Files); !enFiles.atEnd(); enFiles.moveNext())
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
			
			var destFilename = enDirs.item().Name + "\\" + enFiles.item().Name
			var destFullFilename = app.CatalogPath + destFilename
			var doCopy = true
			
			var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + deviceid + "']")
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
					if (app.MessageBox(genfuncs.FormatMsg(msg, caption, version), "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNO) == gentypes.MSGBOX.IDNO)
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
	
	if (updateCatalog)
	{
		// ricarica cache del catalogo se modifiche effettuate
		app.CallFunction("catalog.ResetCache", "");
		app.CallFunction("catalog.Load", app.CallFunction("catalog.GetCatalogPath"));
	}
}
// ------------------------------------------------------------------------------------------------------
// ----------------------------- FINE funzioni di backup/restore PCT user ------------------------------------
// ------------------------------------------------------------------------------------------------------



// creazione cartella di lavoro in temp per import/export
function MakeExportTempFolder()
{
	var temp = m_fso.GetSpecialFolder(2) + "\\ECATLab_Export_tmp";   // 2=TempFolder
	if (m_fso.FolderExists(temp))
		m_fso.DeleteFolder(temp, true);
		
	m_fso.CreateFolder(temp);
	return temp;
}

// crea uno zip contenente tutto il contenuto della cartella specificata (ricorsivamente, con path relativi)
function ZipFolderContents(srcFolder, destZip)
{
	var shell = new ActiveXObject("WScript.Shell");
	var oldDir = shell.CurrentDirectory;
	// si sposta nella cartella destinazione per creare uno zip con path relativi
	shell.CurrentDirectory = srcFolder;
	
	var cmd = '"' + app.CatalogPath + '..\\Common\\Tools\\zip.exe" -r -9 "' + destZip + '" *.*';
	try
	{
		shell.Run(cmd, 0, true);   //0=hide
	}
	catch (ex)
	{
		app.MessageBox("ERROR executing command:\n" + cmd, "", gentypes.MSGBOX.MB_ICONERROR);
	}
	shell.CurrentDirectory = oldDir;
}

// scompatta il contenuto dello zip nella cartella specificata (deve già esistere)
function UnzipToFolder(srcZip, destFolder)
{
	var shell = new ActiveXObject("WScript.Shell");
	var oldDir = shell.CurrentDirectory;
	shell.CurrentDirectory = destFolder;
	
	var cmd = '"' + app.CatalogPath + '..\\Common\\Tools\\unzip.exe" "' + srcZip + '"';
	try
	{
		shell.Run(cmd, 0, true);   //0=hide
	}
	catch (ex)
	{
		app.MessageBox("ERROR executing command:\n" + cmd, "", gentypes.MSGBOX.MB_ICONERROR);
	}
	shell.CurrentDirectory = oldDir;
}

function ExportSlaveToFile()
{
	var slave = FindECATObjFromTreepath("");
	if (!IsECATSlave(slave))
		return;
		
	// scelta file .slaveExp (che è in realtà uno zip)
	var filename = app.CallFunction("commonDLL.ShowSaveFileDlg", app.Translate("Slave Export files (*.SlaveExp)|*.SlaveExp|All files|*.*|"), ".SlaveExp", "", "");
	if (!filename)
		return;
	
	// creazione cartella di lavoro in temp
	var temp = MakeExportTempFolder();
	
	// esportazione dello slave (con estensione xml) e di tutti i templates usati da lui e dai figli, dentro temp
	slave.ExportToFile(temp + "\\" + m_fso.GetBaseName(filename) + ".xml");
	BackupAllUserTemplates(temp, slave);
	
	// creazione di uno zip con dentro tutto (dalla cartella temp)
	ZipFolderContents(temp, filename);
	
	m_fso.DeleteFolder(temp, true);
}

function ImportSlaveFromFile()
{
	var treepath = app.HMIGetCurElementPath(TREENAME);
	var destObj = FindECATObjFromTreepath(treepath);
	if (!destObj)
		return;
	
	var slavesList;
	if (IsECATMaster(destObj))
		slavesList = destObj.SlavesList;
	else if (IsECATSlaveList(destObj) || IsECATHotConnectGroup(destObj))
		slavesList = destObj;
	else
		return;
	
	// scelta file .slaveExp (che è in realtà uno zip)
	var filename = app.CallFunction("commonDLL.ShowOpenFileDlg", app.Translate("Slave Export files (*.SlaveExp)|*.SlaveExp|All files|*.*|"), ".SlaveExp", "");
	if (!filename)
		return;
	
	// creazione cartella di lavoro in temp
	var temp = MakeExportTempFolder();
	
	// scompatta lo zip dentro la cartella temp
	UnzipToFolder(filename, temp);
	
	// ripristina tutti i PCT se necessario come prima cosa
	RestoreAllUserTemplates(temp);
	
	try
	{
		// import da file .xml che era dentro lo zip
		var newSlave = m_ECATFactory.ImportSlaveFromFile(temp + "\\" + m_fso.GetBaseName(filename) + ".xml");
	}
	catch (ex)
	{
		if (ex.message)
			app.PrintMessage(ex.message);
			
		app.MessageBox(app.Translate("ERROR importing slave from file\nPlease check that you have all the necessary ESI files in your catalog"), "", gentypes.MSGBOX.MB_ICONERROR);
		return;
	}
	m_fso.DeleteFolder(temp, true);
	
	
	var result = slavesList.AddSlave(newSlave);
	
	if (!result && slavesList.LastResult == ECATSlavesListResult.InvalidName)
	{
		// se inserimento non andato a buon fine a causa del nome (probabilmente duplicato), lo resetta e riprova
		var oldName = newSlave.Name;
		newSlave.ResetName();
		result = slavesList.AddSlave(newSlave);
		if (result)
			app.PrintMessage(app.Translate("WARNING: Slave name was duplicated and has been resetted: ") + oldName);
	}
	
	if (!result)
	{
		app.MessageBox(app.Translate("Can not add this slave here:\n") + m_ECATSlavesListResultMsg[slavesList.LastResult], "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return;
	}

	AddECATSlaveToTree(treepath, newSlave, gentypes.enuOperationPos.opAppend);
}
