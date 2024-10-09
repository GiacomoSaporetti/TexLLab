var m_scanKnownDevices = [];
var m_scanUnknownDevices = [];

// eventualmente sovrascritto da LLScan_settings.js
var LLSCANSETTINGS = { enable: false, vendorID: "" };

var NOT_AVAILABLE_STR = "N/A"


/*****************************************************************
** Scansiona la rete e genera una tabella dei target collegati
******************************************************************/
function LLScan()
{
	// effettuo le preparazioni necessarie per eseguire lo scan
	prepare();

	// eseguo la chiamata alla dll dello scan, torna una stringa JSON
	var res = app.CallFunction("LLScan.Scan", LLSCANSETTINGS.vendorID);

	var resultList = JSON.parse(res);

	if (!resultList || resultList.length === 0)
	{
		app.MessageBox(app.Translate("No device answered to scan function"), "", MSGBOX.MB_OK | MSGBOX.MB_ICONEXCLAMATION);
		return;
	}

	// riempio le mappe dei device noti e non noti, per tutti i target che hanno risposto		
	for (var i = 0; i < resultList.length; i++)
	{
		var scanResultObj = resultList[i];

		// cerco nel catalogo il device
		if (!scanResultObj.targetID)
		{
			m_scanUnknownDevices.push(scanResultObj);
			continue;
		}
		else
		{
			var nodelist = app.CallFunction("extfunct.QueryCatalog", "//deviceinfo[@deviceid = '" + scanResultObj.targetID + "']")
			if (!nodelist || nodelist.length == 0)
			{
				m_scanUnknownDevices.push(scanResultObj);
				continue;
			}

			scanResultObj.deviceName = nodelist[0].getAttribute("caption");
			scanResultObj.deviceVersion = nodelist[0].getAttribute("version");

			m_scanKnownDevices.push(scanResultObj);
		}
	}

	// se le mappe hanno un contenuto riempio la tabella
	fillTable();
}


/*****************************************************************
** Si assicura che la tabella dello scan sia visibile e vuota
******************************************************************/
function prepare()
{
	// se non lo �, rendo visibile la tabella dei risultati dello scan
	if (scanResult.style.display == "none") {
		scanResultContainer.style.visibility = "visible";
		scanResult.style.display = "block";
	}

	// svuoto la tabella; parto da 1 per preservare la riga con i titoli delle colonne della tabella
	while (scanResult.rows.length > 1)
		scanResult.deleteRow(-1);

	// svuoto array
	var auxArr = m_scanKnownDevices.splice(0, m_scanKnownDevices.length);
	auxArr = m_scanUnknownDevices.splice(0, m_scanUnknownDevices.length);
}

/*****************************************************************
** Riempie la tabella usando le mappe dei device noti e non noti
******************************************************************/
function fillTable()
{
	// target noti
	for (var i = 0; i < m_scanKnownDevices.length; i++)
	{

		var scanResultObj = m_scanKnownDevices[i];
		var newRow = scanResult.insertRow(-1);

		// serve se si sta usando la vecchia welcome
		if (typeof MRU_ROW_ATTR_NAME !== "undefined")
			// filtro in base al target selezionato
			newRow.setAttribute(MRU_ROW_ATTR_NAME, scanResultObj.targetID);

		// device name
		var td = newRow.insertCell(-1);
		div = document.createElement("div");
		div.innerText = scanResultObj.deviceName;
		td.appendChild(div);

		// device version
		td = newRow.insertCell(-1);
		div = document.createElement("div");
		div.innerText = scanResultObj.deviceVersion;
		td.appendChild(div);

		// modifica parametri di rete (se supportato)
		td = newRow.insertCell(-1);
		var span = document.createElement("span");
		span.innerHTML = scanResultObj.commAddress;
		td.appendChild(span);

		if (scanResultObj.setIPSupported || scanResultObj.setNetworkParamsSupported || scanResultObj.discoverySupported)
		{
			td = newRow.insertCell(-1);
			div = document.createElement("div");
			td.appendChild(div);
		}
		else
			td.colSpan = "2";

		if (scanResultObj.setIPSupported || scanResultObj.setNetworkParamsSupported) {
			var img = document.createElement("img");
			img.src = "img/changeIP_icon.png";
			img.className = "functionBtn"
			img.title = app.Translate("Change the network settings for the current target device");
			img.onclick = (function ()
			{
				var currentI = i;
				var callback;

				if (scanResultObj.setNetworkParamsSupported)
					callback = SetNetworkParams;
				else if (scanResultObj.setIPSupported)
					callback = SetIPAddress;

				return function () {
					callback(currentI);
				}
			})();

			div.appendChild(img);
		}

		// messaggio di discovery (se supportato)
		if (scanResultObj.discoverySupported) {
			var img = document.createElement("img");
			img.src = "img/discover.png";
			img.className = "functionBtn"
			img.title = app.Translate("Send a discover message to the current target device");
			img.onclick = (function ()
			{
				var currentI = i;
				return function () {
					DiscoverDevice(currentI);
				}
			})();

			div.appendChild(img);
		}

		// new project
		td = newRow.insertCell(-1);
		div = document.createElement("div");
		var img = document.createElement("img");
		img.src = "img/newPrj_icon.png";
		img.className = "functionBtn"
		img.title = app.Translate("Create a new project for the current target device");
		img.onclick = (function ()
		{
			var currentI = i;
			return function ()
			{
				openNewPrj(currentI)
			}
		})();
		div.appendChild(img);
		td.appendChild(div);

		// import project (se supportato)
		td = newRow.insertCell(-1);
		div = document.createElement("div");
		if (scanResultObj.sourceCodeDownloadSupported != 0)
		{
			img = document.createElement("img");
			img.src = "img/importPrj_icon.png";
			img.className = "functionBtn"
			img.title = app.Translate("Upload a project from the current target device");
			img.onclick = (function ()
			{
				var currentI = i;
				return function ()
				{
					uploadFromTarget(currentI)
				}
			})();
			div.appendChild(img);
		}
		else
			div.innerText = NOT_AVAILABLE_STR;
		td.appendChild(div);

		// nome applicazione
		td = newRow.insertCell(-1);
		div = document.createElement("div");
		if (scanResultObj.appName)
			div.innerText = scanResultObj.appName;
		else
			div.innerText = NOT_AVAILABLE_STR;
		td.appendChild(div);

		td = newRow.insertCell(-1);
		div = document.createElement("div");
		if (scanResultObj.appName)
			div.innerText = scanResultObj.appVerMajor + "." + scanResultObj.appVerMinor;
		else
			div.innerText = NOT_AVAILABLE_STR;
		td.appendChild(div);

	}

	// target sconosciuti
	for (var i = 0; i < m_scanUnknownDevices.length; i++)
	{
		var target = m_scanUnknownDevices[i];

		var newRow = scanResult.insertRow(-1);

		// serve se si sta usando la vecchia welcome
		if (typeof MRU_ROW_ATTR_NAME !== "undefined")
			// filtro in base al target selezionato: setto un attributo vuoto per non farli matchare mai nel filtro
			newRow.setAttribute(MRU_ROW_ATTR_NAME, "");

		var tdName = newRow.insertCell(-1);
		tdName.innerText = target.targetID;

		var tdVersion = newRow.insertCell(-1);
		tdVersion.innerText = NOT_AVAILABLE_STR;

		var tdCommString = newRow.insertCell(-1);
		tdCommString.innerText = target.commAddress;
		tdCommString.colSpan = "2";

		var tdNewProject = newRow.insertCell(-1);
		tdNewProject.innerText = NOT_AVAILABLE_STR;

		var tdUpload = newRow.insertCell(-1);
		tdUpload.innerText = NOT_AVAILABLE_STR;

		var td = newRow.insertCell(-1);
		td.innerText = target.appName;

		td = newRow.insertCell(-1);
		td.innerText = target.appVerMajor + "." + target.appVerMinor;
	}

	// serve se si sta usando la vecchia welcome
	if (typeof FilterTargets !== "undefined")
		FilterTargets();
}

/*****************************************************************
** Apri un nuovo progetto scelto dalla tabella dello scan
******************************************************************/
function openNewPrj(mapIdx)
{
	var target = m_scanKnownDevices[mapIdx];
	if (!target)
		return;

	var commString = app.CallFunction("common.BuildCommString", target.commProtocol, target.commAddress, 1000, target.commPortType, target.commPortNum, undefined, undefined, target.commProtocolOptions);

	// con lo scan non c'e' un template da passare
	app.CallFunction("extfunct.CreateNewProject", target.targetID, "", commString);
}

/*****************************************************************
** Fai l'upload del progetto dal target scelto dalla tabella dello scan
******************************************************************/
function uploadFromTarget(mapIdx)
{
	var target = m_scanKnownDevices[mapIdx];
	if (!target)
		return;

	var commString = app.CallFunction("common.BuildCommString", target.commProtocol, target.commAddress, 1000, target.commPortType, target.commPortNum, undefined, undefined, target.commProtocolOptions);

	app.CallFunction("logiclab.ImportSourceFromTarget", target.targetComm, commString);
}

/*****************************************************************
** Modifica dell'ip (protocol < v3)
******************************************************************/
function SetIPAddress(mapIdx)
{
	var target = m_scanKnownDevices[mapIdx];
	if (!target)
		return;

	app.TempVar("$$LLSCAN_IPADDRESS$$") = target.commAddress;
	app.TempVar("$$LLSCAN_IPADDRESS_RESULT$$") = "";

	app.OpenWindow("SetIPAddress", app.Translate("Change IP Address"), "");

	var newIP = app.TempVar("$$LLSCAN_IPADDRESS_RESULT$$");
	if (!newIP)
		return;

	var res = app.CallFunction("LLScan.SetIP", LLSCANSETTINGS.vendorID, target.uniqueId, target.commAddress, newIP);
	if (res)
		app.MessageBox(app.Translate("New address correctly set.\n This operation may take a minute or more depending on target.\n\nTarget reboot maybe required."), "", MSGBOX.MB_OK | MSGBOX.MB_ICONINFORMATION);
	else
		app.MessageBox(app.Translate("Error setting new address"), "", MSGBOX.MB_OK | MSGBOX.MB_ICONERROR);
}


/*****************************************************************
** Modifica piu' settings nello stesso momento (protocol v3)
******************************************************************/
function SetNetworkParams(mapIdx) {
	var target = m_scanKnownDevices[mapIdx];
	if (!target)
		return;

	app.TempVar("$$LLSCAN_NETWORKPARAMS_RESULT$$") = "";

	app.OpenWindow("SetNetworkParams", app.Translate("Change network configuration"), "");

	var res = app.TempVar("$$LLSCAN_NETWORKPARAMS_RESULT$$");
	if (!res)
		return;

	// SetNetworkParams(VARIANT vendorId, VARIANT uniqueId, VARIANT oldIp, VARIANT newIp, VARIANT netmask, VARIANT gateway, VARIANT dns, VARIANT dhcp)
	var res = app.CallFunction("LLScan.SetNetworkParams", LLSCANSETTINGS.vendorID, target.uniqueId, target.commAddress, res.ip, res.netmask, res.gateway, res.dns, res.dhcp);
	if (res)
		app.MessageBox(app.Translate("New address correctly set.\nThis operation may take a minute or more depending on target.\n\nTarget reboot maybe required."), "", MSGBOX.MB_OK | MSGBOX.MB_ICONINFORMATION);
	else
		app.MessageBox(app.Translate("Error setting new address"), "", MSGBOX.MB_OK | MSGBOX.MB_ICONERROR);
}


/*****************************************************************
** Invia al dispositivo un degnale di discover
******************************************************************/
function DiscoverDevice(mapIdx) {
	var target = m_scanKnownDevices[mapIdx];
	if (!target)
		return;

	// Discover(VARIANT vendorId, VARIANT uniqueId)
	app.CallFunction("LLScan.Discover", LLSCANSETTINGS.vendorID, target.uniqueId);
}