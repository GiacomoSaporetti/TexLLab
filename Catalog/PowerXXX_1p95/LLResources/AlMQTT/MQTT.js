var TREENAME = "tree1";
var genfuncs = app.CallFunction("common.GetGeneralFunctions");
var gentypes = app.CallFunction("common.GetGeneralTypes");
var enuLogLevels = gentypes.enuLogLevels
var m_fso = app.CallFunction("common.CreateObject", "Scripting.FileSystemObject")

var TREE_OVERLAY_NONE = 0
var TREE_OVERLAY_DISABLED = 1

// flag globale usato nelle pagine di MQTT
var m_diagnosticsEnabled = false;

var MQTT_ROOT_NODE = "MQTT"
var MQTT_BROKER_NODE = "MQTTBroker";

var CONFIG_VERSION = 5

var m_clientNameToIPAddrToPortMap = {}

var ParseBoolean = genfuncs.ParseBoolean
var GetNode = genfuncs.GetNode
var SetNode = genfuncs.SetNode

function AddBroker()
{
	var curdata = app.HMIGetElementData(TREENAME, "")

	var datapath = app.AddTemplateData("MQTTBroker", curdata, 0, false)
	app.CallFunction("common.AssignUniqueID", datapath);

	var itempath = app.HMIGetElementPath(TREENAME, datapath)
	if (itempath)
		app.HMIEditElement(TREENAME, itempath)
}

function DeleteBroker()
{
	var ris = app.MessageBox(app.Translate("Do you want to delete the selected broker?"), "", gentypes.MSGBOX.MB_ICONQUESTION | gentypes.MSGBOX.MB_YESNO);
	if (ris == gentypes.MSGBOX.IDNO)
		return;

	var curdata = app.HMIGetElementData(TREENAME, "")

	// cancello i certificati associati se sono presenti
	var prjpath = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath"));
	var MQTTDir = prjpath + "\\Download\\MQTT\\";

	var cert = app.DataGet(curdata + "/@clientCert", 0);
	if (cert)
		if (m_fso.FileExists(MQTTDir + cert))
			m_fso.DeleteFile(MQTTDir + cert);

	var key = app.DataGet(curdata + "/@clientKey", 0);
	if (key)
		if (m_fso.FileExists(MQTTDir + key))
			m_fso.DeleteFile(MQTTDir + key);

	var CAcert = app.DataGet(curdata + "/@caCert", 0);
	if (CAcert)
		if (m_fso.FileExists(MQTTDir + CAcert))
			m_fso.DeleteFile(MQTTDir + CAcert);

	app.DataDelete(curdata, 0)

	app.OpenWindow("emptypage", "", "")
}

function OnEndBrokerEdit(treepath, newtext)
{
	var curdata = app.HMIGetElementData(TREENAME, treepath)

	app.HMISetCurElement(TREENAME, treepath)
	app.OpenWindow(app.HMIGetLinkedWindow(TREENAME, treepath), "", curdata)
}


function logError(errStr, funcName, node, attributeName)
{
	var errmsg = genfuncs.FormatMsg(app.Translate(errStr))
	throw genfuncs.AddLog(gentypes.enuLogLevels.LEV_CRITICAL, funcName, errmsg, genfuncs.SplitFieldPath(node, attributeName));
}

function BuildCfg_MQTT(device)
{
	var filename = "MQTTEngineInit.plc";

	var nodelist = device.selectNodes(MQTT_ROOT_NODE + "/" + MQTT_BROKER_NODE);

	if (!genfuncs.ParseBoolean(device.selectNodes(MQTT_ROOT_NODE)[0].getAttribute("enabled")) || nodelist.length == 0)
	{
		app.CallFunction("compiler.LogicLab_RemovePLC", app.CallFunction("logiclab.get_ProjectPath"), filename);
		return true;
	}

	var content = "(* Automatically generated, do not edit! *)\n\n";

	//structures definitions
	var programContent = "\tPROGRAM MQTTEngineInit WITH Init;"
	programContent += "\n\
	PROGRAM MQTTEngineInit\n\
	VAR\n\
		MqttEngineBrokerConfig : MqttEngineBrokerConfig_t;\n\
		MqttEngineItemConfig : MqttEngineItemConfig_t;\n\
		MqttEngineFieldConfig : MqttEngineFieldConfig_t;\n\
		warningsKiller: SwdcError_t;\n\
	END_VAR\n\
	\n\
	{ CODE: ST } \n\
	(* PROGRAM MQTTEngineInit WITH Init *) \n\
	\n"

	programContent += "\
	(*	START configuration of the MQTT engine ("+ nodelist.length + " brokers)	*)\n\
	warningsKiller := MqttEngine_StartEngineConf("+ CONFIG_VERSION + ", " + nodelist.length + "); \n\n"

	var brokerIndex = 0;
	var node;
	var enabledBrokerCount = 0;
	while (node = nodelist.nextNode())
	{
		programContent += "\
	(*	START configuration of the broker: "+ brokerIndex + "	*)\n\
	MqttEngineBrokerConfig.Enabled:=" + (ParseBoolean(GetNode(node, "@enabled")) ? "TRUE" : "FALSE") + ";\n\
	MqttEngineBrokerConfig.AutoConnect:=" + (ParseBoolean(GetNode(node, "@autoConnect")) ? "TRUE" : "FALSE") + ";\n\
	MqttEngineBrokerConfig.Caption:='" + GetNode(node, "@caption") + "';\n\
	MqttEngineBrokerConfig.ClientName:='" + GetNode(node, "@clientname") + "';\n\
	MqttEngineBrokerConfig.Address:='" + GetNode(node, "@ipaddress") + "';\n\
	MqttEngineBrokerConfig.Port:=" + GetNode(node, "@port") + ";\n\
	MqttEngineBrokerConfig.UserName:='" + GetNode(node, "@username") + "';\n\
	MqttEngineBrokerConfig.Password:='" + GetNode(node, "@password") + "';\n\
	MqttEngineBrokerConfig.CommonNameServer:=" + "''" + ";\n\
	MqttEngineBrokerConfig.TimeoutTcp:=" + GetNode(node, "@timeoutTCP") + ";\n\
	MqttEngineBrokerConfig.TimeoutMqtt:=" + GetNode(node, "@timeoutMQTT") + "; \n"


		var brokerListPublish = node.selectNodes("publish/brokerMapping")
		var brokerListSubscribe = node.selectNodes("subscribe/brokerMapping")

		var brokerEnabled = ParseBoolean(GetNode(node, "@enabled"))

		var publishCount = brokerEnabled ? node.selectNodes("publish/brokerMapping").length : 0;
		var subscribeCount = brokerEnabled ? node.selectNodes("subscribe/brokerMapping").length : 0;

		programContent += "\
	warningsKiller := MqttEngine_StartBrokerConf("+ brokerIndex + ", " + publishCount + ", " + subscribeCount + ", ADR(MqttEngineBrokerConfig)); \n"

		if (brokerEnabled)
		{
			programContent += BuildCfg_MQTT_Broker(brokerListPublish, true, brokerIndex)
			programContent += BuildCfg_MQTT_Broker(brokerListSubscribe, false, brokerIndex)
		}

		programContent += "\n"
		programContent += "\
	warningsKiller := MqttEngine_EndBrokerConf("+ brokerIndex + ");\n"

		programContent += "\n"

		if (ParseBoolean(GetNode(node, "@enabled")))
			enabledBrokerCount++;

		brokerIndex++;

	}

	programContent += "\
	warningsKiller := MqttEngine_EndEngineConf("+ CONFIG_VERSION + "); \n"

	programContent += "\n\tEND_PROGRAM\n"

	content += programContent;

	app.CallFunction("compiler.LogicLab_UpdatePLC", app.CallFunction("logiclab.get_ProjectPath"), filename, content, false, 1, false);
	app.PrintMessage("Created MQTT engine Configuration code: " + enabledBrokerCount + " brokers of " + nodelist.length, enuLogLevels.LEV_INFO);

	return true;
}

function BuildCfg_MQTT_Broker(nodelist, isPublish, brokerID)
{
	if (nodelist.length == 0)
		return ""

	var res = "\n"
	var node;
	var structName = isPublish ? "MQTTPublishes" : "MQTTSubscribes"
	var itemid = 0
	while (node = nodelist.nextNode())
	{
		var fieldlist = node.selectNodes("brokerField")

		res += "\n\
	MqttEngineItemConfig.Topic:='" + GetNode(node, "@topic") + "';\n\
	MqttEngineItemConfig.ReadOnly:=" + (ParseBoolean(GetNode(node, "@ro")) ? "TRUE" : "FALSE") + ";\n\
	MqttEngineItemConfig.QoS:=" + GetNode(node, "@qos") + ";\n\
	MqttEngineItemConfig.Retain:=" + (ParseBoolean(GetNode(node, "@retain")) ? "TRUE" : "FALSE") + ";\n\
	MqttEngineItemConfig.JsonPayload:=" + (GetNode(node, "@payload") == "json" ? "TRUE" : "FALSE") + ";\n\
	MqttEngineItemConfig.InhibitTime_s:=" + GetNode(node, "@inhibittime") + ";\n\
	MqttEngineItemConfig.PollingTime_ms:=" + GetNode(node, "@polling") + ";\n\
	MqttEngineItemConfig.IsPublishObj:=" + (isPublish ? "TRUE" : "FALSE") + ";\n\
	warningsKiller := MqttEngine_StartItemConf("+ brokerID + ", " + itemid + ", " + (isPublish ? "TRUE" : "FALSE") + ", " + fieldlist.length + ", ADR(MqttEngineItemConfig)); \n"

		var payload = GetNode(node, "@payload");

		// configurazione field
		var fieldnode;
		var fieldIndex = 0
		while (fieldnode = fieldlist.nextNode())
		{
			var varName = CleanVarName(GetNode(fieldnode, "@value"));


			res += "\n\
	MqttEngineFieldConfig.Name:='" + GetNode(fieldnode, "@name") + "';\n\
	MqttEngineFieldConfig.Value:='" + varName + "';\n\
	MqttEngineFieldConfig.SendOnVariation:=" + (ParseBoolean(GetNode(fieldnode, "@sendonvariation")) ? "TRUE" : "FALSE") + ";\n\
	MqttEngineFieldConfig.Threshold:=" + GetNode(fieldnode, "@threshold") + ";\n"
			if (IsAPLCVarName(varName))
			{
				res += "\
	MqttEngineFieldConfig.Addr:= ADR(" + varName + "); \n"
			}

			var typeAndSize = GetMQTTDatatypeAndSize(varName);

			res += "\
	MqttEngineFieldConfig.DataType:=" + typeAndSize.type + ";\n\
    MqttEngineFieldConfig.StringSize:=" + typeAndSize.size + ";\n\
	warningsKiller := MqttEngine_StartFieldConf("+ brokerID + ", " + itemid + ", " + fieldIndex + ", " + (isPublish ? "TRUE" : "FALSE") + ", ADR(MqttEngineFieldConfig)); \n\
	warningsKiller := MqttEngine_EndFieldConf("+ brokerID + ", " + itemid + ", " + fieldIndex + ", " + (isPublish ? "TRUE" : "FALSE") + "); \n"

			fieldIndex++;
		}

		res += "\n\
	warningsKiller := MqttEngine_EndItemConf("+ brokerID + ", " + itemid + ", " + (isPublish ? "TRUE" : "FALSE") + "); \n"
		itemid++;
	}

	return res;
}

function EnableDisalbleNode()
{
	var curdata = app.HMIGetElementData(TREENAME, "");
	var enabled = app.DataGet(curdata + "/@enabled", 0);
	enabled = genfuncs.ParseBoolean(enabled);

	enabled = !enabled;

	var treepath = app.HMIGetElementPath(TREENAME, curdata);

	EnableDisableItemOnTree(enabled, treepath);

	app.DataSet(curdata + "/@enabled", 0, enabled ? 1 : 0);

	app.OpenWindow(app.HMIGetLinkedWindow(TREENAME, treepath), "", curdata)
}

function EnableDisableItemOnTree(enabled, treepath)
{
	app.HMISetOverlayImg(TREENAME, treepath, enabled ? TREE_OVERLAY_NONE : TREE_OVERLAY_DISABLED)
}

function OnLoadNode(node)
{
	var enabled = node.getAttribute("enabled");
	var datapath = app.GetDataPathFromNode(node)
	var treepath = app.HMIGetElementPath(TREENAME, datapath);

	EnableDisableItemOnTree(genfuncs.ParseBoolean(enabled), treepath);
}

function GetDiagnosticsEnabled()
{
	return m_diagnosticsEnabled;
}

function SetDiagnosticsEnabled(flag)
{
	m_diagnosticsEnabled = flag;
}

function UpgradeNode(root, oldVersion)
{
	var xmldoc = app.GetXMLDocument()
}

function Validate(device)
{
	var resOk = true;
	m_clientNameToIPAddrToPortMap = {}

	// validazione dei broker
	var nodelist = device.selectNodes(MQTT_ROOT_NODE + "/" + MQTT_BROKER_NODE);
	var node;
	while (node = nodelist.nextNode())
	{
		try
		{
			ValidateMQTTBroker(node)
		}
		catch (err)
		{
			resOk = false;
		}
	}

	return resOk ? enuLogLevels.LEV_OK : enuLogLevels.LEV_CRITICAL;
}


function ValidateMQTTBroker(node)
{
	var FUNCNAME = "ValidateMQTTBroker";

	// broker disabilitato, non lo valido
	if (!genfuncs.ParseBoolean(GetNode(node, "@enabled")))
		return true;

	// controllo che il client name sia specificato, che sia parametrico o statico
	var clientnameParametric = genfuncs.ParseBoolean(node.getAttribute("clientnameParametric"));
	var attrName = clientnameParametric ? "clientnameParametricVar" : "clientname";

	var clientname = node.getAttribute(attrName);
	if (!clientname)
		logError(app.Translate("Client id cannot be empty"), FUNCNAME, node, attrName);

	// se la var e' specificata controllo che esista e sia usata
	if (clientnameParametric && !app.CallFunction("logiclab.FindSymbol", clientname, ""))
	{
		var errStr = genfuncs.FormatMsg(app.Translate("PLC variable \"%1\" is not defined or used"), clientname);
		logError(errStr, FUNCNAME, node, attrName);
	}

	var ipaddress = node.getAttribute("ipaddress");
	if (!ipaddress)
		logError(app.Translate("Broker address cannot be empty"), FUNCNAME, node, "ipaddress");

	var port = node.getAttribute("port");

	if (m_clientNameToIPAddrToPortMap[clientname + ipaddress + port])
	{
		var errmsg = genfuncs.FormatMsg(app.Translate("Duplicate client id / Broker address / Port"))
		throw genfuncs.AddLog(gentypes.enuLogLevels.LEV_WARNING, FUNCNAME, errmsg, genfuncs.SplitFieldPath(node, "ipaddress"));
	}
	else
		m_clientNameToIPAddrToPortMap[clientname + ipaddress + port] = true;

	// se la setting e' parametrica controllo che, se specificata una var, esista e sia usata. altrimenti username puo' anche essere nullo
	var usernameParametric = genfuncs.ParseBoolean(node.getAttribute("usernameParametric"));
	if (usernameParametric)
	{
		var username = node.getAttribute("usernameParametricVar");

		if (username !== "" && !app.CallFunction("logiclab.FindSymbol", username, ""))
		{
			var errStr = genfuncs.FormatMsg(app.Translate("PLC variable \"%1\" is not defined or used"), username);
			logError(errStr, FUNCNAME, node, "usernameParametricVar");
		}
	}

	// se la setting e' parametrica controllo che, se specificata una var, esista e sia usata. altrimenti la password puo' anche essere nulla
	var passwordParametric = genfuncs.ParseBoolean(node.getAttribute("passwordParametric"));
	if (passwordParametric)
	{
		var password = node.getAttribute("passwordParametricVar");

		if (password !== "" && !app.CallFunction("logiclab.FindSymbol", password, ""))
		{
			var errStr = genfuncs.FormatMsg(app.Translate("PLC variable \"%1\" is not defined or used"), password);
			logError(errStr, FUNCNAME, node, "passwordParametricVar");
		}
	}

	// controllo certificato e chiave
	var clientCert = node.getAttribute("clientCert");
	var clientKey = node.getAttribute("clientKey");
	if ((clientCert && !clientKey) || (clientKey && !clientCert))
	{
		var errStr = app.Translate("You must specify none or both 'Client certificate' and 'Client private key'");
		logError(errStr, FUNCNAME, node, "clientCert");
	}

	// controllo mappature publish/subscribe
	var mappingNodes = node.selectNodes("*/brokerMapping");

	var mappingNode;
	while (mappingNode = mappingNodes.nextNode())
	{
		var fieldNodes = mappingNode.selectNodes("brokerField");

		if (!fieldNodes || fieldNodes.length === 0)
		{
			var errStr = app.Translate("No PLC variable assigned");
			logError(errStr, FUNCNAME, mappingNode, "variable");
		}

		var fieldNode;
		while (fieldNode = fieldNodes.nextNode())
		{
			var varName = CleanVarName(fieldNode.getAttribute("value"));
			if (!varName)
			{
				logError(app.Translate("PLC variable name cannot be empty"), FUNCNAME, mappingNode, "value");
			}

			// se non un commento e non una keyword, cerco la variabile PLC associata
			if (IsAPLCVarName(varName))
			{
				if (!app.CallFunction("logiclab.GetGlobalVariable", varName))
				{
					var errStr = genfuncs.FormatMsg(app.Translate("PLC variable \"%1\" does not exist"), varName);
					logError(errStr, FUNCNAME, mappingNode, "value");
				}
			}

			if (!fieldNode.getAttribute("name") && (mappingNode.getAttribute("payload") == "json"))
			{
				var errStr = genfuncs.FormatMsg(app.Translate("Field name cannot be empty"), varName);
				logError(errStr, FUNCNAME, mappingNode, "value");
			}
		}

		var topicName = mappingNode.getAttribute("topic");
		if (!topicName)
			logError(app.Translate("Topic name cannot be empty"), FUNCNAME, mappingNode, "topic");
	}

	return true;
}

var IECTYPETOMQTTTYPE =
{
	"INT": "MqttEngineDataType_INT", "DINT": "MqttEngineDataType_DINT",
	"WORD": "MqttEngineDataType_UINT", "DWORD": "MqttEngineDataType_UDINT",
	"REAL": "MqttEngineDataType_REAL", "BOOL": "MqttEngineDataType_BOOL",
	"SINT": "MqttEngineDataType_SINT", "BYTE": "MqttEngineDataType_USINT",
	"USINT": "MqttEngineDataType_USINT", "UINT": "MqttEngineDataType_UINT",
	"UDINT": "MqttEngineDataType_UDINT", "LINT": "MqttEngineDataType_LINT",
	"ULINT": "MqttEngineDataType_ULINT", "LREAL": "MqttEngineDataType_LREAL",
	"STRING": "MqttEngineDataType_STRING"
}

function GetMQTTDatatypeAndSize(varName)
{
	var baseEnum = "MqttEngineDataType_t#"
	var v = app.CallFunction("logiclab.FindSymbol", varName, "")
	if (!v)
        return { type: baseEnum + "MqttEngineDataType_RAW", size: "0" }

	var res = IECTYPETOMQTTTYPE[v.type]
	if (!res)
        res = "MqttEngineDataType_RAW"

    var size = "0"
	if (v.type == "STRING")
		size = v.GetStrDimensions().replace("[", "").replace("]", "")

    return { type: baseEnum + res, size : size }
}

function CleanVarName(varName)
{
	// se e' un numero (costante) appendo apici all'inizio e in fondo
	varName = varName.replace(/^(\d+)$/, "'$1'");
	// se e' una stringa (o numero) delimitata da doppi apici li sostituisco con apici singoli
	varName = varName.replace(/^"(\w+)"$/, "'$1'");
	// escape ' con $' per singolo apice IEC
	varName = varName.replace(/'/g, "$$'");

	return varName
}

function IsAPLCVarName(varName)
{
	// deve essere non vuota, non una keyword e non un commento
	return varName !== "" && varName !== "<timestamp>" && varName.charAt(0) !== "$"
}

