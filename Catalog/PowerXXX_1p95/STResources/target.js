// !!!! ATTENZIONE : file in comune tra LogicView2 e commissioning integrato !!!!

var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var gentypes = app.CallFunction("configurator.GetGeneralTypes")
var TREENAME = "tree1"

var IPA_SAVEPARAMETERS = 65103			//	Saving parameters
var IPA_RESETTARGET = 65104				//	Reset target	
var IPA_ALARMSTATUS = 65105				//	Alarm status	
var IPA_RESTOREDEFAULTS = 65107			//	Restore default parameters
var IPA_SETDEFAULTSATSTARTUP = 65108	//	Setta defaults dopo il download del plc


function Reset(device, quiet)
{	
		//	Controllo se device è definito
	if (!device)
		return false;

	var rebooted = false;
	
		//	salvo timeout
	var tmo = device.deviceLink.TimeOut
		
		// Scrittura del parametro di reset
	app.CallFunction("dllext.LockComm")
	try
	{
		device.deviceLink.Par(IPA_RESETTARGET, 0, gentypes.VARENUM.VT_UI1) = 1
	}
	catch (ex)
	{ }
	
		//	imposto nuovo timeout
	device.deviceLink.TimeOut = 500 	//	ms

	var i = 0
	var value = 0
		
		//	attende 10 s al massimo
	do
	{		
		try
		{	
			value = device.deviceLink.Par(IPA_RESETTARGET, 0, gentypes.VARENUM.VT_UI1)
		}
		catch (ex){}			
		
		i = i + 1
	}
	while ( value == 1 && i < 20 )
	
		//	ripristino timeout
	device.deviceLink.TimeOut = tmo;
	
		//	sblocca comunicazione
	app.CallFunction("dllext.UnlockComm")	
	
	if ( value == 0 )
		rebooted = true
	
	return rebooted
}

function SaveParams(device, quiet)
{	
		//	Controllo se device è definito
	if (!device)
		return false
		
	app.CallFunction("dllext.LockComm")
	try
	{
		device.deviceLink.Par(IPA_SAVEPARAMETERS, 0, gentypes.VARENUM.VT_UI1) = 1
	}
	catch (ex)
	{
		app.CallFunction("dllext.UnlockComm")
		return false
	}
	
	
	// tentativo di max 20s
	
	var msg = app.Translate("Saving parameters...")
	app.CallFunction("commonDLL.ShowWaitDlg", msg);
	var i = 0
	do
	{		
		try
		{
			value = device.deviceLink.Par(IPA_SAVEPARAMETERS, 0, gentypes.VARENUM.VT_UI1)
		}
		catch (ex){}
		
		i++
		app.CallFunction("commonDLL.sleep", 500)
	}
	while ( value == 1 && i < 40 )
		
	app.CallFunction("commonDLL.CloseWaitDlg")
	
	
	//	sblocca comunicazione
	app.CallFunction("dllext.UnlockComm")
	
	return value == 0
}

function RestoreDefaults(device, quiet)
{
	if (!device)
		return false

	var result = false
	
		// Scrittura del parametro di reset
	app.CallFunction("dllext.LockComm")
	
		//	salvo timeout
	var tmo = device.deviceLink.TimeOut
	
	try
	{
		device.deviceLink.Par(IPA_RESTOREDEFAULTS, 0, gentypes.VARENUM.VT_UI1) = 1
		result = true
	}
	catch (ex)
	{ }
	
	if ( !result )
	{
		app.CallFunction("dllext.UnlockComm")
		return false
	}
	
	/*	ASPETTO CHE VADA A ZERO */
	
		//	imposto nuovo timeout
	device.deviceLink.TimeOut = 500 	//	ms

	var i = 0
	var value = 1
		
		//	attende 10 s al massimo
	do
	{		
		try
		{
			value = device.deviceLink.Par(IPA_RESTOREDEFAULTS, 0, gentypes.VARENUM.VT_UI1)
		}
		catch (ex){}			
		
		i = i + 1
	}
	while ( value == 1 && i < 20 )
	
		//	ripristino timeout
	device.deviceLink.TimeOut = tmo;
	
		//	sblocca comunicazione
	app.CallFunction("dllext.UnlockComm")	
	
	if ( value == 0 )
		result = true

	return result
}

// doppio click sulla finestra "connection status"
function OnConnStatusDblClick(device)
{
	app.HMISetCurElement( TREENAME, device.GetTreePath() )
}

/*
	<alarm code="1" descr="Command error"/>
	<alarm code="2" descr=""/>
	<alarm code="3" descr=""/>
	<alarm code="4" descr=""/>
	<alarm code="5" descr=""/>
	<alarm code="6" descr=""/>
	<alarm code="7" descr=""/>
	<alarm code="8" descr=""/>
	<alarm code="9" descr=""/>
	<alarm code="10" descr=""/>
	<alarm code="11" descr=""/>
	<alarm code="12" descr=""/>
	<alarm code="13" descr=""/>
	<alarm code="14" descr=""/>
	<alarm code="15" descr=""/>
	<alarm code="16" descr=""/>
	<alarm code="17" descr=""/>
	<alarm code="18" descr=""/>
	<alarm code="19" descr=""/>
	<alarm code="20" descr=""/>
	<alarm code="21" descr=""/>
	<alarm code="22" descr=""/>
	<alarm code="23" descr=""/>
	<alarm code="24" descr=""/>
	<alarm code="25" descr=""/>
	<alarm code="26" descr=""/>
	<alarm code="27" descr=""/>
	<alarm code="28" descr=""/>
	<alarm code="29" descr=""/>
	<alarm code="30" descr=""/>
	<alarm code="31" descr=""/>
	<alarm code="32" descr=""/>
*/
function UpdateAlarmStatus(device)
{
	if (!device)
		return

	var alarmsIpa = device.template.settings.pollingIpa
	if ( !alarmsIpa )
		return
		
	var alarms = device.GetParValue_ipa( alarmsIpa );

	// i valori di alarmState corrispondono alle posizioni dell'array passato alla dllext.SetConnStatusAlarms in LogicView2.Init (partendo da 1)
	if ( alarms != 0 )
		device.alarmState = 3  // ALARM
	else
		device.alarmState = 1  // OK
}

// lettura versione alla connessione
/*
function OnConnect(device)
{
	if (!device || !device.deviceLink)
		return
		
	app.CallFunction("dllext.LockComm")
	try
	{
		var maj = device.deviceLink.Par(IPA_VER1, 0, gentypes.VARENUM.VT_UI2)
		var min = device.deviceLink.Par(IPA_VER2, 0, gentypes.VARENUM.VT_UI2)
		device.FirmwareVersion = { major:  maj, minor: min }
	}
	catch (ex)
	{ }
	app.CallFunction("dllext.UnlockComm")
}
*/
// ottiene l'elenco degli allarmi, leggendoli dal templatedata del device+applicazione specificato
// ritorna una mappa {code} = { descr }
function GetAlarms(deviceID, appID)
{
	var result = {}
	
	var alarmNode, subcodeNode
	
	var alarmNodes = app.GetTemplateData(deviceID + "_alarms/alarm")
	while (alarmNode = alarmNodes.nextNode())
	{
		var newitem = { descr: alarmNode.getAttribute("descr")  }
		
		result[ alarmNode.getAttribute("code") ] = newitem
	}
	
	return result
}

function OnBeforeDownloadPLC( device )
{
	if (!device)
		return false

	// in simulazione non fa nulla
	if (app.ExtensionExists("logiclab") && app.CallFunction("logiclab.get_SimulMode"))
		return true
	
	var msg = app.Translate( "Init database with default values?" )
	
	if (app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNO) == gentypes.MSGBOX.IDNO)
		return true
	
	if (!app.CallFunction("configurator.IsConnected"))
	{
		app.MessageBox(app.Translate("You must be connected to init database values"), "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return false
	}
	
	/*	SCRIVO UNO */
	
		// Scrittura del parametro di salvataggio parametri
	app.CallFunction("dllext.LockComm")
	
	var done = false
		
	try
	{
			//	setta parametro IPA_SETDEFAULTSATSTARTUP
		device.deviceLink.Par(IPA_SETDEFAULTSATSTARTUP, 0, gentypes.VARENUM.VT_UI1) = 1
		done = true
	}
	catch (ex)
	{
		app.MessageBox(app.Translate("ERROR initializing database with default values"), "", gentypes.MSGBOX.MB_ICONERROR);
	}
		
		//	sblocca comunicazione
	app.CallFunction("dllext.UnlockComm")	
	return done
}

function OnLoadTemplate(deviceTemplate, xml)
{
	LoadMotorsDB(deviceTemplate);	
}

function LoadMotorsDB(deviceTemplate)
{
	deviceTemplate.motorsDB = {};
	deviceTemplate.motorsDBInfo = {};

	var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + deviceTemplate.deviceID + "']")
	if (!nodelist || nodelist.length == 0)
		return

	var PCT = nodelist[0].getAttribute("template")
	var PCTpath = m_fso.GetParentFolderName(PCT)

	var motorsDBPath = app.CatalogPath + PCTpath + "\\..\\MotorsDB"
	if (!m_fso.FolderExists(motorsDBPath))
		return


	var folder = m_fso.GetFolder(motorsDBPath);
	if (!folder)
		return;

	for (var en = new Enumerator(folder.files); !en.atEnd(); en.moveNext())
	{
		var filepath = en.item().Path
		// file di informazioni DB
		if (m_fso.GetExtensionName(filepath).toLowerCase() == "csv")
		{
			var f = m_fso.OpenTextFile(filepath, gentypes.enuOpenTextFileModes.ForReading);
			var fContent = f.ReadAll();
			f.Close();

			var infoList = fContent.split("\n");
			if (!infoList || infoList.length < 2)
				return;

			var infoRow = infoList[1].split(",")
			var descr = infoRow[1].replace(/['"]+/g, '')

			deviceTemplate.motorsDBInfo = { version: infoRow[0], descr: descr }
		}
		else if (m_fso.GetExtensionName(filepath).toLowerCase() == "table")
		{

			var f = m_fso.OpenTextFile(filepath, gentypes.enuOpenTextFileModes.ForReading);
			var fContent = f.ReadAll();
			f.Close();

			var obj = null
			try
			{
				obj = JSON.parse(fContent);
			}
			catch (ex)
			{ continue }
			// motorCode obbligatorio in quanto chiave
			if (!obj || !obj.motor)
				continue;
			// il json ha un livello in piu, inutile qui
			var motorDBEntry = obj.motor
			var id = motorDBEntry.motorCode.value;
			if (!id)
				continue

			deviceTemplate.motorsDB[id] = motorDBEntry
		}
	}
}

function WriteMotorConfig(device, motorID, loadDefaultQuiet)
{
	var motorConfig = device.template.motorsDB[motorID];
	if (!motorConfig)
		return false;

	var resOK = true;
	var chkField = null;

	for (field in motorConfig)
	{
		var ipa = motorConfig[field].ipa;
		var value = motorConfig[field].value;
		var par = device.GetParTemplate(ipa);

		if (!par)
		{
			var msg = app.Translate("Write motor config ERROR parameter ipa:%1 name:%2 not found").replace("%1", ipa).replace("%2", field)
			app.PrintMessage(msg)

			resOK = false
			continue
		}

		if (field == "chkMot")
			chkField = motorConfig[field]

		if ((par.name != field))
		{
			var msg = app.Translate("Write motor config ERROR parameter ipa:%1 name:%2 not found. Found %3").replace("%1", ipa).replace("%2", field).replace("%3", par.name)
			app.PrintMessage(msg)

			resOK = false
			continue
		}

		var res = device.SetParValue(par, value, true);
		if (res != gentypes.enuSetParResult.sprOk && res != gentypes.enuSetParResult.sprNoChange)
		{
			var msg = app.Translate("Write motor config ERROR setting ipa:%1 value:%2").replace("%1", ipa).replace("%2", value)
			app.PrintMessage(msg)

			resOK = false
			continue
		}

		device.WritePar(ipa, true, false);
	}

	if (!resOK || chkField == null)
	{
		app.CallFunction("dllext.ResetWriteQueue")

		var msg = app.Translate("Write motor config ERROR writing config %1").replace("%1", motorID)
		app.PrintMessage(msg)
		return false;
	}

	app.CallFunction("configurator.WriteQueuedParameters")
	resOK = app.CallFunction("dllext.GetProgressActionResult")
	
	app.CallFunction("dllext.PausePollingThread")
	app.CallFunction("dllext.PauseRefreshThread")

	// richiesta di load default
	var msg = app.Translate("Do you want to load default parameters?");
	if (loadDefaultQuiet || app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONQUESTION | gentypes.MSGBOX.MB_YESNO) == gentypes.MSGBOX.IDYES)
	{
		device.SetParValue_ipa(IPA_MOTOR_LOAD_DEFAULT, 1, true);
		device.WritePar(IPA_MOTOR_LOAD_DEFAULT, false, false);
	}	

	// scrittura di parametro di "commit", che scatena i controlli sul fw e il calcolo della checksum
	device.SetParValue_ipa(IPA_MOTORCODE, motorID, true);
	device.WritePar(IPA_MOTORCODE, false, false);

	// in attesa di un secondo per leggere eventuale allarme e checksum calcolato dal fw
	var msg = app.Translate("Waiting for drive confirm...");
	app.CallFunction("commonDLL.ShowWaitDlg", msg);

	app.CallFunction("commonDLL.sleep", 1000)

	app.CallFunction("commonDLL.CloseWaitDlg")
	
	app.CallFunction("dllext.RunPollingThread")
	app.CallFunction("dllext.RunRefreshThread")

	// verifica presenza di allarme "missing motor table" nel bit 3 della maschera allarmi
	device.ReadPar(IPA_DRIVE_ALARM, false, true);
	var value = device.GetParValue_ipa(IPA_DRIVE_ALARM);
	var missingMotorTableAlarm = (((parseInt(value) >> 3) & 1) != 0) ? true : false;
	if (missingMotorTableAlarm)
	{
		var msg = app.Translate("Write motor config ERROR missing motor table")
		app.PrintMessage(msg)
		return false;
	}

	// verifica checksum fw contro checksum della config motore
	device.ReadPar(IPA_MOTOR_CHECKSUM, false, true);
	var value = device.GetParValue_ipa(IPA_MOTOR_CHECKSUM);

	// confronto checksum fw con checksum del motore
	if (value != chkField.value)
	{
		var msg = app.Translate("Write motor config ERROR on checksum read:%1 expected:%2").replace("%1", value).replace("%2", chkField.value)
		app.PrintMessage(msg)
		resOK = false;
	}
	else
	{
		// tutto ok, salvataggio parametri su eeprom
		var msg = app.Translate("Waiting for drive saving parameters...");
		app.CallFunction("commonDLL.ShowWaitDlg", msg);
		resOK = SaveParams(device, false);
		app.CallFunction("commonDLL.CloseWaitDlg")
	}

	if (resOK)
	{
		var msg = app.Translate("Motor config applied successfully.")
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONINFORMATION);
	}

	return resOK;
}

var ACC_LEVEL = {
	NORMAL: 0,
	SUPERVISOR: 1,
	EXPERT: 2
}

function onSetAccessLevel(device, newLevel)
{
	var par = device.template.parMap[10]; // P00.03 - MotorControlType : Normal -> Supervisor: Togliere 0-1-4-5
	if (par)
	{
		par.enumId = (newLevel == ACC_LEVEL.NORMAL) ? 1002 : 2;

		//NB: se il valore corrente non è nell'enum, lo aggiusto con il minino dell'enum ?????
		var currValue = device.GetParValue(par);
		var enumValues = device.GetEnum(par.enumId)
//		if (enumValues[currValue] == null)
//		{
//
//			var minValue = Number.MAX_VALUE
//			for (var value in enumValues)
//				minValue = Math.min(parseInt(value), minValue)

//			device.SetParValue(par, minValue, true);

//			var msg = genfuncs.FormatMsg(app.Translate("Parameter '%1' value resetted to: %2"), par.name, enumValues[minValue].descr);
//			app.PrintMessage(msg)
//		}
	}


	par = device.template.parMap[31]; // P01.04 - Maximum Current : Normal -> Supervisor: da RO a RW
	if (par)
		par.readOnly = (newLevel == ACC_LEVEL.NORMAL) ? true : false;
}