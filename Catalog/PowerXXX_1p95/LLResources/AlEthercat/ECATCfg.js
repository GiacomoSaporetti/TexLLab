// IPAs reserved for plugins configuration checksums (da LLExecReservedParameters.h)
var LLIPA_CFGID_ETHERCAT			= 65215;
var LLIPA_CFGID_ETHERCAT_ENI		= 65216;

var m_globalGroupName = "EtherCAT mappings";    // nome del gruppo per le var PLC create al volo

var ASSIGN_MODE = {
	TO_DATABLOCK: 0,
	TO_ANY: 1,
	TO_UNSPECIFIED: 2
};

var m_EtherCATConf_Filename = "EtherCAT.conf";
var m_EtherCATENIXml_Filename = "EtherCAT_ENI.xml";

// assegnamento a variabili con unspecified address (nuova modalità) o su datablock (vecchia modalità)
var m_AssignMode = ASSIGN_MODE.TO_DATABLOCK;

function SetAssignMode(value)
	{ m_AssignMode = value; }

// supporto del DC da parte del master su questo target (tipicamente richiede feature real-time del SO)
var m_DCSupported = true;

function SetDCSupported(val)
	{ m_DCSupported = val; }


function Init()
{
	// mappature PDO entry disabilitate, come in ECATLab!
	//m_AttachECATCtrlHandlers_func = AttachECATCtrlHandlers;
	
	// local+remote
	m_ECATMaster_GUI_OnlineModeEnableFlags = 1+4;
}

function Terminate()
{
	DeleteECATFactory()
}

// cartella che conterrà tutti i files .conf: è la cartella 'download' in modo da raggruppare tutti i files scaricabili
function GetConfDir()
{
	var dir = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath")) + "\\Download\\";
	return dir;
}

function GetBuildDir()
{
	var dir = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath")) + "\\Build\\";
	return dir;
}

function SetConfFilenames(ethercatConf, eniXml)
{
	m_EtherCATConf_Filename = ethercatConf;
	m_EtherCATENIXml_Filename = eniXml;
}

function GetEtherCATFileName()
{
	return GetConfDir() + m_EtherCATConf_Filename;
}

function GetEtherCAT_ENI_FileName()
{
	return GetBuildDir() + m_EtherCATENIXml_Filename;
}

function GetConfigurationFileIPA()
{
	return LLIPA_CFGID_ETHERCAT;
}

function GetENIFileIPA()
{
	return LLIPA_CFGID_ETHERCAT_ENI;
}

function AlEtherCAT_LoadEtherCATProject(device)
{
	// se nuovo progetto, inizialmente disabilitato
	var result = LoadEtherCATProject(device, false);
	if (result)
	{
		var master = m_ECATPrj.GetMaster(0);
		SetECATMasterFastPeriod(master);
		
		// solo modalità local, c'è una sola Ethernet sulla scheda
		//SetCommString(master, app.CallFunction("logiclab.get_CommString"));
		
		master.DCSupported = m_DCSupported;
	}
	
	return result;
}

function BuildCfg_EtherCAT(device, mappedVars)
{
	var FUNCNAME = "BuildCfg_EtherCAT";
	
	function SaveVar(listRoot, entry)
	{
		var dbmapNode = listRoot.appendChild(xmldoc.createElement("dbmap"));
		dbmapNode.setAttribute("ENIName", entry.FullNameUnique)
		
		var label = entry.PLCVariable;
		var varInfo = DecodePLCVarInfo(entry.PLCVariableInfo);
	
		var isComplex = app.CallFunction("script.IsComplexVar", label)
		if (!isComplex && m_AssignMode == ASSIGN_MODE.TO_DATABLOCK)
			var PLCvar = mappedVars[label]
		else
			// NB: la FindSymbol cerca nella symbol table, quindi la var deve essere usata nel progetto, altrimenti non esiste
			var PLCvar = app.CallFunction("logiclab.FindSymbol", label, "")
	
		var iecType = GetPLCTypeFromECATType(entry.DataType, entry.BitLen);
		if (!iecType)
		{
			var msg = genfuncs.FormatMsg(FUNCNAME + ": skipped variable '%1': type '%2' is unsupported", entry.FullNameUnique, entry.DataType)
			app.PrintMessage(msg)
			return false
		}
		
		if (!PLCvar)
		{
			// variabile PLC cancellata
			if (m_AssignMode == ASSIGN_MODE.TO_DATABLOCK)
				var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has been deleted or changed to 'Auto' allocation"), label);
			else
				var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 not found"), label);
			
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, GetLogErrFromPDOEntry(entry))
		}
		else if (PLCvar.type != varInfo.type)
		{
			// variabile PLC modificata nel tipo
			var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has been modified in type"), label)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, GetLogErrFromPDOEntry(entry))
		}
		else if (!ECATCompareDatablocks(PLCvar.DataBlock, varInfo.datablock))
		{
			// variabile PLC modificata nell'allocazione
			var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has been modified in datablock allocation"), label)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, GetLogErrFromPDOEntry(entry))
		}
		
		var arraySize = GetArraySizeFromECATType(entry.DataType);
		if (arraySize)
		{
			var vsize = app.CallFunction("PLCVars.GetPLCVarSize", PLCvar);
			if (vsize != arraySize)
			{
				// variabile PLC array ridimensionata
				var errmsg = genfuncs.FormatMsg(app.Translate("Invalid assignment: Variable %1 has an invalid array size"), label)
				throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, errmsg, GetLogErrFromPDOEntry(entry))
			}
		}

		if (IsMappedDatablock(varInfo.datablock))
		{
			// vecchia versione con indirizzo datablock
			var db = app.CallFunction("common.ParseDataBlock", varInfo.datablock)
			dbmapNode.setAttribute("dbtype", db.area)
			dbmapNode.setAttribute("dbnum", db.datablock)
			dbmapNode.setAttribute("dboff", db.offset)
			
			if (isComplex)
			{
				// chiama funzione dell'estensione principale
				var funcname = app.CallFunction("logiclab.get_TargetID") + ".GetComplexVarOffset";
				var offset = app.CallFunction(funcname, PLCvar, undefined);
				dbmapNode.setAttribute("dbByteOffset", offset);
			}
		}
		else
			// altrimenti risoluzione tramite nome e LLSymbols (sia auto che unspec)
			dbmapNode.setAttribute("label", label);
		
		dbmapNode.setAttribute("bitlen", entry.BitLen);
		return true;
	}
	
	try
	{
		var master = m_ECATPrj.GetMaster(0);
		if (!master.Enabled)
		{
			// crea file conf e eni vuoti da scaricare
			//CreateEmptyFile(GetEtherCATFileName())
			CreateEmptyFile(GetEtherCAT_ENI_FileName())
			return true;
		}

		// se c'è aperta la finestra del configuratore ethercat, si accerta di uscire dall'editing di textbox selezionate
		if (app.GetCurrentWindowName() == "ECATCtrl")
			app.CallFunction("ECATCtrl.CommitPendingEditing")
		
		// riaggiorna ogni volta il periodo del task fast, nel mentre potrebbe essere stato variato
		SetECATMasterFastPeriod(master);
		
		var ecatErr = master.Validate();
		if (ecatErr && ecatErr.Code != ECATErrorCode.OK)
			throw app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, FUNCNAME, ecatErr.ToString(), GetLogErrFromECATError(ecatErr))
		
		// generazione file ENI (lo fa direttamente la libreria ECATCfg)
		master.WriteENI(GetEtherCAT_ENI_FileName());
		
		var msg = app.Translate("%1: created EtherCAT Master cfg");
		app.PrintMessage(genfuncs.FormatMsg(msg, device.getAttribute("caption")));
		
		
		/*
		// DISABILITATO: generazione file XML ausiliario con le sole mappature, ad uso LLExec
		var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0");
		xmldoc.appendChild(xmldoc.createProcessingInstruction("xml", "version='1.0' encoding='UTF-8'"));
		
		var rootNode = xmldoc.appendChild(xmldoc.createElement("ethercatconfig"));
		// aggiunge l'attributo SyncShiftTimePercent e DivergenceThreshold che è gestito a parte dal master, non finisce nell'ENI!
		rootNode.setAttribute("SyncShiftTimePercent", master.SyncShiftTimePercent)
		rootNode.setAttribute("DivergenceThreshold", master.DivergenceThreshold)
		rootNode.setAttribute("AcyclicFramesMinPeriod", master.AcyclicFramesMinPeriod)
		
		var inputsNode = rootNode.appendChild(xmldoc.createElement("inputs"));
		var outputsNode = rootNode.appendChild(xmldoc.createElement("outputs"));
		
		// converte SAFEARRAY di ECATSlave in SAFEARRAY di variant (l'unico gestito da JS)
		var safeArr = app.CallFunction("commonDLL.ConvertToSafeArrayOfVariant", master.GetAllEnabledSlaves())
		var allSlaves = genfuncs.FromSafeArray(safeArr);
		
		for (var i = 0; i < allSlaves.length; i++)
		{
			var slave = allSlaves[i];
			for (var j = 0; j < slave.PDOCount; j++)
			{
				var pdo = slave.GetPDO(j);
				if (!pdo.Sm)
					continue;  // salta pdo senza sm associato, ovvero non mappati sul frame ciclico!
				
				for (var k = 0; k < pdo.PDOEntriesCount; k++)
				{
					var entry = pdo.GetPDOEntry(k);
					if (entry.PLCVariable)
					{
						if (pdo.Direction == ECATPDODirection.Tx)
							SaveVar(inputsNode, entry)
						else if (pdo.Direction == ECATPDODirection.Rx)
							SaveVar(outputsNode, entry)
					}
				}
			}
		}
		
		// salva il file conf insieme al progetto
		xmldoc.save(GetEtherCATFileName());
		
		var msg = app.Translate("%1: created EtherCAT Master cfg (%2 input vars, %3 output vars)");
		app.PrintMessage(genfuncs.FormatMsg(msg, device.getAttribute("caption"), inputsNode.childNodes.length, outputsNode.childNodes.length));
		*/
		return true;
	}
	catch (ex)
	{
		// poichè questa funzione è stata chiamata con app.CallFunction, il try/catch del chiamante non funziona. ritorna quindi l'oggetto exception come valore di ritorno della funzione,
		// e il chiamante deve rifarne la throw per interrompere la compilazione
		return ex
	}
}



// richiede l'extension PLCVars caricata nel PCT !!!
// normalmente common\script\plcvars.js è incluso nelle pagine html, ma EtherCAT ha bisogno di chiamarlo da script interno!
var PLCVARS_CONSTANTS = app.CallFunction("PLCVars.GetConstants");

// costruzione stringa da salvare dentro ECATPDOEntry.PLCVariableInfo
function EncodePLCVarInfo(plcVar)
{
	return plcVar.Datablock + "," + plcVar.Type;
}

function DecodePLCVarInfo(s)
{
	var arr = s.split(",");
	return { datablock: arr[0], type: arr[1] };
}

// handler collegato ai due bottoni di 'assign' nel controllo dell'ECATSlave
function OnPDOEntryAssign(sender, entry, param)
{
	if (!entry)
		return;
	
	var iecType = GetPLCTypeFromECATType(entry.DataType, entry.BitLen);
	if (!iecType)
	{
		var msg = genfuncs.FormatMsg("Variable type '%1' is unsupported", entry.DataType);
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return;
	}
	
	if (m_AssignMode == ASSIGN_MODE.TO_DATABLOCK)
	{
		// chiama funzione dell'estensione principale
		var funcname = app.CallFunction("logiclab.get_TargetID") + ".GetIODataBlockName";
		var dataBlock = app.CallFunction(funcname, "EtherCAT", entry.IsInput, iecType);
		var flags = 0;
	}
	else if (m_AssignMode == ASSIGN_MODE.TO_ANY)
	{
		var dataBlock = null;
		var flags = PLCVARS_CONSTANTS.PLCVARASSIGN_CHECKVARUSAGES | 
			(entry.IsInput ? PLCVARS_CONSTANTS.PLCVARASSIGN_ALLOWUNSPEC_I : PLCVARS_CONSTANTS.PLCVARASSIGN_ALLOWUNSPEC_Q);
	}
	else if (m_AssignMode == ASSIGN_MODE.TO_UNSPECIFIED)
	{
		var dataBlock = null;
		var flags = PLCVARS_CONSTANTS.PLCVARASSIGN_CHECKVARUSAGES | PLCVARS_CONSTANTS.PLCVARASSIGN_ONLYUNSPEC | 
			(entry.IsInput ? PLCVARS_CONSTANTS.PLCVARASSIGN_ALLOWUNSPEC_I : PLCVARS_CONSTANTS.PLCVARASSIGN_ALLOWUNSPEC_Q);
	}
	
	var arraySize = GetArraySizeFromECATType(entry.DataType);
	if (arraySize)
	{
		iecType += "[" + arraySize + "]";
		flags |= PLCVARS_CONSTANTS.PLCVARASSIGN_ALLOWARRAYS | PLCVARS_CONSTANTS.PLCVARASSIGN_SAMEARRAYSIZE;
	}
	
	var plcVar = app.CallFunction("PLCVars.AssignPLCVar_raw", iecType, dataBlock, entry.PLCVariable, flags, PLCVARS_CONSTANTS.PLCVARTYPES_SAMESIZE);
	if (!plcVar)
		return;

	entry.PLCVariable = plcVar.Name;
	entry.PLCVariableInfo = EncodePLCVarInfo(plcVar);
}

function IsMappedDatablock(db)
{
	return db != "" && db != "Auto" && !app.CallFunction("PLCVars.IsUnspecifiedAddress", db);
}

// handler collegato ai due bottoni di 'unassign' nel controllo dell'ECATSlave
function OnPDOEntryUnassign(sender, entry, param)
{
	if (!entry || !entry.PLCVariable)
		return;
	
	if (!app.CallFunction("script.CheckGlobalVarsModified"))
		return;
	
	var varName = entry.PLCVariable;
	var varInfo = DecodePLCVarInfo(entry.PLCVariableInfo);

	entry.PLCVariable = "";
	entry.PLCVariableInfo = "";
	
	if (IsMappedDatablock(varInfo.datablock))
		// disassegna la variabile, da mappata la riporta ad auto
		if (app.CallFunction("script.CanUnassignPLCVar", varName, 0))
			app.CallFunction("script.UnassignPLCVar", varName)
}

function IsPLCVarMappedOnEtherCAT(varName)
{
	return m_ECATPrj.IsPLCVarUsed(varName);
}

function GetAllUsedPLCVars()
{
	// converte SAFEARRAY di stringhe in SAFEARRAY di variant (l'unico gestito da JS)
	var safeArr = app.CallFunction("commonDLL.ConvertToSafeArrayOfVariant", m_ECATPrj.GetAllUsedPLCVars())
	return genfuncs.FromSafeArray(safeArr);
}

function RefactorECAT(oldName, newName)
{
	return m_ECATPrj.RefactorPLCVar(oldName, newName);
}

// handler collegato alla griglie di editing della mappature, sulla conferma della cella
function OnPDOEntryPLCVarEdit(sender, entry, newText)
{
	if (!entry)
		return;
	
	var iecType = GetPLCTypeFromECATType(entry.DataType, entry.BitLen);
	if (!iecType)
	{
		var msg = genfuncs.FormatMsg("Variable type '%1' is unsupported", entry.DataType);
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return;
	}
	
	if (m_AssignMode == ASSIGN_MODE.TO_DATABLOCK)
	{
		// chiama funzione dell'estensione principale
		var funcname = app.CallFunction("logiclab.get_TargetID") + ".GetIODataBlockName";
		var dataBlock = app.CallFunction(funcname, "EtherCAT", entry.IsInput, iecType);
		var flags = 0;
	}
	else if (m_AssignMode == ASSIGN_MODE.TO_ANY)
	{
		var dataBlock = "";  // permette creazione di nuova var auto
		var flags = (entry.IsInput ? PLCVARS_CONSTANTS.PLCVARASSIGN_ALLOWUNSPEC_I : PLCVARS_CONSTANTS.PLCVARASSIGN_ALLOWUNSPEC_Q);
	}
	else if (m_AssignMode == ASSIGN_MODE.TO_UNSPECIFIED)
	{
		var dataBlock = null;
		var flags = PLCVARS_CONSTANTS.PLCVARASSIGN_ONLYUNSPEC | (entry.IsInput ? PLCVARS_CONSTANTS.PLCVARASSIGN_ALLOWUNSPEC_I : PLCVARS_CONSTANTS.PLCVARASSIGN_ALLOWUNSPEC_Q);
	}
	
	
	var arraySize = GetArraySizeFromECATType(entry.DataType);
	if (arraySize)
	{
		iecType += "[" + arraySize + "]";
		flags |= PLCVARS_CONSTANTS.PLCVARASSIGN_ALLOWARRAYS | PLCVARS_CONSTANTS.PLCVARASSIGN_SAMEARRAYSIZE;
	}
	
	// !!! anche se la ModifyPLCVarAssigment_raw fa già parte di queste operazioni, è necessario farle lo stesso qui,
	// poichè altrimenti non sarebbe possibile disassegnare correttamente la var cancellando il testo
	
	var oldPLCVar = entry.PLCVariable;
	if (oldPLCVar === undefined || oldPLCVar === null)
		oldPLCVar = "";
	
	// se nessuna modifica esce
	if (newText == oldPLCVar)
		return;
		
	// se variabili globali già modificate e non salvate non permette l'operazione
	if (!app.CallFunction("script.CheckGlobalVarsModified"))
		return;
	
	// se nome non specificato (ovvero si è cancellato il contenuto) disassegna tutto e basta
	if (newText == "")
	{
		OnPDOEntryUnassign(sender, entry, null);
		return "";
	}
	
	var plcVar = app.CallFunction("PLCVars.ModifyPLCVarAssigment_raw", newText, iecType, PLCVARS_CONSTANTS.PLCVARTYPES_SAMESIZE, dataBlock, oldPLCVar, flags, m_globalGroupName)
	if (!plcVar)
		return;

	// il nome della variabile sarà inserito in entry.PLCVariable dalla DataGrid stessa
	entry.PLCVariableInfo = EncodePLCVarInfo(plcVar);
	return plcVar.Name;
}

function SetECATMasterFastPeriod(master)
{
	var fastPeriodMs = app.CallFunction("logiclab.get_TaskPeriod", "Fast");
	master.DefaultTaskCycleTime = parseInt(fastPeriodMs * 1000);
	//master.DefaultTaskCycleTime = 4000;  // debug, default twincat
}

// ---------- aggancio handler in js al controllo ECATMaster o ECATSlave : hanno gli eventi OnPLCVarAssign/OnPLCVarUnassign/OnPLCVarEdit
// poichè il configuratore EtherCAT necessita delle mappature di var PLC, ma non conosce nulla di LogicLab
function AttachECATCtrlHandlers()
{
	// aggancia funzioni js ai bottoni "assign"
	var handler = app.CallFunction("ECATCtrl.CreatePLCVarEdit2JSFuncHandler", OnPDOEntryAssign)
	app.CallFunction("ECATCtrl.AddCtrlEventHandler", null, "OnPLCVarAssign", handler)
	
	// aggancia funzioni js ai bottoni "unassign"
	var handler = app.CallFunction("ECATCtrl.CreatePLCVarEdit2JSFuncHandler", OnPDOEntryUnassign)
	app.CallFunction("ECATCtrl.AddCtrlEventHandler", null, "OnPLCVarUnassign", handler)
	
	// aggancia funzioni js all'evento di fine editing griglia
	var handler = app.CallFunction("ECATCtrl.CreatePLCVarEdit2JSFuncHandler", OnPDOEntryPLCVarEdit)
	app.CallFunction("ECATCtrl.AddCtrlEventHandler", null, "OnPLCVarEdit", handler)
}

// msg di settaggio commstring da LogicLab
function OnMessage_ConfigComm(msgid, newcommstring)
{
	var master = m_ECATPrj.GetMaster(0);
	SetCommString(master, newcommstring);
}

	// propaga la commstring attuale di logiclab dentro ecatcfg
function SetCommString(master, newcommstring)
{
	master.ExternalCommString = newcommstring;
	
	if (master.OnlineCommConf)
	{
		if (master.OnlineMode == ECATOnlineMode.ecatOnlineGateway)
		{
			var commstr = app.CallFunction("common.SplitCommString", newcommstring);
			master.OnlineCommConf = commstr.address + ":" + ECATONLINE_GATEWAY_PORT;
		}
		else if (master.OnlineMode == ECATOnlineMode.ecatOnlineRemote)
			master.OnlineCommConf = newcommstring;
	}
}

function GetMaster()
{
	return m_ECATPrj.GetMaster(0);
}

function GetAllEnabledSlaves()
{
	var master = GetMaster();
	var safeArr = app.CallFunction("commonDLL.ConvertToSafeArrayOfVariant", master.GetAllEnabledSlaves())
	var allSlaves = genfuncs.FromSafeArray(safeArr);
	return allSlaves;
}

#include ECATCfg_common.js
