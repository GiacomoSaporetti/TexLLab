var app = window.external;
var gentypes = app.CallFunction("common.GetGeneralTypes");
var m_fso = app.CallFunction( "common.CreateObject", "Scripting.FileSystemObject" );

// mappa[valori] = descrizioni corrispondenti ai codici di errore
var m_enumElementsMap = {};

var m_diagnosticsLibraryOk = false;

const MASTER_VARNAMES_PREFIX = 'sysMQTTEngineStatus.';
const MASTER_VARNAMES = {
	MASTER_CONFIGURED: 'configured',
	MASTER_NETWORK_OK: 'network_ok',
	ENDPOINTS_NUMBER: 'numConfiguredEndpoints',
	ENDPOINTS_ACT_NUMBER: 'numActiveEndpoints',
	ENDPOINTS_RUN_NUMBER: 'numRunningEndpoints',
	ERROR_NUMBER: 'errorcode'
}

var m_diagnosticsEnabled;

var path;

function InitPage()
{
	path = _DATAPATH;

	// con dark theme vengono usate altre immagini
    let imgPathPrefix = m_darkTheme ? "../img/btn/dark_theme/" : "../img/btn/";

	imgPlus.src = csspath + imgPathPrefix + 'plus.png';

	// riempio la lista dei file aggiuntivi da scaricare
	var downloadfilesNodes = app.SelectNodesXML(path + "MQTTDownloadFiles/filename");
	if (downloadfilesNodes && downloadfilesNodes.length > 0) {
		var node;
		while (node = downloadfilesNodes.nextNode()) {
			AddFileToDownloadHTML(node.text);
		}
	}

	checkDiagnosticLibrary();

	m_diagnosticsEnabled = app.CallFunction("MQTT.GetDiagnosticsEnabled");
	diagnosticsEnabledChk.checked = m_diagnosticsEnabled;

	fillDiagnosticData();
	setInterval(fillDiagnosticData, 1000);
}

function checkDiagnosticLibrary()
{
	var enumElementsList = app.CallFunction("logiclab.GetEnumElements", "MQTT_Error");
	if (!enumElementsList)
	{
		m_diagnosticsLibraryOk = false;
	}
	else
	{
		// descrizione enumerativi diagnostica
		for (var i = 0, j = enumElementsList.length; i < j; i++)
		{
			var desc = enumElementsList.Item(i).Description;
			var value = enumElementsList.Item(i).InitValue;
			let name = enumElementsList.Item(i).Name;
			m_enumElementsMap[value] = { description: desc, name: name };
		}

		m_diagnosticsLibraryOk = true;
	}
}

function fillDiagnosticData()
{
	if (m_diagnosticsEnabled)
	{
		if (!m_diagnosticsLibraryOk)
		{
			app.MessageBox(app.Translate("MQTT diagnostics library not loaded.\nPlease add MQTTLib.plclib to the project."), "", gentypes.MSGBOX.MB_ICONERROR);
			enableDiagnostics(false);
			diagnosticsEnabledChk.checked = false;
			return;
		}

		var isConnected = (app.CallFunction("logiclab.get_Connected") && !app.CallFunction("logiclab.get_ConnectedInError"));
		if (isConnected)
		{
			// connesso -> mostro i dati di diagnostica
			diagnosticData.classList.remove("hide");
			diagnosticsEnableMessage.classList.add("hide");

			// configured
			var isConfigured = readVar(MASTER_VARNAMES.MASTER_CONFIGURED);
			txtConfigured.className = "status " + (isConfigured ? "on" : "off");
			txtConfigured.innerText = isConfigured ? app.Translate("Yes") : app.Translate("No");
			txtConfiguredVal.innerText = isConfigured !== undefined ? isConfigured : "";

			// network startus
			var netOk = readVar(MASTER_VARNAMES.MASTER_NETWORK_OK);
			txtNetOK.className = "status " + (netOk ? "on" : "off");
			txtNetOK.innerText = netOk ? app.Translate("Ok") : app.Translate("Error");
			txtNetOKVal.innerText = netOk !== undefined ? netOk : "";

			// numero endpoint
			var endPointNum = readVar(MASTER_VARNAMES.ENDPOINTS_NUMBER);
			txtEndpointNumberVal.innerText = endPointNum !== undefined ? endPointNum : "";

			// numero endpoint active
			var endPointActNum = readVar(MASTER_VARNAMES.ENDPOINTS_ACT_NUMBER);
			txtEndpointActNumberVal.innerText = endPointActNum !== undefined ? endPointActNum : "";

			// numero endpoint running
			var endPointRunNum = readVar(MASTER_VARNAMES.ENDPOINTS_RUN_NUMBER);
			txtEndpointRunNumberVal.innerText = endPointRunNum !== undefined ? endPointRunNum : "";

			if (!netOk || !isConfigured)
			{
				// se c'e un qualunque errore lo mostro
				var errCode = readVar(MASTER_VARNAMES.ERROR_NUMBER);
				if (errCode == 0)
				{
					txtError.innerText = app.Translate("No");
					txtError.className = "status on";
				}
				else
				{
					txtError.innerText = m_enumElementsMap[errCode] ? m_enumElementsMap[errCode].description : "-";
					txtError.className = "status off";
				}

				txtErrorVal.innerText = m_enumElementsMap[errCode] ? m_enumElementsMap[errCode].name : "";

				rowErrors.classList.remove("hide");
			}
			else
				rowErrors.classList.add("hide");

		}
		else
		{
			// disconnesso -> nascondo i dati di diagnostica
			diagnosticsEnableMessage.classList.remove("hide");
			diagnosticData.classList.add("hide");
			diagnosticsEnableMessage.innerText = app.Translate("Connect to target to see these informations.");
		}

		// diagnostica abilitata -> mostro tutta la diagnostica
		diagnosticFld.classList.remove("hide");
	}
	else
	{
		// diagnostica disabilitata -> nascondo tutta la diagnostica
		diagnosticFld.classList.add("hide");
	}
}

function readVar(symName)
{
	var sym = app.CallFunction("logiclab.FindSymbol", MASTER_VARNAMES_PREFIX + symName, "");
	if (!sym)
		return;

	var val = sym.ReadValue();

	return val;
}

function enableDiagnostics(flag)
{
	checkDiagnosticLibrary();

	app.CallFunction("MQTT.SetDiagnosticsEnabled", flag);
	m_diagnosticsEnabled = flag;
}

function EnableDisableMasterOnTree(flag)
{
	app.CallFunction("MQTT.EnableDisableItemOnTree", flag);
}

function AddFileToDownloadHTML(fileName) {
	let container = document.createElement("div");
	container.setAttribute("data-file-name", fileName);

	let input = document.createElement("input");
	input.readOnly = true;
	input.value = fileName;

	let btn = document.createElement("button");
	btn.innerText = app.Translate("Delete");
	btn.classList.add("FlatButton");
	btn.style.marginLeft = "1px";
	btn.onclick = (function() {
		return function() { 
			DeleteFileToDownload(fileName);
		}
	})();

	container.appendChild(input)
	container.appendChild(btn);

	downloadFilesDiv.appendChild(container);
}

function AddFileToDownload() {
	var filename = app.CallFunction("commonDLL.ShowOpenFileDlg", "Cert and key files|*.key;*.cert;*.pem|All files|*.*|", "");
	if (!filename)
		return;

	// copio il file nella cartella del progetto
	var prjpath = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath"));
	let downloadDir = prjpath + "\\Download"
	let MQTTDir = downloadDir + "\\MQTT\\";

	if (!m_fso.FolderExists(downloadDir)) {
		m_fso.CreateFolder(downloadDir);
		m_fso.CreateFolder(MQTTDir);
	}
	else if (!m_fso.FolderExists(MQTTDir))
		m_fso.CreateFolder(MQTTDir);

	let fName = m_fso.GetFileName(filename);

	let overwrite = false;
	if (m_fso.FileExists(MQTTDir + fName)) {
		var ris = app.MessageBox(app.Translate("A file with the same name already exists in the certificates configuration.\nOverwrite it?"), "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNO);
		if (ris == gentypes.MSGBOX.IDNO)
			return;
		else
			overwrite = true;
	}

	m_fso.CopyFile(filename, MQTTDir, true);

	// se lo sto sovrascrivendo non aggiungo due entry uguali nel progetto e nell'HTML
	if (!overwrite) {
		// setto il dato nel progetto
		var downloadfilesNode = app.SelectNodesXML(path + "MQTTDownloadFiles")[0];
		let downloadFile = app.GetXMLDocument().createElement("filename");
		downloadFile.text = fName;
		downloadfilesNode.appendChild(downloadFile);
	
		app.ModifiedFlag = true;
	
		// aggiungo entry nella pagina
		AddFileToDownloadHTML(fName);
	}
}

function DeleteFileToDownload(fileName) {
	var ris = app.MessageBox(app.Translate("Delete the selected file?"), "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNO);
	if (ris == gentypes.MSGBOX.IDNO)
		return;

	// rimuovo nel progetto
	let node = app.SelectNodesXML(path + "MQTTDownloadFiles/filename[. = '" + fileName + "']")[0];
	node.parentNode.removeChild(node);

	app.ModifiedFlag = true;

	// cancello file nella cartella del progetto
	var prjpath = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath"));
	let MQTTDir = prjpath + "\\Download\\MQTT\\";
	let filePath = MQTTDir + fileName;

	if (m_fso.FileExists(filePath))
		m_fso.DeleteFile(filePath);

	// rimuovo dalla pagina
	let elem = document.querySelector("[data-file-name='" + fileName + "']");
	elem.parentElement.removeChild(elem);
}