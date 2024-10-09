// lista files da scaricare
var m_downloadList = []
// flag che memorizza se il PLC è stato arrestato prima del download
var m_RuntimeStatus_PLCStopped = false

var m_downloadFileFuncName = "GDBFileTransfer.PacketCopyFileToDevice";

// ----------------------------------------- gestione scaricamento files sul target -------------------------------
/*function CustomDownload(device, phase, errcode)
{
	if (phase == COMPILATIONPHASE.PREDOWNLOAD)
		PreDownload(device)
	else if (phase == COMPILATIONPHASE.POSTDOWNLOAD)
		PostDownload(device, errcode)
		
	return enuLogLevels.LEV_OK
}*/

function DownloadFileAsync(devlink, src, dest)
{
	// se presente RunFunctionWithDlg in AlFramework (da LogicLab >= 5.14.0.10) usa quella per esecuzione in thread separato per non freezare la GUI
	if (app.FunctionExists("commonDLL.RunFunctionWithDlg"))
	{
		var caption = app.Translate("Downloading ") + dest + " ...";
		return app.CallFunction("commonDLL.RunFunctionWithDlg#N", caption, m_downloadFileFuncName, devlink, src, dest);
	}
	else
		return app.CallFunction(m_downloadFileFuncName, devlink, src, dest);
}

function CallFunctionAsync(caption, funcName)
{
	if (app.FunctionExists("commonDLL.RunFunctionWithDlg"))
		return app.CallFunction("commonDLL.RunFunctionWithDlg#N", caption, funcName);
	else
		return app.CallFunction(funcName);
}

function PreDownload(device)
{
	// non scarica i file se in simulazione
	if (app.CallFunction("logiclab.get_SimulMode"))
		return true

	// ottiene l'interfaccia IDeviceLink attiva da logiclab
	var devlink = app.CallFunction("logiclab.GetDeviceLink")
	if (!devlink)
		return false

	// flag che indica se il riavvio è richiesto (ovvero almeno un file diverso)
	var restartRequired = false
	
	for (var i = 0; i < m_downloadList.length; i++)
	{
		var src = m_downloadList[i]
		var dest = m_fso.GetFileName(src.filename)
		var doDownload = true
		
		// se questo file ha il parametro di checksum fa la verifica
		if (src.checksumIpa)
		{
			var oldChecksum = undefined
			var newChecksum = undefined
			try
			{
				// legge dal target il vecchio checksum tramite apposito parametro
				oldChecksum = devlink.ParDWord(src.checksumIpa, 0)
				// calcolo nuovo checksum tramite CRC32 letto da file locale
				newChecksum = app.CallFunction("commonDLL.CalcCRC32ForFile", src.filename)
			}
			catch (ex)
			{
				// errore di lettura, log dell'errore ma scarica cmq
				// il plugin probabilmente non è attivo (quindi non c'è il par nel DB), quindi non richiede riavvio!
				app.PrintMessage("ERROR reading current checksum for " + dest + ", IPA " + src.checksumIpa)
			}
			
			// se entrambi i checksum sono validi e coincidenti NON scarica
			if (newChecksum != undefined && oldChecksum != undefined)
			{
				if (newChecksum == oldChecksum)
				{
					app.PrintMessage("Cfg file " + dest + " is unchanged, not downloaded")
					doDownload = false
				}
				else
					restartRequired = true
			}
		}
		else
		{
			// questo file non supporta checksum; assume che il riavvio NON sia richiesto (o manuale)
			// restartRequired = true
		}
		
		if (doDownload)
		{
			var result = DownloadFileAsync(devlink, src.filename, dest);
			app.PrintMessage("Downloading file " + dest + " : " + (result ? "OK" : "FAILED"))
		}
	}
	
	// se flag di downloadSymTab attivo la scarica ora, visto che c'è già la connessione attiva!
	//var downloadSymTab = genfuncs.ParseBoolean(genfuncs.GetNode(device, "config/downloadSymbolTable"))
	var downloadSymTab = false; // sempre abilitato per LLSymbolServer con nome fisso PLC.sym.xml
	if (downloadSymTab)
	{
		var symtab = GetSymbolTableFilename();
		
		var result = DownloadFileAsync(devlink, symtab, GetSymbolTableNameOnTarget());
		app.PrintMessage("Downloading Symbol table : " + (result ? "OK" : "FAILED"))
	}
	
	
	// rilascia reference al devicelink e unlock della comunicazione (logiclab fa lock nella GetDeviceLink()!)
	devlink = undefined
	CollectGarbage()  // chiama subito il gc per forzare la release del devicelink
	app.CallFunction("logiclab.UnlockComm")
	
	
	m_RuntimeStatus_PLCStopped = false
	
	if (restartRequired)
	{
		// se cfg cambiata chiede se riavviare il PLC per apportare le modifiche
		var msg = app.Translate("Configuration has changed, you need to reboot the PLC runtime to apply changes.\nReboot automatically now?")
		if (app.CallFunction("logiclab.get_SuppressQuestions") || app.MessageBox(msg, "", gentypes.MSGBOX.MB_YESNO|gentypes.MSGBOX.MB_ICONQUESTION) == gentypes.MSGBOX.IDYES)
		{
			CallFunctionAsync(app.Translate("Stopping PLC ..."), "logiclab.RuntimeStatus_StopPLC")
			app.PrintMessage("PLC runtime stopped")
			m_RuntimeStatus_PLCStopped = true
		}
	}
	
	return true
}

function PostDownload(device, errcode)
{
	if (m_RuntimeStatus_PLCStopped)
	{
/*		
		// se il PLC era stato arrestato in precedenza lo riavvia
		// prova con il nuovo metodo RebootTarget, se fallisce (non implementato o supportato sul target) usa il vecchio
		CallFunctionAsync(app.Translate("Rebooting PLC ..."), "logiclab.RebootTarget");
		app.CallFunction("commonDLL.sleep", 100);
		// manda cmq il comando di PLC_C_START (anche se tipicamente su LLExec non è implementato) giusto per essere sicuro che il reboot sia terminato:
		// il comando verrà infatti gestito dalla manage solo quando la sequenza di restart è terminata completamente
		CallFunctionAsync(app.Translate("Starting PLC ..."), "logiclab.RuntimeStatus_StartPLC")

		app.PrintMessage("PLC runtime started")
*/
		m_RuntimeStatus_PLCStopped = false
	}
}

// aggiunta alla lista dei download di un file e del suo IPA per verifica checksum
function DownloadListAdd(filename, checksumIpa)
{
	var item = { filename: filename, checksumIpa: checksumIpa }
	m_downloadList.push(item)
}

function EmptyDownloadList()
{
	m_downloadList = []
}

function DownloadListRemove(filename)
{
	for (var i = 0; i < m_downloadList.length; i++)
	{
		if (m_downloadList[i].filename == filename)
		{
			m_downloadList.splice(i, 1);
			return true;
		}
	}
	
	return false;
}
