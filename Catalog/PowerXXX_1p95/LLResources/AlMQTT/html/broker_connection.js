var app = window.external;
var gentypes = app.CallFunction("common.GetGeneralTypes");
var m_fso = app.CallFunction( "common.CreateObject", "Scripting.FileSystemObject" ); 

var DEF_PORT_TLS = 8883
var DEF_PORT = 1883

var path;

function InitPage()
{
	path = _DATAPATH
	pageTitle.innerText = "'" + app.DataGet(path + "@caption", 0) + "' " + app.Translate("connection") + " " +  app.Translate("configuration");

	tlsValue = app.DataGet(path + "@tls", 0);
	txNameServer.disabled = tlsValue == 0;

	if (tlsValue == 1)
		advancedTLSButton.style.display = "";

	var matches = path.match(/\d+(?=\D*$)/);
	if (matches)
	{
		var id = parseInt(matches[0]) - 1;
		txtID.value = id;
	}
  
	SearchError(path)

	// inserisco tutte le immagini in/out in base all'attributo che trovo
	let inOutImgElems = document.querySelectorAll("[data-img]");
	for (let key in inOutImgElems) {
		let element = inOutImgElems[key];
		if (element.nodeType !== Node.ELEMENT_NODE)
			continue;

		let attr = element.getAttribute("data-img");
		element.src = csspath + '../img/arrow'+attr+'.png';
	}

	onStaticParametricChange(app.DataGet(path + "@" + ASSIGN_FLD.CLIENTNAMEPARAMETRIC, 0), STATIC_PARAMETRIC_FLD.CID);
	onStaticParametricChange(app.DataGet(path + "@" + ASSIGN_FLD.USERNAMEPARAMETRIC, 0), STATIC_PARAMETRIC_FLD.USER);
	onStaticParametricChange(app.DataGet(path + "@" + ASSIGN_FLD.PASSWORDPARAMETRIC, 0), STATIC_PARAMETRIC_FLD.PASS);

	// mostro direttamente l'advanced se c'e' qualcosa di settato
	if (tlsValue == 1 && (app.DataGet(path + "@" + ASSIGN_FLD.CLIENTCERT, 0) ||
							app.DataGet(path + "@" + ASSIGN_FLD.CLIENTKEY, 0) ||
							app.DataGet(path + "@" + ASSIGN_FLD.CACERT, 0)))
		ShowAdvancedTLS();
}

function UpdateTreeCaption()
{
	var treePath = app.HMIGetCurElementPath("tree1");
	// aggiorna la nuova caption sull'albero sull'elemento attivo
	app.HMISetCaption("tree1", treePath, txtName.value)
}

function OnTLS()
{
	path = _DATAPATH;
	// scatta sulla onchange quindi il dato è ancora vecchio
	var tlsValue = app.DataGet(path + "@tls", 0) == 0;
	txNameServer.disabled = !tlsValue;

	var portValue = app.DataGet(path + "@port", 0);
	if (tlsValue) {
		portValue = DEF_PORT_TLS;
		advancedTLSButton.style.display = "";
	}
	else {
		portValue = DEF_PORT;
		advancedTLSButton.style.display = "none";
		advancedTLSDiv.style.display = "none";
	}

	app.DataSet(path + "@port", 0, portValue);
	txtPort.value = portValue;
	txtPort.text = portValue;
}

function ShowAdvancedTLS() {
	if (advancedTLSDiv.style.display == "none")
		advancedTLSDiv.style.display = "";
	else
		advancedTLSDiv.style.display = "none";
}

function EnableDisableEndpointOnTree(flag)
{
	app.CallFunction("MQTT.EnableDisableItemOnTree", flag);
}

/**
 * Mostra/nasconde le sezioni statiche/parametriche
 * @param {string} isParametric valore 0 o 1 booleano che indica se il dato e' settato come parametrico o statico
 * @param {string} field nome del campo usato per mostrare o nascondere la corrispondente sezione
 */
function onStaticParametricChange(isParametric, field) {
	isParametric = genfuncs.ParseBoolean(isParametric);

	let staticContainer = document.getElementById("static" + field + "Container");
	let paramContainer = document.getElementById("parametric" + field + "Container");

	if (isParametric) {
		paramContainer.style.display = "block";
		staticContainer.style.display = "none";

		// vedere commento su onAutoConnectChange
		autoConnChk.checked = false;
		app.DataSet(path + "@autoConnect", 0, 0);
	}
	else {
		paramContainer.style.display = "none";
		staticContainer.style.display = "block";
	}
}

function onAutoConnectChange(checked) {
	if (checked) {
		let clientnameParametric = genfuncs.ParseBoolean(app.DataGet(path + "@" + ASSIGN_FLD.CLIENTNAMEPARAMETRIC, 0));
		let usernameParametric = genfuncs.ParseBoolean(app.DataGet(path + "@" + ASSIGN_FLD.USERNAMEPARAMETRIC, 0));
		let passwordParametric = genfuncs.ParseBoolean(app.DataGet(path + "@" + ASSIGN_FLD.PASSWORDPARAMETRIC, 0));

		// Nel caso in cui si usi almeno un “Parametric” si deve inibire l’”Automatic connection” altrimenti
		// non c’è certezza che i “Parametric” vengano caricati prima che l’Engine tenti la connessione
		if (clientnameParametric || usernameParametric || passwordParametric) {
			app.MessageBox(app.Translate("To enable the automatic connection you have to set as 'Static' all the 'Parametric' settings"), "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
			autoConnChk.checked = false;
		}
	}
}

function onSelectFile(field) {
	let extList = ['*.pem'];
	let extName;
	if (field == ASSIGN_FLD.CLIENTKEY) {
		extList.push('*.key');
		extName = "Key"
	}
	else {
		extList.push('*.cert')
		extName = "Cert";
	}

	let fldValue = app.DataGet(path + "@" + field, 0);
	if (fldValue) {
		var ris = app.MessageBox(app.Translate("A file is already selected for this field.\nRemove the previous file?"), "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNO);
		if (ris == gentypes.MSGBOX.IDNO)
			return;

		// rimuovo il vecchio file selezionato
		onClearFile(field);
	}

	var filename = app.CallFunction("commonDLL.ShowOpenFileDlg", extName + " files|" + extList.join(";") + "|All files|*.*|", "");
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

	let brokerID = app.DataGet(path + "@uniqueID", 0);
	let date = new Date();
	let dateStr = genfuncs.FormatMsg("%1%2%3%4", date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
	let newName = genfuncs.FormatMsg("%1_%2_%3.%4", m_fso.GetBaseName(filename), brokerID, dateStr, m_fso.GetExtensionName(filename));

	// non dovrebbe mai succedere perche' il file ha appeso il timestamp dell'aggiunta nel nome
	if (m_fso.FileExists(MQTTDir + newName)) {
		var ris = app.MessageBox(app.Translate("A file with the same name already exists in the certificates configuration.\nOverwrite it?"), "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNO);
		if (ris == gentypes.MSGBOX.IDNO)
			return;
	}

	// Files copied to a new destination path will keep the same file name. To rename the copied file, simply include the new file name in the destination path.
	m_fso.CopyFile(filename, MQTTDir + newName, true);

	// setto il dato nel progetto
	app.DataSet(path + "@" + field, 0, newName);

	let fldElem = document.getElementById(field + "Txt");
	fldElem.value = newName;
}

function onClearFile(field) {
	// cancello file nella cartella del progetto
	var prjpath = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath"));
	let MQTTDir = prjpath + "\\Download\\MQTT\\";
	let fileName = app.DataGet(path + "@" + field, 0);
	let filePath = MQTTDir + fileName;

	if (m_fso.FileExists(filePath))
		m_fso.DeleteFile(filePath);

	// rimuovo il dato nel progetto
	app.DataSet(path + "@" + field, 0, "");

	let fldElem = document.getElementById(field + "Txt");
	fldElem.value = "";
}

/**
 * Assegna variabile di tipo stringa alla input testuale e setta il dato
 * @param {string} field nome del campo usato sia per settare il dato che per settare il valore nell'input testuale
 */
function Assign(field)
{
	var globalVars = app.CallFunction("logiclab.GetProjectVariables");
	let vars = [];

	for (var i = 0, t = globalVars.length; i < t; i++)
	{
		var v = globalVars.item(i);
		if (v.Type.toUpperCase() == "STRING")
			vars.push(v)
	}
	
	var auxsrcVars = app.CallFunction("logiclab.GetAuxSrcVariables", "")
	for (var i = 0, t = auxsrcVars.length; i < t; i++)
	{
		var v = auxsrcVars.item(i);
		if (v.Type.toUpperCase() == "STRING")
			vars.push(v)
	}

	app.TempVar("VarsList_input") = vars;
	app.TempVar("varsList_multipleSel") = false;
	app.OpenWindow("PLCVarsList", app.Translate("Choose PLC variable (STRING)"), "");
	var result = app.TempVar("VarsList_result");
	app.TempVar("VarsList_result") = undefined;

	if (result === undefined)
		return;

	field += "ParametricVar";

	let fldElem = document.getElementById(field + "Txt");

	var item = vars[result[0]];

	fldElem.value = item.name;
	app.DataSet(path + "@" + field, 0, item.name);
}

function UnAssign(field)
{
	field += "ParametricVar";

	app.DataSet(path + "@" + field, 0, "");
	document.getElementById(field + "Txt").value = "";
}