var rowTemplate;
var gridDatapath = ""

var columns;
var m_columnsNodes;

var gridErrorPos = { row: -1, col: -1 }
var m_currentUniqueID
var m_deviceParamsMap = {}
var m_parList = []
var m_extName
var m_protocol
var m_useAlModbusRTU
var m_oneShotEnabled
var m_useAlModbusStructSlaves

function InitGrid(datapath)
{
	gridDatapath = datapath + tablePath
	var node = app.SelectNodesXML(gridDatapath)[0]
	var device  = node.selectSingleNode(XPATH_ROOTDEVICE)
	m_currentUniqueID  = parseInt(device.getAttribute("uniqueID"))
	m_extName = device.getAttribute("ExtensionName")
	
	// device modbus slave generico corrente
	var parent = node.selectSingleNode(XPATH_PARENTDEVICE)
	// ottiene il protocol dal parent (la porta)
	m_protocol = parent.parentNode.getAttribute("protocol")

	var attr = (m_protocol == "ModbusTCP_master") ? "ModbusTCPInputOutputOnVariation" : "ModbusRTUInputOutputOnVariation";
	var hasInOutOnVar = genfuncs.ParseBoolean(device.getAttribute(attr));
	tabModbusCustomInputOutput.style.display = hasInOutOnVar ? "" : "none";
	
	
	m_useAlModbusRTU = genfuncs.ParseBoolean(device.getAttribute("useAlModbusRTU"));
	
	if ( m_inout == "inOut" )
	{
		rowTemplate = "modbusMappingIO"		// nome del template della riga
		 
		columns = { parameter: 0, parAddress: 1, parType: 2, label: 3, type: 4, dataBlock: 5, pollTime: 6, writeFirst: 7, enabled: 8 }
		m_columnsNodes = [ "ioObject/@objectIndex", "ioObject/@objectIndex", "ioObject/@objtype", "label", "type", "dataBlock", "pollTime", "writeFirst", "enabled" ]
	}
	else
	{
		rowTemplate = "modbusMapping"		// nome del template della riga
		
		columns = { parameter: 0, parAddress: 1, parType: 2, label: 3, type: 4, dataBlock: 5, pollTime: 6, oneshot: 7, enabled: 8 }
		m_columnsNodes = [ "ioObject/@objectIndex", "ioObject/@objectIndex", "ioObject/@objtype", "label", "type", "dataBlock", "pollTime", "oneshot", "enabled" ]

		if (m_useAlModbusRTU)
		{
			if ( m_protocol == "ModbusTCP_master" )
				m_oneShotEnabled = genfuncs.ParseBoolean(device.getAttribute("useAlModbusTCPOneShot"));
			else
				m_oneShotEnabled = genfuncs.ParseBoolean(device.getAttribute("useAlModbusRTUOneShot"));
		}
		else
			m_oneShotEnabled = true;  // per LLExec sempre attivo
		
		m_useAlModbusStructSlaves = genfuncs.ParseBoolean(device.getAttribute("useAlModbusStructSlaves"));
		
		
		if (m_useAlModbusStructSlaves)
		{
			m_columnsNodes.splice(columns.type, 2);
			columns.pollTime -= 2;
			columns.oneshot -= 2;
			columns.enabled -= 2;
			delete columns.type;
			delete columns.dataBlock;
			
			spanAssign.style.display = "none";
			spanUnAssign.style.display = "none";
		}
		
		if (!m_oneShotEnabled)
		{
			m_columnsNodes.splice(columns.oneshot, 1);
			columns.enabled--;
			delete columns.oneshot;
		}
	}
	
	// elenco di tutti i parametri modbus del device
	var parList = app.CallFunction("ModbusCustom.GetDeviceParameters", parent.nodeName)
	
	var enumList = [0, ""]
	for (var i = 0; i < parList.length; i++)
	{
		var par = parList[i]
		if (par.readOnly && m_inout != "in")
			continue  // se configurazione output e parametro readonly lo salta
		
		// lista per enumeratore
		enumList.push(par.ipa, par.name)
		// memorizza il parametro in una mappa per ricerca veloce
		m_deviceParamsMap[par.ipa] = par
		// array per finestra selezione parametro
		var item = { ipa: par.ipa, name: par.name, address: par.commIndex, typeIEC: par.typeIEC, description: par.description}
		m_parList.push(item)
	}
	
	var firstTimeEnum = [0, "Read", 1, "Write"]

	grid.AddEnum("paramsEnum", enumList)
	grid.AddEnum("firstTimeEnum", firstTimeEnum)
	
	grid.AddColumn(200, 100,  true, false, egColumnType.egCombo,  0, app.Translate("Parameter"), "paramsEnum")
	grid.AddColumn( 70, 100,  true, false, egColumnType.egEdit, 0, app.Translate("Address"))
	grid.AddColumn( 70, 100,  true, false, egColumnType.egEdit, 0, app.Translate("Par Type"))
	grid.AddColumn(200, 100, false, false, egColumnType.egEdit,  0, !m_useAlModbusStructSlaves ? app.Translate("Variable") : app.Translate("Field"))
	if (!m_useAlModbusStructSlaves)
		grid.AddColumn( 70, 100,  true, false, egColumnType.egEdit, 0, app.Translate("Var Type"))
	if (!m_useAlModbusStructSlaves)
		grid.AddColumn( 80, 100,  true, false, egColumnType.egEdit, 0, app.Translate("DataBlock"))
	grid.AddColumn( 80, 100, false,  true, egColumnType.egEdit, 0, app.Translate("Polling time"))
	if ( m_oneShotEnabled )
		grid.AddColumn(200, 100, false, false, egColumnType.egEditOpt,  0, app.Translate("Oneshot"))
	if ( m_inout == "inOut" )
		grid.AddColumn(100, 100, false, true, egColumnType.egCombo,  0, app.Translate("Startup Behavior"), "firstTimeEnum")
		
	grid.AddColumn( 60, 100, false, false, egColumnType.egCheckbox,   0, app.Translate("Enabled"))  //translate
	
	grid.Init()
	
	RestoreGridSort(grid, gridDatapath)
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)
}

function grid_AddRowXML()
{
	var inputList
	if (m_inout != "in")
	{
		// negli output non permette la duplicazione dei parametri, di conseguenza filtra quelli già usati
		var usedPars = {}
		
		for (var row = 0; row < grid.NumRows; row++)
		{
			var ipa = app.DataGet(BuildPath(row,columns.parAddress), 0)
			usedPars[ipa] = true
		}
		
		inputList = []
		for (var i = 0; i < m_parList.length; i++)
		{
			var item = m_parList[i]
			if (!usedPars[item.ipa])
				inputList.push(item)
		}
	}
	else
		// per gli input nessun filtro
		inputList = m_parList
		
	//ordino la lista in base al commIndex
	if(inputList.length > 1)
		inputList.sort(compareByAddress);
	
	app.TempVar("VarsList_input") = inputList
	app.OpenWindow("VarsList", app.Translate("Modbus Parameters"), "")

	app.TempVar("VarsList_input") = undefined
	var result = app.TempVar("VarsList_result")
	if (!result || result.length == 0) return
	
	for (var i = 0; i < result.length; i++)
	{
		var item = inputList[result[i]]
		var datapath = app.AddTemplateData(rowTemplate, gridDatapath, 0, false)
		app.DataSet(datapath + "/ioObject/@inout", 0, m_inout)
		app.DataSet(datapath + "/ioObject/@objectIndex", 0, item.ipa)
		// salva anche il typeIEC, serve alla AssignPLCVar per filtrare le variabili field
		app.DataSet(datapath + "/ioObject/@objtype", 0, item.typeIEC)
	}
	grid.InsertRows(result.length)

	grid.Move(grid.GetRealRow(grid.NumRows-1), columns.parameter)
}

function grid_DeleteRowXML()
{
	var c = { label: columns.label }
	UnAssignPLCVars(grid, c)
	
	if ( m_oneShotEnabled )
	{
		var c = { label: columns.oneshot }
		UnAssignPLCVars(grid, c)
	}
	
	grid_DeleteMultiple(grid, gridDatapath)
}

function Assign()
{
	var type = grid.Elem(grid.SelectedRow, columns.parType)
	var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", m_protocol, (m_inout == "in"), type)
	
	if ( m_useAlModbusRTU )
	{
		AssignPLCVar(grid, columns, type, dataBlock, PLCVARASSIGN_ONLYSIMPLE, undefined, "Modbus_Vars")
	}
	else
	{
		AssignPLCVar(grid, columns, type, dataBlock)
	}
}

function UnAssign()
{
	UnAssignPLCVars(grid, columns)
}
