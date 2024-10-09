var genfuncs = app.CallFunction("common.GetGeneralFunctions");
var m_fso = genfuncs.CreateObject("Scripting.FileSystemObject");
var m_shell = genfuncs.CreateObject("WScript.Shell");
var gentypes = app.CallFunction("common.GetGeneralTypes");
const TAB_RESOURCES = 3

const DEBUG = false;
const RETRY_TIMEOUT = 1000;
const OP_STILL_ACTIVE = 259;
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ FUNZIONI GENERALI ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// IPA di default in LLExec. le var possono essere ridefinite!
const LLIPA_WEBSERVERPORT = 65247;
var LLIPA_HARDWAREID = 65158;
var LLIPA_LICENSESTATUS = 65157;
var LLIPA_PRODUCTNAME = 65176;
var LLIPA_WRITELICENSE = 65159;

const SERVERERR_PREFIX = 100;
const CLIENTERR_GETSTATUS_OK = 1000;
// codici corrispondenti a quelli in C++
const STATUS_CODES = {
	LICERR_OK							: { code: 0, msg: "" },
	LICERR_INVPARS						: { code: 1, msg: app.Translate("Invalid parameters") },
	LICERR_INVPORT						: { code: 2, msg: app.Translate("Invalid port number") },
	LICERR_INVFILE						: { code: 3, msg: app.Translate("Generic I/O file failure") },
	LICERR_SOCKINIT						: { code: 4, msg: app.Translate("Cannot create socket") },
	LICERR_SOCKOPEN						: { code: 5, msg: app.Translate("Cannot open socket") },
	LICERR_SOCKBIND						: { code: 6, msg: app.Translate("Cannot bind socket") },
	LICERR_SOCKLISTEN					: { code: 7, msg: app.Translate("Cannot get server response") },
	LICERR_INVURL						: { code: 9, msg: app.Translate("Invalid URL") },
	LICERR_HTTPFAIL						: { code: 10, msg: app.Translate("Server connection error") },
	LICERR_HTTPREQUEST					: { code: 11, msg: app.Translate("Server request error") },
	LICERR_HTTPEXCEPT					: { code: 13, msg: app.Translate("HTTP request error, please check your internet connection") },
	LICERR_SOCKACCEPT					: { code: 14, msg: app.Translate("Cannot accept socket connection") },
	LICERR_GETMACADDRESS				: { code: 15, msg: app.Translate("Cannot get MAC address") },
	LICERR_FTP							: { code: 16, msg: app.Translate("Cannot open FTP connection") },
	LICERR_INVHWID						: { code: 17, msg: app.Translate("Wrong HWID") },
	LICERR_INVPROD						: { code: 18, msg: app.Translate("Product not found") },
	CLIENTERR_OK						: { code: 0, msg: "" },
	CLIENTERR_INVURL					: { code: 19, msg: app.Translate("Invalid URL") },
	CLIENTERR_HTTPFAIL					: { code: 20, msg: app.Translate("Server connection error") },
	CLIENTERR_HTTPREQUEST				: { code: 21, msg: app.Translate("Server request error") },
	CLIENTERR_HTTPEXCEPT				: { code: 22, msg: app.Translate("Generic communication error") },
	CLIENTERR_WEBSERVER					: { code: 23, msg: app.Translate("Cannot connect to target webserver") },
	CLIENTERR_COMMSTRING_LIBERR			: { code: 24, msg: app.Translate("Cannot write license") },
	CLIENTERR_COMMSTRING_CONNFAIL		: { code: 25, msg: app.Translate("Cannot connect to target") },
	CLIENTERR_COMMSTRING_WRONG_LIC_SIZE	: { code: 27, msg: app.Translate("Wrong license key length") },
	CLIENTERR_COMMSTRING_WRONG_HWID_SIZE: { code: 28, msg: app.Translate("Wrong HWID length") },
	CLIENTERR_COMMSTRING_GENERIC_ERR	: { code: 29, msg: app.Translate("Generic parameters error") },
	CLIENTERR_GETSTATUS_OK				: { code: 1000, msg: "" },
	CLIENTERR_GETSTATUS_KO				: { code: 1099, msg: app.Translate("Cannot get license status") },
	OPERATION_TIMEOUT					: { code: OP_STILL_ACTIVE, msg: app.Translate("Operation timeout after maximum retries") },
	
	// errori da server
	SERVER_ERROR_BAD_PARAMETERS 						: { code: (SERVERERR_PREFIX + 1),  msg: "Bad parameters" },
	SERVER_ERROR_WRONG_USER_OR_PASS 					: { code: (SERVERERR_PREFIX + 2),  msg: "Wrong username or pass" },
	SERVER_ERROR_BAD_REQUEST 							: { code: (SERVERERR_PREFIX + 3),  msg: "Bad request" },
	SERVER_ERROR_MAX_NUM_LIC_REACHED 					: { code: (SERVERERR_PREFIX + 4),  msg: "Maximum number of licenses reached" },
	SERVER_ERROR_INVALID_HW_ID 							: { code: (SERVERERR_PREFIX + 5),  msg: "Invalid hardware ID" },
	SERVER_ERROR_INVALID_HW_ID_BAD_CRC 					: { code: (SERVERERR_PREFIX + 6),  msg: "Invalid hardware ID. Bad CRC" },
	SERVER_ERROR_BAD_PRODUCT_KEY 						: { code: (SERVERERR_PREFIX + 7),  msg: "Bad product key" },
	SERVER_ERROR_PRODUCT_KEY_NOT_VALID 					: { code: (SERVERERR_PREFIX + 8),  msg: "Product key is not valid" },
	SERVER_ERROR_NO_ENTITLEMENTS_AVAILABLE 				: { code: (SERVERERR_PREFIX + 9),  msg: "No entitlements available" },
	SERVER_ERROR_COULD_NOT_REACH_INTIME_SERVER 			: { code: (SERVERERR_PREFIX + 10), msg: "Could not reach INtime activation server" },
	SERVER_ERROR_ERROR_CONTACTING_INTIME_SERVER_RETRY 	: { code: (SERVERERR_PREFIX + 11), msg: "Error contacting INtime activation server. Please retry later" },
	SERVER_ERROR_COULD_NOT_RETRIEVE_LIC 				: { code: (SERVERERR_PREFIX + 12), msg: "Could not retrieve license" },
	SERVER_ERROR_ERROR_CONTACTING_INTIME_SERVER 		: { code: (SERVERERR_PREFIX + 13), msg: "Error contacting INtime activation server" },
	SERVER_ERROR_MISSING_HW_ID 							: { code: (SERVERERR_PREFIX + 14), msg: "Missing hardware id" },
	SERVER_ERROR_PRODUCT_KEY_ASSOCIATED_TO_ANOTHER_HW_ID: { code: (SERVERERR_PREFIX + 15), msg: "The product key is already associated with another hardware id" },
	SERVER_ERROR_NO_LICENSES_AVAILABLE 					: { code: (SERVERERR_PREFIX + 16), msg: "No licenses available for requested product" },
	SERVER_ERROR_GENERIC_ERR 							: { code: (SERVERERR_PREFIX + 99), msg: "Generic error, please contact Axel S.r.l" },

}

const LIC_STAT_DESCRIPTION = {
	EMBEDDED: {
		NOT_OK		: { code: 0, cssClass: "no", msg: "no license" },
		OK			: { code: 1, cssClass: "ok", msg: "ok" },
		HWID_ERR	: { code: 2, cssClass: "error", msg: "hardware id error" },
		ERR			: { code: 3, cssClass: "error", msg: " error" }
	},
	WEBSERVER: {
		NOTOK		: { code: CLIENTERR_GETSTATUS_OK + 0, cssClass: "no", msg: "no license" },
		OK			: { code: CLIENTERR_GETSTATUS_OK + 1, cssClass: "ok", msg: "ok" },
		OKEXTERNAL	: { code: CLIENTERR_GETSTATUS_OK + 2, cssClass: "error", msg: "ok" },
		DEMO		: { code: CLIENTERR_GETSTATUS_OK + 3, cssClass: "demo", msg: "demo" },
	}
}

const ACT_TOOL_EXE_PATH = app.CatalogPath + "..\\Common\\Tools\\axelrtlicense.exe";
const SPACE_CHAR = ' ';

/**
 * Torna un oggetto contentente classe CSS e nome dello stato per tutti gli stati delle licenze. Serve per non cablare logica e classi negli if...
 * @param {*} licStat 
 */
function getLicStatDescription(licStat)
{
	let licStatForCurrMode
	if (m_hasWebServer)
		licStatForCurrMode = LIC_STAT_DESCRIPTION.WEBSERVER;
	else
		licStatForCurrMode = LIC_STAT_DESCRIPTION.EMBEDDED;

	let objToReturn;
	for (let key in licStatForCurrMode)
	{
		let item = licStatForCurrMode[key];
		if (item.code == licStat)
		{
			objToReturn = item;
			break;
		}
	}

	return objToReturn;
}

/**
 * Controlla che il tool "axelrtlicense" sia disponibile nel catalogo
 * @returns {boolean} 
 */
function checkToolAvailable()
{
	if (!m_fso.FileExists(ACT_TOOL_EXE_PATH))
	{
		app.PrintMessage("ERROR: axelrtlicense not found");
		app.CallFunction("extfunct.SelectOutputTab", TAB_RESOURCES);
		return false;
	}

	return true;
}

/**
 * Attiva la licenza completamente tramite webserver (ottiene chiave da server Axel e la scrive tramite API)
 * @param {*} productName 
 * @param {*} productKey 
 * @returns {number} lo stato corrispondente alla const STATUS_CODES
 */
function activateLicenseOnline(productName, productKey)
{
	let commStrObj = getParsedCommString();

	let cmd = ACT_TOOL_EXE_PATH + SPACE_CHAR + "-register" + SPACE_CHAR + commStrObj.address + ":" + m_webServerPort
				+ SPACE_CHAR + productName + SPACE_CHAR + productKey;

	let res = executeRtlicenseCommand(cmd);
	return res;
}

/**
 * Attiva la licenza offline con scrittura chiave attraverso il web server (chiave offline e la scrive tramite API)
 * @param {*} productName 
 * @param {*} license 
 * @returns {number} lo stato corrispondente alla const STATUS_CODES
 */
function activateLicenseOffine(productName, license)
{
	let commStrObj = getParsedCommString();

	let cmd = ACT_TOOL_EXE_PATH + SPACE_CHAR + "-writelicense" + SPACE_CHAR + commStrObj.address + ":" + m_webServerPort
				+ SPACE_CHAR + productName + SPACE_CHAR + license;

	let res = executeRtlicenseCommand(cmd);
	return res;
}

/**
 * Ottiene lo stato della licenza attraverso web server
 * @returns {number} lo stato corrispondente alla const STATUS_CODES + CLIENTERR_GETSTATUS_OK
 */
function getLicenseStatus(productName)
{
	let commStrObj = getParsedCommString();

	let cmd = ACT_TOOL_EXE_PATH + SPACE_CHAR + "-status" + SPACE_CHAR + commStrObj.address + ":" + m_webServerPort
				+ SPACE_CHAR + productName;

	let res = executeRtlicenseCommand(cmd);
	return res;
}

// ritorna la commstring attualmente in uso da LogicLab, tenendo anche conto dell'opzione 'use last port' per cui la porta COM realmente usata non è quella salvata nella commstring
function GetActualCommString()
{
	let commString = app.CallFunction("logiclab.get_CommString");
	
	let parsedString = app.CallFunction("common.SplitCommString", commString);
	if (parsedString && parsedString.portType == "COM")
	{
		let lastCOM = app.CallFunction("script.GetLastUsedCOM");
		if (lastCOM)
		{
			parsedString.portNum = lastCOM;
			commString = app.CallFunction("common.BuildCommString2", parsedString);
		}
	}
	
	return commString;
}

/**
 * Ottiene la licenza tramite webserver e scrive la chiave attraverso un parametro
 * @param {*} productName 
 * @param {*} productKey 
 * @returns {number} lo stato corrispondente alla const STATUS_CODES
 */
function activateLicenseOnlineEmbedded(productName, productKey)
{
	let commString = GetActualCommString();
	let cmd = ACT_TOOL_EXE_PATH + SPACE_CHAR + "-register" + SPACE_CHAR + commString + SPACE_CHAR + productName + SPACE_CHAR + productKey + SPACE_CHAR +
				"-ipalist" + SPACE_CHAR + LLIPA_LICENSESTATUS + "," + LLIPA_HARDWAREID + "," + LLIPA_WRITELICENSE;

	let res = executeRtlicenseCommand(cmd);
	return res;
}

/**
 * Attiva la licenza offline con scrittura chiave attraverso parametro
 * @param {*} productName 
 * @param {*} license 
 */
function activateLicenseOffineEmbedded(productName, license)
{
	let commString = GetActualCommString();
	let cmd = ACT_TOOL_EXE_PATH + SPACE_CHAR + "-writelicense" + SPACE_CHAR + commString + SPACE_CHAR + productName + SPACE_CHAR + license + SPACE_CHAR +
				"-ipalist" + SPACE_CHAR + LLIPA_LICENSESTATUS + "," + LLIPA_HARDWAREID + "," + LLIPA_WRITELICENSE;

	let res = executeRtlicenseCommand(cmd);
	return res;
}

/**
 * Ottiene lo stato della licenza attraverso lettura parametro
 * @returns {number} lo stato corrispondente alla const LICENSESTATUS_EMBEDDED_CODES
 */
function getLicenseStatusEmbedded()
{
	var devLink = app.CallFunction("logiclab.GetDeviceLink");

	let res;

	try
	{
		res = devLink.Par(LLIPA_LICENSESTATUS, 0, gentypes.VARENUM.VT_UI1);  // GDB
	}
	catch (ex) {
		app.MessageBox(app.Translate("Could not get the license status"), "", gentypes.MSGBOX.MB_ICONERROR);
	}

	// per (cercare) di forzare subito il rilascio del devlink...
	app.CallFunction("logiclab.UnlockComm");
	devLink = null;
	CollectGarbage();

	return res;
}

/**
 * Torna il messaggio dello STATUS_CODE passato
 * @param {number} msgCode 
 */
function getStatusString(msgCode)
{
	let str;
	for (let key in STATUS_CODES) {
		let item = STATUS_CODES[key];
		if (item.code == msgCode)
		{
			str = item.msg;
			break;
		}
	}

	return str;
}

function getProductsList()
{
	let commStrObj = getParsedCommString();

	// esporto la lista dei prodotti in un file temporaneo dato che non riesco a redirigere l'output
	var filename = m_shell.ExpandEnvironmentStrings("%TEMP%") + "\\LLExecProdList";
	let cmd = ACT_TOOL_EXE_PATH + SPACE_CHAR + "-productlist" + SPACE_CHAR + commStrObj.address + ":" + m_webServerPort + SPACE_CHAR + filename;

	let cmdRes = executeRtlicenseCommand(cmd);
	if (cmdRes === undefined || cmdRes == STATUS_CODES.CLIENTERR_WEBSERVER.code)
		return;

	let res = "";
	var f = m_fso.OpenTextFile(filename, 1);
	while (!f.AtEndOfStream)
	{
		res += f.ReadLine();
		res += "\n";
	}
	f.Close();

	let resObj = parseJSON(res);
	return resObj;
}

function getProductNameEmbedded(devLink)
{
	if (DEBUG)
		app.PrintMessage("LEGGO PRODUCT NAME EMBEDDED");

	let res;
	if (app.CallFunction("logiclab.get_Connected") && !app.CallFunction("logiclab.get_ConnectedInError")) {
		try {
			if (m_IsModbusComm)
				res = devLink.Par(LLIPA_PRODUCTNAME, 32, gentypes.VARENUM.VT_BSTR);		// MODBUS
			else
				res = devLink.Par(LLIPA_PRODUCTNAME, 0, gentypes.VARENUM.VT_BSTR);		// GDB
		}
		catch (ex) {
			app.PrintMessage(app.Translate("Error reading the product name"));
			app.CallFunction("extfunct.SelectOutputTab", TAB_RESOURCES);
		}
	}

	return res;
}

function getHardwareId(devLink)
{
	if (DEBUG)
		app.PrintMessage("LEGGO HARDWARE ID");

	let res;
	if (app.CallFunction("logiclab.get_Connected") && !app.CallFunction("logiclab.get_ConnectedInError")) {
		try {
			if (m_IsModbusComm)
				res = devLink.Par(LLIPA_HARDWAREID, 16, gentypes.VARENUM.VT_BSTR);		// MODBUS
			else
				res = devLink.Par(LLIPA_HARDWAREID, 0, gentypes.VARENUM.VT_BSTR);		// GDB
		}
		catch (ex) {
			app.PrintMessage(app.Translate("Error reading the HW id"));
			app.CallFunction("extfunct.SelectOutputTab", TAB_RESOURCES);
		}
	}

	return res;
}

/**
 * Prova a leggere il parametro con il numero della porta
 * @returns {(null|number)} torna null se ha superato il numero massimo di tentativi, altrimenti il numero della porta
 */
function getWebServerPort()
{
	var devLink = app.CallFunction("logiclab.GetDeviceLink");

	if (DEBUG)
		app.PrintMessage("LEGGO PORTA WEB SERVER");

	let res;
	if (app.CallFunction("logiclab.get_Connected") && !app.CallFunction("logiclab.get_ConnectedInError")) {
		try {
			res = devLink.Par(LLIPA_WEBSERVERPORT, 0, gentypes.VARENUM.VT_UI2);
		}
		catch (ex) {}
	}

	// per (cercare) di forzare subito il rilascio del devlink...
	app.CallFunction("logiclab.UnlockComm");
	devLink = null;
	CollectGarbage();

	return res;
}

function executeRtlicenseCommand(cmd)
{
	if (!checkToolAvailable())
		return;

	if (DEBUG)
		app.PrintMessage("ESEGUO COMANDO: " + cmd);

	const HIDE_WINDOW = 0;
	let handle = app.CallFunction("commonDLL.RunCommandAsync", cmd, HIDE_WINDOW);
	let result = app.CallFunction("commonDLL.GetProcessExitCode", handle);

	const MAX_RETRIES = 50;
	let cnt = 0;
	while (result == OP_STILL_ACTIVE && cnt <= MAX_RETRIES)
	{
		app.CallFunction("commonDLL.sleep", 200);
		result = app.CallFunction("commonDLL.GetProcessExitCode", handle);
		cnt++;
	}

	app.CallFunction("commonDLL.CloseProcessHandle", handle);

	return result;
}

function isProductKeyValid(pKey)
{
	// matcha il product key con trattini o senza
	// 3 gruppi da 5 caratteri seguiti da trattino + gruppo finale || 20 caratteri di fila
	const regex = /^([A-Za-z0-9]{5}-){3}[A-Za-z0-9]{5}$|^[A-Za-z0-9]{20}$/;
	if (!pKey.match(regex))
		return false;

	return true;
}

function parseJSON(JSONStr)
{
	try
	{
		var data;
		// JSON.parse dovrebbe essere supportato da JSCRIPT 5.8, altrimenti usa la eval (con workaround di assegnamento a oggetto)
		if (typeof JSON !== "undefined")
			data = JSON.parse(JSONStr);
		else
			data = eval('obj = ' + JSONStr);

		return data;
	}
	catch (e)
	{
		return null;
	}
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ FUNZIONI DELLA PAGINA ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

var m_licStatus;				// stato licenza di tutti i prodotti trovati
var m_hardwareId;				// hw id valido per tutti i prodotti Axel
var m_productsList;				// lista dei prodotti trovati
var m_productsToExport = [];	// prodotti da esportare durante il download del file JSON di attivazione
var m_webServerPort;
var m_hasWebServer;				// indica se il target e' un derivato di LLExec, quindi con webserver, oppure no
var m_productNameEmbedded;
var m_producListAndStatusRead = false;
var m_IsModbusComm = false;		// indica se effettuare le letture dei parametri usando il Modbus

function initLicenseSettings()
{
	// li nascondo per non mostrare contenuto mentre sta leggendo lo stato della licenza...
	showLicensePanels(false);

	initIPAsForCurrentTarget();

	startCheckingData();
}

function checkIsModbusComm() {
	let commStrObj = getParsedCommString();

	return (commStrObj.protocol === 'Modbus' || commStrObj.protocol === 'ModbusTCP');
}

function startCheckingData()
{
	function checkHasWebServerCallback(hasWebServer) {
		m_hasWebServer = hasWebServer;
		checkData();
	}

	// workaround temporaneo per evitare di andare in deadlock con la lettura dell'imgx in background:
	// get_Opening torna true se c'è un QUALUNQUE thread in background, quindi anche quello di lettura del imgx: in questo modo si evita il problema della dialog che non esce e freeze della gui
	// TODO : da sostituire con callback alla connessione fatta bene!
	if (!app.CallFunction("logiclab.get_Connected") || app.CallFunction("logiclab.get_ConnectedInError") || app.CallFunction("logiclab.get_SimulMode") || app.CallFunction("logiclab.get_Opening"))
	{
		// se connessione non ok, reinnesca chiamata ritardata finchè non legge correttamente
		// questa tecnica però non gestisce il caso di cambio target connesso!
		setTimeout(startCheckingData, 1000);

		if (DEBUG)
			app.PrintMessage("OFFLINE - riprovo tra 1 secondo");

		return;
	}

	m_IsModbusComm = checkIsModbusComm();

	let port = getWebServerPort();
	if (port !== undefined) {
		// NB: la checkHasWebServer deve girare al di fuori di lock della comunicazione, poichè pare che la XmlHttpRequest faccia girare il loop degli eventi,
		// per cui potrebbero venire gestiti messaggi di altri thread con comunicazione già lockata, causando deadlock di LogicLab
		m_webServerPort = port;
		checkHasWebServer(checkHasWebServerCallback);
	}
	else {
		m_hasWebServer = false;
		checkData();
	}
}

function checkData() {
	let devLink = app.CallFunction("logiclab.GetDeviceLink");

	// se la porta o il webswerver non funzionano (doppio controllo perche' il parametro della porta potrebbe rispondere ma il webserver non funzionare), provo a usare interamente i parametri
	if (m_hasWebServer === false) {
		let prodName = getProductNameEmbedded(devLink);
		m_productNameEmbedded = prodName;
	}

	// lo leggo tramite parametro dato che non mi interfaccio direttamente con il webserver ma solo attraverso axelrtlicense (che non torna l'hw id)
	let hardwareId = getHardwareId(devLink);
	m_hardwareId = hardwareId;

	if (typeof CustomCheckData == "function")
		CustomCheckData(devLink);
	
	// per (cercare) di forzare subito il rilascio del devlink...
	app.CallFunction("logiclab.UnlockComm");
	devLink = null;
	CollectGarbage();

	readProductsListAndStatus(false);
}

function initIPAsForCurrentTarget() {
	// se diversamente definti nel PCT, ridefinisco le var con gli IPA alternativi
	// questo perche' gli IPA possono essere differenti sui firmware dei target embedded
	const HW_ID_IPA_ATTR_NAME = "targetHwIdIPA";
	const TARG_NAME_IPA_ATTR_NAME = "targetNameIPA";
	const LIC_STAT_IPA_ATTR_NAME = "targetLicStatusIPA";
	const WRITE_LIC_IPA_ATTR_NAME = "writeLicenseIPA";

	let path = app.GetCurrentWindowData();

	let prodName = app.SelectNodesXML(path + "@" + TARG_NAME_IPA_ATTR_NAME)[0];
	if (prodName)
		LLIPA_PRODUCTNAME = prodName.value;

	let licStat = app.SelectNodesXML(path + "@" + LIC_STAT_IPA_ATTR_NAME)[0];
	if (licStat)
		LLIPA_LICENSESTATUS = licStat.value;

	let writeLic = app.SelectNodesXML(path + "@" + WRITE_LIC_IPA_ATTR_NAME)[0];
	if (writeLic)
		LLIPA_WRITELICENSE = writeLic.value;

	let hwId = app.SelectNodesXML(path + "@" + HW_ID_IPA_ATTR_NAME)[0];
	if (hwId)
		LLIPA_HARDWAREID = hwId.value;
}

function getParsedCommString()
{
	let commString = app.CallFunction("logiclab.get_CommString");
	let parsedString = app.CallFunction("common.SplitCommString", commString);

	return parsedString;
}

/**
 * Prova a fare una chiamata al web server per vedere se e' disponibile
 */
function checkHasWebServer(callbackFunc)
{
	if (DEBUG)
		app.PrintMessage("CONTROLLO PRESENZA WEBSERVER");

	const XHR_READY_STATE = {
		UNSENT: 0, 				// Client has been created. open() not called yet.
		OPENED: 1, 				// open() has been called.
		HEADERS_RECEIVED: 2, 	// send() has been called, and headers and status are available.
		LOADING: 3, 			// Downloading; responseText holds partial data.
		DONE: 4 				// The operation is complete.
	}

	if (app.CallFunction("logiclab.get_Connected") && !app.CallFunction("logiclab.get_ConnectedInError"))
	{
		let commStrObj = getParsedCommString();

		let xhr = new XMLHttpRequest();

		xhr.onreadystatechange = function () {
			if (this.readyState == XHR_READY_STATE.DONE) {
				if (this.status == 200)
					callbackFunc(this.responseText !== null);
				else
					callbackFunc(false);
			}
		};

		const URL = 'http://' + commStrObj.address + ':' + m_webServerPort;
		xhr.open("GET", URL, true);
		// 5 secondi di timeout dovrebbero essere piu' che sufficienti
		xhr.timeout = 5000;
		// serve per evitare la cache di IE
		xhr.setRequestHeader("Pragma", "no-cache");
		try {
			xhr.send();
		}
		catch (ex) {
			callbackFunc(false);
		}
	}
}

// chiamata dal bottone
function readProductsListAndStatus(manualRead)
{
	if (DEBUG)
		app.PrintMessage("LEGGO NOME PRODOTTI E STATO");

	if (!app.CallFunction("logiclab.get_Connected") || app.CallFunction("logiclab.get_ConnectedInError"))
	{
		// se letto in automatico non mostro il messaggio di errore
		if (manualRead) {
			let msg = app.Translate("Connect LogicLab to see these informations");
			app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		}

		return;
	}

	let prodList;
	if (m_hasWebServer)
		prodList = getProductsList();
	else {
		// mantengo la lista di un solo prodotto
		prodList = [];
		prodList.push(new Object({name: m_productNameEmbedded}));
	}

	// setta le globali che verranno usate piu' volte nella pagina e la var di export
	readLicenseStatusForAvailableProducts(prodList);

	m_productsList = prodList;

	if (Object.keys(m_licStatus).length > 0 && m_productsList.length > 0)
	{
		refreshBtn.style.display = "block";
		msgConnectLL.style.display = "none"
		// abilita i panel di licenziamento se la lista prodotti e gli stati delle licenze sono stati letti
		showHideActPanelsIfProductsActive();
		updateLicenseStatusTable();

		m_producListAndStatusRead = true;
	}
	else
		app.MessageBox(app.Translate("Error getting license status"), "", gentypes.MSGBOX.MB_ICONERROR);
}

function changeLicensingMode(automaticMode)
{
	if (automaticMode) {
		manualModeFld.style.display = "none";
		autoModeFld.style.display = "";
	}
	else {
		autoModeFld.style.display = "none";
		manualModeFld.style.display = "";
	}
}

// se tutti i prodotti risultano attivi, nasconde i panneli di attivazione
function showHideActPanelsIfProductsActive() {
	let allLicOk = true;
	for (let key in m_licStatus) {
		let val = m_licStatus[key];
		if (val != LIC_STAT_DESCRIPTION.EMBEDDED.OK.code
			&& val != LIC_STAT_DESCRIPTION.WEBSERVER.OK.code
			&& val != LIC_STAT_DESCRIPTION.WEBSERVER.OKEXTERNAL.code) {
			allLicOk = false;
			break;
		}
	}

	if (allLicOk) {
		showLicensePanels(false);
		showForgotProductKeySection(false);
	}
	else
	{
		showLicensePanels(true);
		changeLicensingMode(true);
		autoMode.checked = true;
	}
}

function showLicensePanels(enable) {
	let panelList = document.querySelectorAll("[data-hide-if-active-or-not-read]");
	for (let i in panelList) {
		let panel = panelList[i];
		if (panel.nodeType !== Node.ELEMENT_NODE)
			continue;

		// panel.disabled = !enable;
		panel.style.display = enable ? "" : "none";
	}
}

function showForgotProductKeySection(show) {
	forgotPkeyDiv.style.display = show ? '' : 'none';
}

// prova a fare l'attivazione online con una product key generica, se il server conosce quell'hw id torna una licenza valida
function tryForgottenActivation() {
	const DUMMY_KEY = 'AXELA-XELAX-ELAXE-LAXEL';
	activateAutomaticLicense(DUMMY_KEY);
}

// usa una product key generica come nel caso sopra
function exportForgottenPKey() {
	const DUMMY_KEY = 'AXELA-XELAX-ELAXE-LAXEL';
	exportActivatonLicense(DUMMY_KEY);
}

function activateAutomaticLicense(pKeyArg)
{
	// se passato il parametro, uso quello come product key. altrimenti lo prendo dalla input testuale
	let productKeyVal;
	if (!pKeyArg)
		productKeyVal = productKeyTxt.value;
	else
		productKeyVal = pKeyArg;

	if (!isProductKeyValid(productKeyVal))
	{
		app.MessageBox("Product key format is not valid", "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return;
	}

	let activatedLicenses = [];
	let failedActivations = [];
	m_productsList.forEach(function(item) {
		let prodName = item.name;

		// check di sicurezza perche' il nome del prodotto serve per ottenere il suo stato di licenza
		if (!prodName)
			return;

		let licOk = (m_licStatus[name] == LIC_STAT_DESCRIPTION.WEBSERVER.OK.code ||
					m_licStatus[name] == LIC_STAT_DESCRIPTION.WEBSERVER.OKEXTERNAL.code ||
					m_licStatus[name] == LIC_STAT_DESCRIPTION.EMBEDDED.OK.code);

		// attivo la licenza per il prodotto corrente solo se non e' gia' attiva
		if (!licOk) {
			let res;
			if (m_hasWebServer)
				res = activateLicenseOnline(prodName, productKeyVal);
			else
				res = activateLicenseOnlineEmbedded(prodName, productKeyVal);

			if (res == STATUS_CODES.LICERR_OK.code)
				activatedLicenses.push(prodName);
			else {
				failedActivations.push(prodName);
				app.PrintMessage(genfuncs.FormatMsg("Error #%1 activating %3: %2", res, getStatusString(res), prodName));
				app.CallFunction("extfunct.SelectOutputTab", TAB_RESOURCES);
			}
		}
	});

	if (failedActivations.length > 0) {
		let msg = app.Translate("Could not activate licenses for the following products") + ": " + failedActivations.join(", ");
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
	}
	if (activatedLicenses.length > 0) {
		let msg = app.Translate("Licenses activated for the following products") + ": " + activatedLicenses.join(", ");
		msg += "\n" + app.Translate("IDE will be disconnected")
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONINFORMATION);

		let msgRestart = app.Translate("Please restart the") + " " + (m_hasWebServer ? "runtime" : "target");
		app.MessageBox(msgRestart, "", gentypes.MSGBOX.MB_ICONEXCLAMATION);

		app.CallFunction("logiclab.Connect", false);
	}
}

function readLicenseStatusForAvailableProducts(productsList)
{
	m_licStatus = {};

	if (!productsList)
	{
		app.MessageBox(app.Translate("Could not get the products"), "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return;
	}

	productsList.forEach(function(item) {
		let prodName = item.name;

		// check di sicurezza perche' il nome del prodotto serve per ottenere il suo stato di licenza
		if (!prodName)
			return;

		let licStatus;
		if (m_hasWebServer)
			licStatus = getLicenseStatus(prodName);
		else
			licStatus = getLicenseStatusEmbedded();

		let licOk = (licStatus == LIC_STAT_DESCRIPTION.WEBSERVER.OK.code ||
						licStatus == LIC_STAT_DESCRIPTION.WEBSERVER.OKEXTERNAL.code ||
						licStatus == LIC_STAT_DESCRIPTION.EMBEDDED.OK.code);

		m_licStatus[prodName] = licStatus;

		// svuoto l'array di modo che se leggo piu' volte lo stato della licenza non vengano esportati piu' prodotti
		m_productsToExport.length = 0;

		// i prodotti Axel dovrebbero avere tutti lo stesso hardware id
		m_productsToExport.push(new Object({ "name": prodName, "hwid": m_hardwareId, "license": licOk ? "***OK***" : null }));
	});
}

function updateLicenseStatusTable() {
	// svuoto la tabella
	prodTbl.innerHTML = "";

	// creo l'header della tabella ogni volta perche' la svuoto ad ogni lettura per non aggiungere elementi duplicati
	let newTr = document.createElement("tr");
	let tdName = document.createElement("td");
	tdName.classList.add("tab-head");
	tdName.innerText = app.Translate("Product name");
	let tdStatus = document.createElement("td");
	tdStatus.classList.add("tab-head");
	tdStatus.innerText = app.Translate("Status");

	newTr.appendChild(tdName);
	newTr.appendChild(tdStatus);
	prodTbl.appendChild(newTr);

	m_productsList.forEach(function(item) {
		let prodName = item.name;

		// check di sicurezza perche' il nome del prodotto serve per ottenere il suo stato di licenza dalla mappa
		if (!prodName)
			return;

		let newTr = document.createElement("tr");
		let tdName = document.createElement("td");
		let tdStatus = document.createElement("td");

		let spanStatus = document.createElement("span");
		spanStatus.classList.add("lic-status");

		let statusCode = m_licStatus[prodName];
		if (statusCode === undefined) {
			app.PrintMessage("Could not get license status for " + prodName);
			return;
		}
		let res = getLicStatDescription(statusCode);
		spanStatus.classList.add(res.cssClass);
		spanStatus.innerText = res.msg;

		tdName.innerText = prodName;
		tdStatus.appendChild(spanStatus);

		newTr.appendChild(tdName);
		newTr.appendChild(tdStatus);
		prodTbl.appendChild(newTr);
	});
}

// crea il file di download con le informazioni di licenza e p.key associato
function exportActivatonLicense(pKeyArg) {
	if (!m_productsList)
	{
		app.MessageBox(app.Translate("Could not get the products available on the runtime"), "", gentypes.MSGBOX.MB_ICONERROR);
		return;
	}

	// se passato il parametro, uso quello come product key. altrimenti lo prendo dalla input testuale
	let productKeyVal;
	if (!pKeyArg)
		productKeyVal = productKeyManTxt.value;
	else
		productKeyVal = pKeyArg;

	if (!isProductKeyValid(productKeyVal))
	{
		app.MessageBox("Product key format is not valid", "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return;
	}

	let exportDate = new Date().toLocaleString();
	let objToExport = new Object({ "pKey": productKeyVal, "exportTime": exportDate, "licenseTime": null, "products": m_productsToExport });

	downloadActivatonLicense(objToExport);
}

function downloadActivatonLicense(dataObj) {
	var filename = app.CallFunction("commonDLL.ShowSaveFileDlg","Axel license file (*.json)|*.json|All files|*.*|", ".json", "ALlic");
	if(!filename)
		return;

	if (m_hardwareId === undefined)
	{
		app.MessageBox(app.Translate("Error exporting. Could not read hardware id"), "", gentypes.MSGBOX.MB_ICONERROR);
		return;
	}

	var f = m_fso.CreateTextFile(filename, true);
	var str = JSON.stringify(dataObj);
	str = str.replace(/[^ -~]+/g, "");
	f.WriteLine(str);
	f.Close()
}

// evento chiamato dal bottone
function selectFile() {
	document.getElementById('selectfile').click();
}

// evento chiamato al change dell'input del file
function uploadLicenseBtn() {
	let fileobj = document.getElementById('selectfile').files[0];
	parseLicense(fileobj);

	// resetto l'input altrimenti la funzione non viene richiamata se viene fatta seconda selezione (se il valore dell'input non e' cambiato perche' ho riselezionato il medesimo file)
	document.getElementById('selectfile').value = '';
}

// event chiamato dal drop del file
function uploadLicense(e) {
	e.preventDefault();
	let fileobj = e.dataTransfer.files[0];
	parseLicense(fileobj);
}

function parseLicense(file) {
	if (!file)
		return;

    // su Windows 7 file.type e' undefined solo per i JSON
	if (file.type !== "application/json") {
		app.MessageBox(app.Translate("License file not supported"), "", gentypes.MSGBOX.MB_ICONERROR);
		return;
	}

	let reader = new FileReader();
	reader.readAsText(file);
	reader.onload = function() {
		activateManualLicense(reader.result);
	};
}

// ATTIVAZIONE OFFLINE tramite file di licenza
function activateManualLicense(readerResult) {
	let result = JSON.parse(readerResult);

	let productList = result.products;

	let missingLicenses = [];
	let activatedLicenses = [];
	let failedActivations = [];
	for (let key in productList) {
		let prod = productList[key];

		let hwid = prod.hwid;
		let lic = prod.license;
		let name = prod.name;

		if (!hwid || !name) {
			app.MessageBox(app.Translate("Could not parse license file"), "", gentypes.MSGBOX.MB_ICONERROR);
			return;
		}

		if (!lic) {
			missingLicenses.push(name);
			continue;
		}

		let licOk = (m_licStatus[name] == LIC_STAT_DESCRIPTION.WEBSERVER.OK.code ||
					m_licStatus[name] == LIC_STAT_DESCRIPTION.WEBSERVER.OKEXTERNAL.code ||
					m_licStatus[name] == LIC_STAT_DESCRIPTION.EMBEDDED.OK.code);

		// attivo la licenza per il prodotto corrente solo se non e' gia' attiva
		if (!licOk) {
			let res;
			if (m_hasWebServer)
				res = activateLicenseOffine(name, lic);
			else
				res = activateLicenseOffineEmbedded(name, lic);

			if (res == STATUS_CODES.LICERR_OK.code)
				activatedLicenses.push(name);
			else {
				failedActivations.push(name);
				app.PrintMessage(genfuncs.FormatMsg("Error #%1 activating %3: %2", res, getStatusString(res), prodName));
				app.CallFunction("extfunct.SelectOutputTab", TAB_RESOURCES);
			}
		}
	}

	if (failedActivations.length > 0 || missingLicenses.length > 0) {
		let msg = app.Translate("Could not activate licenses for the following products") + ": " + failedActivations.join(", ") + missingLicenses.join(", ");
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
	}
	if (activatedLicenses.length > 0) {
		let msg = app.Translate("Licenses activated for the following products") + ": " + activatedLicenses.join(", ");
		msg += "\n" + app.Translate("IDE will be disconnected")
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONINFORMATION);

		let msgRestart = app.Translate("Please restart the") + " " + (m_hasWebServer ? "runtime" : "target");
		app.MessageBox(msgRestart, "", gentypes.MSGBOX.MB_ICONEXCLAMATION);

		app.CallFunction("logiclab.Connect", false);
	}
}