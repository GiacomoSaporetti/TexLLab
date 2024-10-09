var path;
var m_endpointId;

// mappa[valori] = descrizioni corrispondenti ai codici di errore
var m_enumElementsMap = {};

const ENDPOINT_VARNAMES_PREFIX = 'sysMQTTEndpointStatus';
const ENDPOINT_VARNAMES = {
	CONFIGURED: 'configured',
	ACTIVE: 'active',
	RUNNING: 'running',
	HANDLE: 'handle',
	CONNECTION_STATE: 'connectionState',
	LAST_ERROR_PUBLISH: 'lastErrorPublish',
	LAST_ERROR_SUBSCRIBE: 'lastErrorSubscribe',
	NUM_PUBLISH_ITEMS: 'numPublishItems',
	NUM_SUBSCRIBE_ITEMS: 'numSubscribeItems',
	ERROR_PUBLISH_IDX: 'errorPublishIdx',
	ERROR_SUBSCRIBE_IDX: 'errorSubscribeIdx',
}

var m_currentVarNamesPrefix;

function InitPage()
{
	path = _DATAPATH;
	pageTitle.innerText = "'" + app.DataGet(path + "@caption", 0) + "' " + app.Translate("diagnostics");

	// configurazione/variabili remote
	m_endpointId = app.DataGet(path + "@uniqueID", 0);

	var diagnosticsEnabled = app.CallFunction("MQTT.GetDiagnosticsEnabled");
	if (!diagnosticsEnabled)
	{
		diagnosticsEnableMessage.classList.remove("hide");
		diagnosticsEnableMessage.innerText = app.Translate("Diagnostics for MQTT is disabled. You can enable it from the \"MQTT\" menu.");
	}
	else
	{
		var enumElementsList = app.CallFunction("logiclab.GetEnumElements", "MQTT_Error");
		if (enumElementsList)
		{
			// descrizione enumerativi diagnostica
			for (var i = 0, j = enumElementsList.length; i < j; i++)
			{
				var desc = enumElementsList.Item(i).Description;
				var value = enumElementsList.Item(i).InitValue;
				let name = enumElementsList.Item(i).Name;
				m_enumElementsMap[value] = { description: desc, name: name };
			}

			var pos = path.lastIndexOf("[");
			var treeNodeNumber = parseInt(path.substring(pos+1, path.length-1)) - 1;
			m_currentVarNamesPrefix = ENDPOINT_VARNAMES_PREFIX + '[' + treeNodeNumber + '].';

			fillDiagnosticData();
			setInterval(fillDiagnosticData, 1000);
		}
		else
		{
            let errMsg = app.Translate("MQTT diagnostics library not loaded.\nPlease add MQTTLib.plclib to the project.");
			diagnosticsEnableMessage.innerText = errMsg;
			diagnosticsEnableMessage.classList.remove("hide");
			app.MessageBox(errMsg, "", gentypes.MSGBOX.MB_ICONERROR);
		}
	}
}

function fillDiagnosticData()
{
	var isConnected = (app.CallFunction("logiclab.get_Connected") && !app.CallFunction("logiclab.get_ConnectedInError"));
	if (isConnected)
	{
		diagnosticData.classList.remove("hide");
		diagnosticsEnableMessage.classList.add("hide");

		// configured
		var isConfigured = readVar(ENDPOINT_VARNAMES.CONFIGURED);
		txtConfigured.className = "status " + (isConfigured ? "on" : "off");
		txtConfigured.innerText = isConfigured ? app.Translate("Yes") : app.Translate("No");
		txtConfiguredVal.innerText = isConfigured !== undefined ? isConfigured : "";

		// active
		var isActive = readVar(ENDPOINT_VARNAMES.ACTIVE);
		txtActive.className = "status " + (isActive ? "on" : "off");
		txtActive.innerText = isActive ? app.Translate("Yes") : app.Translate("No");
		txtActiveVal.innerText = isActive !== undefined ? isActive : "";

		// running
		var isRunning = readVar(ENDPOINT_VARNAMES.RUNNING);
		txtRunning.className = "status " + (isRunning ? "on" : "off");
		txtRunning.innerText = isRunning ? app.Translate("Yes") : app.Translate("No");
		txtRunningVal.innerText = isRunning !== undefined ? isRunning : "";

		// Connection state
		let connState = readVar(ENDPOINT_VARNAMES.CONNECTION_STATE);
		if (connState == 0)
		{
			txtConnState.innerText = app.Translate("Ok");
			txtConnState.className = "status on";
		}
		else
		{
			txtConnState.innerText = m_enumElementsMap[connState] ? m_enumElementsMap[connState].description : "-";
			txtConnState.className = "status off";
		}

		txtConnStateVal.innerText = m_enumElementsMap[connState] ? m_enumElementsMap[connState].name : "";

		// numero var in e out
		let varInVal = readVar(ENDPOINT_VARNAMES.NUM_SUBSCRIBE_ITEMS);
		let varOutVal = readVar(ENDPOINT_VARNAMES.NUM_PUBLISH_ITEMS);
		txtInputVars.innerText = varInVal !== undefined ? varInVal : "";
		txtOutputVars.innerText = varOutVal !== undefined ? varOutVal : "";

		// errore in publish
		var pubErrCode = readVar(ENDPOINT_VARNAMES.LAST_ERROR_PUBLISH);
		if (pubErrCode == 0)
		{
			txtErrPub.innerText = app.Translate("No");
			txtErrPub.className = "status on";
			rowErrPubIdx.classList.add("hide");
		}
		else
		{
			txtErrPub.innerText = m_enumElementsMap[pubErrCode] ? m_enumElementsMap[pubErrCode].description : "-";
			txtErrPub.className = "status off";
			rowErrPubIdx.classList.remove("hide");

			// se c'e' l'errore mostro l'indice
			let val = readVar(ENDPOINT_VARNAMES.ERROR_PUBLISH_IDX);
			txtErrPubIdxVal.innerText = val ? val : '';
		}

		txtErrPubVal.innerText = m_enumElementsMap[pubErrCode] ? m_enumElementsMap[pubErrCode].name : "";


		// errore in subscribe
		var subErrCode = readVar(ENDPOINT_VARNAMES.LAST_ERROR_SUBSCRIBE);
		if (subErrCode == 0)
		{
			txtErrSub.innerText = app.Translate("No");
			txtErrSub.className = "status on";
			rowErrSubIdx.classList.add("hide");
		}
		else
		{
			txtErrSub.innerText = m_enumElementsMap[subErrCode] ? m_enumElementsMap[subErrCode].description : "-";
			txtErrSub.className = "status off";
			rowErrSubIdx.classList.remove("hide");

			// se c'e' l'errore mostro l'indice
			let val = readVar(ENDPOINT_VARNAMES.ERROR_SUBSCRIBE_IDX);
			txtErrSubIdxVal.innerText = val ? val : '';
		}

		txtErrSubVal.innerText = m_enumElementsMap[subErrCode] ? m_enumElementsMap[subErrCode].name : "";
	}
	else
	{
		diagnosticsEnableMessage.innerText = app.Translate("Connect to target to see these informations.");
		diagnosticsEnableMessage.classList.remove("hide");
		diagnosticData.classList.add("hide");
	}
}

function readVar(symName)
{
	var sym = app.CallFunction("logiclab.FindSymbol", m_currentVarNamesPrefix + symName, "");
	if (!sym)
		return;

	var val = sym.ReadValue();

	return val;
}