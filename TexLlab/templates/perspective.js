var WM_COMMAND = 0x0111;

// da LogicLab\resource.h
var LL_RES = {
	IDR_MAINFRAME:    117,
	IDM_COMPILE:      32878,
	IDM_DOWNLOADCODE: 32779,
	IDM_NEWPRJ:       32794,
	IDM_OPENPRJ:      32777,
	IDM_SAVEPRJ:      32789
};

// da PageLab\resource.h
var PL_RES = {
	IDM_COMPILE_IEC:         36104,
	IDM_IEC_DOWNLOADPROJECT: 36071
};

// nomi delle perspective come definite in Perspective.PCT
var PERSPECTIVE = {
	CONFIGURATION: "Configuration",
	PLC: "PLC",
	HMI: "HMI",
	COMMISSIONING: "Commissioning"
};


function Init(intf)
{
	// rimuove dalla toolbar principale di LL i comandi già presenti sulla toolbar principale della perspective
	app.CallFunction("extfunct.ToolbarRemoveButton", LL_RES.IDR_MAINFRAME, LL_RES.IDM_NEWPRJ);
	app.CallFunction("extfunct.ToolbarRemoveButton", LL_RES.IDR_MAINFRAME, LL_RES.IDM_OPENPRJ);
	app.CallFunction("extfunct.ToolbarRemoveButton", LL_RES.IDR_MAINFRAME, LL_RES.IDM_SAVEPRJ);
	return 1;
}

function Terminate()
{
	// ri-aggiunge i bottoni cancellati in apertura, per tornare alla situazione standard
	app.CallFunction("extfunct.ToolbarAddButton", LL_RES.IDR_MAINFRAME, LL_RES.IDM_NEWPRJ, 0);
	app.CallFunction("extfunct.ToolbarAddButton", LL_RES.IDR_MAINFRAME, LL_RES.IDM_OPENPRJ, 1);
	app.CallFunction("extfunct.ToolbarAddButton", LL_RES.IDR_MAINFRAME, LL_RES.IDM_SAVEPRJ, 2);
}

function OnLoad(filename)
{
	// legge la perspective attiva, che è quella che è stata salvata e ripristinata all'apertura del progetto
	var curPerspective = app.BarStateSection;
	//app.PrintMessage("curPerspective: " + curPerspective);
	
	if (curPerspective == PERSPECTIVE.CONFIGURATION)
		// apre la finestra principale del target corrente della perspective "Configuration" all'avvio (NB deve chiamarsi "main")
		app.OpenWindow("main", "", "/*[@IsRootDevice]")
	else if (curPerspective == PERSPECTIVE.COMMISSIONING)
		// apre la finestra principale del target corrente della perspective "Commissioning" all'avvio (NB deve chiamarsi "commissioning_main")
		app.OpenWindow("commissioning_main", "", "/*[@IsRootDevice]")
		
	// se invece sono attive altre perspective, non apre nulla!
}

function OnMessage_CreateNewProject(msgid, data)
{
	// subito dopo aver creato il nuovo progetto switcha alla perspective di default (sarà "Configuration")
	// essendo la prima apertura non serve salvare la perspective precedente ne switchare documenti
	app.SetPerspective("", false, false);
}

function OnCompileKey()
{
	var curPerspective = app.BarStateSection;
	if (curPerspective == PERSPECTIVE.CONFIGURATION || curPerspective == PERSPECTIVE.PLC)
		// solo se perspective configuration o plc attiva, F7 è la compilazione del PLC
		app.SendWindowsMessage(WM_COMMAND, LL_RES.IDM_COMPILE, 0, false);
	else if (curPerspective == PERSPECTIVE.HMI)
		// solo se perspective hmi attiva, F7 è la compilazione del HMI
		app.SendWindowsMessage(WM_COMMAND, PL_RES.IDM_COMPILE_IEC, 0, false);
}

function OnDownloadKey()
{
	var curPerspective = app.BarStateSection;
	if (curPerspective == PERSPECTIVE.CONFIGURATION || curPerspective == PERSPECTIVE.PLC)
		// solo se perspective configuration o plc attiva, F5 è il download del PLC
		app.SendWindowsMessage(WM_COMMAND, LL_RES.IDM_DOWNLOADCODE, 0, false);
	else if (curPerspective == PERSPECTIVE.HMI)
		// solo se perspective hmi attiva, F5 è il download del HMI
		app.SendWindowsMessage(WM_COMMAND, PL_RES.IDM_IEC_DOWNLOADPROJECT, 0, false);
}
